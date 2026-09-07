import { BufferAttribute, BufferGeometry, MeshBasicMaterial } from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

function smoothUnion(a: number, b: number, radius: number) {
  const h = Math.max(radius - Math.abs(a - b), 0) / radius;
  return Math.min(a, b) - h * h * radius * 0.25;
}

function ellipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  const k0 = Math.hypot(x / rx, y / ry, z / rz);
  const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 > 0 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}

// A closed, smooth molar surface: rounded crown, four cusps and two tapered roots.
// This is a decorative model, not an anatomical or diagnostic reference.
export function toothDistance(x: number, y: number, z: number) {
  // A softly squared crown, rather than a cluster of spherical lobes.
  const crown = Math.pow(
    Math.pow(Math.abs(x / 0.83), 2.8) +
    Math.pow(Math.abs((y - 0.49) / 0.61), 2.8) +
    Math.pow(Math.abs(z / 0.66), 2.8),
    1 / 2.8,
  );
  let d = (crown - 1) * 0.61;
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      d = smoothUnion(d, ellipsoid(x - sideX * 0.37, y - 0.88, z - sideZ * 0.28, 0.36, 0.28, 0.32), 0.20);
    }
    // Continuous curved roots avoid the seams of a chain of small spheres.
    const depth = Math.max(0, Math.min(1, (0.2 - y) / 1.8));
    const rootX = sideX * (0.35 + 0.19 * depth * depth);
    const taper = 1 - 0.42 * depth;
    d = smoothUnion(d, ellipsoid(x - rootX, y + 0.53, z - 0.04 * depth, 0.35 * taper, 1.03, 0.32 * taper), 0.24);
  }
  const crownHollow = ellipsoid(x, y - 1.35, z, 0.43, 0.34, 0.35);
  return -smoothUnion(-d, crownHollow, 0.1);
}

export function createToothGeometry(resolution = 80) {
  const placeholder = new MeshBasicMaterial();
  const surface = new MarchingCubes(resolution, placeholder, false, false, 40000);
  surface.isolation = 0;
  for (let z = 0; z < resolution; z++) {
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        surface.field[x + y * resolution + z * resolution * resolution] = -toothDistance(
          (x / resolution - 0.5) * 4,
          (y / resolution - 0.5) * 4,
          (z / resolution - 0.5) * 4,
        );
      }
    }
  }
  surface.update();
  const count = surface.geometry.drawRange.count;
  const geometry = new BufferGeometry();
  for (const name of ["position", "normal"]) {
    const attribute = surface.geometry.getAttribute(name);
    geometry.setAttribute(name, new BufferAttribute(new Float32Array(attribute.array.slice(0, count * 3)), 3));
  }
  geometry.scale(2, 2, 2);
  geometry.computeBoundingSphere();
  surface.geometry.dispose();
  placeholder.dispose();
  return geometry;
}
