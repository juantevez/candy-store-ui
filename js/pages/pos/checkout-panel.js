// Medio de pago, cálculo del vuelto y botón de cobro.
// Si un cobro quedó sin respuesta, muestra las opciones para resolverlo.

import { h } from "../../utils/dom.js";
import { formatCents, parseUserAmount } from "../../utils/money.js";
import { PAYMENT_METHODS } from "./labels.js";

export function createCheckoutPanel({ ticket, onCharge, onResolvePending }) {
  let busy = false;
  let pending = false;

  const methods = h(
    "fieldset",
    { class: "payment-methods" },
    h("legend", { class: "label", text: "Medio de pago" }),
    ...PAYMENT_METHODS.map((method, index) =>
      h(
        "label",
        { class: "payment-method" },
        h("input", { type: "radio", name: "payment-method", value: method.value, checked: index === 0, onChange: render }),
        h("span", { text: method.label }),
      ),
    ),
  );

  const received = h("input", {
    class: "input",
    id: "cash-received",
    inputmode: "decimal",
    placeholder: "Opcional",
    autocomplete: "off",
    onInput: render,
  });
  const change = h("output", { class: "cash__change", for: "cash-received" });
  const cash = h(
    "div",
    { class: "cash" },
    h("div", {}, h("label", { class: "label", for: "cash-received", text: "Paga con" }), received),
    h("div", {}, h("span", { class: "label", text: "Vuelto" }), change),
  );

  const chargeButton = h("button", { class: "btn btn--primary btn--lg", type: "button", onClick: () => charge() });
  const pendingBox = h("div", { class: "alert alert--warning", role: "alert", hidden: true });

  const element = h(
    "section",
    { class: "card checkout", "aria-label": "Cobro" },
    methods,
    cash,
    pendingBox,
    chargeButton,
  );

  function selectedMethod() {
    return methods.querySelector("input:checked")?.value ?? "cash";
  }

  function cashState(totalCents) {
    if (selectedMethod() !== "cash") return { cents: null, insufficient: false };
    const cents = parseUserAmount(received.value);
    return { cents, insufficient: cents !== null && cents < totalCents };
  }

  function charge() {
    const state = ticket.state;
    const { cents, insufficient } = cashState(state.totalCents);
    if (busy || state.isEmpty || insufficient) return;
    onCharge({ paymentMethod: selectedMethod(), cashReceivedCents: cents });
  }

  function render() {
    const state = ticket.state;
    const isCash = selectedMethod() === "cash";
    cash.hidden = !isCash;
    const { cents, insufficient } = cashState(state.totalCents);
    change.dataset.insufficient = String(insufficient);
    change.textContent =
      cents === null ? "—" : insufficient ? `Faltan ${formatCents(state.totalCents - cents)}` : formatCents(cents - state.totalCents);

    for (const input of methods.querySelectorAll("input")) input.disabled = busy || pending;
    received.disabled = busy || pending;
    chargeButton.disabled = busy || state.isEmpty || insufficient;
    chargeButton.textContent = busy
      ? "Cobrando…"
      : pending
        ? `Reintentar cobro de ${formatCents(state.totalCents)}`
        : `Cobrar ${formatCents(state.totalCents)}`;

    pendingBox.hidden = !pending;
    if (pending) {
      pendingBox.replaceChildren(
        h("p", { text: "No se pudo confirmar si la venta se registró. Reintentá el cobro (no se duplica) o verificá antes de modificar el ticket." }),
        h("button", {
          class: "btn",
          type: "button",
          text: "Verificar y desbloquear",
          disabled: busy,
          onClick: onResolvePending,
        }),
      );
    }
  }

  const unsubscribe = ticket.subscribe(render);

  return {
    element,
    charge,
    setBusy(value) {
      busy = value;
      render();
    },
    setPending(value) {
      pending = value;
      render();
    },
    reset() {
      received.value = "";
      pending = false;
      render();
    },
    destroy: unsubscribe,
  };
}
