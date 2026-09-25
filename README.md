# 📋 Tethr (TaskDocs)

> **Evidence-Based Developer Contribution Ledger & Google Docs Sync**  
> *Track daily contributions, log measurable outcomes and verifiable proof (PRs, commits, tickets), and automatically sync structured Daily Tables, Weekly Rollups, and Monthly Appraisal Dossiers to Google Docs via AI-assisted IDEs (Antigravity, Cursor, Claude Code, Windsurf) or the web dashboard.*

---

## ⚡ Overview

**Tethr** is a developer-first career impact platform engineered around the core philosophy:

$$\textbf{Contribution} \longrightarrow \textbf{Outcome} \longrightarrow \textbf{Evidence}$$

Instead of treating task tracking as a mere chore or keeping a vague personal work diary, Tethr creates an **audit-proof engineering record** designed for performance reviews, appraisal dossiers, promotion discussions, and resume updates.

### Why Tethr?
- **No More Appraisal Panic:** Stop digging through months of git logs, closed PRs, and Slack threads the night before your performance review.
- **Outcome & Evidence Driven:** Every entry captures not just *what* you worked on, but the *impact* it delivered and direct links to *verifiable proof* (PR URL, commit SHA, Jira ticket, benchmark delta).
- **Automated Google Docs Synchronization:** Structured 10-column daily contribution tables, Saturday weekly summaries, and month-end appraisal dossiers format cleanly into your connected Google Doc.
- **IDE-Native Workflow:** Add, update, and sync tasks directly from Antigravity, Cursor, Claude Code, or Windsurf via the Model Context Protocol (FastMCP).

---

