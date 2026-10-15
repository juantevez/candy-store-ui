// Catálogo de la tienda online: tarjetas con precio y disponibilidad del depósito.
// Al cliente no se le muestran cantidades exactas, salvo cuando quedan pocas.

import { h, normalize } from "../../utils/dom.js";
import { formatAmount } from "../../utils/money.js";

const FEW_LEFT = 5;

export function createCatalogGrid({ onAdd }) {
  let products = [];
  let stock = new Map();
  let inCart = () => 0;
  let disabled = false;
  let status = { loading: true, error: null, onRetry: null };

  const input = h("input", {
    class: "input",
    type: "search",
    placeholder: "¿Qué golosina buscás?",
    "aria-label": "Buscar producto",
    onInput: render,
  });
  const grid = h("ul", { class: "shop-grid", "aria-label": "Productos" });
  const element = h(
    "section",
    { class: "shop-catalog", "aria-labelledby": "shop-title" },
    h(
      "div",
      { class: "shop-catalog__header" },
      h("h1", { class: "shop-catalog__title", id: "shop-title", text: "Tienda online" }),
      input,
    ),
    grid,
  );

  function remaining(product) {
    return (stock.get(product.product_id)?.available ?? 0) - inCart(product.product_id);
  }

  function availability(product) {
    const total = stock.get(product.product_id)?.available ?? 0;
    if (total <= 0) return { text: "Sin stock", tone: "danger" };
    if (total <= FEW_LEFT) return { text: `¡Últimas ${total}!`, tone: "warning" };
    return { text: "Disponible", tone: "success" };
  }

  function render() {
    if (status.loading) {
      grid.replaceChildren(h("li", { class: "empty", text: "Cargando productos…" }));
      return;
    }
    if (status.error) {
      grid.replaceChildren(
        h(
          "li",
          { class: "empty" },
          h("p", { text: status.error }),
          h("button", { class: "btn", type: "button", text: "Reintentar", onClick: status.onRetry }),
        ),
      );
      return;
    }
    const query = normalize(input.value.trim());
    const visible = products
      .filter((product) => !query || normalize(product.name).includes(query))
      .sort((a, b) => Number(remaining(b) > 0) - Number(remaining(a) > 0) || a.name.localeCompare(b.name, "es"));
    grid.replaceChildren(
      ...(visible.length ? visible.map(renderCard) : [h("li", { class: "empty", text: "No encontramos productos con ese nombre." })]),
    );
  }

  function renderCard(product) {
    const state = availability(product);
    const quantity = inCart(product.product_id);
    const left = remaining(product);
    return h(
      "li",
      { class: "shop-card card", dataset: { soldOut: String(state.tone === "danger") } },
      h(
        "div",
        { class: "shop-card__body" },
        h("span", { class: "shop-card__emoji", "aria-hidden": "true", text: product.is_kit ? "🎁" : "🍬" }),
        h("h2", { class: "shop-card__name", text: product.name }),
        h(
          "p",
          { class: "shop-card__tags" },
          h("span", { class: `badge badge--${state.tone}`, text: state.text }),
          product.is_kit ? h("span", { class: "badge badge--primary", text: "Caja regalo" }) : null,
        ),
      ),
      h(
        "div",
        { class: "shop-card__footer" },
        h("span", { class: "shop-card__price", text: formatAmount(product.price) }),
        h("button", {
          class: `btn ${quantity ? "" : "btn--primary"}`,
          type: "button",
          disabled: disabled || left <= 0,
          text: left <= 0 && quantity ? `En el carrito: ${quantity}` : quantity ? `Agregar otro (${quantity})` : "Agregar",
          onClick: () => onAdd(product),
        }),
      ),
    );
  }

  return {
    element,
    setStatus(next) {
      status = { loading: false, error: null, onRetry: null, ...next };
      render();
    },
    update(next) {
      ({ products, stock, inCart } = { products, stock, inCart, ...next });
      if (next.disabled !== undefined) disabled = next.disabled;
      status = { loading: false, error: null, onRetry: null };
      render();
    },
  };
}
