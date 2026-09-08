// Studently-specific addition — NOT part of the vendored thebuggeddev/anatomy
// source. The "skin" organ's model (public/anatomy/models/skin.glb) is a
// single AI-generated, single-mesh full-body figure with no separable parts
// (confirmed by inspecting the .glb's glTF JSON: 1 mesh, 1 node, 1 material),
// so there is no clean way to remove or hide just the genital region from the
// source geometry. This adds a small opaque "modesty patch" mesh over that
// region instead, parented to the same pivot the organ model uses, so it
// tracks the model through every rotation/zoom.
//
// Position was originally a proportional guess (crotch height ≈ 45-48% of
// standing height) and was WRONG on two counts, found by actually decoding
// the mesh (backend/scripts one-off: loaded skin.glb through the real
// Meshopt-aware GLTFLoader in Node, computed the same center/scale transform
// loaders.ts applies, then scanned vertex positions restricted to the body's
// true midline — |X| < 0.15 in fit space — for the frontmost surface point
// per thin Y-band, i.e. the actual front-facing silhouette, not a guess):
//  1. This model is NOT a full standing figure — its own bounding box is
//     wider (X, arms spread) than it is tall (Y), because it's cropped to
//     torso-through-thigh. "50% of standing height" was never a valid
//     landmark for it to begin with.
//  2. The old Z (1.32) sat *behind* the real body surface (measured ~1.42-
//     1.53 across the pelvis band), so the patch was rendering embedded
//     inside the mesh — invisible — not merely mispositioned sideways.
// The pelvis region on this particular AI-generated mesh is a broad, gentle
// bulge blended into the general abdomen curve (no sharp isolated spike to
// lock onto), spanning roughly fit-space Y -0.05 to -0.30 at X ≈ -0.09 to
// -0.15 (the mesh's true midline isn't at X=0 — the bounding-box center is
// slightly off due to an asymmetric pose), surface Z ≈ 1.48-1.53 there.
// (All in loaders.ts's normalised FIT_SIZE=3.8 pivot space, same space the
// existing "skin" hotspots in anatomy-data.ts are authored in.)

import * as THREE from "three";

export const MODESTY_PATCH_NAME = "modesty-patch";

/** Local pivot-space position + half-size of the patch — tune these if it still doesn't line up. */
const MODESTY_PATCH_POSITION = new THREE.Vector3(-0.12, -0.16, 1.58); // Z is deliberately proud of the ~1.53 measured surface so the patch fully occludes, not embedded behind it
const MODESTY_PATCH_SIZE = { width: 0.32, height: 0.42 };

/**
 * Adds (once) a small opaque, skin-toned patch as a child of `pivot`,
 * facing the same direction as the "skin" organ's default front view.
 * Safe to call every time the skin organ loads — no-ops if already present
 * (the pivot is cached/reused by AnatomyAssetManager, see loaders.ts).
 */
export function ensureModestyPatch(pivot: THREE.Group): void {
  if (pivot.getObjectByName(MODESTY_PATCH_NAME)) return;

  const geometry = new THREE.SphereGeometry(1, 32, 24);
  geometry.scale(MODESTY_PATCH_SIZE.width, MODESTY_PATCH_SIZE.height, 0.22);

  const material = new THREE.MeshStandardMaterial({
    color: 0xc99277, // matches the "skin" organ's accent (see anatomy-data.ts)
    roughness: 0.55,
    metalness: 0,
  });

  const patch = new THREE.Mesh(geometry, material);
  patch.name = MODESTY_PATCH_NAME;
  patch.position.copy(MODESTY_PATCH_POSITION);
  // Deliberately excluded from `organ.meshes` (not returned to the caller),
  // so viewer tools that iterate that array — wireframe, cross-section
  // clipping, isolate — never make this patch transparent or cut it away.
  patch.frustumCulled = false;
  patch.castShadow = false;
  patch.receiveShadow = false;

  pivot.add(patch);
}
