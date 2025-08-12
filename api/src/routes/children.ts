import { Router } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db';
import type { CreateChildRequest } from '../types';

// Split routers: customerChildrenRouter handles /customers/:customerId/children
// childrenRouter handles /children/:id operations
export const customerChildrenRouter = Router();
export const childrenRouter = Router();

// Validation schema for child creation
const createChildSchema = z.object({
  firstName: z.string().min(1).max(100),
  avatarKey: z.string().min(1),
});

// Validation schema for child update
const updateChildSchema = createChildSchema.partial();

// POST /customers/:customerId/children - Create a new child
customerChildrenRouter.post('/:customerId/children', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    // Basic UUID format validation
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const { firstName, avatarKey }: CreateChildRequest = createChildSchema.parse(req.body);

    const client = getDbClient();

    // Verify customer exists
    const customerCheck = await client.query('SELECT id, studio_id FROM customers WHERE id = $1', [customerId]);
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const query = `
      INSERT INTO children (customer_id, first_name, avatar_key)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const { rows } = await client.query(query, [customerId, firstName, avatarKey]);

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error creating child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /customers/:customerId/children - List children for a customer
customerChildrenRouter.get('/:customerId/children', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const client = getDbClient();

    // Verify customer exists
    const customerCheck = await client.query('SELECT id FROM customers WHERE id = $1', [customerId]);
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const query = `
      SELECT ch.*,
             COUNT(b.id) as bookings_count
      FROM children ch
      LEFT JOIN bookings b ON ch.id = b.child_id
      WHERE ch.customer_id = $1
      GROUP BY ch.id
      ORDER BY ch.created_at DESC
    `;

    const { rows } = await client.query(query, [customerId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /children/:id - Get child details
childrenRouter.get('/:id', async (req, res) => {
  try {
    const childId = req.params.id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(childId)) {
      return res.status(400).json({ error: 'Invalid child ID' });
    }

    const client = getDbClient();

    const query = `
      SELECT ch.*,
             c.first_name as customer_name,
             c.contact_email,
             c.contact_phone,
             s.name as studio_name,
             s.slug as studio_slug,
             COUNT(b.id) as total_bookings
      FROM children ch
      JOIN customers c ON ch.customer_id = c.id
      JOIN studios s ON c.studio_id = s.id
      LEFT JOIN bookings b ON ch.id = b.child_id
      WHERE ch.id = $1
      GROUP BY ch.id, c.id, s.id
    `;

    const { rows } = await client.query(query, [childId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Child not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /children/:id - Update child
childrenRouter.patch('/:id', async (req, res) => {
  try {
    const childId = req.params.id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(childId)) {
      return res.status(400).json({ error: 'Invalid child ID' });
    }

    const updates = updateChildSchema.parse(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const client = getDbClient();

    // Verify child exists
    const childCheck = await client.query('SELECT id FROM children WHERE id = $1', [childId]);
    if (childCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Build dynamic update query
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updates.firstName) {
      setClause.push(`first_name = $${paramIndex++}`);
      values.push(updates.firstName);
    }
    if (updates.avatarKey) {
      setClause.push(`avatar_key = $${paramIndex++}`);
      values.push(updates.avatarKey);
    }

    values.push(childId);

    const query = `
      UPDATE children 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const { rows } = await client.query(query, values);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error updating child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /children/:id - Delete child (and cascade to bookings)
childrenRouter.delete('/:id', async (req, res) => {
  try {
    const childId = req.params.id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(childId)) {
      return res.status(400).json({ error: 'Invalid child ID' });
    }

    const client = getDbClient();

    // Check if child exists and get related data count
    const childCheck = await client.query(
      `
      SELECT ch.id, ch.first_name,
             COUNT(b.id) as bookings_count
      FROM children ch
      LEFT JOIN bookings b ON ch.id = b.child_id
      WHERE ch.id = $1
      GROUP BY ch.id, ch.first_name
    `,
      [childId]
    );

    if (childCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found' });
    }

    const child = childCheck.rows[0];

    // Delete child (cascades to bookings due to FK constraints)
    await client.query('DELETE FROM children WHERE id = $1', [childId]);

    res.json({
      message: 'Child deleted successfully',
      deleted: {
        child_id: childId,
        child_name: child.first_name,
        bookings_deleted: parseInt(child.bookings_count),
      },
    });
  } catch (error) {
    console.error('Error deleting child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default customerChildrenRouter;
