import { For, Show, createResource } from "solid-js";

const load = async () => ["Write tests", "Ship"];
export default function TodoList(props: { title?: string }) {
  const [todos] = createResource(load);
  return (
    <section>
      <h3>{props.title ?? "Todos"}</h3>
      <Show when={todos()} fallback={<p>Loading…</p>}>
        <ul><For each={todos()}>{(t) => <li>{t}</li>}</For></ul>
      </Show>
    </section>
  );
}
