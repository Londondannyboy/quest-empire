import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      return NextResponse.json({ user: null });
    }

    // Get user from session
    const result = await sql`
      SELECT u.id, u.email, u.name, u.created_at
      FROM auth_users u
      JOIN sessions s ON s.user_id = u.id
      WHERE s.id = ${sessionId} AND s.expires_at > NOW()
    `;

    if (result.length === 0) {
      // Session expired or invalid
      cookieStore.delete("session_id");
      return NextResponse.json({ user: null });
    }

    const user = result[0];

    // Also get their profile data
    const profileResult = await sql`
      SELECT * FROM profiles WHERE id = ${user.id}
    `;
    const profile = profileResult[0] || null;

    // Get their current state
    const stateResult = await sql`
      SELECT * FROM current_state WHERE user_id = ${user.id}
    `;
    const currentState = stateResult[0] || null;

    // Get their skills
    const skillsResult = await sql`
      SELECT name, version, proficiency FROM skills WHERE user_id = ${user.id}
    `;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
      },
      profile,
      currentState,
      skills: skillsResult,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}
