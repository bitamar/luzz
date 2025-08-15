import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { closeDatabase } from '../db';
import studiosRouter from '../routes/studios';
import { signAccessToken } from '../auth/jwt';
import { db } from '../db';

// Create test app
const app = express();
app.use(express.json());
app.use('/studios', studiosRouter);

describe('Studios API', () => {
  beforeAll(async () => {
    // Verify we're using test database
    if (!process.env.DATABASE_URL?.includes('test')) {
      console.warn('Warning: Not using test database');
    } else {
      console.log('✅ Using test database');
    }
    // set JWT secret for tests
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-123';
  });

  afterAll(async () => {
    // Clean up database connection
    await closeDatabase();
  });

  beforeEach(async () => {
    // Transaction isolation is handled by global setup-each.ts
  });

  describe('POST /studios', () => {
    async function auth() {
      // Ensure a real user row exists and sign its UUID
      await db.query(
        `insert into users (google_sub, email) values ($1,$2)
         on conflict (google_sub) do update set email=excluded.email`,
        ['sub-u-test', 'u@test'],
      );
      const { rows } = await db.query('select id from users where google_sub=$1', ['sub-u-test']);
      const token = await signAccessToken({ userId: rows[0].id, isAdmin: false }, '5m');
      return { Authorization: `Bearer ${token}` };
    }
    it('should create a new studio with valid data', async () => {
      const uniqueSlug = `test-studio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const studioData = {
        slug: uniqueSlug,
        name: 'Test Studio',
        timezone: 'Asia/Jerusalem',
        currency: 'ILS',
      };

      const response = await request(app)
        .post('/studios')
        .set(await auth())
        .send(studioData)
        .expect(201);

      expect(response.body).toMatchObject({
        slug: uniqueSlug,
        name: 'Test Studio',
        timezone: 'Asia/Jerusalem',
        currency: 'ILS',
      });
      expect(response.body.id).toBeDefined();
    });

    it('should return 400 for invalid slug format', async () => {
      const studioData = {
        slug: 'Test Studio!', // Invalid - contains uppercase and special characters
        name: 'Test Studio',
        timezone: 'Asia/Jerusalem',
        currency: 'ILS',
      };

      const response = await request(app)
        .post('/studios')
        .set(await auth())
        .send(studioData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should return 400 for invalid currency code', async () => {
      const uniqueSlug = `test-studio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const studioData = {
        slug: uniqueSlug,
        name: 'Test Studio',
        timezone: 'Asia/Jerusalem',
        currency: 'INVALID', // Invalid - not 3 letters
      };

      const response = await request(app)
        .post('/studios')
        .set(await auth())
        .send(studioData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 409 for duplicate slug', async () => {
      // Use a unique slug with timestamp to avoid conflicts with cleanup
      const baseSlug = `duplicate-studio-${Date.now()}`;
      const studioData = {
        slug: baseSlug,
        name: 'First Studio',
        timezone: 'Asia/Jerusalem',
        currency: 'ILS',
      };

      // Create first studio
      const firstResponse = await request(app)
        .post('/studios')
        .set(await auth())
        .send(studioData)
        .expect(201);

      // Verify first studio was created
      expect(firstResponse.body.slug).toBe(baseSlug);

      // Try to create another with same slug
      const duplicateData = {
        ...studioData,
        name: 'Second Studio',
      };

      const response = await request(app)
        .post('/studios')
        .set(await auth())
        .send(duplicateData)
        .expect(409);

      expect(response.body.error).toBe('Studio with this slug already exists');
    });

    it('should return 400 for missing required fields', async () => {
      const uniqueSlug = `test-studio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const incompleteData = {
        slug: uniqueSlug,
        // Missing name, timezone, currency
      };

      const response = await request(app)
        .post('/studios')
        .set(await auth())
        .send(incompleteData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });
});
