// Atmosfera no estilo da referência: fundo em shader, poeira e arco orbital.
import * as THREE from "three";

// ---------- Fundo (quad em tela cheia, desenhado antes da cena) ----------
// Azul-marinho com brilho atrás do produto, anéis concêntricos (onda sonora),
// grade fina que aparece na explosão e grão de filme.
export function createBackground() {
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uCenter: { value: new THREE.Vector2(0.6, 0.5) }, // produto na tela (0..1)
    uTime: { value: 0 },
    uRings: { value: 1 },  // força dos anéis
    uGrid: { value: 0 },   // força da grade
    uPhase: { value: 0 },
    uMouse: { value: new THREE.Vector2(-9999, -9999) },  // cursor, em pixels do alvo de render
    uMouseK: { value: 0 },
    uClear: { value: 0.3 },  // raio (em alturas de tela) da zona sem pontos atrás do produto
    uGain: { value: 1 },   // com pós-processamento o fundo passa pelo tone mapping; compensa aqui  // fase dos anéis (scroll)
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uRes; uniform vec2 uCenter; uniform vec2 uMouse; uniform float uTime, uRings, uGrid, uPhase, uGain, uClear, uMouseK;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 p = vUv; float aspect = uRes.x / uRes.y;
        vec2 d = (p - uCenter) * vec2(aspect, 1.0);
        float r = length(d);

        // base: grafite no centro, preto nas bordas
        vec3 col = mix(vec3(0.055), vec3(0.0), smoothstep(0.0, 0.9, r));

        // campo de intensidade: ondas que se afastam do produto + halo
        float w = 0.5 + 0.5 * sin(r * 24.0 - uPhase * 6.0 - uTime * 0.4);
        float ring = w * w * w * smoothstep(0.12, 0.3, r) * (1.0 - smoothstep(0.32, 0.95, r)) * uRings;
        float halo = 0.0;
        float clear = smoothstep(uClear * 0.9, uClear * 1.5, r);   // 0 atrás do produto, 1 longe dele
        // na explosão: colunas tipo equalizador, também em pontos
        float col_i = floor(gl_FragCoord.x / 10.0);
        float eq = step(p.y, 0.18 + 0.16 * abs(sin(col_i * 0.37 + uPhase * 3.0) * sin(col_i * 0.11 - uTime * 0.6))) * smoothstep(0.0, 0.25, p.y + 0.05);
        // os pontos perto do cursor acendem de leve
        float md = length(gl_FragCoord.xy - uMouse) / (uRes.y * 0.13);
        float mouse = exp(-md * md) * uMouseK;
        float field = clamp(ring * 0.9 + halo + eq * 0.32 * uGrid + mouse * 0.55, 0.0, 1.0) * clear;

        // matriz de pontos (halftone): o raio do ponto cresce com a intensidade
        float cell = 10.0 * (uRes.y / 1600.0 + 0.5);
        vec2 c = fract(gl_FragCoord.xy / cell) - 0.5;
        float rad = 0.08 + 0.32 * field;
        float dotm = 1.0 - smoothstep(rad - 0.06, rad + 0.02, length(c));
        col += vec3(1.0) * dotm * (0.035 * clear + 0.17 * field);
        col *= mix(0.55, 1.0, clear);   // escurece de leve logo atrás da silhueta

        // grão
        col += (hash(p * uRes + uTime) - 0.5) * 0.014;
        gl_FragColor = vec4(col * uGain, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { scene, camera, uniforms };
}

// ---------- Poeira (pontos com brilho suave) ----------
export function createDust(center, count = 1600) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // casca esférica achatada em volta do produto
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
    const rr = 0.18 + Math.pow(Math.random(), 0.7) * 0.7;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = center.x + rr * s * Math.cos(a);
    pos[i * 3 + 1] = center.y + rr * u * 0.6;
    pos[i * 3 + 2] = center.z + rr * s * Math.sin(a);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uPixel: { value: 1 }, uAlpha: { value: 0.6 }, uNear: { value: 0.5 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uPixel, uNear; varying float vA;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.25 + aSeed * 40.0) * 0.006;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = mix(1.0, 3.2, aSeed * aSeed) * uPixel;
        gl_PointSize = size * (0.55 / -mv.z);
        vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 20.0));
        vA *= smoothstep(uNear * 1.0, uNear * 1.25, -mv.z);   // só poeira atrás do produto
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.85) * a * vA * uAlpha, 1.0);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, uniforms };
}

// ---------- Arco orbital (linha fina com cauda e um ponto brilhante) ----------
function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.16, "rgba(255,90,90,0.95)");
  grad.addColorStop(0.42, "rgba(215,25,33,0.3)");
  grad.addColorStop(1, "rgba(215,25,33,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createOrbit(segments = 160) {
  const group = new THREE.Group();
  const pos = new Float32Array((segments + 1) * 3);
  const col = new Float32Array((segments + 1) * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  }));
  line.frustumCulled = false;
  const head = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
  }));
  head.scale.setScalar(0.022);
  group.add(line, head);
  group.renderOrder = 10;

  // atualiza o arco: raio (m), ângulo da ponta, comprimento (rad), intensidade 0..1
  function update(radius, headAngle, length, strength) {
    for (let i = 0; i <= segments; i++) {
      const f = i / segments;                   // 0 = cauda, 1 = ponta
      const a = headAngle - length * (1 - f);
      pos[i * 3] = Math.cos(a) * radius;
      pos[i * 3 + 1] = Math.sin(a) * radius;
      pos[i * 3 + 2] = 0;
      const k = Math.pow(f, 1.6) * strength;    // cauda some
      col[i * 3] = 0.8 * k; col[i * 3 + 1] = 0.8 * k; col[i * 3 + 2] = 0.8 * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    head.position.set(Math.cos(headAngle) * radius, Math.sin(headAngle) * radius, 0);
    head.scale.setScalar(radius * 0.11);   // o brilho acompanha a escala da cena
    head.material.opacity = strength;
  }
  return { group, update };
}
