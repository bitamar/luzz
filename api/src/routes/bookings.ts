import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';

const router = Router();

// Validation schema for payment update
const updatePaymentSchema = z.object({
  paidMethod: z.enum(['cash', 'bit', 'paybox', 'transfer']),
  paidAt: z.string().datetime().optional(), // ISO 8601 datetime string
});

// PATCH /bookings/:id/payment - Mark booking as paid
router.patch('/:id/payment', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    if (isNaN(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const { paidMethod, paidAt } = updatePaymentSchema.parse(req.body);

    // Verify booking exists
    const bookingCheck = await db.query(
      'SELECT id, paid FROM bookings WHERE id = $1',
      [bookingId]
    );
    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];
    if (booking.paid) {
      return res
        .status(400)
        .json({ error: 'Booking is already marked as paid' });
    }

    // Update payment status
    const paymentDate = paidAt ? new Date(paidAt) : new Date();

    const updateQuery = `
      UPDATE bookings 
      SET paid = true, paid_at = $1, paid_method = $2
      WHERE id = $3
      RETURNING *
    `;

    const { rows } = await db.query(updateQuery, [
      paymentDate,
      paidMethod,
      bookingId,
    ]);

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
    const bookingId = parseInt(req.params.id);
    if (isNaN(bookingId)) {
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

    const { rows } = await db.query(query, [bookingId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
