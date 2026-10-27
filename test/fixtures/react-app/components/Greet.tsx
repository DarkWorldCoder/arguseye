import { Greeting } from "esm-root-lib";

export function Greet({ name }: { name: string }) {
  return <p><Greeting name={name} /></p>;
}
