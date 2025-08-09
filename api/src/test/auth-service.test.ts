import { describe, it, expect, beforeAll } from 'vitest';
import { upsertUserFromGoogle } from '../auth/service';
import { db } from '../db';

describe('auth service: upsertUserFromGoogle', () => {
  beforeAll(async () => {
    await db.query('SELECT 1');
  });

  it('inserts a new user and returns it', async () => {
    const user = await upsertUserFromGoogle({
      sub: 'sub-1',
      email: 'one@example.com',
      name: 'One',
      picture: 'https://img/1.png',
      email_verified: true,
    });
    expect(user.google_sub).toBe('sub-1');
    expect(user.email).toBe('one@example.com');
  });

  it('updates an existing user fields on conflict', async () => {
    const first = await upsertUserFromGoogle({
      sub: 'sub-2',
      email: 'old@example.com',
      name: 'Old',
      picture: 'https://img/old.png',
      email_verified: true,
    });
    const updated = await upsertUserFromGoogle({
      sub: 'sub-2',
      email: 'new@example.com',
      name: 'New',
      picture: 'https://img/new.png',
      email_verified: true,
    });
    expect(updated.id).toBe(first.id);
    expect(updated.email).toBe('new@example.com');
    expect(updated.name).toBe('New');
  });
});
