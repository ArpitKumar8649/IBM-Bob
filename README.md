# 🎬 Writer's Room
**The Intelligent Spatial Co-Worker for the Next Generation of Storytelling.**

## 1. Problem Statement
The creative industry—comprising writers, showrunners, and narrative designers—has long been shackled by linear processes and fragmented toolsets. Storytelling is inherently non-linear, yet modern creative workflows force creators into restrictive, top-down document formats. When incorporating AI, the industry defaults to isolated "chat tools" (prompt-and-response interfaces) that fail to grasp the holistic context of a sprawling narrative universe. Creators don't need a smarter typewriter; they need a collaborative environment where characters, plotlines, and pacing can be visually mapped, dynamically interrogated, and iteratively refined in real-time.

## 2. Solution Description
**Writer's Room** revolutionizes narrative development by transforming AI from a passive chat interface into an active, spatial co-worker. Built as an expansive, real-time visual canvas, Writer's Room allows creators to drag, drop, and connect narrative nodes—characters, story beats, dialogue snippets, and lore. 

Rather than simply generating text, Writer's Room interacts with your story spatially. Our orchestration of specialized AI agents continuously analyzes the relationships between nodes, identifying plot holes, suggesting character arcs, and drafting scenes contextually. It is a living, breathing writer's room where the AI participates in the creative process alongside you, seeing the big picture and helping you connect the dots in a multidimensional storytelling space.

## 3. Selected Challenge Theme: Creative Industries
We proudly selected the **Creative Industries** theme for the IBM AI Builders July Challenge. Storytelling is the bedrock of entertainment, marketing, and media. By addressing the critical bottleneck in narrative production—the synthesis of complex, interconnected ideas—Writer's Room empowers creatives to scale their imaginations. It perfectly aligns with the challenge's goal to leverage AI to redefine creative workflows, offering a paradigm shift that elevates human creativity rather than replacing it.

## 4. AI Approach and Architecture
Writer's Room employs a state-of-the-art hybrid architecture, marrying a high-performance interactive frontend with a sophisticated, agentic AI backend powered by IBM Watsonx.ai.

### The Stack
*   **Frontend:** Next.js & React Flow
*   **Backend:** FastAPI & Python
*   **AI Orchestration:** LangGraph & IBM Watsonx.ai
*   **Data Validation:** Pydantic

### Architectural Flow & Agent Personas
Our AI pipeline is orchestrated by **LangGraph**, allowing for complex, cyclical, and stateful interactions between our AI agents, all driven by the robust capabilities of **IBM Watsonx.ai**.

1.  **The Spatial Interface (React Flow):** Creators interact with a 2D node-based canvas on the Next.js frontend. Every node (e.g., "Act 1, Scene 2", "Protagonist Motivation") and edge (the relationship between nodes) represents a state graph.
2.  **State Synchronization (FastAPI):** Changes on the canvas are streamed via FastAPI to our backend state manager.
3.  **Agentic Routing (Pydantic & LangGraph):** The current narrative graph state is parsed and validated using Pydantic structured outputs, ensuring deterministic data flow. LangGraph then routes the context to our specialized trio of AI personas:
    *   **The Brainstormer:** Analyzes isolated nodes and suggests lateral creative expansions (e.g., "What if this character has a hidden motive?").
    *   **The Drafter:** Takes connected structural nodes and synthesizes them into formatted scene drafts or dialogue blocks.
    *   **The Critic:** Reviews the generated content against the global canvas context, specifically looking for continuity errors, pacing issues, and character voice inconsistencies.
4.  **Feedback Loop:** The agents' outputs are serialized and pushed back to the React Flow canvas as new, proposed nodes or actionable insights, completing the spatial collaboration loop.

```text
[ React Flow Canvas (Next.js) ] <---> [ FastAPI Server ]
                                            |
                                            v
                                  [ LangGraph Orchestrator ]
                                  /           |            \
                                 v            v             v
                      [ Brainstormer ]   [ Drafter ]    [ Critic ]
                                 \            |            /
                                  \---> [ IBM Watsonx.ai ] 
```

## 5. How IBM Bob Was Used as Our Primary Development Tool
**IBM Bob was the indispensable backbone of this project.** From initial ideation to final deployment, IBM Bob served as our Primary AI Coding Assistant, radically accelerating our development cycle.

*   **System Architecture:** Bob helped conceptualize the bridge between the asynchronous React Flow state and the LangGraph state machine, ensuring our data models (via Pydantic) were robust and type-safe across the JS/Python divide.
*   **Debugging React Flow:** Managing infinite render loops and state synchronization in a complex spatial canvas is notoriously difficult. Bob pinpointed state mutation errors and optimized our custom node rendering, saving hours of frontend debugging.
*   **LangGraph Backend Engineering:** Bob was instrumental in writing the core Python backend. It guided the implementation of the LangGraph state channels, helped structure the node functions for our three AI personas, and seamlessly integrated the IBM Watsonx.ai API calls, ensuring the agents communicated flawlessly.

## 6. Future Roadmap
Writer's Room is just the beginning. Our vision for the platform extends into highly specialized, production-ready workflows.

*   **Phase 3: The Director's Cut Compiler:** A feature that linearizes the spatial graph, compiling the interconnected nodes into a standard, industry-formatted screenplay (Fountain/PDF format) at the click of a button.
*   **Phase 3.5: WebGL Optimization:** Transitioning the React Flow canvas to a WebGL-accelerated engine to support massive narrative universes (10,000+ nodes) without frame drops.
*   **Phase 4: Action Mode Table Reads:** Integrating text-to-speech (TTS) and emotional sentiment analysis to perform live, AI-voiced "table reads" of the drafted scenes directly within the canvas, allowing creators to *hear* the pacing of their scripts instantly.

## 7. Installation / Local Setup

### Prerequisites
*   Node.js (v18+)
*   Python (3.10+)
*   IBM Watsonx.ai API Credentials

### Frontend (Next.js)
```bash
cd web
npm install
# or yarn install / pnpm install

# Start the development server
npm run dev
```
The spatial canvas will be available at `http://localhost:3000`.

### Backend (FastAPI + LangGraph)
```bash
cd api
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install dependencies
pip install -r requirements.txt

# Configure Environment
cp .env.example .env
# Edit .env and add your WATSONX_API_KEY and WATSONX_PROJECT_ID

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```
The backend API will be available at `http://localhost:8000`, with interactive Swagger documentation at `http://localhost:8000/docs`.