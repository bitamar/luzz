import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import publicRouter from '../routes/public';
import { getDbClient } from '../db';
import { createTestStudio, createTestSlot, createTestCustomer } from './test-helpers';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/public', publicRouter);
  return app;
}

describe('Public routes', () => {

  describe('GET /public/:slug/slots', () => {
    let slug: string;
    beforeEach(async () => {
      const studio = await createTestStudio();
      slug = studio.slug;
      // create a couple of slots in the current week
      const now = new Date();
      const monday = new Date(now);
      const day = monday.getDay();
      monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
      const iso = (d: Date) => new Date(d).toISOString();
      await createTestSlot(studio.id, {
        title: 'Week Slot',
        startsAt: iso(monday),
        durationMin: 60,
        price: 10,
        minParticipants: 0,
        maxParticipants: 10,
        forChildren: false,
      });
    });

    it('validates query and returns grouped slots', async () => {
      const app = makeApp();
      const now = new Date();
      const oneJan = new Date(now.getFullYear(), 0, 1);
      const week = Math.ceil(
        ((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) /
          7
      )
        .toString()
        .padStart(2, '0');
      const res = await request(app)
        .get(`/public/${slug}/slots`)
        .query({ week: `${now.getFullYear()}-${week}` })
        .expect(200);
      expect(res.body).toHaveProperty('studio');
      expect(res.body).toHaveProperty('slotsByDay');
    });

    it('400 on missing or bad week', async () => {
      const app = makeApp();
      await request(app).get(`/public/${slug}/slots`).expect(400);
      await request(app)
        .get(`/public/${slug}/slots`)
        .query({ week: 'bad' })
        .expect(400);
      await request(app)
        .get(`/public/${slug}/slots`)
        .query({ week: '2024-54' })
        .expect(400);
    });

    it('404 for unknown studio', async () => {
      const app = makeApp();
      await request(app)
        .get(`/public/does-not-exist/slots`)
        .query({ week: '2024-01' })
        .expect(404);
    });
  });

  describe('POST /public/invites/:hash/bookings', () => {
    it('creates booking for adult slot and validates slotId', async () => {
      const app = makeApp();
      const studio = await createTestStudio();
      const customer = await createTestCustomer(
        studio.id,
        { first_name: 'Cust', contact_email: 'c@e.x' } as any
      );
      const slot = await createTestSlot(studio.id, {
        title: 'Adult',
        startsAt: new Date().toISOString(),
        durationMin: 60,
        price: 10,
        minParticipants: 0,
        maxParticipants: 5,
        forChildren: false,
      });
      const client = getDbClient();
      const invite = await client.query(
        `insert into invites (studio_id, customer_id, short_hash, created_at, expires_at)
         values ($1, $2, 'short1234', now(), now() + interval '1 day')
         returning *`,
        [studio.id, customer.id]
      );

      await request(app)
        .post(`/public/invites/${invite.rows[0].short_hash}/bookings`)
        .send({ slotId: slot.id })
        .expect(201);

      await request(app)
        .post(`/public/invites/${invite.rows[0].short_hash}/bookings`)
        .send({ slotId: 'not-a-uuid' })
        .expect(400);
    });

    it('enforces child requirement for children slot and allows with child data', async () => {
      const app = makeApp();
      const studio = await createTestStudio();
      const customer = await createTestCustomer(
        studio.id,
        { first_name: 'Par', contact_email: 'p@q.z' } as any
      );
      const slot = await createTestSlot(studio.id, {
        title: 'Kids',
        startsAt: new Date().toISOString(),
        durationMin: 45,
        price: 12,
        minParticipants: 1,
        maxParticipants: 5,
        forChildren: true,
      });
      const client = getDbClient();
      const inv = await client.query(
        `insert into invites (studio_id, customer_id, short_hash, created_at, expires_at)
         values ($1, $2, 'shortch', now(), now() + interval '1 day') returning *`,
        [studio.id, customer.id]
      );

      // Missing child -> 400
      await request(app)
        .post(`/public/invites/${inv.rows[0].short_hash}/bookings`)
        .send({ slotId: slot.id })
        .expect(400);

      // Provide child data -> 201
      await request(app)
        .post(`/public/invites/${inv.rows[0].short_hash}/bookings`)
        .send({ slotId: slot.id, child: { firstName: 'Kiddo', avatarKey: 'av1' } })
        .expect(201);
    });

    it('returns 404 for unknown/expired invite and when slot belongs to different studio', async () => {
      const app = makeApp();
      const studioA = await createTestStudio();
      const studioB = await createTestStudio();
      const customerA = await createTestCustomer(
        studioA.id,
        { first_name: 'AA', contact_email: 'aa@aa.aa' } as any
      );
      const slotB = await createTestSlot(studioB.id, {
        title: 'B slot',
        startsAt: new Date().toISOString(),
        durationMin: 60,
        price: 10,
        minParticipants: 0,
        maxParticipants: 5,
        forChildren: false,
      });
      const client = getDbClient();
      const invite = await client.query(
        `insert into invites (studio_id, customer_id, short_hash, created_at, expires_at)
         values ($1, $2, 'exp1', now(), now() - interval '1 day') returning *`,
        [studioA.id, customerA.id]
      );

      await request(app)
        .post(`/public/invites/${invite.rows[0].short_hash}/bookings`)
        .send({ slotId: slotB.id })
        .expect(404);

      await request(app)
        .post(`/public/invites/doesnotexist/bookings`)
        .send({ slotId: slotB.id })
        .expect(404);
    });
  });
});


