from textwrap import dedent
import os
import json
import psycopg
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.ag_ui import StateDeps
from ag_ui.core import EventType, StateSnapshotEvent
from pydantic_ai.models.openai import OpenAIResponsesModel
from zep_cloud.client import AsyncZep
from zep_cloud.types import Message

# load environment variables
from dotenv import load_dotenv
load_dotenv()

# =====
# Database Connection
# =====
DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db():
  """Get a database connection."""
  return psycopg.connect(DATABASE_URL)

# =====
# Zep Graph Client (fractional-jobs)
# =====
zep = AsyncZep(api_key=os.environ.get("ZEP_API_KEY"))

# =====
# State - Quest Profile
# =====
class ProfileData(BaseModel):
  """User's career profile data."""
  name: str | None = None
  role: str | None = None
  company: str | None = None
  location: str | None = None
  skills: list[str] = Field(default_factory=list)
  day_rate: str | None = None
  availability: str | None = None
  work_style: str | None = None  # remote, hybrid, onsite

class QuestState(BaseModel):
  """State for the Quest career agent."""
  user_id: str = Field(default="anonymous")
  profile: ProfileData = Field(default_factory=ProfileData)
  jobs_shown: int = Field(default=0)
  consents: dict = Field(default_factory=dict)
  stage: str = Field(default="onboarding")  # onboarding, enrichment, trinity

# =====
# Quest Agent (Super-Agent)
# =====
agent = Agent(
  model=OpenAIResponsesModel('gpt-4.1-mini'),
  deps_type=StateDeps[QuestState],
  system_prompt=dedent("""
    You are Quest, a career assistant for fractional and interim professionals.

    Your mission:
    - Help users build their professional profile QUICKLY
    - Find matching fractional/interim jobs
    - Identify their professional needs

    IMPORTANT RULES:
    1. Deliver value FAST. Get basic info -> Show jobs -> Then enrich.
    2. ALWAYS ask for consent before scraping external sources.
    3. Use the extract_profile tool to capture info from what users tell you.
    4. Use add_to_graph to save important facts about the user.
    5. Use request_confirmation for any action requiring user approval.

    Start by asking: "What role are you looking for?" and "Where do you prefer to work?"
  """).strip()
)

# =====
# Profile Tools
# =====
@agent.tool
def get_profile(ctx: RunContext[StateDeps[QuestState]]) -> dict:
  """Get the current user profile."""
  print(f"📋 Getting profile: {ctx.deps.state.profile}")
  return ctx.deps.state.profile.model_dump()

@agent.tool
async def update_profile(ctx: RunContext[StateDeps[QuestState]],
                         name: str | None = None,
                         role: str | None = None,
                         company: str | None = None,
                         location: str | None = None,
                         skills: list[str] | None = None,
                         day_rate: str | None = None,
                         availability: str | None = None,
                         work_style: str | None = None) -> StateSnapshotEvent:
  """Update the user's profile with extracted information."""
  profile = ctx.deps.state.profile
  if name: profile.name = name
  if role: profile.role = role
  if company: profile.company = company
  if location: profile.location = location
  if skills: profile.skills.extend(skills)
  if day_rate: profile.day_rate = day_rate
  if availability: profile.availability = availability
  if work_style: profile.work_style = work_style

  print(f"✅ Updated profile: {profile}")
  return StateSnapshotEvent(
    type=EventType.STATE_SNAPSHOT,
    snapshot=ctx.deps.state,
  )

# =====
# Zep Graph Tools
# =====
@agent.tool
async def add_to_graph(ctx: RunContext[StateDeps[QuestState]],
                       fact: str,
                       source_node: str = "user",
                       target_node: str | None = None) -> str:
  """Add a fact to the user's knowledge graph in Zep. Use this to remember important information."""
  user_id = ctx.deps.state.user_id
  try:
    # Add data to user's graph
    await zep.graph.add(
      user_id=user_id,
      type="json",
      data=json.dumps({
        "fact": fact,
        "source": source_node,
        "target": target_node or fact.split()[0]
      })
    )
    print(f"🔗 Added to graph for {user_id}: {fact}")
    return f"Saved to graph: {fact}"
  except Exception as e:
    print(f"❌ Graph error: {e}")
    return f"Graph error: {str(e)}"

