import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import studioCustomersRouter, { customersRouter } from '../routes/customers';
import { createTestStudio, createTestCustomer } from './test-helpers';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/studios', studioCustomersRouter);
  app.use('/customers', customersRouter);
  return app;
}

describe('Customers routes', () => {
  it('POST /studios/:studioId/customers creates a customer and prevents duplicates', async () => {
    const app = makeApp();
    const studio = await createTestStudio();

    const create = await request(app)
      .post(`/studios/${studio.id}/customers`)
      .send({ firstName: 'John', contactEmail: 'john@ex.com' })
      .expect(201);
    expect(create.body).toHaveProperty('id');

    const dup = await request(app)
      .post(`/studios/${studio.id}/customers`)
      .send({ firstName: 'John', contactEmail: 'john@ex.com' })
      .expect(409);
    expect(dup.body.error).toMatch(/already exists/i);

    // invalid studio id
    await request(app)
      .post(`/studios/not-a-uuid/customers`)
      .send({ firstName: 'Bad', contactEmail: 'b@c.d' })
      .expect(400);

    // duplicate detection by phone
    await request(app)
      .post(`/studios/${studio.id}/customers`)
      .send({ firstName: 'Pho', contactPhone: '+155501' })
      .expect(201);
    await request(app)
      .post(`/studios/${studio.id}/customers`)
      .send({ firstName: 'Pho', contactPhone: '+155501' })
      .expect(409);
  });

  it('GET /studios/:studioId/customers lists customers', async () => {
    const app = makeApp();
    const studio = await createTestStudio();
    await createTestCustomer(studio.id, {
      first_name: 'A',
      contact_email: 'a@b.co',
    });

    const res = await request(app).get(`/studios/${studio.id}/customers`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);

    // invalid id
    await request(app).get('/studios/not-a-uuid/customers').expect(400);
  });

  it('GET /customers/:id returns details; PATCH updates fields; DELETE removes', async () => {
    const app = makeApp();
    const studio = await createTestStudio();
    const customer = await createTestCustomer(studio.id, {
      first_name: 'X',
      contact_email: 'x@y.z',
    });

    const get = await request(app).get(`/customers/${customer.id}`).expect(200);
    expect(get.body.id).toBe(customer.id);

    const updated = await request(app)
      .patch(`/customers/${customer.id}`)
      .send({ firstName: 'New', contactPhone: '+1555' })
      .expect(200);
    expect(updated.body.first_name).toBe('New');

    await request(app).patch(`/customers/${customer.id}`).send({}).expect(400);

    const del = await request(app).delete(`/customers/${customer.id}`).expect(200);
    expect(del.body).toHaveProperty('deleted');

    await request(app).get(`/customers/${customer.id}`).expect(404);

    // 404 not found branches
    await request(app).get('/customers/550e8400-e29b-41d4-a716-446655440099').expect(404);
    await request(app)
      .patch('/customers/550e8400-e29b-41d4-a716-446655440099')
      .send({ firstName: 'X' })
      .expect(404);
    await request(app).delete('/customers/550e8400-e29b-41d4-a716-446655440099').expect(404);
  });
});
