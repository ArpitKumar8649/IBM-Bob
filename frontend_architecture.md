# Writer's Room Frontend Architecture

## Design System
# Writer's Room: UI/UX Architecture

## 1. Cinematic Tailwind Color Palette (Dark Mode Primary)
The visual language relies on deep voids, glassmorphic depths, and high-contrast, data-driven accents. 

```javascript
// tailwind.config.js extension
theme: {
  extend: {
    colors: {
      void: {
        900: '#030305', // Infinite canvas background
        800: '#0A0A10', // Elevated surfaces
        700: '#14141E', // Active component backgrounds
      },
      hologram: {
        DEFAULT: '#00F0FF', // 'Minority Report' interactive cyan
        muted: '#005D66',   // Inactive/ambient states
        glow: 'rgba(0, 240, 255, 0.15)', // Soft component drop-shadows
      },
      script: {
        primary: '#F2F2F7', // Crisp, high-readability text for storyboards
        secondary: '#8E8E93', // Metadata, agent status, subtle hints
        marker: '#FFCC00',  // 'Final Draft' style revision/note highlights
      }
    },
    backgroundImage: {
      'spatial-grid': 'radial-gradient(circle, #14141E 1px, transparent 1px)',
    }
  }
}
```

## 2. Spatial Layout Architecture
The interface maximizes cognitive space by stripping away traditional IDE chrome in favor of floating, context-aware layers.

*   **The Canvas (Z-Index: 0):** An infinite, panning, and zoomable 2D plane utilizing the `bg-spatial-grid` pattern. Script scenes, character nodes, and reference images float as movable cards. It is borderless, fading into pure `#030305` at the screen edges using an inset CSS shadow mask.
*   **The Agent Dock (Z-Index: 40):** A pill-shaped, frosted-glass (`backdrop-blur-2xl bg-void-800/60`) dock anchored to the bottom-center of the screen. It houses the AI co-writers. When an agent is generating ideas, its avatar emits a pulsing `hologram-glow`. Clicking an agent expands the dock vertically into a command palette for prompt input.
*   **Contextual Toolbars (Z-Index: 50):** Static sidebars are eliminated. Instead, selecting a storyboard card triggers a **Radial Menu** or **Floating Action Bar** positioned exactly 16px above the cursor. Global actions (Export, Project Settings) live in a minimalist Top Bar that fades out to 0% opacity when the mouse is stationary for >3 seconds.

## 3. Framer Motion Interaction Rules
To achieve a "buttery smooth," premium feel, all animations must adhere to these three physical UI rules:

### Rule 1: Spring Physics over Linear Easings (The "Weight" Rule)
Never use standard CSS `ease-in-out` for spatial movements. Storyboard cards and expanding docks must feel like physical objects with mass and friction.
```javascript
// Universal spring configuration for dragging/expanding
const cinematicSpring = {
  type: "spring",
  stiffness: 250,
  damping: 25,
  mass: 0.8
};
// Usage: <motion.div transition={cinematicSpring} layout />
```

### Rule 2: The "Breathe & Glow" Micro-interaction (Hover States)
High-end software feels alive. Interactive elements should not merely change color on hover; they should physically elevate toward the user and emit light.
```javascript
// Applied to Toolbars, Agent Avatars, and Action Buttons
const hoverState = {
  scale: 1.02,
  y: -2,
  filter: "drop-shadow(0px 8px 16px rgba(0, 240, 255, 0.25))",
  transition: { type: "tween", ease: "easeOut", duration: 0.15 }
};
// Usage: <motion.button whileHover={hoverState} />
```

### Rule 3: Staggered Spatial Entrances (The "Cascade" Rule)
When loading a complex storyboard tree, UI elements must never pop in simultaneously. They must materialize sequentially, tracing the user's intended reading path.
```javascript
// Parent Container
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

// Child Cards
const item = {
  hidden: { opacity: 0, y: 20, scale: 0.95, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: cinematicSpring }
};
// Usage: Parent <motion.div variants={container}>, Children <motion.div variants={item}>
```

