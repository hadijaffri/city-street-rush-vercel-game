import * as THREE from 'three';
import { createCar } from './carDesign';

export function createPoliceCar(options = {}) {
  const car = createCar({
    color: options.color || 0x0b2b5a,
    scale: options.scale || 1,
    policeLightBar: true,
    name: options.name || 'PoliceCar',
  });

  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.12,
    roughness: 0.5,
  });
  const stripeGeo = new THREE.BoxGeometry(0.05, 0.26, 2.6);
  const leftStripe = new THREE.Mesh(stripeGeo, stripeMat);
  leftStripe.position.set(-1.045, 0.79, -0.2);
  car.add(leftStripe);
  const rightStripe = leftStripe.clone();
  rightStripe.position.x = 1.045;
  car.add(rightStripe);

  const pushBar = new THREE.Group();
  const barMat = new THREE.MeshStandardMaterial({
    color: 0x0f1218,
    metalness: 0.8,
    roughness: 0.35,
  });
  const mainBar = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.08), barMat);
  mainBar.position.set(0, 0.62, 2.43);
  pushBar.add(mainBar);
  [-0.46, 0.46].forEach((x) => {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), barMat);
    upright.position.set(x, 0.77, 2.43);
    pushBar.add(upright);
  });
  car.add(pushBar);

  car.userData.sirenAnchor = new THREE.Object3D();
  car.userData.sirenAnchor.position.set(0, 1.5, 0);
  car.add(car.userData.sirenAnchor);
  return car;
}

export function createPoliceOfficer(options = {}) {
  const group = new THREE.Group();
  group.name = options.name || 'PoliceOfficer';

  const uniformDark = new THREE.MeshStandardMaterial({
    color: 0x0f243f,
    metalness: 0.08,
    roughness: 0.72,
  });
  const uniformBlack = new THREE.MeshStandardMaterial({
    color: 0x111417,
    metalness: 0.06,
    roughness: 0.8,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffd1b3,
    metalness: 0.03,
    roughness: 0.76,
  });

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.26), uniformDark);
  hips.position.y = 0.92;
  group.add(hips);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.76, 0.32), uniformDark);
  torso.position.y = 1.38;
  group.add(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.18), uniformBlack);
  vest.position.set(0, 1.35, 0.12);
  group.add(vest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skinMat);
  head.position.y = 1.88;
  group.add(head);

  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), uniformBlack);
  capTop.position.y = 2.03;
  group.add(capTop);
  const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.18), uniformBlack);
  capBrim.position.set(0, 1.98, 0.14);
  group.add(capBrim);

  const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.5, 0.17), uniformBlack);
  leftThigh.position.set(-0.12, 0.62, 0);
  const rightThigh = leftThigh.clone();
  rightThigh.position.x = 0.12;
  group.add(leftThigh, rightThigh);

  const leftCalf = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.44, 0.15), uniformBlack);
  leftCalf.position.set(-0.12, 0.2, 0);
  const rightCalf = leftCalf.clone();
  rightCalf.position.x = 0.12;
  group.add(leftCalf, rightCalf);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.14), uniformDark);
  leftArm.position.set(-0.36, 1.4, 0);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.36;
  group.add(leftArm, rightArm);

  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), uniformDark);
  leftForearm.position.set(-0.36, 0.98, 0);
  const rightForearm = leftForearm.clone();
  rightForearm.position.x = 0.36;
  group.add(leftForearm, rightForearm);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.34), uniformBlack);
  belt.position.y = 1.02;
  group.add(belt);

  group.userData = group.userData || {};
  group.userData.head = head;
  group.userData.torso = torso;
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  group.userData.walk = (time, speed = 1) => {
    const swing = Math.sin(time * 6.5 * speed) * 0.52;
    leftThigh.rotation.x = swing * 0.65;
    rightThigh.rotation.x = -swing * 0.65;
    leftCalf.rotation.x = -swing * 0.3;
    rightCalf.rotation.x = swing * 0.3;
    leftArm.rotation.x = -swing * 0.45;
    rightArm.rotation.x = swing * 0.45;
    leftForearm.rotation.x = -swing * 0.2;
    rightForearm.rotation.x = swing * 0.2;
  };

  group.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });

  return group;
}
