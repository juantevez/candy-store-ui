// Cliente HTTP de la API de Candy Store.
//
// Distingue dos tipos de falla, porque la pantalla reacciona distinto:
// - ApiError: la API respondió con un error de negocio o validación ({code, detail, ...}).
// - NetworkError: no hubo respuesta (servidor caído, timeout). La operación puede o no
//   haberse aplicado, por eso las ventas se reintentan con el mismo order_id.

import { config } from "./config.js";

export class ApiError extends Error {
  constructor(status, body) {
    super(describe(status, body));
    this.name = "ApiError";
    this.status = status;
    this.code = body?.code ?? null;
    this.body = body ?? {};
  }
}

export class NetworkError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = "NetworkError";
  }
}

function describe(status, body) {
  if (typeof body?.detail === "string") return body.detail;
  // Errores de validación de FastAPI: lista de {loc, msg}.
  if (Array.isArray(body?.detail)) return "Datos inválidos en la solicitud.";
  if (status >= 500) return "Error interno del servidor.";
  return `Error ${status}`;
}

async function request(method, path, { query, body } = {}) {
  const url = new URL(path, config.apiUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error.name === "AbortError" ? "El servidor tardó demasiado en responder." : "No se pudo conectar con el servidor.";
    throw new NetworkError(reason, error);
  } finally {
    clearTimeout(timer);
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    // Un 5xx no garantiza que la operación no se haya aplicado: se trata como red.
    if (response.status >= 500) throw new NetworkError(describe(response.status, data));
    throw new ApiError(response.status, data);
  }
  return data;
}

export const api = {
  health: () => request("GET", "/health"),
  listProducts: () => request("GET", "/catalog/products", { query: { limit: 500 } }),
  stockAt: (location) => request("GET", "/inventory/stock", { query: { location } }),
  counterSale: (sale) => request("POST", "/sales/counter-sales", { body: sale }),
  getOrder: (orderId) => request("GET", `/sales/orders/${encodeURIComponent(orderId)}`),
  checkout: (cart) => request("POST", "/sales/checkouts", { body: cart }),
  recentOrders: ({ channel, limit } = {}) =>
    request("GET", "/sales/orders", { query: { channel, limit } }),
};
