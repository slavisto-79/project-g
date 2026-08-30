// A 3D view of an exercise: the mannequin, its equipment, and a camera.
//
// Web-only. This module owns a WebGL canvas inside a host element and knows
// nothing about React; App.tsx wraps it in a component. Two modes: the card
// shows the movement with a slowly orbiting camera, and the fullscreen viewer
// hands the camera to the user -- drag to rotate, pinch or scroll to zoom.
//
// The figure is a mannequin, not an attempt at a human: capsules for the
// limbs, spheres for the joints, a girdle and a pelvis giving it real width.
// That is a deliberate ceiling. It shows positions and paths clearly from any
// angle, which is what a form reference needs; it does not pretend to show
// musculature or mocap-grade motion, which hand-authored key positions cannot
// honestly provide.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ExercisePose, PoseFrame3D, Vec3 } from "./poses";

// Matches the loadable implements the workout knows about; the viewer only
// cares which family of equipment to draw.
export type ViewerImplement = "dumbbell" | "kettlebell" | "barbell" | "machine" | "other" | undefined;

const BODY = 0xd8d3cb;
const STEEL = 0x9aa3a8;
const IRON = 0x2b3134;
const BENCH = 0x66736c;
const FLOOR = 0x181c1a;
const FLOOR_RING = 0x2c332f;

// Radii per part. The trunk is the thickest thing on the body and the hands
// the thinnest, which is most of what makes the silhouette read as a person.
const RADII = {
  spine: 0.05,
  neck: 0.018,
  shoulders: 0.032,
  hips: 0.038,
  upperArm: 0.026,
  forearm: 0.022,
  hand: 0.015,
  thigh: 0.032,
  shin: 0.026,
  foot: 0.02,
} as const;

const PHASE_MS = 1100;

type BoneMeshes = { cylinder: THREE.Mesh; capA: THREE.Mesh; capB: THREE.Mesh; radius: number };

const UP = new THREE.Vector3(0, 1, 0);

