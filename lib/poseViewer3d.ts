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
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ExercisePose, PoseFrame3D, PoseProp3D, Vec3 } from "./poses";
import { REFERENCE_AVATAR, type AvatarBuild } from "./avatar";
import { SkinnedFigure, type RigMap, type FigureSample } from "./skinnedFigure";
import { buildBody, buildHair, BODY_STYLE_DEFAULT, type BodySpec, type BodyStyle } from "./bodyMesh";
import { Strand, Spring } from "./hair";

// Matches the loadable implements the workout knows about; the viewer only
// cares which family of equipment to draw.
export type ViewerImplement = "dumbbell" | "kettlebell" | "barbell" | "machine" | "other" | undefined;

// His kit: tee and shorts in ONE black, at the user's direction ("абсолютно
// еднакво черна"); the hem edge and the sleeves mark where one garment ends.
// A lighter charcoal tee was tried so the two would read as two -- not wanted.
const SHIRT = 0x181b1a;
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
// One breath, and how far the chest stands out at the top of it.
const BREATH_MS = 3400;
const BREATH_DEPTH = 0.004;
// A hold's tremble, in world units per wave.
const TREMOR = 0.0009;
// How far out from the centre of the frame (in clip units, 1 = the edge) the
// fit keeps the head and hands around the orbit.
const FIT_INSIDE = 0.96;
const FIT_INSIDE_LYING = 0.93;
// How far (radians) the card's camera swings either side of the side view
// on a lying scene.
const LYING_SWING = 0.9;

// How far a hand-held weight rides outboard of the wrist. On the wrist
// itself, a kettlebell's ball is wider than the gap to the thigh, and
// carried bells clipped straight through the legs.
const HELD_OUTBOARD = 0.045;

// The capsule mannequin's meshes per bone; null when the skinned body is the
// figure and the capsules were never built.
type BoneMeshes = { cylinder: THREE.Mesh | null; capA: THREE.Mesh | null; capB: THREE.Mesh | null; radius: number; part: string };

const UP = new THREE.Vector3(0, 1, 0);
// A bench pad's width: about 26cm -- narrower than the trunk lying on it and
// a shade narrower than the shoulders, so arms hanging beside an inclined
// backrest hang BESIDE it rather than through its edge.
const BENCH_PAD_WIDTH = 0.14;
// An incline bench's seat: short, and mostly BEHIND the hip joint, tucked
// under the backrest. The thighs angle down to the floor from the hip, and
// a seat that ran on ahead of it was what they sank into.
const SEAT_LENGTH = 0.16;
const SEAT_OFFSET = -0.06;
// How far a hex bar's handles stand above its frame (the plates' axle).
const TRAP_HANDLE_RISE = 0.06;
// An exercise mat: 180cm by 60cm. The figure stands 0.88-0.95 units tall for
// 170-180cm, so a unit is about 1.9m and the mat is 0.95 by 0.32.
const MAT_LENGTH = 0.95;
const MAT_WIDTH = 0.32;
// A battle rope's links, and the wave running down it: one full wave from
// anchor to hand, an 18cm crest, and one pass per half rep so the wave leaves
// the hand exactly as the hand turns over.
const ROPE_LINKS = 22;
const ROPE_WAVES = 1.15;
const ROPE_AMPLITUDE = 0.095;

// The female build's proportions, chosen by the user from a live three-way
// mockup ("lean and toned" over "curvy" and "balanced"): a light frame with a
// defined waist, firm hips and glutes, slimmer arms and thighs -- the
// current toned-athletic ideal (curviness and a waist under half the height
// read as fit; bulk does not), never the bodybuilder. She wears a matching
// sage set: cropped top and full leggings, hair in a sleek bun.
// Thighs and hips were 1.02 and 1.22 of the reference; on the skinned body
// that read as legs too big for her trunk (the user's review), so both
// came down.
// Her hair: a wound bun with loose strands at the nape, or a high ponytail
// that swings. Both are lofted from the same sleek shell.
const FEMALE_HAIR: "bun" | "tail" = "bun";
const FEMALE = {
  hips: 1.12,
  // 0.82 drew a 15cm waist on a 168/60 woman (a real one is ~24); 0.95 is
  // 18cm -- still an hourglass against her hips, no longer a wasp (the
  // user: "малко по-широка, но не прекалявай").
  waist: 0.95,
  thigh: 0.9,
  // Her arm: 27cm round on a 60kg woman against his 33 -- 0.82 of his.
  arm: 0.82,
  // Glute lobes on the back of the pelvis, as a fraction of the full size.
  glute: 0.7,
  // How much of the trunk, from the shoulders down, the cropped top covers.
  topCover: 0.55,
} as const;
// The male build's proportions, chosen by the user from a live three-way
// mockup ("lean athlete" over "strong classic" and "clean minimal"): the
// current ideal is lean and athletic, not big -- a V from the shoulders to a
// narrow waist (shoulder-to-waist about 1.6 reads as most attractive in the
// 2025 cross-cultural physique study; beyond that it plateaus), defined arms,
// never the bodybuilder. He wears a white stringer that leaves the delts
// bare, a textured crop over a fade, and stubble rather than a full beard.
// These multiply the reference radii; training progress (`muscle`) still
// grows the shoulders, arms, chest and neck on top of them.
const MALE = {
  // 1.12 read as a barrel on the skinned body (the user: too wide a chest);
  // 1.08 is the touch wider they asked for later.
  chest: 1.08,
  // 0.9 drew a 21cm waist under a 33cm chest (the user: "талията не трябва
  // да е чак толкова тънка спрямо краката"); 1.03 is 24cm -- still well
  // inside the chest, no longer a wasp.
  waist: 1.03,
  // The delts were 1.18 here on top of a 0.046 sphere: at the reference
  // build that was a 12cm ball on each shoulder, and the user's review was
  // "прекалил с мускулите". The cap is now a smaller, flatter shoulder that
  // grows with training, not a bodybuilder's.
  delt: 1.0,
  // The reference arm is already an athlete's; training grows it via
  // `muscle`, not a multiplier on top.
  arm: 1.0,
} as const;
// Geometry resolution. The old 12- and 16-segment meshes shaded as facets,
// which is most of what made the figure read as blocks rather than a body.
const SEGS = 32;
const SPHERE_W = 28;
const SPHERE_H = 20;

// The trunk's silhouette, turned on a lathe: [radius, y] from the pelvis
// (y -0.5) to the shoulders (y 0.5), in the unit height update() scales to
// the spine's length. A waist narrowest a little above the hips, a rib cage
// widening to the chest and rounding off under the shoulders. `chest` and
// `waist` are the two taper radii for the build.
function trunkProfile(chest: number, waist: number): [number, number][] {
  return [
    [waist * 0.96, -0.5],
    [waist, -0.34],
    [waist * 1.04, -0.12],
    [chest * 0.96, 0.14],
    [chest, 0.34],
    // Full to the shoulder line: the upper chest is the widest part of an
    // athletic trunk, not a rounded-off top.
    [chest, 0.5],
  ];
}

// The same profile from `hemY` up, a little wider, for something worn over
// the trunk: the cropped top has to follow the chest's swell or the skin
// shows through it in a band.
function wornProfile(chest: number, waist: number, hemY: number, ease: number): [number, number][] {
  const base = trunkProfile(chest, waist);
  const radiusAt = (y: number): number => {
    for (let i = 1; i < base.length; i++) {
      const [r0, y0] = base[i - 1]!;
      const [r1, y1] = base[i]!;
      if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return base[base.length - 1]![0];
  };
  const out: [number, number][] = [[radiusAt(hemY) * ease, hemY]];
  for (const [r, y] of base) if (y > hemY) out.push([r * ease, y]);
  return out;
}
const AXIS_X = new THREE.Vector3(1, 0, 0);
// A landmine's hinge sits this far above the floor, on a short post.
const LANDMINE_HINGE = 0.06;

function vec(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

// Piecewise-linear sample of [x, y] control points at x.
function sample(pts: [number, number][], x: number): number {
  if (x <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1]![1];
}

// A cross-section for lofting: `n` points around a rounded rectangle of
// half-width w between heights y0 and y1, in the plane z.
function roundedSection(w: number, y0: number, y1: number, z: number, n: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const cy = (y0 + y1) / 2;
  const hh = (y1 - y0) / 2;
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2;
    // A superellipse: squarer than a circle, still soft at the corners.
    const c = Math.cos(t), s = Math.sin(t);
    out.push(new THREE.Vector3(w * Math.sign(c) * Math.pow(Math.abs(c), 0.45), cy + hh * Math.sign(s) * Math.pow(Math.abs(s), 0.45), z));
  }
  return out;
}

// A D-shaped section: a half-ellipse of half-width w and height h standing
// on a flat base at y0, closed underneath.
function dSection(w: number, y0: number, h: number, z: number, n: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * Math.PI;
    out.push(new THREE.Vector3(w * Math.cos(t), y0 + h * Math.sin(t), z));
  }
  // Back along the base from -w to w, a little inside.
  for (let k = 1; k < 4; k++) out.push(new THREE.Vector3(-w + (2 * w * k) / 4, y0, z));
  return out;
}

