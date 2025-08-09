import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import bookingsRouter from '../routes/bookings';
import {
  createTestStudio,
  createTestSlot,
  createTestCustomer,
} from './test-helpers';
import { getDbClient } from '../db';

function appFactory() {
  const app = express();
  app.use(express.json());
  app.use('/bookings', bookingsRouter);
  return app;
}

describe('Bookings routes - validations and 404s', () => {
  it('returns Zod 400 on invalid payloads and 404 on studio mismatches', async () => {
    const app = appFactory();
    const studio = await createTestStudio();
    const slot = await createTestSlot(studio.id, {
      title: 'Adult',
      startsAt: new Date().toISOString(),
      durationMin: 60,
      price: 10,
      minParticipants: 0,
      maxParticipants: 5,
      forChildren: false,
    });
    const otherStudio = await createTestStudio();
    const otherCustomer = await createTestCustomer(otherStudio.id, {
      first_name: 'X',
      contact_email: 'x@y.z',
    } as any);

    await request(app).post('/bookings').send({}).expect(400);

    // require customerId when providing childData
    await request(app)
      .post('/bookings')
      .send({
        slotId: slot.id,
        childData: { firstName: 'Kid', avatarKey: 'k' },
      })
      .expect(400);

    // 404 when customer not in slot studio
    await request(app)
      .post('/bookings')
      .send({ slotId: slot.id, customerId: otherCustomer.id })
      .expect(404);
  });

  it('returns 404 when child belongs to different studio; list filters work', async () => {
    const app = appFactory();
    // Studio A with children slot
    const studioA = await createTestStudio();
    const slotAChild = await createTestSlot(studioA.id, {
      title: 'Kids',
      startsAt: new Date().toISOString(),
      durationMin: 45,
      price: 12,
      minParticipants: 1,
      maxParticipants: 5,
      forChildren: true,
    });
    // Studio B with parent+child
    const studioB = await createTestStudio();
    const parentB = await createTestCustomer(studioB.id, {
      first_name: 'PB',
      contact_email: 'pb@b',
    } as any);
    // Create a child in B directly
    const client = getDbClient();
    const childInsert = await client.query(
      `insert into children (customer_id, first_name, avatar_key)
       values ($1, $2, $3) returning *`,
      [parentB.id, 'KidB', 'k']
    );
    const childB = childInsert.rows[0];

    // Attempt to book slot in A with child from B -> 404
    await request(app)
      .post('/bookings')
      .send({ slotId: slotAChild.id, childId: childB.id })
      .expect(404);

    // Create adult slot and book in A for listing filters
    const parentA = await createTestCustomer(studioA.id, {
      first_name: 'PA',
      contact_email: 'pa@a',
    } as any);
    const slotAAdult = await createTestSlot(studioA.id, {
      title: 'Adult',
      startsAt: new Date().toISOString(),
      durationMin: 60,
      price: 10,
      minParticipants: 0,
      maxParticipants: 5,
      forChildren: false,
    });
    const booking2 = await request(app)
      .post('/bookings')
      .send({ slotId: slotAAdult.id, customerId: parentA.id })
      .expect(201);
    await request(app)
      .patch(`/bookings/${booking2.body.id}/payment`)
      .send({ paidMethod: 'cash' })
      .expect(200);

    const listPaid = await request(app)
      .get('/bookings')
      .query({ slotId: slotAAdult.id, paid: 'true' })
      .expect(200);
    expect(Array.isArray(listPaid.body)).toBe(true);
    expect(listPaid.body.length).toBeGreaterThanOrEqual(1);
  });
});
