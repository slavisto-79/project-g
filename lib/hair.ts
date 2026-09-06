// Hair that moves: small position-based (Verlet) simulations the viewer
// steps every frame from the head's world transform. A `Strand` is a chain
// of points hanging from a root -- a ponytail, a loose wisp -- drawn as a
// tapered tube; a `Spring` is one point pulled back to a rest place, for
// things that only sway (a bun on its tie, the lag of a quiff). Both keep
// clear of the skull. Everything is in world units and world space; the
// caller hands in the anchors each frame.
import * as THREE from "three";

const MAX_DT = 1 / 30;

// A chain of `segments` links of `length` each, drawn as a tube of `sides`
// around it, `r0` thick at the root tapering to `r1` at the tip.
export class Strand {
  readonly mesh: THREE.Mesh;
  private readonly pts: THREE.Vector3[] = [];
  private readonly prev: THREE.Vector3[] = [];
  private readonly segLen: number;
  private readonly radii: number[] = [];
  private readonly sides: number;
  private readonly positions: THREE.Float32BufferAttribute;
  private settled = false;

  constructor(material: THREE.Material, segments: number, length: number, r0: number, r1: number, sides = 8) {
    this.segLen = length / segments;
    this.sides = sides;
    for (let i = 0; i <= segments; i++) {
      this.pts.push(new THREE.Vector3());
      this.prev.push(new THREE.Vector3());
      const t = i / segments;
      // Rounder at the root, drawn to a point at the tip.
      this.radii.push(r0 + (r1 - r0) * Math.pow(t, 0.8));
    }
    const rings = segments + 1;
    const geometry = new THREE.BufferGeometry();
    this.positions = new THREE.Float32BufferAttribute(new Float32Array(rings * sides * 3), 3);
    this.positions.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", this.positions);
    const index: number[] = [];
    for (let i = 0; i + 1 < rings; i++) {
      for (let k = 0; k < sides; k++) {
        const k1 = (k + 1) % sides;
        const a0 = i * sides + k, a1 = i * sides + k1, b0 = (i + 1) * sides + k, b1 = (i + 1) * sides + k1;
        index.push(a0, b0, a1, a1, b0, b1);
      }
    }
    // Close both ends with fans.
    const tip = (rings - 1) * sides;
    for (let k = 0; k < sides; k++) index.push(tip + k, tip + ((k + 2) % sides), tip + ((k + 1) % sides));
    for (let k = 0; k < sides; k++) index.push(k, (k + 1) % sides, (k + 2) % sides);
    geometry.setIndex(index);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
  }

  // Lay the chain out from `root` along `dir` with no motion, e.g. before
  // the first frame or when the pose jumps.
  reset(root: THREE.Vector3, dir: THREE.Vector3) {
    for (let i = 0; i < this.pts.length; i++) {
      this.pts[i]!.copy(root).addScaledVector(dir, i * this.segLen);
      this.prev[i]!.copy(this.pts[i]!);
    }
    this.settled = true;
  }

