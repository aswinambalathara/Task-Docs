# 📋 TaskDocs

> **Automated Developer Task Tracker & Google Docs MCP Sync**  
> *Track development tasks, record continuous contribution logs, and effortlessly sync sprint progress to Google Docs directly from your AI-assisted IDE workflow or web dashboard.*

---

## ⚡ Overview

**TaskDocs** is a modern developer productivity platform engineered to eliminate context switching between writing code, managing task backlogs, and keeping engineering documentation updated.

By pairing a responsive **Next.js 16 Web Dashboard** with a high-performance **Python FastAPI & FastMCP Server**, TaskDocs enables:
1. **AI coding assistants** (such as **Cursor**, **Claude Desktop**, or **GitHub Copilot**) to capture work logs and sync directly to Google Docs via the Model Context Protocol (MCP).
2. **Web & Non-AI Workflows** to automatically synthesize task history into executive summaries using **Google Gemini 2.0 Flash** before syncing to Google Docs.

```text
┌─────────────────────────────────────────────────────────────┐
│              AI Coding Assistant (MCP Client)               │
│               (Cursor / Claude Desktop)                     │
│   • Inspects code diffs & generates sprint summaries        │
│   • Communicates via MCP JSON-RPC with Clerk Bearer JWT     │
└──────────────────────────────┬──────────────────────────────┘
                               │ MCP HTTP SSE / POST Transport
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Python Backend (FastAPI)                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Clerk Authentication & JWT Verification (PyJWT)    │  │
│  │    Multi-tenant isolation scoped to verified user_id  │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │ 2. MCP Server (FastMCP) & REST API Routes             │  │
│  │    • Tools: add_task, update_task, get_tasks, sync    │  │
│  │    • REST: Task CRUD, OAuth, On-demand AI Summaries   │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │ 3. Storage, AI & Integration Engines                  │  │
│  │    • Gemini 2.0 Flash: Hybrid executive summaries     │  │
│  │    • MongoDB Atlas (Beanie/Motor): Tasks & notes      │  │
│  │    • Google Docs API: Batch document formatting       │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────▲──────────────────────────────┘
                               │ REST API / JWT Bearer
┌──────────────────────────────┴──────────────────────────────┐
│                  Developer Web Dashboard                     │
│            (Next.js 16 + React 19 + Shadcn UI)              │
│   • Visual Kanban & List task management                    │
│   • Smart Sync Modal with AI Summary preview & inline edit  │
│   • Google Docs OAuth & MCP personal access token manager   │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 1. 🖥️ Interactive Web Dashboard
- **Kanban & List Views:** Flexible task organization categorized by `To Do`, `In Progress`, and `Done`.
- **Search & Advanced Filtering:** Instant search across task titles and descriptions, with priority filters (`Low`, `Medium`, `High`, `Urgent`).
- **Contribution History:** Detailed chronological timeline logs showing incremental commits, fixes, and notes attached to each task.
- **Design System:** Custom **Moody Blue** palette, dark/light theme switching with smooth transitions via `next-themes` and `framer-motion`.

### 2. 🤖 Hybrid AI Architecture (Zero Cost Primary + Flash Fallback)
- **Zero Server Inference Overhead for IDE Users:** When using Cursor or Claude, your local assistant reads diffs, structures the payload, and invokes TaskDocs tools directly.
- **Smart Web & Manual Summarization:** When completing tasks via the web dashboard or coding without an AI assistant, an embedded **Google Gemini 2.0 Flash** engine drafts an executive summary from your work notes.
- **Deterministic Fail-Safe:** Clean structured template fallback ensures Google Doc sync never fails even if offline.

### 3. 📄 One-Click Google Docs Sync
- Connect target Google Docs via Google OAuth 2.0.
- Formats structured batch updates including:
  - Executive Sprint Summaries
  - Completed deliverables with contribution bullet points
  - Active in-progress efforts and upcoming backlog items

### 4. 🔒 Multi-Tenant Security & Isolation
- Secured with **Clerk Authentication** (RS256 JWT validation against Clerk JWKS).
- Encrypted storage (AES-256-GCM) for third-party OAuth refresh tokens.
- Strict data isolation ensuring users only query and mutate their own tasks.

---

## 🛠️ MCP Tools Reference (FastMCP)

TaskDocs exposes the following tools to connected AI assistants:

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `add_task` | `title` (str)<br>`description` (str, optional)<br>`priority` (`low` \| `medium` \| `high` \| `urgent`)<br>`status` (`todo` \| `in_progress` \| `done`) | Creates a new task in the developer's backlog. |
| `update_task` | `task_id` (str)<br>`status` (`todo` \| `in_progress` \| `done`)<br>`contribution_notes` (str, optional) | Updates task status and appends timestamped work notes. |
| `get_tasks` | `filter_status` (`todo` \| `in_progress` \| `done` \| `all`) | Fetches tasks for contextual retrieval inside the IDE. |
| `sync_docs` | `executive_summary` (str, optional) | Batches formatted sprint updates to Google Docs (synthesizes via Gemini Flash if omitted). |

---

## 🏗️ Tech Stack

### Frontend (`/frontend`)
- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) with custom `@theme` tokens & Moody Blue palette
- **Animations:** [Framer Motion](https://www.framer.com/motion/) & [Lucide Icons](https://lucide.dev/)
- **State Management:** [Zustand](https://zustand-demo.pmnd.rs/)
- **Authentication:** [Clerk React / Next SDK](https://clerk.com/)

### Backend (`/backend`)
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+, Uvicorn)
- **Validation:** [Pydantic v2](https://docs.pydantic.dev/)
- **MCP Server:** Anthropic Python SDK ([FastMCP](https://github.com/modelcontextprotocol/python-sdk))
- **Database:** [MongoDB Atlas](https://www.mongodb.com/atlas) with [Beanie ODM](https://beanie-odm.dev/) & Motor
- **AI / LLM:** Google GenAI SDK (`google-genai` / Gemini 2.0 Flash)
- **Google Docs API:** `google-api-python-client` & `google-auth`
- **Security:** `PyJWT` (Clerk JWKS validation) & `cryptography` (AES-256-GCM)

---

## 📂 Project Structure

```text
TaskDocs/
├── TaskDocs_PRD.md                 # Full Product Requirements Document (v3.0.0)
├── typography-system.md            # Typography scale & hierarchy guidelines
├── README.md                       # Project documentation
│
├── frontend/                       # Next.js 16 Client Application
│   ├── src/
│   │   ├── app/                    # App Router routes ((auth), settings, page.tsx)
│   │   ├── components/             # Reusable UI & layout components
│   │   ├── store/                  # Zustand client state
│   │   └── lib/                    # API client & utilities
│   ├── package.json
│   └── tsconfig.json
│
└── backend/                        # Python FastAPI Backend & MCP Server
    ├── app/
    │   ├── main.py                 # FastAPI application factory & CORS
    │   ├── core/                   # Security (JWT/AES), Config, Database
    │   ├── models/                 # Beanie ODM models (Task, Integration)
    │   ├── schemas/                # Pydantic request/response schemas
    │   ├── api/                    # REST endpoints (tasks, integrations, ai)
    │   ├── mcp/                    # FastMCP server & SSE transport
    │   └── services/               # Gemini Flash AI & Google Docs batchUpdate
    ├── requirements.txt
    └── .env.example
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** v20 or higher
- **Python:** 3.11 or higher
- **Clerk Account:** For authentication keys
- **MongoDB Atlas Cluster:** (or local MongoDB instance)
- **Google Cloud Console:** OAuth 2.0 credentials (for Docs sync)
- **Google AI Studio Key:** (Optional, for Gemini 2.0 Flash summarization)

---

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Runs at [http://localhost:3000](http://localhost:3000).

---

### 3. Backend Setup

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API & Swagger documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 🔌 Connecting Cursor / Claude Desktop (MCP)

Add TaskDocs to your MCP configuration file (e.g., `~/.cursor/mcp.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "taskdocs": {
      "url": "http://localhost:8000/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_CLERK_JWT_TOKEN"
      }
    }
  }
}
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