function vec(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

function lerp3(a: Vec3, b: Vec3, t: number): THREE.Vector3 {
  return new THREE.Vector3(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  );
}

export class PoseViewer3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls | null = null;
  private canvas: HTMLCanvasElement;
  private host: HTMLElement;
  private resize: ResizeObserver;
  private raf = 0;
  private start = performance.now();
  private disposed = false;

  private frames: PoseFrame3D[];
  private bones: BoneMeshes[] = [];
  private head!: THREE.Mesh;
  private fists: THREE.Group[] = [];
  private held: THREE.Group[] = [];
  private centre = new THREE.Vector3();
  private orbitRadius = 1.6;
  private readonly interactive: boolean;
  private readonly reduceMotion: boolean;

  constructor(
    host: HTMLElement,
    pose: ExercisePose,
    implement: ViewerImplement,
    options: { interactive: boolean; reduceMotion?: boolean },
  ) {
    this.host = host;
    this.frames = pose.frames3d;
    this.interactive = options.interactive;
    this.reduceMotion = options.reduceMotion ?? false;

    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    // The card sits inside a pressable; without this the browser eats vertical
    // drags as page scroll before OrbitControls sees them.
    if (options.interactive) this.canvas.style.touchAction = "none";
    host.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 20);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x2c332c, 1.05);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(1.6, 2.6, 2.0);
    const rim = new THREE.DirectionalLight(0x9fffc0, 0.35);
    rim.position.set(-2.0, 1.2, -1.6);
    this.scene.add(hemi, key, rim);

    this.buildMannequin(pose);
    this.buildProps(pose, implement);

    this.resize = new ResizeObserver(() => this.applySize());
    this.resize.observe(host);
    // Fitting needs the real aspect ratio -- a lying figure that fits a wide
    // card overflows a portrait fullscreen -- so it waits for the first size.
    this.applySize();

    const tick = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(tick);
      this.update();
    };
    tick();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.controls?.dispose();
    this.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.renderer.dispose();
    this.canvas.remove();
  }

  private fitted = false;

  private applySize() {
    const w = Math.max(this.host.clientWidth, 1);
    const h = Math.max(this.host.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.fitted && w > 2 && h > 2) {
      this.fitted = true;
      this.fit();
      if (this.interactive) {
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.target.copy(this.centre);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = false;
        this.controls.minDistance = this.orbitRadius * 0.45;
        this.controls.maxDistance = this.orbitRadius * 2.6;
        this.controls.update();
      }
    }
  }

  // --- The mannequin -------------------------------------------------------

  private bodyMaterial = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.55, metalness: 0.05 });

  private buildMannequin(pose: ExercisePose) {
    const first = this.frames[0]!;
    for (const bone of first.bones) {
      const radius = RADII[bone.part];
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 14, 1, true), this.bodyMaterial);
      const capA = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), this.bodyMaterial);
      const capB = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), this.bodyMaterial);
      this.scene.add(cylinder, capA, capB);
      this.bones.push({ cylinder, capA, capB, radius });
    }
    this.head = new THREE.Mesh(new THREE.SphereGeometry(first.head.r * 1.3, 18, 14), this.bodyMaterial);
    this.scene.add(this.head);

    // A fist per hand. Around a bar it is a ring the bar threads through, with
    // a thumb bump on the side the grip dictates -- which is what visually
    // separates a curl grip from a row grip. Without a bar it is a closed fist.
    const holdsBar = first.props.some((p) => p.kind === "bar");
    for (let side = 0; side < 2; side++) {
      const fist = new THREE.Group();
      if (holdsBar) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.014, 10, 16), this.bodyMaterial);
        // The bar runs along X, so the ring's plane must face it.
        ring.rotation.y = Math.PI / 2;
        fist.add(ring);
        const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), this.bodyMaterial);
        thumb.position.set(0, pose.grip === "underhand" ? 0.028 : -0.028, 0.014);
        fist.add(thumb);
      } else {
        fist.add(new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), this.bodyMaterial));
      }
      this.scene.add(fist);
      this.fists.push(fist);
    }
  }

  // --- The equipment -------------------------------------------------------

  private steel = new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.35, metalness: 0.8 });
  private iron = new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.6, metalness: 0.4 });

  private barbell(length: number): THREE.Group {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, length, 12), this.steel);
    shaft.rotation.z = Math.PI / 2;
    group.add(shaft);
    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.1, 12), this.steel);
      sleeve.rotation.z = Math.PI / 2;
      sleeve.position.x = side * (length / 2 - 0.05);
      group.add(sleeve);
      // A big plate and a smaller one behind it, which is how a loaded bar
      // actually looks and reads instantly as "heavy".
      const big = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.022, 20), this.iron);
      big.rotation.z = Math.PI / 2;
      big.position.x = side * (length / 2 - 0.1);
      const small = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.018, 18), this.iron);
      small.rotation.z = Math.PI / 2;
      small.position.x = side * (length / 2 - 0.125);
      group.add(big, small);
    }
    return group;
  }

  private plainBar(length: number): THREE.Group {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, length, 12), this.steel);
    shaft.rotation.z = Math.PI / 2;
    group.add(shaft);
    return group;
  }

  private dumbbell(): THREE.Group {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 10), this.steel);
    handle.rotation.z = Math.PI / 2;
    group.add(handle);
    for (const side of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.045, 14), this.iron);
      head.rotation.z = Math.PI / 2;
      head.position.x = side * 0.065;
      group.add(head);
    }
    return group;
  }

  // Origin at the grip point: the ball hangs below the hand, the way a
  // kettlebell actually hangs.
  private kettlebell(): THREE.Group {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.009, 10, 18, Math.PI), this.steel);
    group.add(handle);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), this.iron);
    ball.position.y = -0.062;
    group.add(ball);
    return group;
  }

  private medicineBall(size: number): THREE.Group {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.SphereGeometry(size * 0.85, 16, 12), this.iron));
    return group;
  }

  // Which meshes stand in for the authored props, given what the exercise is
  // actually loaded with. A hinge is authored with a barbell, but done with a
  // kettlebell it must SHOW a kettlebell -- the authored prop names the
  // attachment point, the implement names the object.
  private buildProps(pose: ExercisePose, implement: ViewerImplement) {
    const first = this.frames[0]!;

    for (let i = 0; i < first.props.length; i++) {
      const prop = first.props[i]!;
      if (prop.kind === "floor") {
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(0.95, 40),
          new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.95 }),
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = prop.y;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.93, 0.95, 40),
          new THREE.MeshBasicMaterial({ color: FLOOR_RING, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = prop.y + 0.001;
        this.scene.add(disc, ring);
        continue;
      }
      if (prop.kind === "slab") {
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, prop.height, prop.width),
          new THREE.MeshStandardMaterial({ color: BENCH, roughness: 0.8 }),
        );
        pad.position.copy(vec(prop.center));
        this.scene.add(pad);
        // Legs down to the floor, when there is one to stand on.
        const floor = first.props.find((p) => p.kind === "floor");
        if (floor && floor.kind === "floor") {
          const drop = prop.center[1] - floor.y;
          if (drop > 0.03) {
            for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
              const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02, drop, 0.02), this.iron);
              leg.position.set(prop.center[0] + sx * 0.07, floor.y + drop / 2, prop.center[2] + sz * (prop.width / 2 - 0.03));
              this.scene.add(leg);
            }
          }
        }
        this.held.push(this.anchored(pad, i, "slab"));
        continue;
      }
      if (prop.kind === "bar") {
        let mesh: THREE.Group;
        if (implement === "kettlebell" && prop.plates) {
          // The named case: a kettlebell swing is authored on the hinge, and a
          // hinge holds a bar. Swap the object, keep the movement.
          mesh = this.kettlebell();
        } else if (implement === "dumbbell" && prop.plates) {
          mesh = this.dumbbell();
        } else if (prop.plates) {
          mesh = this.barbell(prop.length);
        } else {
          mesh = this.plainBar(prop.length);
        }
        this.scene.add(mesh);
        this.held.push(this.anchored(mesh, i, "bar", implement === "dumbbell" && prop.plates ? "hands" : "centre"));
        continue;
      }
      // A bell: a kettlebell or dumbbell in each gripping hand, or a medicine
      // ball when both hands hold the one object in front of the body.
      const mesh = implement === "kettlebell" ? this.kettlebell() : this.dumbbell();
      this.scene.add(mesh);
      this.held.push(this.anchored(mesh, i, "bell"));
    }
  }

  // Ties a prop mesh to its index so update() can move it each frame; "hands"
  // means one copy per hand, so a second mesh is cloned for the other side.
  private anchored(mesh: THREE.Group | THREE.Mesh, propIndex: number, kind: string, mode: "centre" | "hands" = "centre"): THREE.Group {
    const group = mesh instanceof THREE.Group ? mesh : new THREE.Group().add(mesh);
    group.userData = { propIndex, kind, mode };
    if (mode === "hands") {
      const twin = group.clone();
      twin.userData = { propIndex, kind, mode: "twin" };
      this.scene.add(twin);
      this.held.push(twin);
    }
    return group;
  }

  // --- Fitting and the frame loop ------------------------------------------

  private fit() {
    const box = new THREE.Box3();
    for (const frame of this.frames) {
      for (const bone of frame.bones) {
        box.expandByPoint(vec(bone.a));
        box.expandByPoint(vec(bone.b));
      }
      box.expandByPoint(vec(frame.head.c).addScalar(frame.head.r * 1.4));
      box.expandByPoint(vec(frame.head.c).addScalar(-frame.head.r * 1.4));
      for (const prop of frame.props) {
        if (prop.kind === "bar") {
          box.expandByPoint(vec(prop.center).add(new THREE.Vector3(prop.length / 2, 0.11, 0)));
          box.expandByPoint(vec(prop.center).add(new THREE.Vector3(-prop.length / 2, -0.11, 0)));
        } else if (prop.kind !== "floor") {
          box.expandByPoint(vec(prop.center).addScalar(0.08));
          box.expandByPoint(vec(prop.center).addScalar(-0.08));
        }
      }
    }
    box.getCenter(this.centre);
    const size = box.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    // Both axes must fit: the vertical field of view bounds the height, and
    // the horizontal one -- vertical times aspect -- bounds the width. On a
    // portrait phone the second is the tighter constraint for anything lying
    // down. A level-ish camera, because looking down from above pushes the
    // top of the figure into the frame edge, and the first thing that clipped
    // was the head -- the one part that must never clip.
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
    const fitV = size.y / 2 / tanV;
    const fitH = Math.max(size.x, size.z) / 2 / (tanV * Math.max(this.camera.aspect, 0.1));
    this.orbitRadius = Math.max(fitV, fitH, extent / 2 / tanV / 2) * 1.32;
    this.camera.position.set(
      this.centre.x + this.orbitRadius * Math.sin(0.9),
      this.centre.y + extent * 0.1,
      this.centre.z + this.orbitRadius * Math.cos(0.9),
    );
    this.camera.lookAt(this.centre);
  }

  private update() {
    const elapsed = performance.now() - this.start;
    const last = this.frames.length - 1;
    let t: number;
    if (this.reduceMotion) {
      // Land on the final key position rather than hiding the figure: the end
      // of the movement is the more informative half of most exercises.
      t = last;
    } else {
      const cycle = PHASE_MS * last * 2;
      const phase = (elapsed % cycle) / cycle; // 0..1 there and back
      const forward = phase < 0.5 ? phase * 2 : 2 - phase * 2;
      const eased = forward < 0.5 ? 2 * forward * forward : 1 - 2 * (1 - forward) * (1 - forward);
      t = eased * last;
    }
    const i = Math.min(Math.floor(t), last - 1);
    const f = t - i;
    const a = this.frames[i]!;
    const b = this.frames[i + 1]!;

    for (let n = 0; n < this.bones.length; n++) {
      const bone = this.bones[n]!;
      const pa = lerp3(a.bones[n]!.a, b.bones[n]!.a, f);
      const pb = lerp3(a.bones[n]!.b, b.bones[n]!.b, f);
      const dir = pb.clone().sub(pa);
      const len = Math.max(dir.length(), 1e-4);
      bone.cylinder.position.copy(pa).addScaledVector(dir, 0.5);
      bone.cylinder.scale.set(1, len, 1);
      bone.cylinder.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
      bone.capA.position.copy(pa);
      bone.capB.position.copy(pb);
    }
    this.head.position.copy(lerp3(a.head.c, b.head.c, f));

    for (let s = 0; s < 2; s++) {
      this.fists[s]!.position.copy(lerp3(a.hands[s as 0 | 1], b.hands[s as 0 | 1], f));
    }

    for (const group of this.held) {
      const { propIndex, mode } = group.userData as { propIndex: number; mode: string };
      const pa = a.props[propIndex]!;
      const pb = b.props[propIndex]!;
      if (pa.kind === "floor" || pb.kind === "floor") continue;
      if (mode === "hands" || mode === "twin") {
        const side = mode === "twin" ? 1 : 0;
        group.position.copy(lerp3(a.hands[side]!, b.hands[side]!, f));
      } else if (pa.kind === "bell" && pb.kind === "bell" && this.frames[0]!.props.filter((p) => p.kind === "bell").length >= 2) {
        // Two bells were authored per hand; keep each on its hand in 3D, where
        // the hands genuinely sit apart on the lateral axis.
        const which = this.frames[0]!.props.filter((p, idx) => p.kind === "bell" && idx < propIndex).length;
        group.position.copy(lerp3(a.hands[Math.min(which, 1) as 0 | 1], b.hands[Math.min(which, 1) as 0 | 1], f));
      } else {
        group.position.copy(lerp3(pa.center, pb.center, f));
      }
    }

    if (this.controls) {
      this.controls.update();
    } else if (!this.reduceMotion) {
      // The card's slow orbit: a full turn every 18 seconds, so every angle
      // comes round without the viewer doing anything.
      const az = 0.9 + elapsed * 0.00035;
      this.camera.position.set(
        this.centre.x + this.orbitRadius * Math.sin(az),
        this.camera.position.y,
        this.centre.z + this.orbitRadius * Math.cos(az),
      );
      this.camera.lookAt(this.centre);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
