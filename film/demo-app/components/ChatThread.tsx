type Message = { from: "them" | "me"; text: string; time: string };

type ChatThreadProps = {
  name: string;
  status: string;
  messages?: Message[];
};

export function ChatThread({
  name,
  status,
  messages = [
    { from: "them", text: "Did the new checkout ship?", time: "9:41" },
    { from: "me", text: "Yes, it's live. The agent checked it on mobile first.", time: "9:42" },
    { from: "them", text: "The button doesn't wrap anymore? 🙌", time: "9:42" },
    { from: "me", text: "Fixed before it reached review.", time: "9:43" },
  ],
}: ChatThreadProps) {
  const initials = name.split(" ").map((p) => p[0]).join("");
  return (
    <article className="w-[340px] overflow-hidden rounded-[28px] bg-white shadow-xl shadow-violet-950/10 ring-1 ring-zinc-200">
      <header className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-sm font-bold text-white">
          {initials}
        </span>
        <div className="flex-1">
          <p className="font-semibold text-zinc-900">{name}</p>
          <p className="flex items-center gap-1.5 text-xs text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {status}
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-2.5 bg-zinc-50 px-4 py-5">
        {messages.map((m, i) => (
          <div key={i} className={m.from === "me" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={
                m.from === "me"
                  ? "max-w-[78%] [overflow-wrap:anywhere] rounded-2xl rounded-br-md bg-violet-600 px-3.5 py-2 text-sm text-white shadow-sm"
                  : "max-w-[78%] [overflow-wrap:anywhere] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-sm text-zinc-800 shadow-sm ring-1 ring-zinc-200"
              }
            >
              {m.text}
              <span className={m.from === "me" ? "ml-2 text-[10px] text-violet-200" : "ml-2 text-[10px] text-zinc-400"}>{m.time}</span>
            </p>
          </div>
        ))}
        <div className="flex w-14 items-center justify-center gap-1 rounded-2xl rounded-bl-md bg-white px-3 py-2.5 shadow-sm ring-1 ring-zinc-200">
          {[0, 1, 2].map((d) => (
            <span key={d} className="h-1.5 w-1.5 rounded-full bg-zinc-400" style={{ opacity: 1 - d * 0.25 }} />
          ))}
        </div>
      </div>
    </article>
  );
}
