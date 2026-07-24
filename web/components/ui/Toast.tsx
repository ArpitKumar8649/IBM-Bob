"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

/**
 * Minimal toast system — replaces window.alert() with non-blocking,
 * auto-dismissing notifications that fit the Writer's Room aesthetic.
 */

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  toast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const KIND_CONFIG: Record<
  ToastKind,
  { icon: React.ElementType; accent: string }
> = {
  success: { icon: CheckCircle2, accent: "#05D582" },
  error: { icon: AlertTriangle, accent: "#FF2A6D" },
  info: { icon: Info, accent: "#00F0FF" },
};

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const { icon: Icon, accent } = KIND_CONFIG[t.kind];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border bg-wine-900/95 backdrop-blur-xl shadow-2xl"
                style={{ borderColor: `${accent}55` }}
              >
                <Icon size={16} className="mt-0.5 shrink-0" style={{ color: accent }} />
                <p className="text-[12.5px] leading-snug text-rose-50 flex-1">
                  {t.message}
                </p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-rose-100/50 hover:text-rose-50 shrink-0"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
