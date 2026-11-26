// Estúdio: ambiente HDR próprio (renderizado no Blender) e pós-processamento.
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// ---------- Ambiente: o metal passa a refletir softboxes e faixas de luz ----------
export function loadStudio(renderer, scene, url, onReady, manager, onProgress) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader(manager).load(url, (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose(); pmrem.dispose();
    onReady && onReady();
  }, onProgress, (e) => console.error("studio.hdr", e));
}

// ---------- Pós: fundo → cena → oclusão → bloom → vinheta e grão → saída ----------
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.32 }, uGrain: { value: 0.014 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(d) * 1.25);
      c.rgb += (hash(vUv * 900.0 + uTime) - 0.5) * uGrain * (0.4 + c.rgb);
      gl_FragColor = c;
    }`,
};

// Profundidade de campo: desfoca pela distância ao plano de foco, lendo a profundidade que a
// oclusão já renderizou. O fundo (profundidade no infinito) fica de fora, então os pontos seguem nítidos.
const DofShader = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.01 }, uFar: { value: 4 }, uFocus: { value: 0.5 }, uRange: { value: 0.03 }, uMax: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 uRes;
    uniform float uNear, uFar, uFocus, uRange, uMax; varying vec2 vUv;
    float coc(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      if (d > 0.9999) return 0.0;                                   // fundo
      float z = uNear * uFar / (uFar - d * (uFar - uNear));         // distância à câmera, em metros
      float off = max(0.0, abs(z - uFocus) - uRange);               // faixa nítida em volta do foco
      return min(uMax, off / uFocus * uMax * 5.0);
    }
    void main() {
      float c = coc(vUv);
      vec4 base = texture2D(tDiffuse, vUv);
      if (c < 0.5) { gl_FragColor = base; return; }
      vec3 sum = base.rgb; float n = 1.0;
      for (int i = 1; i < 22; i++) {                                 // disco em espiral (ângulo áureo)
        float fi = float(i), r = sqrt(fi / 22.0) * c, a = fi * 2.39996;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r / uRes;
        float w = step(r * 0.6, coc(uv) + 0.5);                      // o que está nítido não vaza para o desfoque
        sum += texture2D(tDiffuse, uv).rgb * w; n += w;
      }
      gl_FragColor = vec4(sum / n, base.a);
    }`,
};

export function createPost(renderer, scene, camera, bg, hideFromAO = []) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, target);

  bg.uniforms.uGain.value = 0.42;
  composer.addPass(new RenderPass(bg.scene, bg.camera));
  const main = new RenderPass(scene, camera);
  main.clear = false; main.clearDepth = true;
  composer.addPass(main);

  // oclusão de ambiente em escala de produto (unidades em metros)
  const gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.updateGtaoMaterial({ radius: 0.014, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 8, distanceFallOff: 1.0, screenSpaceRadius: false });
  gtao.blendIntensity = 1.0;
  const renderAO = gtao.render.bind(gtao);
  gtao.render = (...args) => {           // poeira, arco e brilhos não entram na oclusão
    const was = hideFromAO.map((o) => o.visible);
    hideFromAO.forEach((o) => (o.visible = false));
    renderAO(...args);
    hideFromAO.forEach((o, i) => (o.visible = was[i]));
  };
  // a oclusão é uma sombra suave: calculada em meia resolução, custa um quarto e não perde nitidez visível
  const gtaoSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w, h) => gtaoSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)));
  gtao.setSize(size.x, size.y);
  composer.addPass(gtao);

  const dof = new ShaderPass(DofShader);
  dof.uniforms.tDepth.value = gtao.depthTexture;
  dof.uniforms.uNear.value = camera.near; dof.uniforms.uFar.value = camera.far;
  dof.uniforms.uRes.value.copy(size);
  dof.enabled = false;
  composer.addPass(dof);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.7, 0.92);
  composer.addPass(bloom);
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);
  composer.addPass(new OutputPass());

  return {
    composer, gtao, bloom, dof,
    // foco em metros; amount 0..1 (0 desliga o passe)
    setFocus(dist, amount) {
      dof.uniforms.uFocus.value = dist;
      dof.uniforms.uRange.value = dist * 0.05;
      dof.uniforms.uMax.value = amount * 5 * renderer.getPixelRatio();   // desfoque mais contido: o produto fora do foco não fica mole
      dof.enabled = amount > 0.01;
    },
    render(time) { if (renderer.domElement.width < 2) return; finish.uniforms.uTime.value = time % 10; composer.render(); },
    setSize(w, h) { if (w < 2 || h < 2) return; composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); renderer.getDrawingBufferSize(dof.uniforms.uRes.value); },
  };
}
