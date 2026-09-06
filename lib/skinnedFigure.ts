// A skinned humanoid (a GLB with a skeleton) driven by the app's own poses.
//
// The poses stay ours: every movement already yields, per frame, the world
// positions of each body segment's two ends (lib/poses.ts). This module
// loads a rigged model and, each frame, turns every mapped bone so that it
// points from the segment's start to its end -- retargeting by direction,
// with a twist hint so elbows and knees bend the right way and the trunk
// faces where the movement says. The model keeps its own proportions; only
// the hips are placed, so a model whose arms are longer than the pose's
// reaches a little further, but is always in the pose.
//
// Bone names follow the Mixamo convention (mixamorigHips, mixamorigSpine ...),
// which is what an auto-rigged model of our own will carry; `RigMap` lets a
// differently named skeleton be mapped instead. The rest pose is assumed to
// be the usual T-pose facing +Z with the left arm along +X.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type RigMap = {
  hips: string;
  // Pelvis to shoulders, in order; all take the trunk's direction.
  spine: string[];
  neck: string;
  head: string;
  // The clavicles, aimed from the trunk's top at each shoulder joint.
  leftShoulder?: string;
  rightShoulder?: string;
  leftUpperArm: string;
  leftForearm: string;
  leftHand: string;
  rightUpperArm: string;
  rightForearm: string;
  rightHand: string;
  leftThigh: string;
  leftShin: string;
  leftFoot: string;
  rightThigh: string;
  rightShin: string;
  rightFoot: string;
};

export const MIXAMO_RIG: RigMap = {
  hips: "mixamorigHips",
  spine: ["mixamorigSpine", "mixamorigSpine1", "mixamorigSpine2"],
  neck: "mixamorigNeck",
  head: "mixamorigHead",
  leftShoulder: "mixamorigLeftShoulder",
  rightShoulder: "mixamorigRightShoulder",
  leftUpperArm: "mixamorigLeftArm",
  leftForearm: "mixamorigLeftForeArm",
  leftHand: "mixamorigLeftHand",
  rightUpperArm: "mixamorigRightArm",
  rightForearm: "mixamorigRightForeArm",
  rightHand: "mixamorigRightHand",
  leftThigh: "mixamorigLeftUpLeg",
  leftShin: "mixamorigLeftLeg",
  leftFoot: "mixamorigLeftFoot",
  rightThigh: "mixamorigRightUpLeg",
  rightShin: "mixamorigRightLeg",
  rightFoot: "mixamorigRightFoot",
};

// One frame of the app's pose, in world units: each segment's ends by part
// and side, the head centre, and the trunk's belly direction.
export type FigureSample = {
  bones: { part: string; side?: 0 | 1; a: THREE.Vector3; b: THREE.Vector3 }[];
  head: THREE.Vector3;
  ventral: THREE.Vector3;
  // The floor's height, if there is one: a hand resting on it lies flat.
  floorY?: number;
};

type Aimed = {
  bone: THREE.Bone;
  // The bone's own direction to its child, and its "forward", both in the
  // bone's local space at rest.
  along: THREE.Vector3;
  forward: THREE.Vector3;
};

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const NZ = new THREE.Vector3(0, 0, -1);

export class SkinnedFigure {
  readonly root = new THREE.Group();
  private aimed = new Map<string, Aimed>();
  private hips!: THREE.Bone;
  // Model units per app unit: the model's leg against the pose's.
  readonly scale: number;
  readonly hipHalf: number;
  // From the hips bone to the midpoint of the hip joints, in the hips'
  // rest frame, in app units.
  private hipJointOffset = new THREE.Vector3();