  // One step: the root goes where the head puts it, the rest follows under
  // gravity, drag, a little stiffness that keeps the chain leaving the root
  // along `rootDir`, and the skull as a sphere it cannot enter.
  step(root: THREE.Vector3, rootDir: THREE.Vector3, dt: number, head: THREE.Vector3, headR: number, opts: { gravity: number; damping: number; stiffness: number }) {
    if (!this.settled) this.reset(root, rootDir);
    dt = Math.min(MAX_DT, Math.max(0, dt));
    const n = this.pts.length;
    // Sub-step for stability at the frame rates a phone gives.
    const sub = 2;
    const h = dt / sub;
    const v = new THREE.Vector3();
    for (let s = 0; s < sub; s++) {
      this.pts[0]!.copy(root);
      this.prev[0]!.copy(root);
      for (let i = 1; i < n; i++) {
        const p = this.pts[i]!, q = this.prev[i]!;
        v.subVectors(p, q).multiplyScalar(opts.damping);
        q.copy(p);
        p.add(v);
        p.y -= opts.gravity * h * h;
      }
      // Stiffness, once per sub-step so gravity has a say: the first link
      // wants to leave the root the way the hair is tied, and each link
      // after it leans toward continuing the last.
      const want = root.clone().addScaledVector(rootDir, this.segLen);
      this.pts[1]!.lerp(want, opts.stiffness * 0.4);
      for (let i = 2; i < n; i++) {
        const a = this.pts[i - 2]!, b = this.pts[i - 1]!, c = this.pts[i]!;
        const straight = v.subVectors(b, a).normalize().multiplyScalar(this.segLen).add(b);
        c.lerp(straight, opts.stiffness * 0.1);
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i < n; i++) {
          const a = this.pts[i - 1]!, b = this.pts[i]!;
          const d = v.subVectors(b, a);
          const len = d.length() || 1e-6;
          const corr = (len - this.segLen) / len;
          if (i === 1) b.addScaledVector(d, -corr);
          else {
            a.addScaledVector(d, corr * 0.5);
            b.addScaledVector(d, -corr * 0.5);
          }
        }
        // Out of the skull.
        for (let i = 1; i < n; i++) {
          const p = this.pts[i]!;
          const d = v.subVectors(p, head);
          const len = d.length();
          const min = headR + this.radii[i]!;
          if (len < min && len > 1e-6) p.copy(head).addScaledVector(d, min / len);
        }
      }
    }
    this.draw();
  }

  private draw() {
    const n = this.pts.length;
    const sides = this.sides;
    const arr = this.positions.array as Float32Array;
    const t = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3();
    let lastU: THREE.Vector3 | null = null;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i]!;
      // The ring's plane is across the chain; carry the frame along it so
      // the tube does not twist.
      if (i < n - 1) t.subVectors(this.pts[i + 1]!, p);
      else t.subVectors(p, this.pts[i - 1]!);
      if (t.lengthSq() < 1e-10) t.set(0, -1, 0);
      t.normalize();
      if (!lastU) {
        u.set(1, 0, 0);
        if (Math.abs(u.dot(t)) > 0.9) u.set(0, 0, 1);
      } else u.copy(lastU);
      u.addScaledVector(t, -u.dot(t)).normalize();
      w.crossVectors(t, u);
      lastU = u.clone();
      const r = this.radii[i]!;
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const o = (i * sides + k) * 3;
        arr[o] = p.x + r * (Math.cos(a) * u.x + Math.sin(a) * w.x);
        arr[o + 1] = p.y + r * (Math.cos(a) * u.y + Math.sin(a) * w.y);
        arr[o + 2] = p.z + r * (Math.cos(a) * u.z + Math.sin(a) * w.z);
      }
    }
    this.positions.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}

// One point on a spring to a moving rest place: it lags behind and swings
// back, which is all a bun on its tie or a quiff of short hair does.
export class Spring {
  readonly p = new THREE.Vector3();
  private readonly prev = new THREE.Vector3();
  private settled = false;

  constructor(private readonly stiffness: number, private readonly damping: number, private readonly reach: number) {}

  reset(target: THREE.Vector3) {
    this.p.copy(target);
    this.prev.copy(target);
    this.settled = true;
  }

  // Returns the offset from the rest place after the step, at most `reach`.
  step(target: THREE.Vector3, dt: number, gravity = 0): THREE.Vector3 {
    if (!this.settled) this.reset(target);
    dt = Math.min(MAX_DT, Math.max(0, dt));
    const sub = 2;
    const h = dt / sub;
    const v = new THREE.Vector3();
    for (let s = 0; s < sub; s++) {
      v.subVectors(this.p, this.prev).multiplyScalar(this.damping);
      this.prev.copy(this.p);
      this.p.add(v);
      // Spring toward the target, gravity down.
      this.p.addScaledVector(v.subVectors(target, this.p), this.stiffness * h * h * 3600);
      this.p.y -= gravity * h * h;
      const off = v.subVectors(this.p, target);
      const len = off.length();
      if (len > this.reach) this.p.copy(target).addScaledVector(off, this.reach / len);
    }
    return this.p.clone().sub(target);
  }
}
