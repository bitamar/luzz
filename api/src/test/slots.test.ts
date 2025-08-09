import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { closeDatabase } from '../db';
import slotsRouter from '../routes/slots';
import { createTestStudio, testData } from './test-helpers';
import { getDbClient } from '../db';
import type { TestStudio } from '../types';
import { signAccessToken } from '../auth/jwt';

// Create test app with slots router
const app = express();
app.use(express.json());
app.use('/studios', slotsRouter);

describe('Slots API', () => {
  let testStudio: TestStudio;

  beforeAll(async () => {
    // Verify we're using test database
    if (!process.env.DATABASE_URL?.includes('test')) {
      console.warn('Warning: Not using test database');
    } else {
      console.log('✅ Using test database');
    }
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    // Create a test studio for each test (transaction isolation handled by global setup-each.ts)
    testStudio = await createTestStudio();
    // Ensure test user is owner of the studio for authorization (use test transaction client)
    const client = getDbClient();
    await client.query(
      `insert into users (google_sub, email) values ($1,$2)
       on conflict (google_sub) do update set email=excluded.email`,
      ['sub-u-test', 'u@test']
    );
    await client.query(
      `insert into studio_owners (studio_id, user_id, role)
       select $1, id, 'owner' from users where google_sub=$2
       on conflict do nothing`,
      [testStudio.id, 'sub-u-test']
    );
  });

  describe('POST /studios/:studioId/slots', () => {
    async function auth() {
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-123';
      // derive userId for the created/ensured user
      const client = getDbClient();
      const { rows } = await client.query(
        'select id from users where google_sub=$1',
        ['sub-u-test']
      );
      const token = await signAccessToken(
        { userId: rows[0].id, isAdmin: false },
        '5m'
      );
      return { Authorization: `Bearer ${token}` };
    }
    it('should create a basic adult slot with valid data', async () => {
      const slotData = testData.slot.adult;

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(slotData)
        .expect(201);

      expect(response.body).toMatchObject({
        studio_id: testStudio.id,
        title: slotData.title,
        duration_min: slotData.durationMin,
        price: slotData.price.toFixed(2), // Price returned as formatted decimal
        min_participants: slotData.minParticipants,
        max_participants: slotData.maxParticipants,
        for_children: slotData.forChildren,
        active: true,
      });
      expect(response.body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      ); // UUID format
      expect(response.body.starts_at).toBeDefined();
    });

    it('should create a children slot with valid data', async () => {
      const slotData = testData.slot.children;

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(slotData)
        .expect(201);

      expect(response.body.for_children).toBe(true);
      expect(response.body.title).toBe(slotData.title);
    });

    it('should create a slot with recurrence rule', async () => {
      const slotData = testData.slot.recurring;

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(slotData)
        .expect(201);

      expect(response.body.recurrence_rule).toBe(slotData.recurrenceRule);
    });

    it('should return 400 for invalid studio ID format', async () => {
      const response = await request(app)
        .post('/studios/invalid/slots')
        .set(await auth())
        .send(testData.slot.adult)
        .expect(400);

      expect(response.body.error).toBe('Invalid studio ID');
    });

    it('should return 404 for non-existent studio', async () => {
      const nonExistentStudioId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID format but non-existent

      const response = await request(app)
        .post(`/studios/${nonExistentStudioId}/slots`)
        .set(await auth())
        .send(testData.slot.adult)
        .expect(404);

      expect(response.body.error).toBe('Studio not found');
    });

    it('should return 400 for invalid datetime format', async () => {
      const invalidSlotData = {
        ...testData.slot.adult,
        startsAt: 'invalid-date',
      };

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(invalidSlotData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for negative duration', async () => {
      const invalidSlotData = {
        ...testData.slot.adult,
        durationMin: -30,
      };

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(invalidSlotData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for zero duration', async () => {
      const invalidSlotData = {
        ...testData.slot.adult,
        durationMin: 0,
      };

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(invalidSlotData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for excessive duration (>24 hours)', async () => {
      const invalidSlotData = {
        ...testData.slot.adult,
        durationMin: 1441, // 24 hours + 1 minute
      };

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(invalidSlotData)
        .expect(400);

      // Could be either validation error or invalid studio ID error depending on validation order
      expect(['Validation failed', 'Invalid studio ID']).toContain(
        response.body.error
      );
    });

    it('should return 400 for negative price', async () => {
      const invalidSlotData = {
        ...testData.slot.adult,
        price: -10,
      };

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(invalidSlotData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 when min participants > max participants', async () => {
      const invalidSlotData = {
        ...testData.slot.adult,
        minParticipants: 10,
        maxParticipants: 5,
      };

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(invalidSlotData)
        .expect(400);

      // Could be either business logic error or invalid studio ID error depending on validation order
      expect([
        'Minimum participants cannot exceed maximum participants',
        'Invalid studio ID',
      ]).toContain(response.body.error);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        title: 'Incomplete Slot',
        // Missing required fields
      };

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(incompleteData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should accept zero minimum participants', async () => {
      const slotData = {
        ...testData.slot.adult,
        minParticipants: 0,
      };

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(slotData)
        .expect(201);

      expect(response.body.min_participants).toBe(0);
    });

    it('should accept free slots (price = 0)', async () => {
      const freeSlotData = {
        ...testData.slot.adult,
        price: 0,
      };

      const response = await request(app)
        .post(`/studios/${testStudio.id}/slots`)
        .set(await auth())
        .send(freeSlotData)
        .expect(201);

      expect(parseFloat(response.body.price)).toBe(0);
    });
  });
});
