# Quest Empire - Moonshot Restart Plan

## Current State (Build Passing)

**GitHub:** https://github.com/Londondannyboy/quest-empire
**Local:** `/Users/dankeegan/quest-empire-fresh`

### What's Built & Working

#### 1. Core Infrastructure
- [x] CopilotKit + PydanticAI + AG-UI template
- [x] Next.js 16 frontend with Turbopack
- [x] Python FastAPI backend with `agent.to_ag_ui()`
- [x] Build passes (`npm run build` succeeds)

#### 2. Backend Agent (`agent/src/agent.py`)
- [x] **Quest Agent** with system prompt for career assistance
- [x] **QuestState** - user_id, profile, jobs_shown, consents, stage
- [x] **ProfileData** - name, role, company, location, skills, day_rate, availability, work_style

**Agent Tools:**
| Tool | Status | Description |
|------|--------|-------------|
| `get_profile` | ✅ | Get current profile |
| `update_profile` | ✅ | Update profile fields |
| `add_to_graph` | ✅ | Add fact to Zep graph |
| `search_graph` | ✅ | Search Zep knowledge graph |
| `get_user_context` | ✅ | Get Zep user summary |
| `set_consent` | ✅ | Record user consent |
| `check_consent` | ✅ | Check consent status |
| `search_jobs` | ⚠️ | Placeholder - needs DataForSEO |
| `set_stage` | ✅ | Update journey stage |
| `save_profile_to_db` | ✅ | Persist to Neon |
| `add_skill_to_db` | ✅ | Add skill to Neon |
| `add_need_to_db` | ✅ | Add need to Neon |
| `load_profile_from_db` | ✅ | Load from Neon |

#### 3. Frontend (`src/app/page.tsx`)
- [x] **ZepGraph** - d3-force visualization with 4 clusters
- [x] **VoiceOrb** - Hume EVI integration
- [x] **ProfileCard** - Shows extracted profile data
- [x] **ConsentCard** - HITL for LinkedIn/Human Review
- [x] **CopilotSidebar** - Chat interface

**Hooks Used:**
- `useCoAgent` - Shared state with agent
- `useCopilotChat` - Send messages programmatically
- `useHumanInTheLoop` - HITL confirmations
- `useRenderToolCall` - Generative UI
- `useFrontendTool` - Frontend-only tools

#### 4. Database (Neon PostgreSQL)
**Tables Created:**
| Table | Purpose |
|-------|---------|
| `auth_users` | User authentication |
| `sessions` | Session management |
| `profiles` | Core profile data |
| `current_state` | Role, location, day rate |
| `skills` | Skills with proficiency |
| `role_history` | Work experience |
| `needs` | Career/knowledge/business/support needs |
| `trinity` | Quest, Service, Pledge |
| `consents` | GDPR and feature consents |
| `companies` | Company metadata |
| `graph_nodes` | Knowledge graph visualization |
| `saved_jobs` | Saved job listings |

#### 5. API Routes
| Route | Method | Status |
|-------|--------|--------|
| `/api/copilotkit` | POST | ✅ AG-UI endpoint |
| `/api/auth/register` | POST | ✅ |
| `/api/auth/login` | POST | ✅ |
| `/api/auth/logout` | POST | ✅ |
| `/api/auth/me` | GET | ✅ |
| `/api/profile` | GET/PATCH/POST | ✅ |
| `/api/voice/access-token` | POST | ✅ |

#### 6. External Services Connected
| Service | Status | Purpose |
|---------|--------|---------|
| OpenAI | ✅ | GPT-4o-mini for agent |
| Neon | ✅ | PostgreSQL database |
| Zep | ✅ | Knowledge graph memory |
| Hume | ✅ | Voice (EVI) |
| DataForSEO | ⚠️ MCP available | Job search SERP |

---

## What Needs Fixing

### 1. Voice → Chat Sync Issue
The Hume transcript isn't reliably appearing in CopilotKit chat.
- Fixed `appendMessage` to use `TextMessage` class
- Fixed duplicate message issue with `processedCountRef`
- **Need to test**: Voice input → CopilotKit → Agent → Response

### 2. Graph Not Populating
ZepGraph shows clusters but no nodes when profile updates.
- State is updating (logs show `✅ Updated profile`)
- Graph nodes derived from `state.profile`
- **Need to verify**: State snapshot flowing to frontend

### 3. User Session Not Persisting
Anonymous users can use the app but data isn't saved.
- Auth routes exist but not integrated into frontend
- Need login/register UI
- Need to pass `user_id` from session to agent state

