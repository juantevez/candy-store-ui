// Búsqueda de productos y lista con el stock disponible en el salón.
//
// Teclado: "/" enfoca la búsqueda desde cualquier lado, Enter agrega el primer
// resultado disponible, Escape limpia la búsqueda.

import { h, normalize } from "../../utils/dom.js";
import { formatAmount } from "../../utils/money.js";

const MAX_RESULTS = 200;

export function createProductSearch({ onPick }) {
  let products = [];
  let stock = new Map();
  let inTicket = () => 0;
  let disabled = false;
  let status = { loading: true, error: null, onRetry: null };

  const input = h("input", {
    class: "input",
    type: "search",
    placeholder: "Buscar por nombre o SKU…",
    autocomplete: "off",
    "aria-label": "Buscar producto",
    onInput: render,
    onKeydown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const first = visibleProducts().find((product) => remaining(product) > 0);
        if (first) pick(first);
      } else if (event.key === "Escape") {
        input.value = "";
        render();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        list.querySelector("button:not(:disabled)")?.focus();
      }
    },
  });
  const list = h("ul", { class: "product-list", "aria-label": "Productos" });
  const element = h(
    "section",
    { class: "card catalog", "aria-labelledby": "catalog-title" },
    h("h2", { class: "visually-hidden", id: "catalog-title", text: "Productos" }),
    h("div", { class: "catalog__search" }, input),
    h(
      "p",
      { class: "catalog__hint" },
      h("kbd", { text: "/" }),
      " buscar · ",
      h("kbd", { text: "Enter" }),
      " agrega el primero · ",
      h("kbd", { text: "Ctrl" }),
      "+",
      h("kbd", { text: "Enter" }),
      " cobra",
    ),
    list,
  );

  function remaining(product) {
    return (stock.get(product.product_id)?.available ?? 0) - inTicket(product.product_id);
  }

  function visibleProducts() {
    const query = normalize(input.value.trim());
    const matches = products.filter(
      (product) =>
        !query || normalize(product.name).includes(query) || normalize(product.sku).includes(query),
    );
    // Primero lo que se puede vender, después alfabético.
    return matches.sort(
      (a, b) => Number(remaining(b) > 0) - Number(remaining(a) > 0) || a.name.localeCompare(b.name, "es"),
    );
  }

  function pick(product) {
    if (onPick(product)) {
      input.value = "";
      render();
      input.focus();
    }
  }

  function render() {
    if (status.loading) {
      list.replaceChildren(h("li", { class: "empty", text: "Cargando productos…" }));
      return;
    }
    if (status.error) {
      list.replaceChildren(
        h(
          "li",
          { class: "empty" },
          h("p", { text: status.error }),
          h("button", { class: "btn", type: "button", text: "Reintentar", onClick: status.onRetry }),
        ),
      );
      return;
    }
    const visible = visibleProducts();
    if (visible.length === 0) {
      list.replaceChildren(h("li", { class: "empty", text: "No hay productos que coincidan." }));
      return;
    }
    list.replaceChildren(...visible.slice(0, MAX_RESULTS).map(renderProduct));
  }

  function renderProduct(product) {
    const left = remaining(product);
    const badge =
      left <= 0
        ? h("span", { class: "badge badge--danger", text: "Sin stock" })
        : h("span", { class: `badge ${left <= 5 ? "badge--warning" : "badge--success"}`, text: `Quedan ${left}` });
    return h(
      "li",
      {},
      h(
        "button",
        {
          class: "product",
          type: "button",
          disabled: disabled || left <= 0,
          title: left <= 0 ? "Sin stock en el salón" : `Agregar ${product.name}`,
          onClick: () => pick(product),
        },
        h(
          "span",
          {},
          h("span", { class: "product__name", text: product.name }),
          h(
            "span",
            { class: "product__meta" },
            product.sku,
            product.is_kit ? h("span", { class: "badge badge--primary", text: "Kit" }) : null,
          ),
        ),
        badge,
        h("span", { class: "product__price", text: formatAmount(product.price) }),
      ),
    );
  }

  return {
    element,
    focus: () => input.focus(),
    setStatus(next) {
      status = { loading: false, error: null, onRetry: null, ...next };
      render();
    },
    update(next) {
      ({ products, stock, inTicket } = { products, stock, inTicket, ...next });
      if (next.disabled !== undefined) disabled = next.disabled;
      status = { loading: false, error: null, onRetry: null };
      render();
    },
    refresh: render,
  };
}
