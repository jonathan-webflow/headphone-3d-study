// Entrada do produto: os pontos acesos do loader viram partículas e voam até a superfície do fone.
// Uma nuvem só (1 chamada de desenho), que existe por ~2 s e depois é descartada.
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

export function createReveal({ root, model, count }) {
  // alvos: pontos na superfície das malhas, em quantidade proporcional à área, no espaço do root
  const t0 = performance.now();
  root.updateMatrixWorld(true);
  const meshes = []; model.traverse((o) => o.isMesh && o.visible && meshes.push(o));
  const samplers = meshes.map((m) => {
    const s = new MeshSurfaceSampler(m).build();
    const k = m.matrixWorld.getMaxScaleOnAxis();
    return { m, s, area: s.distribution[s.distribution.length - 1] * k * k };
  });
  const total = samplers.reduce((a, x) => a + x.area, 0);
  const target = new Float32Array(count * 3), p = new THREE.Vector3(), toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  let n = 0;
  samplers.forEach((x, i) => {
    const want = i === samplers.length - 1 ? count - n : Math.round((x.area / total) * count);
    for (let j = 0; j < want && n < count; j++, n++) {
      x.s.sample(p); p.applyMatrix4(x.m.matrixWorld).applyMatrix4(toRoot);
      target.set([p.x, p.y, p.z], n * 3);
    }
  });
  console.info(`[headphone] reveal: ${count} partículas em ${meshes.length} malhas, ${(performance.now() - t0).toFixed(0)} ms`);

  // o material nasce aqui, com uma partícula invisível, para o shader ser compilado ainda com o loader na tela
  let mat = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uFade: { value: 1 }, uFlash: { value: 0 }, uEnd: { value: 1.7 } },
    transparent: true, depthWrite: false, depthTest: false,
    vertexShader: /* glsl */ `
      attribute vec3 aStart, aCtrl; attribute vec4 aColor; attribute float aSeed, aSize;
      uniform float uK, uEnd; varying vec4 vC; varying float vE;
      void main() {
        // cada partícula sai com um atraso próprio: a forma se monta em ondas
        float e = clamp((uK - aSeed * 0.35) / 0.65, 0.0, 1.0);
        e = e < 0.5 ? 2.0 * e * e : 1.0 - pow(-2.0 * e + 2.0, 2.0) / 2.0;
        vec3 p = (1.0 - e) * (1.0 - e) * aStart + 2.0 * (1.0 - e) * e * aCtrl + e * e * position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = mix(aSize, uEnd, smoothstep(0.0, 0.3, e));
        vE = e; vC = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFade, uFlash; varying vec4 vC; varying float vE;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.32, d);
        // no voo o alfa dividido volta ao brilho de um ponto só; perto da forma, um clarão breve antes de sumir
        float alpha = mix(vC.a, 0.5, smoothstep(0.0, 0.35, vE)) * a * uFade;
        gl_FragColor = vec4(mix(vC.rgb, vec3(1.0), uFlash * 0.6), alpha);
      }
    `,
  });
  const attrs = (n) => {
    const g = new THREE.BufferGeometry();
    for (const [name, size] of [["position", 3], ["aStart", 3], ["aCtrl", 3], ["aColor", 4], ["aSeed", 1], ["aSize", 1]]) g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * size), size));
    return g;
  };
  let points = new THREE.Points(attrs(1), mat); points.frustumCulled = false; points.renderOrder = 10;
  mat.uniforms.uFade.value = 0; root.add(points);

  return {
    // origem: cada ponto aceso do loader (x, y em px CSS, r, g, b, a, raio) vira várias partículas no mesmo lugar da tela
    begin(dots, camera, pixelRatio, dist) {
      const nd = dots.length / 7;
      if (!nd || !points) return false;
      const per = Math.max(1, Math.ceil(count / nd));
      const geo = attrs(count);
      const start = geo.attributes.aStart.array, ctrl = geo.attributes.aCtrl.array, col = geo.attributes.aColor.array, seed = geo.attributes.aSeed.array, size0 = geo.attributes.aSize.array;
      geo.attributes.position.array.set(target);
      const W = innerWidth, H = innerHeight;   // dist: distância da câmera ao alvo, onde o produto está
      const ndc = new THREE.Vector3(), dir = new THREE.Vector3(), toRootNow = new THREE.Matrix4().copy(root.matrixWorld).invert();
      for (let i = 0; i < count; i++) {
        const d = (i % nd) * 7;   // reparte as partículas pelos pontos
        const jx = (Math.random() - 0.5) * 1.5, jy = (Math.random() - 0.5) * 1.5;
        ndc.set(((dots[d] + jx) / W) * 2 - 1, 1 - ((dots[d + 1] + jy) / H) * 2, 0.5).unproject(camera);
        dir.copy(ndc).sub(camera.position).normalize();
        p.copy(camera.position).addScaledVector(dir, dist).applyMatrix4(toRootNow);
        start.set([p.x, p.y, p.z], i * 3);
        // ponto de controle da curva: entre a origem e o alvo, empurrado para o lado (um leve redemoinho)
        const tx = target[i * 3], ty = target[i * 3 + 1], tz = target[i * 3 + 2];
        const len = Math.hypot(tx - p.x, ty - p.y, tz - p.z);
        ctrl.set([(p.x + tx) / 2 + (Math.random() - 0.5) * len * 0.6, (p.y + ty) / 2 + (Math.random() - 0.2) * len * 0.4, (p.z + tz) / 2 + (Math.random() - 0.5) * len * 0.6], i * 3);
        // várias partículas no mesmo ponto: o alfa de cada uma é dividido para que juntas tenham o brilho do ponto
        const a = dots[d + 5], aEach = 1 - Math.pow(1 - Math.min(0.98, a), 1 / per);
        col.set([dots[d + 2], dots[d + 3], dots[d + 4], aEach], i * 4);
        seed[i] = Math.random(); size0[i] = dots[d + 6] * 2 * pixelRatio;
      }
      points.geometry.dispose(); points.geometry = geo;
      mat.uniforms.uEnd.value = 1.7 * pixelRatio; mat.uniforms.uFade.value = 1;
      return true;
    },
    set(k, fade = 1, flash = 0) { if (mat) { mat.uniforms.uK.value = k; mat.uniforms.uFade.value = fade; mat.uniforms.uFlash.value = flash; } },
    dispose() {
      if (!points) return;
      root.remove(points); points.geometry.dispose(); mat.dispose(); points = mat = null;
    },
  };
}
