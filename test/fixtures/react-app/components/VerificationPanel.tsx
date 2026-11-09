import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Exercises delayed data, ambiguous controls and a real body-level dialog together. */
export function VerificationPanel({ delay = 0, fail = false }: { delay?: number; fail?: boolean }) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState("");
  useEffect(() => { const timer = setTimeout(() => setReady(true), delay); return () => clearTimeout(timer); }, [delay]);
  if (fail) throw new Error("Fixture render failed");
  return <section>
    <p role="status" data-testid="load-state">{ready ? "Ready to review" : "Loading data"}</p>
    <button onClick={() => setSaved("first")}>Save</button>
    <button onClick={() => setSaved("second")}>Save</button>
    <button aria-expanded={open} onClick={() => setOpen(true)}>Open dialog</button>
    <output>{saved}</output>
    <span data-testid="hidden-signal" hidden />
    {open && createPortal(<div role="dialog" aria-label="Review"><label><input type="checkbox" />Accept</label><button onClick={() => { setSaved("confirmed"); setOpen(false); }}>Confirm</button></div>, document.body)}
  </section>;
}

/** Checks native and inherited ARIA-disabled controls without simulating an application backend. */
export function VerificationForm({ delay = 0 }: { delay?: number }) {
  const [blocked, setBlocked] = useState(true);
  useEffect(() => {
    if (!delay) return;
    const timer = setTimeout(() => setBlocked(false), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return <section>
    <fieldset disabled={blocked}><button>Submit</button></fieldset>
    <div aria-disabled={blocked}><button>Archive</button></div>
    <button disabled={blocked}>Publish</button>
  </section>;
}
