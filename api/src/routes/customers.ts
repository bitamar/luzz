import { Router } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db';
import type { CreateCustomerRequest } from '../types';

// Routers are split by concern to avoid path collisions when mounting
export const studioCustomersRouter = Router(); // mounted under /studios
export const customersRouter = Router(); // mounted under /customers

// Validation schema for customer creation
const createCustomerSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    avatarKey: z.string().optional(),
    contactPhone: z.string().min(1).optional(),
    contactEmail: z.string().email().optional(),
  })
  .refine(data => data.contactPhone || data.contactEmail, {
    message: 'Either contactPhone or contactEmail must be provided',
  });

// Validation schema for customer update
const updateCustomerSchema = createCustomerSchema.partial();

// POST /studios/:studioId/customers - Create a new customer
studioCustomersRouter.post('/:studioId/customers', async (req, res) => {
  try {
    const studioId = req.params.studioId;
    // Basic UUID format validation
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        studioId
      )
    ) {
      return res.status(400).json({ error: 'Invalid studio ID' });
    }

    const {
      firstName,
      avatarKey,
      contactPhone,
      contactEmail,
    }: CreateCustomerRequest = createCustomerSchema.parse(req.body);

    const client = getDbClient();

    // Verify studio exists
    const studioCheck = await client.query(
      'SELECT id FROM studios WHERE id = $1',
      [studioId]
    );
    if (studioCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    // Check if customer already exists with same contact info
    let existingCustomer = null;
    if (contactEmail) {
      const emailCheck = await client.query(
        'SELECT * FROM customers WHERE studio_id = $1 AND contact_email = $2',
        [studioId, contactEmail]
      );
      existingCustomer = emailCheck.rows[0];
    }

    if (!existingCustomer && contactPhone) {
      const phoneCheck = await client.query(
        'SELECT * FROM customers WHERE studio_id = $1 AND contact_phone = $2',
        [studioId, contactPhone]
      );
      existingCustomer = phoneCheck.rows[0];
    }

    if (existingCustomer) {
      return res.status(409).json({
        error: 'Customer with this contact information already exists',
        customer: existingCustomer,
      });
    }

    const query = `
      INSERT INTO customers (studio_id, first_name, avatar_key, contact_phone, contact_email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const { rows } = await client.query(query, [
      studioId,
      firstName,
      avatarKey || null,
      contactPhone || null,
      contactEmail || null,
    ]);

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /studios/:studioId/customers - List customers for a studio
studioCustomersRouter.get('/:studioId/customers', async (req, res) => {
  try {
    const studioId = req.params.studioId;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        studioId
      )
    ) {
      return res.status(400).json({ error: 'Invalid studio ID' });
    }

    const client = getDbClient();

    // Verify studio exists
    const studioCheck = await client.query(
      'SELECT id FROM studios WHERE id = $1',
      [studioId]
    );
    if (studioCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    const query = `
      SELECT c.*, 
             COUNT(DISTINCT ch.id) as children_count,
             COUNT(DISTINCT b.id) as bookings_count
      FROM customers c
      LEFT JOIN children ch ON c.id = ch.customer_id
      LEFT JOIN bookings b ON c.id = b.customer_id
      WHERE c.studio_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;

    const { rows } = await client.query(query, [studioId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /customers/:id - Get customer details
customersRouter.get('/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        customerId
      )
    ) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const client = getDbClient();

    const query = `
      SELECT c.*,
             s.name as studio_name,
             s.slug as studio_slug,
             json_agg(
               DISTINCT jsonb_build_object(
                 'id', ch.id,
                 'first_name', ch.first_name,
                 'avatar_key', ch.avatar_key,
                 'created_at', ch.created_at
               )
             ) FILTER (WHERE ch.id IS NOT NULL) as children,
             COUNT(DISTINCT b.id) as total_bookings
      FROM customers c
      JOIN studios s ON c.studio_id = s.id
      LEFT JOIN children ch ON c.id = ch.customer_id
      LEFT JOIN bookings b ON c.id = b.customer_id
      WHERE c.id = $1
      GROUP BY c.id, s.id
    `;

    const { rows } = await client.query(query, [customerId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /customers/:id - Update customer
customersRouter.patch('/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        customerId
      )
    ) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const updates = updateCustomerSchema.parse(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const client = getDbClient();

    // Verify customer exists
    const customerCheck = await client.query(
      'SELECT id, studio_id FROM customers WHERE id = $1',
      [customerId]
    );
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Build dynamic update query
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updates.firstName) {
      setClause.push(`first_name = $${paramIndex++}`);
      values.push(updates.firstName);
    }
    if (updates.avatarKey !== undefined) {
      setClause.push(`avatar_key = $${paramIndex++}`);
      values.push(updates.avatarKey);
    }
    if (updates.contactPhone !== undefined) {
      setClause.push(`contact_phone = $${paramIndex++}`);
      values.push(updates.contactPhone);
    }
    if (updates.contactEmail !== undefined) {
      setClause.push(`contact_email = $${paramIndex++}`);
      values.push(updates.contactEmail);
    }

    values.push(customerId);

    const query = `
      UPDATE customers 
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

    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /customers/:id - Delete customer (and cascade to children/bookings)
customersRouter.delete('/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        customerId
      )
    ) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const client = getDbClient();

    // Check if customer exists and get related data count
    const customerCheck = await client.query(
      `
      SELECT c.id, c.first_name,
             COUNT(DISTINCT ch.id) as children_count,
             COUNT(DISTINCT b.id) as bookings_count
      FROM customers c
      LEFT JOIN children ch ON c.id = ch.customer_id
      LEFT JOIN bookings b ON c.id = b.customer_id
      WHERE c.id = $1
      GROUP BY c.id, c.first_name
    `,
      [customerId]
    );

    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerCheck.rows[0];

    // Delete customer (cascades to children and bookings due to FK constraints)
    await client.query('DELETE FROM customers WHERE id = $1', [customerId]);

    res.json({
      message: 'Customer deleted successfully',
      deleted: {
        customer_id: customerId,
        customer_name: customer.first_name,
        children_deleted: parseInt(customer.children_count),
        bookings_deleted: parseInt(customer.bookings_count),
      },
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default studioCustomersRouter;
