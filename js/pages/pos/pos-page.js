// Pantalla del mostrador (POS): arma el ticket con el stock del salón y cobra.

import { ApiError, NetworkError, api } from "../../api.js";
import { toast } from "../../components/toast.js";
import { config } from "../../config.js";
import { h } from "../../utils/dom.js";
import { createTicket } from "../../state/ticket.js";
import { createCheckoutPanel } from "./checkout-panel.js";
import { createProductSearch } from "./product-search.js";
import { showReceipt } from "./receipt.js";
import { createRecentSales } from "./recent-sales.js";
import { createTicketPanel } from "./ticket-panel.js";

export const posPage = {
  title: "Mostrador",
  mount(container) {
    const ticket = createTicket();
    let productsById = new Map();
    let stockById = new Map();

    const available = (productId) => stockById.get(productId)?.available ?? 0;

    const search = createProductSearch({ onPick: addToTicket });
    const ticketPanel = createTicketPanel({
      ticket,
      availableFor: available,
      onLimit: (product, max) => toast(`Solo hay ${max} de ${product.name} en el salón.`, "warning"),
    });
    const checkout = createCheckoutPanel({ ticket, onCharge: charge, onResolvePending: resolvePending });
    const recent = createRecentSales();

    container.append(
      h(
        "div",
        { class: "pos" },
        h("div", { class: "pos__column" }, search.element),
        h("div", { class: "pos__column" }, ticketPanel.element, checkout.element, recent.element),
      ),
    );

    const unsubscribe = ticket.subscribe((state) => {
      search.update({ inTicket: (id) => ticket.quantityOf(id), disabled: state.locked });
    });

    function addToTicket(product) {
      if (ticket.state.locked) {
        toast("Hay un cobro sin confirmar: resolvelo antes de modificar el ticket.", "warning");
        return false;
      }
      const max = available(product.product_id);
      if (ticket.quantityOf(product.product_id) >= max) {
        toast(`Solo hay ${max} de ${product.name} en el salón.`, "warning");
        return false;
      }
      return ticket.add(product);
    }

    // --- Datos ------------------------------------------------------------

    async function loadCatalog() {
      try {
        const [products, stock] = await Promise.all([api.listProducts(), api.stockAt(config.counterLocation)]);
        productsById = new Map(products.filter((p) => p.active).map((p) => [p.product_id, p]));
        stockById = new Map(stock.map((level) => [level.product_id, level]));
        ticket.refreshProducts(productsById);
        search.update({ products: [...productsById.values()], stock: stockById });
      } catch (error) {
        if (productsById.size === 0) {
          search.setStatus({ error: `No se pudo cargar el catálogo. ${error.message}`, onRetry: loadCatalog });
        }
      }
    }

    async function loadRecentSales() {
      try {
        recent.update(await api.recentOrders({ channel: "counter", limit: 15 }));
      } catch {
        // No es crítico: se reintenta en el próximo refresco.
      }
    }

    function refresh() {
      loadCatalog();
      loadRecentSales();
    }

    // --- Cobro ------------------------------------------------------------

    async function charge({ paymentMethod, cashReceivedCents }) {
      const { lines } = ticket.state;
      const orderId = ticket.orderIdForCharge();
      checkout.setBusy(true);
      try {
        const order = await api.counterSale({
          order_id: orderId,
          payment_method: paymentMethod,
          items: lines.map((line) => ({ product_id: line.product.product_id, quantity: line.quantity })),
        });
        ticket.clear();
        checkout.reset();
        refresh();
        await showReceipt(order, { cashReceivedCents });
      } catch (error) {
        handleChargeError(error);
      } finally {
        checkout.setBusy(false);
        search.focus();
      }
    }

    function handleChargeError(error) {
      if (error instanceof NetworkError) {
        // No sabemos si la venta se registró: bloquear el ticket hasta resolverlo.
        ticket.lock();
        checkout.setPending(true);
        toast(`${error.message} La venta no se confirmó.`, "error");
        return;
      }
      if (error instanceof ApiError && error.code === "out_of_stock") {
        ticket.markShortages(error.body.items ?? []);
        toast("No alcanza el stock del salón para algunos productos: ajustá las cantidades marcadas.", "warning");
        loadCatalog();
        return;
      }
      if (error instanceof ApiError && error.code === "product_not_sellable") {
        toast("Algún producto ya no está a la venta. Se actualizó el catálogo.", "error");
        loadCatalog();
        return;
      }
      toast(error.message, "error");
    }

    // Tras una falla de red: consultar si la venta llegó a registrarse.
    async function resolvePending() {
      const orderId = ticket.orderIdForCharge();
      checkout.setBusy(true);
      try {
        const order = await api.getOrder(orderId);
        if (order.status === "completed") {
          ticket.clear();
          checkout.reset();
          refresh();
          await showReceipt(order, { title: "La venta ya se había registrado" });
        } else {
          // Quedó iniciada o cancelada: no se cobró. Se puede editar (será otra venta).
          ticket.unlock({ newSale: true });
          checkout.setPending(false);
          toast("La venta no se había completado. Podés modificar el ticket y cobrar.", "info");
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          ticket.unlock({ newSale: true });
          checkout.setPending(false);
          toast("La venta no se había registrado. Podés modificar el ticket y cobrar.", "info");
        } else {
          toast(`Todavía no se puede verificar: ${error.message}`, "error");
        }
      } finally {
        checkout.setBusy(false);
      }
    }

    // --- Teclado y refresco periódico ---------------------------------------

    function onKeydown(event) {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        search.focus();
      } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        checkout.charge();
      }
    }

    document.addEventListener("keydown", onKeydown);
    const timer = setInterval(refresh, config.stockRefreshMs);
    refresh();
    search.focus();

    return () => {
      clearInterval(timer);
      document.removeEventListener("keydown", onKeydown);
      unsubscribe();
      ticketPanel.destroy();
      checkout.destroy();
    };
  },
};
