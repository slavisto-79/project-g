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
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ExercisePose, PoseFrame3D, PoseProp3D, Vec3 } from "./poses";
import { REFERENCE_AVATAR, type AvatarBuild } from "./avatar";

// Matches the loadable implements the workout knows about; the viewer only
// cares which family of equipment to draw.
export type ViewerImplement = "dumbbell" | "kettlebell" | "barbell" | "machine" | "other" | undefined;

const SHIRT = 0xd8d3cb;
const BENCH = 0x66736c;
// Half the trunk's depth (the spine ellipse's shallow axis): how far a bench
// pad's surface must sit below the spine line for the body to rest ON it.
const BODY_HALF = 0.052;
const FLOOR = 0x181c1a;
const FLOOR_RING = 0x2c332f;

// Radii per part. The trunk is the thickest thing on the body and the hands
// the thinnest, which is most of what makes the silhouette read as a person.
// Proportions of a trained man, not a pipe robot: the trunk is drawn as a
// tapered ellipse elsewhere; these give the delts, the neck, and the legs
// their mass. The shoulders' end caps ARE the deltoids.
const RADII = {
  spine: 0.05,
  neck: 0.023,
  shoulders: 0.045,
  hips: 0.041,
  upperArm: 0.031,
  forearm: 0.026,
  hand: 0.015,
  thigh: 0.041,
  shin: 0.031,
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
  // Sneakers replace the foot capsules; placed from the foot and shin bones.
  private shoes: THREE.Group[] = [];
  private footIndex: [number, number] = [-1, -1];
  private shinIndex: [number, number] = [-1, -1];
  private face = new THREE.Group();
  private floorDisc: THREE.Group | null = null;
  private spineIndex = -1;
  private neckIndex = -1;
  private facing: 1 | -1 = 1;
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
  // Fired once, after the first frame has actually been drawn at a real
  // size -- the host shows a placeholder until then, because the first
  // WebGL context of a session can take a few seconds to come up.
  private readonly onReady: (() => void) | undefined;
  private readyFired = false;
  // Who the figure is built to look like (see lib/avatar.ts).
  private readonly avatar: AvatarBuild;
  // Trunk ellipse multipliers from the avatar's build, applied in update().
  private trunkW = 1;
  private trunkD = 1;
  // Female build only: a cropped sports top over a bare-skin trunk, and a
  // gentle bust under it. Both ride the spine bone in update().
  private cropTop: THREE.Mesh | null = null;
  private bust: THREE.Mesh | null = null;

  constructor(
    host: HTMLElement,
    pose: ExercisePose,
    implement: ViewerImplement,
    options: { interactive: boolean; reduceMotion?: boolean; onReady?: () => void; avatar?: AvatarBuild },
  ) {
    this.host = host;
    this.frames = pose.frames3d;
    this.interactive = options.interactive;
    this.reduceMotion = options.reduceMotion ?? false;
    this.onReady = options.onReady;
    this.avatar = options.avatar ?? REFERENCE_AVATAR;

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

  // The coach: a bronzed athlete in the app's kit -- light sleeveless top,
  // dark knee-length shorts, and the brand lime on the wristbands and shoes.
  // Sleeveless on purpose: the arms stay bare so shoulders and
  // elbows read clearly in every demo. The top is the old mannequin grey, the
  // one light surface that holds up against the dark card and the black
  // iron; a dark top made the trunk vanish and the figure read as floating
  // limbs.
  private skin = new THREE.MeshStandardMaterial({ color: 0xc79b74, roughness: 0.6, metalness: 0.02 });
  private hair = new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.8 });
  private shirt = new THREE.MeshStandardMaterial({ color: SHIRT, roughness: 0.55, metalness: 0.05 });
  private shorts = new THREE.MeshStandardMaterial({ color: 0x1f2421, roughness: 0.7, metalness: 0.05 });
  private lime = new THREE.MeshStandardMaterial({ color: 0xc8ff32, roughness: 0.5, metalness: 0.05 });
  // The female sports top: a dusty berry, distinct from the male's light
  // shirt at a glance and still bright enough against the dark card.
  private topFemale = new THREE.MeshStandardMaterial({ color: 0xb85c7a, roughness: 0.6, metalness: 0.03 });

  // What each bone wears: the cylinder and its two end caps (a = the bone's
  // start, b = its end -- for a forearm, b is the wrist). On the female build
  // the trunk itself is skin (the cropped top is a separate mesh over its
  // upper part), the girdle carries the top's straps and the delts are bare.
  private kit(part: string): { body: THREE.MeshStandardMaterial; a: THREE.MeshStandardMaterial; b: THREE.MeshStandardMaterial } {
    const female = this.avatar.sex === "female";
    switch (part) {
      case "spine":
        return female ? { body: this.skin, a: this.skin, b: this.topFemale } : { body: this.shirt, a: this.shirt, b: this.shirt };
      case "shoulders":
        return female ? { body: this.topFemale, a: this.skin, b: this.skin } : { body: this.shirt, a: this.shirt, b: this.shirt };
      case "hips":
      case "thigh":
        return { body: this.shorts, a: this.shorts, b: this.shorts };
      case "forearm":
        return { body: this.skin, a: this.skin, b: this.lime };
      default:
        // Includes the foot, whose capsule is hidden under the sneaker.
        return { body: this.skin, a: this.skin, b: this.skin };
    }
  }

  // A sneaker in its own frame: +Z heel to toe, +Y up, origin at the middle
  // of the foot bone. Dark outsole, pale midsole, lime upper with a rounded
  // toe box, a dark heel counter and three laces across the instep. The
  // sole's underside sits where the old foot capsule's did (0.0124 below the
  // bone), so planted feet still meet the floor disc.
  private sole = new THREE.MeshStandardMaterial({ color: 0xe9e7e0, roughness: 0.7, metalness: 0.02 });
  private sneaker(): THREE.Group {
    const shoe = new THREE.Group();
    const L = 0.104;
    const W = 0.05;
    const bottom = -0.0124;
    const outsole = new THREE.Mesh(new RoundedBoxGeometry(W, 0.005, L, 3, 0.002), this.rubber);
    outsole.position.y = bottom + 0.0025;
    const midsole = new THREE.Mesh(new RoundedBoxGeometry(W, 0.009, L, 3, 0.003), this.sole);
    midsole.position.y = bottom + 0.005 + 0.0045;
    const upperBase = bottom + 0.014;
    const upper = new THREE.Mesh(new RoundedBoxGeometry(W - 0.006, 0.03, L - 0.008, 4, 0.012), this.lime);
    upper.position.set(0, upperBase + 0.014, -0.002);
    const heelCounter = new THREE.Mesh(new RoundedBoxGeometry(W - 0.004, 0.036, 0.028, 3, 0.006), this.shorts);
    heelCounter.position.set(0, upperBase + 0.018, -L / 2 + 0.016);
    shoe.add(outsole, midsole, upper, heelCounter);
    for (const z of [-0.014, -0.002, 0.01]) {
      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.003, 0.0035), this.shorts);
      lace.position.set(0, upperBase + 0.029, z);
      shoe.add(lace);
    }
    return shoe;
  }

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
    // The avatar's build, as per-part radius multipliers. `t` is how far the
    // build sits from the reference (negative = leaner). Legs thicken fastest
    // with weight, arms follow muscle as much as weight, the trunk is handled
    // by update()'s ellipse (width and belly depth), the hips widen with
    // weight and on a female build.
    const t = this.avatar.bulk - 1;
    const female = this.avatar.sex === "female";
    const muscle = this.avatar.muscle;
    // Training progress reads differently by sex. A man's muscle goes to the
    // shoulders, arms, chest and neck. A woman's goes to tone: a narrower
    // waist, firmer hips and glutes, a touch of arm definition -- never
    // bigger delts or a thicker neck (the user: "стегнато и добре изглеждащо
    // момиче, не бодибилдърка").
    const tone = female ? Math.max(0, Math.min(1, (muscle - 1) / 0.3)) : 0;
    // Depth grows less than width: bench pads sit a fixed BODY_HALF below the
    // spine line, and a deeper trunk would sink into them (at the heaviest
    // build it is 1.2cm into a 5.5cm pad, which reads as padding giving way).
    this.trunkW = (1 + 0.45 * t) * (female ? 0.92 : 1);
    this.trunkD = (1 + (t > 0 ? 0.55 : 0.4) * t) * (female ? 0.96 : 1);
    const buildScale = (part: string): number => {
      switch (part) {
        case "thigh":
        case "shin":
          return (1 + 0.7 * t) * (female ? 1.05 + 0.03 * tone : 1);
        case "upperArm":
        case "forearm":
          return (1 + 0.45 * t) * (female ? 0.94 + 0.06 * tone : Math.sqrt(muscle));
        case "neck":
          return (1 + 0.3 * Math.max(t, 0)) * (female ? 0.86 : Math.pow(muscle, 0.4));
        case "hips":
          return (1 + 0.4 * Math.max(t, 0)) * (female ? 1.24 + 0.08 * tone : 1);
        default:
          return 1;
      }
    };
    // The trunk's own taper: a heavy build carries it at the waist (the
    // bottom of the spine bone, taper[1]), a lean one keeps a V from the
    // chest; the chest (taper[0]) grows with weight and, for a man, with
    // muscle. The female waist starts narrower against her wider hips (the
    // hourglass) and tightens further as she trains.
    const waist = (1 + (t > 0 ? 1.1 : 0.5) * t) * (female ? 0.86 - 0.08 * tone : 1);
    const chest = (1 + 0.25 * t) * (female ? 1 : Math.pow(muscle, 0.3));
    // The trunk is a rib cage, not a tube: wider at the chest than at the
    // waist (the bone runs pelvis -> shoulders, so the taper widens upward),
    // and squashed front-to-back by update()'s elliptical scaling. Limbs
    // taper the way muscle does -- thigh into knee, calf into ankle,
    // shoulder into elbow into wrist, trapezius-thick neck base. TAPER maps
    // part -> [radius at b, radius at a]: the geometry's TOP is +Y, which
    // update() aims at the bone's b end.
    const TAPER: Partial<Record<string, [number, number]>> = {
      spine: [0.058, 0.042],
      neck: [0.019, 0.028],
      upperArm: [0.026, 0.035],
      forearm: [0.02, 0.028],
      thigh: [0.032, 0.048],
      shin: [0.019, 0.034],
      // The girdle's bar is slim so the neck shows above it; its end caps
      // are the deltoids and get their own size below.
      shoulders: [0.03, 0.03],
    };
    for (const bone of first.bones) {
      const build = buildScale(bone.part);
      const radius = RADII[bone.part] * build;
      const raw = TAPER[bone.part];
      const taper: [number, number] | undefined = raw
        ? bone.part === "spine"
          ? [raw[0] * chest, raw[1] * waist]
          : [raw[0] * build, raw[1] * build]
        : undefined;
      const wear = this.kit(bone.part);
      const cylinder = taper
        ? new THREE.Mesh(new THREE.CylinderGeometry(taper[0], taper[1], 1, 16, 1, true), wear.body)
        : new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 14, 1, true), wear.body);
      const delt = bone.part === "shoulders" ? (female ? 0.046 * 0.86 : 0.046 * Math.pow(muscle, 0.8)) : undefined;
      const capA = new THREE.Mesh(new THREE.SphereGeometry(delt ?? (taper ? taper[1] : radius), 12, 10), wear.a);
      const capB = new THREE.Mesh(new THREE.SphereGeometry(delt ?? (taper ? taper[0] : radius), 12, 10), wear.b);
      // The fingered hand replaces the hand bone when something is held;
      // otherwise the straight hand segment pokes out under the fingers.
      // Kept in the list so update() indexing stays aligned with the frames.
      if (bone.part === "hand" && gripping) {
        cylinder.visible = capA.visible = capB.visible = false;
      }
      // The sneaker stands in for the foot capsule (see sneaker()).
      if (bone.part === "foot") {
        cylinder.visible = capA.visible = capB.visible = false;
      }
      this.scene.add(cylinder, capA, capB);
      this.bones.push({ cylinder, capA, capB, radius, part: bone.part });
    }
    this.head = new THREE.Mesh(new THREE.SphereGeometry(first.head.r * 1.18, 18, 14), this.skin);
    this.scene.add(this.head);

    if (female) {
      // The cropped top covers the upper 62% of the trunk, sized a hair over
      // the trunk's own taper so it sits on the skin rather than in it; the
      // waist shows below it. update() places both along the spine bone.
      const spineTaper = TAPER.spine!;
      const chestR = spineTaper[0] * chest * 1.05;
      const waistR = spineTaper[1] * waist;
      const hemR = (waistR + (spineTaper[0] * chest - waistR) * 0.38) * 1.05;
      this.cropTop = new THREE.Mesh(new THREE.CylinderGeometry(chestR, hemR, 1, 16, 1, true), this.topFemale);
      this.bust = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.topFemale);
      this.scene.add(this.cropTop, this.bust);
    }

    for (const side of [0, 1] as const) {
      this.footIndex[side] = first.bones.findIndex((b) => b.part === "foot" && b.side === side);
      this.shinIndex[side] = first.bones.findIndex((b) => b.part === "shin" && b.side === side);
      const shoe = this.sneaker();
      shoe.visible = this.footIndex[side] >= 0 && this.shinIndex[side] >= 0;
      this.scene.add(shoe);
      this.shoes.push(shoe);
    }

    // The face: two eyes, a nose, a mouth -- the whole reason a viewer can
    // tell at a glance which way the figure is turned. Local +Z is out of
    // the face; update() orients the group from the neck and the movement's
    // facing bit every frame.
    this.spineIndex = first.bones.findIndex((b) => b.part === "spine");
    this.neckIndex = first.bones.findIndex((b) => b.part === "neck");
    this.facing = pose.facing ?? 1;
    const R = first.head.r * 1.3;
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(R * 0.14, 10, 8), this.iron);
      eye.position.set(side * R * 0.34, R * 0.18, R * 0.82);
      // Narrowed under the brow: the determined look.
      eye.scale.set(1.05, 0.55, 0.8);
      this.face.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(R * 0.17, 10, 8), this.skin);
    nose.scale.set(0.8, 1.1, 1.0);
    nose.position.set(0, -R * 0.08, R * 0.97);
    this.face.add(nose);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(R * 0.44, R * 0.08, R * 0.10), this.graphite);
    mouth.position.set(0, -R * 0.45, R * 0.80);
    this.face.add(mouth);
    // The head, all in the face's frame so it turns with the figure.
    if (female) {
      // Hair pulled back into a ponytail: a fuller cap down to the ears, a
      // gathered base at the back with a lime tie, and a tapered tail that
      // hangs down and a little back.
      const hairCap = new THREE.Mesh(new THREE.SphereGeometry(R * 0.95, 18, 12, 0, Math.PI * 2, 0, 1.75), this.hair);
      hairCap.rotation.x = -0.3;
      this.face.add(hairCap);
      const gather = new THREE.Mesh(new THREE.SphereGeometry(R * 0.3, 12, 10), this.hair);
      gather.position.set(0, R * 0.2, -R * 0.88);
      this.face.add(gather);
      const tilt = 0.3;
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.1, R * 1.5, 10), this.hair);
      tail.rotation.x = tilt;
      tail.position.set(0, R * 0.2 - R * 0.75 * Math.cos(tilt), -R * 0.88 - R * 0.75 * Math.sin(tilt));
      this.face.add(tail);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(R * 0.2, R * 0.045, 8, 16), this.lime);
      tie.rotation.x = -Math.PI / 2 + tilt;
      tie.position.set(0, R * 0.2 - R * 0.06, -R * 0.88 - R * 0.02);
      this.face.add(tie);
    } else {
      // Buzz cut: a tight cap hugging the top and back of the skull.
      const hairCap = new THREE.Mesh(new THREE.SphereGeometry(R * 0.925, 18, 10, 0, Math.PI * 2, 0, 1.15), this.hair);
      hairCap.rotation.x = -0.4;
      this.face.add(hairCap);
    }
    // Brows angled in and down over the eyes; finer on the female face.
    for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(R * 0.3, R * (female ? 0.045 : 0.07), R * 0.07), this.hair);
      brow.position.set(side * R * 0.33, R * 0.34, R * 0.84);
      brow.rotation.z = side * (female ? 0.22 : 0.32);
      this.face.add(brow);
    }
    if (!female) {
      // A short full beard: a chin-and-jaw shell below the mouth, the jaw
      // sides up to the cheekbones, and a moustache. SphereGeometry's phi runs
      // around Y with the face (+Z) at phi = PI/2; theta runs down from the
      // crown. The shell sits at 0.96R -- the widest thing on the head (skull
      // 0.91R), which is why HEAD_ENVELOPE in tests/check-poses.js is 1.25 x
      // head.r.
      const beard = (phi0: number, phiLen: number, th0: number, thLen: number) => {
        this.face.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.96, 18, 10, phi0, phiLen, th0, thLen), this.hair));
      };
      beard(Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.7, Math.PI * 0.24);
      beard(Math.PI * 0.1, Math.PI * 0.2, Math.PI * 0.5, Math.PI * 0.22);
      beard(Math.PI * 0.7, Math.PI * 0.2, Math.PI * 0.5, Math.PI * 0.22);
      const moustache = new THREE.Mesh(new THREE.BoxGeometry(R * 0.46, R * 0.09, R * 0.1), this.hair);
      moustache.position.set(0, -R * 0.3, R * 0.86);
      this.face.add(moustache);
    }
    // No headband: the user found the hoop on the head distracting, so the
    // lime stays on the wrists and shoes only.
    this.scene.add(this.face);

    // A hand per side. Holding something, it is four fingers and a thumb
    // wrapped around the handle, oriented by the grip -- overhand curls the
    // fingers over the top of the bar with the thumb underneath, underhand is
    // the mirror, and a neutral grip turns the whole hand (and its dumbbell)
    // ninety degrees into a hammer hold. Empty-handed it is a closed fist.
    for (let side = 0; side < 2; side++) {
      const fist = gripping ? this.grippingHand(pose.grip, side as 0 | 1) : new THREE.Group();
      if (!gripping) fist.add(new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), this.skin));
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
      const finger = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0062, 8, 14, 4.4), this.skin);
      // Arc gap at the lower rear for an overhand grip.
      finger.rotation.z = 1.9 + flip;
      finger.position.z = (k - 1.5) * 0.0128;
      wrap.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0058, 8, 12, 2.9), this.skin);
    thumb.rotation.z = -1.4 + flip;
    // The thumb sits on the inner side of each hand along the bar.
    thumb.position.z = side === 0 ? -0.024 : 0.024;
    wrap.add(thumb);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), this.skin);
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
  // Vinyl: a little sheen, unlike the matte floor.
  private padMaterial = new THREE.MeshStandardMaterial({ color: BENCH, roughness: 0.55, metalness: 0.05 });
  private rubber = new THREE.MeshStandardMaterial({ color: 0x0b0d0c, roughness: 0.9 });

  // --- Cable machines ------------------------------------------------------

  // One per cable prop: the two cable runs (pulley to hands, pulley down to
  // the stack) get re-stretched every frame, and the top of the weight stack
  // rises by however much cable the hands have pulled past the rest length.
  private cables: {
    propIndex: number;
    anchor: THREE.Vector3;
    line: THREE.Mesh;
    feed: THREE.Mesh;
    mover: THREE.Group;
    machine: THREE.Group;
    capLocal: THREE.Vector3;
    rest: number;
  }[] = [];
  private cableMaterial = new THREE.MeshStandardMaterial({ color: 0x23282c, roughness: 0.35, metalness: 0.8 });

  // Stretch a unit cylinder between two world points.
  private stretch(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
    const dir = to.clone().sub(from);
    const len = Math.max(dir.length(), 1e-4);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
    mesh.scale.set(1, len, 1);
  }

  // A cable station: a tall column on two posts with a weight stack riding
  // guide rods inside it, a pulley on an arm at the anchor height, and the
  // cable from the pulley to the hands. Built in a local frame whose +Z
  // points from the column toward the figure, then turned to face it.
  private cableMachine(prop: Extract<PoseProp3D, { kind: "cable" }>, floorY: number, propIndex: number) {
    const anchor = vec(prop.anchor);
    const grip = vec(prop.center);
    const toward = new THREE.Vector3(grip.x - anchor.x, 0, grip.z - anchor.z);
    if (toward.lengthSq() < 1e-6) toward.set(0, 0, -1);
    toward.normalize();
    const g = new THREE.Group();
    g.position.set(anchor.x, 0, anchor.z);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), toward);
    const colZ = -0.16;
    const top = Math.max(anchor.y + 0.14, 1.18);
    for (const x of [-0.17, 0.17]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, top - floorY, 0.05), this.iron);
      post.position.set(x, (top + floorY) / 2, colZ);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.62), this.iron);
      foot.position.set(x, floorY + 0.015, colZ + 0.06);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, top - floorY - 0.12, 8), this.chrome);
      rod.position.set(x * 0.55, (top + floorY) / 2 - 0.02, colZ);
      g.add(post, foot, rod);
    }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.08), this.iron);
    crown.position.set(0, top - 0.025, colZ);
    g.add(crown);
    // The stack: fixed plates below, the selected plates on top that travel.
    const plateH = 0.04;
    const gap = 0.006;
    let y = floorY + 0.05;
    for (let i = 0; i < 9; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.26, plateH, 0.12), this.iron);
      plate.position.set(0, y + plateH / 2, colZ);
      g.add(plate);
      y += plateH + gap;
    }
    const mover = new THREE.Group();
    let my = 0;
    for (let i = 0; i < 4; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.26, plateH, 0.12), this.iron);
      plate.position.set(0, my + plateH / 2, 0);
      mover.add(plate);
      my += plateH + gap;
    }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.14), this.graphite);
    cap.position.set(0, my + 0.01, 0);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8), this.chrome);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(0, plateH * 2, 0.09);
    mover.add(cap, pin);
    mover.position.set(0, y, colZ);
    g.add(mover);
    const capLocal = new THREE.Vector3(0, y + my + 0.02, colZ);
    // The pulley on its arm, out from the column at the anchor height.
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, -colZ), this.iron);
    arm.position.set(0, anchor.y + 0.035, colZ / 2);
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 20), this.graphite);
    pulley.rotation.z = Math.PI / 2;
    pulley.position.set(0, anchor.y, 0);
    g.add(arm, pulley);
    this.scene.add(g);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 8), this.cableMaterial);
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 8), this.cableMaterial);
    this.scene.add(line, feed);
    // Rest length: the shortest pulley-to-hands run across the movement; the
    // stack sits on its stop there and rises by the extra cable pulled.
    let rest = Infinity;
    for (const frame of this.frames) {
      const p = frame.props[propIndex];
      if (p && p.kind === "cable") rest = Math.min(rest, vec(p.center).distanceTo(vec(p.anchor)));
    }
    this.cables.push({ propIndex, anchor, line, feed, mover, machine: g, capLocal, rest });
  }

  // A bench pad: a rounded vinyl slab, not a sharp box.
  private pad(w: number, h: number, l: number): THREE.Mesh {
    return new THREE.Mesh(new RoundedBoxGeometry(w, h, l, 4, Math.min(0.02, h / 2.2)), this.padMaterial);
  }

  // A flat weight bench as a gym actually has one: the pad on a board over a
  // spine beam, a T-base at each end on rubber feet, a runner between them
  // -- and, when the movement presses a plated bar, the rack uprights with
  // the J-cups the bar starts from, standing just past the head end. The
  // group's origin is the pad's centre, so `floorY` and `cupY` come in as
  // world heights and are made relative here.
  private flatBench(
    prop: Extract<PoseProp3D, { kind: "slab" }>,
    floorY: number,
    rack?: { cupY: number; headward: 1 | -1 },
  ): THREE.Group {
    const g = new THREE.Group();
    const len = prop.width;
    const base = floorY - prop.center[1];
    g.add(this.pad(0.32, prop.height, len));
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, len - 0.04), this.iron);
    board.position.y = -prop.height / 2 - 0.01;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, len - 0.16), this.graphite);
    spine.position.y = -prop.height / 2 - 0.045;
    const runner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, len - 0.24), this.iron);
    runner.position.y = base + 0.05;
    g.add(board, spine, runner);
    const postTop = -prop.height / 2 - 0.07;
    for (const z of [-(len / 2 - 0.12), len / 2 - 0.12]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, postTop - base - 0.035, 0.05), this.iron);
      post.position.set(0, (postTop + base + 0.035) / 2, z);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.06), this.iron);
      foot.position.set(0, base + 0.03, z);
      g.add(post, foot);
      for (const x of [-0.21, 0.21]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 12), this.rubber);
        cap.position.set(x, base + 0.006, z);
        g.add(cap);
      }
    }
    if (rack) {
      const zR = rack.headward * (len / 2 + 0.07);
      const cupY = rack.cupY - prop.center[1];
      const topY = cupY + 0.1;
      for (const x of [-0.36, 0.36]) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.055, topY - base, 0.055), this.iron);
        upright.position.set(x, (topY + base) / 2, zR);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.34), this.iron);
        foot.position.set(x, base + 0.0175, zR);
        // The J-cup: a shelf reaching toward the bench, with a lip so the
        // bar cannot roll off it.
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.1), this.graphite);
        shelf.position.set(x, cupY - 0.02, zR - rack.headward * 0.075);
        const lip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), this.graphite);
        lip.position.set(x, cupY, zR - rack.headward * 0.115);
        g.add(upright, foot, shelf, lip);
      }
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.035, 0.035), this.iron);
      brace.position.set(0, base + 0.16, zR);
      g.add(brace);
    }
    return g;
  }

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
        // The podium is unit-sized and grouped; fit() scales it to span the
        // camera view, so the circle is always WHOLE on screen instead of a
        // clipped band with black wings.
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(1, 48),
          new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.95 }),
        );
        disc.rotation.x = -Math.PI / 2;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.98, 1, 48),
          new THREE.MeshBasicMaterial({ color: FLOOR_RING, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.001;
        const floorGroup = new THREE.Group();
        floorGroup.add(disc, ring);
        floorGroup.position.y = prop.y;
        floorGroup.scale.set(0.55, 1, 0.55);
        this.floorDisc = floorGroup;
        this.scene.add(floorGroup);
        continue;
      }
      if (prop.kind === "cable") {
        const floor = first.props.find((p) => p.kind === "floor");
        this.cableMachine(prop, floor && floor.kind === "floor" ? floor.y : 0, i);
        continue;
      }
      if (prop.kind === "slab") {
        const floor = first.props.find((p) => p.kind === "floor");
        const floorY = floor && floor.kind === "floor" ? floor.y : undefined;
        if (prop.dir) {
          // An inclined bench, built around the HIP: a backrest pad running
          // up the authored direction, a flat seat under the hips, and a
          // frame to the floor. Both pads sit a body's half-thickness off
          // the spine line, so the trunk rests ON them instead of through.
          const d = new THREE.Vector3(prop.dir[0], prop.dir[1], prop.dir[2]).normalize();
          const n = new THREE.Vector3(0, d.z, -d.y).normalize();
          if (n.y > 0) n.negate();
          const group = new THREE.Group();
          const back = this.pad(0.32, prop.height, prop.width);
          back.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
          back.position.copy(d).multiplyScalar(prop.width / 2 - 0.05).addScaledVector(n, BODY_HALF + prop.height / 2);
          const feetward = -Math.sign(d.z) || 1;
          const seat = this.pad(0.32, prop.height, 0.24);
          seat.position.set(0, -(BODY_HALF - 0.008 + prop.height / 2), feetward * 0.1);
          group.add(back, seat);
          if (floorY !== undefined) {
            const base = floorY - prop.center[1];
            const backMid = back.position.clone().addScaledVector(d, 0.12);
            for (const [z, top] of [[seat.position.z, seat.position.y - prop.height / 2], [backMid.z, backMid.y - prop.height / 2]] as const) {
              const post = new THREE.Mesh(new THREE.BoxGeometry(0.035, top - base, 0.035), this.iron);
              post.position.set(0, (top + base) / 2, z);
              const foot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.05), this.graphite);
              foot.position.set(0, base + 0.0125, z);
              group.add(post, foot);
            }
          }
          this.scene.add(group);
          this.held.push(this.anchored(group, i, "slab"));
          continue;
        }
        // A tall slab is a wall; drawn solid it hides the figure for the part
        // of the orbit where the camera passes behind it.
        const wall = prop.height > 0.3;
        const drop = floorY !== undefined && !wall ? prop.center[1] - floorY : 0;
        if (drop > 0.12 && floorY !== undefined) {
          // A full-length bench under a plated barbell is a bench-press
          // station and gets the rack; a short bench (hip thrust) or a
          // dumbbell/bodyweight movement does not.
          const bar = first.props.find((p) => p.kind === "bar" && p.plates);
          const rack =
            bar && bar.kind === "bar" && implement === "barbell" && prop.width >= 0.5
              ? { cupY: bar.center[1], headward: (Math.sign(bar.center[2] - prop.center[2]) || -1) as 1 | -1 }
              : undefined;
          const group = this.flatBench(prop, floorY, rack);
          this.scene.add(group);
          this.held.push(this.anchored(group, i, "slab"));
          continue;
        }
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, prop.height, prop.width),
          new THREE.MeshStandardMaterial({ color: BENCH, roughness: 0.8, transparent: wall, opacity: wall ? 0.45 : 1 }),
        );
        this.scene.add(pad);
        // A short drop is a step or block drawn as a solid plinth -- four
        // stubby legs under a low box read as debris, which is exactly what
        // the split-squat block looked like in review. A wall needs no
        // grounding at all.
        if (floorY !== undefined && drop > 0.02) {
          const plinth = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, drop, prop.width),
            new THREE.MeshStandardMaterial({ color: BENCH, roughness: 0.85 }),
          );
          plinth.position.set(prop.center[0], floorY + drop / 2, prop.center[2]);
          this.scene.add(plinth);
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
        } else if (prop.kind === "slab" && prop.width >= 0.5 && !prop.dir) {
          // A full-length bench runs well past its centre, and a bench-press
          // station's rack uprights stand wider still, just past the head end.
          box.expandByPoint(vec(prop.center).add(new THREE.Vector3(0.4, 0.08, prop.width / 2 + 0.12)));
          box.expandByPoint(vec(prop.center).add(new THREE.Vector3(-0.4, -0.08, -(prop.width / 2 + 0.12))));
        } else if (prop.kind === "cable") {
          // The station's column stands behind the pulley and reaches the
          // floor; the fit has to hold all of it, not just the cable's end.
          box.expandByPoint(vec(prop.anchor).add(new THREE.Vector3(0.28, 0.2, 0.28)));
          box.expandByPoint(new THREE.Vector3(prop.anchor[0] - 0.28, 0.02, prop.anchor[2] - 0.28));
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
    // Margins are per-axis: height is the scarce dimension in the card (the
    // stage is wider than the figure on every real viewport), so the vertical
    // margin is slim -- the box already carries the head radius. The wider
    // horizontal margin stays, because orbiting bar tips swing toward the
    // camera and are the first thing to clip at the side edges.
    this.orbitRadius = Math.max(fitV * 1.06, fitH * 1.16, (extent / 2 / tanV / 2) * 1.16);
    if (this.floorDisc) {
      const halfW = this.orbitRadius * tanV * Math.max(this.camera.aspect, 0.5);
      const s = Math.min(Math.max(halfW * 0.82, 0.5), 1.9);
      this.floorDisc.scale.set(s, 1, s);
    }
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
      // The neck column continues up under the raised head (see below).
      if (bone.part === "neck") pb.addScaledVector(pb.clone().sub(pa).normalize(), 0.05);
      const dir = pb.clone().sub(pa);
      const len = Math.max(dir.length(), 1e-4);
      bone.cylinder.position.copy(pa).addScaledVector(dir, 0.5);
      // Feet are flat slabs and open hands are palm paddles, not round
      // sticks; the trunk is an ellipse -- broad across, shallower deep.
      if (bone.part === "foot") bone.cylinder.scale.set(1.25, len, 0.62);
      else if (bone.part === "hand") bone.cylinder.scale.set(1.7, len, 0.5);
      else if (bone.part === "spine") {
        bone.cylinder.scale.set(1.45 * this.trunkW, len, 0.9 * this.trunkD);
        bone.capA.scale.set(1.45 * this.trunkW, 1, 0.9 * this.trunkD);
        bone.capB.scale.set(1.45 * this.trunkW, 1, 0.9 * this.trunkD);
      } else bone.cylinder.scale.set(1, len, 1);
      bone.cylinder.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
      bone.capA.position.copy(pa);
      bone.capB.position.copy(pb);
      if (bone.part === "spine" && this.cropTop) {
        this.cropTop.position.copy(pa).addScaledVector(dir, len * 0.69);
        this.cropTop.scale.set(1.45 * this.trunkW, len * 0.62, 0.9 * this.trunkD);
        this.cropTop.quaternion.copy(bone.cylinder.quaternion);
      }
    }
    this.head.position.copy(lerp3(a.head.c, b.head.c, f));
    // Sneakers: heel-to-toe along the foot bone; "up" is the shin's direction
    // with the foot's own taken out, so a pointed foot rolls the shoe with it
    // and a planted foot keeps the sole flat on the floor.
    for (let side = 0; side < 2; side++) {
      const shoe = this.shoes[side];
      const fi = this.footIndex[side]!;
      const si = this.shinIndex[side]!;
      if (!shoe || fi < 0 || si < 0) continue;
      const heel = lerp3(a.bones[fi]!.a, b.bones[fi]!.a, f);
      const toe = lerp3(a.bones[fi]!.b, b.bones[fi]!.b, f);
      const knee = lerp3(a.bones[si]!.a, b.bones[si]!.a, f);
      const ankle = lerp3(a.bones[si]!.b, b.bones[si]!.b, f);
      const fwd = toe.clone().sub(heel).normalize();
      const up = knee.sub(ankle).normalize();
      up.addScaledVector(fwd, -up.dot(fwd));
      if (up.lengthSq() < 1e-6) up.set(0, 1, 0);
      up.normalize();
      const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
      shoe.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
      shoe.position.copy(heel).addScaledVector(toe.sub(heel), 0.5);
    }
    if (this.spineIndex >= 0 && this.neckIndex >= 0) {
      const sA = lerp3(a.bones[this.spineIndex]!.a, b.bones[this.spineIndex]!.a, f);
      const sB = lerp3(a.bones[this.spineIndex]!.b, b.bones[this.spineIndex]!.b, f);
      const spineDir = sB.clone().sub(sA).normalize();
      const nA = lerp3(a.bones[this.neckIndex]!.a, b.bones[this.neckIndex]!.a, f);
      const nB = lerp3(a.bones[this.neckIndex]!.b, b.bones[this.neckIndex]!.b, f);
      const up = nB.clone().sub(nA).normalize();
      this.head.position.addScaledVector(up, 0.03);
      // The belly side: the spine turned a quarter turn about X, the way the
      // movement's facing bit says.
      const ventral = new THREE.Vector3(0, -this.facing * spineDir.z, this.facing * spineDir.y);
      const fz = ventral.clone().sub(up.clone().multiplyScalar(ventral.dot(up))).normalize();
      const fx = new THREE.Vector3().crossVectors(up, fz).normalize();
      this.face.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fx, up, fz));
      this.face.position.copy(this.head.position);
      if (this.bust) {
        // A gentle bust: a flattened ellipsoid high on the trunk, pushed a
        // little out of its front face, in the top's colour.
        const spineLen = sB.clone().sub(sA).length();
        this.bust.position.copy(sA).addScaledVector(spineDir, spineLen * 0.78).addScaledVector(ventral, 0.02);
        this.bust.scale.set(0.058 * 1.45 * this.trunkW * 0.92, 0.03, 0.05 * this.trunkD);
        this.bust.quaternion.copy(this.bones[this.spineIndex]!.cylinder.quaternion);
      }
    }

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

    for (const cable of this.cables) {
      const pa = a.props[cable.propIndex]!;
      const pb = b.props[cable.propIndex]!;
      if (pa.kind !== "cable" || pb.kind !== "cable") continue;
      const grip = lerp3(pa.center, pb.center, f);
      this.stretch(cable.line, cable.anchor, grip);
      const rise = Math.min(Math.max(grip.distanceTo(cable.anchor) - cable.rest, 0), 0.45);
      cable.mover.position.y = cable.mover.userData.baseY ?? (cable.mover.userData.baseY = cable.mover.position.y);
      cable.mover.position.y += rise;
      const cap = cable.machine.localToWorld(cable.capLocal.clone().add(new THREE.Vector3(0, rise, 0)));
      this.stretch(cable.feed, cable.anchor, cap);
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
    if (!this.readyFired && this.host.clientWidth > 0 && this.host.clientHeight > 0) {
      this.readyFired = true;
      this.onReady?.();
    }
  }
}
