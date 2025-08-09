import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import bookingsRouter from '../routes/bookings';
import { createTestStudio, createTestSlot, createTestCustomer } from './test-helpers';

function appFactory() {
  const app = express();
  app.use(express.json());
  app.use('/bookings', bookingsRouter);
  return app;
}

describe('Bookings list filters', () => {
  it('filters by studioId, customerId, childId, slotId, status, paid', async () => {
    const app = appFactory();
    const studio = await createTestStudio();
    const adultSlot = await createTestSlot(studio.id, {
      title: 'Adult',
      startsAt: new Date().toISOString(),
      durationMin: 60,
      price: 10,
      minParticipants: 0,
      maxParticipants: 5,
      forChildren: false,
    });
    const childSlot = await createTestSlot(studio.id, {
      title: 'Kids',
      startsAt: new Date().toISOString(),
      durationMin: 45,
      price: 12,
      minParticipants: 1,
      maxParticipants: 5,
      forChildren: true,
    });
    const customer = await createTestCustomer(studio.id, {
      first_name: 'AAA',
      contact_email: 'aaa@a',
    } as any);

    const b1 = await request(app)
      .post('/bookings')
      .send({ slotId: adultSlot.id, customerId: customer.id })
      .expect(201);

    // create a child for childSlot
    const { getDbClient } = await import('../db');
    const client = getDbClient();
    const childInsert = await client.query(
      `insert into children (customer_id, first_name, avatar_key) values ($1,$2,$3) returning *`,
      [customer.id, 'Kido', 'k']
    );
    const child = childInsert.rows[0];
    const b2 = await request(app)
      .post('/bookings')
      .send({ slotId: childSlot.id, childId: child.id })
      .expect(201);

    // pay b1
    await request(app)
      .patch(`/bookings/${b1.body.id}/payment`)
      .send({ paidMethod: 'cash' })
      .expect(200);

    const q1 = await request(app)
      .get('/bookings')
      .query({ studioId: studio.id })
      .expect(200);
    expect(q1.body.length).toBeGreaterThanOrEqual(2);

    const q2 = await request(app)
      .get('/bookings')
      .query({ customerId: customer.id })
      .expect(200);
    expect(q2.body.find((r: any) => r.id === b1.body.id)).toBeTruthy();

    const q3 = await request(app)
      .get('/bookings')
      .query({ childId: child.id })
      .expect(200);
    expect(q3.body.find((r: any) => r.id === b2.body.id)).toBeTruthy();

    const q4 = await request(app)
      .get('/bookings')
      .query({ slotId: adultSlot.id, paid: 'true' })
      .expect(200);
    expect(q4.body.find((r: any) => r.id === b1.body.id)).toBeTruthy();

    const q5 = await request(app)
      .get('/bookings')
      .query({ status: 'CONFIRMED' })
      .expect(200);
    expect(q5.body.length).toBeGreaterThanOrEqual(2);
  });
});