@agent.tool
async def search_graph(ctx: RunContext[StateDeps[QuestState]], query: str) -> str:
  """Search the user's knowledge graph for relevant information."""
  user_id = ctx.deps.state.user_id
  try:
    results = await zep.graph.search(user_id=user_id, query=query, limit=5)
    if results and results.edges:
      facts = [f"{e.source_node_name} -> {e.fact} -> {e.target_node_name}" for e in results.edges]
      print(f"🔍 Found {len(facts)} graph results for: {query}")
      return "\n".join(facts)
    return "No relevant information found in graph."
  except Exception as e:
    print(f"❌ Search error: {e}")
    return f"No graph data yet: {str(e)}"

@agent.tool
async def get_user_context(ctx: RunContext[StateDeps[QuestState]]) -> str:
  """Get the full context/summary for this user from Zep."""
  user_id = ctx.deps.state.user_id
  try:
    user = await zep.user.get(user_id=user_id)
    if user and user.facts:
      return "\n".join([f.fact for f in user.facts])
    return "No user context available yet."
  except Exception as e:
    print(f"❌ Context error: {e}")
    return f"User is new: {str(e)}"

# =====
# Consent & HITL Tools
# =====
@agent.tool
async def set_consent(ctx: RunContext[StateDeps[QuestState]],
                      consent_type: str,
                      granted: bool) -> StateSnapshotEvent:
  """Record user consent for a specific action (linkedin_scrape, human_review, etc.)."""
  ctx.deps.state.consents[consent_type] = granted
  print(f"📝 Consent for {consent_type}: {granted}")
  return StateSnapshotEvent(
    type=EventType.STATE_SNAPSHOT,
    snapshot=ctx.deps.state,
  )

@agent.tool
def check_consent(ctx: RunContext[StateDeps[QuestState]], consent_type: str) -> bool:
  """Check if user has given consent for a specific action."""
  return ctx.deps.state.consents.get(consent_type, False)

# =====
# Job Search (Placeholder)
# =====
@agent.tool
async def search_jobs(ctx: RunContext[StateDeps[QuestState]],
                      role: str,
                      location: str) -> str:
  """Search for matching fractional/interim jobs."""
  # TODO: Integrate with DataForSEO SERP API
  print(f"🔍 Searching jobs: {role} in {location}")

  # Placeholder response
  jobs = [
    {"title": f"Fractional {role}", "company": "TechCorp", "location": location, "rate": "£800-1200/day"},
    {"title": f"Interim {role}", "company": "StartupXYZ", "location": location, "rate": "£700-900/day"},
    {"title": f"{role} Consultant", "company": "Enterprise Ltd", "location": location, "rate": "£1000-1500/day"},
  ]

  ctx.deps.state.jobs_shown = len(jobs)

  result = f"Found {len(jobs)} matching roles:\n"
  for i, job in enumerate(jobs, 1):
    result += f"\n{i}. {job['title']} at {job['company']}\n   Location: {job['location']}\n   Rate: {job['rate']}\n"

  return result

# =====
# Stage Management
# =====
@agent.tool
async def set_stage(ctx: RunContext[StateDeps[QuestState]], stage: str) -> StateSnapshotEvent:
  """Update the user's journey stage (onboarding, enrichment, trinity)."""
  ctx.deps.state.stage = stage
  print(f"📍 Stage updated to: {stage}")
  return StateSnapshotEvent(
    type=EventType.STATE_SNAPSHOT,
    snapshot=ctx.deps.state,
  )

# Keep the weather tool for demo purposes
@agent.tool
def get_weather(_: RunContext[StateDeps[QuestState]], location: str) -> str:
  """Get the weather for a given location. Ensure location is fully spelled out."""
  return f"The weather in {location} is sunny."

