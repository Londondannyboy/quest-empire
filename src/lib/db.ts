import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export { sql }

// Profile types
export type Profile = {
  id: string
  name: string
  email: string
  headline?: string
  summary?: string
  created_at: Date
  updated_at: Date
}

// Helper functions
export async function getProfile(userId: string): Promise<Profile | null> {
  const result = await sql`SELECT * FROM profiles WHERE id = ${userId}`
  return result[0] as Profile | null
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
  const result = await sql`
    INSERT INTO profiles (id, name, email, headline, summary)
    VALUES (${profile.id}, ${profile.name || ''}, ${profile.email || ''}, ${profile.headline || ''}, ${profile.summary || ''})
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, profiles.name),
      email = COALESCE(EXCLUDED.email, profiles.email),
      headline = COALESCE(EXCLUDED.headline, profiles.headline),
      summary = COALESCE(EXCLUDED.summary, profiles.summary),
      updated_at = NOW()
    RETURNING *
  `
  return result[0] as Profile
}
