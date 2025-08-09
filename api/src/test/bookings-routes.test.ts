import { describe, it, expect, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import bookingsRouter from '../routes/bookings';
import { closeDatabase } from '../db';
import { createTestStudio, createTestSlot, createTestCustomer } from './test-helpers';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/bookings', bookingsRouter);
  return app;
}

describe('Bookings routes', () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it('POST /bookings creates booking; GET list filters; GET by id; PATCH status; PATCH payment; DELETE', async () => {
    const app = makeApp();
    const studio = await createTestStudio();
    const slot = await createTestSlot(studio.id, {
      title: 'Adult',
      startsAt: new Date().toISOString(),
      durationMin: 60,
      price: 10,
      minParticipants: 0,
      maxParticipants: 2,
      forChildren: false,
    });
    const customer = await createTestCustomer(studio.id, { first_name: 'A', contact_email: 'a@b.c' } as any);

    const created = await request(app)
      .post('/bookings')
      .send({ slotId: slot.id, customerId: customer.id })
      .expect(201);
    expect(created.body).toHaveProperty('id');

    const getOne = await request(app).get(`/bookings/${created.body.id}`).expect(200);
    expect(getOne.body.slot_id).toBe(slot.id);

    const list = await request(app)
      .get('/bookings')
      .query({ slotId: slot.id })
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThan(0);

    const status = await request(app)
      .patch(`/bookings/${created.body.id}/status`)
      .send({ status: 'CANCELLED' })
      .expect(200);
    expect(status.body.status).toBe('CANCELLED');

    const payment = await request(app)
      .patch(`/bookings/${created.body.id}/payment`)
      .send({ paidMethod: 'cash' })
      .expect(200);
    expect(payment.body.paid).toBe(true);

    const del = await request(app).delete(`/bookings/${created.body.id}`).expect(200);
    expect(del.body).toHaveProperty('deleted');
  });

  it('validates ids and returns 404/400 where appropriate', async () => {
    const app = makeApp();
    await request(app).get('/bookings/not-a-uuid').expect(400);
    await request(app)
      .patch('/bookings/not-a-uuid/status')
      .send({ status: 'CONFIRMED' })
      .expect(400);
    await request(app)
      .patch('/bookings/not-a-uuid/payment')
      .send({ paidMethod: 'cash' })
      .expect(400);
    await request(app).delete('/bookings/not-a-uuid').expect(400);
  });

  it('handles capacity reached and cross-studio constraints', async () => {
    const app = makeApp();
    // Studio A with slot capacity 1
    const studioA = await createTestStudio();
    const slotA = await createTestSlot(studioA.id, {
      title: 'Cap1',
      startsAt: new Date().toISOString(),
      durationMin: 60,
      price: 10,
      minParticipants: 0,
      maxParticipants: 1,
      forChildren: false,
    });
    const customerA1 = await createTestCustomer(studioA.id, { first_name: 'A1', contact_email: 'a1@a.a' } as any);
    const customerA2 = await createTestCustomer(studioA.id, { first_name: 'A2', contact_email: 'a2@a.a' } as any);
    // First booking succeeds
    await request(app)
      .post('/bookings')
      .send({ slotId: slotA.id, customerId: customerA1.id })
      .expect(201);
    // Second booking hits capacity
    await request(app)
      .post('/bookings')
      .send({ slotId: slotA.id, customerId: customerA2.id })
      .expect(409);

    // Cross-studio check: customer from B cannot book slot in A
    const studioB = await createTestStudio();
    const customerB = await createTestCustomer(studioB.id, { first_name: 'B', contact_email: 'b@b.b' } as any);
    await request(app)
      .post('/bookings')
      .send({ slotId: slotA.id, customerId: customerB.id })
      .expect(404);
  });

  it('covers paid-twice, non-existent resources, inactive slot, invalid status', async () => {
    const app = makeApp();
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
    const customer = await createTestCustomer(studio.id, { first_name: 'P', contact_email: 'p@q' } as any);

    const created = await request(app)
      .post('/bookings')
      .send({ slotId: slot.id, customerId: customer.id })
      .expect(201);

    // Pay once ok
    await request(app)
      .patch(`/bookings/${created.body.id}/payment`)
      .send({ paidMethod: 'cash' })
      .expect(200);
    // Pay again -> 400
    await request(app)
      .patch(`/bookings/${created.body.id}/payment`)
      .send({ paidMethod: 'cash' })
      .expect(400);

    // Non-existent get/status/delete
    const missingId = '550e8400-e29b-41d4-a716-446655440099';
    await request(app).get(`/bookings/${missingId}`).expect(404);
    await request(app)
      .patch(`/bookings/${missingId}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(404);
    await request(app).delete(`/bookings/${missingId}`).expect(404);

    // Invalid status value
    await request(app)
      .patch(`/bookings/${created.body.id}/status`)
      .send({ status: 'WHATEVER' })
      .expect(400);

    // Inactive slot cannot be booked
    // Directly deactivate the slot
    const { getDbClient } = await import('../db');
    const client = getDbClient();
    await client.query('update slots set active=false where id=$1', [slot.id]);
    await request(app)
      .post('/bookings')
      .send({ slotId: slot.id, customerId: customer.id })
      .expect(404);
  });
});