---

## Moonshot Roadmap

### Phase 1: Fix Core Flow (Priority)
1. **Test voice → agent flow end-to-end**
   - Speak "I'm looking for CMO roles in London"
   - Verify transcript appears in chat
   - Verify agent extracts and updates profile
   - Verify graph shows new nodes

2. **Add auth UI to frontend**
   - Login/Register modal or page
   - Pass authenticated user_id to QuestState
   - Load profile from DB on login

3. **Fix graph real-time updates**
   - Debug state snapshot events
   - Ensure `stateToGraphNodes` runs when state changes

### Phase 2: Real Job Search
1. **Integrate DataForSEO MCP**
   ```
   mcp__dataforseo__serp_organic_live_advanced
   ```
   - Replace placeholder `search_jobs` tool
   - Search Indeed, LinkedIn, Totaljobs
   - Parse and display real job results

2. **Job Cards UI**
   - Display job results in chat (Generative UI)
   - Save/Apply/Dismiss actions
   - Track in `saved_jobs` table

### Phase 3: LinkedIn Enrichment
1. **LinkedIn Consent Flow**
   - `useHumanInTheLoop` already set up for `request_linkedin_consent`
   - Need to implement actual scraping tool
   - Use DataForSEO or Proxycurl API

2. **Auto-populate profile**
   - Extract name, headline, experience, skills
   - Show confirmation UI before saving
   - Update Zep graph with enriched data

### Phase 4: Trinity Coach (Premium)
1. **Separate Trinity Agent**
   ```python
   trinity_coach = Agent(
     model='claude-3-5-haiku',
     system_prompt="Deep coaching for Quest, Service, Pledge..."
   )
   ```

2. **Full-screen coaching mode**
   - Different UI, no distractions
   - Probing questions, emotional intelligence
   - Save Trinity results to database

### Phase 5: Human Review (Admin Dashboard)
1. **Admin routes** (`/admin/*`)
   - List users pending review
   - View user's Zep graph
   - Send feedback

2. **Consent flow**
   - Already have `request_human_review` HITL
   - Need to store in `consents` table
   - Notify admin of new review requests

### Phase 6: Production Deployment
1. **Vercel deployment**
   - Python functions via `vercel.json`
   - Environment variables
   - Custom domain (fractional.quest)

2. **OR Railway for Python backend**
   - If Vercel timeout issues occur
   - FastAPI + Uvicorn on Railway
   - Frontend stays on Vercel

---

## Environment Variables Needed

```env
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Neon PostgreSQL
DATABASE_URL=postgresql://...

# Zep Memory
ZEP_API_KEY=z_...

# Hume Voice
HUME_API_KEY=...
HUME_SECRET_KEY=...
NEXT_PUBLIC_HUME_CONFIG_ID=...

# DataForSEO (for job search)
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
```

---

## Quick Start Commands

```bash
# Navigate to project
cd /Users/dankeegan/quest-empire-fresh

# Install dependencies
npm install

# Start dev servers (frontend + agent)
npm run dev

# Frontend: http://localhost:3000
# Agent: http://localhost:8000

# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `agent/src/agent.py` | PydanticAI Quest agent |
| `agent/src/main.py` | FastAPI AG-UI endpoint |
| `src/app/page.tsx` | Main UI with graph + voice |
| `src/components/zep-graph.tsx` | d3 force graph |
| `src/components/voice-orb.tsx` | Hume voice widget |
| `src/components/profile.tsx` | Profile display card |
| `src/components/consent.tsx` | HITL consent UI |
| `src/lib/types.ts` | TypeScript types |
| `src/app/api/auth/*` | Auth endpoints |
| `src/app/api/profile/route.ts` | Profile CRUD |

---

## Master Plan Reference

See: `/Users/dankeegan/.claude/plans/dazzling-sniffing-puffin.md`

Contains:
- Full architecture diagram
- 4-layer user repo schema (Identity, Current, Trinity, Needs)
- Onboarding flow (Quick Win → Enrichment → Trinity)
- UI mockups (voice orb as central graph node)
- Implementation phases with tasks

---

## Next Session: Start Here

1. **Read this file** for context
2. **Run `npm run dev`** to start servers
3. **Test the flow**: Type "I'm a CMO in London" in chat
4. **Check**: Does profile update? Does graph show nodes?
5. **If not working**: Debug state flow from agent → frontend
6. **If working**: Move to Phase 2 (real job search)

Good luck! 🚀
