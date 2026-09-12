# 📋 TaskDocs

> **Automated Developer Task Tracker & Google Docs MCP Sync**  
> *Track development tasks, record continuous contribution logs, and effortlessly sync sprint progress to Google Docs directly from your AI-assisted IDE workflow.*

---

## ⚡ Overview

**TaskDocs** is a full-stack developer productivity platform engineered to eliminate context switching between writing code, managing task backlogs, and keeping engineering documentation updated.

By pairing a modern **Next.js Web Dashboard** with a **Deterministic Model Context Protocol (MCP) Server**, TaskDocs allows AI coding assistants (such as **Cursor**, **Claude Desktop**, or **GitHub Copilot**) to capture work logs and sync directly to Google Docs without leaving your IDE.

```
┌─────────────────────────────────────────────────────────────┐
│              AI Coding Assistant (MCP Client)               │
│               (Cursor / Claude Desktop)                     │
│   • Inspects code diffs & generates sprint summaries        │
│   • Communicates via MCP JSON-RPC with Clerk Bearer JWT     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP POST / SSE Transport
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    TaskDocs Application                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Clerk Authentication & JWT Verification            │  │
│  │    Multi-tenant isolation scoped to verified userId   │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │ 2. Deterministic MCP Server Layer                     │  │
│  │    Tools: add_task | update_task | get_tasks | sync   │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │ 3. Storage & Integration Engine                       │  │
│  │    • MongoDB Atlas: Tasks, notes & status records     │  │
│  │    • Google Docs API: Batch document formatting       │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────▲──────────────────────────────┘
                               │ Session Cookie Auth
┌──────────────────────────────┴──────────────────────────────┐
│                  Developer Web Dashboard                     │
│   • Visual Kanban & List task management                    │
│   • Contribution timelines, filters & search                │
│   • Google Docs OAuth & MCP personal access token manager   │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 1. 🖥️ Interactive Web Dashboard
- **Kanban & List Views:** Flexible task organization categorized by `To Do`, `In Progress`, and `Done`.
- **Search & Advanced Filtering:** Instant search across task titles, descriptions, and tags, with priority filters (`Low`, `Medium`, `High`, `Urgent`).
- **Contribution History:** Detailed chronological timeline logs showing incremental commits, fixes, and notes attached to each task.
- **Design System:** Custom **Moody Blue** palette, dark/light theme switching with smooth transitions via `next-themes` and `framer-motion`.

### 2. 🤖 Zero-LLM Backend MCP Server
- **Zero Inferencing Overhead:** The backend executes **no expensive LLM calls**. Your local AI assistant reads your diffs, structures the payload, and invokes TaskDocs deterministic tools.
- **Instant IDE Integration:** Native support for any Model Context Protocol client over SSE or stdio/HTTP.
- **Sub-3s Sync Times:** Fast updates to your backlog and remote documents.

### 3. 📄 One-Click Google Docs Sync
- Connect target Google Docs via Google OAuth 2.0.
- Formats structured batch updates including:
  - Executive Sprint Summaries
  - Completed deliverables with contribution bullet points
  - Active in-progress efforts and upcoming backlog items

### 4. 🔒 Multi-Tenant Security & Isolation
- Secured with **Clerk Authentication** (RS256 JWT validation against JWKS).
- Encrypted storage (AES-256-GCM) for third-party OAuth refresh tokens.
- Strict data isolation ensuring users only query and mutate their own tasks.

---

## 🛠️ MCP Tools Reference

TaskDocs exposes the following tools to connected AI assistants:

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `add_task` | `title` (string)<br>`description` (string, optional)<br>`status` (`todo` \| `in_progress` \| `done`) | Creates a new task in the developer's backlog. |
| `update_task` | `taskId` (string)<br>`status` (`todo` \| `in_progress` \| `done`)<br>`contributionNotes` (string, optional) | Updates task status and appends timestamped work notes. |
| `get_tasks` | `filterStatus` (`todo` \| `in_progress` \| `done` \| `all`) | Fetches tasks for contextual retrieval inside the IDE. |
| `sync_docs` | `executiveSummary` (string) | Batches formatted sprint updates to the configured Google Doc. |

---

## 🏗️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) with custom `@theme` tokens
- **Animations:** [Framer Motion](https://www.framer.com/motion/) & [Lucide Icons](https://lucide.dev/)
- **State Management:** [Zustand](https://zustand-demo.pmnd.rs/)
- **Authentication:** [Clerk](https://clerk.com/)
- **Database:** [MongoDB Atlas](https://www.mongodb.com/atlas) (Document storage)
- **MCP SDK:** [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol)
- **Document API:** [`googleapis`](https://github.com/googleapis/google-api-nodejs-client)

---

## 📂 Project Structure

```text
TaskDocs/
├── TaskDocs_PRD.md             # Full Product Requirements Document
├── typography-system.md        # Typography scale & hierarchy guidelines
├── README.md                   # Project documentation
└── frontend/                   # Next.js Full-Stack Application
    ├── src/
    │   ├── app/
    │   │   ├── (auth)/         # Clerk Sign-In & Sign-Up routes
    │   │   ├── settings/       # MCP Token & Google Docs connection UI
    │   │   ├── layout.tsx      # Root layout & theme providers
    │   │   ├── page.tsx        # Task Kanban / List dashboard
    │   │   └── globals.css     # Tailwind v4 theme & Moody Blue tokens
    │   ├── components/
    │   │   ├── layout/         # Top navigation bar
    │   │   ├── ui/             # Reusable UI primitives (Card, Badge, Button, etc.)
    │   │   └── task-dialog.tsx # Task creation & editing modal
    │   ├── store/
    │   │   └── useTaskStore.ts # Client state for tasks & filters
    │   └── lib/
    │       └── utils.ts        # Styling & class helper utilities
    ├── package.json
    └── tsconfig.json
```

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js:** v18.18.0 or higher
- **Package Manager:** `npm`, `pnpm`, or `yarn`
- **Clerk Account:** For authentication keys
- **MongoDB Atlas Cluster:** (or local MongoDB instance)

### 2. Installation

Clone the repository and install dependencies inside the `frontend` workspace:

```bash
git clone https://github.com/your-username/TaskDocs.git
cd TaskDocs/frontend
npm install
```

### 3. Environment Configuration

Create a `.env.local` file inside the `frontend/` directory:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Database
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/taskdocs?retryWrites=true&w=majority

# Google OAuth (for Google Docs Sync)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback

# Token Encryption (32-character secret for AES-256-GCM)
ENCRYPTION_SECRET=your_32_character_encryption_key_here
```

### 4. Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to access the dashboard.

---

## 🔌 Connecting Cursor / Claude Desktop (MCP)

To enable your AI assistant to manage tasks and push updates automatically, add TaskDocs to your MCP configuration file (e.g. `~/.cursor/mcp.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "taskdocs": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sse",
        "http://localhost:3000/api/mcp"
      ],
      "env": {
        "TASKDOCS_BEARER_TOKEN": "your_clerk_user_jwt_token_here"
      }
    }
  }
}
```

> **Tip:** You can obtain your personal MCP Bearer Token and test your Google Doc connection directly on the **/settings** page of the web application.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
