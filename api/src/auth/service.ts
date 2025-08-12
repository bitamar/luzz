import { db } from '../db';
import type { GoogleProfile } from './google';

export interface User {
  id: string;
  google_sub: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
}

/**
 * Upsert a user by Google subject and return the user record.
 */
export async function upsertUserFromGoogle(profile: GoogleProfile): Promise<User> {
  const result = await db.query(
    `insert into users (google_sub, email, name, avatar_url)
     values ($1, $2, $3, $4)
     on conflict (google_sub)
     do update set
       email = excluded.email,
       name = excluded.name,
       avatar_url = excluded.avatar_url
     returning id, google_sub, email, name, avatar_url, is_admin, created_at`,
    [profile.sub, profile.email ?? null, profile.name ?? null, profile.picture ?? null]
  );

  return result.rows[0] as User;
}
