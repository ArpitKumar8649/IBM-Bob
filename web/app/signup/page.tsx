"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { googleAuthEnabled } from "@/lib/features";

/**
 * Sign-up page — matches the sign-in card's rose glass design with 3D tilt
 * and traveling light beams. Fields: name, email, password, confirm password,
 * Google sign-up, link to sign-in.
 */

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "placeholder:text-rose-100/30",
        "focus-visible:border-rose-400/50 focus-visible:ring-rose-400/30 focus-visible:ring-[3px]",
        className
      )}
      {...props}
    />
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const passwordsMatch = confirm.length === 0 || password === confirm;

  return (
    <div className="min-h-screen w-full bg-wine-950 relative overflow-hidden flex items-center justify-center px-6">
      {/* Rose gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-rose-500/30 via-rose-700/40 to-wine-950" />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* Glows */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[120vh] h-[60vh] rounded-b-[50%] bg-rose-400/20 blur-[80px]" />
      <motion.div
        className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[100vh] h-[60vh] rounded-b-full bg-rose-300/20 blur-[60px]"
        animate={{ opacity: [0.15, 0.3, 0.15], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-[90vh] h-[90vh] rounded-t-full bg-rose-400/20 blur-[60px]"
        animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, repeatType: "mirror", delay: 1 }}
      />
      <div className="absolute left-1/4 top-1/4 w-96 h-96 bg-rose-300/5 rounded-full blur-[100px] animate-pulse opacity-40" />
      <div className="absolute right-1/4 bottom-1/4 w-96 h-96 bg-rose-300/5 rounded-full blur-[100px] animate-pulse delay-1000 opacity-40" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-sm relative z-10"
        style={{ perspective: 1500 }}
      >
        <motion.div
          className="relative"
          style={{ rotateX, rotateY }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          whileHover={{ z: 10 }}
        >
          <div className="relative group">
            {/* Card glow */}
            <motion.div
              className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-70 transition-opacity duration-700"
              animate={{
                boxShadow: [
                  "0 0 10px 2px rgba(251,113,133,0.03)",
                  "0 0 15px 5px rgba(251,113,133,0.05)",
                  "0 0 10px 2px rgba(251,113,133,0.03)",
                ],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }}
            />

            {/* Traveling light beams */}
            <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
              <motion.div
                className="absolute top-0 left-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-rose-200 to-transparent opacity-70"
                animate={{ left: ["-50%", "100%"], opacity: [0.3, 0.7, 0.3] }}
                transition={{ left: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror" } }}
              />
              <motion.div
                className="absolute top-0 right-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-rose-200 to-transparent opacity-70"
                animate={{ top: ["-50%", "100%"], opacity: [0.3, 0.7, 0.3] }}
                transition={{ top: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 0.6 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 0.6 } }}
              />
              <motion.div
                className="absolute bottom-0 right-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-rose-200 to-transparent opacity-70"
                animate={{ right: ["-50%", "100%"], opacity: [0.3, 0.7, 0.3] }}
                transition={{ right: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 1.2 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 1.2 } }}
              />
              <motion.div
                className="absolute bottom-0 left-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-rose-200 to-transparent opacity-70"
                animate={{ bottom: ["-50%", "100%"], opacity: [0.3, 0.7, 0.3] }}
                transition={{ bottom: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 1.8 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 1.8 } }}
              />
            </div>

            {/* Card border glow */}
            <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-r from-rose-200/3 via-rose-200/7 to-rose-200/3 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />

            {/* Glass card */}
            <div className="relative bg-wine-900/60 backdrop-blur-xl rounded-2xl p-6 border border-rose-400/10 shadow-2xl overflow-hidden">
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: `linear-gradient(135deg, #fda4af 0.5px, transparent 0.5px), linear-gradient(45deg, #fda4af 0.5px, transparent 0.5px)`,
                  backgroundSize: "30px 30px",
                }}
              />

              {/* Header */}
              <div className="text-center space-y-1 mb-5">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="mx-auto w-10 h-10 rounded-full border border-rose-400/20 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-rose-400 to-rose-700"
                >
                  <span className="text-lg font-bold text-white">W</span>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl font-display font-bold text-rose-50"
                >
                  Create Your Account
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-rose-100/60 text-xs"
                >
                  Join The Writers&apos; Room and start creating
                </motion.p>
              </div>

              {/* Sign-up form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!passwordsMatch) return;
                  setIsLoading(true);
                  setError(null);
                  try {
                    // 1. Register the account.
                    const res = await fetch("/api/auth/signup", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name, email, password }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.error || "Signup failed");
                    }
                    // 2. Sign in immediately with the new credentials.
                    const result = await signIn("credentials", {
                      email,
                      password,
                      redirect: false,
                    });
                    if (result?.error) {
                      throw new Error("Account created — please sign in");
                    }
                    router.push("/dashboard");
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Signup failed");
                    setIsLoading(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  {/* Name */}
                  <div className={`relative ${focusedInput === "name" ? "z-10" : ""}`}>
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <User
                        className={`absolute left-3 w-4 h-4 transition-all duration-300 ${
                          focusedInput === "name" ? "text-rose-300" : "text-rose-100/40"
                        }`}
                      />
                      <Input
                        type="text"
                        placeholder="Full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onFocus={() => setFocusedInput("name")}
                        onBlur={() => setFocusedInput(null)}
                        className="w-full bg-rose-400/5 border-transparent focus:border-rose-400/30 text-rose-50 h-10 transition-all duration-300 pl-10 pr-3 focus:bg-rose-400/10"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className={`relative ${focusedInput === "email" ? "z-10" : ""}`}>
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <Mail
                        className={`absolute left-3 w-4 h-4 transition-all duration-300 ${
                          focusedInput === "email" ? "text-rose-300" : "text-rose-100/40"
                        }`}
                      />
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedInput("email")}
                        onBlur={() => setFocusedInput(null)}
                        className="w-full bg-rose-400/5 border-transparent focus:border-rose-400/30 text-rose-50 h-10 transition-all duration-300 pl-10 pr-3 focus:bg-rose-400/10"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className={`relative ${focusedInput === "password" ? "z-10" : ""}`}>
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <Lock
                        className={`absolute left-3 w-4 h-4 transition-all duration-300 ${
                          focusedInput === "password" ? "text-rose-300" : "text-rose-100/40"
                        }`}
                      />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedInput("password")}
                        onBlur={() => setFocusedInput(null)}
                        className="w-full bg-rose-400/5 border-transparent focus:border-rose-400/30 text-rose-50 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-rose-400/10"
                      />
                      <div onClick={() => setShowPassword(!showPassword)} className="absolute right-3 cursor-pointer">
                        {showPassword ? (
                          <Eye className="w-4 h-4 text-rose-100/40 hover:text-rose-300 transition-colors duration-300" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-rose-100/40 hover:text-rose-300 transition-colors duration-300" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div className={`relative ${focusedInput === "confirm" ? "z-10" : ""}`}>
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <Lock
                        className={`absolute left-3 w-4 h-4 transition-all duration-300 ${
                          focusedInput === "confirm" ? "text-rose-300" : "text-rose-100/40"
                        }`}
                      />
                      <Input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirm password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        onFocus={() => setFocusedInput("confirm")}
                        onBlur={() => setFocusedInput(null)}
                        className={cn(
                          "w-full bg-rose-400/5 border-transparent text-rose-50 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-rose-400/10",
                          !passwordsMatch
                            ? "border-red-400/50 focus:border-red-400/50"
                            : "focus:border-rose-400/30"
                        )}
                      />
                      <div onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 cursor-pointer">
                        {showConfirm ? (
                          <Eye className="w-4 h-4 text-rose-100/40 hover:text-rose-300 transition-colors duration-300" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-rose-100/40 hover:text-rose-300 transition-colors duration-300" />
                        )}
                      </div>
                    </div>
                    {!passwordsMatch && (
                      <p className="text-[11px] text-red-400 mt-1 pl-1">Passwords don&apos;t match</p>
                    )}
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <p className="text-xs text-red-400 text-center">{error}</p>
                )}

                {/* Sign up button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading || !passwordsMatch}
                  className="w-full relative group/button mt-5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-rose-500/20 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />
                  <div className="relative overflow-hidden bg-rose-500 hover:bg-rose-400 text-white font-medium h-10 rounded-lg transition-all duration-300 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      {isLoading ? (
                        <motion.div
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-center"
                        >
                          <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                        </motion.div>
                      ) : (
                        <motion.span
                          key="button-text"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-center gap-1 text-sm font-medium"
                        >
                          Create Account
                          <ArrowRight className="w-3 h-3 group-hover/button:translate-x-1 transition-transform duration-300" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>

                {googleAuthEnabled && (
                  <>
                    {/* Divider */}
                    <div className="relative mt-2 mb-5 flex items-center">
                      <div className="flex-grow border-t border-rose-400/10" />
                      <span className="mx-3 text-xs text-rose-100/40">or</span>
                      <div className="flex-grow border-t border-rose-400/10" />
                    </div>

                    {/* Google Sign Up */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                      className="w-full relative group/google"
                    >
                      <div className="absolute inset-0 bg-rose-400/5 rounded-lg blur opacity-0 group-hover/google:opacity-70 transition-opacity duration-300" />
                      <div className="relative overflow-hidden bg-rose-400/5 text-rose-50 font-medium h-10 rounded-lg border border-rose-400/15 hover:border-rose-400/30 transition-all duration-300 flex items-center justify-center gap-2">
                        <GoogleIcon />
                        <span className="text-rose-100/80 group-hover/google:text-rose-50 transition-colors text-xs">
                          Sign up with Google
                        </span>
                      </div>
                    </motion.button>
                  </>
                )}

                {/* Sign in link */}
                <motion.p
                  className="text-center text-xs text-rose-100/60 mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  Already have an account?{" "}
                  <Link href="/signin" className="relative inline-block group/signin">
                    <span className="relative z-10 text-rose-300 group-hover/signin:text-rose-200 transition-colors duration-300 font-medium">
                      Sign in
                    </span>
                    <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-rose-300 group-hover/signin:w-full transition-all duration-300" />
                  </Link>
                </motion.p>
              </form>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
