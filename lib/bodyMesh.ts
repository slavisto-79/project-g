// A continuous skinned body built in code from the app's own proportions.
//
// The capsule mannequin is a set of separate cylinders and spheres, which
// shows at every joint. This builds ONE mesh -- a chain of elliptical rings
// stitched into tubes for the trunk, neck, head, arms and legs -- over a
// skeleton with Mixamo bone names, so lib/skinnedFigure.ts drives it from
// the poses exactly as it would a downloaded model. The rings carry skin
// weights blended across each joint, so an elbow or a knee bends as skin
// does instead of two capsules crossing.
//
// Everything is parametric: the radii come from the same build tables the
// mannequin used (so the avatar's bulk and muscle still shape the body), a
// `BodyStyle` sets how much muscle definition shows, and the kit -- his
// stringer and shorts, her cropped top and leggings, the wristbands -- is
// painted per ring through material groups, with a raised hem ring where
// cloth ends.
//
// The bind pose is a T-pose facing +Z with the left arm along +X, sole on
// y = 0, the same convention a Mixamo export has.
import * as THREE from "three";

export type BodyStyle = {
  // 0..1: how far the muscle shapes (biceps, calves, chest, quads) stand out.
  definition: number;
  // Multiplier on the deltoid's size, on top of the build's.
  shoulders: number;
  // Multiplier on the trunk's chest width, on top of the build's.
  chest: number;
  // Clothes as shells a few millimetres off an all-skin body, with open
  // hems that show the fabric's thickness and necklines cut through the
  // fabric, instead of paint on the skin.
  layered?: boolean;
};

// The user's pick from a three-way mockup ("B defined" over "A athletic"
// and "C soft"), for both builds: full muscle definition, wider deltoids
// and chest, on top of each build's own radii.
// Clothes are painted on the skin again: the layered shells (still
// available through `layered`) cut the stringer's straps and armholes into
// ragged patches over the deltoids and hung its hem in a point, and the
// user's review was "изглеждат отвратително".
// Chest and shoulders came down from 1.08 / 1.18 after the user's review
// ("твърде му е широк гръдния кош"): at 1.08 the trunk was 20cm across on
// an 85cm figure, a 43cm chest on a real man.
export const BODY_STYLE_DEFAULT: BodyStyle = { definition: 1, shoulders: 1.0, chest: 1.0, layered: false };

export type BodyMaterials = {
  skin: THREE.MeshStandardMaterial;
  top: THREE.MeshStandardMaterial;
  legwear: THREE.Material;
  band: THREE.Material;
};

// Lengths in world units, measured from the pose so the skeleton is the
// pose's skeleton and retargeting lands every joint exactly.
export type BodySpec = {
  sex: "male" | "female";
  style: BodyStyle;
  lengths: {
    spine: number;
    neck: number;
    // From the neck's top to the centre of the head, as the viewer draws it.
    headLift: number;
    headR: number;
    upperArm: number;
    forearm: number;
    hand: number;
    thigh: number;
    shin: number;
    shoulderHalf: number;
    hipHalf: number;
    // The ankle's height above the sole (the shoe's underside).
    ankle: number;
  };
  // Radii at each part's two ends, already multiplied by the build:
  // [at the far end (b), at the near end (a)], the mannequin's TAPER order.
  taper: {
    neck: [number, number];
    upperArm: [number, number];
    forearm: [number, number];
    thigh: [number, number];
    shin: [number, number];
  };
  hand: number;
  delt: number;
  // The trunk's lathe profile ([radius, unit y] from -0.5 pelvis to 0.5
  // shoulders) and the ellipse multipliers update() applied to it.
  trunkProfile: [number, number][];
  trunkW: number;
  trunkD: number;
  // How much of the trunk, from the shoulders down, her cropped top covers.
  topCover: number;
  // Hands are hidden when the gripping fists replace them.
  gripping: boolean;
};

export type Body = {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  // Set each frame: how far (world units) the chest stands out from rest.
  breath: { value: number };
};

// The breath: every vertex moves out along its rest normal by the shared
// uniform times its own `breath` weight, before skinning, in every
// material the body wears -- skin, shells and the shadow pass alike.
const BREATH_VERTEX = "#include <begin_vertex>\ntransformed += normal * (uBreath * breath);";
function breathing<T extends THREE.Material>(material: T, uniform: { value: number }): T {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uBreath = uniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float breath;\nuniform float uBreath;")
      .replace("#include <begin_vertex>", BREATH_VERTEX);
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => key() + "|breath";
  return material;
}

const N = 28; // vertices around each ring
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

// Bulge: extra radius around one direction on the ring, `amp` at `at`
// (radians, 0 = +u, PI/2 = +v), falling off over `width` radians.
type Bulge = { at: number; amp: number; width: number };

type Ring = {
  c: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  radii: number[];
  bones: [number, number][];
  // The material of the faces above this ring.
  mat: number;
  // For the neckline material: how far inside the top each vertex is
  // (positive = cloth), interpolated across the faces so the edge is a
  // clean line through them rather than a staircase of whole quads.
  cloth?: (k: number) => number;
  // How much of the breath this ring carries (1 at the chest, 0 elsewhere).
  breath?: number;
  // Per-vertex bone weights, where one ring spans two bones side by side
  // (the seat, whose lobes belong half to the thighs).
  bonesAt?: (k: number) => [number, number][];
};

const MAT = { skin: 0, top: 1, legwear: 2, band: 3, neck: 4, topShell: 5, legShell: 6 } as const;

// A garment shell: the fabric's own material, seen from both sides, cut
// away wherever the per-vertex `cloth` value is negative (the neckline).
function shellMaterial(base: THREE.Material): THREE.Material {
  const m = (base as THREE.MeshStandardMaterial).clone();
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float cloth;\nvarying float vCloth;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCloth = cloth;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vCloth;")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vCloth < 0.0) discard;");
  };
  m.customProgramCacheKey = () => "body-shell";
  return m;
}

// Hair over a fade: the shell material with the hair's colour blending into
// the skin's over `span` units of the per-vertex `cloth` value above the
// hairline (cloth is 20 per R of height, so span 4 is a fade a fifth of the
// head tall) -- the hair clipped shorter and shorter toward the line, skin
// showing through. A flat dark shell with a hard edge read as a cap.
function fadeMaterial(base: THREE.Material, skin: THREE.Color, span: number): THREE.Material {
  const m = shellMaterial(base) as THREE.MeshStandardMaterial;
  const inner = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    inner(shader, renderer);
    shader.uniforms.uSkin = { value: skin };
    shader.uniforms.uSpan = { value: span };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uSkin;\nuniform float uSpan;")
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nfloat fadeT = smoothstep(0.0, uSpan, vCloth);\ndiffuseColor.rgb = mix(uSkin, diffuseColor.rgb, 0.25 + 0.75 * fadeT);",
      );
  };
  m.customProgramCacheKey = () => "hair-fade";
  return m;
}

// The shadow pass with the same cut: without it a scooped neckline still
// threw the shadow of a whole shirt.
function shadowMaterial(): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float cloth;\nvarying float vCloth;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCloth = cloth;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vCloth;")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vCloth < 0.0) discard;");
  };
  m.customProgramCacheKey = () => "body-shadow";
  return m;
}

// Skin that turns into the top wherever the per-vertex `cloth` value is
// positive: the neckline and straps cut through faces instead of along
// whole quads.
function necklineMaterial(skin: THREE.MeshStandardMaterial, top: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const m = skin.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTop = { value: top.color };
    shader.uniforms.uTopRough = { value: top.roughness };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float cloth;\nvarying float vCloth;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCloth = cloth;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uTop;\nuniform float uTopRough;\nvarying float vCloth;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uTop, step(0.0, vCloth));")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uTopRough, step(0.0, vCloth));");
  };
  m.customProgramCacheKey = () => "body-neckline";
  return m;
}

function ellipseRadii(ru: number, rv: number, bulges: Bulge[] = []): number[] {
  const out: number[] = [];
  for (let k = 0; k < N; k++) {
    const t = (k / N) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    let r = (ru * rv) / Math.sqrt(rv * rv * c * c + ru * ru * s * s);
    for (const b of bulges) {
      let d = Math.abs(t - b.at);
      d = Math.min(d, Math.PI * 2 - d);
      if (d < b.width) {
        const f = 0.5 + 0.5 * Math.cos((d / b.width) * Math.PI);
        r += b.amp * f * f;
      }
    }
    out.push(r);
  }
  return out;
}

function ring(c: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, radii: number[], bones: [number, number][], mat: number, cloth?: (k: number) => number): Ring {
  return { c: c.clone(), u, v, radii, bones, mat, cloth };
}

class Builder {
  positions: number[] = [];
  skinIndex: number[] = [];
  skinWeight: number[] = [];
  cloth: number[] = [];
  breath: number[] = [];
  // Triangles per material.
  tris: number[][] = [[], [], [], [], [], [], []];

  private addRing(r: Ring): number {
    const base = this.positions.length / 3;
    for (let k = 0; k < N; k++) {
      const t = (k / N) * Math.PI * 2;
      const p = r.c.clone().addScaledVector(r.u, r.radii[k]! * Math.cos(t)).addScaledVector(r.v, r.radii[k]! * Math.sin(t));
      this.positions.push(p.x, p.y, p.z);
      // Uncut by default; only a garment's mask goes negative, and the
      // shadow pass reads the same value.
      this.cloth.push(r.cloth ? r.cloth(k) : 1);
      this.breath.push(r.breath ?? 0);
      const bones = (r.bonesAt ? r.bonesAt(k) : r.bones).slice(0, 4);
      const total = bones.reduce((s, [, w]) => s + w, 0) || 1;
      for (let i = 0; i < 4; i++) {
        const b = bones[i];
        this.skinIndex.push(b ? b[0] : 0);
        this.skinWeight.push(b ? b[1] / total : 0);
      }
    }
    return base;
  }

  // Stitch rings in order; a ring of tiny radius closes an end.
  tube(rings: Ring[]) {
    if (rings.length < 2) return;
    const bases = rings.map((r) => this.addRing(r));
    for (let i = 0; i + 1 < rings.length; i++) {
      const a = rings[i]!, b = rings[i + 1]!;
      // Outward winding: flip when the tube advances against u x v.
      const normal = new THREE.Vector3().crossVectors(a.u, a.v);
      const forward = b.c.clone().sub(a.c).dot(normal) >= 0;
      for (let k = 0; k < N; k++) {
        const k1 = (k + 1) % N;
        const tris = this.tris[b.mat]!;
        const a0 = bases[i]! + k, a1 = bases[i]! + k1, b0 = bases[i + 1]! + k, b1 = bases[i + 1]! + k1;
        if (forward) tris.push(a0, a1, b0, a1, b1, b0);
        else tris.push(a0, b0, a1, a1, b0, b1);
      }
    }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.skinIndex, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.skinWeight, 4));
    g.setAttribute("cloth", new THREE.Float32BufferAttribute(this.cloth, 1));
    g.setAttribute("breath", new THREE.Float32BufferAttribute(this.breath, 1));
    const index: number[] = [];
    let start = 0;
    this.tris.forEach((tris, mat) => {
      if (!tris.length) return;
      index.push(...tris);
      g.addGroup(start, tris.length, mat);
      start += tris.length;
    });
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }
}

// Rounded end: rings shrinking along `dir` from a ring of radii `radii`.
function cap(c: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, dir: THREE.Vector3, radii: number[], depth: number, bones: [number, number][], mat: number, steps = 4): Ring[] {
  const out: Ring[] = [];
  for (let i = 1; i <= steps; i++) {
    const phi = (i / steps) * (Math.PI / 2);
    const k = i === steps ? 0.02 : Math.cos(phi);
    out.push(ring(c.clone().addScaledVector(dir, depth * Math.sin(phi)), u, v, radii.map((r) => r * k), bones, mat));
  }
  return out;
}

// Radius of the trunk's lathe profile at a unit height, interpolating.
function profileAt(profile: [number, number][], y: number): number {
  if (y <= profile[0]![1]) return profile[0]![0];
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1]!;
    const [r1, y1] = profile[i]!;
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return profile[profile.length - 1]![0];
}

