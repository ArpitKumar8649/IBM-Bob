# Phase 1: IBM-Aligned Implementation Plan

## Challenge Alignment Strategy
Here are the strict architectural adjustments we must implement in our Phase 1 tech stack to maximize our score and align with the judging criteria:

*   **Mandate IBM Bob as the Primary Development Environment (Required)**
    *   **Adjustment:** All team members must transition from their preferred IDEs (VS Code, IntelliJ, etc.) to using IBM Bob for building, testing, and deploying the application. 
    *   **Rationale:** The rules explicitly state IBM Bob must be the "primary development tool." We will document our usage of IBM Bob in our submission README and video to guarantee full points for this hard requirement.

*   **Standardize on IBM watsonx for AI Infrastructure**
    *   **Adjustment:** Rip out any existing API hooks for OpenAI, Anthropic, or standard HuggingFace endpoints. We must route all multi-agent prompts, generation, and model management through the IBM watsonx.ai platform.
    *   **Rationale:** "Technical Execution" heavily weights the effective use of IBM technologies. Using watsonx as our central AI hub proves enterprise-level integration.

*   **Adopt IBM Granite as our Core Agent Models**
    *   **Adjustment:** Assign IBM Granite models (via watsonx or deployed locally) to power the core personas in the Writer's Room. For example, our "Brainstorming Agent," "Drafting Agent," and "Editor Agent" must utilize Granite foundation models rather than generic alternatives.
    *   **Rationale:** Maximizes points for recommended technologies while ensuring AI remains the "core functional component" of the creative spatial workspace.

*   **Refactor Multi-Agent Orchestration to LangChain and LangFlow**
    *   **Adjustment:** Abandon custom agent-routing scripts or competing frameworks (like AutoGen or CrewAI). We must rebuild our multi-agent communication graph using LangChain. 
    *   **Adjustment:** Use LangFlow to visually construct, test, and present the agent logic and RAG pipelines.
    *   **Rationale:** Directly satisfies the LangChain/LangFlow recommendation. Furthermore, showcasing a visual LangFlow pipeline in our demo video will massively boost our "Technical Execution" and "Feasibility" scores by proving our complex spatial workspace logic is maintainable and scalable.

*   **Realign "Innovation" & "Impact" to the Creative Industries Theme**
    *   **Adjustment:** Our spatial workspace cannot just be a generic whiteboard. We must tailor the AI agents (powered by Granite/watsonx) to solve a highly specific real-world creative bottleneck. For example: a spatial storyboarding room where agents dynamically generate script revisions and reference imagery based on a writer's spatial arrangement of notes.
    *   **Rationale:** Secures the "Challenge Fit" and "Real-World Impact" criteria by proving the IBM-backed AI directly reimagines a creative industry workflow, rather than just acting as a generic chat tool.

---

## Revised Architecture (IBM Stack)
Here is the redesigned Phase 1 Backend Architecture for the spatial workspace, pivoting strictly to IBM and LangChain ecosystem requirements.

### Phase 1 Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                           FRONTEND (ReactFlow + Next.js)                          |
|  - Spatial Canvas UI (Nodes: Sticky Notes, Scripts, Storyboards, Agent Avatars)   |
+-----------------------------------------------------------------------------------+
          | (REST / REST APIs)                           | (WebSockets)
          | Agent Triggers & Prompts                     | Real-Time Sync & Presence
          V                                              V
+----------------------------------------+     +------------------------------------+
|       BACKEND API (Node.js/Python)     |     |   LIVEBLOCKS COLLABORATION HUB     |
| - Handles authentication               |<--->| - Maintains spatial graph state    |
| - Routes AI requests to LangFlow API   |     | - Broadcasts AI node updates       |
+----------------------------------------+     +------------------------------------+
          |
          V
+-----------------------------------------------------------------------------------+
|                   AI ORCHESTRATION LAYER (LangChain & LangFlow)                   |
| - Visual graph built in LangFlow for easy modification & demonstration            |
| - Memory Management (Conversation Buffer Memory)                                  |
|                                                                                   |
|      [ Router Agent ] (Analyzes spatial context & routes task)                    |
|             |                                                                     |
|      +------+---------------------+---------------------+                         |
|      V                            V                     V                         |
| [ Brainstorming Agent ]    [ Drafting Agent ]     [ Editor Agent ]                |
| (Generates concepts)       (Expands outlines)     (Refines & formats script)      |
+-----------------------------------------------------------------------------------+
          |                             |                     |
          +-----------------------------+---------------------+
                                        |
                                        V
