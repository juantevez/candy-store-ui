// Comprobante en pantalla de una venta registrada (con los importes que devolvió la API).

import { showDialog } from "../../components/dialog.js";
import { h } from "../../utils/dom.js";
import { formatAmount, formatCents, toCents } from "../../utils/money.js";
import { paymentLabel } from "./labels.js";

const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

export function showReceipt(order, { cashReceivedCents = null, title = "Venta registrada" } = {}) {
  const totalCents = toCents(order.total);
  const rows = [
    row("Medio de pago", paymentLabel(order.payment_method)),
    cashReceivedCents !== null ? row("Paga con", formatCents(cashReceivedCents)) : null,
    cashReceivedCents !== null ? row("Vuelto", formatCents(cashReceivedCents - totalCents)) : null,
  ];
  const content = h(
    "div",
    { class: "receipt" },
    h("h2", { class: "receipt__title", text: `✅ ${title}` }),
    h("p", { class: "receipt__id", text: `#${order.order_id.slice(0, 8)} · ${dateFormat.format(new Date(order.placed_at))}` }),
    h(
      "ul",
      { class: "receipt__lines" },
      ...order.lines.map((line) =>
        h("li", {}, h("span", { text: `${line.quantity} × ${line.description}` }), h("span", { text: formatAmount(line.subtotal) })),
      ),
    ),
    h("div", { class: "receipt__row receipt__row--total" }, h("span", { text: "Total" }), h("span", { text: formatAmount(order.total) })),
    ...rows,
  );
  return showDialog({ content, actionLabel: "Nueva venta" });
}

function row(label, value) {
  return h("div", { class: "receipt__row" }, h("span", { text: label }), h("span", { text: value }));
}
