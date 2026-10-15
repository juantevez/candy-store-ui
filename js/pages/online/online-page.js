// Pestaña "Compra Online": la tienda del cliente. Vende el stock del depósito y se paga
// con Mercado Pago o transferencia bancaria.

import { ApiError, NetworkError, api } from "../../api.js";
import { toast } from "../../components/toast.js";
import { config } from "../../config.js";
import { takeCheckoutReturn } from "../../state/checkout-return.js";
import { createTicket } from "../../state/ticket.js";
import { h } from "../../utils/dom.js";
import { createCartPanel } from "./cart-panel.js";
import { createCatalogGrid } from "./catalog-grid.js";
import { createPaymentResultPanel, createTransferPanel } from "./order-panels.js";

export const onlinePage = {
  title: "Compra Online",
  mount(container) {
    const cart = createTicket();
    let productsById = new Map();
    let stockById = new Map();
    let overlay = null; // panel de transferencia o de resultado, si está visible

    const available = (productId) => stockById.get(productId)?.available ?? 0;
    const limitToast = (product, max) => toast(`Solo quedan ${max} de ${product.name}.`, "warning");

    const catalog = createCatalogGrid({ onAdd: addToCart });
    const cartPanel = createCartPanel({
      ticket: cart,
      availableFor: available,
      onLimit: limitToast,
      onSubmit: submit,
      onResolvePending: resolvePending,
    });
    const shop = h("div", { class: "shop" }, catalog.element, cartPanel.element);
    container.append(shop);

    const unsubscribe = cart.subscribe((state) => {
      catalog.update({ inCart: (id) => cart.quantityOf(id), disabled: state.locked });
    });

    function addToCart(product) {
      if (cart.state.locked) {
        toast("Hay un pedido sin confirmar: resolvelo antes de cambiar el carrito.", "warning");
        return;
      }
      if (cart.quantityOf(product.product_id) >= available(product.product_id)) {
        limitToast(product, available(product.product_id));
        return;
      }
      cart.add(product);
    }

    // --- Paneles posteriores al checkout -------------------------------------------

    function showOverlay(panel) {
      overlay?.destroy();
      overlay = panel;
      shop.hidden = true;
      container.append(panel.element);
      window.scrollTo({ top: 0 });
    }

    function backToShop() {
      overlay?.destroy();
      overlay?.element.remove();
      overlay = null;
      shop.hidden = false;
      loadCatalog();
    }

    // --- Datos -------------------------------------------------------------------------

    async function loadCatalog() {
      try {
        const [products, stock] = await Promise.all([api.listProducts(), api.stockAt(config.onlineLocation)]);
        productsById = new Map(products.filter((p) => p.active).map((p) => [p.product_id, p]));
        stockById = new Map(stock.map((level) => [level.product_id, level]));
        cart.refreshProducts(productsById);
        catalog.update({ products: [...productsById.values()], stock: stockById });
      } catch (error) {
        if (productsById.size === 0) {
          catalog.setStatus({ error: `No pudimos cargar la tienda. ${error.message}`, onRetry: loadCatalog });
        }
      }
    }

    // --- Checkout ----------------------------------------------------------------------

    let lastSubmit = null;

    async function submit({ email, paymentMethod }) {
      lastSubmit = { email, paymentMethod };
      const orderId = cart.orderIdForCharge();
      cartPanel.setBusy(true);
      let redirecting = false;
      try {
        const result = await api.checkout({
          order_id: orderId,
          items: cart.state.lines.map((line) => ({ product_id: line.product.product_id, quantity: line.quantity })),
          customer_email: email,
          payment_method: paymentMethod,
        });
        if (result.payment_method === "mercadopago") {
          redirecting = true;
          window.location.assign(result.redirect_url);
          return;
        }
        cart.clear();
        cartPanel.setPending(false);
        showOverlay(createTransferPanel(result, { onContinue: backToShop }));
      } catch (error) {
        handleError(error);
      } finally {
        if (!redirecting) cartPanel.setBusy(false);
      }
    }

    function handleError(error) {
      if (error instanceof NetworkError) {
        cart.lock();
        cartPanel.setPending(true);
        toast(`${error.message} Tu pedido no se confirmó.`, "error");
      } else if (error instanceof ApiError && error.code === "out_of_stock") {
        cart.markShortages(error.body.items ?? []);
        toast("Algunos productos ya no tienen stock suficiente: revisá tu carrito.", "warning");
        loadCatalog();
      } else if (error instanceof ApiError && error.code === "product_not_sellable") {
        toast("Algún producto ya no está a la venta. Actualizamos la tienda.", "error");
        loadCatalog();
      } else if (error instanceof ApiError && error.code === "payment_gateway") {
        toast("Mercado Pago no está disponible en este momento. Probá con transferencia o más tarde.", "error");
      } else {
        toast(error.message, "error");
      }
    }

    // Tras una falla de red: ver si el pedido llegó a crearse antes de dejar editar.
    async function resolvePending() {
      const orderId = cart.orderIdForCharge();
      cartPanel.setBusy(true);
      try {
        const order = await api.getOrder(orderId);
        if (order.status === "awaiting_payment" && lastSubmit) {
          // El pedido existe: reenviarlo devuelve el mismo checkout (no se duplica).
          cartPanel.setBusy(false);
          cart.unlock();
          await submit(lastSubmit);
          return;
        }
        cart.unlock({ newSale: true });
        cartPanel.setPending(false);
        toast("El pedido no se había completado. Podés modificar el carrito.", "info");
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          cart.unlock({ newSale: true });
          cartPanel.setPending(false);
          toast("El pedido no se había registrado. Podés modificar el carrito.", "info");
        } else {
          toast(`Todavía no se puede verificar: ${error.message}`, "error");
        }
      } finally {
        cartPanel.setBusy(false);
      }
    }

    // --- Arranque ----------------------------------------------------------------------

    const checkoutReturn = takeCheckoutReturn();
    if (checkoutReturn) showOverlay(createPaymentResultPanel(checkoutReturn, { onContinue: backToShop }));
    loadCatalog();
    const timer = setInterval(() => {
      if (!overlay) loadCatalog();
    }, config.stockRefreshMs);

    return () => {
      clearInterval(timer);
      overlay?.destroy();
      unsubscribe();
      cartPanel.destroy();
    };
  },
};
