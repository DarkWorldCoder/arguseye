// A typical embed snippet: an IIFE with an "already loaded" guard, config from a global or its own <script> tag.
(function () {
  var script = document.currentScript;
  var config = window.__ARGUSEYE_WIDGET_CONFIG__ || window.ChatConfig || {};
  window.__chatLoads = (window.__chatLoads || 0) + 1;
  if (window.ChatWidget) return;

  var host = document.createElement("div");
  host.id = "chat-widget";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML =
    "<style>" +
    ".panel{position:fixed;right:24px;bottom:96px;width:280px;padding:16px;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18);font:14px system-ui,sans-serif}" +
    ".bubble{position:fixed;right:24px;bottom:24px;width:56px;height:56px;border:0;border-radius:50%;background:rgb(37,99,235);color:#fff;font:600 13px system-ui,sans-serif}" +
    "</style>" +
    '<section class="panel" aria-label="Chat"><h2></h2><p class="greeting"></p><p class="loads"></p><p class="source"></p></section>' +
    '<button class="bubble" aria-label="Open chat">Chat</button>';
  root.querySelector("h2").textContent = config.title || "Support";
  root.querySelector(".greeting").textContent = (script && script.dataset.greeting) || "How can we help?";
  root.querySelector(".loads").textContent = "Loaded " + window.__chatLoads + " time(s)";
  root.querySelector(".source").textContent = "Script: " + (script && script.src ? script.src.split("/").pop().split("?")[0] : "none");
  window.ChatWidget = { host: host, version: "1.0.0" };
})();
