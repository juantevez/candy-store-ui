// Creación de nodos sin innerHTML: los textos que vienen de la API se insertan
// siempre como texto, nunca como HTML.

export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "class") {
      element.className = value;
    } else if (key === "dataset") {
      Object.assign(element.dataset, value);
    } else if (key === "text") {
      element.textContent = value;
    } else if (key in element && typeof value !== "string") {
      element[key] = value; // propiedades como value, checked, disabled
    } else {
      element.setAttribute(key, value === true ? "" : value);
    }
  }
  element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return element;
}

// Normaliza para búsquedas: sin mayúsculas ni tildes ("Turrón" encuentra "turron").
export function normalize(text) {
  return String(text)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
