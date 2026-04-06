import * as THREE from 'three';

export function createCar(options = {}) {
  const color = options.color || 0x1e90ff;
  const scale = options.scale || 1;

  const group = new THREE.Group();
  group.name = options.name || 'Car';

  const paintMaterial = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.46,
    roughness: 0.26,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b1f25,
    metalness: 0.55,
    roughness: 0.45,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xbed8f7,
    metalness: 0.1,
    roughness: 0.08,
    transparent: true,
    opacity: 0.82,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.3, 4.85), trimMaterial);
  chassis.position.y = 0.34;
  group.add(chassis);

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.58, 4.35), paintMaterial);
  body.position.y = 0.69;
  group.add(body);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.2, 1.34), paintMaterial);
  hood.position.set(0, 0.9, 1.56);
  hood.rotation.x = -0.11;
  group.add(hood);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.34, 1.8), paintMaterial);
  roof.position.set(0, 1.25, -0.15);
  group.add(roof);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.36, 0.12), glassMaterial);
  windshield.position.set(0, 1.11, 0.82);
  windshield.rotation.x = 0.64;
  group.add(windshield);

  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.32, 0.12), glassMaterial);
  rearGlass.position.set(0, 1.1, -1.02);
  rearGlass.rotation.x = -0.54;
  group.add(rearGlass);

  const sideWindowGeo = new THREE.BoxGeometry(0.08, 0.28, 1.2);
  const leftWindow = new THREE.Mesh(sideWindowGeo, glassMaterial);
  leftWindow.position.set(-0.78, 1.13, -0.1);
  group.add(leftWindow);
  const rightWindow = leftWindow.clone();
  rightWindow.position.x = 0.78;
  group.add(rightWindow);

  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.22, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x0e1116, metalness: 0.8, roughness: 0.35 }),
  );
  grille.position.set(0, 0.72, 2.2);
  group.add(grille);

  const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.1, 0.24), trimMaterial);
  frontSplitter.position.set(0, 0.34, 2.35);
  group.add(frontSplitter);

  const rearDiffuser = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.1, 0.24), trimMaterial);
  rearDiffuser.position.set(0, 0.34, -2.35);
  group.add(rearDiffuser);

  const sideSkirtGeo = new THREE.BoxGeometry(0.08, 0.12, 3.3);
  const leftSkirt = new THREE.Mesh(sideSkirtGeo, trimMaterial);
  leftSkirt.position.set(-1.07, 0.38, 0);
  group.add(leftSkirt);
  const rightSkirt = leftSkirt.clone();
  rightSkirt.position.x = 1.07;
  group.add(rightSkirt);

  const mirrorGeo = new THREE.BoxGeometry(0.16, 0.08, 0.22);
  const leftMirror = new THREE.Mesh(mirrorGeo, trimMaterial);
  leftMirror.position.set(-1.02, 1.05, 0.62);
  group.add(leftMirror);
  const rightMirror = leftMirror.clone();
  rightMirror.position.x = 1.02;
  group.add(rightMirror);

  const wheelSetup = [
    { x: -0.95, y: 0.38, z: 1.56, front: true },
    { x: 0.95, y: 0.38, z: 1.56, front: true },
    { x: -0.95, y: 0.38, z: -1.56, front: false },
    { x: 0.95, y: 0.38, z: -1.56, front: false },
  ];
  const frontWheelPivots = [];
  const wheelMeshes = [];
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x090909,
    metalness: 0.15,
    roughness: 0.88,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xa0a8b3,
    metalness: 0.88,
    roughness: 0.25,
  });
  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0x656d78,
    metalness: 0.6,
    roughness: 0.55,
  });

  wheelSetup.forEach((setup) => {
    const parent = setup.front ? new THREE.Group() : group;
    if (setup.front) {
      parent.position.set(setup.x, setup.y, setup.z);
      group.add(parent);
      frontWheelPivots.push(parent);
    }

    const wheelNode = new THREE.Group();
    wheelNode.userData.baseRotation = wheelNode.rotation.clone();
    wheelNode.userData.spinAxis = 'x';
    wheelNode.userData.spinDirection = -1;
    wheelNode.userData.spinAngle = 0;
    wheelNode.userData.wheelRadius = 0.38;

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.32, 28), tireMat);
    tire.rotation.z = Math.PI / 2;

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.34, 20), rimMat);
    rim.rotation.z = Math.PI / 2;
    const brakeDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16), brakeMat);
    brakeDisc.rotation.z = Math.PI / 2;

    tire.add(rim, brakeDisc);
    wheelNode.add(tire);
    if (setup.front) {
      parent.add(wheelNode);
    } else {
      wheelNode.position.set(setup.x, setup.y, setup.z);
      group.add(wheelNode);
    }
    wheelMeshes.push(wheelNode);
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xeef5ff,
    emissive: 0xd8c57a,
    emissiveIntensity: 0.6,
    metalness: 0.2,
    roughness: 0.35,
  });
  const headlightGeo = new THREE.BoxGeometry(0.42, 0.14, 0.11);
  const headlightLeft = new THREE.Mesh(headlightGeo, headlightMat);
  headlightLeft.position.set(-0.66, 0.78, 2.25);
  group.add(headlightLeft);
  const headlightRight = headlightLeft.clone();
  headlightRight.position.x = 0.66;
  group.add(headlightRight);
  const headlightMeshes = [headlightLeft, headlightRight];

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0x4f1012,
    emissive: 0xff2f2f,
    emissiveIntensity: 0.45,
    metalness: 0.2,
    roughness: 0.35,
  });
  const taillightGeo = new THREE.BoxGeometry(0.36, 0.12, 0.1);
  const tailLeft = new THREE.Mesh(taillightGeo, taillightMat);
  tailLeft.position.set(-0.68, 0.75, -2.23);
  group.add(tailLeft);
  const tailRight = tailLeft.clone();
  tailRight.position.x = 0.68;
  group.add(tailRight);
  const taillightMeshes = [tailLeft, tailRight];

  if (options.policeLightBar) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 0.1, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x101217, metalness: 0.65, roughness: 0.35 }),
    );
    bar.position.set(0, 1.46, 0.02);
    group.add(bar);

    const beaconGeo = new THREE.BoxGeometry(0.24, 0.08, 0.12);
    const blueBeacon = new THREE.Mesh(
      beaconGeo,
      new THREE.MeshStandardMaterial({ color: 0x2f5bff, emissive: 0x1f3fb2, emissiveIntensity: 0.2 }),
    );
    blueBeacon.position.set(-0.22, 1.5, 0.02);
    group.add(blueBeacon);

    const redBeacon = new THREE.Mesh(
      beaconGeo,
      new THREE.MeshStandardMaterial({ color: 0xff374d, emissive: 0x991f2b, emissiveIntensity: 0.2 }),
    );
    redBeacon.position.set(0.22, 1.5, 0.02);
    group.add(redBeacon);

    group.userData.beacons = [blueBeacon, redBeacon];
  }

  group.userData = group.userData || {};
  group.userData.bodyMaterial = paintMaterial;
  group.userData.trimMaterial = trimMaterial;
  group.userData.bodyMesh = body;
  group.userData.hoodMesh = hood;
  group.userData.roofMesh = roof;
  group.userData.chassisMesh = chassis;
  group.userData.wheels = wheelMeshes;
  group.userData.frontWheelPivots = frontWheelPivots;
  group.userData.headlightMeshes = headlightMeshes;
  group.userData.taillightMeshes = taillightMeshes;
  group.userData.setColor = (hex) => {
    paintMaterial.color.setHex(hex);
  };
  group.userData.flashBeacons = (on) => {
    if (!group.userData.beacons) return;
    group.userData.beacons[0].material.emissiveIntensity = on ? 1.25 : 0.15;
    group.userData.beacons[1].material.emissiveIntensity = on ? 0.95 : 0.15;
  };

  group.scale.setScalar(scale);
  group.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return group;
}