  // `legLength`: the pose's thigh plus shin, which the model is scaled to.
  static load(url: string, legLength: number, rig: RigMap = MIXAMO_RIG): Promise<SkinnedFigure> {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          try {
            resolve(new SkinnedFigure(gltf.scene, rig, legLength));
          } catch (e) {
            reject(e);
          }
        },
        undefined,
        reject,
      );
    });
  }

  // A skeleton built in code (lib/bodyMesh.ts) rather than loaded.
  static fromScene(scene: THREE.Group, legLength: number, rig: RigMap = MIXAMO_RIG): SkinnedFigure {
    return new SkinnedFigure(scene, rig, legLength);
  }

  private constructor(scene: THREE.Group, rig: RigMap, legLength: number) {
    scene.updateMatrixWorld(true);
    const bones = new Map<string, THREE.Bone>();
    let skin: THREE.SkinnedMesh | null = null;
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        // Skinned meshes keep their rest-pose bounds; a lying figure would
        // vanish when its rest box left the view.
        o.frustumCulled = false;
        const s = o as THREE.SkinnedMesh;
        if (s.isSkinnedMesh && (!skin || s.skeleton.bones.length > skin.skeleton.bones.length)) skin = s;
      }
    });
    const need = (name: string): THREE.Bone => {
      const b = bones.get(name);
      if (!b) throw new Error(`skinned figure: no bone named "${name}"`);
      return b;
    };
    this.hips = need(rig.hips);

    // The rest frame is the skin's BIND pose, not whatever pose the file's
    // nodes happen to be in (a Mixamo export can store its first animation
    // frame there, which twisted the mesh around a correctly placed skeleton).
    const bindWorld = new Map<string, THREE.Matrix4>();
    if (skin) {
      const mesh = skin as THREE.SkinnedMesh;
      mesh.skeleton.bones.forEach((bone, i) => {
        bindWorld.set(bone.name, mesh.bindMatrix.clone().multiply(mesh.skeleton.boneInverses[i]!.clone().invert()));
      });
    }
    const restMatrix = (name: string) => bindWorld.get(name) ?? need(name).matrixWorld;
    const worldPos = (name: string) => new THREE.Vector3().setFromMatrixPosition(restMatrix(name));
    // Each bone's "along" is a world direction brought into its own rest
    // frame; its "forward" is the direction its bend faces at rest, which
    // is the belly side for everything but the legs (the knee flexes back)
    // and the feet (their top faces up).
    const worldQ = new THREE.Quaternion();
    const register = (key: string, name: string, alongWorld: THREE.Vector3, forwardWorld: THREE.Vector3) => {
      const bone = need(name);
      restMatrix(name).decompose(new THREE.Vector3(), worldQ, new THREE.Vector3());
      const inv = worldQ.clone().invert();
      const along = alongWorld.clone().applyQuaternion(inv).normalize();
      const forward = forwardWorld.clone().applyQuaternion(inv);
      forward.addScaledVector(along, -forward.dot(along)).normalize();
      this.aimed.set(key, { bone, along, forward });
    };
    // A bone's direction to a named child, in world space at rest.
    const toward = (from: string, to: string) => worldPos(to).sub(worldPos(from)).normalize();

    register("hips", rig.hips, Y, Z);
    rig.spine.forEach((name, i) => register(`spine${i}`, name, Y, Z));
    register("neck", rig.neck, Y, Z);
    register("head", rig.head, Y, Z);
    for (const side of ["left", "right"] as const) {
      const r = rig as unknown as Record<string, string | undefined>;
      const upperArm = r[`${side}UpperArm`]!, forearm = r[`${side}Forearm`]!, hand = r[`${side}Hand`]!;
      const shoulder = r[`${side}Shoulder`];
      if (shoulder) register(`${side}Shoulder`, shoulder, toward(shoulder, upperArm), Z);
      register(`${side}UpperArm`, upperArm, toward(upperArm, forearm), Z);
      register(`${side}Forearm`, forearm, toward(forearm, hand), Z);
      // The hand continues the forearm; its first child may be the thumb.
      register(`${side}Hand`, hand, toward(forearm, hand), Z);
      const thigh = r[`${side}Thigh`]!, shin = r[`${side}Shin`]!, foot = r[`${side}Foot`]!;
      register(`${side}Thigh`, thigh, toward(thigh, shin), NZ);
      register(`${side}Shin`, shin, toward(shin, foot), NZ);
      register(`${side}Foot`, foot, Z, Y);
    }

    // Scale the model so its leg is the pose's leg.
    const hip = worldPos(rig.leftThigh), knee = worldPos(rig.leftShin), ankle = worldPos(rig.leftFoot);
    const modelLeg = hip.distanceTo(knee) + knee.distanceTo(ankle);
    this.scale = modelLeg > 0 ? legLength / modelLeg : 1;
    this.hipHalf = (hip.distanceTo(worldPos(rig.rightThigh)) / 2) * this.scale;
    // The pose's pelvis is where the thighs hang from; a rig's hips bone
    // usually sits a hand above that. Keep the vector between them, in the
    // hips' own frame, so the hip joints (not the bone) land on the pelvis
    // and the feet reach the floor.
    const hipMid = hip.clone().add(worldPos(rig.rightThigh)).multiplyScalar(0.5);
    const hipsQ = new THREE.Quaternion();
    restMatrix(rig.hips).decompose(new THREE.Vector3(), hipsQ, new THREE.Vector3());
    this.hipJointOffset = hipMid.sub(worldPos(rig.hips)).applyQuaternion(hipsQ.invert()).multiplyScalar(this.scale);
    this.root.scale.setScalar(this.scale);
    this.root.add(scene);
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat.dispose();
      }
    });
  }

  // Land the model on one frame of the pose.
  apply(sample: FigureSample) {
    const seg = (part: string, side?: 0 | 1) => sample.bones.find((b) => b.part === part && (side === undefined || b.side === side));
    const spine = seg("spine");
    if (!spine) return;
    const ventral = sample.ventral.clone().normalize();
    const trunkDir = spine.b.clone().sub(spine.a).normalize();

    // Which authored side is the model's left: the shoulder that lies to the
    // left of the belly direction, looking up the trunk.
    const shoulders = seg("shoulders");
    let leftSide: 0 | 1 = 0;
    if (shoulders) {
      const leftward = new THREE.Vector3().crossVectors(trunkDir, ventral);
      leftSide = shoulders.a.clone().sub(shoulders.b).dot(leftward) >= 0 ? 0 : 1;
    }

    // The hips bone sits at the pose's pelvis, then every bone is aimed
    // parent-first so each reads its parent's settled orientation.
    this.root.updateMatrixWorld(true);
    const parent = this.hips.parent!;
    this.aim(this.aimed.get("hips")!, trunkDir, ventral);
    const hipsQ = this.hips.getWorldQuaternion(new THREE.Quaternion());
    const toJoints = this.hipJointOffset.clone().applyQuaternion(hipsQ);
    this.hips.position.copy(parent.worldToLocal(spine.a.clone().sub(toJoints)));
    this.hips.updateMatrixWorld(true);
    for (let i = 0; ; i++) {
      const a = this.aimed.get(`spine${i}`);
      if (!a) break;
      this.aim(a, trunkDir, ventral);
    }
    const neck = seg("neck");
    if (neck) {
      this.aim(this.aimed.get("neck")!, neck.b.clone().sub(neck.a).normalize(), ventral);
      this.aim(this.aimed.get("head")!, sample.head.clone().sub(neck.a).normalize(), ventral);
    }
    for (const [key, side] of [["left", leftSide], ["right", leftSide === 0 ? 1 : 0]] as const) {
      const clav = this.aimed.get(`${key}Shoulder`);
      if (clav && shoulders) {
        const end = side === 0 ? shoulders.a : shoulders.b;
        this.aim(clav, end.clone().sub(spine.b).normalize(), ventral);
      }
      const upper = seg("upperArm", side);
      const fore = seg("forearm", side);
      const hand = seg("hand", side);
      if (upper && fore) {
        const upperDir = upper.b.clone().sub(upper.a).normalize();
        const foreDir = fore.b.clone().sub(fore.a).normalize();
        // The elbow bends toward the forearm's off-axis component; a straight
        // arm bends nowhere, so it faces the way the trunk does.
        const bend = foreDir.clone().addScaledVector(upperDir, -foreDir.dot(upperDir));
        const hint = bend.lengthSq() > 0.01 ? bend.normalize() : ventral;
        this.aim(this.aimed.get(`${key}UpperArm`)!, upperDir, hint);
        this.aim(this.aimed.get(`${key}Forearm`)!, foreDir, hint);
        const hd = this.aimed.get(`${key}Hand`);
        if (hd) {
          const handDir = hand ? hand.b.clone().sub(hand.a).normalize() : foreDir;
          // A hand on the floor lies palm down: its flat side faces up, so
          // its "forward" runs across the floor, perpendicular to the hand.
          let handHint = hint;
          if (hand && sample.floorY !== undefined && hand.b.y - sample.floorY < 0.03 && hand.a.y - sample.floorY < 0.05) {
            const flat = new THREE.Vector3().crossVectors(Y, handDir);
            if (flat.lengthSq() > 0.01) handHint = flat.normalize();
          }
          this.aim(hd, handDir, handHint);
        }
      }
      const thigh = seg("thigh", side);
      const shin = seg("shin", side);
      const foot = seg("foot", side);
      if (thigh && shin) {
        const thighDir = thigh.b.clone().sub(thigh.a).normalize();
        const shinDir = shin.b.clone().sub(shin.a).normalize();
        // The knee flexes backward: the shin's off-axis component points the
        // way the leg bends, which for a straight leg is away from the belly.
        const bend = shinDir.clone().addScaledVector(thighDir, -shinDir.dot(thighDir));
        const hint = bend.lengthSq() > 0.01 ? bend.normalize() : ventral.clone().negate();
        this.aim(this.aimed.get(`${key}Thigh`)!, thighDir, hint);
        this.aim(this.aimed.get(`${key}Shin`)!, shinDir, hint);
        if (foot) {
          const footDir = foot.b.clone().sub(foot.a).normalize();
          // The foot's top faces up the shin.
          const up = shinDir.clone().negate();
          up.addScaledVector(footDir, -up.dot(footDir));
          this.aim(this.aimed.get(`${key}Foot`)!, footDir, up.lengthSq() > 0.01 ? up.normalize() : Y);
        }
      }
    }
  }

  // Turn a bone so its rest "along" points down `dir` and its rest "forward"
  // lies toward `hint`, then express that in the parent's frame.
  private aim(a: Aimed, dir: THREE.Vector3, hint: THREE.Vector3) {
    const fwd = hint.clone().addScaledVector(dir, -hint.dot(dir));
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1).addScaledVector(dir, -dir.z);
    if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0).addScaledVector(dir, -dir.x);
    fwd.normalize();
    const target = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(dir, fwd), dir, fwd);
    const rest = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(a.along, a.forward), a.along, a.forward);
    const world = new THREE.Quaternion().setFromRotationMatrix(target.multiply(rest.invert()));
    const parentQ = new THREE.Quaternion();
    a.bone.parent!.getWorldQuaternion(parentQ);
    a.bone.quaternion.copy(parentQ.invert().multiply(world));
    a.bone.updateMatrixWorld(true);
  }
}
