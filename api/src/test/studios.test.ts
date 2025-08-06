import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db, closeDatabase } from '../db';
import studiosRouter from '../routes/studios';
import { cleanupDatabase } from './test-helpers';

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
  });

  afterAll(async () => {
    // Clean up database connection
    await closeDatabase();
  });

  beforeEach(async () => {
    // Transaction isolation is handled by global setup-each.ts
  });

  describe('POST /studios', () => {
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
        .send(incompleteData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });
});
