import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import OpenAI from "openai";

const sql = neon(process.env.DATABASE_URL!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// API key for Hume to authenticate (set in Hume config)
const CLM_API_KEY = process.env.CLM_API_KEY || "quest-clm-secret";

interface HumeMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Get user profile context from database
async function getUserContext(userId: string): Promise<string> {
  if (!userId || userId === "anonymous") {
    return "New user - no profile data yet. Ask them about their role and location.";
  }

  try {
    // Get profile from current_state table
    const stateResult = await sql`
      SELECT role_title, location, day_rate, availability, work_style
      FROM current_state WHERE user_id = ${userId}
    `;

    // Get skills
    const skillsResult = await sql`
      SELECT name FROM skills WHERE user_id = ${userId}
    `;

    // Get user name from profiles
    const profileResult = await sql`
      SELECT name, headline FROM profiles WHERE id = ${userId}
    `;

    const state = stateResult[0];
    const profile = profileResult[0];
    const skills = skillsResult.map((s) => s.name);

    const contextParts: string[] = [];

    if (profile?.name) contextParts.push(`User's name: ${profile.name}`);
    if (state?.role_title) contextParts.push(`Target role: ${state.role_title}`);
    if (state?.location) contextParts.push(`Preferred location: ${state.location}`);
    if (state?.day_rate) contextParts.push(`Day rate: ${state.day_rate}`);
    if (state?.availability) contextParts.push(`Availability: ${state.availability}`);
    if (state?.work_style) contextParts.push(`Work style: ${state.work_style}`);
    if (skills.length > 0) contextParts.push(`Skills: ${skills.join(", ")}`);

    return contextParts.length > 0
      ? contextParts.join(". ") + "."
      : "User has an account but no profile data yet.";
  } catch (error) {
    console.error("Failed to get user context:", error);
    return "Unable to load user profile.";
  }
}

// System prompt for Quest voice assistant
function buildSystemPrompt(userContext: string): string {
  return `You are Quest, a friendly career assistant for fractional and interim professionals.

USER CONTEXT:
${userContext}

GUIDELINES:
- Be conversational and warm - this is a voice conversation
- Keep responses concise (2-3 sentences max) since you're speaking
- If you know their role/location, reference it naturally
- Help them find fractional/interim job opportunities
- If they mention new info (name, role, location, skills), acknowledge it
- Ask clarifying questions when needed
- Be encouraging about their career journey

Remember: You're having a spoken conversation, so be natural and brief.`;
}

export async function POST(request: NextRequest) {
  // Verify API key
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== CLM_API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const messages: HumeMessage[] = body.messages || [];

    // Get custom_session_id from query params (this is the user_id)
    const url = new URL(request.url);
    const customSessionId = url.searchParams.get("custom_session_id") || "anonymous";

    console.log("🎤 Hume CLM request for user:", customSessionId);
    console.log("📝 Messages:", messages.length);

    // Get user context from database
    const userContext = await getUserContext(customSessionId);
    console.log("📋 User context:", userContext);

    // Build messages with context-aware system prompt
    const systemPrompt = buildSystemPrompt(userContext);
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      // Filter out any existing system messages and map the rest
      ...messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    ];

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      stream: true,
    });

    // Create SSE response in OpenAI format
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const data = JSON.stringify(chunk);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("CLM endpoint error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