+-----------------------------------------------------------------------------------+
|                        IBM AI INFRASTRUCTURE (watsonx.ai)                         |
| - Foundation Model: IBM Granite (ibm/granite-13b-chat-v2 or similar)              |
| - Inferencing, Token streaming, and Enterprise Guardrails                         |
+-----------------------------------------------------------------------------------+
```

### Specific Technologies & Services for Phase 1

**1. Primary Development Environment: IBM Bob**
*   **Role**: The exclusive coding, testing, and deployment interface for the team. All backend middleware, LangChain scripts, and frontend integrations will be developed within the IBM Bob environment to satisfy the primary challenge mandate.

**2. Core AI Engine: IBM watsonx.ai**
*   **Role**: Replaces DashScope/OpenAI entirely. This platform will host our model endpoints and provide the API keys. 
*   **Integration**: We will use the `langchain-ibm` package to natively connect our LangChain/LangFlow pipelines to the watsonx.ai inference endpoints.

**3. Foundation Models: IBM Granite**
*   **Role**: Replaces Qwen/GPT. We will utilize IBM Granite chat models (e.g., `ibm/granite-13b-chat-v2`) to power the personas in our Writer's Room. 
*   **Usage**: The Granite model will be loaded via LangChain's `WatsonxLLM` or `ChatWatsonx` classes, applying specific system prompts to isolate the behavior of the Brainstorming, Drafting, and Editor agents.

**4. Multi-Agent Orchestration: LangChain & LangFlow**
*   **Role**: Replaces custom routing scripts or AutoGen. 
*   **LangChain**: Will be used at the code level to manage prompt templates, agent memory, and output parsing (ensuring agents return structured JSON to render as spatial nodes).
*   **LangFlow**: We will build the multi-agent communication graph visually. This allows us to export the flow as a JSON configuration or expose it via LangFlow's REST API, which the backend will call when a user triggers an agent on the canvas. Showcasing this UI during the pitch will score high on Technical Execution.

**5. Real-Time Spatial State: Liveblocks & ReactFlow**
*   **Role**: Replaces standard database fetching for canvas state. Liveblocks will handle the WebSocket connections so multiple human writers and AI agents can manipulate the canvas simultaneously. When a LangChain agent generates a new concept via watsonx, our backend will push a mutation to Liveblocks, instantly rendering a new ReactFlow node on the users' screens.

**6. Backend Middleware: Python/FastAPI (Recommended for AI) or Node.js**
*   **Role**: Replaces Supabase edge functions. A lightweight backend server that acts as the bridge between the Liveblocks webhooks/client requests and the LangFlow/watsonx API. It receives the layout of the user's spatial workspace, formats it into text context, and triggers the appropriate LangChain workflow.

---

## Detailed Execution Steps
TEAM, ATTENTION. 

We are executing Phase 1 of the spatial workspace architecture. This phase completely pivots our stack to rely exclusively on the IBM watsonx ecosystem, LangChain/LangGraph orchestration, and Liveblocks for real-time spatial sync. All development will occur strictly within the IBM Bob environment. 

Below is the definitive, step-by-step implementation plan. Execute your assignments with absolute precision. We need a zero-latency, enterprise-grade integration between the frontend canvas and the IBM Granite foundation models.

### DEV 1: FRONTEND SPATIAL CANVAS (NEXT.JS + REACTFLOW + LIVEBLOCKS)
Your objective is to build the collaborative interface where human writers and AI agents coexist in real-time.

1.  **Initialize Collaboration Hub**: Set up the Next.js environment. Implement Liveblocks utilizing `@liveblocks/client` and `@liveblocks/react`. Establish the `RoomProvider` to handle real-time WebSocket connections. You must use Liveblocks Storage (CRDTs) to maintain the exact spatial coordinates (x, y) and metadata of every node.
2.  **Construct the Spatial Canvas**: Integrate `reactflow`. Map Liveblocks presence and storage data directly to ReactFlow's `nodes` and `edges` state. 
3.  **Develop Custom Node Types**: Build strictly typed React components for `StickyNoteNode`, `StoryboardNode`, and `AgentAvatarNode`. Ensure the `AgentAvatarNode` displays a processing state (spinner/status indicator) when an API call to the backend is active.
4.  **Implement Agent Triggers**: Create the interaction layer. When a user right-clicks a node or grouping of nodes, surface a context menu to invoke specific AI personas (Brainstorming, Drafting, Editor). This action must compile the selected subgraph data (node text, structural relationships) and dispatch a REST POST request to the FastAPI backend with the `roomId` and `contextPayload`.

### DEV 2: BACKEND MIDDLEWARE (PYTHON / FASTAPI)
Your objective is to build the high-performance bridge between the spatial canvas webhooks and our AI Orchestration layer.

1.  **Deploy Edge API Services**: Initialize a FastAPI application within IBM Bob. Expose asynchronous endpoints, primarily `/api/v1/orchestrate-agent`. Secure these endpoints using standard bearer token authentication.
2.  **Build Spatial Context Parser**: When the frontend sends a subgraph payload, build a serialization engine. The backend must ingest ReactFlow JSON state and parse it into a localized text or Markdown format that Granite models can actually comprehend (e.g., converting coordinates and edges into a hierarchical text outline).
3.  **Liveblocks Mutation Engine**: The backend must act as an omnipotent client in the Liveblocks room. Upon receiving structured JSON output from Dev 3's LangChain layer, authenticate via the Liveblocks REST API (or a headless WebSocket client) and push state mutations directly into the room's CRDT storage. This ensures the AI's generated sticky notes appear instantly on the frontend without requiring the client to poll.
4.  **Streaming & Connection Management**: Implement Server-Sent Events (SSE) or WebSockets on the FastAPI layer to stream AI status updates (e.g., "Agent routing complete", "Granite generating draft") back to the `AgentAvatarNode` on the frontend before the final Liveblocks mutation occurs.

### DEV 3: AI ORCHESTRATION (LANGCHAIN + LANGGRAPH)
Your objective is to manage agent memory, decision routing, and strict output enforcement.

1.  **Implement LangGraph Router**: Do not use basic sequential chains. Build a directed cyclic graph using LangGraph. Create a `Router Node` that analyzes the incoming spatial context and dynamically routes the flow to either the Brainstorming, Drafting, or Editor agent based on the user's prompt intent.
2.  **Session & Spatial Memory**: Implement `ConversationBufferMemory` utilizing a backend persistence layer (e.g., Redis or in-memory DB mapping). Key this memory exactly to the Liveblocks `roomId` and `userId` so agents retain context of previous spatial generations.
3.  **Persona Engineering**: Define strict LangChain `PromptTemplates` for each agent. The Brainstorming agent outputs lateral concepts; the Drafting agent expands bullet points into prose; the Editor refines constraints.
4.  **Structured Output Parsing**: This is non-negotiable. Use LangChain's `PydanticOutputParser` to force the AI to return strictly formatted JSON arrays representing ReactFlow nodes. The schema must include `nodeType`, `content`, `relative_x_offset`, and `relative_y_offset`. If the output violates this schema, implement an automatic retry mechanism within the LangGraph edge.

### DEV 4: IBM WATSONX.AI INTEGRATION (FOUNDATION MODELS)
Your objective is to bind Dev 3's orchestration logic directly to IBM Granite models running on enterprise infrastructure.

1.  **IBM Environment Provisioning**: Configure the `langchain-ibm` package in the backend dependencies. Securely inject the `WATSONX_APIKEY`, `WATSONX_URL`, and `WATSONX_PROJECT_ID` into the runtime environment.
2.  **Model Instantiation**: Replace all OpenAI/DashScope references. Instantiate the Granite models using `ChatWatsonx`. Specifically target `ibm/granite-13b-chat-v2` (or the exact designated variant for this tenant). 
3.  **Inference Tuning**: Parameterize the generation calls. Set `decoding_method="greedy"` for the Editor agent (requiring deterministic, strict formatting) and `decoding_method="sample"`, `temperature=0.7` for the Brainstorming agent. Define `max_new_tokens` aggressively to prevent timeout during large spatial graph generations.
4.  **Enterprise Guardrails**: Implement pre-generation and post-generation filtering using watsonx capabilities. Ensure the Granite model is shielded from prompt injection originating from the Liveblocks canvas text, and verify that the outgoing payload does not contain PII before it is serialized back to Dev 2's mutation engine.

Execute these directives. Code reviews will be strictly gated on adherence to this IBM-centric architecture.
