import type { ComponentType } from "react";
function withFrame<P extends object>(Inner: ComponentType<P>) { return function Framed(props: P) { return <div style={{ border: "2px solid teal", padding: 8 }}><Inner {...props} /></div>; }; }
function Label({ text }: { text: string }) { return <span>HOC label {text}</span>; }
export default withFrame(Label);
