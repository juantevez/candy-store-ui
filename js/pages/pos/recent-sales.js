import { h } from "../../utils/dom.js";
import { formatAmount } from "../../utils/money.js";
import { ORDER_STATUS, paymentLabel } from "./labels.js";

const timeFormat = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

export function createRecentSales() {
  const list = h("ul", { class: "recent__list" });
  const element = h(
    "details",
    { class: "card recent", open: true },
    h("summary", { class: "card__title", text: "Últimas ventas" }),
    list,
  );

  function renderOrder(order) {
    const status = ORDER_STATUS[order.status] ?? { label: order.status, tone: "" };
    const units = order.lines.reduce((sum, line) => sum + line.quantity, 0);
    return h(
      "li",
      { class: "recent__item", title: `Venta ${order.order_id}` },
      h("span", { class: "recent__time", text: timeFormat.format(new Date(order.placed_at)) }),
      h(
        "span",
        {},
        `${units} ${units === 1 ? "unidad" : "unidades"} · ${paymentLabel(order.payment_method)} `,
        h("span", { class: `badge badge--${status.tone}`, text: status.label }),
      ),
      h("span", { class: "recent__total", text: formatAmount(order.total) }),
    );
  }

  return {
    element,
    update(orders) {
      list.replaceChildren(
        ...(orders.length ? orders.map(renderOrder) : [h("li", { class: "empty", text: "Todavía no hay ventas." })]),
      );
    },
  };
}
