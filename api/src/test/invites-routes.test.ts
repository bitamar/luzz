import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import invitesRouter from '../routes/invites';
import { getDbClient } from '../db';
import { createTestStudio } from './test-helpers';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/invites', invitesRouter);
  return app;
}

describe('Invites routes', () => {
  it('POST /invites creates invite and returns URL', async () => {
    const app = makeApp();
    const client = getDbClient();
    const studio = await createTestStudio();

    const res = await request(app)
      .post('/invites')
      .send({
        studioId: studio.id,
        customer: { firstName: 'Alice', email: 'alice@example.com' },
      })
      .expect(201);

    expect(res.body).toHaveProperty('short_hash');
    expect(res.body).toHaveProperty('inviteUrl');

    // Creating again with same contact should 409 if customer already exists, but route allows reuse.
    const res2 = await request(app)
      .post('/invites')
      .send({
        studioId: studio.id,
        customer: { firstName: 'Alice', email: 'alice@example.com' },
      })
      .expect(201);
    expect(res2.body).toHaveProperty('short_hash');

    // Unknown studio
    await request(app)
      .post('/invites')
      .send({ studioId: '550e8400-e29b-41d4-a716-446655440000', customer: { firstName: 'A', email: 'a@b.co' } })
      .expect(404);

    // Validation
    await request(app)
      .post('/invites')
      .send({ studioId: studio.id, customer: { firstName: '' } })
      .expect(400);

    // Phone-only is allowed
    const res3 = await request(app)
      .post('/invites')
      .send({
        studioId: studio.id,
        customer: { firstName: 'Bob', phone: '+15550123' },
      })
      .expect(201);
    expect(res3.body).toHaveProperty('short_hash');
  });
});


