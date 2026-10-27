import { nothing } from "./does-not-exist";

export function Broken() {
  return <p>{nothing}</p>;
}
