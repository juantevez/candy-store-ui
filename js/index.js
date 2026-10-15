import { api } from "./api.js";
import { config } from "./config.js";
import { onlinePage } from "./pages/online/online-page.js";
import { posPage } from "./pages/pos/pos-page.js";
import { startRouter } from "./router.js";
import { captureCheckoutReturn } from "./state/checkout-return.js";

const routes = {
  "/mostrador": posPage,
  "/compra-online": onlinePage,
};

function watchApiStatus() {
  const status = document.getElementById("api-status");
  const text = status.querySelector(".api-status__text");
  async function check() {
    try {
      await api.health();
      status.dataset.state = "online";
      text.textContent = "Conectado";
    } catch {
      status.dataset.state = "offline";
      text.textContent = "Sin conexión con el servidor";
    }
  }
  check();
  setInterval(check, config.healthCheckMs);
}

watchApiStatus();
captureCheckoutReturn(); // antes del router: puede redirigir a #/compra-online
startRouter({ routes, fallback: "/mostrador", container: document.getElementById("app") });