// The skull's silhouette, ring by ring: for a height `yr` in units of R
// (= headR x 1.3, the face's own unit; 0 at the head's centre), the radius
// at each of the N angles around (front at PI/2, back at -PI/2, the sides
// at 0 and PI). Each ring is the larger of the egg and the jaw ellipsoid
// the face used to carry as a separate blob (so the stubble shell still
// fits it), with the occiput drawn out behind, cheekbones, a chin,
// flattened temples and a little brow bossing above the brows. The eyes,
// nose, mouth, ears and hair sit in front of these surfaces, so every
// shape here keeps clear of the front between the brows and the mouth.
export function skullProfile(headR: number, female: boolean): (yr: number) => number[] {
  const R = headR * 1.3;
  const Rx = headR * 1.18 * 0.95, Ry = headR * 1.18 * 1.06, Rz = headR * 1.18 * 0.98;
  // His jaw: narrower than the egg below the cheekbones, so the lower face
  // is the jaw ellipsoid's own shape -- corners at the angle of the jaw,
  // a defined chin -- rather than the egg's roundness (the user: fix the
  // physiognomy; the fitness face is lean and angular, not chubby).
  const jaw = female ? { a: 0.64, b: 0.5, c: 0.66, cy: -0.4, cz: 0.06 } : { a: 0.66, b: 0.5, c: 0.66, cy: -0.42, cz: 0.08 };
  const g = (y: number, c: number, w: number) => Math.exp(-Math.pow((y - c) / w, 2));
  const front = Math.PI / 2;
  const back = -Math.PI / 2;
  return (yr: number): number[] => {
    const y = yr * R;
    const eggK = Math.abs(y) < Ry ? Math.sqrt(1 - (y / Ry) ** 2) : 0;
    const out: number[] = [];
    for (let k = 0; k < N; k++) {
      const t = (k / N) * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      let egg = eggK > 0 ? ((Rx * Rz) / Math.sqrt(Rz * Rz * c * c + Rx * Rx * s * s)) * eggK : 0;
      // His egg tapers below the cheekbones, handing the lower face to the
      // jaw ellipsoid.
      if (!female && yr < -0.1) {
        const l = Math.min(1, (-0.1 - yr) / 0.5);
        egg *= 1 - 0.14 * l * l * (3 - 2 * l);
      }
      // The jaw ellipsoid along this ray from the ring's centre.
      let jawR = 0;
      const dy = (yr - jaw.cy) / jaw.b;
      if (Math.abs(dy) < 1) {
        const A = (c * c) / (jaw.a * jaw.a) + (s * s) / (jaw.c * jaw.c);
        const B = (-2 * s * jaw.cz) / (jaw.c * jaw.c);
        const C = (jaw.cz * jaw.cz) / (jaw.c * jaw.c) - (1 - dy * dy);
        const disc = B * B - 4 * A * C;
        if (disc > 0) jawR = Math.max(0, (-B + Math.sqrt(disc)) / (2 * A)) * R;
      }
      let r = Math.max(egg, jawR);
      const lobe = (at: number, width: number) => {
        let d = Math.abs(t - at);
        d = Math.min(d, Math.PI * 2 - d);
        if (d >= width) return 0;
        const f = 0.5 + 0.5 * Math.cos((d / width) * Math.PI);
        return f * f;
      };
      const cheek = (female ? 0.028 : 0.035) * g(yr, -0.08, 0.16) * (lobe(front - 0.85, 0.6) + lobe(front + 0.85, 0.6));
      const occiput = 0.05 * g(yr, 0.15, 0.35) * lobe(back, 1.3);
      const temples = -0.025 * g(yr, 0.35, 0.25) * (lobe(0, 0.7) + lobe(Math.PI, 0.7));
      // His chin stands out a little more: a defined jaw and chin are the
      // face the fitness look is after.
      const chin = (female ? 0.02 : 0.04) * g(yr, -0.62, 0.15) * lobe(front, 0.55);
      // The brow ridge sits BEHIND the drawn brows, at 36% of the way down
      // the face from the crown. It was at yr 0.5, a fifth of a head above
      // them, so it read as a ridge across the forehead instead.
      const brow = 0.025 * g(yr, 0.3, 0.13) * lobe(front, 1.0);
      r += R * (cheek + occiput + temples + chin + brow);
      out.push(Math.max(r, 0.01 * R));
    }
    return out;
  };
}

// Hair with volume, lofted over the skull in the head's own frame (origin
// at the head's centre, +Z out of the face, +Y up): a shell that stands
// off the skull by a thickness that varies over the head, thins to
// nothing along the hairline and is cut away below it. His is a textured
// crop over a fade -- close at the sides and back, full on top with a
// forward sweep and a few soft ridges; hers is sleek and even, pulled
// back, with the forehead open and the ears clear (the bun is the
// viewer's). Returns a plain mesh for the face group; the cut is the
// same per-vertex mask the garments use.
// His cut: the textured crop over a low fade (the most requested men's cut
// three years running), a buzz over a soft fade, or the warrior cut --
// heavily textured layers standing up on top over short sides.
export type MaleHair = "crop" | "buzz" | "warrior";

// `fade`: his skin colour, for the fade at the sides and back -- the hair
// thins to nothing and its colour blends into the skin over the last fifth
// of the head above the hairline; without it the shell read as a cap.
export function buildHair(headR: number, female: boolean, material: THREE.Material, style: MaleHair = "crop", fade?: THREE.Color): THREE.Mesh {
  const R = headR * 1.3;
  const skull = skullProfile(headR, female);
  const front = Math.PI / 2;
  // Height of the hairline around the head, in R: open forehead, dipping at
  // the temples, running down behind the ears to the nape.
  const hairline = (t: number): number => {
    let d = Math.abs(t - front);
    d = Math.min(d, Math.PI * 2 - d); // 0 at the front, PI at the back
    // The nape line runs nearly level: a point there read as a widow's
    // peak at the back of the neck. The crop's fringe brings his front
    // hairline a little lower than the buzz's.
    // His temples dip only a little: the brows sit at 0.36R and reach
    // 0.41R at their lifted outer ends, and a hairline dipping to 0.44R
    // over them put the brow's tip into the hair (the user: "невъзможно и
    // противоестествено"); every point over the brows stays above 0.48R.
    const frontLine = style === "crop" ? 0.52 : style === "warrior" ? 0.53 : 0.54;
    const pts: [number, number][] = female
      // The line runs down PAST the ears to the nape on both. It used to
      // stop at -0.27 on him and -0.34 on her, which is level with the top
      // of the ears, so the hair ended in a straight line across the back
      // of the head and left a bald band above the neck.
      ? [[0, 0.56], [0.6, 0.5], [1.05, 0.28], [1.5, 0.02], [1.9, -0.28], [2.4, -0.52], [Math.PI, -0.62]]
      : [[0, frontLine], [0.55, frontLine - 0.03], [0.85, 0.35], [1.25, -0.06], [1.6, -0.26], [2.1, -0.47], [2.6, -0.58], [Math.PI, -0.6]];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!, [x1, y1] = pts[i]!;
      if (d <= x1) return y0 + ((y1 - y0) * (d - x0)) / (x1 - x0);
    }
    return pts[pts.length - 1]![1];
  };
  // Thickness over the skull, in R.
  const thickness = (yr: number, t: number): number => {
    let d = Math.abs(t - front);
    d = Math.min(d, Math.PI * 2 - d);
    // 0 low on the sides, 1 on the crown. It used to reach 0 only at yr
    // 0.25, most of the way UP the head, so everything below that got the
    // bare minimum thickness and the sides read as bald skin.
    const top = Math.min(1, Math.max(0, (yr + 0.1) / 0.5));
    if (female) {
      // Sleek and combed back, but hair, not paint: fine grooves run from
      // the hairline over the crown toward the tie (the strands), and the
      // crown carries a little more volume than the sides.
      const strands = 0.007 * Math.sin(t * 18 + yr * 1.5) * (0.5 + 0.5 * top);
      return 0.045 + 0.035 * top * top + strands;
    }
    let side = t - front;
    if (side > Math.PI) side -= Math.PI * 2;
    if (side < -Math.PI) side += Math.PI * 2;
    if (style === "buzz") {
      // A buzz over a soft fade: short and even, a whisper of grain.
      return 0.014 + 0.012 * top + 0.003 * top * Math.sin(t * 13 + yr * 7);
    }
    if (style === "warrior") {
      // Short sides, and on top heavy textured layers standing up and a
      // little forward, spiked by two crossing ripples.
      const lift = 0.15 * Math.pow(top, 1.3);
      const forward = d < 1.2 ? 0.04 * (1 - d / 1.2) * top : 0;
      const spikes = top * (0.028 * Math.sin(t * 11 + yr * 5) + 0.016 * Math.sin(t * 19 - yr * 13 + 1));
      return 0.02 + lift + forward + spikes;
    }
    // The textured crop over a low fade: tight at the sides and back; full
    // on top, brought forward into a short fringe, broken into tufts by two
    // crossing ripples, with a parting combed in on one side.
    const fringe = d < 1.1 ? 0.06 * (1 - d / 1.1) * Math.pow(top, 1.4) : 0;
    const tufts = top * (0.014 * Math.sin(t * 9 + yr * 6) + 0.008 * Math.sin(t * 17 - yr * 11 + 1));
    // Finer grain across the top -- the clipped ends -- so it reads as hair
    // and not a smooth cap.
    const grain = top * 0.004 * Math.sin(t * 29 + yr * 19);
    const parting = 0.045 * top * Math.exp(-Math.pow((side - 0.5) / 0.14, 2));
    return 0.022 + 0.065 * top + fringe + tufts + grain - parting;
  };
  // The fade: at his sides and back the hair thins over a fifth of the head
  // above the hairline (the top keeps its short feather so the fringe stays
  // full to its edge), and the line itself is a little ragged, the way
  // clipped hair meets skin.
  const featherLen = (t: number): number => {
    if (female) return 0.12;
    let d = Math.abs(t - front);
    d = Math.min(d, Math.PI * 2 - d);
    return d < 0.7 ? 0.12 : 0.12 + 0.1 * Math.min(1, (d - 0.7) / 0.5);
  };
  const ragged = (t: number): number => (female ? 0 : 0.008 * Math.sin(t * 23 + 1) + 0.005 * Math.sin(t * 41));
  // How much of the head's motion the hair at a vertex lags behind (the
  // viewer sways it): his quiff, nothing on her sleek shell (her bun and
  // wisps are the viewer's own).
  const lagAt = (yr: number, t: number): number => {
    if (female || style === "buzz") return 0;
    let d = Math.abs(t - front);
    d = Math.min(d, Math.PI * 2 - d);
    const top = Math.min(1, Math.max(0, (yr + 0.1) / 0.5));
    return top * top * Math.max(0, 1 - d / 1.3);
  };
  const lag: number[] = [];
  const b = new Builder();
  const rings: Ring[] = [];
  // Dense where the hairline runs, so its diagonal over the temple is a
  // clean line and not a staircase of whole quads.
  const ys: number[] = [];
  // Down to -0.72, where the neck enters the skull: at -0.45 there was no
  // ring left to carry the hairline once it reached the nape.
  for (let y = -0.72; y <= 0.6; y += 0.05) ys.push(+y.toFixed(3));
  ys.push(0.68, 0.76, 0.83, 0.89, 0.94, 0.97);
  for (const yr of ys) {
    const base = skull(yr);
    const radii: number[] = [];
    const mask: number[] = [];
    for (let k = 0; k < N; k++) {
      const t = (k / N) * Math.PI * 2;
      const line = hairline(t) + ragged(t);
      // Feather the thickness to nothing over the last bit above the
      // hairline, so the edge lies flush with the skin. Below it the shell
      // stays a hair ABOVE the skull (the mask removes it): tucked inside,
      // the surface crossed the skull between two rings and the hairline
      // showed as a staircase along the temples.
      const above = yr - line;
      const feather = Math.min(1, Math.max(0, above / featherLen(t)));
      radii.push(base[k]! + R * Math.max(0.006, above > 0 ? thickness(yr, t) * feather : 0));
      // The mask reaches the fade material's full span (4.4) where the
      // thickness reaches full, so the colour fades over the same height
      // as the hair thins: short at the front (a crisp fringe), long at
      // the sides and back.
      mask.push((above * 4.4) / featherLen(t));
      lag.push(above > 0 ? lagAt(yr, t) * feather : 0);
    }
    rings.push(ring(new THREE.Vector3(0, yr * R, 0), X, Z, radii, [[0, 1]], MAT.topShell, (k) => mask[k]!));
  }
  // Close the crown a little above the last ring, not level with it and not
  // far above it: level, the closing cone is flat enough to catch the light
  // as a star from directly overhead; at 1.045R it is a 52 degree cone on a
  // ring of 0.097R and the head grows a point.
  const crown = skull(0.97).map((r) => r * 0.02);
  rings.push(ring(new THREE.Vector3(0, 1.005 * R, 0), X, Z, crown, [[0, 1]], MAT.topShell, () => 1));
  for (let k = 0; k < N; k++) lag.push(lagAt(1.005, (k / N) * Math.PI * 2));
  b.tube(rings);
  const geometry = b.geometry();
  geometry.deleteAttribute("skinIndex");
  geometry.deleteAttribute("skinWeight");
  const mesh = new THREE.Mesh(geometry, fade ? fadeMaterial(material, fade, 4.4) : shellMaterial(material));
  mesh.castShadow = true;
  // The rest positions and the per-vertex lag, for the viewer's sway.
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  position.setUsage(THREE.DynamicDrawUsage);
  mesh.userData.rest = Float32Array.from(position.array as Float32Array);
  mesh.userData.lag = Float32Array.from(lag);
  return mesh;
}

