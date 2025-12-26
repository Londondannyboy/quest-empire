from textwrap import dedent
import os
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
# Zep Memory Client
# =====
zep = AsyncZep(api_key=os.environ.get("ZEP_API_KEY"))

# =====
# State
# =====
class ProverbsState(BaseModel):
  """List of the proverbs being written."""
  proverbs: list[str] = Field(
    default_factory=list,
    description='The list of already written proverbs',
  )

# =====
# Agent
# =====
agent = Agent(
  model = OpenAIResponsesModel('gpt-4.1-mini'),
  deps_type=StateDeps[ProverbsState],
  system_prompt=dedent("""
    You are a helpful assistant that helps manage and discuss proverbs.
    
    The user has a list of proverbs that you can help them manage.
    You have tools available to add, set, or retrieve proverbs from the list.
    
    When discussing proverbs, ALWAYS use the get_proverbs tool to see the current list before
    mentioning, updating, or discussing proverbs with the user.
  """).strip()
)

# =====
# Tools
# =====
@agent.tool
def get_proverbs(ctx: RunContext[StateDeps[ProverbsState]]) -> list[str]:
  """Get the current list of proverbs."""
  print(f"📖 Getting proverbs: {ctx.deps.state.proverbs}")
  return ctx.deps.state.proverbs

@agent.tool
async def add_proverbs(ctx: RunContext[StateDeps[ProverbsState]], proverbs: list[str]) -> StateSnapshotEvent:
  ctx.deps.state.proverbs.extend(proverbs)
  return StateSnapshotEvent(
    type=EventType.STATE_SNAPSHOT,
    snapshot=ctx.deps.state,
  )

@agent.tool
async def set_proverbs(ctx: RunContext[StateDeps[ProverbsState]], proverbs: list[str]) -> StateSnapshotEvent:
  ctx.deps.state.proverbs = proverbs
  return StateSnapshotEvent(
    type=EventType.STATE_SNAPSHOT,
    snapshot=ctx.deps.state,
  )


@agent.tool
def get_weather(_: RunContext[StateDeps[ProverbsState]], location: str) -> str:
  """Get the weather for a given location. Ensure location is fully spelled out."""
  return f"The weather in {location} is sunny."

# =====
# Zep Memory Tools
# =====
@agent.tool
async def save_to_memory(_: RunContext[StateDeps[ProverbsState]], session_id: str, content: str, role: str = "user") -> str:
  """Save a message to Zep memory for the given session. Use this to remember important information about the user."""
  try:
    await zep.memory.add(
      session_id=session_id,
      messages=[Message(role_type=role, content=content)]
    )
    print(f"💾 Saved to memory for session {session_id}: {content[:50]}...")
    return f"Saved to memory: {content[:50]}..."
  except Exception as e:
    print(f"❌ Error saving to memory: {e}")
    return f"Error saving to memory: {str(e)}"

@agent.tool
async def get_memory(_: RunContext[StateDeps[ProverbsState]], session_id: str) -> str:
  """Retrieve memory context from Zep for the given session. Use this to recall what you know about the user."""
  try:
    memory = await zep.memory.get(session_id=session_id)
    if memory and memory.context:
      print(f"🧠 Retrieved memory for session {session_id}")
      return memory.context
    return "No memory found for this session."
  except Exception as e:
    print(f"❌ Error retrieving memory: {e}")
    return f"No memory found (session may be new): {str(e)}"

@agent.tool
async def search_memory(_: RunContext[StateDeps[ProverbsState]], session_id: str, query: str) -> str:
  """Search Zep memory for relevant information based on a query."""
  try:
    results = await zep.memory.search(session_id=session_id, text=query, limit=5)
    if results and results.results:
      context = "\n".join([r.message.content for r in results.results if r.message])
      print(f"🔍 Found {len(results.results)} memory results for query: {query}")
      return context
    return "No relevant memories found."
  except Exception as e:
    print(f"❌ Error searching memory: {e}")
    return f"Error searching memory: {str(e)}"
