import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function DocsPage() {
  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 px-10 py-12">
      <Breadcrumbs items={["Docs", "Agents", "Render evidence"]} />
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">Render evidence</h1>
    </div>
  );
}
