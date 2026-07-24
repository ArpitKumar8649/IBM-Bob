"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

/**
 * DemoModeButton — lets a visitor jump straight into the app without an
 * account. Sets a `demo_mode` cookie (read by the middleware) and navigates
 * to the dashboard.
 */
export default function DemoModeButton() {
  const router = useRouter();

  const enterDemo = () => {
    document.cookie = "demo_mode=true; path=/; max-age=86400; SameSite=Lax";
    router.push("/dashboard");
  };

  return (
    <button
      onClick={enterDemo}
      className="group inline-flex items-center gap-2 px-6 py-3 rounded-full border border-rose-400/40 text-rose-300 font-semibold text-sm hover:bg-rose-400/10 hover:border-rose-400/60 transition-all"
    >
      <Play size={15} className="group-hover:scale-110 transition-transform" />
      Try the demo — no sign-up
    </button>
  );
}
