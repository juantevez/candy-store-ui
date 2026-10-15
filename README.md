# Candy Store UI

Cliente web de Candy Store en HTML5, CSS3 y JavaScript vanilla (ES modules, sin build).

## Correr

1. Levantar el backend: en `candy-store`, `docker compose up -d --build`
   (opcional: `uv run python tools/seed_demo.py` carga un catálogo de demostración).
2. Servir esta carpeta por HTTP en el puerto 3000 (abrir `index.html` como archivo no
   funciona: el navegador bloquea las llamadas a la API):

   ```bash
   python3 -m http.server 3000
   ```

3. Abrir http://localhost:3000

La URL de la API por defecto es `http://localhost:8000`. Para otra, desde la consola
del navegador: `localStorage.setItem("candy.apiUrl", "https://...")` y recargar.

## Estructura

```
index.html              cabecera, contenedor de la app y avisos
css/
  index.css             entrada: importa el resto en orden
  base.css              tokens (colores, espacios), reset, botones, inputs; modo oscuro
  layout.css            cabecera y área principal
  components.css        tarjetas, insignias, avisos, diálogos
  pos.css               pantalla del mostrador
  online.css            pantalla de compra online
js/
  index.js              arranque: router y estado de conexión con la API
  config.js             configuración (URL de la API, ubicación del mostrador, refrescos)
  api.js                cliente HTTP: ApiError (respuesta de negocio) vs NetworkError (sin respuesta)
  router.js             router por hash (#/mostrador)
  state/ticket.js       ticket en curso, order_id para reintentos y bloqueo ante fallas de red
  components/           toast y diálogo
  utils/                importes en centavos, creación de nodos sin innerHTML, uuid
  state/checkout-return.js  vuelta desde Mercado Pago (index.html?checkout=...)
  pages/pos/            mostrador: búsqueda, ticket, cobro, comprobante, últimas ventas
  pages/online/         compra online: catálogo, carrito, transferencia y resultado del pago
```

## Mostrador

- Muestra el stock disponible **en el salón**; sin stock, el producto no se puede agregar.
- Teclado: `/` busca, `Enter` agrega el primer resultado, `Ctrl+Enter` cobra.
- Efectivo: con "Paga con" calcula el vuelto.
- **Cobros seguros ante fallas de red:** cada venta tiene un `order_id` generado acá. Si
  la API no responde, el ticket se bloquea; "Reintentar cobro" reenvía la misma venta (la
  API no la duplica) y "Verificar y desbloquear" consulta si se registró antes de dejar
  modificar el ticket.
- Si la API rechaza por falta de stock, marca las líneas con lo disponible.

## Compra Online

- Muestra lo disponible **en el depósito** (de ahí salen los pedidos online); al cliente
  no se le muestran cantidades exactas salvo cuando quedan pocas.
- Medios de pago: **Mercado Pago** o **Transferencia**.
  - **Mercado Pago:** redirige a la pasarela (en local, el simulador en `:8099`). Al volver,
    la URL trae `?checkout=exito|error|pendiente`; la pantalla consulta el estado real del
    pedido a la API (la URL no es confiable) y espera unos segundos a que llegue la
    confirmación del pago.
  - **Transferencia:** el pedido queda reservado 24 h y se muestran alias, CBU, titular,
    importe y el concepto a indicar. El personal confirma la acreditación con
    `POST /sales/orders/{id}/transfer-confirmation` (por ahora desde Swagger).
- Mismo manejo de fallas de red que el mostrador: el carrito se bloquea y el reintento
  usa el mismo `order_id`.
