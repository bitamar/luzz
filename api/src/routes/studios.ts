import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db';
import { requireUser } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types';

const router = Router();

// Validation schema for studio creation
const createStudioSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  name: z.string().min(1).max(100),
  timezone: z.string().min(1), // e.g., "Asia/Jerusalem"
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO-4217 code'),
});

// POST /studios - Create a new studio (requires user)
router.post('/', requireUser(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug, name, timezone, currency } = createStudioSchema.parse(req.body);

    // Get the appropriate database client (transaction in tests, regular pool otherwise)
    const client = getDbClient();

    // Check if slug already exists
    const existingStudio = await client.query('SELECT id FROM studios WHERE slug = $1', [slug]);
    if (existingStudio.rows.length > 0) {
      return res.status(409).json({ error: 'Studio with this slug already exists' });
    }

    const query = `
      INSERT INTO studios (slug, name, timezone, currency)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const { rows } = await client.query(query, [slug, name, timezone, currency]);
    // Auto-assign ownership to the creator (best-effort; ignore on duplicate)
    const userId = req.user?.userId;
    if (userId) {
      await client.query(
        'insert into studio_owners (studio_id, user_id, role) values ($1,$2,$3) on conflict do nothing',
        [rows[0].id, userId, 'owner'],
      );
    }

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error creating studio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
