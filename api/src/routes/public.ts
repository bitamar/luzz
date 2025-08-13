import { Router } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db';
import type { Slot } from '../types';

const router = Router();

// Validation schema for booking creation (public invite)
// Note: child data is optional here; route logic enforces it based on slot.for_children
const createBookingSchema = z.object({
  childId: z.string().uuid().optional(),
  child: z
    .object({
      firstName: z.string().min(1).max(100),
      avatarKey: z.string().optional(),
    })
    .optional(),
});

// Helper function to parse week parameter (YYYY-WW format)
function parseWeekParam(week: string): { startDate: Date; endDate: Date } | null {
  const match = week.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);

  if (weekNum < 1 || weekNum > 53) return null;

  // Calculate the first day of the week (Monday)
  const startDate = new Date(year, 0, 1 + (weekNum - 1) * 7);
  const day = startDate.getDay();
  startDate.setDate(startDate.getDate() - (day === 0 ? 6 : day - 1));

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6); // End of week (Sunday)

  return { startDate, endDate };
}

// GET /public/:slug/slots?week=YYYY-WW - Get slots for a studio by week
router.get('/:slug/slots', async (req, res) => {
  try {
    const { slug } = req.params;
    const { week } = req.query;

    if (!week || typeof week !== 'string') {
      return res.status(400).json({ error: 'Week parameter is required (format: YYYY-WW)' });
    }

    const weekRange = parseWeekParam(week);
    if (!weekRange) {
      return res.status(400).json({ error: 'Invalid week format. Use YYYY-WW' });
    }

    // Verify studio exists
    const client = getDbClient();
    const studioQuery = await client.query(
      'SELECT id, name, timezone, currency FROM studios WHERE slug = $1',
      [slug],
    );
    if (studioQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    const studio = studioQuery.rows[0];

    // Get slots for the week that are active
    const slotsQuery = `
      SELECT * FROM slots 
      WHERE studio_id = $1 
        AND active = true 
        AND starts_at >= $2 
        AND starts_at <= $3
      ORDER BY starts_at ASC
    `;

    const { rows: slots } = await client.query(slotsQuery, [
      studio.id,
      weekRange.startDate.toISOString(),
      weekRange.endDate.toISOString(),
    ]);

    // Group slots by day
    const slotsByDay: { [key: string]: Slot[] } = {};
    slots.forEach((slot: Slot) => {
      const date = new Date(slot.starts_at).toISOString().split('T')[0];
      if (!slotsByDay[date]) {
        slotsByDay[date] = [];
      }
      slotsByDay[date].push(slot);
    });

    res.json({
      studio,
      week,
      slotsByDay,
    });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /public/invites/:hash/bookings - Create a booking using invite hash
router.post('/invites/:hash/bookings', async (req, res) => {
  try {
    const { hash } = req.params;

    // Verify invite exists and is not expired
    const inviteQuery = `
      SELECT i.*, c.id as customer_id, s.id as studio_id
      FROM invites i
      JOIN customers c ON i.customer_id = c.id
      JOIN studios s ON i.studio_id = s.id
      WHERE i.short_hash = $1 AND i.expires_at > NOW()
    `;

    const client = getDbClient();
    const inviteResult = await client.query(inviteQuery, [hash]);
    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    const invite = inviteResult.rows[0];
    const { childId, child } = createBookingSchema.parse(req.body);

    // Get slot_id from request body (should be added to schema)
    const slotId = req.body.slotId;
    if (
      !slotId ||
      typeof slotId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slotId)
    ) {
      return res.status(400).json({ error: 'slotId must be a valid UUID' });
    }

    // Verify slot exists and belongs to the same studio
    const slotQuery = await client.query(
      'SELECT * FROM slots WHERE id = $1 AND studio_id = $2 AND active = true',
      [slotId, invite.studio_id],
    );

    if (slotQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found or not available' });
    }

    const slot = slotQuery.rows[0];

    // Handle child creation if needed
    let finalChildId = childId;
    if (!childId && child) {
      const childQuery = `
        INSERT INTO children (customer_id, first_name, avatar_key, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id
      `;

      const childResult = await client.query(childQuery, [
        invite.customer_id,
        child.firstName,
        child.avatarKey || null,
      ]);
      finalChildId = childResult.rows[0].id;
    }

    // Check if slot is for children
    if (slot.for_children && !finalChildId) {
      return res.status(400).json({ error: 'This slot requires a child to be specified' });
    }

    if (!slot.for_children && finalChildId) {
      return res.status(400).json({ error: 'This slot is not for children' });
    }

    // Create booking
    const bookingQuery = `
      INSERT INTO bookings (slot_id, customer_id, child_id, status, created_at, paid, paid_at, paid_method)
      VALUES ($1, $2, $3, 'CONFIRMED', NOW(), false, NULL, NULL)
      RETURNING *
    `;

    const { rows } = await client.query(bookingQuery, [
      slotId,
      slot.for_children ? null : invite.customer_id,
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

export default router;
