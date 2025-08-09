import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db';
import { requireUser } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';

const router = Router();

// Validation schema for slot creation
const createSlotSchema = z.object({
  title: z.string().min(1).max(200),
  startsAt: z.string().datetime(), // ISO 8601 datetime string
  durationMin: z.number().int().min(1).max(1440), // 1 minute to 24 hours
  recurrenceRule: z.string().optional(), // RFC 5545 RRULE format
  price: z.number().min(0),
  minParticipants: z.number().int().min(0),
  maxParticipants: z.number().int().min(1),
  forChildren: z.boolean(),
});

// POST /studios/:studioId/slots - Create a new slot for a studio
router.post(
  '/:studioId/slots',
  requireUser(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const studioId = req.params.studioId;
      // Basic UUID format validation (36 chars with hyphens)
      if (
        !studioId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          studioId
        )
      ) {
        return res.status(400).json({ error: 'Invalid studio ID' });
      }

      const {
        title,
        startsAt,
        durationMin,
        recurrenceRule,
        price,
        minParticipants,
        maxParticipants,
        forChildren,
      } = createSlotSchema.parse(req.body);

      // Get the appropriate database client (transaction in tests, regular pool otherwise)
      const client = getDbClient();

      // Verify studio exists
      const studioCheck = await client.query(
        'SELECT id FROM studios WHERE id = $1',
        [studioId]
      );
      if (studioCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Studio not found' });
      }

      // Validate min/max participants
      if (minParticipants > maxParticipants) {
        return res.status(400).json({
          error: 'Minimum participants cannot exceed maximum participants',
        });
      }

      // Ownership check after we know studio exists and input is valid
      const ownerCheck = await client.query(
        'SELECT 1 FROM studio_owners WHERE studio_id = $1 AND user_id = $2 LIMIT 1',
        [studioId, req.user?.userId]
      );
      if (ownerCheck.rowCount === 0) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const query = `
      INSERT INTO slots (
        studio_id, title, starts_at, duration_min, recurrence_rule, 
        price, min_participants, max_participants, for_children, active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
    `;

      const { rows } = await client.query(query, [
        studioId,
        title,
        startsAt,
        durationMin,
        recurrenceRule || null,
        price,
        minParticipants,
        maxParticipants,
        forChildren,
      ]);

      res.status(201).json(rows[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues,
        });
      }

      console.error('Error creating slot:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