## 1. WritersCanvas.tsx
```tsx
'use client';

import React, { useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes: Node[] = [
  {
    id: 'scene-1',
    position: { x: 250, y: 150 },
    data: { label: 'Scene 1: The Awakening' },
    style: { 
      background: '#14141E', 
      color: '#F2F2F7', 
      border: '1px solid #00F0FF',
      boxShadow: '0px 8px 16px rgba(0, 240, 255, 0.15)'
    }
  },
  {
    id: 'scene-2',
    position: { x: 250, y: 350 },
    data: { label: 'Scene 2: Agent Protocol' },
    style: { 
      background: '#0A0A10', 
      color: '#8E8E93', 
      border: '1px solid #005D66' 
    }
  },
];

const initialEdges: Edge[] = [
  { 
    id: 'edge-1', 
    source: 'scene-1', 
    target: 'scene-2', 
    animated: true, 
    style: { stroke: '#00F0FF' } 
  },
];

export default function WritersCanvas() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  return (
    <div className="w-full h-screen bg-void-900 bg-spatial-grid">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className="dark"
      >
        <Background color="#14141E" />
        <Controls 
          className="bg-void-800 border-void-700 fill-script-primary" 
        />
        <MiniMap 
          nodeColor="#14141E"
          maskColor="rgba(3, 3, 5, 0.8)"
          style={{ backgroundColor: '#0A0A10', border: '1px solid #14141E' }}
        />
      </ReactFlow>
    </div>
  );
}
```

## 2. PlotBeatNode.tsx
```typescript
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';

type PlotBeatData = {
  title: string;
  content: string;
  sequence?: string;
  onGenerate?: () => void;
};

// Framer Motion Rules (Rule 1 & Rule 2)
const hoverState = {
  scale: 1.02,
  y: -2,
  filter: "drop-shadow(0px 8px 16px rgba(0, 240, 255, 0.25))",
  transition: { type: "tween", ease: "easeOut", duration: 0.15 }
};

const cinematicSpring = {
  type: "spring",
  stiffness: 250,
  damping: 25,
  mass: 0.8
};

const PlotBeatNode = ({ data, isConnectable }: NodeProps<PlotBeatData>) => {
  return (
    <motion.div
      layout
      transition={cinematicSpring}
      whileHover={hoverState}
      className="relative w-[340px] bg-void-800/80 backdrop-blur-2xl border border-void-700 rounded-2xl p-5 shadow-2xl group"
    >
      {/* Top Handle for Incoming Connections */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3.5 h-3.5 bg-hologram-muted border-2 border-void-900 rounded-full transition-colors duration-300 group-hover:bg-hologram group-hover:shadow-[0_0_8px_rgba(0,240,255,0.5)]"
      />

      {/* Header */}
      <div className="flex justify-between items-start mb-4 border-b border-void-700/60 pb-3">
        <h3 className="text-script-primary font-medium text-lg tracking-wide m-0">
          {data.title || 'Untitled Beat'}
        </h3>
        {data.sequence && (
          <span className="bg-void-900 border border-void-700 text-script-secondary text-[10px] px-2.5 py-1 rounded-full font-mono uppercase tracking-widest">
            {data.sequence}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="text-script-secondary text-sm leading-relaxed mb-5 min-h-[72px]">
        {data.content || 'Enter scene description or dialogue notes here...'}
      </div>

      {/* Footer / Actions */}
      <div className="flex justify-end pt-2">
        <motion.button
          whileHover={hoverState}
          whileTap={{ scale: 0.95 }}
          onClick={data.onGenerate}
          className="flex items-center gap-2 bg-void-900/60 border border-hologram/30 hover:border-hologram hover:bg-hologram/10 text-hologram px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors duration-300"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generate
        </motion.button>
      </div>

      {/* Bottom Handle for Outgoing Connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-3.5 h-3.5 bg-hologram-muted border-2 border-void-900 rounded-full transition-colors duration-300 group-hover:bg-hologram group-hover:shadow-[0_0_8px_rgba(0,240,255,0.5)]"
      />
    </motion.div>
  );
};

export default memo(PlotBeatNode);
```
