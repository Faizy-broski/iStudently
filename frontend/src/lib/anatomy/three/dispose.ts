// Vendored from thebuggeddev/anatomy (app/lib/three/dispose.ts) for the
// "anatomy_label" quiz question type. Unmodified besides import paths.
import * as THREE from "three";

export function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}
