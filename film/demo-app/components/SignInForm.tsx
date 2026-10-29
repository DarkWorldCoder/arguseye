"use client";
import { useTheme } from "@/providers/ThemeProvider";

export function SignInForm({ product = "Acme" }: { product?: string }) {
  const { accent } = useTheme();
  return (
    <form className="w-[380px] rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-300/40">
      <h2 className="text-2xl font-bold tracking-tight">Sign in to {product}</h2>
      <p className="mt-1 text-sm text-zinc-500">Welcome back. Pick up where you left off.</p>
      <label className="mt-6 block text-sm font-bold">Email</label>
      <input className="mt-2 h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm" defaultValue="maya@acme.dev" />
      <label className="mt-4 block text-sm font-bold">Password</label>
      <input className="mt-2 h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm" type="password" defaultValue="secret-pass" />
      <button className="mt-6 h-11 w-full rounded-xl text-sm font-bold text-white" style={{ background: accent }}>Continue</button>
      <p className="mt-4 text-center text-xs text-zinc-500">No account? <span style={{ color: accent }}>Create one</span></p>
    </form>
  );
}
