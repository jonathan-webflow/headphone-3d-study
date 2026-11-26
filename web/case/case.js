// Página do case: vídeos tocam só quando visíveis; textos e mídia entram uma vez ao aparecer.
// Reveal no estilo da Revelatio (GSAP SplitText + ScrambleText) nos textos em Geist; nos títulos em
// Doto (matriz de pontos) um scramble próprio, letra a letra, mais lento.
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- vídeos ----------
const films = document.querySelectorAll("video.film");
if (still) {
  films.forEach((v) => { v.controls = true; v.loop = false; });   // nada toca sozinho; o pôster fica à vista
} else {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) { v.preload = "auto"; v.play().catch(() => {}); } else v.pause();
    }
  }, { threshold: 0.35 });
  films.forEach((v) => io.observe(v));
}

// ---------- reveals ----------
const reveals = [...document.querySelectorAll(".reveal")];
const ready = !still && window.gsap && window.ScrollTrigger && window.SplitText && window.ScrambleTextPlugin;
const fontsIn = () => document.documentElement.classList.add("fonts-in");
if (!ready) {
  reveals.forEach((el) => el.classList.add("in"));   // sem GSAP ou com movimento reduzido: tudo aparece direto
  fontsIn();
} else {
  gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

  // textos em Geist: cada palavra vira símbolos e se resolve no texto real (tempos da referência)
  const SYM = "^*?+=!$:/";   // símbolos estreitos: a palavra embaralhada cabe na largura da palavra real
  const rnd = (n, pool) => Array.from({ length: n }, () => pool[(Math.random() * pool.length) | 0]).join("");
  function scrambleWords(el, delay = 0) {
    const split = SplitText.create(el, { type: "words", wordsClass: "ld-sw", aria: "auto" });   // leitor de tela lê o texto real
    const words = split.words, orig = words.map((w) => w.textContent);
    const each = words.length > 30 ? 0.008 : 0.015;   // parágrafo longo não demora
    // cada palavra guarda a própria largura enquanto embaralha: as linhas não mudam de lugar
    const widths = words.map((w) => w.getBoundingClientRect().width);
    words.forEach((w, i) => { w.style.width = widths[i] + "px"; w.textContent = rnd(orig[i].length, SYM); });
    let left = words.length;
    words.forEach((w, i) => gsap.to(w, {
      duration: 1.4, delay: delay + i * each,
      scrambleText: { text: orig[i], chars: SYM, speed: 0.95 },
      onComplete: () => { if (--left === 0) split.revert(); },
    }));
  }

  // títulos em Doto: resolvem letra a letra, da esquerda para a direita, com glifos que a matriz de pontos desenha bem
  function scrambleDots(el, delay = 0) {
    const digits = /^[\d.,k%]+$/i.test(el.textContent.trim());
    const pool = digits ? "0123456789" : ":+=*#%";
    // palavras inteiras (sem quebra no meio) e cada letra com a largura travada
    const split = SplitText.create(el, { type: "words, chars", wordsClass: "ld-sw", charsClass: "ld-sc", aria: "auto" });
    const chars = split.chars, orig = chars.map((c) => c.textContent);
    const widths = chars.map((c) => c.getBoundingClientRect().width);
    chars.forEach((c, i) => { c.style.width = widths[i] + "px"; if (orig[i].trim()) c.textContent = rnd(1, pool); });
    let left = chars.length;
    chars.forEach((c, i) => gsap.to(c, {
      duration: digits ? 0.9 : 0.7, delay: delay + i * (digits ? 0.12 : 0.055), ease: "none",
      scrambleText: { text: orig[i], chars: pool, speed: 0.4 },
      onComplete: () => { if (--left === 0) split.revert(); },
    }));
  }

  const TEXT = "h2, .bd-h, .side, .bd-p, .eyebrow, .group, figcaption, .caps h3, .caps p, .close .lead, .live-actions span";
  const hero = document.querySelector(".hero");

  // topo: na abertura da página, com as fontes já carregadas
  document.fonts.ready.then(() => {
    const h1 = hero.querySelector("h1.dot"), lead = hero.querySelector(".lead");
    if (h1) scrambleDots(h1, 0.15);
    fontsIn();   // o título só aparece com a Doto carregada (nada de fonte de reserva no primeiro quadro)
    if (lead) scrambleWords(lead, 0.35);
  });

  // textos: quando entram na tela, uma vez
  document.querySelectorAll(TEXT).forEach((el) => {
    if (hero.contains(el)) return;
    ScrollTrigger.create({
      trigger: el, start: "top 95%", once: true,
      onEnter: () => { if (el.classList.contains("reveal")) gsap.set(el, { autoAlpha: 1 }); scrambleWords(el); },
    });
  });

  // números em Doto
  document.querySelectorAll("b.dot").forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => scrambleDots(el, 0.1) });
  });

  // mídia e blocos: entram em onda pela grade (linha e coluna), com impulso no começo e assentamento longo.
  // Só transform e opacidade; quem entra junto na tela forma um lote e o atraso de cada um vem da posição na grade.
  const blocks = reveals.filter((el) => !el.matches(TEXT));
  ScrollTrigger.batch(blocks, {
    start: "top 98%", once: true,
    onEnter: (batch) => {
      gsap.set(batch, { willChange: "transform, opacity" });
      gsap.fromTo(batch,
        { autoAlpha: 0, y: 48, scale: 0.97 },
        {
          autoAlpha: 1, y: 0, scale: 1, duration: 1.1, ease: "expo.out", overwrite: true,
          stagger: { each: 0.07, grid: "auto", from: "start" },
          clearProps: "transform,willChange",
        });
    },
  });

  // imagens com carregamento tardio mudam a altura da página: recalcula os pontos de disparo quando chegam
  let refreshT = 0;
  const refresh = () => { clearTimeout(refreshT); refreshT = setTimeout(() => ScrollTrigger.refresh(), 150); };
  document.querySelectorAll("img").forEach((img) => { if (!img.complete) img.addEventListener("load", refresh, { once: true }); });

  // hover em links: as letras piscam em ordem aleatória e o link encolhe de leve
  document.querySelectorAll(".bracket b, .cta").forEach((label) => {
    const link = label.closest("a") || label;
    // num contêiner flex os espaços entre palavras somem: o texto vai para um span comum antes de dividir
    if (getComputedStyle(label).display.includes("flex")) {
      const inner = document.createElement("span");
      while (label.firstChild) inner.appendChild(label.firstChild);
      label.appendChild(inner); label = inner;
    }
    const split = SplitText.create(label, { type: "words, chars", wordsClass: "ld-sw", charsClass: "ld-sc", aria: "auto" });   // palavras preservam os espaços
    const flicker = () => {
      gsap.to(link, { scale: 0.985, duration: 0.35, ease: "power2.out", overwrite: "auto" });
      gsap.to(split.chars, {
        keyframes: [{ opacity: 0, duration: 0.06 }, { opacity: 1, duration: 0.04 }, { opacity: 0, duration: 0.05 }, { opacity: 1, duration: 0.08 }],
        ease: "none", stagger: { each: 0.03, from: "random" }, overwrite: true,
      });
    };
    link.addEventListener("mouseenter", flicker);
    link.addEventListener("mouseleave", () => { gsap.to(link, { scale: 1, duration: 0.35, ease: "power2.out", overwrite: "auto" }); flicker(); });
  });
}
