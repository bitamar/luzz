import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import customerChildrenRouter, { childrenRouter } from '../routes/children';
import { createTestStudio, createTestCustomer } from './test-helpers';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/customers', customerChildrenRouter);
  app.use('/children', childrenRouter);
  return app;
}

describe('Children routes', () => {
  it('POST /customers/:customerId/children creates child; list returns children', async () => {
    const app = makeApp();
    const studio = await createTestStudio();
    const customer = await createTestCustomer(studio.id, {
      first_name: 'P',
      contact_email: 'p@q.r',
    });

    const create = await request(app)
      .post(`/customers/${customer.id}/children`)
      .send({ firstName: 'Kid', avatarKey: 'k1' })
      .expect(201);
    expect(create.body).toHaveProperty('id');

    const list = await request(app).get(`/customers/${customer.id}/children`).expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThan(0);

    // zod validation
    await request(app)
      .post(`/customers/${customer.id}/children`)
      .send({ firstName: '' })
      .expect(400);

    // 404 parent
    await request(app)
      .post(`/customers/550e8400-e29b-41d4-a716-446655440000/children`)
      .send({ firstName: 'Other', avatarKey: 'k2' })
      .expect(404);

    // invalid customer id format on list
    await request(app).get('/customers/not-a-uuid/children').expect(400);
  });

  it('GET/PATCH/DELETE /children/:id', async () => {
    const app = makeApp();
    const studio = await createTestStudio();
    const customer = await createTestCustomer(studio.id, {
      first_name: 'Q',
      contact_email: 'q@w.e',
    });
    const created = await request(app)
      .post(`/customers/${customer.id}/children`)
      .send({ firstName: 'Zed', avatarKey: 'av' })
      .expect(201);

    const got = await request(app).get(`/children/${created.body.id}`).expect(200);
    expect(got.body.first_name).toBe('Zed');

    const patched = await request(app)
      .patch(`/children/${created.body.id}`)
      .send({ firstName: 'Z' })
      .expect(200);
    expect(patched.body.first_name).toBe('Z');

    const del = await request(app).delete(`/children/${created.body.id}`).expect(200);
    expect(del.body).toHaveProperty('deleted');

    // invalid id
    await request(app).get('/children/not-a-uuid').expect(400);
    await request(app).patch('/children/not-a-uuid').send({}).expect(400);
    await request(app).delete('/children/not-a-uuid').expect(400);

    // 404 not found branches
    await request(app).get('/children/550e8400-e29b-41d4-a716-446655440099').expect(404);
    await request(app)
      .patch('/children/550e8400-e29b-41d4-a716-446655440099')
      .send({ firstName: 'Y' })
      .expect(404);
    await request(app).delete('/children/550e8400-e29b-41d4-a716-446655440099').expect(404);
  });
});
