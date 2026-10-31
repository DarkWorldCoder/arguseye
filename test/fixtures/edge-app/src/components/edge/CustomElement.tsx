if (!customElements.get("hello-chip")) customElements.define("hello-chip", class extends HTMLElement { connectedCallback() { this.attachShadow({ mode: "open" }).innerHTML = "<b>Shadow chip</b>"; } });
export default function CustomElement() { return <div>{/* @ts-ignore */}<hello-chip /></div>; }
