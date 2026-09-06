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
export const BODY_STYLE_DEFAULT: BodyStyle = { definition: 1, shoulders: 1.18, chest: 1.08, layered: false };

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
      const bones = r.bones.slice(0, 4);
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
  const jaw = female ? { a: 0.64, b: 0.5, c: 0.66, cy: -0.4, cz: 0.06 } : { a: 0.72, b: 0.52, c: 0.7, cy: -0.42, cz: 0.08 };
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
      const egg = eggK > 0 ? ((Rx * Rz) / Math.sqrt(Rz * Rz * c * c + Rx * Rx * s * s)) * eggK : 0;
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
      const chin = (female ? 0.02 : 0.03) * g(yr, -0.62, 0.14) * lobe(front, 0.5);
      const brow = 0.025 * g(yr, 0.5, 0.12) * lobe(front, 1.0);
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
export function buildHair(headR: number, female: boolean, material: THREE.Material): THREE.Mesh {
  const R = headR * 1.3;
  const skull = skullProfile(headR, female);
  const front = Math.PI / 2;
  // Height of the hairline around the head, in R: open forehead, dipping at
  // the temples, running down behind the ears to the nape.
  const hairline = (t: number): number => {
    let d = Math.abs(t - front);
    d = Math.min(d, Math.PI * 2 - d); // 0 at the front, PI at the back
    // The nape line runs nearly level: a point there read as a widow's
    // peak at the back of the neck.
    const pts: [number, number][] = female
      ? [[0, 0.56], [0.6, 0.5], [1.05, 0.3], [1.5, 0.16], [2.0, -0.12], [2.5, -0.3], [Math.PI, -0.34]]
      : [[0, 0.54], [0.55, 0.47], [1.0, 0.22], [1.5, 0.0], [2.0, -0.14], [2.5, -0.24], [Math.PI, -0.27]];
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
    const top = Math.min(1, Math.max(0, (yr - 0.25) / 0.4)); // 0 at the sides, 1 on top
    if (female) return 0.05 + 0.03 * top;
    // The fade: tight at the sides and back, the crop standing up on top and
    // sweeping forward, with soft ridges across it.
    const sweep = d < 1.2 ? 0.05 * (1 - d / 1.2) * top : 0;
    const ridges = 0.012 * top * Math.sin(t * 5 + yr * 9);
    return 0.018 + 0.09 * top + sweep + ridges;
  };
  const b = new Builder();
  const rings: Ring[] = [];
  // Dense where the hairline runs, so its diagonal over the temple is a
  // clean line and not a staircase of whole quads.
  const ys: number[] = [];
  for (let y = -0.45; y <= 0.6; y += 0.05) ys.push(+y.toFixed(3));
  ys.push(0.68, 0.76, 0.83, 0.89, 0.94, 0.97);
  for (const yr of ys) {
    const base = skull(yr);
    const radii: number[] = [];
    const mask: number[] = [];
    for (let k = 0; k < N; k++) {
      const t = (k / N) * Math.PI * 2;
      const line = hairline(t);
      // Feather the thickness to nothing over the last bit above the
      // hairline, so the edge lies flush with the skin; below it the shell
      // tucks a hair inside the skull and the mask removes it.
      const above = yr - line;
      const feather = Math.min(1, Math.max(0, above / 0.12));
      radii.push(base[k]! + R * (above > 0 ? thickness(yr, t) * feather : -0.01));
      mask.push(above * 20);
    }
    rings.push(ring(new THREE.Vector3(0, yr * R, 0), X, Z, radii, [[0, 1]], MAT.topShell, (k) => mask[k]!));
  }
  // Close the crown.
  const crown = skull(0.97).map((r) => r * 0.02);
  rings.push(ring(new THREE.Vector3(0, 0.99 * R, 0), X, Z, crown, [[0, 1]], MAT.topShell, () => 1));
  b.tube(rings);
  const geometry = b.geometry();
  geometry.deleteAttribute("skinIndex");
  geometry.deleteAttribute("skinWeight");
  const mesh = new THREE.Mesh(geometry, shellMaterial(material));
  mesh.castShadow = true;
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
    const hand = bone(`mixamorig${side}Hand`, fore, s * L.forearm, 0, 0);
    bone(`mixamorig${side}HandMiddle1`, hand, s * L.hand, 0, 0);
    const upLeg = bone(`mixamorig${side}UpLeg`, hips, s * L.hipHalf, 0, 0);
    const leg = bone(`mixamorig${side}Leg`, upLeg, 0, -L.thigh, 0);
    const foot = bone(`mixamorig${side}Foot`, leg, 0, -L.shin, 0);
    bone(`mixamorig${side}ToeBase`, foot, 0, -ankleY * 0.6, 0.08);
  }
  hips.updateMatrixWorld(true);
  const bi = (name: string) => index.get(`mixamorig${name}`)!;

  // --- Rings --------------------------------------------------------------
  const b = new Builder();
  const W = (u: number) => profileAt(spec.trunkProfile, u) * 1.45 * spec.trunkW * (u > 0 ? spec.style.chest : 1);
  const D = (u: number) => profileAt(spec.trunkProfile, u) * 0.9 * spec.trunkD;
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
  const trunkMat = (u: number): { mat: number; cloth?: (k: number) => number } => {
    if (layered) return { mat: trunkBand(u) === MAT.legwear ? MAT.legwear : MAT.skin };
    const band = trunkBand(u);
    if (band !== MAT.top || u < neckFrom) return { mat: band };
    return { mat: MAT.neck, cloth: strapCloth((u - neckFrom) / (0.5 - neckFrom)) };
  };
  const front = Math.PI / 2;
  const back = -Math.PI / 2;
  const trunkBulges = (u: number): Bulge[] => {
    const out: Bulge[] = [];
    // Chest: her bust, his pectorals -- either side of the midline, peaking
    // a little above the middle of the trunk and fading out above and below.
    const chestF = Math.exp(-Math.pow((u - 0.26) / 0.13, 2));
    if (chestF > 0.05) {
      // His pectorals stay modest: a prone figure rests its chest on a pad
      // or the floor, and every millimetre here is a millimetre sunk in.
      const amp = female ? 0.015 * chestF : 0.008 * def * chestF;
      const spread = female ? 0.48 : 0.5;
      out.push({ at: front - spread, amp, width: 0.75 }, { at: front + spread, amp, width: 0.75 });
    }
    // Her glutes, on the back of the pelvis.
    if (female) {
      const gluteF = Math.exp(-Math.pow((u + 0.46) / 0.16, 2));
      if (gluteF > 0.05) out.push({ at: back - 0.58, amp: 0.013 * gluteF, width: 0.85 }, { at: back + 0.58, amp: 0.013 * gluteF, width: 0.85 });
    }
    // Lats: a little width high on the back, with definition.
    const latF = Math.exp(-Math.pow((u - 0.2) / 0.2, 2));
    if (!female && def > 0) out.push({ at: 0, amp: 0.009 * def * latF, width: 0.9 }, { at: Math.PI, amp: 0.009 * def * latF, width: 0.9 });
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
  const pelvisDrops = [[0.045, 0.5], [0.032, 0.8], [0.018, 0.93], [0.006, 0.99]] as const;
  for (const [drop, k] of pelvisDrops) {
    const bulges = trunkBulges(-0.5).map((bg) => ({ ...bg, amp: bg.amp * k }));
    trunk.push(ring(new THREE.Vector3(0, hipY - drop, 0), X, Z, ellipseRadii(W(-0.5) * k, D(-0.5) * k, bulges), pelvisBones, legMat));
  }
  const trunkUs = [-0.5, -0.44, -0.42, -0.41, -0.36, -0.35, -0.3, -0.22, -0.12, -0.05, -0.04, 0.02, 0.1, 0.18, 0.26, 0.34, 0.42, 0.5];
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
    let ru = W(u), rv = D(u);
    // A raised edge where cloth ends: the waistband and the top's hem (his
    // shirt hangs over the shorts, so its own lower edge stays flat).
    const { mat, cloth } = trunkMat(u);
    const band = trunkBand(u);
    const edge = band !== trunkBand(u - 0.011) || band !== trunkBand(u + 0.011);
    if (!layered && edge && band !== MAT.skin && !(band === MAT.top && !female)) {
      ru += 0.003;
      rv += 0.003;
    }
    const c = new THREE.Vector3(0, trunkY(u), 0);
    const radii = ellipseRadii(ru, rv, trunkBulges(u));
    const cut = mat === MAT.neck ? clearDelts(c, radii, panelCloth((u - neckFrom) / (0.5 - neckFrom), c, radii)) : cloth;
    const body = ring(c, X, Z, radii, trunkBones(u), mat, cut);
    body.breath = breathAt(u);
    trunk.push(body);
  }
  // Shoulders to neck: the traps, a dome as tall as the mannequin's was
  // (its trunk cap was a 6cm sphere), so the neck reads as a neck and not
  // a stalk. The straps run over it.
  const neckA = spec.taper.neck[1], neckB = spec.taper.neck[0];
  const Rx = L.headR * 1.18 * 0.95, Ry = L.headR * 1.18 * 1.06, Rz = L.headR * 1.18 * 0.98;
  const topBones: [number, number][] = [[bi("Spine2"), 1]];
  const domeMat = layered ? MAT.skin : MAT.neck;
  const dome = [[0.015, 0.93, 0.94], [0.03, 0.8, 0.84], [0.045, 0.6, 0.68]] as const;
  for (const [dy, kw, kd] of dome) {
    const c = new THREE.Vector3(0, shoulderY + dy, 0);
    const radii = ellipseRadii(W(0.5) * kw, D(0.5) * kd);
    const d = ring(c, X, Z, radii, topBones, domeMat, layered ? undefined : clearDelts(c, radii, panelCloth(1, c, radii)));
    d.breath = 0.4;
    trunk.push(d);
  }
  trunk.push(ring(new THREE.Vector3(0, shoulderY + 0.058, 0), X, Z, ellipseRadii(Math.max(W(0.5) * 0.38, neckA * 1.3), Math.max(D(0.5) * 0.5, neckA * 1.2)), [[bi("Spine2"), 0.6], [bi("Neck"), 0.4]], MAT.skin));
  // Neck, on up into the head.
  const neckBones: [number, number][] = [[bi("Neck"), 1]];
  trunk.push(ring(new THREE.Vector3(0, shoulderY + 0.068, 0), X, Z, ellipseRadii(neckA * 1.05, neckA * 1.02), neckBones, MAT.skin));
  trunk.push(ring(new THREE.Vector3(0, (shoulderY + 0.068 + headY - Ry * 0.78) / 2, 0), X, Z, ellipseRadii(neckA * 0.95, neckA * 0.97), neckBones, MAT.skin));
  const neckTop = ring(new THREE.Vector3(0, headY - Ry * 0.78, 0), X, Z, ellipseRadii(neckB * 1.02, neckB * 1.05), [[bi("Neck"), 0.5], [bi("Head"), 0.5]], MAT.skin);
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
      const radii = ellipseRadii(W(u) + gap, D(u) + gap, trunkBulges(u));
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
    for (const [dy, kw, kd] of dome) {
      const c = new THREE.Vector3(0, shoulderY + dy, 0);
      const radii = ellipseRadii(W(0.5) * kw + 0.005, D(0.5) * kd + 0.005);
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
      ring(new THREE.Vector3(0, trunkY(u), 0), X, Z, ellipseRadii(W(u) + gap, D(u) + gap, trunkBulges(u)), trunkBones(u), MAT.legShell);
    if (female) {
      pelvis.push(pshell(waistU + 0.012, legGap - LIP));
      pelvis.push(pshell(waistU, legGap - LIP));
      pelvis.push(pshell(waistU, legGap + LIP));
    } else pelvis.push(pshell(waistU, legGap));
    for (const u of trunkUs) if (u < waistU - 0.005) pelvis.push(pshell(u, legGap));
    for (const [drop, k] of pelvisDrops) {
      const bulges = trunkBulges(-0.5).map((bg) => ({ ...bg, amp: bg.amp * k }));
      pelvis.push(ring(new THREE.Vector3(0, hipY - drop, 0), X, Z, ellipseRadii(W(-0.5) * k + legGap, D(-0.5) * k + legGap, bulges), pelvisBones, MAT.legShell));
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
    // Blend across the knee over 3cm either side.
    const legBones = (y: number): [number, number][] => {
      const d = (y - kneeY) / 0.03;
      if (d >= 1) return [[up, 1]];
      if (d <= -1) return [[lo, 1]];
      const w = 0.5 + 0.5 * d;
      return [[up, w], [lo, 1 - w]];
    };
    const hemY = kneeY + 0.03;
    // Under a layered garment the leg is skin; otherwise the legwear is
    // painted on the thigh (and, for her leggings, the whole leg).
    const legWear = layered ? MAT.skin : MAT.legwear;
    const thighR = (t: number) => {
      // t: 0 at the hip, 1 at the knee. Quads sweep out a little below the
      // hip, then taper to the knee.
      const base = thighA + (thighB - thighA) * t;
      const quad = 1 + 0.03 * def * Math.exp(-Math.pow((t - 0.35) / 0.3, 2));
      return base * quad;
    };
    // The quadriceps is a lobe on the FRONT of the thigh: the back of the
    // thigh is what rests on seats and pads, and a round bulge there sank
    // 5mm into every seat in the sweep.
    // Her legs carry half the muscle relief: the same quads and calves as
    // his read as too much leg against her narrower trunk.
    const legDef = female ? def * 0.5 : def;
    const thighRing = (y: number, rr: number, mat: number, extra = 0) => {
      const t = (hipY - y) / L.thigh;
      const quad = 0.09 * legDef * rr * Math.exp(-Math.pow((t - 0.35) / 0.3, 2));
      return ring(new THREE.Vector3(x, y, 0), X, Z, ellipseRadii(rr + extra, rr + extra, quad > 0.0005 ? [{ at: front, amp: quad, width: 1.1 }] : []), legBones(y), mat);
    };
    rings.push(thighRing(hipY + 0.03, thighA * 0.96, MAT.legwear));
    rings.push(thighRing(hipY, thighR(0), MAT.legwear));
    for (const t of [0.12, 0.25, 0.4, 0.55, 0.7]) rings.push(thighRing(hipY - t * L.thigh, thighR(t), legWear));
    const tHem = (hipY - hemY) / L.thigh;
    if (!female && !layered) {
      // The shorts' hem: cloth standing a little proud, then skin.
      rings.push(thighRing(hemY + 0.004, thighR(tHem), MAT.legwear, 0.004));
      rings.push(thighRing(hemY, thighR(tHem), MAT.legwear, 0.004));
      rings.push(thighRing(hemY - 0.002, thighR(tHem), MAT.skin));
    } else {
      rings.push(thighRing(hemY, thighR(tHem), legWear));
    }
    const kneeMat = female && !layered ? MAT.legwear : MAT.skin;
    rings.push(thighRing(kneeY + 0.012, thighB * 1.02, kneeMat));
    rings.push(ring(new THREE.Vector3(x, kneeY, 0), X, Z, ellipseRadii(thighB * 1.04, thighB * 1.1), legBones(kneeY), kneeMat));
    rings.push(ring(new THREE.Vector3(x, kneeY - 0.012, 0), X, Z, ellipseRadii(shinA * 1.0, shinA * 1.06), legBones(kneeY - 0.012), kneeMat));
    const shinR = (t: number) => {
      const base = shinA + (shinB - shinA) * t;
      const calf = 1 + (0.08 + 0.2 * legDef) * Math.exp(-Math.pow((t - 0.3) / 0.22, 2));
      return base * calf;
    };
    for (const t of [0.12, 0.3, 0.45, 0.6, 0.8, 0.93]) {
      const y = kneeY - t * L.shin;
      // The calf sits at the back: the bulge is deeper than it is wide.
      rings.push(ring(new THREE.Vector3(x, y, 0), X, Z, ellipseRadii(shinR(t) * 0.96, shinR(t) * 1.08, [{ at: back, amp: 0.004 * legDef * Math.exp(-Math.pow((t - 0.3) / 0.25, 2)), width: 1.2 }]), legBones(y), kneeMat));
    }
    const ankle = ring(new THREE.Vector3(x, ankleY, 0), X, Z, ellipseRadii(shinB, shinB * 1.05), [[lo, 1]], kneeMat);
    // A short cap: the shin ends inside the sneaker, and a longer one poked
    // through the floor when the shin leaned.
    rings.push(ankle, ...cap(ankle.c, X, Z, new THREE.Vector3(0, -1, 0), ankle.radii, 0.005, [[lo, 1]], kneeMat, 2));
    b.tube(rings);

    if (layered) {
      // The leg's garment shell: his shorts flare from the hip to an open
      // hem above the knee; her leggings hug the whole leg to the ankle.
      const shellRing = (y: number, rr: number, gap: number) => {
        const t = (hipY - y) / L.thigh;
        const quad = 0.09 * legDef * rr * Math.exp(-Math.pow((t - 0.35) / 0.3, 2));
        return ring(new THREE.Vector3(x, y, 0), X, Z, ellipseRadii(rr + gap, rr + gap, quad > 0.0005 ? [{ at: front, amp: quad, width: 1.1 }] : []), legBones(y), MAT.legShell);
      };
      const leg: Ring[] = [];
      leg.push(shellRing(hipY + 0.03, thighA * 0.96, 0.004));
      if (!female) {
        for (const t of [0, 0.12, 0.25, 0.4, 0.55, 0.7]) leg.push(shellRing(hipY - t * L.thigh, thighR(t), 0.004 + 0.006 * t));
        const g = 0.004 + 0.006 * tHem;
        leg.push(shellRing(hemY, thighR(tHem), g + LIP));
        leg.push(shellRing(hemY, thighR(tHem), g - LIP));
        leg.push(shellRing(hemY + 0.012, thighR(tHem), g - LIP));
      } else {
        for (const t of [0, 0.12, 0.25, 0.4, 0.55, 0.7]) leg.push(shellRing(hipY - t * L.thigh, thighR(t), 0.003));
        leg.push(shellRing(hemY, thighR(tHem), 0.003));
        leg.push(shellRing(kneeY + 0.012, thighB * 1.02, 0.003));
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
    // The deltoid: rounded over the shoulder, staying with the trunk.
    const capRings = cap(at(0), Y, Z, dir.clone().negate(), ellipseRadii(delt, delt), 0.032, [[clav, 1]], MAT.skin, 4).reverse();
    rings.push(...capRings);
    rings.push(armRing(at(0), delt, delt, [[clav, 0.5], [arm, 0.5]]));
    rings.push(armRing(at(0.025), delt * 0.99, delt * 0.99, [[clav, 0.15], [arm, 0.85]]));
    const uaR = (t: number) => {
      const base = uaA + (uaB - uaA) * t;
      const biceps = 1 + 0.18 * def * Math.exp(-Math.pow((t - 0.45) / 0.25, 2));
      return base * biceps;
    };
    for (const t of [0.3, 0.45, 0.6, 0.78]) {
      const d = t * L.upperArm;
      const r = uaR(t);
      // The biceps sits in front, the triceps behind: a little depth.
      rings.push(armRing(at(d), r, r * 1.05, [[arm, 1]]));
    }
    const elbowBones = (d: number): [number, number][] => {
      const k = (d - L.upperArm) / 0.025;
      if (k <= -1) return [[arm, 1]];
      if (k >= 1) return [[fore, 1]];
      const w = 0.5 + 0.5 * k;
      return [[arm, 1 - w], [fore, w]];
    };
    rings.push(armRing(at(L.upperArm - 0.02), uaB * 1.02, uaB * 1.02, elbowBones(L.upperArm - 0.02)));
    rings.push(armRing(at(L.upperArm), uaB * 1.04, uaB * 1.0, elbowBones(L.upperArm)));
    rings.push(armRing(at(L.upperArm + 0.02), faA * 1.0, faA * 0.98, elbowBones(L.upperArm + 0.02)));
    const faR = (t: number) => {
      const base = faA + (faB - faA) * t;
      const belly = 1 + 0.12 * def * Math.exp(-Math.pow((t - 0.28) / 0.25, 2));
      return base * belly;
    };
    for (const t of [0.2, 0.35, 0.55, 0.75]) rings.push(armRing(at(L.upperArm + t * L.forearm), faR(t), faR(t) * 1.02, [[fore, 1]]));
    // Wristband: a raised ring of the accent colour just above the wrist.
    const wristD = L.upperArm + L.forearm;
    const bandR = faB * 1.08;
    rings.push(armRing(at(wristD - 0.03), faB * 1.08, faB * 1.08, [[fore, 1]]));
    rings.push(armRing(at(wristD - 0.028), bandR + 0.003, bandR + 0.003, [[fore, 1]], MAT.band));
    rings.push(armRing(at(wristD - 0.008), bandR + 0.003, bandR + 0.003, [[fore, 1]], MAT.band));
    rings.push(armRing(at(wristD - 0.006), faB * 1.02, faB * 1.02, [[fore, 0.85], [hand, 0.15]]));
    const wrist = armRing(at(wristD), faB * 0.95, faB * 1.05, [[fore, 0.5], [hand, 0.5]]);
    rings.push(wrist);
    if (spec.gripping) {
      rings.push(...cap(wrist.c, Y, Z, dir, wrist.radii, 0.006, [[hand, 1]], MAT.skin, 2));
    } else {
      // An open hand, palm down in the T-pose: a flat palm over the first
      // 55% of the hand's length, then four fingers and a thumb. The
      // fingers droop a little and the outer ones are shorter, so a hand on
      // the floor or held out reads as a hand, not a paddle.
      const hb: [number, number][] = [[hand, 1]];
      const palmEnd = L.hand * 0.55;
      const halfW = spec.hand * 1.8;
      rings.push(armRing(at(wristD + 0.008), spec.hand * 0.85, spec.hand * 1.5, [[fore, 0.15], [hand, 0.85]]));
      rings.push(armRing(at(wristD + palmEnd * 0.5), spec.hand * 0.75, halfW, hb));
      const palm = armRing(at(wristD + palmEnd), spec.hand * 0.62, halfW * 0.98, hb);
      rings.push(palm, ...cap(palm.c, Y, Z, dir, palm.radii, 0.006, hb, MAT.skin, 2));
      b.tube(rings);
      // A finger: a thin tube from `from` to `to`, rounded at the tip.
      const finger = (from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) => {
        const axis = to.clone().sub(from).normalize();
        const v = new THREE.Vector3().crossVectors(Y, axis).normalize();
        const fr: Ring[] = [];
        for (const [t, r] of [[0, r0], [0.5, (r0 + r1) / 2], [1, r1]] as const) {
          fr.push(ring(from.clone().lerp(to, t), Y, v, ellipseRadii(r * 0.9, r), hb, MAT.skin));
        }
        fr.push(...cap(to, Y, v, axis, ellipseRadii(r1 * 0.9, r1), r1 * 0.9, hb, MAT.skin, 2));
        b.tube(fr);
      };
      const fingerLen = L.hand - palmEnd;
      const fr0 = spec.hand * 0.32, fr1 = spec.hand * 0.26;
      [-0.72, -0.24, 0.24, 0.72].forEach((k, i) => {
        const z = k * halfW;
        const reach = i === 1 || i === 2 ? 1 : 0.88;
        const root = new THREE.Vector3(x0 + s * (wristD + palmEnd - 0.006), shoulderY, z);
        const tipP = new THREE.Vector3(x0 + s * (wristD + palmEnd + fingerLen * reach), shoulderY - fingerLen * 0.18, z * 1.04);
        finger(root, tipP, fr0, fr1);
      });
      // The thumb leaves the palm's forward edge near the wrist and angles
      // out ahead of the fingers.
      const thumbRoot = new THREE.Vector3(x0 + s * (wristD + palmEnd * 0.25), shoulderY - spec.hand * 0.1, halfW * 0.75);
      const thumbTip = new THREE.Vector3(x0 + s * (wristD + palmEnd * 0.85), shoulderY - spec.hand * 0.2, halfW * 1.45);
      finger(thumbRoot, thumbTip, spec.hand * 0.36, spec.hand * 0.28);
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
