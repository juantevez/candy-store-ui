import { h } from "../utils/dom.js";

const DURATION_MS = { success: 3500, info: 3500, warning: 6000, error: 7000 };

export function toast(message, type = "info") {
  const container = document.getElementById("toasts");
  if (!container) return;
  const element = h("div", { class: `toast toast--${type}`, role: type === "error" ? "alert" : "status", text: message });
  container.append(element);
  setTimeout(() => element.remove(), DURATION_MS[type] ?? 4000);
}
