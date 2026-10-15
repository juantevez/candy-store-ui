import { h } from "../../utils/dom.js";
import { formatAmount, formatCents } from "../../utils/money.js";

export function createTicketPanel({ ticket, availableFor, onLimit }) {
  const count = h("span", { class: "badge" });
  const lines = h("ul", { class: "ticket__lines", "aria-label": "Productos del ticket" });
  const total = h("output", { "aria-live": "polite" });
  const clearButton = h("button", {
    class: "btn btn--ghost",
    type: "button",
    text: "Vaciar",
    onClick: () => ticket.clear(),
  });

  const element = h(
    "section",
    { class: "card ticket", "aria-labelledby": "ticket-title" },
    h("div", { class: "ticket__header" }, h("h2", { class: "card__title", id: "ticket-title", text: "Ticket" }), count, clearButton),
    lines,
    h("div", { class: "ticket__total" }, h("span", { text: "Total" }), total),
  );

  function increase(line) {
    const available = availableFor(line.product.product_id);
    if (line.quantity >= available) {
      onLimit(line.product, available);
      return;
    }
    ticket.setQuantity(line.product.product_id, line.quantity + 1);
  }

  function renderLine(line, locked) {
    const id = line.product.product_id;
    const short = line.shortAvailable !== undefined;
    const detail = short
      ? `Solo hay ${line.shortAvailable} en el salón`
      : `${line.quantity} × ${formatAmount(line.product.price)}`;
    return h(
      "li",
      { class: "ticket-line", dataset: { short: String(short) } },
      h("span", { class: "ticket-line__name", text: line.product.name }),
      h("span", { class: "ticket-line__detail", text: detail }),
      h(
        "span",
        { class: "ticket-line__qty" },
        h("button", {
          class: "btn btn--icon",
          type: "button",
          text: "−",
          disabled: locked,
          "aria-label": `Quitar una unidad de ${line.product.name}`,
          onClick: () => ticket.setQuantity(id, line.quantity - 1),
        }),
        h("output", { text: String(line.quantity) }),
        h("button", {
          class: "btn btn--icon",
          type: "button",
          text: "+",
          disabled: locked,
          "aria-label": `Agregar una unidad de ${line.product.name}`,
          onClick: () => increase(line),
        }),
      ),
      h("span", { class: "ticket-line__total", text: formatCents(line.subtotalCents) }),
      h("button", {
        class: "btn btn--ghost btn--icon ticket-line__remove",
        type: "button",
        text: "✕",
        disabled: locked,
        "aria-label": `Sacar ${line.product.name} del ticket`,
        onClick: () => ticket.remove(id),
      }),
    );
  }

  const unsubscribe = ticket.subscribe((state) => {
    count.textContent = state.unitCount === 1 ? "1 unidad" : `${state.unitCount} unidades`;
    total.textContent = formatCents(state.totalCents);
    clearButton.disabled = state.isEmpty || state.locked;
    lines.replaceChildren(
      ...(state.isEmpty
        ? [h("li", { class: "empty", text: "Buscá o tocá un producto para agregarlo." })]
        : state.lines.map((line) => renderLine(line, state.locked))),
    );
  });

  return { element, destroy: unsubscribe };
}
