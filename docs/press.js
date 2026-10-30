const status = document.getElementById("copy-status");

// Keep the descriptions readable and selectable when clipboard access is unavailable.
for (const button of document.querySelectorAll("[data-copy]")) {
  const target = document.getElementById(button.dataset.copy);
  if (!target || !status) continue;
  button.hidden = false;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      status.textContent = `${button.dataset.label} copied.`;
    } catch {
      status.textContent = "Select the description text and copy it with your keyboard or browser menu.";
    }
  });
}
