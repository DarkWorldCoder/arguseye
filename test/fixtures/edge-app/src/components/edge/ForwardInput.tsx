import { forwardRef } from "react";
const ForwardInput = forwardRef<HTMLInputElement, { label: string }>(function ForwardInput({ label }, ref) {
  return <label>{label} <input ref={ref} defaultValue="typed" /></label>;
});
export default ForwardInput;
