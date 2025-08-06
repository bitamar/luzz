import { db, getDbClient } from '../db';
import { testTransaction } from './transaction-manager';

// Legacy cleanup functions (kept for reference if needed)
export async function cleanupDatabase() {
  // Clean up in reverse dependency order using TRUNCATE for faster cleanup
  await db.query(
    'TRUNCATE TABLE bookings, children, invites, customers, slots, studios CASCADE'
  );
}

// Transaction-based cleanup (preferred for tests)
export async function setupTestTransaction() {
  await testTransaction.beginTransaction();
}

export async function cleanupTestTransaction() {
  await testTransaction.rollback();
}

// Test data factories
export const testData = {
  studio: {
    valid: {
      slug: 'test-studio', // Base slug, will be made unique in createTestStudio
      name: 'Test Studio',
      timezone: 'America/New_York',
      currency: 'USD',
    },
    withIls: {
      slug: 'ils-studio',
      name: 'Israeli Studio',
      timezone: 'Asia/Jerusalem',
      currency: 'ILS',
    },
  },

  slot: {
    adult: {
      title: 'Adult Yoga Class',
      startsAt: '2024-02-15T10:00:00Z',
      durationMin: 60,
      price: 25.0,
      minParticipants: 1,
      maxParticipants: 20,
      forChildren: false,
    },
    children: {
      title: 'Kids Dance Class',
      startsAt: '2024-02-15T15:00:00Z',
      durationMin: 45,
      price: 15.0,
      minParticipants: 3,
      maxParticipants: 12,
      forChildren: true,
    },
    recurring: {
      title: 'Weekly Pilates',
      startsAt: '2024-02-15T18:00:00Z',
      durationMin: 50,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TH',
      price: 30.0,
      minParticipants: 1,
      maxParticipants: 15,
      forChildren: false,
    },
  },

  customer: {
    withEmail: {
      firstName: 'John',
      email: 'john@example.com',
    },
    withPhone: {
      firstName: 'Jane',
      phone: '+1-555-0123',
    },
    withBoth: {
      firstName: 'Bob',
      email: 'bob@example.com',
      phone: '+1-555-0456',
    },
  },

  child: {
    basic: {
      firstName: 'Emma',
      avatarKey: 'child-avatar-1',
    },
    simple: {
      firstName: 'Liam',
    },
  },
};

// Helper to create a studio and return its ID
export async function createTestStudio(
  studioData: {
    slug?: string;
    name?: string;
    timezone?: string;
    currency?: string;
  } = testData.studio.valid
) {
  // Generate unique slug for each studio creation
  const uniqueStudioData = {
    ...studioData,
    slug: `${studioData.slug || 'test-studio'}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };

  const query = `
    INSERT INTO studios (slug, name, timezone, currency)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

  const client = getDbClient();
  const { rows } = await client.query(query, [
    uniqueStudioData.slug,
    uniqueStudioData.name,
    uniqueStudioData.timezone,
    uniqueStudioData.currency,
  ]);

  return rows[0];
}

// Helper to create a slot and return its ID
export async function createTestSlot(
  studioId: string,
  slotData: any = testData.slot.adult
) {
  const query = `
    INSERT INTO slots (
      studio_id, title, starts_at, duration_min, recurrence_rule,
      price, min_participants, max_participants, for_children, active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
    RETURNING *
  `;

  const client = getDbClient();
  const { rows } = await client.query(query, [
    studioId,
    slotData.title,
    slotData.startsAt,
    slotData.durationMin,
    slotData.recurrenceRule || null,
    slotData.price,
    slotData.minParticipants,
    slotData.maxParticipants,
    slotData.forChildren,
  ]);
  return rows[0];
}

// Helper to create a customer and return its ID
export async function createTestCustomer(
  studioId: string,
  customerData: any = testData.customer.withEmail
) {
  const query = `
    INSERT INTO customers (studio_id, first_name, contact_email, contact_phone, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING *
  `;

  const client = getDbClient();
  const { rows } = await client.query(query, [
    studioId,
    customerData.firstName,
    customerData.email || null,
    customerData.phone || null,
  ]);
  return rows[0];
}
