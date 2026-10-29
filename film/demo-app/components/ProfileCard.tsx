"use client";
import { useTheme } from "@/providers/ThemeProvider";

export function ProfileCard({ name, role, avatar, followers }: { name: string; role: string; avatar: string; followers: number }) {
  const { accent } = useTheme();
  return (
    <div className="w-[340px] rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-xl shadow-zinc-300/40">
      <img src={avatar} alt={name} className="mx-auto h-20 w-20 rounded-full" />
      <p className="mt-4 text-lg font-bold">{name}</p>
      <p className="text-sm text-zinc-500">{role}</p>
      <p className="mt-3 text-sm text-zinc-600"><b>{followers.toLocaleString("en-US")}</b> followers</p>
      <button className="mt-5 h-10 w-full rounded-xl border text-sm font-bold" style={{ borderColor: accent, color: accent }}>Follow</button>
    </div>
  );
}
