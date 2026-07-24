'use client';

import { useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Room } from "../../Room";
import { AvatarStack } from "@liveblocks/react-ui";
import { ToastProvider, useToast } from "@/components/ui/Toast";

// Dynamically import the canvas to avoid SSR issues with ReactFlow.
const WritersCanvas = dynamic(() => import("@/components/canvas/WritersCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-wine-950 flex items-center justify-center text-rose-300 animate-pulse font-mono tracking-widest text-sm uppercase">
      Initializing Neural Canvas...
    </div>
  ),
});

function RoomShell() {
  const params = useParams<{ id: string }>();
  const roomId = params?.id ?? "demo";
  const { toast } = useToast();

  const share = useCallback(() => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast("Room link copied to clipboard.", "success"))
      .catch(() => toast("Couldn't copy the link.", "error"));
  }, [toast]);

  return (
    <Room roomId={`writers-room-${roomId}`}>
      <main className="w-full h-screen bg-wine-950 overflow-hidden text-rose-50 relative">
        {/* Top navbar / controls header */}
        <header className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-50 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto bg-wine-900/70 backdrop-blur-md px-4 py-2 rounded-full border border-rose-400/15">
            <div className="w-3 h-3 rounded-full bg-rose-400 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
            <h1 className="font-display font-semibold text-sm tracking-wide text-rose-50">
              Writer&apos;s Room
            </h1>
            <span className="text-[10px] font-mono text-rose-100/50 bg-wine-950/60 px-2 py-0.5 rounded-full">
              {roomId}
            </span>
            <div className="ml-2 pl-3 border-l border-rose-400/15 flex items-center">
              <AvatarStack max={3} size={28} />
            </div>
          </div>

          <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={share}
              className="bg-wine-900/80 hover:bg-wine-800 backdrop-blur-md px-4 py-2 rounded-full border border-rose-400/15 text-rose-100 text-xs font-medium transition-all"
            >
              Share
            </button>
          </div>
        </header>

        {/* The infinite spatial canvas */}
        <WritersCanvas roomId={roomId} />
      </main>
    </Room>
  );
}

export default function RoomPage() {
  return (
    <ToastProvider>
      <RoomShell />
    </ToastProvider>
  );
}
