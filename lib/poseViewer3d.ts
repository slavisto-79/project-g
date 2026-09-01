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

// How far a hand-held weight rides outboard of the wrist. On the wrist
// itself, a kettlebell's ball is wider than the gap to the thigh, and
// carried bells clipped straight through the legs.
const HELD_OUTBOARD = 0.045;

type BoneMeshes = { cylinder: THREE.Mesh; capA: THREE.Mesh; capB: THREE.Mesh; radius: number; part: string };

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
  // Forearm bone indices per side, so the fists can roll with the wrist.
  private forearmIndex: [number, number] = [-1, -1];
  private fistFollowsForearm = false;
  private held: THREE.Group[] = [];
  private centre = new THREE.Vector3();
  private orbitRadius = 1.6;
  // Set by fit(): true when the scene is much wider than it is tall.
  private lyingScene = false;
  // Hands shift outboard with their held weights, so the grip stays closed.
  private fistOutboard = false;
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

    this.buildMannequin(pose, implement);
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

  private buildMannequin(pose: ExercisePose, implement: ViewerImplement) {
    const first = this.frames[0]!;
    this.forearmIndex = [
      first.bones.findIndex((b) => b.part === "forearm" && b.side === 0),
      first.bones.findIndex((b) => b.part === "forearm" && b.side === 1),
    ] as [number, number];
    // Overhand and underhand fists wrap the bar axis (X), so they roll with
    // the forearm as it swings -- fingers stay opposite the forearm, the way
    // a real wrist carries a bar through a curl or a press. A neutral grip
    // wraps a fore-aft handle instead and keeps its fixed orientation.
    this.fistFollowsForearm = pose.grip !== "neutral";
    // Hands wrap what is actually drawn: fixed bars always, held loads only
    // when the exercise carries an implement (a bodyweight lunge holds air,
    // so its hands stay open).
    const gripping = first.props.some(
      (p) =>
        (p.kind === "bar" && !p.plates) ||
        ((p.kind === "bell" || (p.kind === "bar" && p.plates)) && implement !== undefined),
    );
    for (const bone of first.bones) {
      const radius = RADII[bone.part];
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 14, 1, true), this.bodyMaterial);
      const capA = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), this.bodyMaterial);
      const capB = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), this.bodyMaterial);
      // The fingered hand replaces the hand bone when something is held;
      // otherwise the straight hand segment pokes out under the fingers.
      // Kept in the list so update() indexing stays aligned with the frames.
      if (bone.part === "hand" && gripping) {
        cylinder.visible = capA.visible = capB.visible = false;
      }
      this.scene.add(cylinder, capA, capB);
      this.bones.push({ cylinder, capA, capB, radius, part: bone.part });
    }
    this.head = new THREE.Mesh(new THREE.SphereGeometry(first.head.r * 1.3, 18, 14), this.bodyMaterial);
    this.scene.add(this.head);

    // A hand per side. Holding something, it is four fingers and a thumb
    // wrapped around the handle, oriented by the grip -- overhand curls the
    // fingers over the top of the bar with the thumb underneath, underhand is
    // the mirror, and a neutral grip turns the whole hand (and its dumbbell)
    // ninety degrees into a hammer hold. Empty-handed it is a closed fist.
    for (let side = 0; side < 2; side++) {
      const fist = gripping ? this.grippingHand(pose.grip, side as 0 | 1) : new THREE.Group();
      if (!gripping) fist.add(new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), this.bodyMaterial));
      this.scene.add(fist);
      this.fists.push(fist);
    }
  }

  // Four finger arcs side by side along the handle, a shorter thumb arc
  // wrapping the other way, and a palm block at the heel. The arc GAP is what
  // reads as grip direction: overhand leaves it at the lower rear (fingers
  // come over the top), underhand flips it.
  private grippingHand(grip: ExercisePose["grip"], side: 0 | 1): THREE.Group {
    const hand = new THREE.Group();
    // Fingers wrap in this local frame around Z; the group is then turned so
    // Z lies along the handle (world X).
    const wrap = new THREE.Group();
    const flip = grip === "underhand" ? Math.PI : 0;
    for (let k = 0; k < 4; k++) {
      const finger = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0062, 8, 14, 4.4), this.bodyMaterial);
      // Arc gap at the lower rear for an overhand grip.
      finger.rotation.z = 1.9 + flip;
      finger.position.z = (k - 1.5) * 0.0128;
      wrap.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0058, 8, 12, 2.9), this.bodyMaterial);
    thumb.rotation.z = -1.4 + flip;
    // The thumb sits on the inner side of each hand along the bar.
    thumb.position.z = side === 0 ? -0.024 : 0.024;
    wrap.add(thumb);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), this.bodyMaterial);
    palm.scale.set(1.15, 1.15, 1.7);
    // The heel of the hand fills the arc gap, opposite the knuckles.
    const heel = 1.9 + flip + 4.4 / 2 + Math.PI;
    palm.position.set(Math.cos(heel) * 0.02, Math.sin(heel) * 0.02, 0);
    wrap.add(palm);
    // Along the bar (world X) normally; a neutral grip holds a fore-aft
    // handle, so the wrap stays around Z.
    if (grip !== "neutral") wrap.rotation.y = Math.PI / 2;
    hand.add(wrap);
    return hand;
  }

  // --- The equipment -------------------------------------------------------

  // Equipment must read as objects the body is holding, never as parts of the
  // body: bright cold chrome and near-black rubber against a warm matte
  // figure, and real proportions -- the first squat render had a bar the width
  // of the shoulders in body-coloured grey, and it fused with the mannequin.
  private chrome = new THREE.MeshStandardMaterial({ color: 0xc2c9ce, roughness: 0.25, metalness: 0.85 });
  private iron = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.45, metalness: 0.35 });
  private ironRim = new THREE.MeshStandardMaterial({ color: 0x3b444a, roughness: 0.4, metalness: 0.5 });
  private graphite = new THREE.MeshStandardMaterial({ color: 0x4c565c, roughness: 0.4, metalness: 0.7 });

  private alongX(mesh: THREE.Mesh): THREE.Mesh {
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  }

  private barbell(length: number): THREE.Group {
    const group = new THREE.Group();
    group.add(this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, length, 12), this.chrome)));
    for (const side of [-1, 1]) {
      // Sleeve, collar, then a big plate with a smaller one stacked outside --
      // the loaded-bar silhouette everyone recognises.
      const sleeve = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.16, 12), this.chrome));
      sleeve.position.x = side * (length / 2 - 0.08);
      const collar = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.016, 14), this.graphite));
      collar.position.x = side * (length / 2 - 0.165);
      const big = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.028, 26), this.iron));
      big.position.x = side * (length / 2 - 0.14);
      // A lighter rim ring so the plate reads as a plate with depth, not a
      // black blob.
      const rim = this.alongX(new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.006, 8, 26), this.ironRim));
      rim.rotation.y = Math.PI / 2;
      rim.rotation.z = 0;
      rim.position.x = side * (length / 2 - 0.14);
      const small = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.024, 22), this.iron));
      small.position.x = side * (length / 2 - 0.11);
      const hub = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.032, 14), this.ironRim));
      hub.position.x = side * (length / 2 - 0.125);
      group.add(sleeve, collar, big, rim, small, hub);
    }
    return group;
  }

  private plainBar(length: number): THREE.Group {
    const group = new THREE.Group();
    group.add(this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, length, 12), this.graphite)));
    for (const side of [-1, 1]) {
      const cap = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), this.chrome));
      cap.position.x = side * (length / 2 - 0.01);
      group.add(cap);
    }
    return group;
  }

  private dumbbell(): THREE.Group {
    const group = new THREE.Group();
    group.add(this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.15, 10), this.chrome)));
    for (const side of [-1, 1]) {
      // Six-sided heads: the hex profile is what says "dumbbell" at a glance.
      const head = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6), this.iron));
      head.position.x = side * 0.072;
      group.add(head);
    }
    return group;
  }

  // Origin at the grip point: the ball hangs below the hand, the way a
  // kettlebell actually hangs.
  private kettlebell(): THREE.Group {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 10, 18, Math.PI), this.graphite);
    group.add(handle);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.062, 18, 14), this.iron);
    // Slightly squashed, with a flattened base implied by sitting low.
    ball.scale.y = 0.92;
    ball.position.y = -0.08;
    group.add(ball);
    return group;
  }

  private medicineBall(size: number): THREE.Group {
    const group = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(Math.max(size * 0.65, 0.06), 18, 14), this.iron);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(Math.max(size * 0.65, 0.06), 0.004, 6, 24), this.ironRim);
    group.add(ball, seam);
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
        // A tall slab is a wall; drawn solid it hides the figure for the part
        // of the orbit where the camera passes behind it.
        const wall = prop.height > 0.3;
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, prop.height, prop.width),
          new THREE.MeshStandardMaterial({ color: BENCH, roughness: 0.8, transparent: wall, opacity: wall ? 0.45 : 1 }),
        );
        this.scene.add(pad);
        // Grounding. A tall drop is a bench and stands on legs; a short one
        // is a step or block drawn as a solid plinth -- four stubby legs
        // under a low box read as debris, which is exactly what the
        // split-squat block looked like in review. A tall slab is a wall and
        // needs no grounding at all.
        const floor = first.props.find((p) => p.kind === "floor");
        if (floor && floor.kind === "floor" && prop.height < 0.3) {
          const drop = prop.center[1] - floor.y;
          if (drop > 0.12) {
            for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
              const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02, drop, 0.02), this.iron);
              leg.position.set(prop.center[0] + sx * 0.07, floor.y + drop / 2, prop.center[2] + sz * (prop.width / 2 - 0.03));
              this.scene.add(leg);
            }
          } else if (drop > 0.02) {
            const plinth = new THREE.Mesh(
              new THREE.BoxGeometry(0.24, drop, prop.width),
              new THREE.MeshStandardMaterial({ color: BENCH, roughness: 0.85 }),
            );
            plinth.position.set(prop.center[0], floor.y + drop / 2, prop.center[2]);
            this.scene.add(plinth);
          }
        }
        this.held.push(this.anchored(pad, i, "slab"));
        continue;
      }
      if (prop.kind === "bar") {
        if (prop.plates && implement === undefined) continue;
        let mesh: THREE.Group;
        if (implement === "kettlebell" && prop.plates) {
          // The named case: a kettlebell swing is authored on the hinge, and a
          // hinge holds a bar. Swap the object, keep the movement.
          mesh = this.kettlebell();
        } else if (implement === "dumbbell" && prop.plates) {
          mesh = this.dumbbell();
          if (pose.grip === "neutral") mesh.rotation.y = Math.PI / 2;
        } else if (prop.plates) {
          mesh = this.barbell(prop.length);
        } else if (prop.rails) {
          // Parallel dip bars: one rail either side of the body, running
          // fore-aft, instead of a crossbar through the hips.
          mesh = new THREE.Group();
          for (const side of [-1, 1]) {
            const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.55, 12), this.graphite);
            rail.rotation.x = Math.PI / 2;
            rail.position.x = side * 0.1;
            mesh.add(rail);
            for (const end of [-1, 1]) {
              const post = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.5, 10), this.iron);
              post.position.set(side * 0.1, -0.25, end * 0.26);
              mesh.add(post);
            }
          }
        } else {
          mesh = this.plainBar(prop.length);
        }
        if (prop.dir) {
          // Landmine-style: the mesh is built along X. Aim it along dir and
          // shift it inside a carrier so the HANDS hold an end -- the rest of
          // the bar runs down toward its floor pivot.
          const d = new THREE.Vector3(prop.dir[0], prop.dir[1], prop.dir[2]).normalize();
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d);
          const carrier = new THREE.Group();
          mesh.position.copy(d).multiplyScalar(-(prop.length / 2 - 0.05));
          carrier.add(mesh);
          mesh = carrier;
        }
        this.scene.add(mesh);
        const perHand = implement === "dumbbell" && prop.plates;
        if (perHand) this.fistOutboard = true;
        this.held.push(this.anchored(mesh, i, "bar", perHand ? "hands" : "centre"));
        continue;
      }
      if (prop.kind === "bell" && implement === undefined) continue;
      // A barbell through both hands, when a barbell exercise runs on a
      // movement authored with per-hand weights (Barbell Curl on the curl).
      if (implement === "barbell") {
        if (!this.held.some((g) => (g.userData as { kind?: string }).kind === "gripbar")) {
          const bar = this.barbell(0.9);
          this.scene.add(bar);
          bar.userData = { propIndex: i, kind: "gripbar", mode: "grip" };
          this.held.push(bar);
        }
        continue;
      }
      // A bell. Two bells were authored per hand, so they are hand weights --
      // kettlebells or dumbbells. ONE bell is a single object held in both
      // hands: a ball for the slams and chops, a handle when it comes off a
      // cable stack. "Medicine Ball Slam" carries no loadable implement at
      // all, so this cannot lean on the implement alone.
      const bellCount = first.props.filter((p) => p.kind === "bell").length;
      const mesh =
        implement === "kettlebell"
          ? this.kettlebell()
          : implement === "dumbbell"
            ? this.dumbbell()
            : bellCount === 1
              ? implement === "machine"
                ? this.plainBar(0.16)
                : this.medicineBall(prop.size)
              : this.dumbbell();
      if (pose.grip === "neutral" && implement !== "kettlebell") mesh.rotation.y = Math.PI / 2;
      this.scene.add(mesh);
      this.fistOutboard = true;
      this.held.push(this.anchored(mesh, i, "bell"));
    }
  }

  // Ties a prop mesh to its index so update() can move it each frame; "hands"
  // means one copy per hand, so a second mesh is cloned for the other side.
  private anchored(mesh: THREE.Group | THREE.Mesh, propIndex: number, kind: string, mode: "centre" | "hands" = "centre"): THREE.Group {
    let group: THREE.Group;
    if (mesh instanceof THREE.Group) {
      group = mesh;
    } else {
      // Adopting a mesh REMOVES it from the scene, so the wrapper must be
      // added in its place or the mesh silently stops rendering.
      group = new THREE.Group().add(mesh);
      this.scene.add(group);
    }
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
    this.lyingScene = Math.max(size.x, size.z) > size.y * 1.45;
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
      // Feet are flat slabs and open hands are palm paddles, not round sticks.
      if (bone.part === "foot") bone.cylinder.scale.set(1.25, len, 0.62);
      else if (bone.part === "hand") bone.cylinder.scale.set(1.7, len, 0.5);
      else bone.cylinder.scale.set(1, len, 1);
      bone.cylinder.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
      bone.capA.position.copy(pa);
      bone.capB.position.copy(pb);
    }
    this.head.position.copy(lerp3(a.head.c, b.head.c, f));

    for (let s = 0; s < 2; s++) {
      this.fists[s]!.position.copy(lerp3(a.hands[s as 0 | 1], b.hands[s as 0 | 1], f));
      if (this.fistOutboard) this.fists[s]!.position.x += s === 0 ? HELD_OUTBOARD : -HELD_OUTBOARD;
      // Roll the fist to match the forearm. An arm hanging straight down is
      // the authored zero, so a deadlift keeps today's look and a press ends
      // half a turn on -- fingers over the top of the bar either way.
      const fi = this.forearmIndex[s as 0 | 1];
      if (this.fistFollowsForearm && fi >= 0) {
        const fa = lerp3(a.bones[fi]!.a, b.bones[fi]!.a, f);
        const fb = lerp3(a.bones[fi]!.b, b.bones[fi]!.b, f);
        this.fists[s]!.rotation.x = Math.atan2(fb.z - fa.z, -(fb.y - fa.y));
      }
    }

    for (const group of this.held) {
      const { propIndex, mode } = group.userData as { propIndex: number; mode: string };
      const pa = a.props[propIndex]!;
      const pb = b.props[propIndex]!;
      if (pa.kind === "floor" || pb.kind === "floor") continue;
      if (mode === "grip") {
        const h0 = lerp3(a.hands[0], b.hands[0], f);
        const h1 = lerp3(a.hands[1], b.hands[1], f);
        group.position.set((h0.x + h1.x) / 2, (h0.y + h1.y) / 2, (h0.z + h1.z) / 2);
        continue;
      }
      if (mode === "hands" || mode === "twin") {
        const side = mode === "twin" ? 1 : 0;
        group.position.copy(lerp3(a.hands[side]!, b.hands[side]!, f));
        group.position.x += side === 0 ? HELD_OUTBOARD : -HELD_OUTBOARD;
      } else if (pa.kind === "bell" && pb.kind === "bell" && this.frames[0]!.props.filter((p) => p.kind === "bell").length >= 2) {
        // Two bells were authored per hand; keep each on its hand in 3D, where
        // the hands genuinely sit apart on the lateral axis.
        const which = Math.min(this.frames[0]!.props.filter((p, idx) => p.kind === "bell" && idx < propIndex).length, 1) as 0 | 1;
        group.position.copy(lerp3(a.hands[which], b.hands[which], f));
        group.position.x += which === 0 ? HELD_OUTBOARD : -HELD_OUTBOARD;
      } else {
        group.position.copy(lerp3(pa.center, pb.center, f));
      }
    }

    if (this.controls) {
      this.controls.update();
    } else if (!this.reduceMotion) {
      // The card's slow orbit: a full turn every 18 seconds for a standing
      // figure. A lying figure is unreadable end-on, so wide scenes swing
      // across the legible arc instead of circling through it.
      const az = this.lyingScene
        ? 0.9 + Math.sin(elapsed * 0.00045) * 1.1
        : 0.9 + elapsed * 0.00035;
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
