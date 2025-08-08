import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDbClient } from '../db';

const router = Router();

// Validation schema for invite creation
const createInviteSchema = z.object({
  studioId: z.string().uuid(),
  customer: z
    .object({
      firstName: z.string().min(1).max(100),
      email: z.string().email().optional(),
      phone: z.string().min(1).optional(),
    })
    .refine(data => data.email || data.phone, {
      message: 'Either email or phone must be provided',
    }),
});

// Generate a random short hash for invite URLs
function generateShortHash(): string {
  return crypto.randomBytes(8).toString('hex');
}

// POST /invites - Create a new invite
router.post('/', async (req, res) => {
  try {
    const { studioId, customer } = createInviteSchema.parse(req.body);

    const client = getDbClient();

    // Verify studio exists
    const studioCheck = await client.query(
      'SELECT slug FROM studios WHERE id = $1',
      [studioId]
    );
    if (studioCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    const studioSlug = studioCheck.rows[0].slug;

    // Check if customer already exists for this studio
    let customerId: number;
    const existingCustomer = await client.query(
      'SELECT id FROM customers WHERE studio_id = $1 AND (contact_email = $2 OR contact_phone = $3)',
      [studioId, customer.email || null, customer.phone || null]
    );

    if (existingCustomer.rows.length > 0) {
      customerId = existingCustomer.rows[0].id;
    } else {
      // Create new customer
      const customerQuery = `
        INSERT INTO customers (studio_id, first_name, contact_email, contact_phone, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
      `;
      const customerResult = await client.query(customerQuery, [
        studioId,
        customer.firstName,
        customer.email || null,
        customer.phone || null,
      ]);
      customerId = customerResult.rows[0].id;
    }

    // Generate unique short hash
    let shortHash: string;
    let hashExists = true;
    do {
      shortHash = generateShortHash();
      const hashCheck = await client.query(
        'SELECT id FROM invites WHERE short_hash = $1',
        [shortHash]
      );
      hashExists = hashCheck.rows.length > 0;
    } while (hashExists);

    // Create invite (expires in 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const inviteQuery = `
      INSERT INTO invites (studio_id, customer_id, short_hash, created_at, expires_at)
      VALUES ($1, $2, $3, NOW(), $4)
      RETURNING *
    `;

    const { rows } = await client.query(inviteQuery, [
      studioId,
      customerId,
      shortHash,
      expiresAt,
    ]);
    const invite = rows[0];

    // Return invite with URL
    res.status(201).json({
      ...invite,
      inviteUrl: `/luz/${studioSlug}/${shortHash}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error creating invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
