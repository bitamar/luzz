import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../db';

describe('Auth schema', () => {
  beforeAll(async () => {
    // Ensure connection is up
    await db.query('SELECT 1');
  });

  it('creates users table with expected columns and constraints', async () => {
    const cols = await db.query(
      `SELECT column_name, is_nullable, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users'
       ORDER BY ordinal_position`
    );
    expect(cols.rowCount).toBeGreaterThan(0);
    const names = cols.rows.map(r => r.column_name);
    expect(names).toEqual(
      expect.arrayContaining(['id', 'google_sub', 'email', 'name', 'avatar_url', 'is_admin', 'created_at'])
    );

    const unique = await db.query(
      `SELECT i.relname AS index_name
       FROM pg_class t
       JOIN pg_index ix ON t.oid = ix.indrelid
       JOIN pg_class i ON ix.indexrelid = i.oid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
       WHERE t.relname = 'users' AND ix.indisunique = true`
    );
    // At least unique on google_sub
    const hasGoogleSubUnique = unique.rows.some(r => String(r.index_name).includes('google_sub'));
    expect(hasGoogleSubUnique).toBe(true);
  });

  it('creates studio_owners table with expected FKs and unique (studio_id,user_id)', async () => {
    const exists = await db.query(`SELECT to_regclass('public.studio_owners') as reg`);
    expect(exists.rows[0].reg).toBe('studio_owners');

    const pkey = await db.query(
      `SELECT conname, pg_get_constraintdef(c.oid) as def
       FROM pg_constraint c
       JOIN pg_class t ON c.conrelid = t.oid
       WHERE t.relname = 'studio_owners' AND c.contype = 'p'`
    );
    const hasComposite = pkey.rows.some(r => String(r.def).includes('PRIMARY KEY (studio_id, user_id)'));
    expect(hasComposite).toBe(true);
  });
});
