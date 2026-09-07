import {
  ACESFilmicToneMapping, DirectionalLight, HemisphereLight, Mesh,
  MeshPhysicalMaterial, PerspectiveCamera, PMREMGenerator, Scene, WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createToothGeometry } from "./tooth-geometry";

export type ToothScene = {
  setDark: (dark: boolean) => void;
  dispose: () => void;
};

export function createToothScene(host: HTMLElement, onFailure: () => void): ToothScene {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 30);
  camera.position.set(0, 0.1, 6.3);
  camera.lookAt(0, -0.08, 0);

  const room = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();

  const enamel = new MeshPhysicalMaterial({
    color: 0xfcfdff, metalness: 0.015, roughness: 0.29,
    clearcoat: 0.65, clearcoatRoughness: 0.26, iridescence: 0.035,
    iridescenceIOR: 1.3, envMapIntensity: 0.7,
  });
  const tooth = new Mesh(createToothGeometry(), enamel);
  tooth.rotation.set(0.12, -0.42, -0.14);
  scene.add(tooth);

  const key = new DirectionalLight(0xe4f0ff, 3);
  key.position.set(4, 6, 4);
  scene.add(key);
  const fill = new DirectionalLight(0x8dbbff, 0.6);
  fill.position.set(-4, 1, 2);
  scene.add(fill, new HemisphereLight(0xdbeaff, 0x1a3457, 0.65));

  let hovered = false;
  let focused = false;
  let inView = true;
  let disposed = false;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let targetX = 0.12;
  let targetY = -0.42;
  let dragging = false;
  let pointerId: number | null = null;
  let pointerX = 0;
  let pointerY = 0;
  let resumeAfter = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function schedule() {
    if (!frame && !disposed && inView && !document.hidden) frame = requestAnimationFrame(render);
  }

  function render(now: number) {
    frame = 0;
    if (disposed || !inView || document.hidden) return;
    const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    previous = now;
    const animate = !hovered && !focused && !reducedMotion.matches && !dragging;
    if (animate) {
      elapsed += delta;
      tooth.position.y = Math.sin(elapsed * 0.75) * 0.065;
      if (now > resumeAfter) targetY += delta * 0.12;
    }
    const damping = 1 - Math.exp(-delta * 9);
    tooth.rotation.x += (targetX - tooth.rotation.x) * damping;
    tooth.rotation.y += (targetY - tooth.rotation.y) * damping;
    try {
      renderer.render(scene, camera);
    } catch {
      onFailure();
      return;
    }
    if (animate || dragging || Math.abs(targetX - tooth.rotation.x) + Math.abs(targetY - tooth.rotation.y) > 0.0001) schedule();
  }

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.position.z = Math.max(5.9, 3.7 / camera.aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    schedule();
  }

  function onPointerDown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    dragging = true;
    pointerId = event.pointerId;
    pointerX = event.clientX;
    pointerY = event.clientY;
    host.setPointerCapture(event.pointerId);
    host.dataset.dragging = "true";
    schedule();
  }
  function onPointerMove(event: PointerEvent) {
    if (!dragging || pointerId !== event.pointerId) return;
    targetY += (event.clientX - pointerX) * 0.009;
    targetX = Math.max(-0.85, Math.min(0.85, targetX + (event.clientY - pointerY) * 0.007));
    pointerX = event.clientX;
    pointerY = event.clientY;
    schedule();
  }
  function onPointerEnd(event: PointerEvent) {
    if (pointerId !== event.pointerId) return;
    dragging = false;
    pointerId = null;
    delete host.dataset.dragging;
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    resumeAfter = performance.now() + 1800;
    schedule();
  }
  function onKeyDown(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    targetY += event.key === "ArrowLeft" ? -0.2 : event.key === "ArrowRight" ? 0.2 : 0;
    targetX = Math.max(-0.85, Math.min(0.85, targetX + (event.key === "ArrowUp" ? -0.15 : event.key === "ArrowDown" ? 0.15 : 0)));
    resumeAfter = performance.now() + 1800;
    schedule();
  }
  function visibilityChanged() { previous = 0; schedule(); }
  function onPointerEnter() { hovered = true; schedule(); }
  function onPointerLeave() { hovered = false; previous = 0; schedule(); }
  function onFocus() { focused = true; schedule(); }
  function onBlur() { focused = false; previous = 0; schedule(); }
  function contextLost(event: Event) { event.preventDefault(); onFailure(); }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    previous = 0;
    schedule();
  });
  intersection.observe(host);
  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerup", onPointerEnd);
  host.addEventListener("pointercancel", onPointerEnd);
  host.addEventListener("lostpointercapture", onPointerEnd);
  host.addEventListener("keydown", onKeyDown);
  host.addEventListener("pointerenter", onPointerEnter);
  host.addEventListener("pointerleave", onPointerLeave);
  host.addEventListener("focus", onFocus);
  host.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", visibilityChanged);
  reducedMotion.addEventListener("change", visibilityChanged);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  resize();

  return {
    setDark(dark) {
      enamel.envMapIntensity = dark ? 0.7 : 0.85;
      key.intensity = dark ? 2.7 : 2.4;
      schedule();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerEnd);
      host.removeEventListener("pointercancel", onPointerEnd);
      host.removeEventListener("lostpointercapture", onPointerEnd);
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("pointerenter", onPointerEnter);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("focus", onFocus);
      host.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", visibilityChanged);
      reducedMotion.removeEventListener("change", visibilityChanged);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      tooth.geometry.dispose();
      enamel.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
