import { Router } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db';
import type { CreateBookingRequest } from '../types';

const router = Router();

// Validation schema for payment update
const updatePaymentSchema = z.object({
  paidMethod: z.enum(['cash', 'bit', 'paybox', 'transfer']),
  paidAt: z.string().datetime().optional(), // ISO 8601 datetime string
});

// Validation schema for booking creation
const createBookingSchema = z
  .object({
    slotId: z.string().uuid(),
    customerId: z.string().uuid().optional(),
    childId: z.string().uuid().optional(),
    childData: z
      .object({
        firstName: z.string().min(1).max(100),
        avatarKey: z.string().min(1),
      })
      .optional(),
  })
  .refine(data => data.customerId || data.childId || data.childData, {
    message: 'Either customerId, childId, or childData must be provided',
  });

// Validation schema for booking status update
const updateBookingStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'NO_SHOW']),
});

// PATCH /bookings/:id/payment - Mark booking as paid
router.patch('/:id/payment', async (req, res) => {
  try {
    const bookingId = req.params.id;
    // Basic UUID format validation
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const { paidMethod, paidAt } = updatePaymentSchema.parse(req.body);

    const client = getDbClient();

    // Verify booking exists
    const bookingCheck = await client.query('SELECT id, paid FROM bookings WHERE id = $1', [bookingId]);
    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];
    if (booking.paid) {
      return res.status(400).json({ error: 'Booking is already marked as paid' });
    }

    // Update payment status
    const paymentDate = paidAt ? new Date(paidAt) : new Date();

    const updateQuery = `
      UPDATE bookings 
      SET paid = true, paid_at = $1, paid_method = $2
      WHERE id = $3
      RETURNING *
    `;

    const { rows } = await client.query(updateQuery, [paymentDate, paidMethod, bookingId]);

    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /bookings/:id - Get booking details (for debugging/admin)
router.get('/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    // Basic UUID format validation
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const query = `
      SELECT 
        b.*,
        s.title as slot_title,
        s.starts_at,
        s.duration_min,
        s.price,
        c.first_name as customer_name,
        c.contact_email,
        c.contact_phone,
        ch.first_name as child_name
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN children ch ON b.child_id = ch.id
      WHERE b.id = $1
    `;

    const client = getDbClient();
    const { rows } = await client.query(query, [bookingId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /bookings - Create a new booking (admin/direct booking)
router.post('/', async (req, res) => {
  try {
    const { slotId, customerId, childId, childData }: CreateBookingRequest = createBookingSchema.parse(req.body);

    const client = getDbClient();

    // Verify slot exists and is active
    const slotCheck = await client.query('SELECT * FROM slots WHERE id = $1 AND active = true', [slotId]);
    if (slotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found or not active' });
    }

    const slot = slotCheck.rows[0];
    const finalCustomerId = customerId;
    let finalChildId = childId;

    // Handle child creation if needed
    if (!childId && childData) {
      if (!customerId) {
        return res.status(400).json({
          error: 'customerId is required when creating a new child',
        });
      }

      // Verify customer exists and belongs to the same studio
      const customerCheck = await client.query('SELECT id FROM customers WHERE id = $1 AND studio_id = $2', [
        customerId,
        slot.studio_id,
      ]);
      if (customerCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Customer not found or does not belong to this studio',
        });
      }

      const childQuery = `
        INSERT INTO children (customer_id, first_name, avatar_key)
        VALUES ($1, $2, $3)
        RETURNING id
      `;

      const childResult = await client.query(childQuery, [customerId, childData.firstName, childData.avatarKey]);
      finalChildId = childResult.rows[0].id;
    }

    // Validate booking type matches slot requirements
    if (slot.for_children && !finalChildId) {
      return res.status(400).json({
        error: 'This slot requires a child to be specified',
      });
    }

    if (!slot.for_children && finalChildId) {
      return res.status(400).json({
        error: 'This slot is not for children',
      });
    }

    // Verify customer/child belongs to the same studio as the slot
    if (finalCustomerId) {
      const customerCheck = await client.query('SELECT id FROM customers WHERE id = $1 AND studio_id = $2', [
        finalCustomerId,
        slot.studio_id,
      ]);
      if (customerCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Customer does not belong to this studio',
        });
      }
    }

    if (finalChildId) {
      const childCheck = await client.query(
        `
        SELECT ch.id FROM children ch
        JOIN customers c ON ch.customer_id = c.id
        WHERE ch.id = $1 AND c.studio_id = $2
      `,
        [finalChildId, slot.studio_id]
      );

      if (childCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Child does not belong to this studio',
        });
      }
    }

    // Enforce capacity: count existing bookings for the slot
    const capacityResult = await client.query(
      `SELECT COUNT(*)::int as count
       FROM bookings 
       WHERE slot_id = $1`,
      [slotId]
    );
    const bookedCount: number = capacityResult.rows[0].count;

    const capacityInfo = await client.query(
      `SELECT max_participants
       FROM slots
       WHERE id = $1`,
      [slotId]
    );
    const maxParticipants: number = capacityInfo.rows[0].max_participants;

    if (bookedCount >= maxParticipants) {
      return res.status(409).json({ error: 'Slot capacity reached. Cannot create booking.' });
    }

    // Create booking
    const bookingQuery = `
      INSERT INTO bookings (slot_id, customer_id, child_id, status, paid)
      VALUES ($1, $2, $3, 'CONFIRMED', false)
      RETURNING *
    `;

    const { rows } = await client.query(bookingQuery, [
      slotId,
      slot.for_children ? null : finalCustomerId,
      slot.for_children ? finalChildId : null,
    ]);

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /bookings - List bookings with filters
router.get('/', async (req, res) => {
  try {
    const { studioId, customerId, childId, slotId, status, paid, limit = '50', offset = '0' } = req.query;

    const client = getDbClient();
    const filters = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic filter query
    if (studioId) {
      filters.push(`s.studio_id = $${paramIndex++}`);
      values.push(studioId);
    }
    if (customerId) {
      filters.push(`b.customer_id = $${paramIndex++}`);
      values.push(customerId);
    }
    if (childId) {
      filters.push(`b.child_id = $${paramIndex++}`);
      values.push(childId);
    }
    if (slotId) {
      filters.push(`b.slot_id = $${paramIndex++}`);
      values.push(slotId);
    }
    if (status) {
      filters.push(`b.status = $${paramIndex++}`);
      values.push(status);
    }
    if (paid !== undefined) {
      filters.push(`b.paid = $${paramIndex++}`);
      values.push(paid === 'true');
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const query = `
      SELECT 
        b.*,
        s.title as slot_title,
        s.starts_at,
        s.duration_min,
        s.price,
        s.for_children,
        c.first_name as customer_name,
        c.contact_email,
        c.contact_phone,
        ch.first_name as child_name,
        st.name as studio_name,
        st.slug as studio_slug
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      JOIN studios st ON s.studio_id = st.id
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN children ch ON b.child_id = ch.id
      ${whereClause}
      ORDER BY s.starts_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(parseInt(limit as string), parseInt(offset as string));

    const { rows } = await client.query(query, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /bookings/:id/status - Update booking status
router.patch('/:id/status', async (req, res) => {
  try {
    const bookingId = req.params.id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const { status } = updateBookingStatusSchema.parse(req.body);

    const client = getDbClient();

    // Verify booking exists
    const bookingCheck = await client.query('SELECT id, status FROM bookings WHERE id = $1', [bookingId]);
    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const updateQuery = `
      UPDATE bookings 
      SET status = $1
      WHERE id = $2
      RETURNING *
    `;

    const { rows } = await client.query(updateQuery, [status, bookingId]);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /bookings/:id - Cancel/delete booking
router.delete('/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const client = getDbClient();

    // Check if booking exists and get details
    const bookingCheck = await client.query(
      `
      SELECT b.id, b.status, s.title as slot_title, s.starts_at
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      WHERE b.id = $1
    `,
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Delete booking
    await client.query('DELETE FROM bookings WHERE id = $1', [bookingId]);

    res.json({
      message: 'Booking deleted successfully',
      deleted: {
        booking_id: bookingId,
        slot_title: booking.slot_title,
        starts_at: booking.starts_at,
        previous_status: booking.status,
      },
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
