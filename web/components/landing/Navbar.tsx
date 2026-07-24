"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sticky site navbar with active-link highlighting and a mobile menu.
 * Themed to the landing page's warm rose family.
 */

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/room/demo", label: "Demo room" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && session?.user;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50">
      <div className="backdrop-blur-xl bg-wine-950/70 border-b border-rose-400/10">
        <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-400 to-rose-700 flex items-center justify-center shadow-[0_0_18px_rgba(244,63,94,0.3)] group-hover:shadow-[0_0_26px_rgba(244,63,94,0.5)] transition-shadow">
              <span className="font-display font-bold text-white text-lg">W</span>
            </div>
            <span className="font-display font-bold text-rose-50 tracking-tight">
              The Writers&apos; Room
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 rounded-full text-[13.5px] font-medium transition-colors",
                  isActive(link.href)
                    ? "text-rose-300 bg-rose-400/10"
                    : "text-rose-100/60 hover:text-rose-50 hover:bg-rose-400/5"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA + auth + mobile toggle */}
          <div className="flex items-center gap-3">
            <Link href="/room/demo" className="hidden md:block">
              <button className="px-5 py-2 rounded-full bg-rose-500 text-white font-semibold text-[13px] hover:bg-rose-400 hover:shadow-[0_0_24px_rgba(244,63,94,0.5)] transition-all">
                Open a room
              </button>
            </Link>

            {/* Auth buttons (desktop) */}
            {status === "loading" ? (
              <div className="hidden md:flex items-center gap-2">
                <div className="w-16 h-8 rounded-full bg-rose-400/10 animate-pulse" />
              </div>
            ) : isAuthenticated ? (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[13px] text-rose-100/70">
                  {session.user.name || session.user.email}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-400/20 text-rose-100/70 text-[12px] font-medium hover:bg-rose-400/10 hover:text-rose-50 transition-colors"
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/signin">
                  <button className="px-4 py-2 rounded-full text-rose-100/70 text-[13px] font-medium hover:text-rose-50 hover:bg-rose-400/5 transition-colors">
                    Log in
                  </button>
                </Link>
                <Link href="/signup">
                  <button className="px-4 py-2 rounded-full border border-rose-400/30 text-rose-300 text-[13px] font-semibold hover:bg-rose-400/10 hover:border-rose-400/50 transition-colors">
                    Sign up
                  </button>
                </Link>
              </div>
            )}

            <button
              onClick={() => setOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-rose-100/60 hover:text-rose-50 hover:bg-rose-400/5 transition-colors"
              aria-label="Toggle menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-rose-400/10 bg-wine-950/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-[14px] font-medium transition-colors",
                  isActive(link.href)
                    ? "text-rose-300 bg-rose-400/10"
                    : "text-rose-100/60 hover:text-rose-50 hover:bg-rose-400/5"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/room/demo" onClick={() => setOpen(false)} className="mt-2">
              <button className="w-full px-4 py-2.5 rounded-lg bg-rose-500 text-white font-semibold text-[14px]">
                Open a room
              </button>
            </Link>

            {/* Auth buttons (mobile) */}
            {isAuthenticated ? (
              <div className="mt-2 pt-2 border-t border-rose-400/10 flex flex-col gap-1">
                <span className="px-4 py-1 text-[12px] text-rose-100/50">
                  Signed in as {session.user.name || session.user.email}
                </span>
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-rose-100/70 text-[14px] font-medium hover:bg-rose-400/10 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            ) : (
              <div className="mt-2 pt-2 border-t border-rose-400/10 flex flex-col gap-1">
                <Link href="/signin" onClick={() => setOpen(false)}>
                  <button className="w-full px-4 py-2.5 rounded-lg text-rose-100/70 text-[14px] font-medium hover:bg-rose-400/5 transition-colors">
                    Log in
                  </button>
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)}>
                  <button className="w-full px-4 py-2.5 rounded-lg border border-rose-400/30 text-rose-300 text-[14px] font-semibold hover:bg-rose-400/10 transition-colors">
                    Sign up
                  </button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
