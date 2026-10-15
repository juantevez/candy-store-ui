// Router por hash (#/mostrador): funciona con cualquier servidor estático.
// Cada página exporta mount(container) y devuelve una función para desmontarse
// (cancelar timers y listeners globales).

export function startRouter({ routes, fallback, container }) {
  let unmount = null;

  function render() {
    const path = window.location.hash.replace(/^#/, "") || fallback;
    if (!routes[path]) {
      window.location.replace(`#${fallback}`);
      return;
    }
    unmount?.();
    container.replaceChildren();
    unmount = routes[path].mount(container) ?? null;
    document.title = routes[path].title ? `Candy Store · ${routes[path].title}` : "Candy Store";
    for (const link of document.querySelectorAll("[data-route]")) {
      if (link.dataset.route === path) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  window.addEventListener("hashchange", render);
  render();
}
