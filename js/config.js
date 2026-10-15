// Configuración del cliente. La URL de la API se puede cambiar sin tocar código:
//   localStorage.setItem("candy.apiUrl", "https://api.mi-tienda.com.ar")

const DEFAULT_API_URL = "http://localhost:8000";

function readSetting(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
}

export const config = Object.freeze({
  apiUrl: readSetting("candy.apiUrl") ?? DEFAULT_API_URL,
  locale: "es-AR",
  currency: "ARS",
  // El mostrador vende lo que hay en el salón; las compras online salen del depósito.
  counterLocation: "store_front",
  onlineLocation: "warehouse",
  stockRefreshMs: 30_000,
  healthCheckMs: 15_000,
  requestTimeoutMs: 10_000,
});
