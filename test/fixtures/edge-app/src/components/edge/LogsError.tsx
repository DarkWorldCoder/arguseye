export default function LogsError() {
  console.error("Missing VITE_API_URL: falling back to /api");
  return <p>Rendered with a logged problem</p>;
}
