import { createSignal } from "solid-js";
import { useTheme } from "../theme";

export function Counter(props: { start: number }) {
  const [count, setCount] = createSignal(props.start);
  const theme = useTheme();
  return <button class="count" onClick={() => setCount(count() + 1)}>Count {count()} ({theme})</button>;
}
