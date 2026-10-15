// Carrito de la tienda online: líneas, email del comprador, medio de pago y confirmación.

import { h } from "../../utils/dom.js";
import { formatAmount, formatCents } from "../../utils/money.js";

export const ONLINE_PAYMENT_METHODS = [
  { value: "mercadopago", label: "Mercado Pago", hint: "Tarjetas, dinero en cuenta o efectivo" },
  { value: "bank_transfer", label: "Transferencia", hint: "Te reservamos el pedido 24 h" },
];

export function createCartPanel({ ticket, availableFor, onLimit, onSubmit, onResolvePending }) {
  let busy = false;
  let pending = false;

  const count = h("span", { class: "badge" });
  const lines = h("ul", { class: "cart__lines", "aria-label": "Productos en el carrito" });
  const total = h("output", { "aria-live": "polite" });
  const email = h("input", {
    class: "input",
    id: "customer-email",
    type: "email",
    required: true,
    autocomplete: "email",
    placeholder: "tu@email.com",
  });
  const methods = h(
    "fieldset",
    { class: "online-methods" },
    h("legend", { class: "label", text: "¿Cómo querés pagar?" }),
    ...ONLINE_PAYMENT_METHODS.map((method, index) =>
      h(
        "label",
        { class: "online-method" },
        h("input", { type: "radio", name: "online-method", value: method.value, checked: index === 0, onChange: render }),
        h("span", {}, h("strong", { text: method.label }), h("small", { text: method.hint })),
      ),
    ),
  );
  const pendingBox = h("div", { class: "alert alert--warning", role: "alert", hidden: true });
  const submit = h("button", { class: "btn btn--primary btn--lg", type: "submit" });
  const form = h(
    "form",
    {
      class: "cart__form",
      onSubmit: (event) => {
        event.preventDefault();
        const state = ticket.state;
        if (busy || state.isEmpty || !form.reportValidity()) return;
        onSubmit({ email: email.value.trim(), paymentMethod: selectedMethod() });
      },
    },
    h("div", {}, h("label", { class: "label", for: "customer-email", text: "Tu email" }), email),
    methods,
    pendingBox,
    submit,
  );

  const element = h(
    "aside",
    { class: "card cart", "aria-labelledby": "cart-title" },
    h("div", { class: "ticket__header" }, h("h2", { class: "card__title", id: "cart-title", text: "Tu carrito" }), count),
    lines,
    h("div", { class: "ticket__total" }, h("span", { text: "Total" }), total),
    form,
  );

  function selectedMethod() {
    return methods.querySelector("input:checked")?.value ?? "mercadopago";
  }

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
    return h(
      "li",
      { class: "ticket-line", dataset: { short: String(short) } },
      h("span", { class: "ticket-line__name", text: line.product.name }),
      h("span", {
        class: "ticket-line__detail",
        text: short ? `Solo quedan ${line.shortAvailable}` : `${line.quantity} × ${formatAmount(line.product.price)}`,
      }),
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
        "aria-label": `Sacar ${line.product.name} del carrito`,
        onClick: () => ticket.remove(id),
      }),
    );
  }

  function render() {
    const state = ticket.state;
    count.textContent = state.unitCount === 1 ? "1 producto" : `${state.unitCount} productos`;
    total.textContent = formatCents(state.totalCents);
    lines.replaceChildren(
      ...(state.isEmpty
        ? [h("li", { class: "empty", text: "Tu carrito está vacío." })]
        : state.lines.map((line) => renderLine(line, state.locked))),
    );
    for (const input of methods.querySelectorAll("input")) input.disabled = busy || pending;
    email.disabled = busy || pending;
    submit.disabled = busy || state.isEmpty;
    const amount = formatCents(state.totalCents);
    submit.textContent = busy
      ? "Procesando…"
      : pending
        ? `Reintentar (${amount})`
        : selectedMethod() === "mercadopago"
          ? `Pagar ${amount} con Mercado Pago`
          : `Reservar pedido por ${amount}`;
    pendingBox.hidden = !pending;
    if (pending) {
      pendingBox.replaceChildren(
        h("p", { text: "No pudimos confirmar tu pedido por un problema de conexión. Reintentá: no se duplica." }),
        h("button", { class: "btn", type: "button", text: "Verificar y editar el carrito", disabled: busy, onClick: onResolvePending }),
      );
    }
  }

  const unsubscribe = ticket.subscribe(render);

  return {
    element,
    setBusy(value) {
      busy = value;
      render();
    },
    setPending(value) {
      pending = value;
      render();
    },
    destroy: unsubscribe,
  };
}
