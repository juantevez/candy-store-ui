// Paneles posteriores al checkout: datos para transferir y resultado del pago con
// Mercado Pago. El estado siempre se consulta a la API (la URL de vuelta no es confiable).

import { api } from "../../api.js";
import { toast } from "../../components/toast.js";
import { h } from "../../utils/dom.js";
import { formatAmount } from "../../utils/money.js";

const dateTimeFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short" });
const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 8;

function panel(...children) {
  return h("section", { class: "card order-panel" }, ...children);
}

function shortId(orderId) {
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}

function summary(order) {
  return h(
    "div",
    { class: "order-panel__summary" },
    h(
      "ul",
      { class: "receipt__lines" },
      ...order.lines.map((line) =>
        h("li", {}, h("span", { text: `${line.quantity} × ${line.description}` }), h("span", { text: formatAmount(line.subtotal) })),
      ),
    ),
    h("div", { class: "receipt__row receipt__row--total" }, h("span", { text: "Total" }), h("span", { text: formatAmount(order.total) })),
  );
}

// --- Transferencia -----------------------------------------------------------------

export function createTransferPanel(checkout, { onContinue }) {
  const { transfer } = checkout;
  const status = h("p", { class: "order-panel__status", role: "status" });

  async function copy(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copiado`, "success");
    } catch {
      toast(`No se pudo copiar. ${label}: ${value}`, "warning");
    }
  }

  function row(label, value, copyable = true) {
    return h(
      "div",
      { class: "copy-row" },
      h("span", { class: "copy-row__label", text: label }),
      h("span", { class: "copy-row__value", text: value }),
      copyable ? h("button", { class: "btn btn--ghost", type: "button", text: "Copiar", onClick: () => copy(label, value) }) : h("span"),
    );
  }

  async function checkStatus() {
    status.textContent = "Consultando…";
    try {
      const order = await api.getOrder(checkout.order_id);
      status.textContent =
        order.status === "paid"
          ? "✅ ¡Recibimos tu transferencia! Tu pedido está confirmado."
          : order.status === "cancelled"
            ? "El pedido se canceló porque venció la reserva."
            : order.status === "refund_required"
              ? "Recibimos tu transferencia, pero el pedido ya no estaba disponible: te devolvemos el dinero."
              : "Todavía no vemos la transferencia acreditada. Puede demorar unos minutos.";
    } catch (error) {
      status.textContent = `No se pudo consultar el estado: ${error.message}`;
    }
  }

  const element = panel(
    h("h1", { class: "order-panel__title", text: "¡Reservamos tu pedido!" }),
    h("p", { class: "order-panel__lead", text: "Para confirmarlo, transferí el importe exacto a esta cuenta:" }),
    h("p", { class: "order-panel__amount", text: formatAmount(transfer.amount) }),
    h(
      "div",
      { class: "copy-rows" },
      row("Alias", transfer.alias),
      row("CBU", transfer.cbu),
      row("Titular", transfer.holder, false),
      row("Banco", transfer.bank, false),
      row("Concepto", transfer.reference),
    ),
    h(
      "p",
      { class: "alert alert--warning" },
      `Te guardamos los productos hasta el ${dateTimeFormat.format(new Date(checkout.expires_at))}. `,
      "Si para entonces no se acreditó la transferencia, el pedido se cancela.",
    ),
    status,
    h(
      "div",
      { class: "order-panel__actions" },
      h("button", { class: "btn", type: "button", text: "Ya transferí: consultar estado", onClick: checkStatus }),
      h("button", { class: "btn btn--primary", type: "button", text: "Seguir comprando", onClick: onContinue }),
    ),
    h("p", { class: "order-panel__id", text: `Pedido ${shortId(checkout.order_id)}` }),
  );
  return { element, destroy() {} };
}

// --- Resultado de Mercado Pago ---------------------------------------------------------

export function createPaymentResultPanel({ orderId, outcome }, { onContinue }) {
  const body = h("div", {}, h("p", { class: "order-panel__lead", text: "Estamos verificando tu pago…" }));
  const element = panel(body);
  let timer = null;
  let stopped = false;

  function show(title, lead, order, extraActions = []) {
    body.replaceChildren(
      h("h1", { class: "order-panel__title", text: title }),
      h("p", { class: "order-panel__lead", text: lead }),
      order ? summary(order) : null,
      h(
        "div",
        { class: "order-panel__actions" },
        ...extraActions,
        h("button", { class: "btn btn--primary", type: "button", text: "Seguir comprando", onClick: onContinue }),
      ),
      order ? h("p", { class: "order-panel__id", text: `Pedido ${shortId(order.order_id)}` }) : null,
    );
  }

  async function poll(attempt = 1) {
    if (stopped) return;
    let order;
    try {
      order = await api.getOrder(orderId);
    } catch (error) {
      show("No pudimos verificar tu pago", `${error.message} Volvé a intentar en unos minutos.`, null);
      return;
    }
    switch (order.status) {
      case "paid":
        show("✅ ¡Pago aprobado!", "Tu pedido está confirmado. Te enviamos el detalle por email.", order);
        return;
      case "refund_required":
        show("Recibimos tu pago", "Pero los productos ya no estaban disponibles: te devolvemos el dinero.", order);
        return;
      case "cancelled":
        show("El pedido se canceló", "Venció el tiempo de reserva antes de que se aprobara el pago.", order);
        return;
      case "awaiting_payment":
        // Tras un pago aprobado, la confirmación de Mercado Pago puede demorar unos segundos.
        if (outcome !== "error" && attempt < POLL_ATTEMPTS) {
          timer = setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
          return;
        }
        if (outcome === "error") {
          // Solo enlaces http(s): nunca un href arbitrario (ej. "javascript:").
          const retry = /^https?:\/\//.test(order.checkout_url ?? "")
            ? h("a", { class: "btn", href: order.checkout_url, text: "Intentar con otro medio de pago" })
            : null;
          show("El pago no se aprobó", "Podés intentarlo de nuevo mientras tu pedido siga reservado.", order, [retry]);
        } else {
          show("Tu pago está en proceso", "Cuando Mercado Pago lo acredite, tu pedido quedará confirmado.", order);
        }
        return;
      default:
        show("Estado del pedido", `Tu pedido está en estado "${order.status}".`, order);
    }
  }

  if (orderId) poll();
  else show("No encontramos tu pedido", "La dirección de vuelta no trae el número de pedido.", null);

  return {
    element,
    destroy() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
