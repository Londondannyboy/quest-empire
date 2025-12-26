import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";

const sql = neon(process.env.DATABASE_URL!);

// Get current user from session
async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const result = await sql`
    SELECT user_id FROM sessions
    WHERE id = ${sessionId} AND expires_at > NOW()
  `;
  return result[0]?.user_id || null;
}

// GET - Fetch profile
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get profile
    const profileResult = await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `;

    // Get current state
    const stateResult = await sql`
      SELECT * FROM current_state WHERE user_id = ${userId}
    `;

    // Get skills
    const skillsResult = await sql`
      SELECT id, name, version, proficiency FROM skills WHERE user_id = ${userId}
    `;

    // Get role history
    const historyResult = await sql`
      SELECT * FROM role_history WHERE user_id = ${userId} ORDER BY start_date DESC
    `;

    // Get needs
    const needsResult = await sql`
      SELECT * FROM needs WHERE user_id = ${userId}
    `;

    return NextResponse.json({
      profile: profileResult[0] || null,
      currentState: stateResult[0] || null,
      skills: skillsResult,
      roleHistory: historyResult,
      needs: needsResult,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json({ error: "Failed to get profile" }, { status: 500 });
  }
}

// PATCH - Update profile fields
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const updates = await request.json();
    const { name, email, headline, summary } = updates;

    // Upsert profile
    await sql`
      INSERT INTO profiles (id, name, email, headline, summary)
      VALUES (${userId}, ${name || ''}, ${email || ''}, ${headline || ''}, ${summary || ''})
      ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(NULLIF(${name}, ''), profiles.name),
        email = COALESCE(NULLIF(${email}, ''), profiles.email),
        headline = COALESCE(NULLIF(${headline}, ''), profiles.headline),
        summary = COALESCE(NULLIF(${summary}, ''), profiles.summary),
        updated_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

// POST - Add new data (skills, needs, etc.)
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { type, data } = await request.json();

    switch (type) {
      case "skill":
        await sql`
          INSERT INTO skills (user_id, name, version, proficiency)
          VALUES (${userId}, ${data.name}, ${data.version || null}, ${data.proficiency || 'intermediate'})
        `;
        break;

      case "need":
        await sql`
          INSERT INTO needs (user_id, category, need)
          VALUES (${userId}, ${data.category}, ${data.need})
        `;
        break;

      case "role_history":
        await sql`
          INSERT INTO role_history (user_id, title, company_name, years, is_current)
          VALUES (${userId}, ${data.title}, ${data.company_name}, ${data.years || null}, ${data.is_current || false})
        `;
        break;

      case "current_state":
        await sql`
          INSERT INTO current_state (user_id, role_title, company_name, day_rate, availability, work_style, location)
          VALUES (${userId}, ${data.role_title}, ${data.company_name}, ${data.day_rate}, ${data.availability}, ${data.work_style}, ${data.location})
          ON CONFLICT (user_id) DO UPDATE SET
            role_title = COALESCE(${data.role_title}, current_state.role_title),
            company_name = COALESCE(${data.company_name}, current_state.company_name),
            day_rate = COALESCE(${data.day_rate}, current_state.day_rate),
            availability = COALESCE(${data.availability}, current_state.availability),
            work_style = COALESCE(${data.work_style}, current_state.work_style),
            location = COALESCE(${data.location}, current_state.location),
            updated_at = NOW()
        `;
        break;

      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add profile data error:", error);
    return NextResponse.json({ error: "Failed to add data" }, { status: 500 });
  }
}
