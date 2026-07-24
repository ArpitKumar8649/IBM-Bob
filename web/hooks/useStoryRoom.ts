"use client";

/**
 * useStoryRoom — Liveblocks storage hook for the Writer's Room canvas.
 *
 * The story graph (nodes + edges) lives in Liveblocks storage so every
 * collaborator sees the same canvas in real time and the room persists across
 * reloads. This hook exposes:
 *
 * - `nodes` / `edges` — plain objects derived from storage (React Flow ready)
 * - `addNodes(nodes)` / `removeNode(id)` / `updateNode(id, data)` — mutations
 * - `addEdges(edges)` / `removeEdgesForNode(id)` — edge mutations
 * - `isLoaded` — true once storage is hydrated
 *
 * All mutations go through `useMutation` so they broadcast to every client
 * in the room instantly.
 */

import { useCallback } from "react";
import { LiveList, LiveObject } from "@liveblocks/client";
import { useMutation, useStorage } from "@liveblocks/react/suspense";
import type { StoredEdge, StoredNode, StoredNodeData } from "@/liveblocks.config";
import type { StoryEdge, StoryNode } from "@/lib/canvas-types";
import { EDGE_STYLES, type EdgeSemantics } from "@/lib/canvas-types";

/** Map a stored node to a React Flow StoryNode. */
function toStoryNode(stored: StoredNode): StoryNode {
  return {
    id: stored.id,
    type: stored.type || "plot_beat",
    position: stored.position,
    data: {
      title: stored.data.title,
      content: stored.data.content,
      sequence: stored.data.sequence,
      node_type: (stored.data.node_type as StoryNode["data"]["node_type"]) || "plot_beat",
      proposed: stored.data.proposed,
    },
  };
}

/** Map a stored edge to a React Flow StoryEdge. */
function toStoryEdge(stored: StoredEdge): StoryEdge {
  const label = (stored.label as EdgeSemantics) || "transitions_to";
  const style = EDGE_STYLES[label] || EDGE_STYLES.transitions_to;
  return {
    id: stored.id,
    source: stored.source,
    target: stored.target,
    type: "story",
    animated: true,
    data: { label },
    style: { stroke: style.stroke, strokeWidth: 1.75, strokeDasharray: style.dash },
  };
}

export function useStoryRoom() {
  // Read from storage. `useStorage` returns undefined until hydrated.
  const storedNodes = useStorage((root) => root.nodes);
  const storedEdges = useStorage((root) => root.edges);

  const isLoaded = storedNodes !== undefined && storedEdges !== undefined;

  // Derive plain React Flow objects from the storage snapshots.
  // useStorage returns readonly plain objects, not LiveObject instances.
  const nodes: StoryNode[] = isLoaded
    ? storedNodes.map((n) => toStoryNode(n as StoredNode))
    : [];
  const edges: StoryEdge[] = isLoaded
    ? storedEdges.map((e) => toStoryEdge(e as StoredEdge))
    : [];

  // --- Mutations ---
  // Inside useMutation, storage.get() returns live CRDT handles (LiveList /
  // LiveObject). Read with .toJSON(), mutate with .update() / .push() / .delete().

  const addNodes = useMutation(({ storage }, newNodes: StoredNode[]) => {
    const list = storage.get("nodes");
    for (const n of newNodes) {
      list.push(new LiveObject(n));
    }
  }, []);

  const removeNode = useMutation(({ storage }, nodeId: string) => {
    const list = storage.get("nodes");
    const idx = list.findIndex((n) => (n.toJSON() as StoredNode).id === nodeId);
    if (idx >= 0) list.delete(idx);

    // Also remove connected edges (iterate, collect indices, delete in reverse).
    const edgeList = storage.get("edges");
    const toRemove: number[] = [];
    edgeList.forEach((e, i) => {
      const edge = e.toJSON() as StoredEdge;
      if (edge.source === nodeId || edge.target === nodeId) toRemove.push(i);
    });
    for (let i = toRemove.length - 1; i >= 0; i--) edgeList.delete(toRemove[i]);
  }, []);

  const updateNode = useMutation(
    ({ storage }, nodeId: string, data: Partial<StoredNodeData>) => {
      const list = storage.get("nodes");
      list.forEach((item) => {
        const obj = item.toJSON() as StoredNode;
        if (obj.id === nodeId) {
          item.update({ data: { ...obj.data, ...data } });
        }
      });
    },
    []
  );

  const moveNode = useMutation(
    ({ storage }, nodeId: string, position: { x: number; y: number }) => {
      const list = storage.get("nodes");
      list.forEach((item) => {
        const obj = item.toJSON() as StoredNode;
        if (obj.id === nodeId) item.update({ position });
      });
    },
    []
  );

  const addEdges = useMutation(({ storage }, newEdges: StoredEdge[]) => {
    const list = storage.get("edges");
    for (const e of newEdges) {
      list.push(new LiveObject(e));
    }
  }, []);

  const resetRoom = useMutation(
    ({ storage }, seedNodes: StoredNode[], seedEdges: StoredEdge[]) => {
      const nodeList = storage.get("nodes");
      const edgeList = storage.get("edges");
      nodeList.clear();
      edgeList.clear();
      for (const n of seedNodes) nodeList.push(new LiveObject(n));
      for (const e of seedEdges) edgeList.push(new LiveObject(e));
    },
    []
  );

  return {
    nodes,
    edges,
    isLoaded,
    addNodes,
    removeNode,
    updateNode,
    moveNode,
    addEdges,
    resetRoom,
  };
}
