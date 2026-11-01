import { useState } from "preact/hooks";
import { useTheme } from "../theme";

export function Counter({ start }: { start: number }) {
  const [count, setCount] = useState(start);
  const theme = useTheme();
  return <button class="counter" onClick={() => setCount(count + 1)}>Count {count} ({theme})</button>;
}