// Stitch equal-length sections into a closed surface with capped ends.
function loft(sections: THREE.Vector3[][]): THREE.BufferGeometry {
  const positions: number[] = [];
  const index: number[] = [];
  const n = sections[0]!.length;
  for (const s of sections) for (const p of s) positions.push(p.x, p.y, p.z);
  for (let i = 0; i + 1 < sections.length; i++) {
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      const a0 = i * n + k, a1 = i * n + k1, b0 = (i + 1) * n + k, b1 = (i + 1) * n + k1;
      index.push(a0, b0, a1, a1, b0, b1);
    }
  }
  // End caps: a fan from each end's centre.
  for (const end of [0, sections.length - 1]) {
    const c = new THREE.Vector3();
    for (const p of sections[end]!) c.add(p);
    c.divideScalar(n);
    const ci = positions.length / 3;
    positions.push(c.x, c.y, c.z);
    for (let k = 0; k < n; k++) {
      const a = end * n + k, b = end * n + ((k + 1) % n);
      if (end === 0) index.push(ci, a, b);
      else index.push(ci, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
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
  // Hair that moves (lib/hair.ts): the shell's own sway (his quiff) as a
  // spring applied to its vertices, her bun on a spring at its tie, and
  // strands -- a ponytail or loose wisps -- as chains hanging from the head.
  private hairShell: THREE.Mesh | null = null;
  private hairSway: Spring | null = null;
  private bun: { mesh: THREE.Mesh; rest: THREE.Vector3; spring: Spring } | null = null;
  private strands: { strand: Strand; root: THREE.Vector3; dir: THREE.Vector3; gravity: number; damping: number; stiffness: number }[] = [];
  private hairAt = 0;
  private floorDisc: THREE.Group | null = null;
  private mat: THREE.Group | null = null;
  // Where a push sled stands on the floor, so the podium can be grown to
  // carry it: a sled off the podium reads as one sliding into the black.
  private sledFoot: THREE.Vector3[] = [];
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
  // How much deeper than the reference this build's trunk and thighs are:
  // pads a lying trunk or a seated thigh rests on move away by this much,
  // so a heavy build rests on the bench instead of sinking into it.
  private trunkExtra = 0;
  private seatExtra = 0;
  // The face's movable features and their rest, for the effort expression.
  private brows: THREE.Mesh[] = [];
  private lids: THREE.Mesh[] = [];
  private lipsMeshes: THREE.Mesh[] = [];
  private mouthLine: THREE.Mesh | null = null;
  private faceR = 0;
  // How much strain the movement shows at its hardest point: none for a
  // sway, full for a rep that travels.
  private effortScale = 0;
  // Female build only: a cropped sports top over a bare-skin trunk, and a
  // gentle bust under it. Both ride the spine bone in update().
  private cropTop: THREE.Mesh | null = null;
  // Two rounded lobes high on the chest, in the top's colour: a single wide
  // ellipsoid read as a flat disc under the crop top from the front.
  private busts: THREE.Mesh[] = [];
  private glutes: THREE.Mesh[] = [];
  // The shorts' hems: a ring at the knee end of each thigh, so the shorts
  // end in a clean line instead of the jagged edge two capsules made.
  private hems: { mesh: THREE.Mesh; bone: number }[] = [];
  // Everything buildMannequin() put in the scene, hidden once a skinned
  // figure has loaded and taken over the pose.
  private mannequin: THREE.Object3D[] = [];
  private skinned: SkinnedFigure | null = null;
  // The skinned body's head bone: the face group follows it, not the
  // interpolated head point -- between key positions the pose's points lerp
  // (a rotating segment's chord is shorter than its arc) while the skeleton
  // keeps its bone lengths, and the two drifted apart by over a centimetre
  // mid-movement, the skull poking through the hair.
  private headBone: THREE.Object3D | null = null;
  private readonly capsules: boolean;
  private readonly hold: boolean;
  // The skinned body's breath uniform (lib/bodyMesh.ts), driven each frame.
  private bodyBreath: { value: number } | null = null;
  // The proportions the mannequin was built to, for the skinned body.
  private bodySpec: Omit<BodySpec, "style"> | null = null;
  // The face's jaw ellipsoid; the skinned body sculpts the jaw into the
  // head itself, so it hides this one.
  private jawBlob: THREE.Mesh | null = null;

  constructor(
    host: HTMLElement,
    pose: ExercisePose,
    implement: ViewerImplement,
    // `topInset`: pixels along the top of the host that something else is
    // drawn over (the fullscreen title bar). The figure is fitted below it.
    // `figure`: a rigged humanoid GLB to pose instead of the built mannequin
    // (lib/skinnedFigure.ts). The mannequin shows until the model has loaded.
    options: {
      interactive: boolean;
      reduceMotion?: boolean;
      onReady?: () => void;
      avatar?: AvatarBuild;
      topInset?: number;
      // ...or `{ body }`: the continuous skinned body built in code from
      // the avatar's proportions (lib/bodyMesh.ts), in the given style --
      // the default when nothing is passed.
      figure?: { url: string; rig?: RigMap } | { body: Partial<BodyStyle> };
      // An isometric hold: the figure trembles slightly under the strain.
      hold?: boolean;
    },
  ) {
    this.host = host;
    this.frames = pose.frames3d;
    this.interactive = options.interactive;
    this.reduceMotion = options.reduceMotion ?? false;
    this.onReady = options.onReady;
    this.avatar = options.avatar ?? REFERENCE_AVATAR;
    this.topInsetPx = options.topInset ?? 0;
    // The capsule body is only built when a downloaded model is the figure
    // (it shows until the model loads); the built body replaces it outright.
    this.capsules = !!options.figure && "url" in options.figure;
    this.hold = options.hold ?? false;

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
    // Filmic tone mapping and a soft shadow map: the figure is lit like a
    // thing in a room, and stands on the floor instead of hovering over it.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 20);

    // Image-based light from a neutral room: what gives the skin its soft
    // gradients and the iron its reflections. Three lamps of direct light
    // alone flattened everything into two tones, which read as plastic.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x2c332c, 0.45);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(1.6, 2.6, 2.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 8;
    key.shadow.camera.left = key.shadow.camera.bottom = -1.6;
    key.shadow.camera.right = key.shadow.camera.top = 1.6;
    key.shadow.bias = -0.0005;
    key.shadow.radius = 4;
    const rim = new THREE.DirectionalLight(0x9fffc0, 0.3);
    rim.position.set(-2.0, 1.2, -1.6);
    this.scene.add(hemi, key, rim);

    const beforeMannequin = new Set(this.scene.children);
    this.buildMannequin(pose, implement);
    this.mannequin = this.scene.children.filter((c) => !beforeMannequin.has(c));
    this.buildProps(pose, implement);
    // The skinned body is the figure; the capsule mannequin it is built
    // from stays for the parts it still draws (face, hair, sneakers, fists).
    const figure = options.figure ?? { body: {} };
    if ("body" in figure) this.attachBody({ ...BODY_STYLE_DEFAULT, ...figure.body });
    else this.loadFigure(figure.url, figure.rig);
    // Everything casts onto the floor disc; the disc itself only receives.
    this.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.floor) o.castShadow = true;
    });

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

  // Fetch the rigged model and hand it the pose. The model is scaled to the
  // pose's leg, so it stands where the mannequin stood and the props fit.
  private loadFigure(url: string, rig?: RigMap) {
    const first = this.frames[0]!;
    const len = (part: string) => {
      const bone = first.bones.find((b) => b.part === part && b.side === 0);
      return bone ? vec(bone.a).distanceTo(vec(bone.b)) : 0;
    };
    const leg = len("thigh") + len("shin");
    SkinnedFigure.load(url, leg > 0 ? leg : 0.44, rig)
      .then((figure) => {
        if (this.disposed) {
          figure.dispose();
          return;
        }
        this.skinned = figure;
        for (const part of this.mannequin) part.visible = false;
        this.scene.add(figure.root);
      })
      .catch((e) => console.warn("skinned figure failed to load; keeping the mannequin", e));
  }

  // Build the continuous skinned body in the mannequin's proportions and
  // hand it the pose. The capsule body hides; the face, hair, sneakers and
  // fists stay, placed from the pose as before, since the body's head and
  // joints are exactly where theirs are.
  private attachBody(style: BodyStyle) {
    if (!this.bodySpec) return;
    const female = this.avatar.sex === "female";
    const body = buildBody(
      { ...this.bodySpec, style },
      { skin: this.skin, top: female ? this.setFemale : this.shirt, legwear: female ? this.setFemale : this.shorts, band: this.lime },
    );
    const leg = this.bodySpec.lengths.thigh + this.bodySpec.lengths.shin;
    const figure = SkinnedFigure.fromScene(body.root, leg);
    this.skinned = figure;
    this.headBone = body.root.getObjectByName("mixamorigHead") ?? null;
    this.bodyBreath = body.breath;
    for (const b of this.bones) {
      if (b.cylinder) b.cylinder.visible = false;
      if (b.capA) b.capA.visible = false;
      if (b.capB) b.capB.visible = false;
    }
    this.head.visible = false;
    if (this.jawBlob) this.jawBlob.visible = false;
    if (this.cropTop) this.cropTop.visible = false;
    for (const m of [...this.busts, ...this.glutes]) m.visible = false;
    for (const h of this.hems) h.mesh.visible = false;
    this.scene.add(figure.root);
  }

  private fitted = false;
  // The band along the top of the host that the fit keeps the figure out of,
  // and the point the camera looks at: the scene's centre, raised so the
  // figure sits below the band with the same air above and below it.
  private topInsetPx = 0;
  private readonly aim = new THREE.Vector3();

  // The host learns its title bar's height after layout; refit under it.
  setTopInset(px: number) {
    if (px === this.topInsetPx) return;
    this.topInsetPx = px;
    if (!this.fitted) return;
    this.fit();
    if (this.controls) {
      this.controls.target.copy(this.aim);
      this.controls.minDistance = this.orbitRadius * 0.45;
      this.controls.maxDistance = this.orbitRadius * 2.6;
      this.controls.update();
    }
  }

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
        this.controls.target.copy(this.aim);
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

  // The coach: a bronzed athlete in the app's kit -- white stringer, dark
  // knee-length shorts, and the brand lime on the wristbands and shoes. The
  // stringer is on purpose: the arms and the delts stay bare, so shoulders
  // and elbows read clearly in every demo and the V-taper shows.
  // Skin is soft and a little glossy, cloth is matte: with the room
  // environment lighting the difference is what separates a body from its
  // kit.
  private skin = new THREE.MeshStandardMaterial({ color: 0xc79b74, roughness: 0.48, metalness: 0 });
  // A little sheen, so the crop's tufts and parting catch the light.
  private hair = new THREE.MeshStandardMaterial({ color: 0x1a1712, roughness: 0.66 });
  // Stubble is shadow on the skin, not hair: a skin-dark tone, tight to it.
  // Heavy stubble (the 5mm the attractiveness studies keep picking): a
  // shadow a few shades under the skin, not the brown of a beard.
  private stubble = new THREE.MeshStandardMaterial({ color: 0x9a7056, roughness: 0.85 });
  private shirt = new THREE.MeshStandardMaterial({ color: SHIRT, roughness: 0.85, metalness: 0 });
  private shorts = new THREE.MeshStandardMaterial({ color: SHIRT, roughness: 0.85, metalness: 0 });
  private lime = new THREE.MeshStandardMaterial({ color: 0xc8ff32, roughness: 0.5, metalness: 0.05 });
  // The female set -- cropped top and leggings in one sage green: distinct
  // from the male's light shirt and dark shorts at a glance, light enough to
  // hold up against the dark card, and a foil to the pink accents.
  private setFemale = new THREE.MeshStandardMaterial({ color: 0x9db894, roughness: 0.6, metalness: 0.03 });
  // Her hair is chestnut with a little sheen -- the man's near-black hair
  // vanished against the dark card and read as thin.
  private hairFemale = new THREE.MeshStandardMaterial({ color: 0x5a3320, roughness: 0.5, metalness: 0.05 });
  private lips = new THREE.MeshStandardMaterial({ color: 0xa8505c, roughness: 0.55, metalness: 0.02 });
  // His lips are a shade darker than his skin, not painted; the whites of
  // the eyes are off-white, the irises dark brown.
  private lipsMale = new THREE.MeshStandardMaterial({ color: 0xa87a62, roughness: 0.6, metalness: 0 });
  private sclera = new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.35, metalness: 0 });
  private iris = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.3, metalness: 0 });

  // What each bone wears: the cylinder and its two end caps (a = the bone's
  // start, b = its end -- for a forearm, b is the wrist). On the female build
  // the trunk itself is skin (the cropped top is a separate mesh over its
  // upper part), the girdle carries the top's straps, the delts are bare and
  // the leggings run from the hips to the ankles.
  private kit(part: string): { body: THREE.MeshStandardMaterial; a: THREE.MeshStandardMaterial; b: THREE.MeshStandardMaterial } {
    const female = this.avatar.sex === "female";
    const legwear = female ? this.setFemale : this.shorts;
    switch (part) {
      case "spine":
        return female ? { body: this.skin, a: this.skin, b: this.setFemale } : { body: this.shirt, a: this.shirt, b: this.shirt };
      case "shoulders":
        // The girdle's bar is the straps of the top; the delts are bare on
        // both builds (her cropped top, his stringer).
        return female ? { body: this.setFemale, a: this.skin, b: this.skin } : { body: this.shirt, a: this.skin, b: this.skin };
      case "hips":
        return { body: legwear, a: legwear, b: legwear };
      case "thigh":
        // His shorts end above the knee (the hem ring draws the edge), so
        // the knee itself is skin; her leggings run on down the shin.
        return { body: legwear, a: legwear, b: female ? legwear : this.skin };
      case "shin":
        return female ? { body: legwear, a: legwear, b: legwear } : { body: this.skin, a: this.skin, b: this.skin };
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
  // The shoe's upper and its heel trim: the kit's own colours, but drawn on
  // both sides, so the inside of the ankle opening is a surface and not a
  // hole. They cannot be the shared kit materials, which the shorts use.
  private shoeUpper = new THREE.MeshStandardMaterial({ color: 0xc8ff32, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  private shoeTrim = new THREE.MeshStandardMaterial({ color: SHIRT, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  // The shoe is lofted from cross-sections along its length -- a sole that
  // narrows at the arch and widens at the ball, an upper that stands tall at
  // the heel collar and slopes down over the toes -- instead of the stack of
  // rounded boxes it was, which read as a brick under the foot.
  private sneaker(): THREE.Group {
    const shoe = new THREE.Group();
    // 25cm long against 10.6cm wide. At 21cm it was as long as it was wide
    // and a half, which is a clog; a 180cm man's shoe is 28 x 10.
    const L = 0.125;
    const bottom = -0.0124;
    const soleTop = bottom + 0.013;
    // Plan half-width and upper height along the shoe, heel (-1) to toe (1).
    const halfWidth = (t: number): number => {
      const pts: [number, number][] = [[-1, 0.007], [-0.85, 0.02], [-0.6, 0.023], [-0.2, 0.021], [0.35, 0.026], [0.75, 0.023], [0.93, 0.015], [1, 0.006]];
      return sample(pts, t);
    };
    const upperHeight = (t: number): number => {
      // The upper RISES around the ankle -- that IS the collar. Tried first
      // as a separate ring above the shoe and it read as a black anklet
      // floating over a slipper: the upper is a closed dome, so a rim above
      // it has nothing to sit on. Raising the dome instead lets the shin
      // come out through the top, which is what a running shoe does.
      const pts: [number, number][] = [[-1, 0.016], [-0.85, 0.028], [-0.6, 0.031], [-0.35, 0.027], [-0.1, 0.022], [0.35, 0.017], [0.75, 0.011], [0.93, 0.007], [1, 0.003]];
      return sample(pts, t);
    };
    const ts: number[] = [];
    for (let i = 0; i <= 16; i++) ts.push(-1 + (2 * i) / 16);
    const zOf = (t: number) => (t * L) / 2;
    // Sole: a rounded slab, pale, on a thin dark outsole.
    const slab = (y0: number, y1: number, grow: number) =>
      ts.map((t) => {
        const w = halfWidth(t) + grow;
        return roundedSection(w, y0, y1, zOf(t), 12);
      });
    shoe.add(new THREE.Mesh(loft(slab(bottom, bottom + 0.004, 0.0015)), this.rubber));
    shoe.add(new THREE.Mesh(loft(slab(bottom + 0.0035, soleTop, 0.0015)), this.sole));
    // Upper: a D-section rising from the sole, in the accent colour.
    const upperSections = (from: number, to: number, grow: (t: number) => number) =>
      ts
        .filter((t) => t >= from && t <= to)
        .map((t) => dSection(halfWidth(t) + grow(t), soleTop - 0.002, upperHeight(t) + grow(t), zOf(t), 12));
    // The upper is ONE surface, with its back bands drawn in the dark trim:
    // the heel counter used to be a second loft laid over the first, and two
    // surfaces a millimetre apart print a jagged speckled seam wherever they
    // cross, plus the loft's own end cap standing proud as a black outline
    // down the side of the shoe. Groups on one geometry cannot do either.
    const upperSecs = upperSections(-1, 1, () => 0);
    const upperGeo = loft(upperSecs);
    const perBand = upperSecs[0]!.length * 6;
    // Which bands are dark. ts steps by 0.125: 0-2 is the heel counter, and
    // 4 and 6 are the two overlays across the instep, which is where the
    // laces were. Those were three floating boxes -- a straight bar cannot
    // follow a dome, so its ends hung in the air either side of the shoe.
    const dark = (i: number) => i < 2 || i === 4 || i === 6;
    upperGeo.clearGroups();
    const bands = upperSecs.length - 1;
    let runStart = 0;
    for (let i = 1; i <= bands; i++) {
      if (i < bands && dark(i) === dark(runStart)) continue;
      upperGeo.addGroup(runStart * perBand, (i - runStart) * perBand, dark(runStart) ? 1 : 0);
      runStart = i;
    }
    upperGeo.addGroup(bands * perBand, upperGeo.getIndex()!.count - bands * perBand, 0);
    // Double-sided: the ankle opening is wider than the shin, and through
    // the gap either side you were looking at culled back faces -- a black
    // void inside the shoe.
    shoe.add(new THREE.Mesh(upperGeo, [this.shoeUpper, this.shoeTrim]));
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
        // A sled's handles are as fixed as a pull-up bar: the hands close
        // round them whatever the exercise is loaded with.
        (p.kind === "slab" && !!p.sled) ||
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
    // Her kit carries the app's pink accent (shoes, wristbands, hair tie)
    // where his carries the lime -- the same swap the interface makes.
    if (female) {
      this.lime.color.setHex(0xff5fa8);
      this.shoeUpper.color.setHex(0xff5fa8);
    }
    // Depth grows less than width: bench pads sit a fixed BODY_HALF below the
    // spine line, and a deeper trunk would sink into them (at the heaviest
    // build it is 1.2cm into a 5.5cm pad, which reads as padding giving way).
    this.trunkW = (1 + 0.45 * t) * (female ? 0.92 : 1);
    this.trunkD = (1 + (t > 0 ? 0.55 : 0.4) * t) * (female ? 0.96 : 1);
    // Pads only ever move AWAY from the body: a lighter build keeps the
    // reference pads (her bust and his lats are not in trunkD).
    this.trunkExtra = Math.max(0, BODY_HALF * (this.trunkD - 1));
    const buildScale = (part: string): number => {
      switch (part) {
        case "thigh":
        case "shin":
          return (1 + 0.7 * t) * (female ? FEMALE.thigh + 0.03 * tone : 1);
        case "upperArm":
        case "forearm":
          return (1 + 0.45 * t) * (female ? FEMALE.arm + 0.06 * tone : Math.sqrt(muscle) * MALE.arm);
        case "neck":
          return (1 + 0.3 * Math.max(t, 0)) * (female ? 0.86 : Math.pow(muscle, 0.4));
        case "hips":
          return (1 + 0.4 * Math.max(t, 0)) * (female ? FEMALE.hips + 0.08 * tone : 1);
        default:
          return 1;
      }
    };
    // The trunk's own taper: a heavy build carries it at the waist (the
    // bottom of the spine bone, taper[1]), a lean one keeps a V from the
    // chest; the chest (taper[0]) grows with weight and, for a man, with
    // muscle. The female waist starts narrower against her wider hips (the
    // hourglass) and tightens further as she trains.
    const waist = (1 + (t > 0 ? 1.1 : 0.5) * t) * (female ? FEMALE.waist - 0.05 * tone : MALE.waist);
    const chest = (1 + 0.25 * t) * (female ? 1 : Math.pow(muscle, 0.3) * MALE.chest);
    // The trunk is a rib cage, not a tube: wider at the chest than at the
    // waist (the bone runs pelvis -> shoulders, so the taper widens upward),
    // and squashed front-to-back by update()'s elliptical scaling. Limbs
    // taper the way muscle does -- thigh into knee, calf into ankle,
    // shoulder into elbow into wrist, trapezius-thick neck base. TAPER maps
    // part -> [radius at b, radius at a]: the geometry's TOP is +Y, which
    // update() aims at the bone's b end.
    // Sized to a real athlete: the skeleton stands 0.88 tall for 180cm, so a
    // centimetre of the man is 0.0049 here, and these are the girths of a
    // lean 75kg man at BMI 22.5 -- upper arm 33cm, forearm 27, neck 38,
    // chest 98, thigh 56, calf 37 -- before the build and training scale
    // them. The old values drew a 180/80 man at two times the arm, half
    // again the calf and shoulders of that (the user: "изглежда като
    // огромен здравеняк 110 кг").
    const TAPER: Partial<Record<string, [number, number]>> = {
      spine: [0.052, 0.04],
      neck: [0.019, 0.027],
      upperArm: [0.023, 0.029],
      // The forearm's top was 0.024 -- as wide as the upper arm's elbow
      // end, so the arm read as one tube; a real one is 27cm round there
      // against a 33cm upper arm. Likewise the shin's top: 0.031 drew a
      // 40cm calf under a 56cm thigh.
      forearm: [0.014, 0.02],
      thigh: [0.03, 0.045],
      shin: [0.017, 0.028],
      // The girdle's bar is slim so the neck shows above it; its end caps
      // are the deltoids and get their own size below.
      shoulders: [0.03, 0.03],
    };
    // The deltoid: a shoulder cap a shade wider than the upper arm it sits
    // on, growing gently with training. Half a power on `muscle`, and no
    // multiplier beyond the build's: at the old 0.8 power and x1.18 it
    // was a ball twice the arm's width.
    // A real deltoid caps the arm by a centimetre or two, no more: 0.033 is
    // the upper arm's top plus that (0.040 was a ball half again the arm).
    const deltR = female ? 0.026 : 0.033 * Math.sqrt(muscle) * MALE.delt;
    this.seatExtra = Math.max(0, RADII.thigh * (buildScale("thigh") - 1));
    // Strain shows only on a rep that travels: the profile's idle sway
    // keeps a neutral face.
    const last = this.frames[this.frames.length - 1]!;
    let travel = 0;
    for (const s of [0, 1] as const) travel = Math.max(travel, vec(first.hands[s]).distanceTo(vec(last.hands[s])));
    const pelvis0 = first.bones.find((b) => b.part === "spine"), pelvis1 = last.bones.find((b) => b.part === "spine");
    if (pelvis0 && pelvis1) travel = Math.max(travel, vec(pelvis0.a).distanceTo(vec(pelvis1.a)));
    this.effortScale = Math.min(1, Math.max(0, (travel - 0.03) / 0.1));
    const builtTaper: Record<string, [number, number]> = {};
    for (const bone of first.bones) {
      const build = buildScale(bone.part);
      const radius = RADII[bone.part] * build;
      const raw = TAPER[bone.part];
      const taper: [number, number] | undefined = raw
        ? bone.part === "spine"
          ? [raw[0] * chest, raw[1] * waist]
          : [raw[0] * build, raw[1] * build]
        : undefined;
      if (taper) builtTaper[bone.part] = taper;
      if (!this.capsules) {
        this.bones.push({ cylinder: null, capA: null, capB: null, radius, part: bone.part });
        continue;
      }
      const wear = this.kit(bone.part);
      // The trunk is turned on a lathe, not tapered between two circles: a
      // waist that is narrowest a little above the hips, a rib cage that
      // widens to the chest and rounds off under the shoulders. The profile
      // runs -0.5 (pelvis) to 0.5 (shoulders), the same unit height the
      // limb cylinders have, so update() scales it the same way.
      const cylinder = taper
        ? bone.part === "spine"
          ? new THREE.Mesh(new THREE.LatheGeometry(trunkProfile(taper[0], taper[1]).map(([r, y]) => new THREE.Vector2(r, y)), SEGS), wear.body)
          : new THREE.Mesh(new THREE.CylinderGeometry(taper[0], taper[1], 1, SEGS, 1, true), wear.body)
        : new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, SEGS, 1, true), wear.body);
      const delt = bone.part === "shoulders" ? deltR : undefined;
      const capA = new THREE.Mesh(new THREE.SphereGeometry(delt ?? (taper ? taper[1] : radius), SPHERE_W, SPHERE_H), wear.a);
      const capB = new THREE.Mesh(new THREE.SphereGeometry(delt ?? (taper ? taper[0] : radius), SPHERE_W, SPHERE_H), wear.b);
      if (bone.part === "thigh" && !female) {
        // The shorts' hem: a ring just above the knee, a little proud of the
        // thigh, in the shorts' cloth. Placed along the thigh in update().
        const hem = new THREE.Mesh(new THREE.CylinderGeometry(taper![0] * build + 0.004, taper![0] * build + 0.006, 0.026, SEGS, 1, true), this.shorts);
        this.scene.add(hem);
        this.hems.push({ mesh: hem, bone: this.bones.length });
      }
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
    // A head is an egg, not a ball: a touch taller than it is wide.
    this.head = new THREE.Mesh(new THREE.SphereGeometry(first.head.r * 1.18, 32, 24), this.skin);
    this.head.scale.set(0.95, 1.06, 0.98);
    this.head.visible = this.capsules;
    this.scene.add(this.head);

    // What the skinned body (lib/bodyMesh.ts) is built to, should one be
    // asked for: the pose's own segment lengths and the radii above.
    const seg = (part: string, side?: 0 | 1) => first.bones.find((b) => b.part === part && (side === undefined || b.side === side));
    const len = (part: string, side?: 0 | 1) => {
      const s = seg(part, side);
      return s ? vec(s.a).distanceTo(vec(s.b)) : 0;
    };
    const neckBone = seg("neck");
    this.bodySpec = {
      sex: female ? "female" : "male",
      lengths: {
        spine: len("spine"),
        neck: len("neck"),
        headLift: (neckBone ? vec(first.head.c).distanceTo(vec(neckBone.b)) : 0) + 0.03,
        headR: first.head.r,
        upperArm: len("upperArm", 0),
        forearm: len("forearm", 0),
        hand: len("hand", 0),
        thigh: len("thigh", 0),
        shin: len("shin", 0),
        shoulderHalf: len("shoulders") / 2,
        hipHalf: len("hips") / 2,
        ankle: 0.0124,
      },
      taper: {
        neck: builtTaper.neck ?? [0.019, 0.028],
        upperArm: builtTaper.upperArm ?? [0.026, 0.035],
        forearm: builtTaper.forearm ?? [0.02, 0.028],
        thigh: builtTaper.thigh ?? [0.032, 0.048],
        shin: builtTaper.shin ?? [0.019, 0.034],
      },
      hand: RADII.hand,
      delt: deltR,
      trunkProfile: trunkProfile(TAPER.spine![0] * chest, TAPER.spine![1] * waist),
      trunkW: this.trunkW,
      trunkD: this.trunkD,
      topCover: FEMALE.topCover,
      gripping,
    };

    if (female && this.capsules) {
      // The cropped top covers the upper part of the trunk (FEMALE.topCover),
      // sized a hair over the trunk's own taper so it sits on the skin rather
      // than in it; the waist shows below it. update() places both along the
      // spine bone.
      // The top is the trunk's own lathe profile from the hem up, 4% wider,
      // so it hugs the chest's swell instead of cutting a cone across it --
      // as a cone it left a band of skin showing through under the straps.
      const spineTaper = TAPER.spine!;
      this.cropTop = new THREE.Mesh(
        new THREE.LatheGeometry(
          wornProfile(spineTaper[0] * chest, spineTaper[1] * waist, 0.5 - FEMALE.topCover, 1.04).map(([r, y]) => new THREE.Vector2(r, y)),
          SEGS,
        ),
        this.setFemale,
      );
      this.scene.add(this.cropTop);
      for (let i = 0; i < 2; i++) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(1, SPHERE_W, SPHERE_H), this.setFemale);
        this.scene.add(lobe);
        this.busts.push(lobe);
      }
      // Glutes: two lobes on the back of the pelvis, in the leggings. The
      // pelvis bone alone is a flat bar; these are what give her a seat.
      for (let i = 0; i < 2; i++) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(1, SPHERE_W, SPHERE_H), this.setFemale);
        this.scene.add(lobe);
        this.glutes.push(lobe);
      }
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
    // Every feature is a scaled sphere -- the one primitive that shades like
    // flesh -- placed on the skull (radius 0.89R at the front). Boxes for
    // eyes and mouths were what made the face read as a block character.
    const blob = (material: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, SPHERE_W, SPHERE_H), material);
      m.scale.set(sx * R, sy * R, sz * R);
      m.position.set(x * R, y * R, z * R);
      this.face.add(m);
      return m;
    };
    // The jaw: an ellipsoid low on the skull that squares the lower face and
    // gives it a chin. His is broader; hers narrower and softer.
    this.jawBlob = blob(this.skin, female ? 0.64 : 0.72, female ? 0.5 : 0.52, female ? 0.66 : 0.7, 0, female ? -0.4 : -0.42, female ? 0.06 : 0.08);
    // WHERE EVERY FEATURE GOES. The skull runs from yr +0.95 at the crown
    // to -0.94 at the chin, so the face is 1.89R tall, and the canon puts
    // the brow 36% of the way down it, the eyes at 47%, the base of the
    // nose at 67% and the mouth line at 76%. Every feature here used to sit
    // higher than that -- the eyes a tenth of a head too high, the nose
    // ending level with the cheekbones -- which left a long blank upper lip
    // and read as features stuck on a ball.
    // Ears run from the brow line down to the base of the nose.
    for (const side of [-1, 1]) {
      const ear = blob(this.skin, 0.055, 0.23, 0.085, side * 0.86, -0.03, -0.02);
      ear.rotation.z = side * -0.1;
    }
    // Eyes: a white, an iris standing proud of it, and an upper lid of skin
    // hooding the top -- his lids sit lower for the set look, hers open.
    // They are set INTO the sockets: at z 0.84 the whites stood proud of
    // the skull, which is what made them read as googly eyes.
    for (const side of [-1, 1]) {
      const x = side * 0.27;
      // The white is barely taller than the iris: at 0.092 against 0.056 a
      // crescent of sclera showed UNDER it, which reads as looking up.
      blob(this.sclera, 0.105, female ? 0.076 : 0.068, 0.072, x, 0.062, 0.795);
      blob(this.iris, 0.058, 0.058, 0.045, x, 0.058, 0.85);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(1, SPHERE_W, SPHERE_H, 0, Math.PI * 2, 0, Math.PI * (female ? 0.4 : 0.44)), this.skin);
      lid.scale.set(0.128 * R, (female ? 0.105 : 0.092) * R, 0.082 * R);
      lid.position.set(x * R, R * (female ? 0.068 : 0.062), R * 0.8);
      this.face.add(lid);
      this.lids.push(lid);
    }
    this.faceR = R;
    // Nose: a root sunk between the brows, a bridge, a tip and a wing
    // either side. It was one long thin cone standing 22% of the head's
    // radius off a bald face, with two balls bolted to it.
    // ONE bridge from the brow line down to the tip, tilted so its top
    // sinks back between the brows. A root, a bridge and a tip at three
    // different depths came out as three balls stacked in a column.
    const bridge = blob(this.skin, female ? 0.058 : 0.064, 0.16, 0.072, 0, -0.05, 0.872);
    bridge.rotation.x = -0.16;
    blob(this.skin, female ? 0.076 : 0.086, female ? 0.07 : 0.078, female ? 0.08 : 0.088, 0, -0.25, female ? 0.918 : 0.926);
    for (const side of [-1, 1]) blob(this.skin, 0.05, 0.044, 0.05, side * (female ? 0.075 : 0.083), -0.285, 0.884);
    // Mouth: an upper and a fuller lower lip with the line between them.
    const lipMat = female ? this.lips : this.lipsMale;
    const mouthW = female ? 0.16 : 0.185;
    this.lipsMeshes.push(blob(lipMat, mouthW, 0.028, 0.048, 0, -0.46, 0.855));
    this.lipsMeshes.push(blob(lipMat, mouthW * 0.93, 0.036, 0.052, 0, -0.517, 0.85));
    this.mouthLine = blob(this.iron, mouthW * 0.9, 0.006, 0.03, 0, -0.488, 0.888);
    // The head, all in the face's frame so it turns with the figure.
    if (female) {
      // Hair pulled back into a sleek high bun, with the forehead open (no
      // fringe): a crown piece that stops well above the brows, a side-and-
      // back shell that leaves the face clear (SphereGeometry's phi puts the
      // face at PI/2; the shell spans the back half plus a little past the
      // ears), and the bun high on the back of the head with a pink tie at
      // its base. Everything sits at 1.0R -- a hair's volume over the 0.91R
      // skull -- so it reads as hair, not paint.
      // Stretched with the egg-shaped skull (y scale 1.06), like his.
      // The hair itself is a lofted shell over the skull (lib/bodyMesh.ts):
      // sleek and even, pulled back, forehead open and ears clear.
      this.hairShell = buildHair(first.head.r, true, this.hairFemale);
      this.face.add(this.hairShell);
      const bunDir = new THREE.Vector3(0, 0.42, -0.78).normalize();
      const tie = new THREE.Mesh(new THREE.TorusGeometry(R * 0.3, R * 0.05, 8, 18), this.lime);
      tie.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bunDir);
      tie.position.copy(bunDir).multiplyScalar(R * 0.7);
      this.face.add(tie);
      // The hair gathered into the tie.
      const gather = new THREE.Mesh(new THREE.SphereGeometry(R * 0.24, 12, 10), this.hairFemale);
      gather.position.copy(bunDir).multiplyScalar(R * 0.8);
      this.face.add(gather);
      if (FEMALE_HAIR === "tail") {
        // A high ponytail: a chain hanging from the tie, swinging with the
        // head, tapering to a point.
        const tail = new Strand(this.hairFemale, 7, R * 2.2, R * 0.2, R * 0.05, 12);
        this.scene.add(tail.mesh);
        this.strands.push({ strand: tail, root: bunDir.clone().multiplyScalar(R * 0.8), dir: bunDir.clone(), gravity: 5, damping: 0.965, stiffness: 0.3 });
      } else {
        // A wound bun: a flattened ball of hair with a coil wrapped round it
        // (the strand wound on itself), on a spring at its tie so it sways
        // and settles with the head.
        const bun = new THREE.Group();
        const ball = new THREE.Mesh(new THREE.SphereGeometry(R * 0.42, 20, 16), this.hairFemale);
        ball.scale.set(1, 0.9, 0.72);
        ball.castShadow = true;
        bun.add(ball);
        const coil = new THREE.Mesh(new THREE.TorusGeometry(R * 0.3, R * 0.09, 10, 28), this.hairFemale);
        coil.rotation.set(0.5, 0.35, 0);
        coil.position.z = R * 0.06;
        coil.castShadow = true;
        bun.add(coil);
        const coil2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.22, R * 0.07, 10, 24), this.hairFemale);
        coil2.rotation.set(-0.4, -0.3, 0.6);
        coil2.position.z = R * 0.16;
        bun.add(coil2);
        bun.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bunDir);
        const rest = bunDir.clone().multiplyScalar(R * 0.92);
        bun.position.copy(rest);
        this.face.add(bun);
        this.bun = { mesh: bun as unknown as THREE.Mesh, rest, spring: new Spring(0.35, 0.9, R * 0.12) };
        // Two loose strands at the nape, behind the ears, that hang and
        // swing: short and soft, not strings.
        for (const side of [-1, 1]) {
          const wisp = new Strand(this.hairFemale, 4, R * 0.42, R * 0.05, R * 0.012, 7);
          this.scene.add(wisp.mesh);
          this.strands.push({
            strand: wisp,
            root: new THREE.Vector3(side * 0.74 * R, -0.05 * R, -0.5 * R),
            dir: new THREE.Vector3(side * 0.2, -0.8, -0.55).normalize(),
            gravity: 5,
            damping: 0.96,
            stiffness: 0.25,
          });
        }
      }
    } else {
      // A lofted shell over the skull (lib/bodyMesh.ts): a fade at the sides
      // and back, the crop full on top rising into a quiff, tufts and a
      // parting; the quiff lags the head on a spring (stepHair).
      // The textured crop over a low fade -- the user's pick from a live
      // three-way mockup (crop / buzz fade / warrior cut), and the most
      // requested men's cut three years running.
      this.hairShell = buildHair(first.head.r, false, this.hair, "crop", this.skin.color);
      this.face.add(this.hairShell);
      this.hairSway = new Spring(0.3, 0.9, R * 0.1);
    }
    // Brows: his straight and a touch angled, set a little above the eyes
    // (the old ones were drawn down and in -- a scowl); hers thin, higher
    // and nearly level, with just the outer end lifted.
    for (const side of [-1, 1]) {
      const brow = blob(female ? this.hairFemale : this.hair, female ? 0.14 : 0.16, female ? 0.02 : 0.025, 0.034, side * 0.27, female ? 0.29 : 0.28, 0.865);
      brow.rotation.z = side * (female ? 0.12 : 0.14);
      this.brows.push(brow);
    }
    // Rest positions, scales and angles the effort expression works from.
    for (const m of [...this.brows, ...this.lids, ...this.lipsMeshes, ...(this.mouthLine ? [this.mouthLine] : [])]) {
      m.userData.rest = { p: m.position.clone(), s: m.scale.clone(), rz: m.rotation.z };
    }
    if (!female) {
      // Stubble: a shell over the jaw ellipsoid, a hair's breadth proud of
      // it, in a skin-dark tone -- shadow following the jaw and chin, not a
      // beard. SphereGeometry's phi runs around Y with the face at PI/2, so
      // the shell covers the front and sides and stops at the cheekbones;
      // the moustache shadow is a flattened blob on the upper lip.
      // Sized to the leaner jaw (skullProfile), and starting lower on the
      // cheek so it reads as stubble along the jaw, not a band across the
      // face.
      const shadow = new THREE.Mesh(new THREE.SphereGeometry(1, SPHERE_W, SPHERE_H, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.47, Math.PI * 0.53), this.stubble);
      shadow.scale.set(0.69 * R, 0.53 * R, 0.72 * R);
      shadow.position.set(0, -0.42 * R, 0.08 * R);
      this.face.add(shadow);
      blob(this.stubble, 0.16, 0.03, 0.03, 0, -0.395, 0.885);
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
      // Empty-handed there is nothing to draw here: the figure's own hand
      // is on the end of its arm. The 24mm ball this used to add is from
      // the capsule era, and it sat ON the skinned hand -- measured at the
      // hand bone, dead centre -- so the palm read as a blob with five
      // stubs coming out of it, whatever shape the hand actually had.
      const fist = gripping ? this.grippingHand(pose.grip, side as 0 | 1) : new THREE.Group();
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
  // Mat and medicine ball are both dead-matte foam rubber -- the one surface
  // in the scene with no sheen at all. Measured against the floor (0x181c1a):
  // a near-black mat vanished into the podium, so it is lifted well clear of
  // it and keeps a lighter edge so its outline survives the shadow it lies in.
  private matMaterial = new THREE.MeshStandardMaterial({ color: 0x2b3331, roughness: 0.98, metalness: 0 });
  private matEdge = new THREE.MeshStandardMaterial({ color: 0x3d4744, roughness: 0.95, metalness: 0 });
  private ballRubber = new THREE.MeshStandardMaterial({ color: 0x22282a, roughness: 0.95, metalness: 0 });
  private ballSeam = new THREE.MeshStandardMaterial({ color: 0x39424a, roughness: 0.85, metalness: 0 });

  // --- Cable machines ------------------------------------------------------

  // One per cable prop: the two cable runs (pulley to hands, pulley down to
  // the stack) get re-stretched every frame, and the top of the weight stack
  // rises by however much cable the hands have pulled past the rest length.
  // A machine's lever arm: a rigid link from a pivot fixed in the world to a
  // roller that moves with a limb. It cannot be a child of the roller's group
  // -- that group is translated, never rotated -- so the arm lives in the
  // scene and is stretched between the two points every frame, the way a
  // cable is.
  private levers: { propIndex: number; arm: THREE.Mesh; pivot: THREE.Vector3; side: number }[] = [];
  private cables: {
    propIndex: number;
    anchor: THREE.Vector3;
    line: THREE.Mesh;
    feed: THREE.Mesh;
    mover: THREE.Group;
    machine: THREE.Group;
    capLocal: THREE.Vector3;
    topLocal: THREE.Vector3;
    rest: number;
  }[] = [];
  private cableMaterial = new THREE.MeshStandardMaterial({ color: 0x23282c, roughness: 0.35, metalness: 0.8 });
  // A battle rope: a run of short links from a floor anchor to ONE hand, with
  // a wave travelling down it. A cable is a straight line and can be one
  // stretched cylinder; a rope's whole point is that it is not straight, so
  // it is a chain of links, each stretched between two points on the curve.
  private ropes: { propIndex: number; side: number; links: THREE.Mesh[]; anchor: THREE.Vector3 }[] = [];
  private ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x2f363a, roughness: 0.95, metalness: 0 });

  // Stretch a unit cylinder between two world points.
  private stretch(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
    const dir = to.clone().sub(from);
    const len = Math.max(dir.length(), 1e-4);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
    mesh.scale.set(1, len, 1);
  }

  // A battle rope and the anchor it is looped around. Both ropes share the
  // anchor -- they are the two ends of one rope round a post -- so only the
  // first one builds it. 4cm of braided rope: thick enough to read as rope
  // rather than as the 1.2cm cable next to it in the same scene.
  private battleRope(prop: Extract<PoseProp3D, { kind: "cable" }>, propIndex: number, side: number) {
    const anchor = vec(prop.anchor);
    if (side === 0) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.13, 14), this.graphite);
      post.position.copy(anchor).setY(anchor.y - 0.02);
      const plate = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.022, 0.2, 3, 0.008), this.iron);
      plate.position.copy(anchor).setY(anchor.y - 0.075);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.009, 8, 18), this.ironRim);
      collar.rotation.x = Math.PI / 2;
      collar.position.copy(anchor).setY(anchor.y + 0.03);
      this.scene.add(post, plate, collar);
    }
    // The two halves leave the post on either side of it, not both out of a
    // single point in its middle -- which is also what stops them sharing a
    // vertex and flickering against each other for the first few links.
    anchor.x += (side === 0 ? 1 : -1) * 0.035;
    const links: THREE.Mesh[] = [];
    for (let k = 0; k < ROPE_LINKS; k++) {
      const link = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 7), this.ropeMaterial);
      links.push(link);
      this.scene.add(link);
    }
    this.ropes.push({ propIndex, side, links, anchor });
  }

  // A push sled: two skids on the floor, two uprights, and a push bar across
  // them that the hands close on -- a horizontal bar, not the uprights
  // themselves, because a fist is drawn curled round an axis that runs across
  // the body. Built in a local frame whose origin is the prop's anchor (the
  // group is moved onto that anchor every frame), so the floor and the hands
  // come in as offsets from it. It was a bench-pad post on a bench-pad slab
  // -- upholstery, floating 2.6cm off the ground.
  private pushSled(prop: Extract<PoseProp3D, { kind: "slab" }>, floorY: number, hands: [Vec3, Vec3]): THREE.Group {
    const group = new THREE.Group();
    const base = floorY - prop.center[1];
    const postX = Math.max(Math.abs(hands[0][0] - prop.center[0]), 0.08);
    const rail = 0.03;
    const nose = prop.width;
    // Skids: square tube under each upright, running from just behind the
    // handles to the nose. They rest ON the floor -- the sled is the one
    // thing in the scene that is pushed along it.
    for (const side of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(rail * 0.85, rail, nose + 0.08), this.iron);
      skid.position.set(side * postX, base + rail / 2, nose / 2 - 0.04);
      const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, -base - rail, 12), this.ironRim);
      upright.position.set(side * postX, (base + rail) / 2, 0);
      group.add(skid, upright);
    }
    // The push bar, and a rubber sleeve on it where each hand closes.
    const bar = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, postX * 2 + 0.09, 14), this.graphite));
    group.add(bar);
    for (const side of [-1, 1]) {
      const sleeve = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.1, 14), this.rubber));
      sleeve.position.x = side * postX;
      const cap = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.01, 14), this.chrome));
      cap.position.x = side * (postX + 0.045);
      group.add(sleeve, cap);
    }
    // Cross members: one tying the uprights low down, one across the nose.
    const brace = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, postX * 2, 10), this.iron));
    brace.position.set(0, base + 0.075, 0);
    const front = new THREE.Mesh(new THREE.BoxGeometry(postX * 2, rail * 0.8, rail), this.iron);
    front.position.set(0, base + rail / 2, nose - 0.05);
    group.add(brace, front);
    // The loaded post at the nose, plates lying flat on its collar. Two 20kg
    // plates is what a 40kg sled push is.
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.24, 12), this.chrome);
    sleeve.position.set(0, base + 0.12, nose - 0.05);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.016, 14), this.graphite);
    collar.position.set(0, base + rail + 0.008, nose - 0.05);
    group.add(sleeve, collar);
    for (const [k, r] of [[0, 0.115], [1, 0.105]] as const) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.028, 26), this.iron);
      plate.position.set(0, base + rail + 0.03 + k * 0.03, nose - 0.05);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 8, 26), this.ironRim);
      rim.rotation.x = Math.PI / 2;
      rim.position.copy(plate.position);
      group.add(plate, rim);
    }
    return group;
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
    // The bracket the wheel turns in: two chrome cheeks either side of it.
    // Bare, the cable ran into the middle of a solid disc hanging off a box.
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.006, 16), this.chrome);
      cheek.rotation.z = Math.PI / 2;
      cheek.position.set(s * 0.022, anchor.y, 0);
      g.add(cheek);
    }
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
    this.cables.push({ propIndex, anchor, line, feed, mover, machine: g, capLocal, topLocal: new THREE.Vector3(0, top - 0.025, colZ), rest });
  }

  // A bench pad: a rounded vinyl slab, not a sharp box.
  // How far a flat pad moves for this build: down by the trunk's extra
  // depth when it lies under the trunk, by the thighs' when it is a seat
  // under them, not at all when it is a step or a box under a foot or a
  // hand (those are away from the trunk).
  private padOffset(prop: Extract<PoseProp3D, { kind: "slab" }>): THREE.Vector3 {
    const first = this.frames[0]!;
    const spine = first.bones.find((b) => b.part === "spine");
    if (!spine) return new THREE.Vector3();
    const a = vec(spine.a), b = vec(spine.b), c = vec(prop.center);
    const ab = b.clone().sub(a);
    const t = Math.max(0, Math.min(1, c.clone().sub(a).dot(ab) / ab.lengthSq()));
    const nearest = a.clone().addScaledVector(ab, t);
    const gap = c.distanceTo(nearest);
    if (gap > 0.15) return new THREE.Vector3();
    // Under the pelvis end with the trunk upright it is a seat.
    const seat = t < 0.15 && Math.abs(ab.normalize().y) > 0.7;
    return new THREE.Vector3(0, -(seat ? this.seatExtra : this.trunkExtra), 0);
  }

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
    // A real bench pad is about 30cm wide -- narrower than the trunk, which
    // overhangs it a little. The old 0.32 (66cm) was a table.
    g.add(this.pad(BENCH_PAD_WIDTH, prop.height, len));
    // Every length below is an inset from the pad's own, and on a SHORT
    // bench each of them used to run negative: the hip thrust's is 0.20
    // long and the leg extension's seat 0.22, so `len - 0.24` gave the
    // runner a depth of -0.04. A negative box is wound inside out -- its
    // faces cull away and its normals point in -- and the two posts at
    // +-(len/2 - 0.12) crossed over each other into a 4cm huddle in the
    // middle of the bench instead of standing near its ends. Clamped to a
    // fraction of the bench, and a bench too short for two posts gets one.
    const board = new THREE.Mesh(new THREE.BoxGeometry(BENCH_PAD_WIDTH - 0.02, 0.02, Math.max(len - 0.04, len * 0.6)), this.iron);
    board.position.y = -prop.height / 2 - 0.01;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, Math.max(len - 0.16, len * 0.42)), this.graphite);
    spine.position.y = -prop.height / 2 - 0.045;
    const runner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, Math.max(len - 0.24, len * 0.34)), this.iron);
    runner.position.y = base + 0.05;
    g.add(board, spine, runner);
    const postTop = -prop.height / 2 - 0.07;
    const postZ = len / 2 - 0.12;
    for (const z of postZ > 0.04 ? [-postZ, postZ] : [0]) {
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
      g.add(...this.rack(base, rack.cupY - prop.center[1], rack.headward * (len / 2 + 0.07), rack.headward));
    }
    return g;
  }

  // The rack a pressed barbell starts from: two uprights on feet either side
  // of the bench, J-cups (a shelf reaching toward the bench with a lip so the
  // bar cannot roll off) at the bar's racked height, and a brace between the
  // uprights. Heights are relative to the bench group; `zR` is where the
  // uprights stand and `headward` which way the bench lies from them.
  private rack(base: number, cupY: number, zR: number, headward: 1 | -1): THREE.Object3D[] {
    const parts: THREE.Object3D[] = [];
    const topY = cupY + 0.1;
    for (const x of [-0.36, 0.36]) {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.055, topY - base, 0.055), this.iron);
      upright.position.set(x, (topY + base) / 2, zR);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.34), this.iron);
      foot.position.set(x, base + 0.0175, zR);
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.1), this.graphite);
      shelf.position.set(x, cupY - 0.02, zR - headward * 0.075);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), this.graphite);
      lip.position.set(x, cupY, zR - headward * 0.115);
      parts.push(upright, foot, shelf, lip);
    }
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.035, 0.035), this.iron);
    brace.position.set(0, base + 0.16, zR);
    parts.push(brace);
    return parts;
  }

  // A hex (trap) bar: the lifter stands inside a hexagonal frame and holds
  // the two handles at the sides, so the load sits at the body's centre.
  // Origin at the hands' midpoint. The handles are raised above the frame
  // the way the high handles on a real bar are, and the sleeves run out
  // from the frame's side apexes with the plates on them.
  private trapBar(): THREE.Group {
    const group = new THREE.Group();
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const tube = (a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material) => {
      const dir = b.clone().sub(a);
      const len = dir.length();
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), material);
      mesh.position.copy(a).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
      return mesh;
    };
    const frameY = -TRAP_HANDLE_RISE;
    const hx = 0.1;
    const hz = 0.13;
    const apex = 0.29;
    const corners = [V(hx, frameY, hz), V(apex, frameY, 0), V(hx, frameY, -hz), V(-hx, frameY, -hz), V(-apex, frameY, 0), V(-hx, frameY, hz)];
    for (let i = 0; i < 6; i++) group.add(tube(corners[i]!, corners[(i + 1) % 6]!, 0.013, this.graphite));
    for (const side of [-1, 1]) {
      group.add(tube(V(side * hx, 0, -hz), V(side * hx, 0, hz), 0.014, this.chrome));
      for (const z of [-hz, hz]) group.add(tube(V(side * hx, frameY, z), V(side * hx, 0, z), 0.012, this.graphite));
      const sleeve = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.26, 12), this.chrome));
      sleeve.position.set(side * (apex + 0.13), frameY, 0);
      const collar = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.016, 14), this.graphite));
      collar.position.set(side * (apex + 0.02), frameY, 0);
      const big = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.028, 26), this.iron));
      big.position.set(side * (apex + 0.09), frameY, 0);
      const rim = this.alongX(new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.006, 8, 26), this.ironRim));
      rim.rotation.y = Math.PI / 2;
      rim.rotation.z = 0;
      rim.position.set(side * (apex + 0.09), frameY, 0);
      const small = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.024, 22), this.iron));
      small.position.set(side * (apex + 0.12), frameY, 0);
      const hub = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.032, 14), this.ironRim));
      hub.position.set(side * (apex + 0.105), frameY, 0);
      group.add(sleeve, collar, big, rim, small, hub);
    }
    return group;
  }

  private alongX(mesh: THREE.Mesh): THREE.Mesh {
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  }

  // The leg press's footplate: a steel plate in a frame, loaded, standing on
  // a base beam. Drawn as a wall -- translucent grey, which is what a tall
  // slab used to get -- it read as a ghost panel with the figure floating at
  // it. `base` is the floor in the plate's own frame, if there is one.
  private legPressSled(height: number, base: number | undefined): THREE.Group {
    const g = new THREE.Group();
    const w = 0.34;
    // The plate itself stays see-through, the way the wall it used to be
    // drawn as was: the camera looks along its face, so the feet press on
    // the side away from us and a solid plate hides them. The FRAME is what
    // makes it read as a machine, and that is solid.
    g.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(w, height, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x2a3136, roughness: 0.5, metalness: 0.5, transparent: true, opacity: 0.5 }),
      ),
    );
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.05, 0.07), this.iron);
    top.position.y = height / 2 + 0.04;
    g.add(top);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, height + 0.06, 0.06), this.iron);
      post.position.x = s * (w / 2 + 0.02);
      g.add(post);
      // A plate on a peg either side, DOWN at the base: a sled with nothing
      // on it reads as a door. The pose is authored side-on, so anything out
      // on x sits between the camera and the figure -- at foot height these
      // discs covered the feet on the platform.
      const at = new THREE.Vector3(s * (w / 2 + 0.06), -height * 0.4, 0);
      const disc = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.026, 20), this.iron));
      disc.position.copy(at);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.005, 8, 20), this.ironRim);
      rim.rotation.y = Math.PI / 2;
      rim.position.copy(at);
      const peg = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.08, 10), this.chrome));
      peg.position.copy(at);
      g.add(disc, rim, peg);
    }
    if (base !== undefined && -height / 2 - base > 0.02) {
      const legH = -height / 2 - base;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.05, 0.34), this.graphite);
      beam.position.set(0, base + 0.025, 0);
      g.add(beam);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, legH, 0.06), this.iron);
        leg.position.set(s * (w / 2 + 0.02), base + legH / 2, 0);
        g.add(leg);
      }
    }
    return g;
  }

  private barbell(length: number): THREE.Group {
    const group = new THREE.Group();
    group.add(this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, length, 12), this.chrome)));
    for (const side of [-1, 1]) {
      // Sleeve, collar, then a big plate with a smaller one stacked outside --
      // the loaded-bar silhouette everyone recognises.
      const sleeve = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.16, 12), this.chrome));
      sleeve.position.x = side * (length / 2 - 0.08);
      // The inner collar -- the shoulder the plates are pushed back against.
      const collar = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.016, 14), this.graphite));
      collar.position.x = side * (length / 2 - 0.165);
      // The plates sit at the OUTER end of the sleeve, with a clamp outside
      // them and about 4cm of bare sleeve past that. They used to sit at the
      // inner end, which left 11cm of chrome sticking out beyond the load --
      // it read as a bolt through the middle of the plates.
      const big = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.028, 26), this.iron));
      big.position.x = side * (length / 2 - 0.115);
      // A lighter rim ring so the plate reads as a plate with depth, not a
      // black blob.
      const rim = this.alongX(new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.006, 8, 26), this.ironRim));
      rim.rotation.y = Math.PI / 2;
      rim.rotation.z = 0;
      rim.position.x = side * (length / 2 - 0.115);
      const small = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.024, 22), this.iron));
      small.position.x = side * (length / 2 - 0.086);
      const hub = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.032, 14), this.ironRim));
      hub.position.x = side * (length / 2 - 0.1);
      const clamp = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 14), this.graphite));
      clamp.position.x = side * (length / 2 - 0.052);
      group.add(sleeve, collar, big, rim, small, hub, clamp);
    }
    return group;
  }

  // Where a landmine's hinge is. The hands were authored on an arc about it,
  // so it is the point at hinge height equidistant from the first and last
  // grip; a movement authored with no travel falls back to the authored lean.
  private pivots = new Map<number, THREE.Vector3>();
  private landminePivot(propIndex: number, dir: Vec3): THREE.Vector3 {
    const cached = this.pivots.get(propIndex);
    if (cached) return cached;
    const floor = this.frames[0]!.props.find((p) => p.kind === "floor");
    const hingeY = (floor && floor.kind === "floor" ? floor.y : 0) + LANDMINE_HINGE;
    const grips: THREE.Vector3[] = [];
    for (const frame of this.frames) {
      const p = frame.props[propIndex]!;
      if (p.kind === "bar") grips.push(vec(p.center));
    }
    const first = grips[0]!;
    const last = grips[grips.length - 1]!;
    const x = grips.reduce((sum, g) => sum + g.x, 0) / grips.length;
    let z: number;
    if (Math.abs(first.z - last.z) > 0.01) {
      z = ((first.y - hingeY) ** 2 + first.z ** 2 - (last.y - hingeY) ** 2 - last.z ** 2) / (2 * (first.z - last.z));
    } else {
      const t = (first.y - hingeY) / (dir[1] || 1);
      z = first.z - dir[2] * t;
    }
    const pivot = new THREE.Vector3(x, hingeY, z);
    this.pivots.set(propIndex, pivot);
    return pivot;
  }

  // A landmine bar, built along +X with the origin at the hands' grip: the
  // shaft runs back to x = -reach, where its far end sits in the pivot's
  // sleeve; the loaded sleeve (collar, plates, clip) sits just behind the
  // hands, and a short bare end pokes past them.
  private landmine(reach: number): THREE.Group {
    const group = new THREE.Group();
    const tip = 0.05;
    const shaftLen = reach - 0.2;
    const shaft = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, shaftLen, 12), this.chrome));
    shaft.position.x = -reach + shaftLen / 2;
    const sleeve = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.2 + tip, 12), this.chrome));
    sleeve.position.x = (tip - 0.2) / 2;
    const collar = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.016, 14), this.graphite));
    collar.position.x = -0.2;
    const big = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.028, 26), this.iron));
    big.position.x = -0.165;
    const rim = this.alongX(new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.006, 8, 26), this.ironRim));
    rim.rotation.y = Math.PI / 2;
    rim.rotation.z = 0;
    rim.position.x = -0.165;
    const small = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.024, 22), this.iron));
    small.position.x = -0.137;
    const hub = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 14), this.ironRim));
    hub.position.x = -0.15;
    const clip = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 14), this.graphite));
    clip.position.x = -0.115;
    const cap = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 12), this.chrome));
    cap.position.x = tip - 0.006;
    // The pivot's sleeve: a tube the far end sits in, swinging with the bar.
    const tube = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 14), this.iron));
    tube.position.x = -reach + 0.08;
    const mouth = this.alongX(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 14), this.ironRim));
    mouth.rotation.y = Math.PI / 2;
    mouth.rotation.z = 0;
    mouth.position.x = -reach + 0.16;
    group.add(shaft, sleeve, collar, big, rim, small, hub, clip, cap, tube, mouth);
    return group;
  }

  // The fixed part of a landmine: a plate on the floor, a short post, and the
  // ball hinge the sleeve swivels on.
  private landmineBase(pivot: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.2), this.iron);
    plate.position.y = -LANDMINE_HINGE + 0.012;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, LANDMINE_HINGE - 0.02, 12), this.ironRim);
    post.position.y = -LANDMINE_HINGE / 2 + 0.01;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 10), this.graphite);
    group.add(plate, post, ball);
    group.position.copy(pivot);
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
      // Each head is the flat and a chamfer either side of it -- as one plain
      // block it read as a brick on the end of a rod.
      // alongX turns the cylinder's +Y end to -X, so rTop is the -X face and
      // rBottom the +X one; each chamfer's WIDE end has to face the head.
      const wideAtPlusX: [number, number] = [0.036, 0.05];
      const wideAtMinusX: [number, number] = [0.05, 0.036];
      const head = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.042, 6), this.iron));
      head.position.x = side * 0.072;
      const [ia, ib] = side > 0 ? wideAtPlusX : wideAtMinusX;
      const inner = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(ia, ib, 0.012, 6), this.ironRim));
      inner.position.x = side * 0.045;
      const [oa, ob] = side > 0 ? wideAtMinusX : wideAtPlusX;
      const outer = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(oa, ob, 0.012, 6), this.ironRim));
      outer.position.x = side * 0.099;
      group.add(head, inner, outer);
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

  // An 8kg slam ball is 23cm across and made of moulded rubber, not iron: the
  // old ball was cast in the plate material with one thin ring around its
  // equator, which put a chrome-ish highlight on a black sphere and read as a
  // cannonball. This one is matte rubber with the two crossed seams a moulded
  // ball actually has, sunk INTO the surface line rather than ringing it.
  private medicineBall(size: number): THREE.Group {
    const group = new THREE.Group();
    const r = Math.max(size * 0.7, 0.06);
    group.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), this.ballRubber));
    // Two great circles at right angles, each proud of the surface by a
    // millimetre -- the moulding line, which is what says "rubber ball".
    for (const turn of [0, Math.PI / 2]) {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(r * 0.999, 0.0028, 6, 30), this.ballSeam);
      seam.rotation.y = turn;
      group.add(seam);
    }
    // The flat panel a ball carries its weight on, top and bottom.
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.004, 20), this.ballSeam);
      panel.position.y = side * r * 0.955;
      group.add(panel);
    }
    return group;
  }

  // An ab wheel: a wheel on an axle with a handle out either side. It was
  // drawn as a medicine ball -- the pose anchors it like a held weight, and
  // anything held in both hands that was not a bar became a ball.
  // `gripHeight`: how far the hands ride above the floor. A wheel is the one
  // held object whose size is not free -- it has to reach the ground from
  // the hands that are on its axle, and drawn at a plate's diameter it rolled
  // along 3.5cm above the floor. So the radius comes from the pose, and the
  // axle is dropped by the depth of a curled hand below the wrist.
  private abWheel(size: number, gripHeight: number): THREE.Group {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    const drop = 0.018;
    const r = Math.min(Math.max(gripHeight - drop, Math.max(size * 1.15, 0.05)), 0.08);
    inner.position.y = -(gripHeight - r);
    group.add(inner);
    // The wheel rolls along the floor, so its axis is the one across the body.
    const tyre = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.038, 26), this.rubber));
    const rim = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.042, 20), this.graphite));
    const axle = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.29, 10), this.chrome));
    inner.add(tyre, rim, axle);
    for (const side of [-1, 1]) {
      const handle = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.076, 12), this.rubber));
      handle.position.x = side * 0.104;
      const cap = this.alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.008, 12), this.graphite));
      cap.position.x = side * 0.146;
      inner.add(handle, cap);
    }
    return group;
  }

  // The exercise mat: 180cm by 60cm of 1cm foam, with the corners rounded the
  // way a rolled mat's are. It is sized to the movement (a Russian twist does
  // not need a full-length mat) and laid along the figure's own long axis,
  // measured from the frames rather than assumed to run down z.
  private exerciseMat(floorY: number): THREE.Group {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const frame of this.frames) {
      for (const bone of frame.bones) {
        for (const p of [bone.a, bone.b]) {
          minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
          minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
        }
      }
    }
    const alongZ = maxZ - minZ >= maxX - minX;
    const span = alongZ ? maxZ - minZ : maxX - minX;
    // The mat runs the length of the figure's own footprint, 105cm at the
    // shortest and a real 180cm at the longest. It deliberately does not run
    // PAST the figure: the card is framed on the widest thing in the scene,
    // and measured, a mat 14cm longer than the body shrank the figure by 8%
    // in a push-up and 17% in a handstand push-up to make room for the ends.
    // Heels over the end of a mat is what a mat looks like anyway.
    const len = Math.min(Math.max(span, 0.55), MAT_LENGTH);
    const t = 0.006;
    const half = { l: len / 2, w: MAT_WIDTH / 2 };
    const round = 0.03;
    const shape = new THREE.Shape();
    shape.moveTo(-half.l + round, -half.w);
    shape.lineTo(half.l - round, -half.w);
    shape.quadraticCurveTo(half.l, -half.w, half.l, -half.w + round);
    shape.lineTo(half.l, half.w - round);
    shape.quadraticCurveTo(half.l, half.w, half.l - round, half.w);
    shape.lineTo(-half.l + round, half.w);
    shape.quadraticCurveTo(-half.l, half.w, -half.l, half.w - round);
    shape.lineTo(-half.l, -half.w + round);
    shape.quadraticCurveTo(-half.l, -half.w, -half.l + round, -half.w);
    const pad = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 6 }),
      this.matMaterial,
    );
    pad.rotation.x = -Math.PI / 2;
    // The extrusion grows along +Z, which the flat rotation turns into +Y:
    // the mat lies ON the floor rather than half sunk in it.
    const group = new THREE.Group();
    group.add(pad);
    // A raised lip all the way round, so the mat keeps an outline in the
    // shadow the figure casts over it.
    const lip = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.0022, bevelSegments: 1, curveSegments: 6 }),
      this.matEdge,
    );
    lip.rotation.x = -Math.PI / 2;
    lip.position.y = t;
    group.add(lip);
    group.rotation.y = alongZ ? Math.PI / 2 : 0;
    group.position.set((minX + maxX) / 2, floorY + 0.0004, (minZ + maxZ) / 2);
    for (const m of [pad, lip]) {
      // The mat is ground: it takes the figure's shadow and casts none of
      // its own (userData.floor is what the shadow pass reads).
      m.receiveShadow = true;
      m.userData.floor = true;
    }
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
          new THREE.CircleGeometry(1, 64),
          new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.95 }),
        );
        disc.receiveShadow = true;
        disc.userData.floor = true;
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
        if (prop.mat) {
          this.mat = this.exerciseMat(prop.y);
          this.scene.add(this.mat);
        }
        continue;
      }
      if (prop.kind === "cable") {
        if (prop.rope) {
          this.battleRope(prop, i, this.ropes.length);
          continue;
        }
        // A medicine ball slam is authored on the cable woodchopper, and the
        // slam was drawing the woodchopper's whole machine: a stack, a tower
        // and a cable, standing beside a man throwing a ball at the ground.
        // Nothing loaded with "other" runs off a stack.
        if (implement === "other") continue;
        const floor = first.props.find((p) => p.kind === "floor");
        this.cableMachine(prop, floor && floor.kind === "floor" ? floor.y : 0, i);
        continue;
      }
      if (prop.kind === "slab") {
        const floor = first.props.find((p) => p.kind === "floor");
        const floorY = floor && floor.kind === "floor" ? floor.y : undefined;
        if (prop.sled) {
          const sled = this.pushSled(prop, floorY ?? prop.center[1] - 0.3, first.hands);
          this.scene.add(sled);
          this.held.push(this.anchored(sled, i, "sled"));
          for (const x of [-0.14, 0.14]) {
            for (const z of [-0.06, prop.width + 0.06]) {
              this.sledFoot.push(new THREE.Vector3(prop.center[0] + x, 0, prop.center[2] + z));
            }
          }
          continue;
        }
        if (prop.dir) {
          // An inclined bench, built around the HIP: a backrest pad running
          // up the authored direction, a flat seat under the hips, and a
          // frame to the floor. Both pads sit a body's half-thickness off
          // the spine line, so the trunk rests ON them instead of through.
          const d = new THREE.Vector3(prop.dir[0], prop.dir[1], prop.dir[2]).normalize();
          const n = new THREE.Vector3(0, d.z, -d.y).normalize();
          if (n.y > 0) n.negate();
          const group = new THREE.Group();
          const back = this.pad(BENCH_PAD_WIDTH, prop.height, prop.width);
          back.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
          // ...and a deeper build's pads sit further off by its extra depth.
          back.position.copy(d).multiplyScalar(prop.width / 2 - 0.05).addScaledVector(n, BODY_HALF + this.trunkExtra + prop.height / 2);
          const feetward = (-Math.sign(d.z) || 1) as 1 | -1;
          const seat = this.pad(BENCH_PAD_WIDTH, prop.height, SEAT_LENGTH);
          seat.position.set(0, -(BODY_HALF - 0.008 + this.seatExtra + prop.height / 2), feetward * SEAT_OFFSET);
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
            // An incline press starts from a rack past the head end of the
            // backrest, like the flat bench-press station's; the cups sit a
            // touch below the locked-out bar so it lifts out.
            const bar = first.props.find((p) => p.kind === "bar" && p.plates);
            if (bar && bar.kind === "bar" && implement === "barbell") {
              const headEnd = back.position.clone().addScaledVector(d, prop.width / 2);
              const headward = -feetward as 1 | -1;
              group.add(...this.rack(base, bar.center[1] - prop.center[1] - 0.02, headEnd.z + headward * 0.1, headward));
            }
          }
          this.scene.add(group);
          this.held.push(this.anchored(group, i, "slab"));
          continue;
        }
        // A tall slab is a wall; drawn solid it hides the figure for the part
        // of the orbit where the camera passes behind it. Only the wall-sit's
        // is really a wall (0.62 tall, up at the shoulders); the leg press's
        // is 0.34 and down at the ankles, and it is a steel plate to push.
        if (prop.lever) {
          // A machine's padded roller against a limb -- the leg extension's
          // shin pad. It rides the joint it is anchored to, so it gets no
          // posts to the floor: every other pad in here is something the
          // figure stands or sits on, and the generic build would have run
          // legs down from a pad that is halfway up the air.
          const roller = new THREE.Group();
          const pad = new THREE.Mesh(new THREE.CylinderGeometry(prop.height / 2, prop.height / 2, prop.width, 16), this.padMaterial);
          pad.rotation.z = Math.PI / 2;
          roller.add(pad);
          for (const s of [-1, 1]) {
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 10), this.chrome);
            shaft.rotation.z = Math.PI / 2;
            shaft.position.x = s * (prop.width / 2 + 0.02);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 12), this.graphite);
            cap.rotation.z = Math.PI / 2;
            cap.position.x = s * (prop.width / 2 + 0.045);
            roller.add(shaft, cap);
          }
          this.scene.add(roller);
          this.held.push(this.anchored(roller, i, "slab"));
          // The arm it swings on. Its pivot is the knee's axis, taken from
          // the first frame and left there: the figure sits still through
          // the movement, and a machine's pivot does not move anyway. One
          // arm each side, outboard of the leg and inboard of the roller's
          // end cap, plus a boss at the pivot so it hinges on something.
          const knee = first.bones.find((bo) => bo.part === "thigh" && bo.side === 0);
          if (knee) {
            const ARM_X = 0.105;
            for (const s of [-1, 1]) {
              const pivot = new THREE.Vector3(s * ARM_X, knee.b[1], knee.b[2]);
              const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 10), this.iron);
              this.scene.add(arm);
              this.levers.push({ propIndex: i, arm, pivot, side: s });
              const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 14), this.graphite);
              boss.rotation.z = Math.PI / 2;
              boss.position.copy(pivot);
              this.scene.add(boss);
            }
          }
          continue;
        }
        if (prop.height > 0.3 && prop.height <= 0.5) {
          const sled = this.legPressSled(prop.height, floorY === undefined ? undefined : floorY - prop.center[1]);
          this.scene.add(sled);
          this.held.push(this.anchored(sled, i, "slab"));
          continue;
        }
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
          // A bench the hands or feet rest on stands crosswise to the body:
          // its length runs along x, the edge under the wrists or the toes,
          // and none of it under the trunk.
          if (prop.across) group.rotation.y = Math.PI / 2;
          this.scene.add(group);
          const anchored = this.anchored(group, i, "slab");
          if (!prop.across) anchored.userData.buildOffset = this.padOffset(prop);
          this.held.push(anchored);
          continue;
        }
        // A long low pad is a bench the figure lies along (the leg curl's),
        // and gets a bench's width; a short one is a step or a box.
        const padWidth = prop.width >= 0.5 ? BENCH_PAD_WIDTH : 0.26;
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(padWidth, prop.height, prop.width),
          new THREE.MeshStandardMaterial({ color: BENCH, roughness: 0.8, transparent: wall, opacity: wall ? 0.45 : 1 }),
        );
        this.scene.add(pad);
        // A short drop is a step or block drawn as a solid plinth -- four
        // stubby legs under a low box read as debris, which is exactly what
        // the split-squat block looked like in review. A wall needs no
        // grounding at all.
        if (floorY !== undefined && drop > 0.02) {
          const plinth = new THREE.Mesh(
            new THREE.BoxGeometry(padWidth - 0.02, drop, prop.width),
            new THREE.MeshStandardMaterial({ color: BENCH, roughness: 0.85 }),
          );
          plinth.position.set(prop.center[0], floorY + drop / 2, prop.center[2]);
          this.scene.add(plinth);
        }
        const anchoredPad = this.anchored(pad, i, "slab");
        if (!wall && !prop.across) anchoredPad.userData.buildOffset = this.padOffset(prop);
        this.held.push(anchoredPad);
        continue;
      }
      if (prop.kind === "bar") {
        if (prop.plates && implement === undefined) continue;
        if (prop.dir) {
          // A landmine. The far end of a full-length bar sits in a sleeve on
          // a floor pivot ahead of the lifter and the hands cup the near end,
          // plates loaded just behind them. The pivot is wherever the hands'
          // arc says it is, and the bar swings rigidly about it each frame
          // (see update) instead of leaning at one fixed angle.
          const pivot = this.landminePivot(i, prop.dir);
          let reach = 0;
          for (const frame of this.frames) {
            const p = frame.props[i]!;
            if (p.kind === "bar") reach += vec(p.center).distanceTo(pivot) / this.frames.length;
          }
          const landmine = this.landmine(reach);
          this.scene.add(landmine, this.landmineBase(pivot));
          const group = this.anchored(landmine, i, "bar");
          group.userData.pivot = pivot;
          this.held.push(group);
          continue;
        }
        let mesh: THREE.Group;
        if (prop.hex) {
          mesh = this.trapBar();
        } else if (implement === "kettlebell" && prop.plates) {
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
      // A ball and a wheel are gripped on their own surface, not through a
      // handle that runs on past the hand: the outboard shove that lets a
      // dumbbell's bar pass through the fist opens a 9cm gap between two
      // hands that are supposed to be holding one object between them.
      // The exception is a goblet hold: a dumbbell or kettlebell cupped in
      // both hands is still a hand weight, and its handle does run past them.
      const twoHanded = !!prop.wheel || (bellCount === 1 && !!prop.both && implement !== "dumbbell" && implement !== "kettlebell");
      const ground = first.props.find((p) => p.kind === "floor");
      let mesh =
        prop.wheel
          ? this.abWheel(prop.size, prop.center[1] - (ground && ground.kind === "floor" ? ground.y : 0))
          : implement === "kettlebell"
            ? this.kettlebell()
            : implement === "dumbbell"
              ? this.dumbbell()
              : bellCount === 1
                ? implement === "machine"
                  ? this.plainBar(0.16)
                  : this.medicineBall(prop.size)
                : this.dumbbell();
      // A goblet hold is one dumbbell authored at the grip -- held in BOTH
      // hands (a one-arm row's single bell is at the rowing hand and stays
      // a hand weight).
      if (implement === "dumbbell" && bellCount === 1 && prop.both) {
        // Upright, its top head cupped in both hands and the rest hanging
        // below them. Laid flat it ran back through the chest (and the bust).
        mesh.rotation.z = Math.PI / 2;
        mesh.position.y = -0.072;
        const carrier = new THREE.Group();
        carrier.add(mesh);
        mesh = carrier;
      } else if (pose.grip === "neutral" && implement !== "kettlebell") {
        mesh.rotation.y = Math.PI / 2;
      }
      this.scene.add(mesh);
      if (!twoHanded) this.fistOutboard = true;
      this.held.push(this.anchored(mesh, i, "bell"));
    }

    // Two towers facing the figure from either side are ONE machine -- a
    // crossover -- and a crossover is a single frame with a beam across the
    // top. Built as two independent stations they read as two machines the
    // figure happens to be standing between. Measured: the pair is already
    // identical (26 meshes each, the same 0.69 x 1.12 x 0.74 box, mirrored
    // in x); what they were missing was the thing that joins them.
    if (this.cables.length === 2) {
      const [c0, c1] = this.cables as [(typeof this.cables)[number], (typeof this.cables)[number]];
      const level = Math.abs(c0.anchor.y - c1.anchor.y) < 0.1;
      const apart = Math.abs(c0.anchor.x - c1.anchor.x) > 0.6;
      if (level && apart) {
        for (const m of [c0.machine, c1.machine]) m.updateWorldMatrix(true, false);
        const a = c0.machine.localToWorld(c0.topLocal.clone());
        const b = c1.machine.localToWorld(c1.topLocal.clone());
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07), this.iron);
        this.stretch(beam, a, b);
        this.scene.add(beam);
      }
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
      for (const [index, prop] of frame.props.entries()) {
        if (prop.kind === "bar" && prop.dir) {
          // A landmine runs from the hands down to its floor base ahead.
          const pivot = this.landminePivot(index, prop.dir);
          box.expandByPoint(pivot.clone().add(new THREE.Vector3(0.1, 0, 0.1)));
          box.expandByPoint(pivot.clone().add(new THREE.Vector3(-0.1, -LANDMINE_HINGE, -0.1)));
          box.expandByPoint(vec(prop.center).addScalar(0.11));
          box.expandByPoint(vec(prop.center).addScalar(-0.11));
        } else if (prop.kind === "bar") {
          box.expandByPoint(vec(prop.center).add(new THREE.Vector3(prop.length / 2, 0.11, 0)));
          box.expandByPoint(vec(prop.center).add(new THREE.Vector3(-prop.length / 2, -0.11, 0)));
        } else if (prop.kind === "slab" && prop.sled) {
          // A sled runs its whole length AHEAD of the handles, and its plates
          // stand wider than its frame.
          box.expandByPoint(vec(prop.center).add(new THREE.Vector3(0.13, prop.height + 0.04, prop.width + 0.05)));
          box.expandByPoint(vec(prop.center).add(new THREE.Vector3(-0.13, -0.32, -0.06)));
        } else if (prop.kind === "slab" && prop.width >= 0.5 && !prop.dir) {
          // A full-length bench runs well past its centre, and a bench-press
          // station's rack uprights stand wider still, just past the head end.
          box.expandByPoint(vec(prop.center).add(new THREE.Vector3(0.4, 0.08, prop.width / 2 + 0.12)));
          box.expandByPoint(vec(prop.center).add(new THREE.Vector3(-0.4, -0.08, -(prop.width / 2 + 0.12))));
        } else if (prop.kind === "cable" && prop.rope) {
          // A rope's anchor is a plate on the floor, not a station: it needs
          // its own footprint and the crest of the wave beside it, nothing
          // like the column's clearance.
          box.expandByPoint(vec(prop.anchor).add(new THREE.Vector3(0.12, ROPE_AMPLITUDE, 0.12)));
          box.expandByPoint(vec(prop.anchor).add(new THREE.Vector3(-0.12, -0.08, -0.12)));
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
    // The mat is sized from the figure's own footprint, so it can reach a
    // little past the body it lies under; a mat cut off by the card's edge
    // looks like a fault in the floor.
    if (this.mat) box.expandByObject(this.mat);
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
    // The title bar's share of the height. The camera aims above the scene's
    // centre by that share of the half-frame, which drops the figure below
    // the bar, and the fit then has (1 - inset) of the half-frame to work
    // with at both edges -- the same air over the head as under the feet.
    const inset = Math.min(this.topInsetPx / Math.max(this.host.clientHeight, 1), 0.4);
    const fitV = size.y / 2 / tanV / (1 - 1.06 * inset);
    const fitH = Math.max(size.x, size.z) / 2 / (tanV * Math.max(this.camera.aspect, 0.1));
    // Margins are per-axis: height is the scarce dimension in the card (the
    // stage is wider than the figure on every real viewport), so the vertical
    // margin is slim -- the box already carries the head radius. The wider
    // horizontal margin stays, because orbiting bar tips swing toward the
    // camera and are the first thing to clip at the side edges.
    this.orbitRadius = Math.max(fitV * 1.06, fitH * 1.16, (extent / 2 / tanV / 2) * 1.16);
    const aimAt = (radius: number) => this.aim.set(this.centre.x, this.centre.y + inset * radius * tanV, this.centre.z);
    if (this.floorDisc) {
      const halfW = this.orbitRadius * tanV * Math.max(this.camera.aspect, 0.5);
      let s = Math.min(Math.max(halfW * 0.82, 0.5), 1.9);
      // A landmine's base stands well ahead of the lifter; the podium slides
      // under the whole scene, and grows if it must, so the base is not left
      // out on the black.
      if (this.pivots.size) {
        this.floorDisc.position.set(this.centre.x, this.floorDisc.position.y, this.centre.z);
        for (const pivot of this.pivots.values()) {
          s = Math.max(s, Math.hypot(pivot.x - this.centre.x, pivot.z - this.centre.z) + 0.18);
        }
      }
      // The mat is 180cm long and the podium is only as wide as the card
      // needs: a plank's mat ran 8cm off the far edge and hung over the black.
      // The podium grows to carry it, the way it grows for a landmine's base.
      if (this.mat) {
        const matBox = new THREE.Box3().setFromObject(this.mat);
        const disc = this.floorDisc.position;
        for (const x of [matBox.min.x, matBox.max.x]) {
          for (const z of [matBox.min.z, matBox.max.z]) s = Math.max(s, Math.hypot(x - disc.x, z - disc.z) + 0.05);
        }
      }
      // Same for a battle rope's anchor: it is a plate lying ON the ground,
      // and off the podium it read as one floating in the black. And for a
      // sled, which stands on the floor along its whole length.
      for (const rope of this.ropes) {
        const disc = this.floorDisc.position;
        s = Math.max(s, Math.hypot(rope.anchor.x - disc.x, rope.anchor.z - disc.z) + 0.16);
      }
      for (const foot of this.sledFoot) {
        const disc = this.floorDisc.position;
        s = Math.max(s, Math.hypot(foot.x - disc.x, foot.z - disc.z) + 0.04);
      }
      this.floorDisc.scale.set(s, 1, s);
    }
    // The box fit only holds at the centre's depth: on the near side of the
    // orbit a raised hand is closer to the camera and projects past the edge
    // -- a jump squat's fingertips were cut off at the top of the card. So
    // the head and the hands, the parts the movement is read by, are
    // actually projected through the camera around the arc the card will
    // show, and the radius grows until they stay inside with a margin. Feet,
    // plates and bench ends are left to the box: a foot pointing at the
    // camera grazing the bottom edge is not worth shrinking the figure by a
    // third, which is what keeping every near-side point in would cost.
    const hull: { p: THREE.Vector3; r: number }[] = [];
    for (const frame of this.frames) {
      for (const bone of frame.bones) {
        if (bone.part === "hand") hull.push({ p: vec(bone.a), r: 0.03 }, { p: vec(bone.b), r: 0.03 });
      }
      const neck = frame.bones[this.neckIndex];
      const up = neck ? vec(neck.b).sub(vec(neck.a)).normalize() : new THREE.Vector3(0, 1, 0);
      hull.push({ p: vec(frame.head.c).addScaledVector(up, 0.03), r: frame.head.r * 1.25 });
    }
    const elevation = extent * 0.1;
    const arc: [number, number] = this.lyingScene ? [Math.PI / 2 - LYING_SWING, Math.PI / 2 + LYING_SWING] : [0, Math.PI * 2];
    // A lying figure runs the width of the card, so its head ends up at a
    // side edge; it gets a little more air there.
    const inside = this.lyingScene ? FIT_INSIDE_LYING : FIT_INSIDE;
    const fits = (radius: number) => {
      const aim = aimAt(radius);
      for (let k = 0; k < 24; k++) {
        const az = arc[0] + ((arc[1] - arc[0]) * k) / 24;
        this.camera.position.set(aim.x + radius * Math.sin(az), aim.y + elevation, aim.z + radius * Math.cos(az));
        this.camera.lookAt(aim);
        this.camera.updateMatrixWorld();
        for (const { p, r } of hull) {
          const ndc = p.clone().project(this.camera);
          const pad = r / (p.distanceTo(this.camera.position) * tanV);
          // The top edge is the title bar's lower edge, not the frame's.
          if (ndc.y + pad > inside - 2 * inset || -ndc.y + pad > inside || Math.abs(ndc.x) + pad / this.camera.aspect > inside) return false;
        }
      }
      return true;
    };
    if (!fits(this.orbitRadius)) {
      // Never below the box fit; bisect up to what keeps the hull inside.
      let lo = this.orbitRadius;
      let hi = this.orbitRadius * 2;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) hi = mid;
        else lo = mid;
      }
      this.orbitRadius = hi;
    }
    aimAt(this.orbitRadius);
    this.camera.position.set(
      this.aim.x + this.orbitRadius * Math.sin(0.9),
      this.aim.y + extent * 0.1,
      this.aim.z + this.orbitRadius * Math.cos(0.9),
    );
    this.camera.lookAt(this.aim);
  }

  // Hair dynamics for this frame, from the face group's world transform
  // (set just before): the shell's sway, the bun on its tie, the strands.
  private stepHair() {
    if (!this.hairShell && !this.bun && !this.strands.length) return;
    const now = performance.now();
    const dt = this.hairAt ? (now - this.hairAt) / 1000 : 0;
    this.hairAt = now;
    this.face.updateMatrixWorld(true);
    const headW = this.face.getWorldPosition(new THREE.Vector3());
    const q = this.face.getWorldQuaternion(new THREE.Quaternion());
    const qInv = q.clone().invert();
    const toWorld = (local: THREE.Vector3) => local.clone().applyQuaternion(q).add(headW);
    const R = this.faceR;
    if (this.hairShell && this.hairSway) {
      // The quiff: a point a little ahead of the crown, sprung to where the
      // head carries it; its lag, in the face's frame, moves the shell's
      // vertices by their weight.
      const off = this.hairSway.step(toWorld(new THREE.Vector3(0, 0.9 * R, 0.5 * R)), dt).applyQuaternion(qInv);
      const position = this.hairShell.geometry.getAttribute("position") as THREE.BufferAttribute;
      const rest = this.hairShell.userData.rest as Float32Array;
      const lag = this.hairShell.userData.lag as Float32Array;
      const arr = position.array as Float32Array;
      for (let i = 0; i < lag.length; i++) {
        const w = lag[i]!;
        arr[i * 3] = rest[i * 3]! + off.x * w;
        arr[i * 3 + 1] = rest[i * 3 + 1]! + off.y * w;
        arr[i * 3 + 2] = rest[i * 3 + 2]! + off.z * w;
      }
      position.needsUpdate = true;
    }
    if (this.bun) {
      const off = this.bun.spring.step(toWorld(this.bun.rest), dt, 1.5).applyQuaternion(qInv);
      this.bun.mesh.position.copy(this.bun.rest).add(off);
    }
    for (const s of this.strands) {
      s.strand.step(toWorld(s.root), s.dir.clone().applyQuaternion(q), dt, headW, R * 0.98, { gravity: s.gravity, damping: s.damping, stiffness: s.stiffness });
    }
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

    // The breath: the rib cage swells and settles on a slow cycle, the
    // exhale a little longer than the inhale.
    if (this.bodyBreath && !this.reduceMotion) {
      const cycle = (elapsed % BREATH_MS) / BREATH_MS;
      const wave = cycle < 0.4 ? Math.sin((cycle / 0.4) * Math.PI * 0.5) : Math.cos(((cycle - 0.4) / 0.6) * Math.PI * 0.5);
      this.bodyBreath.value = BREATH_DEPTH * wave;
    }
    // A hold trembles: a small drift summed from a few incommensurate
    // waves, applied to the whole figure and to what its hands hold, never
    // to the floor or the fixed equipment.
    const jitter = new THREE.Vector3();
    if (this.hold && !this.reduceMotion) {
      const s = elapsed / 1000;
      jitter.set(
        TREMOR * (Math.sin(s * 57) + 0.6 * Math.sin(s * 83 + 1.3)),
        TREMOR * (0.7 * Math.sin(s * 71 + 0.4) + 0.5 * Math.sin(s * 97 + 2.1)),
        TREMOR * (Math.sin(s * 63 + 2.6) + 0.5 * Math.sin(s * 89)),
      );
    }

    // This frame's segments, for the skinned figure (if one has loaded).
    const sample: FigureSample["bones"] = [];
    for (let n = 0; n < this.bones.length; n++) {
      const bone = this.bones[n]!;
      const pa = lerp3(a.bones[n]!.a, b.bones[n]!.a, f).add(jitter);
      const pb = lerp3(a.bones[n]!.b, b.bones[n]!.b, f).add(jitter);
      sample.push({ part: bone.part, side: a.bones[n]!.side, a: pa.clone(), b: pb.clone() });
      // The neck column continues up under the raised head (see below).
      if (bone.part === "neck") pb.addScaledVector(pb.clone().sub(pa).normalize(), 0.05);
      const dir = pb.clone().sub(pa);
      const len = Math.max(dir.length(), 1e-4);
      if (!bone.cylinder || !bone.capA || !bone.capB) continue;
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
        // Same frame as the trunk: the top's lathe is cut in the trunk's
        // own unit height, so it takes the trunk's position and scale.
        this.cropTop.position.copy(bone.cylinder.position);
        this.cropTop.scale.copy(bone.cylinder.scale);
        this.cropTop.quaternion.copy(bone.cylinder.quaternion);
      }
    }
    // The shorts' hems ride the thighs, 1.5cm short of the knee.
    for (const hem of this.hems) {
      const thigh = this.bones[hem.bone]!;
      if (!thigh.cylinder || !thigh.capA || !thigh.capB) continue;
      hem.mesh.quaternion.copy(thigh.cylinder.quaternion);
      const knee = thigh.capB.position;
      const hip = thigh.capA.position;
      hem.mesh.position.copy(knee).addScaledVector(hip.clone().sub(knee).normalize(), 0.015);
    }
    this.head.position.copy(lerp3(a.head.c, b.head.c, f)).add(jitter);
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
      shoe.position.copy(heel).addScaledVector(toe.sub(heel), 0.5).add(jitter);
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
      // Effort: the face sets as the rep reaches its hardest point (the
      // last key position) -- brows drawn down and in, eyes narrowed, lips
      // pressed together -- and relaxes on the way back.
      const effort = this.effortScale * (t / last) * (t / last);
      const R = this.faceR;
      const rest = (m: THREE.Mesh) => m.userData.rest as { p: THREE.Vector3; s: THREE.Vector3; rz: number };
      this.brows.forEach((brow, i) => {
        const r = rest(brow);
        const side = i === 0 ? -1 : 1;
        brow.position.set(r.p.x - side * 0.02 * R * effort, r.p.y - 0.035 * R * effort, r.p.z);
        brow.rotation.z = r.rz + side * 0.22 * effort;
      });
      for (const lid of this.lids) {
        const r = rest(lid);
        lid.position.set(r.p.x, r.p.y - 0.03 * R * effort, r.p.z);
      }
      this.lipsMeshes.forEach((lip, i) => {
        const r = rest(lip);
        lip.scale.set(r.s.x * (1 + 0.08 * effort), r.s.y * (1 - (i === 0 ? 0.35 : 0.3) * effort), r.s.z);
        lip.position.set(r.p.x, r.p.y + (i === 0 ? -0.012 : 0.012) * R * effort, r.p.z);
      });
      if (this.mouthLine) {
        const r = rest(this.mouthLine);
        this.mouthLine.scale.set(r.s.x * (1 + 0.15 * effort), r.s.y, r.s.z);
      }
      if (this.skinned) this.skinned.apply({ bones: sample, head: this.head.position.clone(), ventral, floorY: this.floorDisc?.position.y });
      if (this.skinned && this.headBone && this.bodySpec) {
        // The face sits where the skinned skull is: the head bone's frame,
        // lifted to the skull's centre.
        this.headBone.updateMatrixWorld(true);
        this.face.position.copy(this.headBone.localToWorld(new THREE.Vector3(0, this.bodySpec.lengths.headLift, 0)));
        this.headBone.getWorldQuaternion(this.face.quaternion);
      }
      this.stepHair();
      if (this.busts.length) {
        // A gentle bust: two rounded lobes high on the chest, either side of
        // the midline, standing a little proud of the trunk's front (its
        // depth radius there is ~0.052) in the top's colour. Modest on
        // purpose -- the user chose "lean and toned" over the curvier build.
        const spineLen = sB.clone().sub(sA).length();
        const lateral = new THREE.Vector3().crossVectors(spineDir, ventral).normalize();
        this.busts.forEach((lobe, i) => {
          const side = i === 0 ? 1 : -1;
          // Close enough together to meet at the midline, wider than they
          // are deep: two separate balls was the first draft's mistake.
          lobe.position.copy(sA).addScaledVector(spineDir, spineLen * 0.76).addScaledVector(ventral, 0.03).addScaledVector(lateral, side * 0.025);
          lobe.scale.set(0.038 * this.trunkW, 0.03, 0.027 * this.trunkD);
          lobe.quaternion.copy(this.bones[this.spineIndex]!.cylinder!.quaternion);
        });
        // The glute lobes sit just behind and below the pelvis, either side
        // of the midline, and turn with the trunk.
        this.glutes.forEach((lobe, i) => {
          const side = i === 0 ? 1 : -1;
          lobe.position.copy(sA).addScaledVector(ventral, -0.028).addScaledVector(spineDir, -0.012).addScaledVector(lateral, side * 0.03);
          const g = FEMALE.glute;
          lobe.scale.set(0.046 * g, 0.04 * g, 0.042 * g);
          lobe.quaternion.copy(this.bones[this.spineIndex]!.cylinder!.quaternion);
        });
      }
    }

    for (let s = 0; s < 2; s++) {
      this.fists[s]!.position.copy(lerp3(a.hands[s as 0 | 1], b.hands[s as 0 | 1], f)).add(jitter);
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
        group.position.set((h0.x + h1.x) / 2, (h0.y + h1.y) / 2, (h0.z + h1.z) / 2).add(jitter);
        continue;
      }
      if (mode === "hands" || mode === "twin") {
        const side = mode === "twin" ? 1 : 0;
        group.position.copy(lerp3(a.hands[side]!, b.hands[side]!, f)).add(jitter);
        group.position.x += side === 0 ? HELD_OUTBOARD : -HELD_OUTBOARD;
      } else if (pa.kind === "bell" && pb.kind === "bell" && this.frames[0]!.props.filter((p) => p.kind === "bell").length >= 2) {
        // Two bells were authored per hand; keep each on its hand in 3D, where
        // the hands genuinely sit apart on the lateral axis.
        const which = Math.min(this.frames[0]!.props.filter((p, idx) => p.kind === "bell" && idx < propIndex).length, 1) as 0 | 1;
        group.position.copy(lerp3(a.hands[which], b.hands[which], f)).add(jitter);
        group.position.x += which === 0 ? HELD_OUTBOARD : -HELD_OUTBOARD;
      } else {
        group.position.copy(lerp3(pa.center, pb.center, f));
        const buildOffset = (group.userData as { buildOffset?: THREE.Vector3 }).buildOffset;
        if (buildOffset) group.position.add(buildOffset);
        // A landmine bar is built along +X from its pivot end; aim it from
        // the pivot through the hands, so the pivot end never leaves the floor.
        const pivot = (group.userData as { pivot?: THREE.Vector3 }).pivot;
        if (pivot) group.quaternion.setFromUnitVectors(AXIS_X, group.position.clone().sub(pivot).normalize());
      }
    }

    for (const lev of this.levers) {
      const pa = a.props[lev.propIndex]!;
      const pb = b.props[lev.propIndex]!;
      if (pa.kind !== "slab" || pb.kind !== "slab") continue;
      const end = lerp3(pa.center, pb.center, f);
      end.x = lev.side * 0.105;
      this.stretch(lev.arm, lev.pivot, end);
    }

    // The wave in a battle rope is the hand's own movement travelling away
    // down it, so it is driven by the same clock as the arms and the two
    // ropes run half a cycle apart, the way the two arms do. It has to die
    // at both ends: the rope is fixed at the anchor and held at the hand.
    for (const rope of this.ropes) {
      const pa = a.props[rope.propIndex]!;
      const pb = b.props[rope.propIndex]!;
      if (pa.kind !== "cable" || pb.kind !== "cable") continue;
      // Not the prop's centre: a side view authors everything on the midline
      // (point() zeroes x), and the two hands are only pushed apart when the
      // 3D frame is built. A rope drawn to the centre ended 11cm short of the
      // fist that was supposed to be holding it.
      const hand = lerp3(a.hands[rope.side as 0 | 1], b.hands[rope.side as 0 | 1], f).add(jitter);
      const run = hand.clone().sub(rope.anchor);
      const length = Math.max(run.length(), 1e-4);
      // Vertical, but square to the rope: the crest of a wave stands off the
      // rope's own line, not off the world's.
      const perp = new THREE.Vector3(0, 1, 0).addScaledVector(run, -run.y / (length * length));
      if (perp.lengthSq() < 1e-6) perp.set(0, 0, 1);
      perp.normalize();
      const phase = elapsed / (PHASE_MS * Math.max(this.frames.length - 1, 1)) + rope.side * 0.5;
      const point = (u: number) => {
        const swell = Math.pow(u, 1.3) * (1 - u) * 4 * ROPE_AMPLITUDE;
        const wave = Math.sin(Math.PI * 2 * (ROPE_WAVES * (1 - u) + phase));
        return rope.anchor.clone().addScaledVector(run, u).addScaledVector(perp, swell * wave);
      };
      let from = point(0);
      for (let k = 0; k < rope.links.length; k++) {
        const to = point((k + 1) / rope.links.length);
        this.stretch(rope.links[k]!, from, to);
        from = to;
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
      // across the legible arc instead of circling through it: centred on
      // the side view, never nearer than ~40 degrees to either end. The
      // old arc started almost end-on, and a pike's feet filled the card.
      const az = this.lyingScene
        ? Math.PI / 2 + Math.sin(elapsed * 0.00045) * LYING_SWING
        : 0.9 + elapsed * 0.00035;
      this.camera.position.set(
        this.aim.x + this.orbitRadius * Math.sin(az),
        this.camera.position.y,
        this.aim.z + this.orbitRadius * Math.cos(az),
      );
      this.camera.lookAt(this.aim);
    }

    this.renderer.render(this.scene, this.camera);
    if (!this.readyFired && this.host.clientWidth > 0 && this.host.clientHeight > 0) {
      this.readyFired = true;
      this.onReady?.();
    }
  }
}
