export function Chip({ label }: { label: string }) {
  return <span style={{ display: "inline-block", width: 180, height: 40, background: "#eee" }}>{label}</span>;
}
