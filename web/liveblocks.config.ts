import type { LiveList, LiveObject } from "@liveblocks/client";

/**
 * Liveblocks room schema for the Writer's Room.
 *
 * The story graph (nodes + edges) lives in Liveblocks storage so every
 * collaborator sees the same canvas in real time and the room persists across
 * reloads. Presence (cursors/avatars) is handled separately by Liveblocks.
 *
 * Node/edge shapes mirror the React Flow / canvas-types definitions but are
 * kept as plain serializable records so they round-trip through storage.
 */

export type StoredNodeData = {
  title: string;
  content: string;
  sequence?: string;
  node_type?: string;
  proposed?: boolean;
  loading?: boolean;
};

export type StoredNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: StoredNodeData;
};

export type StoredEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
};

declare global {
  interface Liveblocks {
    // Custom user info set when authenticating.
    UserMeta: {
      id: string;
      info: {
        name: string;
        color: string;
        avatar: string;
      };
    };

    // Room storage: the shared story graph.
    Storage: {
      nodes: LiveList<LiveObject<StoredNode>>;
      edges: LiveList<LiveObject<StoredEdge>>;
    };

    // Custom events, for example for broadcast messages.
    RoomEvent: {};

    // Custom metadata set on threads.
    ThreadMetadata: {
      resolved: boolean;
      quote: string;
      time: number;
    };
  }
}

export {};
