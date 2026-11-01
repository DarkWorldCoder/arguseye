export function Inspection({ fail = false }: { fail?: boolean }) {
  if (fail) {
    throw new Error("Original source inspection failure");
  }
  return <section>
    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Crect width='10' height='10'/%3E%3C/svg%3E" />
    <button />
  </section>;
}
