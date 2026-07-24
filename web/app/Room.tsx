"use client";

import { ReactNode } from "react";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
} from "@liveblocks/react/suspense";
import { Cursors } from "@liveblocks/react-ui";
import "@liveblocks/react-ui/styles.css";
import { LiveList } from "@liveblocks/client";

// Use the environment variable if available, fallback to the hardcoded key during testing
const publicApiKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY || "pk_dev_vEx7Sf6pn-oivT9FKGwB2ISW7DcvBcfrL8DcvRkiJxAFSNf3fZqrBFfeFLqjfJuA";

export function Room({ children, roomId = "writers-room-demo" }: { children: ReactNode; roomId?: string }) {
  return (
    <LiveblocksProvider publicApiKey={publicApiKey}>
      <RoomProvider
        id={roomId}
        initialStorage={{
          nodes: new LiveList([]),
          edges: new LiveList([]),
        }}
      >
        <ClientSideSuspense fallback={<div className="w-full h-screen bg-void-900 flex items-center justify-center text-hologram animate-pulse font-mono tracking-widest text-sm uppercase">Initializing Multiplayer Node...</div>}>
          <Cursors />
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
