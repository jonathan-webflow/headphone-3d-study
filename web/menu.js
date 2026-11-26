// Menu que se expande no lugar: a pílula MENU cresce e vira a lista de capítulos.
// A abertura é feita em CSS (clip-path a partir do canto da pílula); aqui fica o comportamento.

// capítulo → item do menu (os 12 capítulos agrupados em 7 itens)
const GROUP = { hero: 0, form: 1, glass: 2, rim: 2, plate: 3, board: 4, driver: 4, battery: 4, inside: 5, comfort: 5, lineup: 6, close: 6 };

export function initMenu({ goTo, onToggle }) {
  const root = document.getElementById("menu"), btn = document.getElementById("menu-btn");
  const list = document.getElementById("menu-list"), label = btn.querySelector(".menu-label");
  const items = [...list.querySelectorAll("[data-goto]")];
  let open = false;

  function set(next, returnFocus = true) {
    if (open === next) return;
    open = next;
    root.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    label.textContent = open ? "CLOSE" : "MENU";
    list.inert = !open;                       // fechado: fora do foco e do leitor de tela
    onToggle && onToggle(open);
    if (open) items[0].focus({ preventScroll: true }); else if (returnFocus) btn.focus({ preventScroll: true });
  }

  btn.addEventListener("click", () => set(!open));
  items.forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); set(false, false); goTo(el.dataset.goto); }));
  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") return set(false);
    if (e.key !== "Tab") return;              // foco preso entre o botão e os itens
    const ring = [btn, ...items], i = ring.indexOf(document.activeElement);
    e.preventDefault();
    ring[(i + (e.shiftKey ? -1 : 1) + ring.length) % ring.length].focus({ preventScroll: true });
  });
  document.addEventListener("pointerdown", (e) => { if (open && !root.contains(e.target)) set(false, false); });

  // o ponto vermelho acompanha o item sob o cursor e volta ao item ativo
  const dot = list.querySelector(".menu-dot"), rows = [...list.querySelectorAll("li")];
  let active = 0;
  const moveDot = (i) => { dot.style.transform = `translateY(${rows[i].offsetTop + rows[i].offsetHeight / 2 - 3}px)`; };
  rows.forEach((li, i) => { li.addEventListener("pointerenter", () => moveDot(i)); li.querySelector("a").addEventListener("focus", () => moveDot(i)); });
  list.addEventListener("pointerleave", () => moveDot(active));

  return {
    get open() { return open; },
    close: () => set(false, false),
    setActive(chapterId) {
      const g = GROUP[chapterId] ?? 0;
      if (g === active && rows[g].classList.contains("on")) return;
      active = g; rows.forEach((li, i) => li.classList.toggle("on", i === g));
      if (!list.matches(":hover")) moveDot(g);
    },
  };
}
