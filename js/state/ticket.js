// Estado del ticket en curso.
//
// El order_id identifica la venta ante la API (idempotencia): se genera al cobrar y
// se reutiliza en los reintentos mientras el ticket no cambie. Cualquier cambio en el
// ticket implica una venta distinta y por lo tanto un id nuevo.
//
// Si un cobro queda sin respuesta (falla de red), el ticket se BLOQUEA: no se puede
// editar hasta reintentar el mismo cobro o confirmar con la API que no se registró.
// Así se evita cobrar dos veces la misma mercadería.

import { toCents } from "../utils/money.js";
import { uuid } from "../utils/uuid.js";

export function createTicket() {
  const lines = new Map(); // product_id -> { product, quantity }
  let shortages = new Map(); // product_id -> disponible informado por la API
  let orderId = null;
  let locked = false;
  const listeners = new Set();

  function snapshot() {
    const items = [...lines.values()].map(({ product, quantity }) => ({
      product,
      quantity,
      subtotalCents: toCents(product.price) * quantity,
      shortAvailable: shortages.get(product.product_id),
    }));
    return {
      lines: items,
      totalCents: items.reduce((sum, line) => sum + line.subtotalCents, 0),
      unitCount: items.reduce((sum, line) => sum + line.quantity, 0),
      isEmpty: items.length === 0,
      locked,
    };
  }

  function emit() {
    const state = snapshot();
    for (const listener of listeners) listener(state);
  }

  function edit(change) {
    if (locked) return false;
    change();
    orderId = null;
    emit();
    return true;
  }

  return {
    get state() {
      return snapshot();
    },

    quantityOf(productId) {
      return lines.get(productId)?.quantity ?? 0;
    },

    add(product, quantity = 1) {
      return edit(() => {
        const current = lines.get(product.product_id)?.quantity ?? 0;
        lines.set(product.product_id, { product, quantity: current + quantity });
        shortages.delete(product.product_id);
      });
    },

    setQuantity(productId, quantity) {
      return edit(() => {
        const line = lines.get(productId);
        if (!line) return;
        if (quantity <= 0) lines.delete(productId);
        else lines.set(productId, { ...line, quantity });
        shortages.delete(productId);
      });
    },

    remove(productId) {
      return edit(() => {
        lines.delete(productId);
        shortages.delete(productId);
      });
    },

    // Actualiza nombre y precio con los datos vigentes del catálogo.
    refreshProducts(productsById) {
      for (const [id, line] of lines) {
        const fresh = productsById.get(id);
        if (fresh) lines.set(id, { ...line, product: fresh });
      }
      emit();
    },

    // La API rechazó la venta por falta de stock: la orden quedó cancelada, así que
    // el próximo intento es otra venta (id nuevo).
    markShortages(items) {
      shortages = new Map(items.map((item) => [item.product_id, item.available]));
      orderId = null;
      emit();
    },

    orderIdForCharge() {
      orderId ??= uuid();
      return orderId;
    },

    lock() {
      locked = true;
      emit();
    },

    unlock({ newSale = false } = {}) {
      locked = false;
      if (newSale) orderId = null;
      emit();
    },

    clear() {
      lines.clear();
      shortages.clear();
      orderId = null;
      locked = false;
      emit();
    },

    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
  };
}
