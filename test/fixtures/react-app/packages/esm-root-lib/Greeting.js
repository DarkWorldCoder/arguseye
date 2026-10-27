import { useState } from "react";
export default function Greeting({ name }) {
  const [punctuation] = useState("!");
  return "Hello " + name + punctuation;
}
