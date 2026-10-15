// Vuelta desde Mercado Pago: la pasarela redirige a index.html?checkout=exito|error|pendiente
// &external_reference=<order_id>&payment_id=... Se captura al cargar la página, se limpia
// la URL y la pantalla de compra online lo consume una sola vez.
//
// El "checkout" de la URL es solo orientativo: el estado real siempre se consulta a la API.

let pending = null;

export function captureCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("checkout")) return false;
  pending = {
    outcome: params.get("checkout"),
    orderId: params.get("external_reference"),
  };
  window.history.replaceState(null, "", `${window.location.pathname}#/compra-online`);
  return true;
}

export function takeCheckoutReturn() {
  const value = pending;
  pending = null;
  return value;
}
