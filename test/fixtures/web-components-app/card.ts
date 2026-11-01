import { LitElement, html, css } from "lit";
class DemoCard extends LitElement {
  static properties = { label: { type: String }, count: { state: true } };
  static styles = css`:host{display:block;width:320px}article{background:var(--card-bg);padding:24px;border-radius:16px}button{font:inherit}`;
  declare label: string;
  declare count: number;
  constructor() { super(); this.label = "Default"; this.count = 0; }
  render() { return html`<article><h1>${this.label}</h1><button @click=${() => this.count++}>Count ${this.count}</button></article>`; }
}
customElements.define("demo-card", DemoCard);