## 🔄 MCP Architecture & Custom Authentication Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AI Coding IDE (MCP Client)                            │
│                 (Antigravity / Cursor / Claude Code / Windsurf)             │
│   • Inspects workspace diffs, commits & branch context                      │
│   • Extracts: Contribution, Outcome, Evidence (PR URL / Commit)             │
│   • Prompts: [ Authenticate ] -> Opens browser to /auth/mcp                 │
│   • Receives auth code via loopback redirect OR manual code copy            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ 1. Redirect to Auth URL
                                       │ 5. Exchanges Code -> Bearer Token
                                       │ 6. JSON-RPC over SSE / POST
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                           Next.js Web Frontend                              │
│   • Custom-Branded MCP Auth Screen (/auth/mcp)                              │
│     - Moody Blue theme matching modern IDE aesthetics                       │
│     - Silent Clerk session validation behind the scenes                     │
│     - Primary: Automatic redirect (window.location.href = redirect_uri)     │
│     - Fallback: One-click [ Copy Code ] card for manual input modals        │
│   • Interactive Dashboard: Impact Table, Kanban View, Career Highlights     │
│   • Cadence Controls & Google Docs Document Picker                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST API Calls & Token Verification
                                       │ Authorization: Bearer <clerk_jwt>
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                          Python FastAPI Backend                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Clerk JWKS Auth Middleware (PyJWT RS256 verification)              │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│  ┌───────────────────────────────────▼───────────────────────────────────┐  │
│  │ 2. Router Layer & FastMCP SSE Transport                               │  │
│  │    • /sse & /api/v1/mcp/token (MCP tools & token exchange)            │  │
│  │    • /api/v1/tasks (CRUD, regex search, impact filters)               │  │
│  │    • /api/v1/integrations/google (OAuth, docs picker, cadence)        │  │
│  │    • /api/v1/ai/summarize (Weekly rollups & Monthly dossiers)         │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│  ┌───────────────────────────────────▼───────────────────────────────────┐  │
│  │ 3. Core Business Services                                             │  │
│  │    • TaskService (CRUD, multi-tenancy, real-time sync trigger)        │  │
│  │    • GoogleDocsService (10-column table builder, rate-limiter)        │  │
│  │    • AIService (Gemini 2.0 Flash + Deterministic fallback)            │  │
│  │    • Cadence Scheduler (Saturday Weekly, Month-End Dossier)           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Custom Frontend MCP Auth Experience (`/auth/mcp`)
When you connect Tethr to an IDE like **Antigravity** or **Cursor**, authentication is handled through a seamless, white-labeled web flow:
1. **Trigger:** You click **`[ Authenticate ]`** inside your IDE's MCP manager.
2. **Custom Screen:** The browser opens `http://localhost:3000/auth/mcp?redirect_uri=...&state=...`.
3. **Silent Identity Verification:** Clerk verifies your session in the background without third-party redirection or branding disruption.
4. **Dual-Completion Flow:**
   - **Automatic Redirect (Hands-Free):** The page automatically redirects back to the IDE's local callback server (`redirect_uri + "?code=" + auth_code`), instantly authenticating the session.
   - **Manual Code Copy (Fallback):** For IDEs featuring a manual code prompt (such as Antigravity's *"Paste auth code"* input box), a prominent card displays the code (`td_mcp_...`) with a one-click **`[ Copy Code ]`** button.

---

## ✨ Core Pillars & Features

### 1. 📋 Three-Tier Google Docs Impact Ledger
Tethr organizes your career documentation into three structured levels in your connected Google Doc:

| Level | Cadence | Structure & Content |
| :--- | :--- | :--- |
| **1. Daily Contribution Log** | Real-time on task done / End-of-Day | Continuous 10-column table: `Date` \| `Project` \| `Area` \| `Contribution` \| `Type` \| `Priority` \| `Requested By` \| `Status` \| `Outcome` \| `Evidence` |
| **2. Weekly Summary** | Automated Saturdays (00:00 UTC) | High-level weekly rollup: Total contributions, Issues Resolved count, Major Improvements count, key business outcomes, and carry-over work. |
| **3. Monthly Appraisal Dossier** | Automated Month-End (23:59 UTC) | Audit-proof performance appraisal dossier: Executive Summary & Shipped Value, Technical Areas Demonstrated, Challenges & Root-Cause Decisions, Key Learnings, and Before/After Metrics. |
| **4. Career Evidence View** | Continuous / On-Demand | Filtered brag-sheet of starred entries (`is_career_highlight: true`) ready to paste into promotion packets or review forms. |

---

### 2. ⏱️ Cadence Scheduling & Anti-Spam Rate-Limiting
- **Real-Time Task Sync:** When tasks are marked `done`, they can immediately append to your Google Doc table without manual intervention (`daily_table_cadence: "realtime"`).
- **Configurable Cadence:** Easily switch between `realtime`, `end_of_day`, or `weekly` table synchronization via `PATCH /api/v1/integrations/google/cadence`.
- **Anti-Spam Rate Limiter:** Automated weekly and monthly scheduled rollups run freely in the background, while manual on-demand summary syncs are strictly capped at **2 times per cycle** to avoid cluttering your document revision history.

---

### 3. 🤖 Hybrid AI Engine (Gemini 2.0 Flash)
- **Zero Cost Primary:** When using Cursor, Claude, or Antigravity, your local assistant inspects code diffs and populates the Contribution $\to$ Outcome $\to$ Evidence fields directly.
- **Executive Summaries & Appraisal Rollups:** Google Gemini 2.0 Flash synthesizes weekly standup notes and monthly appraisal dossiers.
- **Deterministic Fail-Safe:** Built-in template fallback ensures summaries format cleanly even if offline or without an API key.

---

### 4. 🏷️ Standard Developer Task Types
Every contribution in Tethr is classified under one of 8 industry-standard engineering categories:

| Type | Purpose | Example |
| :--- | :--- | :--- |
| `Feature` | Net-new user-facing functionality or core architecture | "Implemented FastMCP SSE transport" |
| `BugFix` | Defect resolution and regression patching | "Fixed token refresh race condition on expired session" |
| `Refactor` | Code health, performance improvements, architectural cleanup | "Migrated task query service to declarative Beanie criteria" |
| `Spike` | Architectural discovery, technical feasibility research | "Evaluated Google Docs batchUpdate table insertion limits" |
| `Test` | Unit, integration, or end-to-end automated test suites | "Added 17 asynchronous pytest integration tests" |
| `Ops` | CI/CD pipelines, Docker, infrastructure, cloud configuration | "Configured GitHub Actions workflow and MongoDB Atlas VPC" |
| `Docs` | Engineering documentation, PRDs, API schemas, guides | "Authored PRD v3.1.0 and MCP connection guidelines" |
| `Review` | Code reviews, architecture reviews, RFC feedback | "Reviewed PR #42 for database indexing strategies" |

---

## 🛠️ FastMCP Tools Reference

Tethr exposes four core developer tools over Server-Sent Events (SSE) and Stdio:

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `add_task` | `title` (str, required)<br>`project` (str = "General")<br>`area` (str, optional)<br>`type` (str = "Feature")<br>`status` (`todo` \| `in_progress` \| `done` \| `blocked` \| `cancelled`)<br>`priority` (`low` \| `medium` \| `high` \| `urgent`)<br>`outcome` (str, optional)<br>`evidence` (str, optional)<br>`requested_by` (str, optional)<br>`is_career_highlight` (bool = False) | Logs a new contribution with outcome and evidence into the ledger. |
| `update_task` | `task_id` (str, required)<br>`status` (str, optional)<br>`outcome` (str, optional)<br>`evidence` (str, optional)<br>`contribution_note` (str, optional)<br>`is_career_highlight` (bool, optional) | Updates task status, attaches proof, or stars as a career highlight. Triggers real-time Google Docs sync when marked `done`. |
| `get_tasks` | `status` (str, optional)<br>`project` (str, optional)<br>`highlight_only` (bool = False)<br>`limit` (int = 20) | Contextual retrieval of backlog items or career highlights for the active project. |
| `sync_docs` | `cadence_type` (`daily_table` \| `weekly_summary` \| `monthly_dossier` \| `all`)<br>`executive_summary` (str, optional)<br>`force` (bool = False) | Synchronizes formatted tables and AI summaries to the configured Google Doc. |

---

## 🌐 REST API Reference

The backend provides a comprehensive, documented REST API at `http://localhost:8000/docs`:

### Tasks (`/api/v1/tasks`)
- `GET /api/v1/tasks` — List tasks with filters (`status`, `project`, `type`, `is_career_highlight`, `has_outcome`, `has_evidence`, `start_date`, `end_date`, `search`).
- `POST /api/v1/tasks` — Create a new task entry.
- `GET /api/v1/tasks/{task_id}` — Get task details.
- `PATCH /api/v1/tasks/{task_id}` — Partial task update (triggers real-time sync if marked `done`).
- `DELETE /api/v1/tasks/{task_id}` — Delete a task.

### Google Integrations (`/api/v1/integrations/google`)
- `GET /api/v1/integrations/google/auth-url` — Get Google OAuth 2.0 authorization URL.
- `POST /api/v1/integrations/google/callback` — Exchange authorization code for encrypted tokens.
- `GET /api/v1/integrations/google/status` — Get integration status and current target document info.
- `POST /api/v1/integrations/google/target-doc` — Set or create target Google Doc.
- `GET /api/v1/integrations/google/cadence` — View sync cadence preferences and cycle usage.
- `PATCH /api/v1/integrations/google/cadence` — Update cadence settings (`realtime` \| `end_of_day` \| `weekly`).
- `POST /api/v1/integrations/google/sync` — Execute manual table or summary synchronization.

### AI Summarization (`/api/v1/ai`)
- `POST /api/v1/ai/summarize` — Generate weekly rollups or monthly appraisal dossiers (`mode: "weekly" | "monthly"`).

### MCP Protocol & Auth (`/api/v1/mcp` & `/sse`)
- `GET /sse` — FastMCP Server-Sent Events transport endpoint.
- `POST /api/v1/mcp/code` — Issue temporary authorization code for IDE.
- `POST /api/v1/mcp/token` — Exchange authorization code for FastMCP Bearer token.
- `GET /.well-known/oauth-authorization-server` — OAuth discovery metadata for IDE auto-detection.

---

## 🏗️ Tech Stack

### Frontend (`/frontend`)
- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) with Moody Blue design tokens
- **Animations:** [Framer Motion](https://www.framer.com/motion/) & [Lucide Icons](https://lucide.dev/)
- **State Management:** [Zustand](https://zustand-demo.pmnd.rs/)
- **Authentication:** [Clerk Next SDK](https://clerk.com/) (Silent session management)

### Backend (`/backend`)
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+, Uvicorn)
- **Validation:** [Pydantic v2](https://docs.pydantic.dev/)
- **MCP Server:** Anthropic Python SDK ([FastMCP](https://github.com/modelcontextprotocol/python-sdk))
- **Database:** [MongoDB Atlas](https://www.mongodb.com/atlas) with [Beanie ODM](https://beanie-odm.dev/) & Motor
- **AI / LLM:** Google GenAI SDK (`google-genai` / Gemini 2.0 Flash)
- **Google Docs API:** `google-api-python-client` & `google-auth`
- **Security:** `PyJWT` (Clerk RS256 JWKS validation) & `cryptography` (AES-256-GCM token encryption)
- **Logging:** [Loguru](https://github.com/Delgan/loguru) multi-target rotated logging

---

## 📂 Project Structure

```text
TaskDocs/
├── TaskDocs_PRD.md                 # Product Requirements Document (v3.1.0 - Personal Developer Edition)
├── Tethr_Product_PRD_v2.md         # Future Multi-Role Commercial SaaS PRD (v4.0.0)
├── documentation structure plan.md # Original design vision for career documentation
├── typography-system.md            # Typography scale & hierarchy guidelines
├── README.md                       # Main repository documentation
│
├── frontend/                       # Next.js 16 Client Application
│   ├── src/
│   │   ├── app/                    # App Router routes ((auth), auth/mcp, settings, page.tsx)
│   │   ├── components/             # Reusable UI, Kanban, and Daily Table components
│   │   ├── store/                  # Zustand client state
│   │   └── lib/                    # API client & utilities
│   ├── .env.example                # Frontend environment template
│   ├── package.json
│   └── tsconfig.json
│
└── backend/                        # Python FastAPI Backend & FastMCP Server
    ├── app/
    │   ├── main.py                 # FastAPI application factory & CORS configuration
    │   ├── core/                   # Security (JWT/AES), Config, Database, Constants
    │   │   ├── config.py           # Pydantic BaseSettings (.env loading)
    │   │   ├── constants.py        # Central DEVELOPER_TASK_TYPES & DeveloperTaskType
    │   │   ├── db.py               # Beanie ODM MongoDB initialization
    │   │   ├── logger.py           # Loguru multi-file logging setup
    │   │   └── security.py         # Clerk JWKS verification & AES-256 cipher
    │   ├── models/                 # Beanie ODM models
    │   │   ├── task.py             # Task model with universal impact fields
    │   │   └── integration.py      # GoogleTokens & SyncCadence models
    │   ├── schemas/                # Pydantic request/response schemas
    │   │   ├── task.py             # TaskCreate, TaskUpdate, TaskResponse
    │   │   ├── sync.py             # SyncCadenceResponse, SyncDocsRequest, TargetDoc
    │   │   └── ai.py               # SummarizeRequest (weekly/monthly), SummarizeResponse
    │   ├── services/               # Pure business logic layer
    │   │   ├── task_service.py     # CRUD, filtering, search, and realtime sync hooks
    │   │   ├── google_docs.py      # OAuth flow, daily table builder, rate-limiting
    │   │   └── ai_service.py       # Gemini 2.0 Flash weekly/monthly appraisal engine
    │   ├── api/                    # REST API Controllers (v1)
    │   │   ├── tasks.py            # /api/v1/tasks endpoints
    │   │   ├── integrations.py     # /api/v1/integrations/google endpoints
    │   │   ├── ai.py               # /api/v1/ai/summarize endpoint
    │   │   └── mcp_auth.py         # /api/v1/mcp/code & /api/v1/mcp/token endpoints
    │   └── mcp/                    # FastMCP Server & SSE Transport
    │       ├── server.py           # Tool definitions (add_task, update_task, etc.)
    │       └── transport.py        # SSE / HTTP transport handlers
    ├── tests/                      # Pytest asynchronous test suite (17 tests)
    │   ├── conftest.py             # Test fixtures & mock auth headers
    │   ├── test_tasks.py           # Tasks API CRUD lifecycle tests
    │   ├── test_task_service.py    # TaskService business logic tests
    │   ├── test_integrations.py    # Google Docs tables & rate-limiting tests
    │   ├── test_ai_service.py      # Weekly & Monthly AI summary tests
    │   ├── test_security.py        # AES-256 encryption roundtrip tests
    │   └── test_logger.py          # Loguru rotation and isolation tests
    ├── .env.example                # Backend environment template
    ├── requirements.txt
    └── pyproject.toml
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** v20.x or higher
- **Python:** 3.11 or higher (Python 3.12 & 3.13 supported)
- **MongoDB:** MongoDB Atlas account or local MongoDB instance (`localhost:27017`)
- **Clerk Account:** Free Clerk application for developer authentication
- **Google Cloud Console:** OAuth 2.0 Client ID with Google Docs API enabled

---

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows (PowerShell):
.\.venv\Scripts\activate
# On macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your MongoDB, Clerk, and Google OAuth credentials

# Start development server
uvicorn app.main:app --reload --port 8000
```

- **Swagger Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

#### Running Backend Tests
```bash
pytest -v
```
*(All 17 integration and unit tests should pass cleanly).*

---

### 3. Frontend Setup

```bash
cd frontend

# Install npm dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY

# Start Next.js development server
npm run dev
```

- **Web Dashboard:** [http://localhost:3000](http://localhost:3000)
- **MCP Auth Screen:** [http://localhost:3000/auth/mcp](http://localhost:3000/auth/mcp)

---

## 🔌 Connecting to AI Coding IDEs

### 1. Antigravity Setup

1. Open your Antigravity IDE configuration file (`~/.gemini/config/mcp_config.json`):
   ```json
   {
     "mcpServers": {
       "taskdocs": {
         "serverUrl": "http://localhost:8000/sse"
       }
     }
   }
   ```
2. In Antigravity's MCP panel, click **`[ Authenticate ]`**.
3. Your browser opens the custom Tethr `/auth/mcp` screen.
4. If the automatic redirect doesn't trigger, click **`[ Copy Code ]`** on the screen and paste the code into Antigravity's **`Paste auth code`** input box, then click **`Submit`**.
5. Antigravity connects and lists the four `taskdocs` tools (`add_task`, `update_task`, `get_tasks`, `sync_docs`).

---

### 2. Cursor Setup

1. In Cursor, open **Settings** (`Ctrl + ,` or `Cmd + ,`) $\to$ **MCP**.
2. Click **`Add New MCP Server`**:
   - **Name:** `TaskDocs`
   - **Type:** `SSE`
   - **URL:** `http://localhost:8000/sse`
3. Click **`[ Authenticate ]`** when prompted. The browser opens the Tethr auth page and completes authentication via loopback redirect.
4. Verify tools are active in Cursor Composer / Chat.

---

### 3. Claude Code / Windsurf Setup

For CLI-based or browser-based AI coding agents supporting MCP over SSE:
```bash
claude mcp add --transport sse taskdocs http://localhost:8000/sse
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