export function buildBody(spec: BodySpec, mats: BodyMaterials): Body {
  const L = spec.lengths;
  const female = spec.sex === "female";
  const def = spec.style.definition;

  // --- Skeleton -----------------------------------------------------------
  const bones: THREE.Bone[] = [];
  const index = new Map<string, number>();
  const bone = (name: string, parent: THREE.Bone | null, x: number, y: number, z: number): THREE.Bone => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    index.set(name, bones.length);
    bones.push(b);
    return b;
  };
  const ankleY = L.ankle;
  const kneeY = ankleY + L.shin;
  const hipY = kneeY + L.thigh;
  const shoulderY = hipY + L.spine;
  const neckTopY = shoulderY + L.neck;
  const headY = neckTopY + L.headLift;

  const hips = bone("mixamorigHips", null, 0, hipY, 0);
  const spine0 = bone("mixamorigSpine", hips, 0, L.spine / 3, 0);
  const spine1 = bone("mixamorigSpine1", spine0, 0, L.spine / 3, 0);
  const spine2 = bone("mixamorigSpine2", spine1, 0, L.spine / 3 - 0.02, 0);
  const neck = bone("mixamorigNeck", spine2, 0, 0.02, 0);
  const head = bone("mixamorigHead", neck, 0, L.neck, 0);
  bone("mixamorigHeadTop_End", head, 0, L.headLift * 2, 0);
  for (const [side, s] of [["Left", 1], ["Right", -1]] as const) {
    const clav = bone(`mixamorig${side}Shoulder`, spine2, 0, 0.02, 0);
    const arm = bone(`mixamorig${side}Arm`, clav, s * L.shoulderHalf, 0, 0);
    const fore = bone(`mixamorig${side}ForeArm`, arm, s * L.upperArm, 0, 0);
    // Joint helpers at the elbow and the knee (siblings of the segment
    // below), which the retargeting aims along the bisector of the two
    // segments: the rings around each joint ride them, so a bent joint keeps
    // its corner instead of collapsing toward the axis.
    bone(`mixamorig${side}ElbowCap`, arm, s * L.upperArm, 0, 0);
    const hand = bone(`mixamorig${side}Hand`, fore, s * L.forearm, 0, 0);
    bone(`mixamorig${side}HandMiddle1`, hand, s * L.hand, 0, 0);
    const upLeg = bone(`mixamorig${side}UpLeg`, hips, s * L.hipHalf, 0, 0);
    const leg = bone(`mixamorig${side}Leg`, upLeg, 0, -L.thigh, 0);
    bone(`mixamorig${side}KneeCap`, upLeg, 0, -L.thigh, 0);
    const foot = bone(`mixamorig${side}Foot`, leg, 0, -L.shin, 0);
    bone(`mixamorig${side}ToeBase`, foot, 0, -ankleY * 0.6, 0.08);
  }
  hips.updateMatrixWorld(true);
  const bi = (name: string) => index.get(`mixamorig${name}`)!;

  // --- Rings --------------------------------------------------------------
  const b = new Builder();
  // The pelvis flares from the waist out to the thighs' outer edge: the
  // lathe profile alone left the hips narrower than the two thighs under
  // them, and the legs read as tubes bolted under a box.
  // The thigh is oval at the top -- narrower across than deep -- so the
  // hips are the joints plus that narrower half-width, not two round
  // tubes side by side (which made a skirt of the shorts).
  // His thighs sit a little narrower across, which is what brings his
  // pelvis in a few millimetres a side (the user asked for a slightly
  // narrower pelvis on the male only); hers keep their width.
  const THIGH_LAT = female ? 0.78 : 0.68;
  const hipW = L.hipHalf + spec.taper.thigh[1] * THIGH_LAT + (female ? 0.004 : 0);
  // The thigh's cross-section at `t` (0 at the hip joint, 1 at the knee):
  // base radius with the quad sweep, oval at the top and round by the knee.
  // Shared by the seat, which is cut to the thighs' own outline.
  const legDef = female ? def * 0.5 : def;
  const thighShape = (t: number): { ru: number; rv: number; quad: number; sweep: number } => {
    const [thighB, thighA] = spec.taper.thigh;
    const tt = Math.min(1, Math.max(0, t));
    const base = (thighA + (thighB - thighA) * t) * (1 + 0.03 * def * Math.exp(-Math.pow((t - 0.35) / 0.3, 2)));
    // Two shapes make a thigh read as trained rather than as a tapered
    // tube: the quadriceps down the FRONT, and the vastus lateralis
    // sweeping out of the OUTER side lower down. Both are lobes, not a
    // radial swell -- a swell just makes the tube fatter and softer. The
    // back of the thigh stays plain: it is what rests on every seat.
    const quad = 0.11 * legDef * base * Math.exp(-Math.pow((t - 0.42) / 0.24, 2));
    const sweep = 0.12 * legDef * base * Math.exp(-Math.pow((t - 0.58) / 0.22, 2));
    // The thigh is flattened across at the hip (or the shorts read as a
    // skirt) and rounds out toward the knee. It rounds out FASTER than
    // straight now, so the thigh carries its real width against the calf
    // in a front view; the hip stays where it is (the curve is still 0 at
    // t = 0, and hipW is built from that end).
    return { ru: base * (THIGH_LAT + (1 - THIGH_LAT) * Math.pow(tt, 0.7)), rv: base * (1.1 - 0.1 * tt), quad, sweep };
  };
  // How far below the hip joints the seat runs before the thighs take over.
  const SEAT_DROP = 0.072;
  const W = (u: number) => {
    const base = profileAt(spec.trunkProfile, u) * 1.45 * spec.trunkW * (u > 0 ? spec.style.chest : 1);
    // His waist is as wide as his pelvis (the user: "Талията и тазът на
    // мъжа трябва да са еднакво широки"): from the pelvis up to the lower
    // ribs the trunk is never narrower than hipW, whatever the build, and
    // the chest takes over above. Hers keeps the hourglass.
    // From there the width runs up to the chest's on one smooth S-curve
    // (a floor that held the pelvis width flat to the lower ribs and then
    // let the chest jump out left a ridge across the abdomen -- the user:
    // "прехода от гръден кош към корем да изглежда натурално").
    if (!female && u < 0.34) {
      const top = profileAt(spec.trunkProfile, 0.34) * 1.45 * spec.trunkW * spec.style.chest;
      const s = Math.min(1, Math.max(0, (u + 0.1) / 0.44));
      const k = s * s * (3 - 2 * s);
      const smooth = hipW + (top - hipW) * k;
      if (base < smooth) return smooth;
    }
    if (u >= -0.28) return base;
    const s = Math.min(1, (-0.28 - u) / 0.22);
    const flare = s * s * (3 - 2 * s);
    return base + (Math.max(base, hipW) - base) * flare;
  };
  // Depth at 1.0 of the profile (was 0.9 of a wider one): the chest is
  // narrower now, and the same depth keeps a lying back on its bench pad.
  const D = (u: number) => profileAt(spec.trunkProfile, u) * 1.0 * spec.trunkD;
  const trunkY = (u: number) => hipY + (u + 0.5) * L.spine;
  const trunkBones = (u: number): [number, number][] => {
    // Blend along the stacked spine bones, which all take the trunk's
    // direction anyway; the blend keeps the pelvis with the hips bone.
    const t = (u + 0.5) * 3; // 0..3 over hips, spine, spine1, spine2
    const names = ["Hips", "Spine", "Spine1", "Spine2"];
    const i = Math.min(Math.floor(t), 2);
    const f = t - i;
    return [[bi(names[i]!), 1 - f], [bi(names[i + 1]!), f]];
  };
  const trunkBand = (u: number): number => {
    if (female) {
      if (u >= 0.5 - spec.topCover) return MAT.top;
      if (u <= -0.36) return MAT.legwear;
      return MAT.skin;
    }
    return u <= -0.42 ? MAT.legwear : MAT.top;
  };
  // The neckline: from `neckFrom` up, the top narrows to two straps over the
  // sides of the shoulders (his stringer scoops deep; hers less so). Rings
  // there use the neckline material, whose per-vertex `cloth` value is how
  // far inside the strap the vertex is. Cap rings above the shoulders take
  // t = 1.
  const neckFrom = female ? 0.36 : 0.28;
  const strapCloth = (t: number): ((k: number) => number) => {
    const strap = female ? 0.5 : 0.38;
    const half = Math.PI / 2 + (strap - Math.PI / 2) * Math.min(1, Math.max(0, t));
    return (k) => {
      const theta = (k / N) * Math.PI * 2;
      const lateral = Math.min(Math.abs(theta), Math.abs(theta - Math.PI), Math.abs(theta - Math.PI * 2));
      return half - lateral;
    };
  };
  const layered = !!spec.style.layered;
  // His top is a short-sleeved tee (the user: "черна спортна тениска с къс
  // ръкав" in place of the stringer): the whole trunk in fabric, a crew
  // neckline cut through the traps dome, sleeves over the delts on the arm
  // tubes. Hers keeps the cropped top with straps.
  const tee = !female && !layered;
  const trunkMat = (u: number): { mat: number; cloth?: (k: number) => number } => {
    if (layered) return { mat: trunkBand(u) === MAT.legwear ? MAT.legwear : MAT.skin };
    const band = trunkBand(u);
    if (band !== MAT.top || u < neckFrom || tee) return { mat: band };
    return { mat: MAT.neck, cloth: strapCloth((u - neckFrom) / (0.5 - neckFrom)) };
  };
  const front = Math.PI / 2;
  const back = -Math.PI / 2;
  const smooth01 = (x: number) => {
    const t = Math.min(1, Math.max(0, x));
    return t * t * (3 - 2 * t);
  };
  // How much fabric there is over a ring. A garment spans ACROSS the fine
  // grooves of the body and only follows its broad masses, so the same
  // abdomen carries its full relief on bare skin and a hint of it under a
  // tee. Without this the six-pack is printed on the cotton, which is what
  // body paint looks like, not a shirt. (Under `layered` the trunk itself
  // is the skin and the clothes are separate shells.)
  const clothAt = (u: number): number => {
    if (layered) return 0;
    // His tee runs the whole trunk down to the shorts: all of it is fabric.
    if (!female) return 1;
    // Hers is a cropped top over shorts, so the midriff between the hem and
    // the waistband is bare -- the lower abdomen and the flanks.
    const shorts = 1 - smooth01((u + 0.36) / 0.04);
    return Math.max(shorts, smooth01((u - (0.5 - spec.topCover) + 0.02) / 0.04));
  };
  const trunkBulges = (u: number): Bulge[] => {
    const out: Bulge[] = [];
    const cloth = clothAt(u);
    if (female) {
      // Her bust: two lobes either side of the midline, peaking a little
      // above the middle of the trunk and fading out above and below.
      const chestF = Math.exp(-Math.pow((u - 0.26) / 0.13, 2));
      if (chestF > 0.05) {
        const amp = 0.015 * chestF;
        out.push({ at: front - 0.48, amp, width: 0.75 }, { at: front + 0.48, amp, width: 0.75 });
      }
    } else {
      // His pectorals: a slab either side of the sternum, held full from
      // the nipple line up and cut off SHARPLY at the bottom -- that lower
      // border is the line that reads as a chest, and a symmetric bell in
      // u (what this was) has no bottom edge at all. They stay within a
      // centimetre: a prone figure rests its chest on a pad.
      const pecF = smooth01((u - 0.15) / 0.07) * (1 - smooth01((u - 0.33) / 0.12));
      if (pecF > 0.02) {
        const amp = 0.013 * def * pecF;
        out.push({ at: front - 0.42, amp, width: 0.72 }, { at: front + 0.42, amp, width: 0.72 });
        out.push({ at: front, amp: -0.004 * def * pecF, width: 0.2 });
      }
      // The serratus on the lower ribs, between the pectoral's outer bottom
      // corner and the lat. Small, and only under the ribs it belongs to.
      const serrF = smooth01((u - 0.04) / 0.08) * (1 - smooth01((u - 0.2) / 0.08));
      if (serrF > 0.02) {
        const amp = 0.0025 * def * serrF * (0.6 + 0.4 * Math.cos((2 * Math.PI * u) / 0.08)) * (1 - 0.5 * cloth);
        out.push({ at: front - 1.15, amp, width: 0.6 }, { at: front + 1.15, amp, width: 0.6 });
      }
    }
    // The abdomen and the waist, on both. Landmarks along u, which runs
    // -0.5 at the hip line to 0.5 at the shoulders over about 50cm: the
    // pubis near -0.34, the navel -0.08, the bottom of the sternum 0.12.
    // Hers are the same shapes at 40% -- a flat, toned midriff, not a
    // trained one -- and her cropped top leaves exactly the part that
    // shows them: the lower abdomen and the flanks.
    const absDef = female ? def * 0.55 : def;
    if (absDef > 0) {
      // The rectus: two columns either side of the midline from the pubis
      // up to the ribs, with the linea alba sunk between them. The columns
      // are what stands proud; the groove is what makes them read as two.
      // It runs from the pubis all the way up under the sternum: stopping
      // it at the navel left room for a single crease across the belly,
      // which reads as a fold in the shirt and not as an abdomen.
      const rectF = smooth01((u + 0.3) / 0.12) * (1 - smooth01((u - 0.13) / 0.09));
      if (rectF > 0.02) {
        // The tendinous intersections cross them ABOVE the navel only --
        // below it the muscle is one long segment, which is why a lean
        // abdomen has a six-pack and not an eight-pack. ~6.5cm apart.
        const seg = 0.5 + 0.5 * Math.cos((2 * Math.PI * (u - 0.085)) / 0.13);
        const cross = smooth01((u + 0.03) / 0.06) * (1 - 0.3 * cloth);
        // The columns are kept OFF the midline and narrow. Wide ones reach
        // across it and fill the groove between them back in -- measured on
        // the mesh, a pair at 0.22 and width 0.45 put back 53% of their own
        // height at x = 0 and cancelled the linea alba exactly.
        const amp = 0.007 * absDef * rectF * (1 - 0.1 * cloth) * (1 - 0.55 * cross * (1 - seg));
        out.push({ at: front - 0.2, amp, width: 0.38 }, { at: front + 0.2, amp, width: 0.38 });
        out.push({ at: front, amp: -0.0045 * absDef * rectF * (1 - 0.3 * cloth), width: 0.24 });
      }
      // The navel. One vertex wide and three rings tall, which at 28
      // vertices around the trunk is about as small as this surface can
      // hold a shape -- roughly a real navel's footprint anyway.
      const navelF = Math.exp(-Math.pow(u / 0.055, 2));
      if (navelF > 0.05) out.push({ at: front, amp: -0.0045 * navelF * (1 - 0.9 * cloth), width: 0.22 });
      // The obliques: the slab down each flank from the lowest ribs to the
      // crest of the pelvis, in front of the lats and below them -- it
      // fades out as they fade in, so the side of the trunk is one line
      // from the armpit to the hip.
      const oblF = smooth01((u + 0.3) / 0.12) * (1 - smooth01((u - 0.08) / 0.12));
      if (oblF > 0.02) {
        const amp = 0.006 * absDef * oblF * (1 - 0.1 * cloth);
        out.push({ at: front - 1.05, amp, width: 0.62 }, { at: front + 1.05, amp, width: 0.62 });
      }
    }
    // (The glutes are not a lobe here: they are the eggs in seatOutline.)
    // The back: the lats carry width at the SIDES -- the V from the
    // armpits down to the waist -- and their own mass on the back either
    // side of the spine, with the spinal furrow between them. A single
    // lateral lobe (what this was) widened the trunk but left the back a
    // smooth arc. Hers are the same shapes at a third of the relief.
    const backDef = female ? 0.35 : def;
    if (backDef > 0) {
      const latF = smooth01((u + 0.02) / 0.2) * (1 - smooth01((u - 0.34) / 0.14));
      if (latF > 0.02) {
        const wide = 0.012 * backDef * latF;
        out.push({ at: 0, amp: wide, width: 1.0 }, { at: Math.PI, amp: wide, width: 1.0 });
        const mass = 0.009 * backDef * latF;
        out.push({ at: back - 0.9, amp: mass, width: 1.0 }, { at: back + 0.9, amp: mass, width: 1.0 });
      }
      // The furrow now runs the WHOLE back, not just the part the lats
      // cover: below them it is the lumbar dip, the deepest point of the
      // back in profile, and a back that goes flat there reads as a plank
      // from the side.
      // The upper back, behind the shoulder girdle. Above the lats this
      // was a plain ellipse -- a smooth board between two arms. It gets
      // the trapezius as one sheet across the top, the shoulder blades
      // under it either side of the spine, and the teres group filling
      // the corner toward each armpit.
      const trapF = smooth01((u - 0.28) / 0.14);
      if (trapF > 0.02) out.push({ at: back, amp: 0.007 * backDef * trapF, width: 1.7 });
      const scapF = smooth01((u - 0.16) / 0.12) * (1 - smooth01((u - 0.42) / 0.1));
      if (scapF > 0.02) {
        const amp = 0.006 * backDef * scapF;
        out.push({ at: back - 0.55, amp, width: 0.5 }, { at: back + 0.55, amp, width: 0.5 });
      }
      const teresF = smooth01((u - 0.22) / 0.12) * (1 - smooth01((u - 0.42) / 0.12));
      if (teresF > 0.02) {
        const amp = 0.006 * backDef * teresF;
        out.push({ at: back - 1.05, amp, width: 0.6 }, { at: back + 1.05, amp, width: 0.6 });
      }
      const furrowF = smooth01((u + 0.3) / 0.14) * (1 - smooth01((u - 0.4) / 0.12));
      if (furrowF > 0.02) out.push({ at: back, amp: -0.005 * backDef * furrowF * (1 - 0.3 * cloth), width: 0.24 });
      // The erectors: the two columns either side of that furrow, standing
      // out most across the small of the back where the lats have gone.
      const erecF = smooth01((u + 0.32) / 0.12) * (1 - smooth01((u - 0.18) / 0.2));
      if (erecF > 0.02) {
        const amp = 0.005 * backDef * erecF * (1 - 0.1 * cloth);
        out.push({ at: back - 0.3, amp, width: 0.5 }, { at: back + 0.3, amp, width: 0.5 });
      }
    }
    return out;
  };

  // Trunk: a rounded pelvis under the hips, the lathe profile up to the
  // shoulders, then the traps sloping in to the neck.
  const trunk: Ring[] = [];
  const pelvisBones: [number, number][] = [[bi("Hips"), 1]];
  // The pelvis is painted in the legwear even under a layered garment: the
  // only place it shows is the crotch between the shells, and skin there
  // read as a gap in the shorts.
  const legMat = MAT.legwear;
  // The seat under the hip line: the width shrinks to the crotch between the
  // thighs while the depth (and the glutes on it) holds, so the seat is
  // round where a real one is and the crotch stays a crotch.
  // The seat, from the small of the back down to where the thighs part.
  // Every ring through it is the union, along each ray from the midline, of
  // three things: the pelvis (the lathe profile above the hip joints, an
  // ellipse shrinking to the crotch below them), the two thighs' own ovals
  // (fading out over the 3cm above the joints, so the seat's surface IS the
  // thighs' surface where they meet), and the glutes -- an egg per side
  // behind and a little below the joints, round underneath (an ellipse down
  // to the fold, where it sinks into the thigh) and fading up into the back.
  // The union is blended over a centimetre, so the seat is a curve in every
  // view: an arc in profile from the waist to the fold, two round lobes from
  // behind, and no flat wall anywhere. (The glutes were a lobe on the
  // hip-line ring that faded out linearly down the seat -- a diagonal plane,
  // which the user read as "с ъгъл".) Vertices the thighs or eggs own lean
  // on the thigh bones more the lower they sit, so a raised knee takes the
  // seat with it.
  const thighTop = thighShape(0);
  const GLUTE = {
    x: L.hipHalf * 0.62,
    // The centre, below the hip joints.
    y: female ? -0.022 : -0.018,
    rx: Math.min(thighTop.ru * (female ? 1.5 : 1.3), hipW - L.hipHalf * 0.62 - 0.002),
    rz: thighTop.rv * (female ? 1.05 : 0.8),
    // How far the apex stands behind the thigh's own back (his was 0.27:
    // "Задника на мъжа не трябва да е толкова голям").
    out: thighTop.rv * (female ? 0.38 : 0.14),
    // The vertical half-extents: round below, a long fade above.
    down: 0.05,
    up: female ? 0.065 : 0.06,
  };
  const gluteZ = thighTop.rv + GLUTE.out - GLUTE.rz;
  const gluteE = (dy: number) => {
    const d = dy - GLUTE.y;
    if (d <= 0) return Math.sqrt(Math.max(0, 1 - Math.pow(d / GLUTE.down, 2)));
    return Math.exp(-Math.pow(d / GLUTE.up, 2));
  };
  // Where the ray (c, s) from the origin leaves an ellipse centred at
  // (sx, sz) with half-axes A and B; 0 when it misses.
  const ellipseHit = (c: number, s: number, sx: number, sz: number, A: number, B: number): number => {
    if (A <= 0 || B <= 0) return 0;
    const qa = (c * c) / (A * A) + (s * s) / (B * B);
    const qb = -2 * ((c * sx) / (A * A) + (s * sz) / (B * B));
    const qc = (sx * sx) / (A * A) + (sz * sz) / (B * B) - 1;
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) return 0;
    return (-qb + Math.sqrt(disc)) / (2 * qa);
  };
  const SEAT_BLEND = 0.01;
  const smax = (a: number, b: number) => {
    const h = Math.max(SEAT_BLEND - Math.abs(a - b), 0) / SEAT_BLEND;
    return Math.max(a, b) + h * h * SEAT_BLEND * 0.25;
  };
  // `bridge` scales the ellipse that spans the crotch between the two
  // thighs (1 = the full bridge). The rings that close the seat under the
  // fold draw it in to nothing; see the cap below.
  const seatOutline = (y: number, bridge = 1): { radii: number[] } => {
    const dy = y - hipY;
    const u = -0.5 + dy / L.spine;
    const below = dy < 0;
    const f = below ? Math.min(1, -dy / SEAT_DROP) : 0;
    const { ru: a, rv: bb, quad, sweep } = thighShape(Math.max(0, -dy) / L.thigh);
    const fade = Math.min(1, Math.max(0, dy / 0.03));
    const thighF = below ? 1 : 1 - fade * fade * (3 - 2 * fade);
    const baseW = below ? (hipW + (0.012 - hipW) * f * f) * bridge : W(u);
    const baseD = below ? D(-0.5) * (1 - 0.55 * f) * bridge : D(u);
    const e = gluteE(dy);
    const gA = GLUTE.rx * e, gB = GLUTE.rz * e;
    const radii: number[] = [];
    const sides: number[] = [];
    for (let k = 0; k < N; k++) {
      const th = (k / N) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      let r = (baseW * baseD) / Math.sqrt(baseD * baseD * c * c + baseW * baseW * s * s);
      let best = r;
      let side = 0;
      for (const sx of [L.hipHalf, -L.hipHalf]) {
        let hit = ellipseHit(c, s, sx, 0, a, bb);
        if (hit <= 0) continue;
        // That thigh's own muscle lobes, by the angle around ITS centre:
        // the quadriceps on its front, the vastus lateralis on its outer
        // side (the same shapes the leg's own rings carry, so the seat and
        // the thigh meet without a step).
        const local = Math.atan2(hit * s, hit * c - sx);
        const lobe = (at: number, amp: number, width: number) => {
          if (amp <= 0.0005) return 0;
          let d = Math.abs(local - at);
          d = Math.min(d, Math.PI * 2 - d);
          if (d >= width) return 0;
          const g = 0.5 + 0.5 * Math.cos((d / width) * Math.PI);
          return amp * g * g;
        };
        hit += lobe(front, quad, 0.85) + lobe(sx > 0 ? 0 : Math.PI, sweep, 0.8);
        if (hit <= r) continue;
        hit = r + (hit - r) * thighF;
        if (hit > best) {
          best = hit;
          side = Math.sign(sx);
        }
        r = smax(r, hit);
      }
      if (e > 0.02) {
        for (const sx of [GLUTE.x, -GLUTE.x]) {
          const hit = ellipseHit(c, s, sx, -gluteZ, gA, gB);
          if (hit <= r) continue;
          if (hit > best) {
            best = hit;
            side = Math.sign(sx);
          }
          r = smax(r, hit);
        }
      }
      radii.push(r);
    }
    return { radii };
  };
  // Who owns a vertex around the seat: the thighs by how far down the seat
  // it sits (`f`, 0 at the hip joints, 1 at the fold), the pelvis for the
  // rest. The thighs' part is split between the LEFT and RIGHT leg by the
  // vertex's distance from the midline, half and half at the crotch and
  // the cleft, so every neighbour's owners are close to its own and a
  // flexed hip stretches the surface instead of tearing it. Two things
  // this replaces: owners switching from pelvis to thigh between two
  // vertices of one ring (a fin off the back of the pelvis and a blade in
  // the crotch at a deep squat or a hinge), and a crotch left with the
  // pelvis while the thighs beside it rotated 90 degrees (a membrane
  // trailing from the inner thigh in the row).
  const leftShare = (x: number) => {
    const s = Math.min(1, Math.max(0, (x + 0.02) / 0.04));
    return s * s * (3 - 2 * s);
  };
  const hipsBone = bi("Hips"), leftLeg = bi("LeftUpLeg"), rightLeg = bi("RightUpLeg");
  // The front of the seat belongs to the thighs sooner than the back: the
  // hip crease is where the thigh's front folds against the belly, and a
  // front left mostly with the pelvis opened a dark slit there at a deep
  // squat, where the rotated thigh cut up through it. `front` is how far
  // toward the front the vertex sits (0 at the sides and back, 1 in front).
  const seatBones = (x: number, f: number, front = 0): [number, number][] => {
    f = Math.min(1, f * (1 + 0.9 * Math.max(0, front)));
    if (f <= 0) return [[hipsBone, 1]];
    const l = leftShare(x);
    const out: [number, number][] = [];
    if (l > 0) out.push([leftLeg, f * l]);
    if (l < 1) out.push([rightLeg, f * (1 - l)]);
    if (f < 1) out.push([hipsBone, 1 - f]);
    return out;
  };
  const seatRing = (drop: number, tuck = 1, bridge = 1): Ring => {
    const f = Math.min(1, drop / SEAT_DROP);
    const { radii } = seatOutline(hipY - drop, bridge);
    const out = ring(new THREE.Vector3(0, hipY - drop, 0), X, Z, radii.map((r) => r * tuck), pelvisBones, legMat);
    out.bonesAt = (k) => {
      const th = (k / N) * Math.PI * 2;
      return seatBones(out.radii[k]! * Math.cos(th), f, Math.sin(th));
    };
    return out;
  };
  // Dense through the seat, so the eggs' curve is a curve and not facets.
  const seatDrops = [0.006, 0.014, 0.024, 0.034, 0.044, 0.052, 0.06, 0.066, SEAT_DROP];
  // The seat's lowest rings tuck a hair inside the thighs, below where they
  // start, so the join is the thighs' own edge and not two coincident
  // surfaces shading differently. The last three also draw the crotch
  // bridge in to nothing, so the tube CLOSES under the thighs instead of
  // ending in a rim hanging between them -- that rim read as a hard shelf
  // across the crotch in any close-up from the front.
  trunk.push(seatRing(SEAT_DROP + 0.018, 0.9, 0.05));
  trunk.push(seatRing(SEAT_DROP + 0.014, 0.94, 0.3));
  trunk.push(seatRing(SEAT_DROP + 0.008, 0.97, 0.68));
  // These stay at FULL width, and tucking them in is a trap: on the outer
  // side the seat's outline at the junction already equals the thigh's own
  // oval exactly (the glutes have faded to nothing by then and the pelvis
  // has shrunk to the crotch), so drawing them in only lifts the thigh out
  // of the seat and makes the step worse. The step that IS there comes from
  // the crotch bridge, on the inner and front sides, where the seat is
  // wider than one thigh; closing it needs the thigh's first rings to take
  // the seat's outline along their own rays, not their own ellipse.
  for (const drop of [...seatDrops].reverse()) trunk.push(seatRing(drop));
  // Dense through the chest and back: the pectorals' lower border and the
  // lats' taper are the shapes the eye reads there, and 2cm rings turned
  // both into facets.
  // Denser again through the abdomen and the waist: the intersections
  // across the rectus are 6.5cm apart, so 2cm rings sampled them as a
  // wobble instead of steps, and the navel fell between two of them.
  const trunkUs = [
    -0.5, -0.47, -0.44, -0.42, -0.41, -0.38, -0.36, -0.35, -0.33, -0.31, -0.29, -0.27, -0.25, -0.23, -0.21, -0.19,
    -0.17, -0.15, -0.13, -0.11, -0.09, -0.07, -0.05, -0.04, -0.02, 0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16,
    0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46, 0.5,
  ];
  // The trunk's lower rings run through the seat's union; above it the
  // lathe profile alone.
  const lowRadii = (u: number, gap: number): number[] =>
    u < -0.3 ? seatOutline(trunkY(u)).radii.map((r) => r + gap) : ellipseRadii(W(u) + gap, D(u) + gap, trunkBulges(u));
  // The breath lives in the rib cage: nothing below the waist, everything
  // from the lower chest up.
  const breathAt = (u: number) => Math.min(1, Math.max(0, (u + 0.15) / 0.25));
  // Fabric inside a deltoid is cut away: the shoulder rings reach into the
  // delts, and a strap poking out of one read as a white patch.
  const deltR = spec.delt * spec.style.shoulders + 0.004;
  const clearDelts = (c: THREE.Vector3, radii: number[], base?: (k: number) => number) => (k: number) => {
    const t = (k / N) * Math.PI * 2;
    const px = c.x + radii[k]! * Math.cos(t), pz = c.z + radii[k]! * Math.sin(t);
    let clear = Infinity;
    for (const s of [1, -1]) clear = Math.min(clear, Math.hypot(px - s * L.shoulderHalf, c.y - (shoulderY - 0.006), pz) - deltR);
    return Math.min(base ? base(k) : 1, clear * 40);
  };
  // The neckline and armholes, cut by where each vertex sits across the
  // body: from `neckFrom` up, the fabric narrows to a strap band between
  // `strapIn` and `strapOut` of the midline -- so the front and back
  // panels scoop toward the straps, the armholes open outside them, and
  // the straps cross the shoulder medial to the deltoids. Painted or
  // layered, the same cut.
  const strapIn = 0.022, strapOut = female ? 0.056 : 0.047;
  const panelCloth = (t: number, c: THREE.Vector3, radii: number[]) => (k: number) => {
    const th = (k / N) * Math.PI * 2;
    const ax = Math.abs(c.x + radii[k]! * Math.cos(th));
    const s = Math.min(1, Math.max(0, t));
    const xMin = strapIn * s;
    const xMax = radii[0]! + (strapOut - radii[0]!) * s;
    return Math.min(ax - xMin, xMax - ax) * 40;
  };
  for (const u of trunkUs) {
    // A raised edge where cloth ends: the waistband, and the top's hem where
    // it hangs over what is under it. His tee and his shorts are the same
    // black -- the user asked for exactly that -- so the ONLY thing that can
    // say where one ends and the other begins is this step. Without it the
    // two read as a single black bodysuit.
    const { mat, cloth } = trunkMat(u);
    const band = trunkBand(u);
    const below = trunkBand(u - 0.011);
    const edge = band !== below || band !== trunkBand(u + 0.011);
    const hem = band === MAT.top && below === MAT.legwear;
    const lip = !layered && edge && band !== MAT.skin && (female || band !== MAT.top || hem) ? (hem ? 0.0045 : 0.003) : 0;
    const c = new THREE.Vector3(0, trunkY(u), 0);
    const radii = lowRadii(u, lip);
    const cut = mat === MAT.neck ? clearDelts(c, radii, panelCloth((u - neckFrom) / (0.5 - neckFrom), c, radii)) : cloth;
    const body = ring(c, X, Z, radii, trunkBones(u), mat, cut);
    body.breath = breathAt(u);
    trunk.push(body);
  }
  // Shoulders to neck: the traps, a slope from the shoulder line in to the
  // neck's base -- not a dome. The user, against a photo: "Прекалено му е
  // масивен трапеца"; the old rings held 96/84/64% of the shoulders' width
  // 1.5/3/4.5cm up, a mound the neck sat on. Now 78/55/40% at 1.2/2.6/4cm,
  // with the neck base at 5cm. The straps and the collar run over it.
  const neckA = spec.taper.neck[1], neckB = spec.taper.neck[0];
  const Rx = L.headR * 1.18 * 0.95, Ry = L.headR * 1.18 * 1.06, Rz = L.headR * 1.18 * 0.98;
  const topBones: [number, number][] = [[bi("Spine2"), 1]];
  const domeMat = layered ? MAT.skin : MAT.neck;
  // The nape: the trapezius climbs the back of the neck as two ridges
  // either side of the nuchal furrow, thickest where it meets the
  // shoulders and gone by the skull. A neck that is a plain cone has no
  // back at all, which is what this was. `f` is how strong it is here.
  const neckDef = female ? def * 0.45 : def;
  const napeBulges = (f: number): Bulge[] => {
    if (f <= 0.02 || neckDef <= 0) return [];
    const a = 0.16 * neckA * neckDef * f;
    return [
      { at: back - 0.42, amp: a, width: 0.75 },
      { at: back + 0.42, amp: a, width: 0.75 },
      { at: back, amp: -0.45 * a, width: 0.3 },
    ];
  };
  const dome = [[0.012, 0.78, 0.86, 0.55], [0.026, 0.55, 0.68, 0.75], [0.04, 0.4, 0.55, 0.95]] as const;
  // The tee's crew neck: fabric up to a collar line a little lower in front
  // than behind, cut through the dome's faces by the cloth mask.
  const collar = (c: THREE.Vector3) => (k: number) => {
    const th = (k / N) * Math.PI * 2;
    return (shoulderY + 0.04 - 0.008 * Math.sin(th) - c.y) * 40;
  };
  for (const [dy, kw, kd, nf] of dome) {
    const c = new THREE.Vector3(0, shoulderY + dy, 0);
    const radii = ellipseRadii(W(0.5) * kw, D(0.5) * kd, napeBulges(nf));
    const d = ring(c, X, Z, radii, topBones, domeMat, layered ? undefined : tee ? collar(c) : clearDelts(c, radii, panelCloth(1, c, radii)));
    d.breath = 0.4;
    trunk.push(d);
  }
  // Neck, on up into the head. It carries the nape behind, the two
  // sternocleidomastoid cords in front and, on him, the larynx.
  //
  // The visible neck is the loft between the ring that leaves the traps
  // (+0.05) and the one that meets the skull (+0.068) -- under 4cm, and
  // everything above +0.068 is the head's own cap inside a millimetre or
  // two. Measured on the mesh after putting six rings between +0.068 and
  // the skull: all six landed in a band 1.2mm tall. Rings go between the
  // two ends of the LOFT, and their radii interpolate the loft's own, so
  // the neck's silhouette is the one that was there before.
  const neckBones: [number, number][] = [[bi("Neck"), 1]];
  const neckBulges = (t: number): Bulge[] => {
    // Everything dies away before the skull, or it pokes out of the head.
    const live = 1 - smooth01((t - 0.75) / 0.25);
    const out: Bulge[] = [...napeBulges(live * (1 - smooth01((t - 0.2) / 0.65)))];
    if (neckDef <= 0 || live <= 0.02) return out;
    // The sternocleidomastoid runs from behind the ear down to the notch
    // between the collarbones, so it SWEEPS toward the front as it
    // descends. Two straight vertical ridges read as a pipe, not a neck.
    const scmF = smooth01((t - 0.08) / 0.22) * live;
    if (scmF > 0.02) {
      const off = 0.42 + 0.5 * t;
      const amp = 0.13 * neckA * neckDef * scmF;
      out.push({ at: front - off, amp, width: 0.55 }, { at: front + off, amp, width: 0.55 });
    }
    if (!female) {
      const lar = 0.09 * neckA * def * live * Math.exp(-Math.pow((t - 0.5) / 0.2, 2));
      if (lar > 0.0002) out.push({ at: front, amp: lar, width: 0.4 });
    }
    return out;
  };
  const neckY0 = shoulderY + 0.05, neckY1 = shoulderY + 0.068;
  const baseW = Math.max(W(0.5) * 0.3, neckA * 1.25), baseD = Math.max(D(0.5) * 0.42, neckA * 1.15);
  const neckRad = (t: number): [number, number] => [
    baseW + (neckA * 1.05 - baseW) * t,
    baseD + (neckA * 1.02 - baseD) * t,
  ];
  // Five rings up the loft, not two: the cords sweep across the neck and
  // the nape dies out along it, and neither is a shape two rings hold.
  const neckTs = [0, 0.25, 0.5, 0.75, 1];
  for (let i = 0; i < neckTs.length; i++) {
    const t = neckTs[i]!;
    const [rw, rd] = neckRad(t);
    // The loft used to blend from 0.6 Spine2 at its foot to all Neck at
    // its head across the faces between two rings. Rings inside it have
    // to carry that same blend, or the neck hinges off its own base.
    const share = 0.6 * Math.max(0, 1 - t / 0.75);
    const bones: [number, number][] = share > 0.001 ? [[bi("Spine2"), share], [bi("Neck"), 1 - share]] : neckBones;
    trunk.push(ring(new THREE.Vector3(0, neckY0 + (neckY1 - neckY0) * t, 0), X, Z, ellipseRadii(rw, rd, neckBulges(t)), bones, MAT.skin));
  }
  const skullY = headY - Ry * 0.78;
  trunk.push(ring(new THREE.Vector3(0, (neckY1 + skullY) / 2, 0), X, Z, ellipseRadii(neckA * 0.95, neckA * 0.97, neckBulges(1)), neckBones, MAT.skin));
  const neckTop = ring(new THREE.Vector3(0, skullY, 0), X, Z, ellipseRadii(neckB * 1.02, neckB * 1.05), [[bi("Neck"), 0.5], [bi("Head"), 0.5]], MAT.skin);
  // The neck ends inside the head, which is its own closed shape below:
  // the chin hangs in front of and below where the neck enters.
  trunk.push(neckTop, ...cap(neckTop.c, X, Z, Y, neckTop.radii, 0.03, [[bi("Head"), 1]], MAT.skin, 3));
  b.tube(trunk);

  // Fabric thickness shown at every open edge: the tube starts inside the
  // garment, turns out at the hem, and continues up the outside.
  const LIP = 0.0025;
  if (layered) {
    // The top: his stringer hangs looser toward its hem; her cropped top
    // hugs. Both follow the trunk's own silhouette (bust and lats included)
    // a few millimetres out, and the neckline and straps are cut from the
    // fabric by the cloth mask.
    const hemU = female ? 0.5 - spec.topCover : -0.46;
    // Loose, but not by much: the sweep charges every millimetre of slack
    // against the pads a seated or lying figure rests on.
    const gapAt = (u: number) => (female ? 0.004 : 0.005 + Math.max(0, -0.1 - u) * 0.015);
    const shell = (u: number, gap: number) => {
      const c = new THREE.Vector3(0, trunkY(u), 0);
      const radii = lowRadii(u, gap);
      const base = u >= neckFrom ? panelCloth((u - neckFrom) / (0.5 - neckFrom), c, radii) : undefined;
      const r = ring(c, X, Z, radii, trunkBones(u), MAT.topShell, u > 0.3 ? clearDelts(c, radii, base) : base);
      r.breath = breathAt(u);
      return r;
    };
    const top: Ring[] = [];
    top.push(shell(hemU + 0.012, gapAt(hemU) - LIP));
    top.push(shell(hemU, gapAt(hemU) - LIP));
    top.push(shell(hemU, gapAt(hemU) + LIP));
    for (const u of trunkUs) if (u > hemU + 0.005) top.push(shell(u, gapAt(u)));
    for (const [dy, kw, kd, nf] of dome) {
      const c = new THREE.Vector3(0, shoulderY + dy, 0);
      const radii = ellipseRadii(W(0.5) * kw + 0.005, D(0.5) * kd + 0.005, napeBulges(nf));
      const d = ring(c, X, Z, radii, topBones, MAT.topShell, clearDelts(c, radii, panelCloth(1, c, radii)));
      d.breath = 0.4;
      top.push(d);
    }
    b.tube(top);

    // The legwear's pelvis: his shorts from under the shirt's hem, her
    // leggings from a waistband at the waist, down over the seat to where
    // the legs' own shells take over.
    const waistU = female ? -0.36 : -0.41;
    const legGap = female ? 0.003 : 0.004;
    const pelvis: Ring[] = [];
    const pshell = (u: number, gap: number) =>
      ring(new THREE.Vector3(0, trunkY(u), 0), X, Z, lowRadii(u, gap), trunkBones(u), MAT.legShell);
    if (female) {
      pelvis.push(pshell(waistU + 0.012, legGap - LIP));
      pelvis.push(pshell(waistU, legGap - LIP));
      pelvis.push(pshell(waistU, legGap + LIP));
    } else pelvis.push(pshell(waistU, legGap));
    for (const u of trunkUs) if (u < waistU - 0.005) pelvis.push(pshell(u, legGap));
    for (const drop of seatDrops) {
      const seat = seatRing(drop);
      seat.radii = seat.radii.map((r) => r + legGap);
      seat.mat = MAT.legShell;
      pelvis.push(seat);
    }
    b.tube(pelvis);
  }

  // Head: a sculpted skull rather than an egg. Each ring is the larger of
  // the egg and the jaw ellipsoid the face used to carry as a separate
  // blob (so the stubble shell still fits it), with the occiput drawn out
  // behind, cheekbones, a chin, flattened temples and a little brow
  // bossing above the brows. The eyes, nose, mouth, ears and hair stay
  // where the face group puts them, in front of these surfaces, so every
  // shape here keeps clear of the front between the brows and the mouth.
  const headBones: [number, number][] = [[bi("Head"), 1]];
  const R = L.headR * 1.3;
  const headRadii = skullProfile(L.headR, female);
  const skull: Ring[] = [];
  const headYs = [-0.94, -0.88, -0.78, -0.66, -0.52, -0.38, -0.24, -0.1, 0.05, 0.2, 0.35, 0.5, 0.65, 0.78, 0.88, 0.95];
  skull.push(ring(new THREE.Vector3(0, headY - 0.955 * R, 0), X, Z, headRadii(-0.94).map((r) => r * 0.15), headBones, MAT.skin));
  for (const yr of headYs) skull.push(ring(new THREE.Vector3(0, headY + yr * R, 0), X, Z, headRadii(yr), headBones, MAT.skin));
  skull.push(ring(new THREE.Vector3(0, headY + Ry * 0.998, 0), X, Z, headRadii(0.95).map((r) => r * 0.02), headBones, MAT.skin));
  b.tube(skull);

  // Legs: from inside the pelvis to the ankle, which the shoe covers.
  for (const [side, s] of [["Left", 1], ["Right", -1]] as const) {
    const up = bi(`${side}UpLeg`), lo = bi(`${side}Leg`);
    const x = s * L.hipHalf;
    const [thighB, thighA] = spec.taper.thigh;
    const [shinB, shinA] = spec.taper.shin;
    const rings: Ring[] = [];
    // Blend across the knee over 3.5cm either side, eased, with rings
    // through the blend (below) so a bent knee turns in steps and not at
    // one crease: at 120 degrees of flexion a single 50/50 ring pinched to
    // half its width and the shin's top cut into the thigh.
    // The rings through the blend ride the knee helper bone (aimed along the
    // bisector of thigh and shin) and hand over to the thigh above or the
    // shin below: a thigh/shin blend collapsed the kneecap toward the joint
    // axis at 120 degrees (linear-blend skinning), and the knee vanished.
    const KNEE_BLEND = 0.035;
    const knee = bi(`${side}KneeCap`);
    const legBones = (y: number): [number, number][] => {
      const d = (y - kneeY) / KNEE_BLEND;
      if (d >= 1) return [[up, 1]];
      if (d <= -1) return [[lo, 1]];
      const a = Math.abs(d);
      const s = a * a * (3 - 2 * a);
      if (s <= 0) return [[knee, 1]];
      return [[knee, 1 - s], [d > 0 ? up : lo, s]];
    };
    const hemY = kneeY + 0.03;
    // Under a layered garment the leg is skin; otherwise the legwear is
    // painted on the thigh (and, for her leggings, the whole leg).
    const legWear = layered ? MAT.skin : MAT.legwear;
    // The thigh from where the seat parts: its first ring is the seat's
    // own outline at that height, so the two surfaces meet without a step.
    // The quadriceps is a lobe on the FRONT of the thigh: the back of the
    // thigh is what rests on seats and pads, and a round bulge there sank
    // 5mm into every seat in the sweep.
    const outer = s > 0 ? 0 : Math.PI;
    const thighRing = (y: number, mat: number, extra = 0, shape?: { ru: number; rv: number; quad: number; sweep?: number }) => {
      const t = (hipY - y) / L.thigh;
      const sh = shape ?? thighShape(t);
      const bulges: Bulge[] = [];
      if (sh.quad > 0.0005) bulges.push({ at: front, amp: sh.quad, width: 0.85 });
      if ((sh.sweep ?? 0) > 0.0005) bulges.push({ at: outer, amp: sh.sweep!, width: 0.8 });
      const out = ring(new THREE.Vector3(x, y, 0), X, Z, ellipseRadii(sh.ru + extra, sh.rv + extra, bulges), legBones(y), mat);
      // The top of the thigh shares its inner side with the other leg the
      // way the seat's crotch does, fading out over 7cm below the fold, so
      // the thigh's first ring owns its vertices exactly as the seat's last
      // ring does.
      const g = Math.min(1, Math.max(0, 1 - (hipY - y - SEAT_DROP) / 0.07));
      if (g > 0) {
        const other = s > 0 ? rightLeg : leftLeg;
        out.bonesAt = (k) => {
          const l = leftShare(x + out.radii[k]! * Math.cos((k / N) * Math.PI * 2));
          const o = (s > 0 ? 1 - l : l) * g;
          return o <= 0 ? [[up, 1]] : [[up, 1 - o], [other, o]];
        };
      }
      return out;
    };
    const tSeat = SEAT_DROP / L.thigh;
    rings.push(thighRing(hipY - SEAT_DROP, MAT.legwear));
    rings.push(thighRing(hipY - SEAT_DROP - 0.03, legWear));
    // Dense enough down the thigh that the quadriceps and the outer sweep
    // are curves and not two facets.
    for (const t of [0.55, 0.63, 0.71, 0.79]) if (t > tSeat + 0.03 / L.thigh + 0.04) rings.push(thighRing(hipY - t * L.thigh, legWear));
    const tHem = (hipY - hemY) / L.thigh;
    if (!female && !layered) {
      // The shorts' hem: cloth standing a little proud, then skin.
      rings.push(thighRing(hemY + 0.004, MAT.legwear, 0.004));
      rings.push(thighRing(hemY, MAT.legwear, 0.004));
      rings.push(thighRing(hemY - 0.002, MAT.skin));
    } else {
      rings.push(thighRing(hemY, legWear));
    }
    const kneeMat = female && !layered ? MAT.legwear : MAT.skin;
    rings.push(thighRing(kneeY + 0.022, kneeMat, 0, { ru: thighB * 1.02, rv: thighB * 1.03, quad: 0 }));
    rings.push(thighRing(kneeY + 0.012, kneeMat, 0, { ru: thighB * 1.03, rv: thighB * 1.05, quad: 0 }));
    // The kneecap: a little proud of the front, which is the outside of the
    // bend and the part a squat stretches thin.
    rings.push(ring(new THREE.Vector3(x, kneeY, 0), X, Z, ellipseRadii(thighB * 1.04, thighB * 1.08, [{ at: front, amp: 0.004, width: 1.0 }]), legBones(kneeY), kneeMat));
    rings.push(ring(new THREE.Vector3(x, kneeY - 0.012, 0), X, Z, ellipseRadii(shinA * 1.02, shinA * 1.06), legBones(kneeY - 0.012), kneeMat));
    rings.push(ring(new THREE.Vector3(x, kneeY - 0.024, 0), X, Z, ellipseRadii(shinA * 1.0, shinA * 1.04), legBones(kneeY - 0.024), kneeMat));
    // The calf belly sits HIGH -- the top third of the shin -- and drops
    // away to a bony ankle; that contrast is what reads as a trained leg,
    // where an even swell down the middle read as a soft tube.
    const shinR = (t: number) => {
      const base = shinA + (shinB - shinA) * t;
      // 0.07 + 0.16 x def put 48cm of calf under a 56cm thigh; a real one
      // is 37, and the shape has to come from the two heads at the back,
      // not from inflating the whole shin.
      const calf = 1 + (0.05 + 0.08 * legDef) * Math.exp(-Math.pow((t - 0.26) / 0.18, 2));
      return base * calf;
    };
    // The gastrocnemius has two heads at the back, the inner one fuller and
    // hanging a little lower than the outer.
    const medial = back - s * 0.34, lateral = back + s * 0.34;
    // Starting at 0.16: the knee's own rings run to 24mm below the joint,
    // and a shin ring inside that (t 0.1 = 21mm) folded the tube back on
    // itself -- a hard band across the top of the calf.
    // Which way round the ring the inner side of THIS leg lies: `front +
    // s * PI / 2` is the side facing the other leg, on both.
    const inward = (a: number) => front + s * a;
    // The lower leg's own shapes, on top of the two calf heads. A shin is
    // not a cone: it has a bone up the front you can feel, the tibialis
    // beside it, and a tendon at the back that pulls the whole section in
    // to a flat cord above the heel. That last one is the shape the eye
    // reads from the side, and without it the calf just faded out.
    for (const t of [0.16, 0.26, 0.36, 0.48, 0.62, 0.72, 0.8, 0.88, 0.95]) {
      const y = kneeY - t * L.shin;
      const r = shinR(t);
      const heads: Bulge[] = [
        { at: medial, amp: 0.075 * legDef * r * Math.exp(-Math.pow((t - 0.32) / 0.2, 2)), width: 0.95 },
        { at: lateral, amp: 0.055 * legDef * r * Math.exp(-Math.pow((t - 0.24) / 0.18, 2)), width: 0.85 },
      ];
      // The crest of the tibia, a hair off the midline toward the inside.
      heads.push({ at: inward(0.16), amp: 0.045 * r * smooth01((t - 0.05) / 0.2), width: 0.34 });
      // The tibialis anterior, outside the crest and highest on the shin.
      const tib = 0.055 * legDef * r * Math.exp(-Math.pow((t - 0.34) / 0.26, 2));
      if (tib > 0.0002) heads.push({ at: inward(-0.6), amp: tib, width: 0.8 });
      // The Achilles: the back draws IN to a cord above the heel.
      const ach = 0.13 * r * smooth01((t - 0.55) / 0.32);
      if (ach > 0.0002) heads.push({ at: back, amp: -ach, width: 1.15 });
      // The two ankle bones: the inner one higher and forward, the outer
      // lower and further back.
      const mal = 0.11 * r * Math.exp(-Math.pow((t - 0.9) / 0.09, 2));
      const lat = 0.1 * r * Math.exp(-Math.pow((t - 0.96) / 0.08, 2));
      if (mal > 0.0002) heads.push({ at: inward(1.25), amp: mal, width: 0.55 });
      if (lat > 0.0002) heads.push({ at: inward(-1.75), amp: lat, width: 0.5 });
      rings.push(ring(new THREE.Vector3(x, y, 0), X, Z, ellipseRadii(r * 0.95, r * 1.06, heads), legBones(y), kneeMat));
    }
    const ankle = ring(new THREE.Vector3(x, ankleY, 0), X, Z, ellipseRadii(shinB, shinB * 1.05), [[lo, 1]], kneeMat);
    // A short cap: the shin ends inside the sneaker, and a longer one poked
    // through the floor when the shin leaned.
    rings.push(ankle, ...cap(ankle.c, X, Z, new THREE.Vector3(0, -1, 0), ankle.radii, 0.005, [[lo, 1]], kneeMat, 2));
    b.tube(rings);

    if (layered) {
      // The leg's garment shell: his shorts flare from the hip to an open
      // hem above the knee; her leggings hug the whole leg to the ankle.
      const shellRing = (y: number, gap: number) => {
        const t = (hipY - y) / L.thigh;
        const sh = thighShape(t);
        const shb: Bulge[] = [];
        if (sh.quad > 0.0005) shb.push({ at: front, amp: sh.quad, width: 0.85 });
        if (sh.sweep > 0.0005) shb.push({ at: outer, amp: sh.sweep, width: 0.8 });
        return ring(new THREE.Vector3(x, y, 0), X, Z, ellipseRadii(sh.ru + gap, sh.rv + gap, shb), legBones(y), MAT.legShell);
      };
      const leg: Ring[] = [];
      leg.push(shellRing(hipY - SEAT_DROP, 0.004));
      if (!female) {
        for (const t of [0.3, 0.42, 0.55, 0.7]) leg.push(shellRing(hipY - t * L.thigh, 0.004 + 0.006 * t));
        const g = 0.004 + 0.006 * tHem;
        leg.push(shellRing(hemY, g + LIP));
        leg.push(shellRing(hemY, g - LIP));
        leg.push(shellRing(hemY + 0.012, g - LIP));
      } else {
        for (const t of [0.3, 0.42, 0.55, 0.7]) leg.push(shellRing(hipY - t * L.thigh, 0.003));
        leg.push(shellRing(hemY, 0.003));
        leg.push(ring(new THREE.Vector3(x, kneeY + 0.012, 0), X, Z, ellipseRadii(thighB * 1.02 + 0.003, thighB * 1.02 + 0.003), legBones(kneeY + 0.012), MAT.legShell));
        leg.push(ring(new THREE.Vector3(x, kneeY, 0), X, Z, ellipseRadii(thighB * 1.04 + 0.003, thighB * 1.1 + 0.003), legBones(kneeY), MAT.legShell));
        leg.push(ring(new THREE.Vector3(x, kneeY - 0.012, 0), X, Z, ellipseRadii(shinA + 0.003, shinA * 1.06 + 0.003), legBones(kneeY - 0.012), MAT.legShell));
        for (const t of [0.12, 0.3, 0.45, 0.6, 0.8, 0.93]) {
          const y = kneeY - t * L.shin;
          leg.push(ring(new THREE.Vector3(x, y, 0), X, Z, ellipseRadii(shinR(t) * 0.96 + 0.003, shinR(t) * 1.08 + 0.003, [{ at: back, amp: 0.004 * legDef * Math.exp(-Math.pow((t - 0.3) / 0.25, 2)), width: 1.2 }]), legBones(y), MAT.legShell));
        }
        leg.push(ring(new THREE.Vector3(x, ankleY + 0.004, 0), X, Z, ellipseRadii(shinB + 0.003, shinB * 1.05 + 0.003), [[lo, 1]], MAT.legShell));
      }
      b.tube(leg);
    }
  }

  // Arms: the deltoid cap inside the trunk, out along the arm to the wrist
  // band and, unless a fist replaces it, an open hand.
  for (const [side, s] of [["Left", 1], ["Right", -1]] as const) {
    const clav = bi(`${side}Shoulder`), arm = bi(`${side}Arm`), fore = bi(`${side}ForeArm`), hand = bi(`${side}Hand`);
    const x0 = s * L.shoulderHalf;
    const elbowX = x0 + s * L.upperArm;
    const wristX = elbowX + s * L.forearm;
    const [uaB, uaA] = spec.taper.upperArm;
    const [faB, faA] = spec.taper.forearm;
    const delt = spec.delt * spec.style.shoulders;
    const rings: Ring[] = [];
    // The arm's rings sit a hair below the joint line near the shoulder, so
    // the deltoid rounds off the shoulder's slope rather than standing on it.
    const at = (d: number) => new THREE.Vector3(x0 + s * d, shoulderY - 0.006 * Math.max(0, 1 - d / 0.06), 0);
    // Ring basis for a tube along X: u = up, v = front.
    const armRing = (c: THREE.Vector3, ru: number, rv: number, bones: [number, number][], mat: number = MAT.skin, bulges: Bulge[] = []) =>
      ring(c, Y, Z, ellipseRadii(ru, rv, bulges), bones, mat);
    const dir = new THREE.Vector3(s, 0, 0);
    // The tee's sleeve: fabric over the delt and the top of the arm to a
    // hem standing a little proud, then skin.
    const sleeveD = 0.42 * L.upperArm;
    const armMat = (d: number) => (tee && d <= sleeveD ? MAT.top : MAT.skin);
    // The bones the rings near the joint ride: the clavicle's half at the
    // joint line, all the arm's by 45mm down it. A ring that jumped from
    // half the clavicle to all the arm inside a centimetre creased when
    // the arm went overhead.
    const armBones = (d: number): [number, number][] => {
      const k = Math.min(1, Math.max(0, d / 0.045));
      const w = k * k * (3 - 2 * k);
      return w >= 1 ? [[arm, 1]] : [[clav, (1 - w) * 0.5], [arm, 1 - (1 - w) * 0.5]];
    };
    // An arm reads as trained through WHERE its mass sits, not how thick
    // the tube is: the biceps a short belly on the front, peaking past the
    // middle, and the triceps a longer one behind it, both dropping away
    // into a bony elbow. Hers carries the same shapes at a lower relief.
    const armDef = female ? def * 0.6 : def;
    const uaR = (t: number) => uaA + (uaB - uaA) * t;
    const uaBulges = (t: number): Bulge[] => {
      const r = uaR(t);
      const out: Bulge[] = [];
      // The deltoid is not a ball sitting on the shoulder: it caps the
      // joint, wraps the front and the back, and dies away into the arm a
      // third of the way down -- and there is NONE underneath, where the
      // armpit is. So it is a lobe over the top of the arm's own rings,
      // fading along the arm, with the underside cut away; a constant-
      // radius sphere for the first 25mm and then the bare arm left a hard
      // rim where the cap stopped.
      const dl = 0.9 * Math.max(0.12 * uaA, delt - uaA) * Math.exp(-Math.pow(t / 0.3, 2));
      if (dl > 0.0004) {
        out.push({ at: 0, amp: dl, width: 2.1 });
        // Its three heads stand out of that cap: the REAR one is what a
        // shoulder shows from behind, and a single smooth dome there read
        // as a ball on the arm. The cap itself is 10% lower to pay for
        // them, so the shoulder is no wider than before -- only shaped.
        out.push({ at: back + 0.72, amp: 0.3 * dl, width: 0.75 });
        out.push({ at: front - 0.72, amp: 0.22 * dl, width: 0.75 });
      }
      const pit = 0.2 * r * Math.exp(-Math.pow(t / 0.22, 2));
      if (pit > 0.0004) out.push({ at: Math.PI, amp: -pit, width: 1.1 });
      const bic = 0.15 * armDef * r * Math.exp(-Math.pow((t - 0.52) / 0.24, 2));
      const tri = 0.13 * armDef * r * Math.exp(-Math.pow((t - 0.4) / 0.3, 2));
      if (bic > 0.0004) out.push({ at: front, amp: bic, width: 1.0 });
      if (tri > 0.0004) out.push({ at: back, amp: tri, width: 1.15 });
      return out;
    };
    // The shoulder's own section, deltoid and all: the cap over the joint
    // takes it too, so the cap and the arm are one surface.
    const shoulderRadii = ellipseRadii(uaR(0), uaR(0) * 1.05, uaBulges(0));
    rings.push(...cap(at(0), Y, Z, dir.clone().negate(), shoulderRadii, 0.03, [[clav, 1]], armMat(0), 4).reverse());
    rings.push(ring(at(0), Y, Z, shoulderRadii, armBones(0), armMat(0)));
    let hemmed = !tee;
    // Dense over the deltoid, where the section changes fastest.
    for (const t of [0.08, 0.16, 0.25, 0.35, 0.46, 0.58, 0.7, 0.82]) {
      const d = t * L.upperArm;
      if (!hemmed && d > sleeveD) {
        const ts = sleeveD / L.upperArm;
        const rh = uaR(ts);
        rings.push(armRing(at(sleeveD), rh + 0.003, rh * 1.05 + 0.003, armBones(sleeveD), MAT.top, uaBulges(ts)));
        rings.push(armRing(at(sleeveD + 0.002), rh, rh * 1.05, armBones(sleeveD), MAT.skin, uaBulges(ts)));
        hemmed = true;
      }
      const r = uaR(t);
      rings.push(armRing(at(d), r, r * 1.05, armBones(d), armMat(d), uaBulges(t)));
    }
    // The elbow rides its helper bone the way the knee does (see legBones).
    const elbow = bi(`${side}ElbowCap`);
    const elbowBones = (d: number): [number, number][] => {
      const k = (d - L.upperArm) / 0.03;
      if (k <= -1) return [[arm, 1]];
      if (k >= 1) return [[fore, 1]];
      const a = Math.abs(k);
      const s = a * a * (3 - 2 * a);
      if (s <= 0) return [[elbow, 1]];
      return [[elbow, 1 - s], [k < 0 ? arm : fore, s]];
    };
    rings.push(armRing(at(L.upperArm - 0.02), uaB * 1.02, uaB * 1.02, elbowBones(L.upperArm - 0.02)));
    rings.push(armRing(at(L.upperArm - 0.01), uaB * 1.03, uaB * 1.01, elbowBones(L.upperArm - 0.01)));
    rings.push(armRing(at(L.upperArm), uaB * 1.04, uaB * 1.0, elbowBones(L.upperArm)));
    rings.push(armRing(at(L.upperArm + 0.01), (uaB * 1.02 + faA) / 2, (uaB + faA * 0.98) / 2, elbowBones(L.upperArm + 0.01)));
    rings.push(armRing(at(L.upperArm + 0.02), faA * 1.0, faA * 0.98, elbowBones(L.upperArm + 0.02)));
    // The forearm's mass is all in its top third, on the thumb side (the
    // front-upper quarter in a T-pose), and the wrist is bone.
    const faR = (t: number) => faA + (faB - faA) * t;
    const faBulges = (t: number): Bulge[] => {
      const amp = 0.09 * armDef * faR(t) * Math.exp(-Math.pow((t - 0.18) / 0.24, 2));
      if (amp <= 0.0004) return [];
      return [
        { at: front - 0.45, amp, width: 1.25 },
        { at: back + 0.5, amp: amp * 0.55, width: 1.05 },
      ];
    };
    // Starting at 0.18: the elbow's own rings run 20mm past the joint, and
    // a forearm ring inside that (t 0.12 = 17mm) folded the tube back --
    // the seam that crossed the forearm below the elbow.
    for (const t of [0.18, 0.3, 0.42, 0.55, 0.68, 0.82]) {
      rings.push(armRing(at(L.upperArm + t * L.forearm), faR(t), faR(t) * 1.02, [[fore, 1]], MAT.skin, faBulges(t)));
    }
    // Wristband: a raised ring of the accent colour just above the wrist.
    const wristD = L.upperArm + L.forearm;
    const bandR = faB * 1.08;
    rings.push(armRing(at(wristD - 0.03), faB * 1.08, faB * 1.08, [[fore, 1]]));
    rings.push(armRing(at(wristD - 0.028), bandR + 0.003, bandR + 0.003, [[fore, 1]], MAT.band));
    rings.push(armRing(at(wristD - 0.008), bandR + 0.003, bandR + 0.003, [[fore, 1]], MAT.band));
    // The wrist is FLAT: about 5.7cm across and 3.5cm through, not the
    // round section the forearm ends in. The bump on its back-and-pinky
    // corner is the head of the ulna, the one landmark a wrist has.
    rings.push(armRing(at(wristD - 0.006), faB * 0.94, faB * 1.1, [[fore, 0.85], [hand, 0.15]]));
    const ulna: Bulge[] = [{ at: -0.85, amp: 0.1 * faB, width: 0.7 }];
    const wrist = armRing(at(wristD), faB * 0.8, faB * 1.18, [[fore, 0.5], [hand, 0.5]], MAT.skin, ulna);
    rings.push(wrist);
    if (spec.gripping) {
      rings.push(...cap(wrist.c, Y, Z, dir, wrist.radii, 0.006, [[hand, 1]], MAT.skin, 2));
    } else {
      // An open hand, palm down in the T-pose: a flat palm over the first
      // 55% of the hand's length, then four fingers and a thumb. The
      // fingers droop a little and the outer ones are shorter, so a hand on
      // the floor or held out reads as a hand, not a paddle.
      const hb: [number, number][] = [[hand, 1]];
      // The hand bone runs from the wrist to the MIDDLE KNUCKLE, so it is
      // the palm's own length and the fingers reach another 82% of it
      // beyond. The palm used to stop at 55% of the bone and the fingers
      // were crammed into the remaining 45%, which is why the hand read as
      // a wide paddle with five stubs: 11cm across, 10cm long, 5cm thick.
      // It is 8.7 x 19cm and 3cm thick on a 180cm man.
      const palmEnd = L.hand;
      const halfW = spec.hand * 1.42;
      const palmT = spec.hand * 0.5;
      // The two pads that make a palm a palm instead of a plate: the
      // thenar at the thumb's root and the hypothenar along the pinky's
      // edge, both on the PALM side, plus the knuckles standing on the
      // BACK at the far end. (Angle 0 is +Y, the back of a palm-down hand;
      // PI is the palm; PI/2 is the thumb side.)
      const palmBulges = (t: number): Bulge[] => {
        const out: Bulge[] = [];
        const thenar = 0.34 * palmT * Math.exp(-Math.pow((t - 0.45) / 0.4, 2));
        if (thenar > 0.0002) out.push({ at: Math.PI - 0.62, amp: thenar, width: 0.9 });
        const hypo = 0.26 * palmT * Math.exp(-Math.pow((t - 0.55) / 0.45, 2));
        if (hypo > 0.0002) out.push({ at: Math.PI + 0.55, amp: hypo, width: 0.8 });
        const knuck = 0.3 * palmT * smooth01((t - 0.62) / 0.38);
        if (knuck > 0.0002) out.push({ at: 0, amp: knuck, width: 1.5 });
        return out;
      };
      const palmRing = (t: number, ru: number, rv: number, bones = hb) =>
        armRing(at(wristD + palmEnd * t), ru, rv, bones, MAT.skin, palmBulges(t));
      rings.push(palmRing(0.06, spec.hand * 0.52, spec.hand * 0.98, [[fore, 0.15], [hand, 0.85]]));
      rings.push(palmRing(0.3, palmT * 1.02, halfW * 0.88));
      rings.push(palmRing(0.62, palmT * 1.04, halfW));
      rings.push(palmRing(0.87, palmT * 1.0, halfW * 0.99));
      // The knuckle line is a curve with webbing between the fingers, not
      // a square corner: the last ring draws in and the cap that closes it
      // is as long as the hand is thick.
      const palm = palmRing(1, palmT * 0.9, halfW * 0.93);
      rings.push(palm, ...cap(palm.c, Y, Z, dir, palm.radii, palmT * 0.8, hb, MAT.skin, 3));
      b.tube(rings);
      // A finger: a tapered tube along a curved path -- a quadratic through
      // `ctrl` -- so a hand at rest curls and the thumb bends at its own
      // knuckle instead of being two straight tubes butted end to end. The
      // frame is rebuilt at every ring, or a bent tube shears along it.
      const finger = (from: THREE.Vector3, ctrl: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) => {
        const along = (t: number) => from.clone().lerp(ctrl, t).lerp(ctrl.clone().lerp(to, t), t);
        const frameAt = (t: number) => {
          const p = along(t);
          const axis = along(Math.min(1, t + 0.03)).sub(along(Math.max(0, t - 0.03))).normalize();
          const v = new THREE.Vector3().crossVectors(Y, axis).normalize();
          return { p, axis, u: new THREE.Vector3().crossVectors(axis, v).normalize(), v };
        };
        const fr: Ring[] = [];
        for (const t of [0, 0.26, 0.52, 0.78, 1]) {
          const f = frameAt(t);
          const r = r0 + (r1 - r0) * t;
          fr.push(ring(f.p, f.u, f.v, ellipseRadii(r * 0.92, r), hb, MAT.skin));
        }
        const e = frameAt(1);
        fr.push(...cap(e.p, e.u, e.v, e.axis, ellipseRadii(r1 * 0.92, r1), r1 * 0.85, hb, MAT.skin, 2));
        b.tube(fr);
      };
      // Index, middle, ring, little: their lengths, their thicknesses and
      // how far each knuckle sits BACK from the middle one. All four used
      // one knuckle line, two lengths and one radius, which is what made
      // them read as a fork.
      const digits = [
        { z: 0.66, len: 0.93, rad: 0.98, back: 0.06 },
        { z: 0.23, len: 1.0, rad: 1.0, back: 0 },
        { z: -0.19, len: 0.95, rad: 0.93, back: 0.05 },
        { z: -0.62, len: 0.76, rad: 0.79, back: 0.15 },
      ];
      const fingerLen = L.hand * 0.82;
      const fr0 = spec.hand * 0.29, fr1 = spec.hand * 0.245;
      for (const d of digits) {
        const z = d.z * halfW;
        const root = new THREE.Vector3(x0 + s * (wristD + palmEnd - L.hand * d.back), shoulderY, z);
        const reach = fingerLen * d.len;
        const tipP = new THREE.Vector3(root.x + s * reach, shoulderY - reach * 0.3, z * 0.9);
        const ctrl = root.clone().lerp(tipP, 0.5);
        ctrl.y -= reach * 0.16;
        finger(root, ctrl, tipP, fr0 * d.rad, fr1 * d.rad);
      }
      // The thumb leaves the palm's thumb-side edge near the wrist and
      // bends out ahead of the fingers, its own knuckle the control point
      // of the curve.
      const thumbRoot = new THREE.Vector3(x0 + s * (wristD + L.hand * 0.16), shoulderY - palmT * 0.35, halfW * 0.66);
      const thumbKnee = new THREE.Vector3(x0 + s * (wristD + L.hand * 0.66), shoulderY - palmT * 0.95, halfW * 1.24);
      const thumbTip = new THREE.Vector3(x0 + s * (wristD + L.hand * 1.02), shoulderY - palmT * 1.5, halfW * 1.24);
      finger(thumbRoot, thumbKnee, thumbTip, spec.hand * 0.37, spec.hand * 0.26);
      continue;
    }
    b.tube(rings);
  }

  const geometry = b.geometry();
  // The body's materials are its own clones: the breath is injected into
  // them, and the face, sneakers and equipment share the originals.
  const breath = { value: 0 };
  const mesh = new THREE.SkinnedMesh(geometry, [
    breathing(mats.skin.clone(), breath),
    breathing(mats.top.clone(), breath),
    breathing(mats.legwear.clone(), breath),
    mats.band,
    breathing(necklineMaterial(mats.skin, mats.top), breath),
    breathing(shellMaterial(mats.top), breath),
    breathing(shellMaterial(mats.legwear), breath),
  ]);
  mesh.castShadow = true;
  mesh.customDepthMaterial = breathing(shadowMaterial(), breath);
  mesh.frustumCulled = false;
  const skeleton = new THREE.Skeleton(bones);
  const root = new THREE.Group();
  root.add(hips);
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(skeleton, mesh.matrixWorld);
  return { root, mesh, breath };
}
