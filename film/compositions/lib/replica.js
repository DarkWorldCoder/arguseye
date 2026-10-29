// Mounts a component captured by scripts/capture-live.mjs: its real markup and real CSS inside a shadow root,
// so it lays out exactly as the app does (media queries were resolved at the capture width).
// Returns { shadow, style, css } so a film can toggle the app's CSS on and off.
window.mountReplica = function mountReplica(host, data, width) {
  if (!document.getElementById("replica-fonts")) {
    const ff = document.createElement("style");
    ff.id = "replica-fonts";
    ff.textContent = data.fontFaces;
    document.head.appendChild(ff);
  }
  const rewrite = (css) =>
    css.split("\n").map((rule) => {
      if (rule.trimStart().startsWith("@")) return rule;
      const i = rule.indexOf("{");
      if (i < 0) return rule;
      const sel = rule.slice(0, i)
        .replace(/:root\b/g, ":host")
        .replace(/(^|[\s,>+~(])html\b/g, "$1.r-html")
        .replace(/(^|[\s,>+~(])body\b/g, "$1.r-body");
      return sel + rule.slice(i);
    }).join("\n");
  // @property rules (Tailwind v4's --tw-* defaults) only work at document scope, never inside a shadow root.
  const props = data.css.split("\n").filter((l) => l.startsWith("@property"));
  if (props.length) {
    let ps = document.getElementById("replica-props");
    if (!ps) { ps = document.createElement("style"); ps.id = "replica-props"; document.head.appendChild(ps); }
    for (const rule of props) if (!ps.textContent.includes(rule)) ps.textContent += rule + "\n";
  }
  const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
  const css = rewrite(data.css);
  shadow.innerHTML =
    `<style data-base>:host{display:block;width:${width}px;contain:layout paint;}</style><style data-app>${css}</style><style data-extra></style>` +
    `<div class="r-html ${data.htmlClass}"><div class="r-body ${data.bodyClass}" style="${data.bodyStyle}"><div id="root">${data.html}</div></div></div>`;
  return { shadow, style: shadow.querySelector("style[data-app]"), extra: shadow.querySelector("style[data-extra]"), css };
};
