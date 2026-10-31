export default function Thrower({ fail = true }: { fail?: boolean }) { if (fail) throw new Error("Thrower exploded on purpose"); return <p>fine</p>; }
