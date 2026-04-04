import * as THREE from 'three';

export function createSkyscraper(options = {}) {
  const floors = options.floors || 30;
  const floorHeight = options.floorHeight || 0.35;
  const width = options.width || 6;
  const depth = options.depth || 6;
  const color = options.color || 0x222233;

  const group = new THREE.Group();
  group.name = options.name || 'Skyscraper';

  const buildingGeo = new THREE.BoxGeometry(width, floors * floorHeight, depth);
  const buildingMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.2,
    roughness: 0.6,
  });
  const building = new THREE.Mesh(buildingGeo, buildingMat);
  building.position.y = (floors * floorHeight) / 2;
  group.add(building);

  const windows = new THREE.Group();
  const windowGeo = new THREE.PlaneGeometry(0.4, 0.25);
  const cols = Math.max(2, Math.floor(width / 0.6));
  const rows = floors;
  const litProbability = options.windowLitProbability ?? 0.12;

  for (let face = 0; face < 4; face += 1) {
    const faceGroup = new THREE.Group();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const lit = Math.random() < litProbability;
        const windowMat = new THREE.MeshStandardMaterial({
          color: 0x99ccee,
          emissive: lit ? 0xfff2c8 : 0x000000,
          emissiveIntensity: lit ? 0.6 + Math.random() * 0.6 : 0,
          metalness: 0,
          roughness: 0.8,
        });
        const windowMesh = new THREE.Mesh(windowGeo, windowMat);
        windowMesh.position.set(
          -width / 2 + 0.5 + col * 0.6,
          row * floorHeight + floorHeight / 2,
          depth / 2 + 0.01,
        );
        faceGroup.add(windowMesh);
      }
    }
    if (face === 1) faceGroup.rotation.y = Math.PI / 2;
    if (face === 2) faceGroup.rotation.y = Math.PI;
    if (face === 3) faceGroup.rotation.y = -Math.PI / 2;
    windows.add(faceGroup);
  }
  group.add(windows);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.6, 0.1, depth * 0.6),
    new THREE.MeshStandardMaterial({ color: 0x111111 }),
  );
  roof.position.y = floors * floorHeight + 0.05;
  group.add(roof);

  if (options.antenna !== false) {
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }),
    );
    antenna.position.y = floors * floorHeight + 0.7;
    group.add(antenna);
  }

  group.userData.randomizeWindows = (prob = 0.12) => {
    windows.traverse((child) => {
      if (!child.isMesh) return;
      const lit = Math.random() < prob;
      child.material.emissive.setHex(lit ? 0xfff2c8 : 0x000000);
      child.material.emissiveIntensity = lit ? 0.6 + Math.random() * 0.6 : 0;
    });
  };

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}
