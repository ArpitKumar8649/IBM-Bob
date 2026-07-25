# 🎬 The Writers' Room

### An AI agent crew that debates, disagrees, and pitches your story — on a spatial canvas.

> **Built for the [IBM AI Builders Challenge — July 2026](https://www.ibm.com/) · Creative Industries track**
> Powered by **IBM Granite** on **watsonx.ai**, built end-to-end with **IBM Bob**.

[![Live Demo](https://img.shields.io/badge/Live-Demo-rose?style=for-the-badge&color=F43F5E)](#)
[![IBM Granite](https://img.shields.io/badge/IBM-Granite-0f62fe?style=for-the-badge)](https://www.ibm.com/granite)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

---

## ✨ What is The Writers' Room?

Most AI writing tools are a chatbot that agrees with you. **The Writers' Room is a room full of specialists who don't.**

You drop story beats onto an infinite spatial canvas. When you ask for the next beat, a crew of **seven AI agents** — an Architect, four specialist critics, a Devil's Advocate, and a Reviser — **debate your story in real time**, streaming their arguments live. The Architect drafts, the critics tear it apart (character, world, continuity, pacing), the Devil's Advocate renders a verdict, and the Reviser rewrites until the room approves. You stay in the director's chair — accepting, rejecting, and arguing back.

Every agent is grounded in your **Story Bible** — a persistent, vector-searchable knowledge base of your characters, locations, lore, and rules — so the world stays consistent no matter how far the story grows.

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Solution](#-solution)
- [Key Features](#-key-features)
- [AI Approach & Architecture](#-ai-approach--architecture)
- [Challenge Theme Alignment](#-challenge-theme-alignment)
- [How IBM Bob Was Used](#-how-ibm-bob-was-used)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Roadmap](#-roadmap)
- [Team](#-team)

---

## 🎯 Problem Statement

Creative work is constrained by four forces the challenge brief names directly:

1. **Time-consuming production workflows** — turning an idea into a finished script takes weeks of drafting and revision.
2. **Technical complexity** — screenplay formatting, structure, and continuity are specialized skills with a steep learning curve.
3. **Limited access to advanced tools** — professional writers' rooms and script coverage are expensive and gatekept.
4. **The imagination-to-execution gap** — most creators have more ideas than they can finish.

Generic AI chatbots make this *worse*, not better: they agree with everything, forget your story's own rules, produce cliché on demand, and give you a wall of text with no structure. They are **content generators**, not **creative partners**.

---

## 💡 Solution

The Writers' Room replaces the yes-man chatbot with a **structured creative collaboration** that mirrors how real stories are developed:

- **A spatial canvas** instead of a document — your story is a living map of beats, characters, locations, and notes, connected by meaningful relationships (causes, transitions, conflicts).
- **A debating agent crew** instead of a single generator — seven specialists argue your story into shape, streaming their reasoning live so you see *why* a beat survives.
- **A persistent Story Bible** instead of amnesia — a vector-indexed knowledge base (RAG) that every agent consults, so Mira's scar and the rules of your world are never contradicted.
- **Industry-standard output** instead of plain text — one click exports a properly formatted screenplay as **PDF, Fountain, Final Draft (.fdx), or plain text**, plus a producer-ready **pitch deck**.

The result: a creator goes from a single premise to a structured, consistent, exportable screenplay — with an AI crew that pushes for the strongest version of their idea.

---

## ✨ Key Features

### 🎭 The Debating Agent Crew
Seven specialized agents, each with a distinct persona and mandate, orchestrated as a LangGraph state machine:

| Agent | Role | Mandate |
|---|---|---|
| 🏛️ **The Architect** | Drafter | Proposes structural beats — turning points, reversals, inciting incidents |
| 🎭 **Character Lead** | Critic | Judges voice, motivation, and arc consistency |
| 🌍 **World Builder** | Critic | Checks setting, lore, and internal rules |
| 🧵 **Continuity Checker** | Critic | Hunts plot holes and timeline contradictions |
| ⚡ **Tension/Pacing** | Critic | Reads stakes, momentum, and emotional rhythm |
| ⚔️ **Devil's Advocate** | Gate | Merges every critique into one verdict (APPROVE / REJECT) |
| ✍️ **The Reviser** | Rewriter | Rewrites the draft to resolve objections without losing its soul |

### 🗺️ Spatial Story Canvas
- Infinite pan/zoom canvas (React Flow) with four node types: **beats, characters, locations, notes**
- **Semantic edges** — label relationships as *causes*, *transitions to*, *features*, or *conflicts*
- AI suggestions arrive as **dashed "proposed" nodes** you accept or reject
- Inline editing, drag-to-reposition, minimap

### 📖 Story Bible (RAG)
- Persistent world knowledge: characters, locations, lore, rules, events
- Each fact is **embedded** and stored in Postgres; agents retrieve the most relevant facts by **cosine similarity** before every generation
- The debate loop and agent chat are both grounded in the Story Bible, so the world stays consistent

### 💬 Multi-Turn Agent Chat
- Open a conversation with any single agent
- The agent replies **in its persona**, grounded in your canvas + Story Bible, and **remembers the whole conversation**
- Argue with the Devil's Advocate, brainstorm with the Architect, stress-test continuity

### 🎬 Director's Cut — Multi-Format Export
Compile the canvas into a screenplay (topologically ordered) and export as:
- **PDF** — industry-standard layout (US Letter, Courier 12pt, proper screenplay margins)
- **Fountain** — plain-text markup for any Fountain tool
- **Final Draft (.fdx)** — native XML for Final Draft software
- **Plain text** — for quick sharing

### 📊 Pitch Deck Generator
Turn your story into a producer-ready pitch: **title, logline, synopsis, genre/tone, comparable titles ("It's X meets Y"), character bios, themes, and the hook** — with copy-to-clipboard and Markdown download.

### 🎨 Tone/Genre Transfer
Rewrite any node in a different style while preserving all plot facts:
- **10 tones**: noir, comedy, horror, epic fantasy, minimalist, literary, thriller, romance, sci-fi, high fantasy
- Streaming rewrite with live output
- Apply directly to the node or copy to clipboard
- Grounded in Story Bible facts to maintain consistency

### 🖼️ AI Scene Images (Qwen/Wan)
Generate cinematic concept art for each scene:
- Granite writes a detailed cinematic prompt per scene (lighting, composition, mood, style)
- Qwen/Wan2.1 (DashScope) renders the image
- Two-step architecture: LLM writes prompt → image model renders
- Graceful fallback: prompt is always surfaced even without an image API key

### 📋 Production Breakdowns
Industry-standard production artifacts:
- **Character breakdown sheets**: casting-ready profiles with appearance, arc, key scenes, voice notes
- **Scene breakdowns + shot lists**: sluglines, cast, props, time of day, suggested shots (WIDE, CLOSE-UP, etc.)
- Copy/download as Markdown for production teams

### 🔐 Auth & Real-Time
- Email/password + Google OAuth (NextAuth), with a no-sign-up **demo mode**
- Real-time collaborative canvas via **Liveblocks** (shared cursors, synced state)

---

## 🧠 AI Approach & Architecture

### The debate loop (LangGraph)

The core innovation is a **fan-out / fan-in debate graph**, not a linear chain:

```
                         ┌─────────────────────────┐
                         │         START           │
                         └───────────┬─────────────┘
                                     ▼
                         ┌─────────────────────────┐
                         │   🏛️  ARCHITECT         │  drafts2–4 beats
                         │   (structured output)   │
                         └───────────┬─────────────┘
                                     │  fan-out (parallel)
        ┌──────────────┬─────────────┼─────────────┬──────────────┐
        ▼              ▼             ▼             ▼              │
   ┌─────────┐   ┌──────────┐  ┌──────────┐  ┌──────────┐        │
   │🎭 Char. │   │🌍 World  │  │🧵 Contin.│  │⚡ Tension│        │
   │  Lead   │   │ Builder  │ │ Checker  │  │ /Pacing  │        │
   └────┬────┘   └────┬─────┘  └────┬─────┘  └────┬─────┘        │
        └──────────────┴─────────────┼─────────────┘              │
                                     ▼  fan-in                    │
                         ┌─────────────────────────┐              │
                         │  ⚔️  DEVIL'S ADVOCATE    │  merge +     │
                         │  (gate: APPROVE/REJECT)  │  verdict     │
                         └───────────┬─────────────┘              │
                          APPROVE ┌──┴──┐ REJECT                  │
                                  ▼     ▼ │
                               ┌─────┐ ┌──────────────┐           │
                               │ END │ │ ✍️  REVISER   │───────────┘
                               └─────┘ │ (rewrite,     │ loop back
                                       │  max 2 rounds)│  to critics
                                       └──────────────┘
```

- **Structured output** — every agent returns validated Pydantic objects (beats, critiques, verdicts), with retry + JSON-repair so a malformed model response never blanks the demo.
- **Streaming** — the loop streams Server-Sent Events (`agent_start`, `critique`, `decision`, `nodes`, `done`) so the UI lights up each agent as it thinks.
- **Conservative gating** — a blocking critique or a split verdict sends the draft back for revision (up to 2 rounds), so weak beats don't slip through.

### Retrieval-Augmented Generation (Story Bible)

```
   writer adds a fact ──► embed (Granite / local fallback) ──► Postgres
                                                                    │
   agent needs context ──► embed query ──► cosine similarity ──► top-K facts
                                                                    │
                                              injected as fenced "canon"
                                              into every agent's prompt
```

The Story Bible is what turns the agents from text generators into **partners that know your world**.

### Prompt-injection defense
All user-supplied content (canvas, facts, chat) is wrapped in delimiters with an explicit instruction hierarchy, so node content can never hijack an agent's role.

### Model
- **IBM Granite** (`ibm/granite-4-h-small`) on **watsonx.ai** for all generation and chat
- **IBM Granite embeddings** for the Story Bible (with a deterministic local fallback for offline dev)
- Backend-agnostic: a single `MODEL_BACKEND` env var switches between watsonx (demo) and local Ollama Granite (free dev)

---

## 🎨 Challenge Theme Alignment

**Theme: Creative Industries — "AI as a creative partner, not a content generator."**

| Brief requirement | How we answer it |
|---|---|
| *AI as a creative partner* | Agents **debate, critique, and revise** — and you can **argue back** in multi-turn chat. They don't just emit text. |
| *Bridge imagination → execution* | One click from a premise to an **industry-formatted screenplay** (PDF/Fountain/FDX) and a **producer pitch deck**. |
| *Storytelling & content creation tools* | The spatial canvas + debate loop is a purpose-built storytelling environment. |
| *Creative ideation & brainstorming* | The Architect proposes branching directions; the pitch deck synthesizes them. |
| *Multimedia / multimodal experiences* | Multi-format export, live streaming debate, real-time collaborative canvas. |
| *Help creators work faster* | From premise to structured, consistent, exportable draft in minutes, not weeks. |

**Required tech:** IBM Bob (primary dev tool) ✅ · AI as core component ✅
**Recommended tech used:** IBM Granite ✅ · watsonx ✅ · Python + Node.js + React + Next.js ✅

---

## 🤖 How IBM Bob Was Used

**IBM Bob was the primary development tool for this project** — used throughout in VS Code across Ask, Plan, Code, and Advanced modes:

- **Codebase exploration** — Bob analyzed the starter structure and generated an implementation plan for the agent architecture.
- **Spec-driven feature building** — the LangGraph debate loop, the streaming SSE layer, and the React Flow canvas were built with Bob generating implementation from specs, then reviewing and refining.
- **Debugging** — Bob systematically diagnosed issues (structured-output parsing, SSE framing, React Flow re-render loops) and proposed targeted fixes.
- **Iteration** — rapid back-and-forth refinement of prompts, schemas, and UI components.

> 📸 *[Add 2–3 screenshots of IBM Bob sessions here: e.g. Bob generating the debate graph, Bob planning the export pipeline, Bob debugging the SSE stream.]*

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **AI / LLM** | IBM Granite (`ibm/granite-4-h-small`) on watsonx.ai |
| **Image generation** | Qwen/Wan2.1 (DashScope) — text-to-image for scene concepts |
| **Agent orchestration** | LangGraph + LangChain (`langchain-ibm`) |
| **Backend** | Python 3.11 · FastAPI · Uvicorn · SSE-Starlette |
| **Frontend** | Next.js 15 (App Router) · React 19 · TypeScript |
| **Canvas** | React Flow (`@xyflow/react` v12) |
| **Real-time** | Liveblocks (collaborative canvas) |
| **Database** | PostgreSQL (Neon) · Prisma ORM |
| **Auth** | NextAuth v5 (credentials + Google OAuth) |
| **RAG / embeddings** | Granite embeddings + cosine similarity (Postgres-backed) |
| **Export** | jsPDF (PDF), Fountain, Final Draft XML |
| **Styling** | Tailwind CSS · Framer Motion |
| **Dev tool** | IBM Bob (primary) · uv (Python) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ and npm
- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- A PostgreSQL database (we use [Neon](https://neon.tech) — free tier)
- IBM Cloud / watsonx.ai credentials (API key + project ID)

### 1. Clone the repo
```bash
git clone https://github.com/ArpitKumar8649/IBM-Bob.git
cd IBM-Bob
```

### 2. Backend (FastAPI)
```bash
cd api
cp ../.env.example ../.env        # then fill in your watsonx keys
uv sync                            # install dependencies
uv run uvicorn app.main:app --reload --port 8000
```
The API runs at `http://localhost:8000` (docs at `/docs`).

### 3. Frontend (Next.js)
```bash
cd web
cp .env.example .env.local         # then fill in your keys
npm install
npx prisma db push                 # create the database tables
npm run dev
```
The app runs at `http://localhost:3000`.

### 4. Try it
1. Open `http://localhost:3000` and click **"Try the demo — no sign-up"**
2. On the canvas, click the **✦ sparkle** on a node to watch the agents debate
3. Open the **Story Bible** to add world facts, then **Talk to an agent**
4. Click **Director's Cut** to export your screenplay, or **Pitch Deck** to generate a pitch

---

## 🔑 Environment Variables

### `api/.env` (backend)
| Variable | Description |
|---|---|
| `MODEL_BACKEND` | `watsonx` (demo) or `ollama` (local dev) |
| `WATSONX_API_KEY` | watsonx.ai API key |
| `WATSONX_PROJECT_ID` | watsonx.ai project ID |
| `WATSONX_URL` | watsonx endpoint (default `https://us-south.ml.cloud.ibm.com`) |
| `WATSONX_MODEL_ID` | Granite model (default `ibm/granite-4-h-small`) |
| `OLLAMA_URL` / `OLLAMA_MODEL_ID` | local Ollama Granite (dev) |
| `CORS_ORIGINS` | comma-separated allowed origins |
| `WRITERS_ROOM_API_KEY` | optional shared API key for the demo backend |

### `web/.env.local` (frontend)
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `NEXTAUTH_URL` | app URL (default `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | session secret (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) |
| `NEXT_PUBLIC_API_BASE_URL` | backend URL the browser calls |
| `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` | Liveblocks public key |
| `WATSONX_EMBED_MODEL_ID` | Granite embedding model (optional) |

---

## 📡 API Reference

### Agent orchestration (FastAPI)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/agent/invoke` | Run the debate loop, return approved nodes (JSON) |
| `POST` | `/agent/stream` | Stream the live debate as SSE events |
| `POST` | `/agent/chat` | Multi-turn chat with a single agent (SSE) |
| `POST` | `/pitch/generate` | Generate a structured pitch deck |
| `POST` | `/transform/tone` | Rewrite a node in a different tone/genre (SSE) |
| `POST` | `/scene-image/generate` | Generate AI scene image from prompt |
| `POST` | `/breakdown/characters` | Generate character breakdown sheets |
| `POST` | `/breakdown/scenes` | Generate scene breakdowns + shot lists |
| `POST` | `/api/generate` | Stream a single Granite completion |
| `GET` | `/api/model-info` | Report the active model/backend |
| `GET` | `/healthz` | Liveness probe |

### Story Bible (Next.js API routes)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/bible/facts` | Add a fact (auto-embedded) |
| `GET` | `/api/bible/facts?roomId=` | List a room's facts |
| `DELETE` | `/api/bible/facts?id=` | Delete a fact |
| `GET` | `/api/bible/search?roomId=&q=&k=` | Semantic search (cosine similarity) |

---

## 📁 Project Structure

```
IBM-Bob/
├── api/                          # FastAPI backend
│   ├── app/
│   │   ├── main.py               # app entrypoint, CORS, routers
│   │   ├── config.py             # settings (pydantic-settings)
│   │   ├── security.py           # API key + rate limiting
│   │   ├── llm/
│   │   │   ├── chat_model.py     # backend-agnostic Granite chat model
│   │   │   └── granite_client.py # raw streaming client
│   │   ├── orchestration/
│   │   │   ├── agent_graph.py    # LangGraph debate loop (fan-out/fan-in)
│   │   │   ├── personas.py       # agent system prompts (7 agents)
│   │   │   ├── context.py        # spatial context + injection guards
│   │   │   └── structured.py     # structured output w/ retry + repair
│   │   └── routes/
│   │       ├── agent.py          # /agent/invoke, /agent/stream
│   │       ├── chat.py           # /agent/chat (multi-turn, SSE)
│ │       ├── pitch.py          # /pitch/generate
│   │       ├── transform.py      # /transform/tone (10 styles, SSE)
│   │       ├── scene_image.py    # /scene-image/generate (Qwen/Wan)
│   │       ├── breakdown.py      # /breakdown/characters, /breakdown/scenes
│   │       └── generate.py       # /api/generate, /api/model-info
│   ├── tests/                    # pytest suite (32 tests)
│   └── pyproject.toml
├── web/                          # Next.js frontend
│   ├── app/
│   │   ├── page.tsx              # landing page (rose theme, vapour text)
│   │   ├── dashboard/page.tsx    # writer's command center
│   │   ├── room/[id]/page.tsx    # the canvas room
│   │   ├── signin/ signup/       # auth pages (rose glass design)
│   │   ├── pricing/page.tsx      # pricing page
│   │ └── api/                  # NextAuth + Story Bible routes
│   ├── components/
│   │   ├── canvas/               # canvas, agent dock, chat drawer, bible panel,
│   │   │                         #   pitch panel, export modal, production panel,
│   │   │                         #   transform panel, story card node, story edge
│   │   ├── landing/              # navbar, footer, vapour accent, demo button
│   │   └── ui/                   # sign-in card, vapour effect, toast
│   ├── lib/                      # api, bible, pitch, export, breakdown, embeddings, prisma
│   ├── prisma/schema.prisma      # data models (User, Room, StoryNode, StoryFact…)
│   └── hooks/                    # useStoryRoom (Liveblocks storage)
├── .env.example
└── README.md
```

---

## 🗺️ Roadmap

**Shipped:**
- ✅ Multi-agent debate loop (7 agents, LangGraph)
- ✅ Spatial story canvas (React Flow, 4 node types, semantic edges)
- ✅ Story Bible (RAG with embeddings + cosine similarity)
- ✅ Multi-turn agent chat (persona-grounded, conversation memory)
- ✅ Multi-format export (PDF, Fountain, Final Draft, plain text)
- ✅ Pitch deck generator (logline, synopsis, comps, character bios)
- ✅ Tone/genre transfer (10 styles, streaming rewrite)
- ✅ AI scene images (Granite prompt → Qwen/Wan render)
- ✅ Production breakdowns (character sheets, scene/shot lists)
- ✅ Auth (email/password + Google OAuth + demo mode)
- ✅ Real-time collaborative canvas (Liveblocks)

**Next (Feasibility & Impact):**
- Docker Compose (one-command local run)
- CI/CD (GitHub Actions: lint + test + build)
- Deployment (Vercel frontend + Render/Railway backend)
- Demo video (≤3 min walkthrough)
- Mobile-responsive canvas
- PWA/offline support

**Post-challenge:**
- Version history (canvas snapshots)
- Collaboration suite (comments, approvals, @mentions)
- Integrations (Notion, Google Docs, Slack)
- Billing (Stripe)
- Accessibility (WCAG 2.1 AA)
- i18n (multi-language UI)
- Template marketplace (community-shared story structures)

---

## 👥 Team

**The Writers' Room** — built for the IBM AI Builders Challenge (July 2026).

- *[Your name]* — *[role]*
- *[Teammate]* — *[role]*

---

## 📄 License

[MIT](./LICENSE) © 2026 The Writers' Room.

---

<div align="center">

**Made with 🤖 IBM Bob · Powered by IBM Granite on watsonx.ai**

*From a single premise to a structured, consistent, exportable screenplay — with an AI crew that fights for your story.*

</div>
