import { h } from "../utils/dom.js";

// Diálogo modal nativo (<dialog>). Devuelve una promesa que se resuelve al cerrarlo.
export function showDialog({ content, actionLabel = "Aceptar" }) {
  return new Promise((resolve) => {
    const action = h("button", { class: "btn btn--primary", type: "submit", text: actionLabel });
    const dialog = h(
      "dialog",
      { class: "dialog" },
      h("form", { method: "dialog" }, h("div", { class: "dialog__body" }, content), h("div", { class: "dialog__footer" }, action)),
    );
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve();
    });
    document.body.append(dialog);
    dialog.showModal();
    action.focus();
  });
}