# =====
# Database Persistence Tools
# =====
@agent.tool
def save_profile_to_db(ctx: RunContext[StateDeps[QuestState]]) -> str:
  """Save the current profile to the Neon database. Use after updating profile."""
  user_id = ctx.deps.state.user_id
  profile = ctx.deps.state.profile

  if user_id == "anonymous":
    return "User not logged in - profile saved to session only."

  try:
    with get_db() as conn:
      with conn.cursor() as cur:
        # Upsert profile
        cur.execute("""
          INSERT INTO profiles (id, name, headline)
          VALUES (%s, %s, %s)
          ON CONFLICT (id) DO UPDATE SET
            name = COALESCE(EXCLUDED.name, profiles.name),
            headline = COALESCE(EXCLUDED.headline, profiles.headline),
            updated_at = NOW()
        """, (user_id, profile.name, profile.role))

        # Upsert current state
        cur.execute("""
          INSERT INTO current_state (user_id, role_title, location, day_rate, availability, work_style)
          VALUES (%s, %s, %s, %s, %s, %s)
          ON CONFLICT (user_id) DO UPDATE SET
            role_title = COALESCE(EXCLUDED.role_title, current_state.role_title),
            location = COALESCE(EXCLUDED.location, current_state.location),
            day_rate = COALESCE(EXCLUDED.day_rate, current_state.day_rate),
            availability = COALESCE(EXCLUDED.availability, current_state.availability),
            work_style = COALESCE(EXCLUDED.work_style, current_state.work_style),
            updated_at = NOW()
        """, (user_id, profile.role, profile.location, profile.day_rate, profile.availability, profile.work_style))

        conn.commit()

    print(f"💾 Saved profile to database for user {user_id}")
    return f"Profile saved to database for user {user_id}"
  except Exception as e:
    print(f"❌ Database error: {e}")
    return f"Failed to save to database: {str(e)}"

@agent.tool
def add_skill_to_db(ctx: RunContext[StateDeps[QuestState]], skill_name: str, proficiency: str = "intermediate") -> str:
  """Add a skill to the user's database record."""
  user_id = ctx.deps.state.user_id

  if user_id == "anonymous":
    return "User not logged in - skill added to session only."

  try:
    with get_db() as conn:
      with conn.cursor() as cur:
        cur.execute("""
          INSERT INTO skills (user_id, name, proficiency)
          VALUES (%s, %s, %s)
        """, (user_id, skill_name, proficiency))
        conn.commit()

    print(f"💾 Added skill {skill_name} for user {user_id}")
    return f"Skill '{skill_name}' saved to database"
  except Exception as e:
    print(f"❌ Database error: {e}")
    return f"Failed to save skill: {str(e)}"

@agent.tool
def add_need_to_db(ctx: RunContext[StateDeps[QuestState]], category: str, need: str) -> str:
  """Add a need to the user's database record. Categories: career, knowledge, business, support."""
  user_id = ctx.deps.state.user_id

  if user_id == "anonymous":
    return "User not logged in - need added to session only."

  try:
    with get_db() as conn:
      with conn.cursor() as cur:
        cur.execute("""
          INSERT INTO needs (user_id, category, need)
          VALUES (%s, %s, %s)
        """, (user_id, category, need))
        conn.commit()

    print(f"💾 Added need '{need}' ({category}) for user {user_id}")
    return f"Need '{need}' saved to database"
  except Exception as e:
    print(f"❌ Database error: {e}")
    return f"Failed to save need: {str(e)}"

@agent.tool
def load_profile_from_db(ctx: RunContext[StateDeps[QuestState]]) -> str:
  """Load the user's profile from the database into the current session."""
  user_id = ctx.deps.state.user_id

  if user_id == "anonymous":
    return "User not logged in - no database profile to load."

  try:
    with get_db() as conn:
      with conn.cursor() as cur:
        # Load profile
        cur.execute("SELECT name, headline FROM profiles WHERE id = %s", (user_id,))
        profile_row = cur.fetchone()

        # Load current state
        cur.execute("SELECT role_title, location, day_rate, availability, work_style FROM current_state WHERE user_id = %s", (user_id,))
        state_row = cur.fetchone()

        # Load skills
        cur.execute("SELECT name FROM skills WHERE user_id = %s", (user_id,))
        skills_rows = cur.fetchall()

        # Update session state
        if profile_row:
          ctx.deps.state.profile.name = profile_row[0]
        if state_row:
          ctx.deps.state.profile.role = state_row[0]
          ctx.deps.state.profile.location = state_row[1]
          ctx.deps.state.profile.day_rate = str(state_row[2]) if state_row[2] else None
          ctx.deps.state.profile.availability = state_row[3]
          ctx.deps.state.profile.work_style = state_row[4]
        if skills_rows:
          ctx.deps.state.profile.skills = [row[0] for row in skills_rows]

    print(f"📂 Loaded profile from database for user {user_id}")
    return f"Profile loaded from database. Name: {ctx.deps.state.profile.name}, Role: {ctx.deps.state.profile.role}"
  except Exception as e:
    print(f"❌ Database error: {e}")
    return f"Failed to load profile: {str(e)}"
