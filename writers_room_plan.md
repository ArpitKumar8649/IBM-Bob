{
  "summary": "Create a deep, detailed implementation plan for the first two phases of the Writer's Room project.",
  "agentCount": 3,
  "logs": [
    "Formatting final plan..."
  ],
  "result": "# Writer's Room - Implementation Plan (Phases 1 & 2)\n\n## Project Overview\n# Project Overview: Writer's Room\n\nWelcome to **Writer's Room**. As the lead architect, I have designed this project to push the absolute boundaries of what is possible with generative AI and human-computer interaction. With our elite team of 4 unrestricted developers, we are bypassing standard chat interfaces to build something truly revolutionary for the AI Builders July Challenge.\n\n## 1. The Core Concept\n\n**Writer's Room** is a multiplayer, multi-agent spatial workspace that perfectly replicates the dynamic, collaborative environment of a professional television writer's room or a top-tier publishing house. It empowers human creators (the \"Showrunners\") to co-create complex narratives, screenplays, novels, and sprawling fictional universes alongside a dedicated team of specialized AI agents.\n\nInstead of a linear text editor or a simple chatbot, Writer's Room operates on an **infinite spatial canvas**. Users and agents collaboratively map out character arcs, story beats, dialogue snippets, and world-building lore as interconnected nodes, organically generating long-form content from these spatial relationships.\n\n## 2. What Makes It Stand Out\n\nWhat makes Writer's Room highly impressive is its shift from \"AI as a tool\" to \"AI as a collaborative team.\" We are implementing the following groundbreaking features:\n\n*   **Specialized Multi-Agent Ecosystem:** The system orchestrates several distinct AI personas working in tandem:\n    *   *The Architect:* Focuses on pacing, structural integrity (e.g., Save the Cat, Hero's Journey), and overarching plot arcs.\n    *   *The Character Lead:* Maintains the \"bible,\" ensuring character voice consistency, tracking emotional arcs, and validating motivations.\n    *   *The World Builder:* Manages lore, geography, rules of the universe, and timelines.\n    *   *The Devil's Advocate:* actively hunts for plot holes, clichés, and inconsistencies, challenging both the user and the other agents.\n*   **Autonomous Agent-to-Agent Debate:** When the Showrunner poses a narrative problem (e.g., \"How do we get the protagonist out of this locked room without magic?\"), the agents don't just give one answer. They debate each other in real-time, critiquing each other's ideas before presenting a synthesized, high-quality solution to the user.\n*   **Spatial Memory & Continuous Context (RAG):** The canvas itself acts as the system's memory. As the universe grows, a robust Retrieval-Augmented Generation (RAG) system ensures agents perfectly recall a minor detail established in Chapter 1 when drafting the climax in Chapter 50. \n*   **Real-Time Multiplayer with AI:** Powered by CRDTs, multiple human writers and multiple AI agents can type, draw, link nodes, and generate text simultaneously on the same canvas. You will literally see the AI's cursors moving around the board as they \"think\" and organize information.\n\n## 3. The Tech Stack\n\nTo support this unconstrained, high-performance vision, we are utilizing a cutting-edge, highly scalable stack:\n\n**Frontend (The Spatial Workspace):**\n*   **Framework:** Next.js (React) for highly optimized, interactive UIs.\n*   **Canvas Engine:** `tldraw` or `React Flow` to handle the infinite canvas, node connections, and complex spatial relationships.\n*   **Styling & Animation:** Tailwind CSS and Framer Motion for a fluid, cinematic, and deeply immersive user experience.\n*   **Real-Time Sync:** Liveblocks or Yjs (CRDTs) over WebSockets to instantly sync state, cursors, and edits between humans and agents.\n\n**Backend & AI Orchestration (The Brains):**\n*   **Primary LLM:** Anthropic's Claude 3.5 Sonnet. Chosen for its industry-leading nuance in creative writing, superior reasoning, and massive context window for holding entire story bibles.\n*   **Multi-Agent Orchestration:** LangGraph (or a custom state-machine orchestrator) to manage the complex, asynchronous workflows, memory sharing, and debate loops between the AI personas.\n*   **Database & Vector Store:** Supabase (PostgreSQL + `pgvector`). Handles standard relational data (users, projects, canvas state) alongside vector embeddings for lightning-fast semantic search over the ever-expanding story lore.\n*   **State & Queuing:** Redis (via Upstash) to manage rate limiting, cache agent responses, and handle message queues for long-running generation tasks.\n\n**Infrastructure:**\n*   **Hosting:** Vercel for the Next.js frontend and edge functions.\n*   **Agent Workers:** AWS ECS or Render for long-running, compute-heavy agent workflows that exceed standard serverless execution limits.\n\nThis stack gives us the perfect balance of real-time responsiveness on the frontend and heavy-duty, stateful AI orchestration on the backend. We are ready to build the future of storytelling.\n\n---\n\n## Phase 1 Detailed Implementation Plan\nHere is a deep, highly detailed implementation plan for Phase 1 of **Writer's Room**. \n\nPhase 1 will focus on laying the massive technical foundation required to support real-time CRDT-based multi-user/multi-agent collaboration, the multi-agent LangGraph orchestration, and the spatial canvas interface.\n\n---\n\n# Writer's Room: Phase 1 Implementation Plan\n\n## 1. Core Architecture & Infrastructure\n\nTo handle the extreme demands of real-time spatial sync mixed with long-running, asynchronous LLM generation, we will decouple the real-time canvas state from the AI orchestration layer.\n\n*   **Real-Time State Engine:** **Liveblocks** will handle the WebSockets and CRDTs. It integrates seamlessly with React and provides presence (cursors) and persistent document state.\n*   **Frontend:** **Next.js (App Router)** with **React Flow**. React Flow is chosen over tldraw for Phase 1 because its strict node-and-edge architecture is highly structured, making it easier for AI agents to traverse and manipulate programmatically via JSON representations.\n*   **Agent Orchestration Engine:** A separate background worker running **LangGraph** via a fast Python backend (FastAPI) deployed on AWS ECS or Render. This avoids Vercel's serverless timeout limits for multi-stage AI debates.\n*   **Database & Vector Store:** **Supabase**. We will use webhooks from Liveblocks to sync the CRDT state back to Supabase, which triggers background jobs to chunk and embed the canvas nodes into `pgvector` for the RAG pipeline.\n\n---\n\n## 2. Database Schema (Supabase PostgreSQL)\n\nWe require a robust relational schema combined with vector storage.\n\n```sql\n-- Enable pgvector\nCREATE EXTENSION IF NOT EXISTS vector;\n\n-- Projects (Workspaces)\nCREATE TABLE workspaces (\n    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n    name TEXT NOT NULL,\n    owner_id UUID REFERENCES auth.users(id),\n    created_at TIMESTAMPTZ DEFAULT NOW(),\n    updated_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n-- Nodes (Mirrors the Liveblocks CRDT state for RAG & relational querying)\nCREATE TABLE nodes (\n    id TEXT PRIMARY KEY, -- Matches Liveblocks/React Flow ID\n    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,\n    type VARCHAR(50) NOT NULL, -- 'character', 'plot_beat', 'location', 'chapter'\n    data JSONB NOT NULL, -- The actual text/content and metadata\n    position_x FLOAT,\n    position_y FLOAT,\n    created_at TIMESTAMPTZ DEFAULT NOW(),\n    updated_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n-- Edges (Relationships between nodes)\nCREATE TABLE edges (\n    id TEXT PRIMARY KEY,\n    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,\n    source_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,\n    target_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,\n    label TEXT\n);\n\n-- Vector Embeddings for RAG (Allows agents to semantically search the universe)\nCREATE TABLE node_embeddings (\n    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n    node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,\n    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,\n    content_chunk TEXT NOT NULL, -- The text chunk that was embedded\n    embedding vector(1536), -- Assuming OpenAI text-embedding-3-small or equivalent\n    created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n-- Indexes for performance\nCREATE INDEX ON node_embeddings USING hnsw (embedding vector_cosine_ops);\nCREATE INDEX idx_nodes_workspace ON nodes(workspace_id);\n```\n\n---\n\n## 3. LangGraph Multi-Agent Orchestration (The Brains)\n\nThe AI backend will use LangGraph to create a cyclical, stateful execution graph. \n\n### LangGraph State Schema\n```python\nclass GraphState(TypedDict):\n    workspace_id: str\n    user_request: str\n    current_canvas_state: dict # Serialized subgraph relevant to the request\n    retrieved_context: List[Document] # Vector search results\n    architect_draft: str\n    character_lead_notes: str\n    world_builder_notes: str\n    devils_advocate_critique: str\n    debate_round: int\n    final_output: dict # JSON patch containing new nodes/edges to push to Liveblocks\n```\n\n### The AI Workflow Pipeline\n1.  **Ingestion:** User @-mentions an agent or creates an \"Idea Node\" on the canvas. Liveblocks fires a webhook to the LangGraph worker.\n2.  **Context Retrieval (RAG):** The system uses `pgvector` to pull visually adjacent nodes (spatial memory) and semantically similar nodes (lore memory) and loads them into the `current_canvas_state`.\n3.  **Parallel Agent Generation:** The Architect, Character Lead, and World Builder execute in parallel (via Claude 3.5 Sonnet), each evaluating the prompt through their specific system instructions.\n4.  **Debate Node (Devil's Advocate):** A specialized Claude prompt reviews the combined outputs, looking for lore contradictions, character breaks, or structural flaws. If it fails, the `debate_round` increments, and feedback is routed back to the agents for revision.\n5.  **Tool Execution:** Once consensus is reached, the Synthesizer outputs a JSON patch. The backend uses the Liveblocks REST API to inject new nodes, edges, and text directly onto the real-time canvas, mimicking human typing/creation.\n\n---\n\n## 4. Frontend Component Structure (Next.js + React Flow)\n\nThe UI needs to be performant and deeply immersive.\n\n```\nsrc/\n├── components/\n│   ├── canvas/\n│   │   ├── WriterCanvas.tsx       # Main React Flow wrapper, wrapped in Liveblocks RoomProvider\n│   │   ├── nodes/                 # Custom React Flow Node Types\n│   │   │   ├── PlotBeatNode.tsx   # Rich text node with branching logic\n│   │   │   ├── CharacterNode.tsx  # Includes avatar, traits, and relationship edges\n│   │   │   ├── AgentThinkingNode.tsx # Glowing/animated node shown when agents are debating\n│   │   ├── edges/\n│   │   │   ├── SemanticEdge.tsx   # Animated edge showing data flow\n│   ├── ui/\n│   │   ├── MultiplayerCursors.tsx # Renders SVG cursors for humans AND agents\n│   │   ├── AgentActivityDock.tsx  # Floating dock showing which agents are currently active\n├── hooks/\n│   ├── useLiveCanvas.ts           # Syncs React Flow state <-> Liveblocks Storage (Yjs)\n│   ├── useVectorSearch.ts         # Frontend hook to query Supabase for similar nodes\n```\n\n---\n\n## 5. Execution Plan (4-Person Elite Team)\n\nTo move at maximum velocity, the 4 developers will work in parallel streams, integrated via strict API contracts.\n\n### Developer 1: The Infrastructure & Orchestrator (Backend Lead)\n*   **Responsibilities:** AWS ECS / Render deployment, Supabase setup, vector database indexing, Redis message queues.\n*   **Action Items:**\n    1. Provision the Postgres database with `pgvector`.\n    2. Build the Liveblocks webhook consumer that listens for `storage_updated` events.\n    3. Write the embedding pipeline: when a node changes on the canvas, extract its text, generate an embedding, and upsert it into `node_embeddings`.\n    4. Expose an API endpoint that the LangGraph service can call to mutate the Liveblocks CRDT state programmatically (so the agents can \"draw\").\n\n### Developer 2: The AI Whisperer (Multi-Agent Engineer)\n*   **Responsibilities:** Claude 3.5 Sonnet integration, LangGraph state machine, Agent system prompts.\n*   **Action Items:**\n    1. Build the LangGraph application using Python. Define the `GraphState`.\n    2. Write the highly-tuned System Prompts for the 4 distinct personas. Give them strict XML output schemas so their responses can be parsed into node data.\n    3. Implement the Debate Loop: Create the logic that routes the output to the Devil's Advocate and loops back up to 3 times before timing out.\n    4. Implement the RAG retrieval tool so agents can query the Supabase vector store dynamically during their generation steps.\n\n### Developer 3: The Spatial Architect (Frontend Logic & CRDTs)\n*   **Responsibilities:** Next.js architecture, Liveblocks integration, React Flow state management.\n*   **Action Items:**\n    1. Set up the Liveblocks `RoomProvider` and connect it to a React Flow instance.\n    2. Write the two-way binding hooks that convert React Flow's `nodes` and `edges` arrays into Liveblocks `LiveMap` and `LiveList` objects for sub-millisecond multiplayer syncing.\n    3. Implement the multiplayer presence system (so users can see where other users are looking).\n    4. Expose a mock API for Developer 4 to test UI components before the real backend is ready.\n\n### Developer 4: The Experience Designer (UI/UX & Animation)\n*   **Responsibilities:** Tailwind CSS, Framer Motion, Custom Nodes, Cinematic feel.\n*   **Action Items:**\n    1. Design and build the custom React Flow nodes (`CharacterNode`, `PlotBeatNode`). They must look beautiful, handle rich text, and include Framer Motion layout transitions when they resize.\n    2. Build the \"Agent Cursors\" system. When an agent is \"thinking\" or \"reading\" a node, their cursor (with a distinct color and avatar) should glide across the screen to that node to give the user spatial awareness of what the AI is doing.\n    3. Build the `AgentActivityDock`—a sleek, terminal-like overlay that streams the internal monologue/debate of the LangGraph agents in real-time using Server-Sent Events (SSE) so the user isn't just staring at a loading spinner.\n    4. Ensure dark mode, typography, and visual hierarchy feel like a professional creative suite.\n\n---\n\n## Phase 2 Detailed Implementation Plan (AI Integration with Qwen)\nHere is the highly detailed, complex implementation plan for Phase 2 of **Writer's Room**, focusing on the integration of the `qwen3.7-max-2026-05-20` model via the DashScope API to drive our autonomous narrative generation and multi-agent ecosystem.\n\n---\n\n# Writer's Room: Phase 2 Implementation Plan — The Cognitive Engine\n\nPhase 2 transitions the system from a robust multiplayer sandbox into a deeply intelligent co-creator. By migrating our core generation and reasoning loops to **Qwen (qwen3.7-max-2026-05-20)** via Alibaba Cloud's DashScope API, we will leverage its massive native context window, superior structural reasoning, and ultra-low latency for complex text synthesis.\n\n## 1. Advanced AI Architecture & Integration Strategy\n\nBecause Qwen 3.7 Max (2026-05-20) excels at processing sprawling, interconnected data structures, we will feed it the actual topology of the canvas rather than just flattened text.\n\n*   **DashScope Async Inference:** To handle the massive payload of a complete \"Story Bible + Spatial Canvas,\" we will utilize DashScope's asynchronous API endpoints. This prevents webhook timeouts and allows our backend to subscribe to Server-Sent Events (SSE) as Qwen streams its thought processes.\n*   **The \"Attention Lens\" Routing:** Instead of naive chunking, we will implement a spatial \"Attention Lens.\" The LLM receives the entire universe topology as a minified JSON schema, but the nodes physically closest to the Showrunner's current viewport (or the active cursor) are injected with full high-fidelity text, while distant nodes are summarized via hierarchical clustering.\n*   **GraphRAG Integration:** We will upgrade our `pgvector` store to a hybrid GraphRAG system using Neo4j or Supabase's recursive CTEs. The LLM won't just find \"similar text\"—it will traverse the canvas edges (e.g., `[Protagonist] -(HATES)-> [Antagonist] -(OWNS)-> [The MacGuffin]`) to ground its generations in undeniable lore facts.\n\n## 2. Context Maintenance: The \"Breathing\" Memory System\n\nMaintaining perfect narrative consistency across a 100,000-word sprawling spatial universe requires dynamic context window management. \n\n*   **The Subconscious Cache (Redis):** The system maintains a rolling window of the last 50 conversational turns and canvas edits in Redis. This is prepended to every DashScope request as the \"recent working memory.\"\n*   **The Immutable Lore Book (System Prompt Injection):** We dynamically compile an \"Immutable Lore Book\" at runtime. Whenever the Showrunner locks a node as \"Canon,\" a background Qwen worker compresses it into a dense, rule-based representation (e.g., \"Magic requires physical exhaustion\"). This is permanently injected into the system prompt of every agent.\n*   **Contextual Rollback:** If the Devil's Advocate agent detects a continuity error, the system automatically uses DashScope's precise token-level caching to roll back the generation context to the point before the error occurred, saving API costs and latency on the retry.\n\n## 3. Prompt Engineering Strategies (Multi-Persona Optimization)\n\nQwen 3.7 Max responds exceptionally well to highly structured, role-played constraints using Tree of Thoughts (ToT) prompting. We will design exact XML-wrapped system prompts for our agents:\n\n*   **The Architect (Structural Focus):**\n    *   *Prompt Strategy:* Constrained generation focused on pacing. \n    *   *Example:* `<directive>You are the Architect. Analyze the <current_canvas_subgraph>. Using the 'Save the Cat' beat sheet, calculate if the 'Dark Night of the Soul' node has sufficient emotional weight based on the connected <character_arcs>. Output your structural modifications in strict JSON patch format.</directive>`\n*   **The Character Lead (Voice & Empathy Focus):**\n    *   *Prompt Strategy:* Chain of Thought (CoT) combined with psychological profiling.\n    *   *Example:* `<directive>Review the proposed dialogue in <node_id: 84>. Before rewriting, output a <thought_process> detailing the character's internal motivation, hidden fears, and current relationship to the listener based on the GraphRAG context. Then, provide 3 dialogue variants ranging from subtextual to overt.</directive>`\n*   **The Devil's Advocate (Critique & Consistency):**\n    *   *Prompt Strategy:* Adversarial prompting. We explicitly instruct this agent to \"break\" the other agents' outputs.\n    *   *Example:* `<directive>Your sole purpose is to find plot holes. Review the Architect's proposal. Cross-reference with the <immutable_lore_book>. If the protagonist escapes the locked room using technology that wasn't invented until the node <timeline_year_3042>, you MUST reject the proposal and force a re-roll.</directive>`\n\n## 4. Execution Plan (4-Person Elite Team)\n\nThe parallel development tracks for Phase 2 are intensely focused on AI orchestration and the seamless blending of LLM outputs into the spatial UI.\n\n### Developer 1: The AI Orchestrator (Backend Lead)\n*   **Responsibilities:** DashScope API integration, LangGraph refinement, and GraphRAG implementation.\n*   **Action Items:**\n    1.  Implement the DashScope API client for `qwen3.7-max-2026-05-20` in the FastAPI backend, utilizing asynchronous streaming (SSE) to push token-by-token generation to the frontend.\n    2.  Build the \"Attention Lens\" middleware: write the algorithm that calculates the physical distance between canvas nodes and the user's viewport, assembling the dynamic context payload (full text for near nodes, summarized text for far nodes).\n    3.  Upgrade the Supabase schema to support hierarchical graph queries (recursive CTEs) so agents can traverse node relationships (GraphRAG) before answering.\n\n### Developer 2: The Agentic Workflow Engineer (Prompt & Logic Lead)\n*   **Responsibilities:** Prompt architecture, Devil's Advocate debate loop, and JSON parsing.\n*   **Action Items:**\n    1.  Author the massive, highly constrained XML system prompts for all 4 personas, specifically tuned for Qwen's instruction-following quirks.\n    2.  Implement the LangGraph \"Debate Loop.\" Write the exact state-machine logic where the Architect and Character Lead submit JSON payloads to the Devil's Advocate, and handle the retry logic if the Advocate rejects it (max 3 retries before escalating to the human Showrunner).\n    3.  Create the \"Lore Compressor\" background job: a smaller model run that constantly reads newly created canvas nodes and summarizes them into the `immutable_lore_book` cache.\n\n### Developer 3: The Data Architect (State & CRDT Master)\n*   **Responsibilities:** Merging LLM outputs with real-time CRDT state without causing merge conflicts.\n*   **Action Items:**\n    1.  Build the \"Shadow Canvas\" system. When agents are debating, their proposed nodes and edges are rendered in a localized Yjs/Liveblocks state that is *invisible* to the main canonical state until the Showrunner hits \"Accept.\"\n    2.  Implement the JSON Patch applier. Translate Qwen's structured JSON outputs (e.g., `{\"action\": \"add_edge\", \"source\": \"A\", \"target\": \"B\"}`) into highly robust CRDT mutations that safely merge with simultaneous human typing.\n    3.  Optimize the webhook pipeline to ensure that fast-typing human users don't trigger 50 redundant DashScope API calls per second (implement intelligent debouncing and stale-request cancellation).\n\n### Developer 4: The Experience Designer (UI/UX & AI Visualization)\n*   **Responsibilities:** Making the complex AI thought process visually stunning and comprehensible to the human user.\n*   **Action Items:**\n    1.  Build the \"Debate Visualization UI.\" When agents disagree, display a beautifully animated, glowing edge connecting their avatars, streaming their adversarial Chain of Thought to the user in a spatial, floating terminal.\n    2.  Implement \"Semantic Heatmaps\" on the canvas. When the user asks a question, highlight the nodes on the canvas that the GraphRAG system is currently pulling into Qwen's context window, glowing brighter based on relevance.\n    3.  Design the \"Agent Ghosting\" interaction. As Qwen streams its generated text for a new plot beat, render the text in a holographic, shimmering font (using Framer Motion & CSS shaders) that solidifies into standard text only when the generation is complete and verified.\n",
  "workflowProgress": [
    {
      "type": "workflow_phase",
      "index": 1,
      "title": "Project Overview"
    },
    {
      "type": "workflow_phase",
      "index": 2,
      "title": "Phase 1 Planning"
    },
    {
      "type": "workflow_phase",
      "index": 3,
      "title": "Phase 2 Planning"
    },
    {
      "type": "workflow_agent",
      "index": 1,
      "label": "You are the project owner and lead architect for a new, high",
      "phaseIndex": 1,
      "phaseTitle": "Project Overview",
      "agentId": "a07e250364faf00f4",
      "model": "ag/gemini-pro-agent",
      "fallbackModel": "gemini-pro-default",
      "state": "done",
      "startedAt": 1784632174317,
      "queuedAt": 1784632174315,
      "attempt": 1,
      "promptPreview": "You are the project owner and lead architect for a new, highly impressive project called \"Writer's Room\". This project is being built for the AI Builders July Challenge. \nThe team consists of 4 advanced developers who work extremely fast, so there are NO TIME BOUNDS or limitations on scope.\n\nFirst, define the core concept of the \"Writer's Room\". What is it? What makes it stand out and highly impre…",
      "lastProgressAt": 1784632200226,
      "tokens": 16447,
      "toolCalls": 0,
      "durationMs": 25908,
      "resultPreview": "# Project Overview: Writer's Room\n\nWelcome to **Writer's Room**. As the lead architect, I have designed this project to push the absolute boundaries of what is possible with generative AI and human-computer interaction. With our elite team of 4 unrestricted developers, we are bypassing standard chat interfaces to build something truly revolutionary for the AI Builders July Challenge.\n\n## 1. The Co…"
    },
    {
      "type": "workflow_agent",
      "index": 2,
      "label": "You are the project owner and lead architect for a new, high",
      "phaseIndex": 2,
      "phaseTitle": "Phase 1 Planning",
      "agentId": "aa9ba685bfa9d028b",
      "model": "ag/gemini-pro-agent",
      "fallbackModel": "gemini-pro-default",
      "state": "done",
      "startedAt": 1784632200235,
      "queuedAt": 1784632200234,
      "attempt": 1,
      "promptPreview": "You are the project owner and lead architect for a new, highly impressive project called \"Writer's Room\". This project is being built for the AI Builders July Challenge. \nThe team consists of 4 advanced developers who work extremely fast, so there are NO TIME BOUNDS or limitations on scope.\n\nBased on this project overview:\n# Project Overview: Writer's Room\n\nWelcome to **Writer's Room**. As the lea…",
      "lastProgressAt": 1784632233688,
      "tokens": 18427,
      "toolCalls": 0,
      "durationMs": 33453,
      "resultPreview": "Here is a deep, highly detailed implementation plan for Phase 1 of **Writer's Room**. \n\nPhase 1 will focus on laying the massive technical foundation required to support real-time CRDT-based multi-user/multi-agent collaboration, the multi-agent LangGraph orchestration, and the spatial canvas interface.\n\n---\n\n# Writer's Room: Phase 1 Implementation Plan\n\n## 1. Core Architecture & Infrastructure\n\nTo…"
    },
    {
      "type": "workflow_agent",
      "index": 3,
      "label": "You are the project owner and lead architect for a new, high",
      "phaseIndex": 3,
      "phaseTitle": "Phase 2 Planning",
      "agentId": "a996952cc83b66a4d",
      "model": "ag/gemini-pro-agent",
      "fallbackModel": "gemini-pro-default",
      "state": "done",
      "startedAt": 1784632233690,
      "queuedAt": 1784632233689,
      "attempt": 1,
      "promptPreview": "You are the project owner and lead architect for a new, highly impressive project called \"Writer's Room\". This project is being built for the AI Builders July Challenge. \nThe team consists of 4 advanced developers who work extremely fast, so there are NO TIME BOUNDS or limitations on scope.\n\nBased on this project overview:\n# Project Overview: Writer's Room\n\nWelcome to **Writer's Room**. As the lea…",
      "lastProgressAt": 1784632266444,
      "tokens": 20267,
      "toolCalls": 0,
      "durationMs": 32754,
      "resultPreview": "Here is the highly detailed, complex implementation plan for Phase 2 of **Writer's Room**, focusing on the integration of the `qwen3.7-max-2026-05-20` model via the DashScope API to drive our autonomous narrative generation and multi-agent ecosystem.\n\n---\n\n# Writer's Room: Phase 2 Implementation Plan — The Cognitive Engine\n\nPhase 2 transitions the system from a robust multiplayer sandbox into a de…"
    }
  ],
  "totalTokens": 55141,
  "totalToolCalls": 0
}{
  "summary": "Create a deep, detailed implementation plan for the remaining phases (Phase 3 & Phase 4) of the Writer's Room project.
  "agentCount": 3,
  "logs": [
    "Appending remaining phases to final plan..."
  "result": "
---

## Phase 3 Detailed Implementation Plan (Advanced Human-AI Interaction & Synthesis)
# Phase 3 Implementation Plan: Advanced Human-AI Interaction & Synthesis

Welcome to Phase 3 of the **Writer's Room** project. With our core spatial architecture (Phase 1) and the Qwen Cognitive Engine (Phase 2) firmly in place, it is time to transcend standard UI paradigms. Phase 3 is about bridging the gap between non-linear human imagination and structured, multimodal AI execution. 

Since we operate with no limitations on time or scope, we are building a state-of-the-art, multi-sensory intelligence system. We will divide this massive undertaking across our 4-person elite engineering team into four concurrent, highly complex workstreams.

---

## 👥 Team Allocation & Architecture Domains

*   **Dev 1 (The Weaver):** Lead on Narrative Graph-to-Linear Synthesis & Bi-directional Sync.
*   **Dev 2 (The Critic):** Lead on Agentic Epistemic Memory, RLHF, and Self-Reflection.
*   **Dev 3 (The Art Director):** Lead on Spatially-Triggered Multimedia & Procedural Mood Boards.
*   **Dev 4 (The Conductor):** Lead on Natural User Interfaces (NUI) – Voice Intent & Spatial Gestures.

---

## 🛠 Detailed Step-by-Step Implementation

### Workstream 1: Spatial-to-Linear Synthesis Engine (Dev 1)
**Objective:** Convert a 2D/3D spatial canvas of abstract thoughts, character nodes, and plot points into a cohesive, linearly readable format (e.g., a screenplay, novel chapter, or design doc), while maintaining bi-directional synchronization.

*   **Step 1.1: Narrative DAG Construction:** 
    *   Implement an algorithm to traverse the spatial canvas, converting overlapping or clustered nodes into a Directed Acyclic Graph (DAG). 
    *   Use spatial proximity, edge connections, and semantic timestamps to calculate a topological sort of narrative events.
*   **Step 1.2: Qwen-Powered Contextual Smoothing:** 
    *   Pass the topological sort through the Qwen Cognitive Engine. Instead of blindly concatenating text, implement a "smoothing" agent that understands transition mechanics.
    *   The agent injects bridging prose between disparate plot nodes to create seamless linear flow.
*   **Step 1.3: Bi-directional CRDT Synchronization:** 
    *   Implement Conflict-free Replicated Data Types (CRDTs) to map substrings in the linear export back to specific UUIDs on the spatial canvas.
    *   If the user edits a paragraph in the linear text view, the engine must parse the delta, update the corresponding node on the spatial canvas, and trigger Qwen to re-evaluate downstream spatial connections.

### Workstream 2: Agent Self-Reflection & Epistemic Memory (Dev 2)
**Objective:** Ensure the Qwen agents are not static stochastic parrots. They must learn the user's stylistic preferences deeply and reflect on their own outputs before presenting them.

*   **Step 2.1: Implicit Feedback Capture (Diff Tracking):** 
    *   Build a background daemon that tracks every manual modification the user makes to AI-generated text or node placement. 
    *   Calculate the semantic diff between the AI's generation and the user's final edit.
*   **Step 2.2: Continuous Preference RAG & LoRA Routing:** 
    *   Store these diffs in a local Vector Database (e.g., Milvus or Qdrant) as "stylistic correction embeddings." 
    *   Implement a retrieval-augmented generation (RAG) hook: before Qwen generates new text, it queries the DB for past corrections in similar contexts.
    *   *Ultra-Advanced:* Implement an on-the-fly Parameter-Efficient Fine-Tuning (PEFT/LoRA) pipeline that micro-tunes a stylistic adapter based on aggregated user corrections overnight.
*   **Step 2.3: The "Critic" Multi-Agent Loop:** 
    *   Before rendering output to the canvas, route the draft to a secondary "Critic" agent. 
    *   The Critic evaluates the draft against the user's memory vector (e.g., "User hates adverbs, but you used three"). The Generator agent must revise the output until the Critic approves it (up to $N$ iterations) *before* the user ever sees it.

### Workstream 3: Spatially-Triggered Multimedia Generation (Dev 3)
**Objective:** Evolve the text canvas into a dynamic, multimodal war room.

*   **Step 3.1: Node-Embedded Visual Synthesis:** 
    *   Integrate a text-to-image API (e.g., Stable Diffusion 3, Flux, or Midjourney via custom hooks).
    *   When a user creates a "Character" or "Location" node, a background worker automatically parses the text descriptions, enriches the prompt using Qwen, and generates character portraits or environment concept art directly onto the node.
*   **Step 3.2: Latent Space Blending via Canvas Proximity:** 
    *   Implement a spatial heuristic: If the user drags a "Cyberpunk City" location node so it overlaps with a "Victorian Detective" character node, trigger a combined visual generation.
    *   Calculate the intersection of their latent spaces to auto-generate a mood board of the detective *in* that city, rendered in the space between the nodes.
*   **Step 3.3: Procedural Audio & Ambient Soundscapes:** 
    *   Integrate AudioLDM or Suno APIs. Based on the emotional valence of a cluster of nodes (e.g., tension, romance, horror), generate a looping, non-intrusive ambient background track specific to that region of the spatial canvas.

### Workstream 4: Natural User Interface (NUI) - Voice & Gesture (Dev 4)
**Objective:** Free the user from the keyboard and mouse. The canvas must feel like a living entity that responds to human kinetics and speech.

*   **Step 4.1: Continuous Voice-to-Intent Pipeline:** 
    *   Implement WebRTC for low-latency audio streaming to a local Whisper or Deepgram instance.
    *   Route the transcribed stream through an intent-classification LLM. 
    *   Instead of standard dictation, allow semantic commands: *"Move the climax node after the betrayal, and make the tone darker."* The system translates this to spatial coordinates, moves the nodes, and triggers Qwen to rewrite the text.
*   **Step 4.2: Spatial Gesture Recognition (Webcam/WebXR):** 
    *   Integrate Google MediaPipe for real-time hand tracking via the user's webcam.
    *   Map skeletal hand models to canvas actions: 
        *   *Pinch and pull:* Zoom in/out of the Z-axis of the canvas.
        *   *Two-hand push:* Create a void in the center of a node cluster to make room for a new act.
        *   *Point and drag:* Draw semantic edges between two distant nodes without a mouse.
*   **Step 4.3: Multimodal Fusion Engine:** 
    *   Combine Voice and Gesture timing. The user can point at a specific node on the screen with their hand and say, *"Expand on this character's backstory."* 
    *   The frontend calculates the raycast of the finger to the specific canvas coordinate, identifies the target node, and feeds the voice prompt specifically into that node's generation context.

---

## 🌀 Integration & Synergy (The Final Assembly)
To fuse these streams, we will deploy a **Global State Manager (Redux/Zustand combined with Yjs for CRDTs)**. 

1. Dev 4's NUI captures a gesture and voice command. 
2. This mutates the Yjs spatial state. 
3. Dev 3's Multimedia engine detects the spatial change and kicks off a visual regeneration. 
4. Dev 1's Synthesis engine instantly recompiles the linear draft. 
5. The user corrects a generated sentence in the linear view, which Dev 2's Epistemic Memory engine catches, saving the diff to immediately improve the next voice-command generation.

This plan demands maximum parallel execution. We are not just building an app; we are building a cognitive exoskeleton for writers. Let's begin.

---

## Phase 4 Detailed Implementation Plan (Scaling, Performance & The 'Wow' Factor)
# Writer's Room: Phase 4 Implementation Plan — Production-Grade Polish, Scaling & The "Wow" Factor

Phase 4 is the culmination of the Writer's Room project. We are transitioning from a highly functional AI-augmented workspace into an enterprise-grade, hyper-optimized engine with a final "Demo Day" feature designed to leave the audience completely speechless.

Here is the deep, highly detailed technical plan for Phase 4.

---

## 1. Infinite Canvas Optimization (The WebGL/WASM Engine)

As the story bible expands to tens of thousands of nodes (characters, beats, locations, dialogue), DOM-based rendering via React Flow will bottleneck. We will implement an extreme optimization pass to ensure the canvas remains locked at 120+ FPS, regardless of size.

*   **Hybrid WebGL + DOM Rendering (DOM Recycling):** We will implement a hybrid rendering pipeline using **PixiJS (WebGL)**. When zoomed out (macro view), nodes and edges are drawn entirely on a WebGL canvas to handle 100,000+ entities without DOM overhead. As the Showrunner zooms in past a specific threshold, we seamlessly swap WebGL sprites with fully interactive React DOM elements.
*   **Spatial Chunking (Quadtrees):** We will divide the infinite coordinate space into a Quadtree data structure. The frontend will only subscribe to Liveblocks CRDT updates for the chunks currently intersecting the user's viewport. Off-screen node updates are batched and applied silently in the background.
*   **WebAssembly (WASM) State Offloading:** We will rewrite the heaviest state reconciliation logic (merging complex Qwen JSON patches with the local CRDT state) and force-directed graph physics in **Rust**, compiling it to WebAssembly. This offloads compute-heavy blocking tasks from the JavaScript main thread to Web Workers, ensuring zero UI stutter.

## 2. Creative Analytics: The "Director's Dashboard"

Writing is art, but orchestrating a multi-season television show or a cinematic universe requires data. We will build a visualization suite to track the creative process.

*   **Tension & Sentiment Heatmaps:** The backend will run a background Qwen worker that analyzes the emotional sentiment and narrative tension of every node. We will overlay a volumetric heatmap on the canvas: red zones indicate high-tension climaxes, while blue zones represent low-tension exposition, allowing the Showrunner to visually debug pacing issues.
*   **3D Lore Topography:** We will use **Three.js** to introduce a "Z-axis" toggle. The 2D canvas physically extrudes into a 3D knowledge graph. Nodes with the most connections (e.g., the Main Protagonist, the Core MacGuffin) form towering mountains of data, while isolated nodes (unresolved plot threads) sit in valleys, giving an instant, awe-inspiring view of the universe's density.
*   **Agent Contribution Telemetry:** A beautiful analytics panel visualizing the exact percentage of human-authored vs. AI-authored content, including which specific AI Agent (Architect vs. Devil's Advocate) resolved the most structural bottlenecks.

## 3. The "Wow" Factor: The "Action Mode" Live Table Read

For Demo Day, we need a feature that shatters expectations. We will build **Action Mode**—a real-time, multi-modal simulation of the story.

When the Showrunner selects a sequence of scene nodes and clicks "Action!", the canvas dims, and the system dynamically generates a cinematic preview of the unmade film/show in real-time:
*   **Dynamic Voice Acting (ElevenLabs):** The system instantly maps ElevenLabs Voice Clones to character nodes based on their personality traits. The text within the nodes is streamed as ultra-realistic, emotionally inflected audio (complete with synthesized gasps, pauses, and overlapping dialogue).
*   **Real-Time Generative Storyboards:** As Qwen feeds the dialogue, it simultaneously prompts a fast latent diffusion model (e.g., SDXL Turbo or a managed fast-inference API) to generate high-quality storyboard panels at 2-3 frames per second, projecting them over the scene nodes.
*   **The "Director" Agent:** An unseen Qwen agent dictates the timing, triggering sound effects (e.g., *[door slams]*, *[rain outside]*) dynamically parsed from the stage directions in the nodes.

---

## 4. Execution Plan (4-Person Elite Team)

To achieve this level of scale and multi-modal complexity, the team will execute these highly specialized parallel tracks.

### Developer 1: The Infrastructure & Performance Lead
*   **Responsibilities:** WASM integration, Quadtree implementation, and WebSockets scaling.
*   **Action Items:**
    1.  Write the Rust/WASM module to handle CRDT diffing and spatial Quadtree calculations off the main thread.
    2.  Implement "viewport culling" logic with Liveblocks. The client should only listen to WebSocket events for chunks of the map that are currently visible, drastically reducing network payload.
    3.  Optimize the Supabase queries to support massive, batched metadata reads for the analytics dashboard without locking the database.

### Developer 2: The Multi-Modal AI Engineer (The Demo Day Lead)
*   **Responsibilities:** ElevenLabs TTS integration, Generative Storyboards, Action Mode orchestration.
*   **Action Items:**
    1.  Build the Action Mode pipeline: write a Qwen parser that separates raw text in a node into `[Dialogue]`, `[Character]`, and `[Action/VFX]`.
    2.  Integrate the ElevenLabs WebSocket API for ultra-low latency text-to-speech, mapping character profiles in the database to specific voice IDs.
    3.  Set up the fast-inference diffusion API to generate 512x512 storyboard panels based on the `[Action]` descriptions, streaming them back to the frontend in real-time.

### Developer 3: The Graphics & Rendering Master
*   **Responsibilities:** WebGL hybrid canvas, DOM recycling, Three.js integration.
*   **Action Items:**
    1.  Implement the PixiJS WebGL layer beneath React Flow. Write the logic that smoothly swaps React DOM nodes out for PixiJS sprites when the zoom level drops below `0.5x`.
    2.  Build the smooth, interpolated camera panning and zooming physics (mimicking native apps like Figma or Miro).
    3.  Develop the Three.js 3D Lore Topography mode. Map the 2D coordinates to a 3D plane and extrude the Y-axis based on edge-connection density, complete with dramatic lighting and shadows.

### Developer 4: The Data Visualization & UI Architect
*   **Responsibilities:** Analytics dashboard, Tension Heatmaps, and the cinematic UI polish.
*   **Action Items:**
    1.  Design and build the "Director's Dashboard" overlay, utilizing advanced charting libraries or custom D3.js SVGs to render the agent contribution telemetry.
    2.  Create the volumetric Tension Heatmap shader. It must dynamically read metadata from the nodes and paint smooth, blurred, color-coded zones across the background of the canvas.
    3.  Polish the Action Mode UI: create the cinematic "letterbox" transition, the pulsing audio waveforms for character speech, and the fluid animations that focus the camera on nodes as they are "spoken" aloud during the table read.

  "workflowProgress": [
    {
    {
    {
    {
      "label": "Read the following existing plan for context. You don't need
      "phaseIndex": 1,
      "phaseTitle": "Project Overview Retrieval
      "agentId": "a0bf7013164c7bab7
      "model": "ag/gemini-pro-agent
      "fallbackModel": "gemini-pro-default
      "state": "done
      "startedAt": 1784632505077,
      "queuedAt": 1784632505076,
      "attempt": 1,
      "promptPreview": "Read the following existing plan for context. You don't need to return anything complex, just acknowledge you understand the context of the Writer's Room project.
We are building a highly impressive, multiplayer, multi-agent spatial workspace for the AI Builders July Challenge using Next.js, Liveblocks, Supabase, and DashScope (Qwen). 

Here is what we have planned for Phases 1 and 2:
Phase 1: Cor…
      "lastProgressAt": 1784632511546,
      "tokens": 14617,
      "toolCalls": 0,
      "durationMs": 6468,
I understand the context and planned phases for the Writer's Room project, including its core infrastructure and the Qwen-powered Cognitive Engine."
    {
      "label": "You are the project owner and lead architect for a new, high
      "phaseIndex": 2,
      "phaseTitle": "Phase 3 Planning
      "agentId": "ab26fbdc35a4fc904
      "model": "ag/gemini-pro-agent
      "fallbackModel": "gemini-pro-default
      "state": "done
      "startedAt": 1784632511548,
      "queuedAt": 1784632511547,
      "attempt": 1,
      "promptPreview": "You are the project owner and lead architect for a new, highly impressive project called "Writer's Room". This project is being built for the AI Builders July Challenge. 
The team consists of 4 advanced developers who work extremely fast, so there are NO TIME BOUNDS or limitations on scope.

Based on the existing work (Phase 1: Core spatial architecture, Phase 2: Qwen Cognitive Engine), create a d…
      "lastProgressAt": 1784632548142,
      "tokens": 17585,
      "toolCalls": 0,
      "durationMs": 36594,
# Phase 3 Implementation Plan: Advanced Human-AI Interaction & Synthesis

Welcome to Phase 3 of the **Writer's Room** project. With our core spatial architecture (Phase 1) and the Qwen Cognitive Engine (Phase 2) firmly in place, it is time to transcend standard UI paradigms. Phase 3 is about bridging the gap between non-linear human imagination and structured, multimodal AI execution. 

Since we o…"
    {
      "label": "You are the project owner and lead architect for a new, high
      "phaseIndex": 3,
      "phaseTitle": "Phase 4 Planning
      "agentId": "a74a9d3f63d3f3833
      "model": "ag/gemini-pro-agent
      "fallbackModel": "gemini-pro-default
      "state": "done
      "startedAt": 1784632548144,
      "queuedAt": 1784632548142,
      "attempt": 1,
      "lastToolName": "Bash
      "lastToolSummary": "cat writers_room_plan.md
      "promptPreview": "You are the project owner and lead architect for a new, highly impressive project called "Writer's Room". This project is being built for the AI Builders July Challenge. 
The team consists of 4 advanced developers who work extremely fast, so there are NO TIME BOUNDS or limitations on scope.

Based on the existing work (Phase 1: Core spatial architecture, Phase 2: Qwen Cognitive Engine, Phase 3: Ad…
      "lastProgressAt": 1784632592814,
      "tokens": 23728,
      "toolCalls": 2,
      "durationMs": 44670,
# Writer's Room: Phase 4 Implementation Plan — Production-Grade Polish, Scaling & The "Wow" Factor

Phase 4 is the culmination of the Writer's Room project. We are transitioning from a highly functional AI-augmented workspace into an enterprise-grade, hyper-optimized engine with a final "Demo Day" feature designed to leave the audience completely speechless.

Here is the deep, highly detailed tech…"

---

## Phase 3 Detailed Implementation Plan (Advanced Human-AI Interaction & Synthesis)
# Phase 3 Implementation Plan: Advanced Human-AI Interaction & Synthesis

Welcome to Phase 3 of the **Writer's Room** project. With our core spatial architecture (Phase 1) and the Qwen Cognitive Engine (Phase 2) firmly in place, it is time to transcend standard UI paradigms. Phase 3 is about bridging the gap between non-linear human imagination and structured, multimodal AI execution. 

Since we operate with no limitations on time or scope, we are building a state-of-the-art, multi-sensory intelligence system. We will divide this massive undertaking across our 4-person elite engineering team into four concurrent, highly complex workstreams.

---

## 👥 Team Allocation & Architecture Domains

*   **Dev 1 (The Weaver):** Lead on Narrative Graph-to-Linear Synthesis & Bi-directional Sync.
*   **Dev 2 (The Critic):** Lead on Agentic Epistemic Memory, RLHF, and Self-Reflection.
*   **Dev 3 (The Art Director):** Lead on Spatially-Triggered Multimedia & Procedural Mood Boards.
*   **Dev 4 (The Conductor):** Lead on Natural User Interfaces (NUI) – Voice Intent & Spatial Gestures.

---

## 🛠 Detailed Step-by-Step Implementation

### Workstream 1: Spatial-to-Linear Synthesis Engine (Dev 1)
**Objective:** Convert a 2D/3D spatial canvas of abstract thoughts, character nodes, and plot points into a cohesive, linearly readable format (e.g., a screenplay, novel chapter, or design doc), while maintaining bi-directional synchronization.

*   **Step 1.1: Narrative DAG Construction:** 
    *   Implement an algorithm to traverse the spatial canvas, converting overlapping or clustered nodes into a Directed Acyclic Graph (DAG). 
    *   Use spatial proximity, edge connections, and semantic timestamps to calculate a topological sort of narrative events.
*   **Step 1.2: Qwen-Powered Contextual Smoothing:** 
    *   Pass the topological sort through the Qwen Cognitive Engine. Instead of blindly concatenating text, implement a "smoothing" agent that understands transition mechanics.
    *   The agent injects bridging prose between disparate plot nodes to create seamless linear flow.
*   **Step 1.3: Bi-directional CRDT Synchronization:** 
    *   Implement Conflict-free Replicated Data Types (CRDTs) to map substrings in the linear export back to specific UUIDs on the spatial canvas.
    *   If the user edits a paragraph in the linear text view, the engine must parse the delta, update the corresponding node on the spatial canvas, and trigger Qwen to re-evaluate downstream spatial connections.

### Workstream 2: Agent Self-Reflection & Epistemic Memory (Dev 2)
**Objective:** Ensure the Qwen agents are not static stochastic parrots. They must learn the user's stylistic preferences deeply and reflect on their own outputs before presenting them.

*   **Step 2.1: Implicit Feedback Capture (Diff Tracking):** 
    *   Build a background daemon that tracks every manual modification the user makes to AI-generated text or node placement. 
    *   Calculate the semantic diff between the AI's generation and the user's final edit.
*   **Step 2.2: Continuous Preference RAG & LoRA Routing:** 
    *   Store these diffs in a local Vector Database (e.g., Milvus or Qdrant) as "stylistic correction embeddings." 
    *   Implement a retrieval-augmented generation (RAG) hook: before Qwen generates new text, it queries the DB for past corrections in similar contexts.
    *   *Ultra-Advanced:* Implement an on-the-fly Parameter-Efficient Fine-Tuning (PEFT/LoRA) pipeline that micro-tunes a stylistic adapter based on aggregated user corrections overnight.
*   **Step 2.3: The "Critic" Multi-Agent Loop:** 
    *   Before rendering output to the canvas, route the draft to a secondary "Critic" agent. 
    *   The Critic evaluates the draft against the user's memory vector (e.g., "User hates adverbs, but you used three"). The Generator agent must revise the output until the Critic approves it (up to $N$ iterations) *before* the user ever sees it.

### Workstream 3: Spatially-Triggered Multimedia Generation (Dev 3)
**Objective:** Evolve the text canvas into a dynamic, multimodal war room.

*   **Step 3.1: Node-Embedded Visual Synthesis:** 
    *   Integrate a text-to-image API (e.g., Stable Diffusion 3, Flux, or Midjourney via custom hooks).
    *   When a user creates a "Character" or "Location" node, a background worker automatically parses the text descriptions, enriches the prompt using Qwen, and generates character portraits or environment concept art directly onto the node.
*   **Step 3.2: Latent Space Blending via Canvas Proximity:** 
    *   Implement a spatial heuristic: If the user drags a "Cyberpunk City" location node so it overlaps with a "Victorian Detective" character node, trigger a combined visual generation.
    *   Calculate the intersection of their latent spaces to auto-generate a mood board of the detective *in* that city, rendered in the space between the nodes.
*   **Step 3.3: Procedural Audio & Ambient Soundscapes:** 
    *   Integrate AudioLDM or Suno APIs. Based on the emotional valence of a cluster of nodes (e.g., tension, romance, horror), generate a looping, non-intrusive ambient background track specific to that region of the spatial canvas.

### Workstream 4: Natural User Interface (NUI) - Voice & Gesture (Dev 4)
**Objective:** Free the user from the keyboard and mouse. The canvas must feel like a living entity that responds to human kinetics and speech.

*   **Step 4.1: Continuous Voice-to-Intent Pipeline:** 
    *   Implement WebRTC for low-latency audio streaming to a local Whisper or Deepgram instance.
    *   Route the transcribed stream through an intent-classification LLM. 
    *   Instead of standard dictation, allow semantic commands: *"Move the climax node after the betrayal, and make the tone darker."* The system translates this to spatial coordinates, moves the nodes, and triggers Qwen to rewrite the text.
*   **Step 4.2: Spatial Gesture Recognition (Webcam/WebXR):** 
    *   Integrate Google MediaPipe for real-time hand tracking via the user's webcam.
    *   Map skeletal hand models to canvas actions: 
        *   *Pinch and pull:* Zoom in/out of the Z-axis of the canvas.
        *   *Two-hand push:* Create a void in the center of a node cluster to make room for a new act.
        *   *Point and drag:* Draw semantic edges between two distant nodes without a mouse.
*   **Step 4.3: Multimodal Fusion Engine:** 
    *   Combine Voice and Gesture timing. The user can point at a specific node on the screen with their hand and say, *"Expand on this character's backstory."* 
    *   The frontend calculates the raycast of the finger to the specific canvas coordinate, identifies the target node, and feeds the voice prompt specifically into that node's generation context.

---

## 🌀 Integration & Synergy (The Final Assembly)
To fuse these streams, we will deploy a **Global State Manager (Redux/Zustand combined with Yjs for CRDTs)**. 

1. Dev 4's NUI captures a gesture and voice command. 
2. This mutates the Yjs spatial state. 
3. Dev 3's Multimedia engine detects the spatial change and kicks off a visual regeneration. 
4. Dev 1's Synthesis engine instantly recompiles the linear draft. 
5. The user corrects a generated sentence in the linear view, which Dev 2's Epistemic Memory engine catches, saving the diff to immediately improve the next voice-command generation.

This plan demands maximum parallel execution. We are not just building an app; we are building a cognitive exoskeleton for writers. Let's begin.

---

## Phase 4 Detailed Implementation Plan (Scaling, Performance & The 'Wow' Factor)
# Writer's Room: Phase 4 Implementation Plan — Production-Grade Polish, Scaling & The "Wow" Factor

Phase 4 is the culmination of the Writer's Room project. We are transitioning from a highly functional AI-augmented workspace into an enterprise-grade, hyper-optimized engine with a final "Demo Day" feature designed to leave the audience completely speechless.

Here is the deep, highly detailed technical plan for Phase 4.

---

## 1. Infinite Canvas Optimization (The WebGL/WASM Engine)

As the story bible expands to tens of thousands of nodes (characters, beats, locations, dialogue), DOM-based rendering via React Flow will bottleneck. We will implement an extreme optimization pass to ensure the canvas remains locked at 120+ FPS, regardless of size.

*   **Hybrid WebGL + DOM Rendering (DOM Recycling):** We will implement a hybrid rendering pipeline using **PixiJS (WebGL)**. When zoomed out (macro view), nodes and edges are drawn entirely on a WebGL canvas to handle 100,000+ entities without DOM overhead. As the Showrunner zooms in past a specific threshold, we seamlessly swap WebGL sprites with fully interactive React DOM elements.
*   **Spatial Chunking (Quadtrees):** We will divide the infinite coordinate space into a Quadtree data structure. The frontend will only subscribe to Liveblocks CRDT updates for the chunks currently intersecting the user's viewport. Off-screen node updates are batched and applied silently in the background.
*   **WebAssembly (WASM) State Offloading:** We will rewrite the heaviest state reconciliation logic (merging complex Qwen JSON patches with the local CRDT state) and force-directed graph physics in **Rust**, compiling it to WebAssembly. This offloads compute-heavy blocking tasks from the JavaScript main thread to Web Workers, ensuring zero UI stutter.

## 2. Creative Analytics: The "Director's Dashboard"

Writing is art, but orchestrating a multi-season television show or a cinematic universe requires data. We will build a visualization suite to track the creative process.

*   **Tension & Sentiment Heatmaps:** The backend will run a background Qwen worker that analyzes the emotional sentiment and narrative tension of every node. We will overlay a volumetric heatmap on the canvas: red zones indicate high-tension climaxes, while blue zones represent low-tension exposition, allowing the Showrunner to visually debug pacing issues.
*   **3D Lore Topography:** We will use **Three.js** to introduce a "Z-axis" toggle. The 2D canvas physically extrudes into a 3D knowledge graph. Nodes with the most connections (e.g., the Main Protagonist, the Core MacGuffin) form towering mountains of data, while isolated nodes (unresolved plot threads) sit in valleys, giving an instant, awe-inspiring view of the universe's density.
*   **Agent Contribution Telemetry:** A beautiful analytics panel visualizing the exact percentage of human-authored vs. AI-authored content, including which specific AI Agent (Architect vs. Devil's Advocate) resolved the most structural bottlenecks.

## 3. The "Wow" Factor: The "Action Mode" Live Table Read

For Demo Day, we need a feature that shatters expectations. We will build **Action Mode**—a real-time, multi-modal simulation of the story.

When the Showrunner selects a sequence of scene nodes and clicks "Action!", the canvas dims, and the system dynamically generates a cinematic preview of the unmade film/show in real-time:
*   **Dynamic Voice Acting (ElevenLabs):** The system instantly maps ElevenLabs Voice Clones to character nodes based on their personality traits. The text within the nodes is streamed as ultra-realistic, emotionally inflected audio (complete with synthesized gasps, pauses, and overlapping dialogue).
*   **Real-Time Generative Storyboards:** As Qwen feeds the dialogue, it simultaneously prompts a fast latent diffusion model (e.g., SDXL Turbo or a managed fast-inference API) to generate high-quality storyboard panels at 2-3 frames per second, projecting them over the scene nodes.
*   **The "Director" Agent:** An unseen Qwen agent dictates the timing, triggering sound effects (e.g., *[door slams]*, *[rain outside]*) dynamically parsed from the stage directions in the nodes.

---

## 4. Execution Plan (4-Person Elite Team)

To achieve this level of scale and multi-modal complexity, the team will execute these highly specialized parallel tracks.

### Developer 1: The Infrastructure & Performance Lead
*   **Responsibilities:** WASM integration, Quadtree implementation, and WebSockets scaling.
*   **Action Items:**
    1.  Write the Rust/WASM module to handle CRDT diffing and spatial Quadtree calculations off the main thread.
    2.  Implement "viewport culling" logic with Liveblocks. The client should only listen to WebSocket events for chunks of the map that are currently visible, drastically reducing network payload.
    3.  Optimize the Supabase queries to support massive, batched metadata reads for the analytics dashboard without locking the database.

### Developer 2: The Multi-Modal AI Engineer (The Demo Day Lead)
*   **Responsibilities:** ElevenLabs TTS integration, Generative Storyboards, Action Mode orchestration.
*   **Action Items:**
    1.  Build the Action Mode pipeline: write a Qwen parser that separates raw text in a node into `[Dialogue]`, `[Character]`, and `[Action/VFX]`.
    2.  Integrate the ElevenLabs WebSocket API for ultra-low latency text-to-speech, mapping character profiles in the database to specific voice IDs.
    3.  Set up the fast-inference diffusion API to generate 512x512 storyboard panels based on the `[Action]` descriptions, streaming them back to the frontend in real-time.

### Developer 3: The Graphics & Rendering Master
*   **Responsibilities:** WebGL hybrid canvas, DOM recycling, Three.js integration.
*   **Action Items:**
    1.  Implement the PixiJS WebGL layer beneath React Flow. Write the logic that smoothly swaps React DOM nodes out for PixiJS sprites when the zoom level drops below `0.5x`.
    2.  Build the smooth, interpolated camera panning and zooming physics (mimicking native apps like Figma or Miro).
    3.  Develop the Three.js 3D Lore Topography mode. Map the 2D coordinates to a 3D plane and extrude the Y-axis based on edge-connection density, complete with dramatic lighting and shadows.

### Developer 4: The Data Visualization & UI Architect
*   **Responsibilities:** Analytics dashboard, Tension Heatmaps, and the cinematic UI polish.
*   **Action Items:**
    1.  Design and build the "Director's Dashboard" overlay, utilizing advanced charting libraries or custom D3.js SVGs to render the agent contribution telemetry.
    2.  Create the volumetric Tension Heatmap shader. It must dynamically read metadata from the nodes and paint smooth, blurred, color-coded zones across the background of the canvas.
    3.  Polish the Action Mode UI: create the cinematic "letterbox" transition, the pulsing audio waveforms for character speech, and the fluid animations that focus the camera on nodes as they are "spoken" aloud during the table read.
