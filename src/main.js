import * as THREE from 'three';
import './style.css';
import { createCar } from './carDesign';
import { createPoliceCar, createPoliceOfficer } from './policeDesign';
import { createSkyscraper } from './skyscraperGenerator';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (start, end, alpha) => start + (end - start) * alpha;
const moveTowards = (current, target, maxDelta) => {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }
  return current + Math.sign(target - current) * maxDelta;
};
const normalizeAngle = (angle) => {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
};
const moveAngleTowards = (current, target, maxDelta) => {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxDelta) {
    return target;
  }
  return current + Math.sign(delta) * maxDelta;
};
const fraction = (value) => value - Math.floor(value);
const noise2D = (x, z, offset = 0) =>
  fraction(Math.sin(x * 12.9898 + z * 78.233 + offset * 31.415) * 43758.5453);
const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const headingFromPoints = (from, to) => Math.atan2(to.z - from.z, to.x - from.x);
const formatMoney = (value) => `$${Math.round(value)}`;
const ordinal = (value) => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
};
const hashInts = (x, z, offset = 0) => Math.floor(noise2D(x, z, offset) * 1000000);

const canvas = document.getElementById('game');
const hudEl = document.getElementById('hud');
const backpackPanelEl = document.getElementById('backpack-panel');
const phonePanelEl = document.getElementById('phone-panel');
const centerPanelEl = document.getElementById('shop-panel');
const toastEl = document.getElementById('toast');
const touchControlsEl = document.getElementById('touch-controls');
const actionBarEl = document.getElementById('action-bar');

const CHUNK_SIZE = 240;
const CHUNK_RANGE = 2;
const ROAD_WIDTH = 22;
const SIDEWALK_WIDTH = 5;
const CONTROLLED_INTERSECTION_HALF = 10;
const CITY_BONUS_INTERVAL = 35;
const SPEED_LIMIT = 28;
const TOTAL_LAPS = 3;
const TRACK_RADIUS = 96;
const TRACK_WIDTH = 24;
const TRACK_OUTER_RADIUS = TRACK_RADIUS + TRACK_WIDTH / 2;
const TRACK_INNER_RADIUS = TRACK_RADIUS - TRACK_WIDTH / 2;

const ROAD_LINES = [-70, 0, 70];
const BLOCK_CENTERS = [-105, -35, 35, 105];

const CITY_SPAWN = new THREE.Vector3(-92, 0, -18);
const TRACK_CENTER = new THREE.Vector3(0, 0, 930);
const TRACK_SPAWN = new THREE.Vector3(TRACK_CENTER.x, 0, TRACK_CENTER.z - TRACK_RADIUS);

const places = [
  {
    id: 'gas',
    type: 'gas',
    name: 'Fuel Plaza',
    position: new THREE.Vector3(-105, 0, -35),
    lot: { w: 34, d: 24 },
    radius: 18,
    accent: 0xf6bd60,
    entryOffset: new THREE.Vector3(0, 0, 16),
  },
  {
    id: 'dealer',
    type: 'dealer',
    name: 'Sunset Motors',
    position: new THREE.Vector3(105, 0, -35),
    lot: { w: 38, d: 26 },
    radius: 18,
    accent: 0x84dcc6,
    entryOffset: new THREE.Vector3(0, 0, 17),
  },
  {
    id: 'mods',
    type: 'mods',
    name: 'Torque Customs',
    position: new THREE.Vector3(35, 0, -35),
    lot: { w: 34, d: 24 },
    radius: 16,
    accent: 0xb388eb,
    entryOffset: new THREE.Vector3(0, 0, 15),
  },
  {
    id: 'cafe',
    type: 'business',
    name: 'Corner Cafe',
    jobTitle: 'Barista',
    pay: 55,
    position: new THREE.Vector3(-35, 0, 105),
    lot: { w: 26, d: 24 },
    radius: 14,
    accent: 0xff7b54,
    entryOffset: new THREE.Vector3(0, 0, 14),
  },
  {
    id: 'courier',
    type: 'business',
    name: 'Parcel Point',
    jobTitle: 'Courier',
    pay: 85,
    position: new THREE.Vector3(35, 0, 105),
    lot: { w: 30, d: 24 },
    radius: 14,
    accent: 0xf4d35e,
    entryOffset: new THREE.Vector3(0, 0, 14),
  },
  {
    id: 'office',
    type: 'business',
    name: 'Tech Hub',
    jobTitle: 'Office Clerk',
    pay: 70,
    position: new THREE.Vector3(105, 0, 105),
    lot: { w: 30, d: 24 },
    radius: 14,
    accent: 0x4cc9f0,
    entryOffset: new THREE.Vector3(0, 0, 14),
  },
  {
    id: 'jail',
    type: 'jail',
    name: 'Metro Jail',
    position: new THREE.Vector3(-105, 0, 105),
    lot: { w: 32, d: 28 },
    radius: 18,
    accent: 0xadb5bd,
    entryOffset: new THREE.Vector3(0, 0, 16),
  },
  {
    id: 'track',
    type: 'track',
    name: 'Sunset Speedway',
    position: TRACK_CENTER.clone(),
    radius: 160,
    accent: 0xffcf56,
  },
];

const placeById = new Map(places.map((place) => [place.id, place]));

const carCatalog = [
  {
    id: 'starter',
    name: 'Starter Coupe',
    price: 0,
    color: 0x4cc9f0,
    maxSpeedBonus: 0,
    accelBonus: 0,
  },
  {
    id: 'sprinter',
    name: 'Sprinter GT',
    price: 260,
    color: 0xff595e,
    maxSpeedBonus: 7,
    accelBonus: 5,
  },
  {
    id: 'executive',
    name: 'Executive LX',
    price: 520,
    color: 0x80ed99,
    maxSpeedBonus: 12,
    accelBonus: 8,
  },
];

const pickupCatalog = [
  { name: 'Street Parcel', value: 18, color: 0xffbe0b },
  { name: 'Tool Crate', value: 30, color: 0xf3722c },
  { name: 'Snack Box', value: 14, color: 0x90be6d },
  { name: 'Spare Parts', value: 36, color: 0x4cc9f0 },
];

const pickupSpawns = [
  new THREE.Vector3(-30, 0, -90),
  new THREE.Vector3(30, 0, -90),
  new THREE.Vector3(-90, 0, 30),
  new THREE.Vector3(90, 0, 30),
  new THREE.Vector3(-30, 0, 30),
  new THREE.Vector3(30, 0, 30),
  new THREE.Vector3(-70, 0, 140),
  new THREE.Vector3(70, 0, 140),
];

const state = {
  mode: 'driving',
  money: 180,
  gas: 100,
  gasMax: 100,
  backpack: [],
  backpackCapacity: 6,
  lawfulPayout: 100,
  carCondition: 100,
  cityBonusTimer: 0,
  speedingTimer: 0,
  offRoadTimer: 0,
  totalViolations: 0,
  engineLevel: 0,
  tankLevel: 0,
  handlingLevel: 0,
  armorLevel: 0,
  carModelId: 'starter',
  interactionId: null,
  centerPanel: null,
  phoneOpen: false,
  backpackOpen: false,
  gpsTargetId: null,
  wantedHeat: 0,
  wantedLevel: 0,
  wantedTimer: 0,
  wantedStartTime: -999,
  policeVehiclePursuit: false,
  arrestMeter: 0,
  jailTimer: 0,
  raceFinished: false,
  trackRaceActive: false,
  finishOrderCounter: 0,
  currentJobId: null,
  lastJobTimes: {},
  uiDirty: true,
  outOfGasToastShown: false,
  lastCollisionPenaltyTime: -10,
  lastBackpackFullToastTime: -10,
  cameraYaw: 0,
  cameraPitch: 0.38,
  pointerLocked: false,
  nextOfficerSpawnAt: 0,
  lastConditionHitTime: -10,
  fps: 60,
};

const keys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  brake: false,
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x96cdf8);
scene.fog = new THREE.Fog(0x96cdf8, 180, 420);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(-30, 16, -26);

const clock = new THREE.Clock();
let elapsedTime = 0;
let toastTimeoutId = 0;

const cityChunks = new Map();
const trafficLights = [];
const pickups = [];
const worldColliders = [];

function getChunkIndex(value) {
  return Math.floor((value + CHUNK_SIZE / 2) / CHUNK_SIZE);
}

function getChunkOrigin(index) {
  return index * CHUNK_SIZE;
}

function toChunkLocal(value) {
  return value - getChunkOrigin(getChunkIndex(value));
}

function isNearTrackChunk(chunkX, chunkZ) {
  const trackChunkX = getChunkIndex(TRACK_CENTER.x);
  const trackChunkZ = getChunkIndex(TRACK_CENTER.z);
  return Math.abs(chunkX - trackChunkX) <= 1 && Math.abs(chunkZ - trackChunkZ) <= 1;
}

function getDistrictName(position) {
  if (distanceXZ(position, TRACK_CENTER) < 150) {
    return 'Sunset Speedway';
  }

  const nearbyPlace = places.find(
    (place) => place.type !== 'track' && distanceXZ(position, place.position) < place.radius + 18,
  );
  if (nearbyPlace) {
    return nearbyPlace.name;
  }

  const cx = getChunkIndex(position.x);
  const cz = getChunkIndex(position.z);
  const adjectives = ['Maple', 'Copper', 'Sunset', 'Harbor', 'Ridge', 'Cedar', 'Metro'];
  const nouns = ['Heights', 'Cross', 'Quarter', 'Market', 'Gardens', 'Point', 'Square'];
  const hash = Math.abs(hashInts(cx, cz, 9));
  return `${adjectives[hash % adjectives.length]} ${nouns[Math.floor(hash / 7) % nouns.length]}`;
}

function isRoadLocal(localX, localZ) {
  return (
    ROAD_LINES.some((line) => Math.abs(localX - line) <= ROAD_WIDTH / 2) ||
    ROAD_LINES.some((line) => Math.abs(localZ - line) <= ROAD_WIDTH / 2)
  );
}

function isSidewalkLocal(localX, localZ) {
  const onWideVertical = ROAD_LINES.some(
    (line) => Math.abs(localX - line) <= ROAD_WIDTH / 2 + SIDEWALK_WIDTH,
  );
  const onWideHorizontal = ROAD_LINES.some(
    (line) => Math.abs(localZ - line) <= ROAD_WIDTH / 2 + SIDEWALK_WIDTH,
  );
  return (onWideVertical || onWideHorizontal) && !isRoadLocal(localX, localZ);
}

function isInLot(x, z, place) {
  if (!place.lot) {
    return false;
  }
  return (
    Math.abs(x - place.position.x) <= place.lot.w / 2 &&
    Math.abs(z - place.position.z) <= place.lot.d / 2
  );
}

function isOnRaceTrack(x, z) {
  const radius = Math.hypot(x - TRACK_CENTER.x, z - TRACK_CENTER.z);
  return radius >= TRACK_INNER_RADIUS && radius <= TRACK_OUTER_RADIUS;
}

function isPaved(x, z) {
  if (isOnRaceTrack(x, z)) {
    return true;
  }
  if (places.some((place) => place.type !== 'track' && isInLot(x, z, place))) {
    return true;
  }
  return isRoadLocal(toChunkLocal(x), toChunkLocal(z)) || isSidewalkLocal(toChunkLocal(x), toChunkLocal(z));
}

function terrainHeightAt(x, z) {
  if (isPaved(x, z)) {
    return -0.12;
  }
  return (
    Math.sin(x * 0.035) * 1.2 +
    Math.cos(z * 0.04) * 0.85 +
    Math.sin((x + z) * 0.028) * 0.4
  );
}

function addShadow(group) {
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function addBoxCollider(minX, maxX, minZ, maxZ, options = {}) {
  worldColliders.push({
    minX,
    maxX,
    minZ,
    maxZ,
    chunkKey: options.chunkKey || null,
    damage: options.damage || 0,
  });
}

function removeCollidersForChunk(chunkKey) {
  for (let index = worldColliders.length - 1; index >= 0; index -= 1) {
    if (worldColliders[index].chunkKey === chunkKey) {
      worldColliders.splice(index, 1);
    }
  }
  for (let index = trafficLights.length - 1; index >= 0; index -= 1) {
    if (trafficLights[index].chunkKey === chunkKey) {
      trafficLights.splice(index, 1);
    }
  }
}

function resolveAxisMovement(position, radius, delta, axis) {
  let collided = false;
  worldColliders.forEach((collider) => {
    const withinOtherAxis =
      axis === 'x'
        ? position.z >= collider.minZ - radius && position.z <= collider.maxZ + radius
        : position.x >= collider.minX - radius && position.x <= collider.maxX + radius;
    if (!withinOtherAxis) {
      return;
    }

    if (axis === 'x') {
      if (position.x >= collider.minX - radius && position.x <= collider.maxX + radius) {
        position.x = delta > 0 ? collider.minX - radius : collider.maxX + radius;
        collided = true;
      }
    } else if (position.z >= collider.minZ - radius && position.z <= collider.maxZ + radius) {
      position.z = delta > 0 ? collider.minZ - radius : collider.maxZ + radius;
      collided = true;
    }
  });
  return collided;
}

function moveBodyWithCollisions(position, deltaX, deltaZ, radius) {
  const distance = Math.hypot(deltaX, deltaZ);
  const stepCount = Math.max(1, Math.ceil(distance / Math.max(radius * 0.7, 0.22)));
  const stepX = deltaX / stepCount;
  const stepZ = deltaZ / stepCount;
  let collided = false;

  for (let step = 0; step < stepCount; step += 1) {
    position.x += stepX;
    const hitX = stepX !== 0 ? resolveAxisMovement(position, radius, stepX, 'x') : false;
    position.z += stepZ;
    const hitZ = stepZ !== 0 ? resolveAxisMovement(position, radius, stepZ, 'z') : false;
    collided = collided || hitX || hitZ;
  }

  return collided;
}

function createGlowMarker(color, radius, height = 10) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.26, 14, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88 }),
  );
  ring.rotation.x = Math.PI / 2;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.12, radius * 0.12, height, 14, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  beam.position.y = height / 2;
  group.add(ring, beam);
  scene.add(group);
  return { group, ring, beam };
}

function createCarMesh(colorValue, police = false) {
  const group = police
    ? createPoliceCar({ color: colorValue, scale: 1.35, name: 'PoliceCar' })
    : createCar({ color: colorValue, scale: 1.35, name: 'StreetCar' });
  const bodyMaterial = group.userData.bodyMaterial;
  const frontWheelPivots = group.userData.frontWheelPivots || [];
  const wheelMeshes = group.userData.wheels || [];
  const sirens = group.userData.beacons || [];

  // The imported model points down +Z, while gameplay heading points down +X.
  // This offset keeps vehicle movement and visuals aligned.
  const headingOffset = Math.PI / 2;

  return {
    group,
    bodyMaterial,
    frontWheelPivots,
    wheelMeshes,
    sirens,
    headingOffset,
    groundOffset: 0.03,
  };
}

function createVehicle({
  name,
  color,
  position,
  heading = 0,
  maxSpeed = 34,
  acceleration = 24,
  turnRate = 2,
  police = false,
}) {
  const mesh = createCarMesh(color, police);
  scene.add(mesh.group);
  return {
    name,
    mesh,
    position: position.clone(),
    heading,
    speed: 0,
    steerAngle: 0,
    wheelSpin: 0,
    maxSpeed,
    acceleration,
    turnRate,
    reverseSpeed: 10,
    routeIndex: 1,
    laps: 0,
    finishedOrder: null,
    active: true,
  };
}

function createAvatar() {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.7, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x264653, roughness: 0.95 }),
  );
  torso.position.y = 1.95;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 18),
    new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.9 }),
  );
  head.position.y = 3.2;
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 1.2, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 1 }),
  );
  const rightLeg = leftLeg.clone();
  leftLeg.position.set(-0.22, 0.75, 0);
  rightLeg.position.set(0.22, 0.75, 0);
  group.add(torso, head, leftLeg, rightLeg);
  addShadow(group);
  scene.add(group);
  return {
    group,
    position: CITY_SPAWN.clone(),
    heading: 0,
    speed: 0,
  };
}

const player = createVehicle({
  name: 'You',
  color: carCatalog[0].color,
  position: CITY_SPAWN.clone(),
  heading: 0.1,
  maxSpeed: 36,
  acceleration: 24,
  turnRate: 2.2,
});

const policeCar = createVehicle({
  name: 'Police',
  color: 0x1d3557,
  position: CITY_SPAWN.clone().add(new THREE.Vector3(-30, 0, -30)),
  heading: 0,
  maxSpeed: 42,
  acceleration: 28,
  turnRate: 2.4,
  police: true,
});
policeCar.mesh.group.visible = false;

const trackRoute = Array.from({ length: 16 }, (_, index) => {
  const angle = -Math.PI / 2 + (index / 16) * Math.PI * 2;
  return new THREE.Vector3(
    TRACK_CENTER.x + Math.cos(angle) * TRACK_RADIUS,
    0,
    TRACK_CENTER.z + Math.sin(angle) * TRACK_RADIUS,
  );
});

const trackBots = [
  createVehicle({
    name: 'Turbo',
    color: 0xff595e,
    position: TRACK_SPAWN.clone().add(new THREE.Vector3(-6, 0, 0)),
    maxSpeed: 29,
    acceleration: 17,
    turnRate: 1.9,
  }),
  createVehicle({
    name: 'Nova',
    color: 0xffca3a,
    position: TRACK_SPAWN.clone().add(new THREE.Vector3(-12, 0, -4)),
    maxSpeed: 27.8,
    acceleration: 16.5,
    turnRate: 1.84,
  }),
  createVehicle({
    name: 'Echo',
    color: 0x8ac926,
    position: TRACK_SPAWN.clone().add(new THREE.Vector3(-18, 0, -8)),
    maxSpeed: 26.8,
    acceleration: 16,
    turnRate: 1.8,
  }),
];

const avatar = createAvatar();
avatar.group.visible = false;

function createOfficerMesh() {
  const group = createPoliceOfficer({ name: 'Officer' });
  group.scale.setScalar(1.65);
  scene.add(group);
  group.visible = false;
  return {
    group,
    position: new THREE.Vector3(),
    heading: 0,
    speed: 0,
    active: false,
  };
}

const gpsMarker = createGlowMarker(0x4cc9f0, 4.5, 14);
const checkpointMarker = createGlowMarker(0xf6d365, 5.5, 12);
const focusRing = new THREE.Mesh(
  new THREE.RingGeometry(2.2, 3.1, 32),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  }),
);
focusRing.rotation.x = -Math.PI / 2;
scene.add(focusRing);

const gpsArrows = Array.from({ length: 6 }, () => {
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(),
    5.2,
    0x4cc9f0,
    1.8,
    1.05,
  );
  scene.add(arrow);
  return arrow;
});

const officers = Array.from({ length: 5 }, () => createOfficerMesh());

const stoplightPhases = [
  { duration: 10, ns: 'green', ew: 'red', label: 'North/South Green' },
  { duration: 2.5, ns: 'yellow', ew: 'red', label: 'North/South Yellow' },
  { duration: 10, ns: 'red', ew: 'green', label: 'East/West Green' },
  { duration: 2.5, ns: 'red', ew: 'yellow', label: 'East/West Yellow' },
];

const stoplightState = {
  phaseIndex: 0,
  timer: 0,
  ns: stoplightPhases[0].ns,
  ew: stoplightPhases[0].ew,
  label: stoplightPhases[0].label,
};

function createTrafficLightPole(x, z, axis, rotationY) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeightAt(x, z) + 0.08, z);
  group.rotation.y = rotationY;

  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.8 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 7, 10), poleMaterial);
  pole.position.y = 3.5;

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 3), poleMaterial);
  arm.position.set(0, 6.4, 1.3);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 2.6, 0.95),
    new THREE.MeshStandardMaterial({ color: 0x181b22, roughness: 0.7 }),
  );
  body.position.set(0, 5.7, 2.55);

  const bulbGeometry = new THREE.SphereGeometry(0.18, 12, 12);
  const red = new THREE.Mesh(
    bulbGeometry,
    new THREE.MeshStandardMaterial({ color: 0x3a1619, emissive: 0x000000 }),
  );
  const yellow = new THREE.Mesh(
    bulbGeometry,
    new THREE.MeshStandardMaterial({ color: 0x46340d, emissive: 0x000000 }),
  );
  const green = new THREE.Mesh(
    bulbGeometry,
    new THREE.MeshStandardMaterial({ color: 0x12331a, emissive: 0x000000 }),
  );
  red.position.set(0, 6.45, 3.05);
  yellow.position.set(0, 5.75, 3.05);
  green.position.set(0, 5.05, 3.05);
  group.add(pole, arm, body, red, yellow, green);
  addShadow(group);
  return { axis, group, red, yellow, green };
}

function createStreetLamp(x, z) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeightAt(x, z), z);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 7.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x525b66, roughness: 0.85 }),
  );
  pole.position.y = 3.7;
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x525b66, roughness: 0.85 }),
  );
  arm.position.set(0, 6.9, 1.1);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xfff1b8,
      emissive: 0x6b5d18,
      emissiveIntensity: 0.35,
    }),
  );
  bulb.position.set(0, 6.7, 2.1);
  group.add(pole, arm, bulb);
  addShadow(group);
  return group;
}

function createTree(x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeightAt(x, z), z);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24 * scale, 0.3 * scale, 2.8 * scale, 10),
    new THREE.MeshStandardMaterial({ color: 0x6f4e37, roughness: 0.95 }),
  );
  trunk.position.y = 1.4 * scale;

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.55 * scale, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0x4f8a3d, roughness: 0.95 }),
  );
  canopy.position.y = 3.6 * scale;

  const canopyTop = new THREE.Mesh(
    new THREE.SphereGeometry(1.2 * scale, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x5da344, roughness: 0.95 }),
  );
  canopyTop.position.set(0.35 * scale, 4.25 * scale, -0.2 * scale);

  group.add(trunk, canopy, canopyTop);
  addShadow(group);
  return group;
}

function createBench(x, z, rotationY = 0) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeightAt(x, z) + 0.02, z);
  group.rotation.y = rotationY;

  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x9c6644, roughness: 0.85 });
  const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x5c6770, roughness: 0.8 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.55), woodMaterial);
  seat.position.y = 0.95;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.5), woodMaterial);
  back.position.set(0, 1.35, -0.22);
  back.rotation.x = -0.32;

  [-0.7, 0.7].forEach((offsetX) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), metalMaterial);
    leg.position.set(offsetX, 0.45, 0);
    group.add(leg);
  });

  group.add(seat, back);
  addShadow(group);
  return group;
}

function setTrafficLightPhase(index) {
  const phase = stoplightPhases[index];
  stoplightState.phaseIndex = index;
  stoplightState.timer = 0;
  stoplightState.ns = phase.ns;
  stoplightState.ew = phase.ew;
  stoplightState.label = phase.label;
  trafficLights.forEach((light) => {
    const active = light.axis === 'ns' ? stoplightState.ns : stoplightState.ew;
    light.red.material.emissive.setHex(active === 'red' ? 0xff3b3f : 0x000000);
    light.red.material.color.setHex(active === 'red' ? 0xff6b6f : 0x3a1619);
    light.yellow.material.emissive.setHex(active === 'yellow' ? 0xffd166 : 0x000000);
    light.yellow.material.color.setHex(active === 'yellow' ? 0xffd166 : 0x46340d);
    light.green.material.emissive.setHex(active === 'green' ? 0x70e000 : 0x000000);
    light.green.material.color.setHex(active === 'green' ? 0x80ed99 : 0x12331a);
  });
}

function createChunkTerrain(chunkX, chunkZ) {
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 26, 26);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const localX = positions.getX(index);
    const localZ = -positions.getY(index);
    const worldX = getChunkOrigin(chunkX) + localX;
    const worldZ = getChunkOrigin(chunkZ) + localZ;
    positions.setZ(index, terrainHeightAt(worldX, worldZ));
  }
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x4f7c46,
      roughness: 0.98,
      metalness: 0.02,
    }),
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.set(getChunkOrigin(chunkX), 0, getChunkOrigin(chunkZ));
  terrain.receiveShadow = true;
  return terrain;
}

function createChunkRoads(group, chunkX, chunkZ) {
  const originX = getChunkOrigin(chunkX);
  const originZ = getChunkOrigin(chunkZ);
  const chunkKey = `${chunkX},${chunkZ}`;
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9c1b3,
    roughness: 0.9,
    metalness: 0.02,
  });
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2e37,
    roughness: 0.95,
    metalness: 0.04,
  });
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf6d365,
    emissive: 0x362708,
    roughness: 0.45,
    metalness: 0.05,
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xf8f4eb, roughness: 0.55 });

  ROAD_LINES.forEach((line) => {
    const sidewalk = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH + SIDEWALK_WIDTH * 2, CHUNK_SIZE),
      sidewalkMaterial,
    );
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(originX + line, 0.05, originZ);
    group.add(sidewalk);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_SIZE), roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(originX + line, 0.08, originZ);
    group.add(road);

    const sidewalkH = new THREE.Mesh(
      new THREE.PlaneGeometry(CHUNK_SIZE, ROAD_WIDTH + SIDEWALK_WIDTH * 2),
      sidewalkMaterial,
    );
    sidewalkH.rotation.x = -Math.PI / 2;
    sidewalkH.position.set(originX, 0.05, originZ + line);
    group.add(sidewalkH);

    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_SIZE, ROAD_WIDTH), roadMaterial);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(originX, 0.08, originZ + line);
    group.add(roadH);

    for (let dashIndex = 0; dashIndex < Math.floor(CHUNK_SIZE / 12); dashIndex += 1) {
      const offset = -CHUNK_SIZE / 2 + 10 + dashIndex * 12;
      const verticalDash = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.08, 6),
        stripeMaterial,
      );
      verticalDash.position.set(originX + line, 0.12, originZ + offset);
      group.add(verticalDash);

      const horizontalDash = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.08, 0.8),
        stripeMaterial,
      );
      horizontalDash.position.set(originX + offset, 0.12, originZ + line);
      group.add(horizontalDash);
    }

    [
      { x: originX + line - ROAD_WIDTH / 2 + 1.7, z: originZ, w: 0.35, h: CHUNK_SIZE },
      { x: originX + line + ROAD_WIDTH / 2 - 1.7, z: originZ, w: 0.35, h: CHUNK_SIZE },
      { x: originX, z: originZ + line - ROAD_WIDTH / 2 + 1.7, w: CHUNK_SIZE, h: 0.35 },
      { x: originX, z: originZ + line + ROAD_WIDTH / 2 - 1.7, w: CHUNK_SIZE, h: 0.35 },
    ].forEach((lineMesh) => {
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(lineMesh.w, 0.05, lineMesh.h),
        edgeMaterial,
      );
      edge.position.set(lineMesh.x, 0.11, lineMesh.z);
      group.add(edge);
    });
  });

  const stopLines = [
    { x: originX + 11.5, z: originZ, w: 0.5, h: ROAD_WIDTH - 4 },
    { x: originX - 11.5, z: originZ, w: 0.5, h: ROAD_WIDTH - 4 },
    { x: originX, z: originZ + 11.5, w: ROAD_WIDTH - 4, h: 0.5 },
    { x: originX, z: originZ - 11.5, w: ROAD_WIDTH - 4, h: 0.5 },
  ];
  stopLines.forEach((line) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(line.w, 0.06, line.h),
      new THREE.MeshStandardMaterial({ color: 0xf8f4eb }),
    );
    mesh.position.set(line.x, 0.11, line.z);
    group.add(mesh);
  });

  [
    { baseX: originX + 16.5, baseZ: originZ - 8.5, vertical: true },
    { baseX: originX - 16.5, baseZ: originZ - 8.5, vertical: true },
    { baseX: originX - 8.5, baseZ: originZ + 16.5, vertical: false },
    { baseX: originX - 8.5, baseZ: originZ - 16.5, vertical: false },
  ].forEach((crosswalk) => {
    for (let stripe = 0; stripe < 6; stripe += 1) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(crosswalk.vertical ? 2.4 : 1.1, 0.05, crosswalk.vertical ? 1.1 : 2.4),
        new THREE.MeshStandardMaterial({ color: 0xf8f4eb, roughness: 0.55 }),
      );
      mesh.position.set(
        crosswalk.baseX + (crosswalk.vertical ? 0 : stripe * 2.05),
        0.115,
        crosswalk.baseZ + (crosswalk.vertical ? stripe * 2.05 : 0),
      );
      group.add(mesh);
    }
  });

  [
    createTrafficLightPole(originX + 12, originZ + 7, 'ew', Math.PI),
    createTrafficLightPole(originX - 12, originZ - 7, 'ew', 0),
    createTrafficLightPole(originX - 7, originZ + 12, 'ns', -Math.PI / 2),
    createTrafficLightPole(originX + 7, originZ - 12, 'ns', Math.PI / 2),
  ].forEach((light) => {
    light.chunkKey = chunkKey;
    trafficLights.push(light);
    group.add(light.group);
    addBoxCollider(light.group.position.x - 0.6, light.group.position.x + 0.6, light.group.position.z - 0.6, light.group.position.z + 0.6, {
      chunkKey,
      damage: 6,
    });
  });

  [
    [originX - 84, originZ - 84],
    [originX + 84, originZ - 84],
    [originX - 84, originZ + 84],
    [originX + 84, originZ + 84],
    [originX - 14, originZ - 84],
    [originX + 14, originZ + 84],
    [originX - 84, originZ + 14],
    [originX + 84, originZ - 14],
  ].forEach(([lampX, lampZ]) => {
    const lamp = createStreetLamp(lampX, lampZ);
    group.add(lamp);
    addBoxCollider(lampX - 0.55, lampX + 0.55, lampZ - 0.55, lampZ + 0.55, {
      chunkKey,
      damage: 4,
    });
  });

  [
    [originX - 52, originZ - 52, 1.05],
    [originX + 52, originZ - 52, 0.95],
    [originX - 52, originZ + 52, 0.9],
    [originX + 52, originZ + 52, 1.1],
    [originX - 102, originZ - 22, 0.88],
    [originX + 102, originZ + 22, 0.92],
    [originX - 22, originZ + 102, 0.84],
    [originX + 22, originZ - 102, 0.84],
  ].forEach(([treeX, treeZ, scale]) => {
    if (isNearSpecialFootprint(treeX, treeZ)) {
      return;
    }
    const tree = createTree(treeX, treeZ, scale);
    group.add(tree);
    addBoxCollider(treeX - 0.45, treeX + 0.45, treeZ - 0.45, treeZ + 0.45, {
      chunkKey,
      damage: 3,
    });
  });

  [
    [originX - 18, originZ - 32, 0],
    [originX + 18, originZ + 32, Math.PI],
    [originX - 32, originZ + 18, Math.PI / 2],
    [originX + 32, originZ - 18, -Math.PI / 2],
  ].forEach(([benchX, benchZ, rotationY]) => {
    if (isNearSpecialFootprint(benchX, benchZ)) {
      return;
    }
    group.add(createBench(benchX, benchZ, rotationY));
  });
}

function isNearSpecialFootprint(worldX, worldZ) {
  return places.some((place) => {
    if (!place.lot || place.type === 'track') {
      return false;
    }
    return (
      Math.abs(worldX - place.position.x) < place.lot.w / 2 + 20 &&
      Math.abs(worldZ - place.position.z) < place.lot.d / 2 + 20
    );
  });
}

function createBuildingCluster(group, worldX, worldZ, seedA, seedB, chunkKey) {
  const clusterCount = 1 + Math.floor(noise2D(seedA, seedB, 4) * 3);
  for (let index = 0; index < clusterCount; index += 1) {
    const seed = index + 1;
    const offsetX = (noise2D(seedA, seedB, seed) - 0.5) * 16;
    const offsetZ = (noise2D(seedA + 7, seedB - 11, seed) - 0.5) * 16;
    const width = 8 + noise2D(seedA, seedB, seed + 10) * 7;
    const depth = 8 + noise2D(seedA + 3, seedB, seed + 15) * 7;
    const height = 12 + noise2D(seedA - 6, seedB + 5, seed + 20) * 34;
    const color = new THREE.Color().setHSL(
      0.04 + noise2D(seedA, seedB, seed + 25) * 0.12,
      0.18 + noise2D(seedA, seedB, seed + 30) * 0.12,
      0.42 + noise2D(seedA, seedB, seed + 35) * 0.18,
    );

    const bx = worldX + offsetX;
    const bz = worldZ + offsetZ;
    const baseY = terrainHeightAt(bx, bz);
    const skyscraperRoll = noise2D(seedA + 17, seedB - 9, seed + 63);

    if (skyscraperRoll > 0.84 && height > 25) {
      const towerWidth = clamp(width * 0.62, 5.4, 8.4);
      const towerDepth = clamp(depth * 0.62, 5.4, 8.4);
      const towerFloors = 14 + Math.floor(noise2D(seedA + 39, seedB - 28, seed + 44) * 15);
      const tower = createSkyscraper({
        floors: towerFloors,
        floorHeight: 0.48,
        width: towerWidth,
        depth: towerDepth,
        color: color.getHex(),
        windowLitProbability: 0.2,
      });
      tower.position.set(bx, baseY, bz);
      group.add(tower);
      addBoxCollider(
        bx - towerWidth / 2,
        bx + towerWidth / 2,
        bz - towerDepth / 2,
        bz + towerDepth / 2,
        { chunkKey, damage: 9 },
      );
      continue;
    }

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.04 }),
    );
    building.position.set(bx, baseY + height / 2, bz);
    group.add(building);

    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xcfe8ff,
      emissive: 0x335c81,
      emissiveIntensity: 0.2,
      roughness: 0.22,
      metalness: 0.3,
    });
    [
      { x: bx, y: baseY + height * 0.56, z: bz + depth / 2 + 0.12, w: width * 0.68, h: height * 0.5, d: 0.16 },
      { x: bx, y: baseY + height * 0.56, z: bz - depth / 2 - 0.12, w: width * 0.68, h: height * 0.5, d: 0.16 },
    ].forEach((panel) => {
      const windowPanel = new THREE.Mesh(
        new THREE.BoxGeometry(panel.w, panel.h, panel.d),
        glassMaterial,
      );
      windowPanel.position.set(panel.x, panel.y, panel.z);
      group.add(windowPanel);
    });

    const rooftopUnit = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.28, 1.2, depth * 0.24),
      new THREE.MeshStandardMaterial({ color: 0xadb5bd, roughness: 0.88 }),
    );
    rooftopUnit.position.set(bx, baseY + height + 0.65, bz);
    group.add(rooftopUnit);
    addBoxCollider(bx - width / 2, bx + width / 2, bz - depth / 2, bz + depth / 2, {
      chunkKey,
      damage: 8,
    });
  }
}

function createChunkBuildings(group, chunkX, chunkZ) {
  if (isNearTrackChunk(chunkX, chunkZ)) {
    return;
  }
  const originX = getChunkOrigin(chunkX);
  const originZ = getChunkOrigin(chunkZ);
  const chunkKey = `${chunkX},${chunkZ}`;
  BLOCK_CENTERS.forEach((localX) => {
    BLOCK_CENTERS.forEach((localZ) => {
      const worldX = originX + localX;
      const worldZ = originZ + localZ;
      if (isNearSpecialFootprint(worldX, worldZ)) {
        return;
      }
      createBuildingCluster(group, worldX, worldZ, worldX * 0.2, worldZ * 0.2, chunkKey);
    });
  });
}

function createCityChunk(chunkX, chunkZ) {
  const group = new THREE.Group();
  group.add(createChunkTerrain(chunkX, chunkZ));
  if (!isNearTrackChunk(chunkX, chunkZ)) {
    createChunkRoads(group, chunkX, chunkZ);
    createChunkBuildings(group, chunkX, chunkZ);
  }
  addShadow(group);
  scene.add(group);
  return group;
}

function ensureCityChunks(centerPosition) {
  const centerChunkX = getChunkIndex(centerPosition.x);
  const centerChunkZ = getChunkIndex(centerPosition.z);
  const required = new Set();

  for (let dx = -CHUNK_RANGE; dx <= CHUNK_RANGE; dx += 1) {
    for (let dz = -CHUNK_RANGE; dz <= CHUNK_RANGE; dz += 1) {
      const chunkX = centerChunkX + dx;
      const chunkZ = centerChunkZ + dz;
      const key = `${chunkX},${chunkZ}`;
      required.add(key);
      if (!cityChunks.has(key)) {
        cityChunks.set(key, createCityChunk(chunkX, chunkZ));
      }
    }
  }

  Array.from(cityChunks.entries()).forEach(([key, group]) => {
    if (!required.has(key)) {
      scene.remove(group);
      removeCollidersForChunk(key);
      cityChunks.delete(key);
    }
  });
}

function createTrackArea() {
  const outerShape = new THREE.Shape();
  outerShape.absarc(0, 0, TRACK_OUTER_RADIUS, 0, Math.PI * 2, false);

  const hole = new THREE.Path();
  hole.absarc(0, 0, TRACK_INNER_RADIUS, 0, Math.PI * 2, true);
  outerShape.holes.push(hole);

  const asphalt = new THREE.Mesh(
    new THREE.ShapeGeometry(outerShape),
    new THREE.MeshStandardMaterial({ color: 0x30343f, roughness: 0.94, metalness: 0.04 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(TRACK_CENTER.x, 0.09, TRACK_CENTER.z);
  scene.add(asphalt);

  const infield = new THREE.Mesh(
    new THREE.CircleGeometry(TRACK_INNER_RADIUS - 2, 48),
    new THREE.MeshStandardMaterial({ color: 0x588157, roughness: 1 }),
  );
  infield.rotation.x = -Math.PI / 2;
  infield.position.set(TRACK_CENTER.x, 0.06, TRACK_CENTER.z);
  scene.add(infield);

  [
    { radius: TRACK_OUTER_RADIUS - 2.4, tube: 0.45, color: 0xf8f4eb },
    { radius: TRACK_INNER_RADIUS + 2.4, tube: 0.45, color: 0xf8f4eb },
    { radius: TRACK_RADIUS, tube: 0.2, color: 0xf6d365 },
  ].forEach((stripe) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(stripe.radius, stripe.tube, 12, 96),
      new THREE.MeshStandardMaterial({
        color: stripe.color,
        emissive: stripe.color === 0xf6d365 ? 0x3f3311 : 0x000000,
        roughness: 0.4,
        metalness: 0.05,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(TRACK_CENTER.x, 0.16, TRACK_CENTER.z);
    scene.add(ring);
  });

  const pit = new THREE.Mesh(
    new THREE.BoxGeometry(42, 0.2, 18),
    new THREE.MeshStandardMaterial({ color: 0x495057, roughness: 0.9 }),
  );
  pit.position.set(
    TRACK_CENTER.x + TRACK_OUTER_RADIUS + 18,
    terrainHeightAt(TRACK_CENTER.x + TRACK_OUTER_RADIUS + 18, TRACK_CENTER.z) + 0.06,
    TRACK_CENTER.z,
  );
  scene.add(pit);
  addBoxCollider(
    pit.position.x - 21,
    pit.position.x + 21,
    pit.position.z - 9,
    pit.position.z + 9,
    { damage: 7 },
  );

  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(44, 10, 12),
    new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.9 }),
  );
  stand.position.set(TRACK_CENTER.x, 5.1, TRACK_CENTER.z - TRACK_OUTER_RADIUS - 22);
  scene.add(stand);
  addBoxCollider(
    stand.position.x - 22,
    stand.position.x + 22,
    stand.position.z - 6,
    stand.position.z + 6,
    { damage: 7 },
  );

  const fence = new THREE.Mesh(
    new THREE.CylinderGeometry(TRACK_OUTER_RADIUS + 8, TRACK_OUTER_RADIUS + 8, 1.2, 64, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xadb5bd,
      transparent: true,
      opacity: 0.12,
    }),
  );
  fence.rotation.x = Math.PI / 2;
  fence.position.set(TRACK_CENTER.x, 0.62, TRACK_CENTER.z);
  scene.add(fence);

  const finishLine = new THREE.Group();
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.08, 1.6),
        new THREE.MeshStandardMaterial({
          color: (row + column) % 2 === 0 ? 0xf8f4eb : 0x14151a,
        }),
      );
      tile.position.set(
        TRACK_CENTER.x - 6.3 + column * 1.8,
        0.15,
        TRACK_CENTER.z - TRACK_RADIUS - 1.8 + row * 1.8,
      );
      finishLine.add(tile);
    }
  }
  scene.add(finishLine);
}

function createSpecialPlace(place) {
  if (place.type === 'track') {
    createTrackArea();
    return;
  }

  const group = new THREE.Group();
  const baseY = terrainHeightAt(place.position.x, place.position.z);
  place.entryPoint = place.position.clone().add(place.entryOffset || new THREE.Vector3());

  const lot = new THREE.Mesh(
    new THREE.BoxGeometry(place.lot.w, 0.2, place.lot.d),
    new THREE.MeshStandardMaterial({ color: 0xadb5bd, roughness: 0.92 }),
  );
  lot.position.set(place.position.x, baseY + 0.06, place.position.z);
  group.add(lot);

  if (place.type === 'gas') {
    const shop = new THREE.Mesh(
      new THREE.BoxGeometry(12, 6.5, 9),
      new THREE.MeshStandardMaterial({ color: 0xe7dfd1, roughness: 0.9 }),
    );
    shop.position.set(place.position.x - 6, baseY + 3.3, place.position.z + 3);
    group.add(shop);
    addBoxCollider(shop.position.x - 6, shop.position.x + 6, shop.position.z - 4.5, shop.position.z + 4.5, {
      damage: 7,
    });

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0xf4a261, roughness: 0.55 }),
    );
    canopy.position.set(place.position.x + 6, baseY + 6.1, place.position.z);
    group.add(canopy);

    [
      [2.5, -3.5],
      [2.5, 3.5],
      [10.5, -3.5],
      [10.5, 3.5],
    ].forEach(([offsetX, offsetZ]) => {
      const support = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 6, 0.45),
        new THREE.MeshStandardMaterial({ color: 0xf1faee, roughness: 0.5 }),
      );
      support.position.set(place.position.x + offsetX, baseY + 3.05, place.position.z + offsetZ);
      group.add(support);
      addBoxCollider(
        support.position.x - 0.45,
        support.position.x + 0.45,
        support.position.z - 0.45,
        support.position.z + 0.45,
        { damage: 5 },
      );
    });
  } else {
    const bodyWidth = place.lot.w * 0.62;
    const bodyDepth = place.lot.d * 0.6;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth, 7, bodyDepth),
      new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.9 }),
    );
    body.position.set(place.position.x, baseY + 3.6, place.position.z);
    group.add(body);
    addBoxCollider(
      place.position.x - bodyWidth / 2,
      place.position.x + bodyWidth / 2,
      place.position.z - bodyDepth / 2,
      place.position.z + bodyDepth / 2,
      { damage: 8 },
    );

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(place.lot.w * 0.7, 0.8, place.lot.d * 0.66),
      new THREE.MeshStandardMaterial({ color: place.accent, roughness: 0.55 }),
    );
    roof.position.set(place.position.x, baseY + 7.25, place.position.z);
    group.add(roof);

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2, 0.6),
      new THREE.MeshStandardMaterial({
        color: place.accent,
        emissive: place.accent,
        emissiveIntensity: 0.22,
      }),
    );
    sign.position.set(place.position.x, baseY + 5.5, place.position.z + place.lot.d * 0.3);
    group.add(sign);
  }

  place.entryMarker = createGlowMarker(place.accent, place.radius - 3, 9);
  place.entryMarker.group.position.set(place.entryPoint.x, terrainHeightAt(place.entryPoint.x, place.entryPoint.z) + 0.25, place.entryPoint.z);
  addShadow(group);
  scene.add(group);
  place.group = group;
}

function createPickups() {
  pickupSpawns.forEach((spawn, index) => {
    const type = pickupCatalog[index % pickupCatalog.length];
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.15, 0),
      new THREE.MeshStandardMaterial({
        color: type.color,
        emissive: type.color,
        emissiveIntensity: 0.35,
        roughness: 0.5,
        metalness: 0.15,
      }),
    );
    const pickup = {
      type,
      mesh,
      active: true,
      respawnTimer: 0,
      bobOffset: index * 0.6,
      position: spawn.clone(),
    };
    mesh.position.set(spawn.x, terrainHeightAt(spawn.x, spawn.z) + 2.2, spawn.z);
    scene.add(mesh);
    pickups.push(pickup);
  });
}

setTrafficLightPhase(0);

function showToast(message, type = 'good') {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type}`;
  window.clearTimeout(toastTimeoutId);
  toastTimeoutId = window.setTimeout(() => {
    toastEl.className = 'toast';
  }, 2500);
}

function getCarProfile() {
  return carCatalog.find((car) => car.id === state.carModelId) || carCatalog[0];
}

function applyPlayerCarTuning() {
  const profile = getCarProfile();
  const conditionFactor = lerp(0.45, 1, state.carCondition / 100);
  player.maxSpeed = (50 + profile.maxSpeedBonus + state.engineLevel * 7) * conditionFactor;
  player.acceleration = 31 + profile.accelBonus + state.engineLevel * 5;
  player.turnRate = 1.45 + state.handlingLevel * 0.16;
  player.mesh.bodyMaterial.color.setHex(profile.color);
}

function damageCar(amount, reason) {
  const scaledAmount = amount * (1 - state.armorLevel * 0.12);
  state.carCondition = clamp(state.carCondition - scaledAmount, 0, 100);
  if (reason && elapsedTime - state.lastConditionHitTime > 1.5) {
    state.lastConditionHitTime = elapsedTime;
    showToast(reason, 'bad');
  }
  if (state.carCondition <= 0.5) {
    showToast('Your car is wrecked. Visit Torque Customs for repairs.', 'bad');
  }
  markUiDirty();
}

function getSellAllValue() {
  return state.backpack.reduce((total, item) => total + item.value, 0);
}

function getTargetPosition(targetId = state.gpsTargetId) {
  if (!targetId) {
    return null;
  }
  if (targetId === 'car') {
    return player.position;
  }
  const place = placeById.get(targetId);
  if (!place) {
    return null;
  }
  return place.type === 'track' ? place.position : place.entryPoint || place.position;
}

function getTargetLabel(targetId = state.gpsTargetId) {
  if (!targetId) {
    return 'No GPS';
  }
  if (targetId === 'car') {
    return 'Your Car';
  }
  const place = placeById.get(targetId);
  return place ? place.name : 'No GPS';
}

function controlsLocked() {
  return Boolean(state.phoneOpen || state.backpackOpen || state.centerPanel || state.jailTimer > 0);
}

function markUiDirty() {
  state.uiDirty = true;
}

function releasePointerLock() {
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }
}

function closePanels() {
  state.phoneOpen = false;
  state.backpackOpen = false;
  state.centerPanel = null;
  phonePanelEl.classList.add('hidden');
  backpackPanelEl.classList.add('hidden');
  centerPanelEl.classList.add('hidden');
  markUiDirty();
}

function togglePhone() {
  state.phoneOpen = !state.phoneOpen;
  if (state.phoneOpen) {
    releasePointerLock();
    state.backpackOpen = false;
    state.centerPanel = null;
    phonePanelEl.classList.remove('hidden');
    backpackPanelEl.classList.add('hidden');
    centerPanelEl.classList.add('hidden');
  } else {
    phonePanelEl.classList.add('hidden');
  }
  markUiDirty();
}

function toggleBackpack() {
  state.backpackOpen = !state.backpackOpen;
  if (state.backpackOpen) {
    releasePointerLock();
    state.phoneOpen = false;
    state.centerPanel = null;
    backpackPanelEl.classList.remove('hidden');
    phonePanelEl.classList.add('hidden');
    centerPanelEl.classList.add('hidden');
  } else {
    backpackPanelEl.classList.add('hidden');
  }
  markUiDirty();
}

function openCenterPanel(panelId) {
  releasePointerLock();
  state.centerPanel = panelId;
  state.phoneOpen = false;
  state.backpackOpen = false;
  centerPanelEl.classList.remove('hidden');
  phonePanelEl.classList.add('hidden');
  backpackPanelEl.classList.add('hidden');
  markUiDirty();
}

function setGpsTarget(targetId) {
  state.gpsTargetId = targetId || null;
  showToast(state.gpsTargetId ? `GPS set to ${getTargetLabel(targetId)}.` : 'GPS cleared.');
  markUiDirty();
}

function buyUpgrade(cost, onSuccess, successMessage) {
  if (state.money < cost) {
    showToast('Not enough cash for that purchase.', 'bad');
    return;
  }
  state.money -= cost;
  onSuccess();
  showToast(typeof successMessage === 'function' ? successMessage() : successMessage);
  markUiDirty();
}

function applyPenalty(amount, message, wantedHeat = 0.4) {
  if (state.wantedHeat <= 0.05) {
    state.wantedStartTime = elapsedTime;
  }
  state.lawfulPayout = clamp(state.lawfulPayout - amount, 0, 100);
  state.totalViolations += 1;
  state.cityBonusTimer = 0;
  state.wantedHeat = clamp(state.wantedHeat + wantedHeat, 0, 5);
  state.wantedTimer = Math.max(state.wantedTimer, 30 + wantedHeat * 10);
  showToast(message, 'bad');
  markUiDirty();
}

function handleGasStationAction(action) {
  if (action === 'fuel') {
    if (state.gas >= state.gasMax - 1) {
      showToast('Your tank is already full.', 'bad');
      return;
    }
    buyUpgrade(
      25,
      () => {
        state.gas = clamp(state.gas + 40, 0, state.gasMax);
        state.outOfGasToastShown = false;
      },
      'Refueled 40 gas for $25.',
    );
    return;
  }

  if (action === 'engine') {
    if (state.engineLevel >= 3) {
      showToast('Your engine tune is already maxed out.', 'bad');
      return;
    }
    const cost = 90 + state.engineLevel * 45;
    buyUpgrade(
      cost,
      () => {
        state.engineLevel += 1;
        applyPlayerCarTuning();
      },
      () => `Installed engine tune level ${state.engineLevel}.`,
    );
    return;
  }

  if (action === 'tank') {
    if (state.tankLevel >= 3) {
      showToast('Your fuel tank is already maxed out.', 'bad');
      return;
    }
    const cost = 95 + state.tankLevel * 35;
    buyUpgrade(
      cost,
      () => {
        state.tankLevel += 1;
        state.gasMax += 25;
        state.gas += 25;
      },
      () => `Tank upgrade installed. Capacity is now ${state.gasMax}.`,
    );
    return;
  }

  if (action === 'bag') {
    const cost = 60 + Math.max(0, (state.backpackCapacity - 6) / 2) * 25;
    buyUpgrade(
      cost,
      () => {
        state.backpackCapacity += 2;
      },
      () => `Backpack capacity upgraded to ${state.backpackCapacity}.`,
    );
    return;
  }

  if (action === 'sell-all') {
    const total = getSellAllValue();
    if (total <= 0) {
      showToast('Your backpack is empty.', 'bad');
      return;
    }
    state.money += total;
    state.backpack.length = 0;
    showToast(`Sold all backpack cargo for ${formatMoney(total)}.`);
    markUiDirty();
  }
}

function handleModsShopAction(action) {
  if (action === 'repair') {
    if (state.carCondition >= 99) {
      showToast('Your car is already in great shape.', 'bad');
      return;
    }
    const repairCost = 20 + Math.round((100 - state.carCondition) * 0.9);
    buyUpgrade(
      repairCost,
      () => {
        state.carCondition = 100;
        applyPlayerCarTuning();
      },
      'Your car was fully repaired.',
    );
    return;
  }

  if (action === 'handling') {
    if (state.handlingLevel >= 3) {
      showToast('Handling upgrades are already maxed out.', 'bad');
      return;
    }
    const cost = 95 + state.handlingLevel * 45;
    buyUpgrade(
      cost,
      () => {
        state.handlingLevel += 1;
        applyPlayerCarTuning();
      },
      () => `Handling tune level ${state.handlingLevel} installed.`,
    );
    return;
  }

  if (action === 'armor') {
    if (state.armorLevel >= 3) {
      showToast('Body reinforcement is already maxed out.', 'bad');
      return;
    }
    const cost = 110 + state.armorLevel * 55;
    buyUpgrade(
      cost,
      () => {
        state.armorLevel += 1;
      },
      () => `Body armor level ${state.armorLevel} installed.`,
    );
  }
}

function getJobCooldown(placeId) {
  const lastTime = state.lastJobTimes[placeId] || -999;
  return Math.max(0, 25 - (elapsedTime - lastTime));
}

function applyForJob(place) {
  state.currentJobId = place.id;
  showToast(`You got hired as a ${place.jobTitle} at ${place.name}.`);
  markUiDirty();
}

function workShift(place) {
  const cooldown = getJobCooldown(place.id);
  if (cooldown > 0) {
    showToast(`Your next ${place.jobTitle} shift unlocks in ${Math.ceil(cooldown)}s.`, 'bad');
    return;
  }
  if (state.currentJobId !== place.id) {
    showToast(`Apply at ${place.name} first.`, 'bad');
    return;
  }
  state.lastJobTimes[place.id] = elapsedTime;
  state.money += place.pay;
  showToast(`Shift complete. ${place.name} paid you ${formatMoney(place.pay)}.`);
  markUiDirty();
}

function buyCarModel(carId) {
  const car = carCatalog.find((item) => item.id === carId);
  if (!car) {
    return;
  }
  if (state.carModelId === car.id) {
    showToast(`You already own the ${car.name}.`, 'bad');
    return;
  }
  buyUpgrade(
    car.price,
    () => {
      state.carModelId = car.id;
      applyPlayerCarTuning();
    },
    `You bought the ${car.name}.`,
  );
}

function renderBackpackPanel() {
  const totalValue = getSellAllValue();
  const itemsMarkup =
    state.backpack.length > 0
      ? state.backpack
          .map(
            (item) => `
              <div class="inventory-item">
                <div>
                  <strong>${item.name}</strong>
                  <div class="mini">Cargo value ${formatMoney(item.value)}</div>
                </div>
              </div>
            `,
          )
          .join('')
      : '<div class="inventory-item"><div><strong>No cargo yet</strong><div class="mini">Drive or walk into the glowing pickup crates to stash loot here.</div></div></div>';

  backpackPanelEl.innerHTML = `
    <h2>Backpack ${state.backpack.length}/${state.backpackCapacity}</h2>
    <p class="mini">Total cargo value: ${formatMoney(totalValue)}. Sell everything at Fuel Plaza.</p>
    <div class="inventory-list">${itemsMarkup}</div>
  `;
}

function renderPhonePanel() {
  const targetPosition = getTargetPosition();
  const playerReference = state.mode === 'driving' ? player.position : avatar.position;
  const gpsDistance = targetPosition ? Math.round(distanceXZ(playerReference, targetPosition)) : 0;
  const carDistance = state.mode === 'walking' ? Math.round(distanceXZ(avatar.position, player.position)) : 0;

  phonePanelEl.innerHTML = `
    <h2>Phone</h2>
    <div class="phone-sections">
      <div class="action-card">
        <strong>Car Status</strong>
        <div class="mini">Model: ${getCarProfile().name}</div>
        <div class="mini">Gas: ${Math.round(state.gas)}/${state.gasMax}</div>
        <div class="mini">Condition: ${Math.round(state.carCondition)}%</div>
        <div class="mini">Car Location: ${getDistrictName(player.position)}</div>
        ${
          state.mode === 'walking'
            ? `<div class="mini">Distance To Car: ${carDistance}m</div>`
            : '<div class="mini">You are currently driving.</div>'
        }
      </div>
      <div class="action-card">
        <strong>Player</strong>
        <div class="mini">Current Location: ${getDistrictName(playerReference)}</div>
        <div class="mini">Wanted Level: ${state.wantedLevel}</div>
        <div class="mini">Job: ${state.currentJobId ? placeById.get(state.currentJobId).jobTitle : 'None'}</div>
        <div class="mini">Job Spots: Corner Cafe, Parcel Point, Tech Hub</div>
      </div>
      <div class="action-card">
        <strong>GPS</strong>
        <div class="mini">Target: ${getTargetLabel()}</div>
        <div class="mini">Distance: ${targetPosition ? `${gpsDistance}m` : 'Set a route to show arrows'}</div>
        <div class="chip-row">
          <button data-phone-action="gps" data-target="gas">Gas</button>
          <button data-phone-action="gps" data-target="dealer">Dealer</button>
          <button data-phone-action="gps" data-target="mods">Mods</button>
          <button data-phone-action="gps" data-target="cafe">Cafe</button>
          <button data-phone-action="gps" data-target="courier">Courier</button>
          <button data-phone-action="gps" data-target="jail">Jail</button>
          <button data-phone-action="gps" data-target="track">Track</button>
          <button data-phone-action="gps" data-target="car">Car</button>
          <button data-phone-action="gps-clear">Clear</button>
        </div>
      </div>
      <div class="action-list">
        <button data-phone-action="teleport-track">Teleport To Racetrack</button>
        <button data-phone-action="teleport-home">Return To City</button>
      </div>
    </div>
  `;
}

function renderCenterPanel() {
  if (!state.centerPanel) {
    centerPanelEl.innerHTML = '';
    return;
  }

  if (state.centerPanel === 'jail-lock') {
    centerPanelEl.innerHTML = `
      <h2>Metro Jail</h2>
      <p class="mini">You got caught. Wait for your sentence to finish before heading back out.</p>
      <div class="action-list">
        <div class="action-card">
          <strong>Release Timer</strong>
          <div class="mini">${Math.ceil(state.jailTimer)}s remaining</div>
        </div>
        <button data-center-action="release-jail" ${state.jailTimer > 0 ? 'disabled' : ''}>Leave Jail</button>
      </div>
    `;
    return;
  }

  const place = placeById.get(state.centerPanel);
  if (!place) {
    return;
  }

  if (place.type === 'gas') {
    const engineCost = 90 + state.engineLevel * 45;
    const tankCost = 95 + state.tankLevel * 35;
    const bagCost = 60 + Math.max(0, (state.backpackCapacity - 6) / 2) * 25;
    centerPanelEl.innerHTML = `
      <h2>${place.name}</h2>
      <p class="mini">Refuel, tune the car, and sell cargo from your backpack.</p>
      <div class="shop-list">
        <div class="shop-item">
          <div><strong>Refuel 40 Gas</strong><div class="mini">Top off the tank and keep cruising.</div></div>
          <button data-center-action="gas-fuel">Buy ${formatMoney(25)}</button>
        </div>
        <div class="shop-item">
          <div><strong>Engine Tune ${state.engineLevel}/3</strong><div class="mini">Boost top speed and acceleration.</div></div>
          <button data-center-action="gas-engine" ${state.engineLevel >= 3 ? 'disabled' : ''}>Buy ${formatMoney(engineCost)}</button>
        </div>
        <div class="shop-item">
          <div><strong>Tank Upgrade ${state.tankLevel}/3</strong><div class="mini">Adds 25 max gas and fills the extra space.</div></div>
          <button data-center-action="gas-tank" ${state.tankLevel >= 3 ? 'disabled' : ''}>Buy ${formatMoney(tankCost)}</button>
        </div>
        <div class="shop-item">
          <div><strong>Backpack Upgrade</strong><div class="mini">Carry two extra cargo items.</div></div>
          <button data-center-action="gas-bag">Buy ${formatMoney(bagCost)}</button>
        </div>
        <div class="shop-item">
          <div><strong>Sell All Cargo</strong><div class="mini">${state.backpack.length} item(s) ready to cash out.</div></div>
          <button data-center-action="gas-sell-all" ${getSellAllValue() <= 0 ? 'disabled' : ''}>Sell ${formatMoney(getSellAllValue())}</button>
        </div>
      </div>
    `;
    return;
  }

  if (place.type === 'business') {
    const cooldown = getJobCooldown(place.id);
    centerPanelEl.innerHTML = `
      <h2>${place.name}</h2>
      <p class="mini">Walk inside, apply for the job, and work shifts to earn money.</p>
      <div class="action-list">
        <div class="action-card">
          <strong>${place.jobTitle}</strong>
          <div class="mini">Pay per shift: ${formatMoney(place.pay)}</div>
          <div class="mini">Current Job: ${state.currentJobId === place.id ? 'Hired here' : state.currentJobId ? `Working at ${placeById.get(state.currentJobId).name}` : 'Unemployed'}</div>
        </div>
        <button data-center-action="apply-job" data-place="${place.id}">${state.currentJobId === place.id ? 'Already Hired' : 'Apply For Job'}</button>
        <button data-center-action="work-job" data-place="${place.id}" ${state.currentJobId !== place.id || cooldown > 0 ? 'disabled' : ''}>Work Shift</button>
        <div class="mini">${cooldown > 0 ? `Next shift in ${Math.ceil(cooldown)}s.` : 'Shift ready now.'}</div>
      </div>
    `;
    return;
  }

  if (place.type === 'mods') {
    const repairCost = 20 + Math.round((100 - state.carCondition) * 0.9);
    const handlingCost = 95 + state.handlingLevel * 45;
    const armorCost = 110 + state.armorLevel * 55;
    centerPanelEl.innerHTML = `
      <h2>${place.name}</h2>
      <p class="mini">Repair damage and install performance mods.</p>
      <div class="shop-list">
        <div class="shop-item">
          <div><strong>Full Repair</strong><div class="mini">Restore car condition to 100%.</div></div>
          <button data-center-action="mods-repair" ${state.carCondition >= 99 ? 'disabled' : ''}>Buy ${formatMoney(repairCost)}</button>
        </div>
        <div class="shop-item">
          <div><strong>Handling Tune ${state.handlingLevel}/3</strong><div class="mini">Sharper steering and better control.</div></div>
          <button data-center-action="mods-handling" ${state.handlingLevel >= 3 ? 'disabled' : ''}>Buy ${formatMoney(handlingCost)}</button>
        </div>
        <div class="shop-item">
          <div><strong>Body Armor ${state.armorLevel}/3</strong><div class="mini">Take less damage when you crash.</div></div>
          <button data-center-action="mods-armor" ${state.armorLevel >= 3 ? 'disabled' : ''}>Buy ${formatMoney(armorCost)}</button>
        </div>
      </div>
    `;
    return;
  }

  if (place.type === 'dealer') {
    const carRows = carCatalog
      .map(
        (car) => `
          <div class="shop-item">
            <div>
              <strong>${car.name}</strong>
              <div class="mini">Top speed +${car.maxSpeedBonus}, acceleration +${car.accelBonus}</div>
            </div>
            <button data-center-action="buy-car" data-car="${car.id}" ${state.carModelId === car.id ? 'disabled' : ''}>
              ${state.carModelId === car.id ? 'Owned' : `Buy ${formatMoney(car.price)}`}
            </button>
          </div>
        `,
      )
      .join('');

    centerPanelEl.innerHTML = `
      <h2>${place.name}</h2>
      <p class="mini">You have to drive here physically, hop out, and buy cars in person.</p>
      <div class="shop-list">${carRows}</div>
    `;
  }
}

function releaseFromJail() {
  if (state.jailTimer > 0) {
    return;
  }
  const jail = placeById.get('jail');
  closePanels();
  state.mode = 'walking';
  avatar.group.visible = true;
  avatar.position.copy(jail.entryPoint.clone().add(new THREE.Vector3(0, 0, 5)));
  avatar.heading = 0;
  state.cameraYaw = 0;
  state.cameraPitch = 0.34;
  showToast('You are out of jail. Try to keep it clean.', 'good');
  markUiDirty();
}

function toggleEnterExitCar() {
  if (state.jailTimer > 0) {
    return;
  }
  if (state.mode === 'driving') {
    if (Math.abs(player.speed) > 1.4) {
      showToast('Slow down before getting out of the car.', 'bad');
      return;
    }
    state.mode = 'walking';
    state.cameraYaw = player.heading;
    state.cameraPitch = 0.34;
    avatar.position.copy(player.position).add(new THREE.Vector3(Math.sin(player.heading) * 3, 0, -Math.cos(player.heading) * 3));
    avatar.heading = player.heading;
    avatar.group.visible = true;
    showToast('You stepped out of the car.');
  } else if (distanceXZ(avatar.position, player.position) < 6) {
    state.mode = 'driving';
    state.cameraYaw = player.heading;
    state.cameraPitch = 0.38;
    avatar.group.visible = false;
    showToast('Back in the car.');
  } else {
    showToast('Walk back to your car first.', 'bad');
  }
  closePanels();
  markUiDirty();
}

function teleportToTrack() {
  state.mode = 'driving';
  avatar.group.visible = false;
  state.cameraYaw = 0;
  state.cameraPitch = 0.38;
  player.position.copy(TRACK_SPAWN);
  player.heading = 0;
  player.speed = 0;
  closePanels();
  resetTrackRace();
  showToast('Teleported to Sunset Speedway.');
}

function teleportHome() {
  state.mode = 'driving';
  avatar.group.visible = false;
  state.cameraYaw = 0.1;
  state.cameraPitch = 0.38;
  player.position.copy(CITY_SPAWN);
  player.heading = 0.1;
  player.speed = 0;
  state.trackRaceActive = false;
  state.raceFinished = false;
  closePanels();
  showToast('Returned to the city.');
  markUiDirty();
}

function getTrackProgress(vehicle) {
  if (vehicle.finishedOrder !== null) {
    return TOTAL_LAPS + 1 - vehicle.finishedOrder * 0.001;
  }
  const waypointCount = trackRoute.length;
  const previousIndex = (vehicle.routeIndex - 1 + waypointCount) % waypointCount;
  const start = trackRoute[previousIndex];
  const end = trackRoute[vehicle.routeIndex];
  const segmentX = end.x - start.x;
  const segmentZ = end.z - start.z;
  const segmentLengthSquared = segmentX * segmentX + segmentZ * segmentZ || 1;
  const relativeX = vehicle.position.x - start.x;
  const relativeZ = vehicle.position.z - start.z;
  const along = clamp(
    (relativeX * segmentX + relativeZ * segmentZ) / segmentLengthSquared,
    0,
    1,
  );
  return vehicle.laps + (previousIndex + along) / waypointCount;
}

function getTrackLeaderboard() {
  return [player, ...trackBots]
    .map((vehicle) => ({ vehicle, progress: getTrackProgress(vehicle) }))
    .sort((left, right) => right.progress - left.progress);
}

function registerFinish(vehicle) {
  if (vehicle.finishedOrder !== null) {
    return;
  }
  state.finishOrderCounter += 1;
  vehicle.finishedOrder = state.finishOrderCounter;
}

function onPlayerTrackLapComplete() {
  const payout = Math.round(state.lawfulPayout);
  state.money += payout;
  showToast(
    payout === 100
      ? `Clean lap. You earned the full ${formatMoney(payout)}.`
      : `Lap complete. Lawful payout: ${formatMoney(payout)}.`,
    payout === 100 ? 'good' : 'bad',
  );
  state.lawfulPayout = 100;
  state.speedingTimer = 0;
  state.offRoadTimer = 0;

  if (player.laps >= TOTAL_LAPS && !state.raceFinished) {
    registerFinish(player);
    state.raceFinished = true;
    const leaderboard = getTrackLeaderboard();
    const rank = leaderboard.findIndex((entry) => entry.vehicle === player) + 1;
    const bonusByRank = [0, 250, 160, 100, 60];
    const bonus = bonusByRank[rank] || 40;
    state.money += bonus;
    showToast(
      `Race finished in ${ordinal(rank)} place. Finish bonus ${formatMoney(bonus)}. Press N to race again.`,
      rank === 1 ? 'good' : 'bad',
    );
  }
  markUiDirty();
}

function updateTrackCheckpoint(vehicle, lapCallback) {
  const targetIndex = vehicle.routeIndex;
  const target = trackRoute[targetIndex];
  if (distanceXZ(vehicle.position, target) <= 11) {
    vehicle.routeIndex = (vehicle.routeIndex + 1) % trackRoute.length;
    if (targetIndex === 0) {
      vehicle.laps += 1;
      lapCallback();
    }
  }
}

function resetTrackRace() {
  state.mode = 'driving';
  avatar.group.visible = false;
  state.cameraYaw = 0;
  state.cameraPitch = 0.38;
  player.position.copy(TRACK_SPAWN);
  player.heading = 0;
  player.speed = 0;
  player.steerAngle = 0;
  player.routeIndex = 1;
  player.laps = 0;
  player.finishedOrder = null;

  const starts = [
    new THREE.Vector3(TRACK_SPAWN.x - 6, 0, TRACK_SPAWN.z),
    new THREE.Vector3(TRACK_SPAWN.x - 12, 0, TRACK_SPAWN.z - 4),
    new THREE.Vector3(TRACK_SPAWN.x - 18, 0, TRACK_SPAWN.z - 8),
  ];
  trackBots.forEach((bot, index) => {
    bot.position.copy(starts[index]);
    bot.heading = 0;
    bot.speed = 0;
    bot.steerAngle = 0;
    bot.routeIndex = 1;
    bot.laps = 0;
    bot.finishedOrder = null;
  });

  state.trackRaceActive = true;
  state.raceFinished = false;
  state.finishOrderCounter = 0;
  state.lawfulPayout = 100;
  state.cityBonusTimer = 0;
  state.speedingTimer = 0;
  state.offRoadTimer = 0;
  closePanels();
  markUiDirty();
}

function performReset() {
  if (distanceXZ(player.position, TRACK_CENTER) < 180 || state.trackRaceActive) {
    resetTrackRace();
    showToast('Track positions reset.');
    return;
  }
  player.position.copy(CITY_SPAWN);
  player.heading = 0.1;
  player.speed = 0;
  if (state.mode === 'walking') {
    avatar.position.copy(CITY_SPAWN.clone().add(new THREE.Vector3(0, 0, 4)));
  }
  showToast('Car reset back to the city.');
}

function updateTrafficLights(dt) {
  stoplightState.timer += dt;
  const phase = stoplightPhases[stoplightState.phaseIndex];
  if (stoplightState.timer >= phase.duration) {
    setTrafficLightPhase((stoplightState.phaseIndex + 1) % stoplightPhases.length);
  }
}

function updateWanted(dt) {
  if (state.wantedTimer > 0) {
    state.wantedTimer -= dt;
  } else {
    state.wantedHeat = moveTowards(state.wantedHeat, 0, dt * 0.3);
  }
  state.wantedLevel = Math.max(0, Math.ceil(state.wantedHeat - 0.05));
}

function arrestPlayer() {
  const jail = placeById.get('jail');
  const fine = 45 + state.wantedLevel * 35;
  state.money = Math.max(0, state.money - fine);
  state.jailTimer = 10;
  state.wantedHeat = 0;
  state.wantedLevel = 0;
  state.wantedTimer = 0;
  state.wantedStartTime = -999;
  state.policeVehiclePursuit = false;
  state.arrestMeter = 0;
  state.nextOfficerSpawnAt = 0;
  state.mode = 'walking';
  state.cameraYaw = Math.PI;
  state.cameraPitch = 0.34;
  avatar.group.visible = true;
  avatar.position.copy(jail.position).add(new THREE.Vector3(0, 0, 8));
  avatar.heading = Math.PI;
  player.position.copy(jail.position).add(new THREE.Vector3(10, 0, -6));
  player.speed = 0;
  policeCar.speed = 0;
  policeCar.mesh.group.visible = false;
  officers.forEach((officer) => {
    officer.active = false;
    officer.group.visible = false;
  });
  openCenterPanel('jail-lock');
  showToast(`Police arrested you. Fine ${formatMoney(fine)}.`, 'bad');
}

function deployPoliceCarNear(targetPosition) {
  const targetHeading = state.mode === 'driving' ? player.heading : avatar.heading;
  const angle =
    targetHeading +
    Math.PI +
    (noise2D(targetPosition.x, targetPosition.z, elapsedTime) - 0.5) * 0.8;
  const distance = 14 + noise2D(targetPosition.z, targetPosition.x, elapsedTime + 7) * 9;
  const carX = targetPosition.x + Math.cos(angle) * distance;
  const carZ = targetPosition.z + Math.sin(angle) * distance;
  policeCar.mesh.group.visible = true;
  policeCar.position.set(carX, 0, carZ);
  policeCar.heading = headingFromPoints(policeCar.position, targetPosition);
  policeCar.speed = 0;
  policeCar.steerAngle = 0;
  return { angle, carX, carZ };
}

function deployOfficerNear(targetPosition) {
  const officer = officers.find((candidate) => !candidate.active);
  if (!officer) {
    return;
  }

  const { angle, carX, carZ } = deployPoliceCarNear(targetPosition);
  const officerSide = noise2D(targetPosition.x, elapsedTime, 13) > 0.5 ? 1 : -1;
  const spawnX = carX + Math.cos(angle + officerSide * Math.PI / 2) * 2.1;
  const spawnZ = carZ + Math.sin(angle + officerSide * Math.PI / 2) * 2.1;
  officer.active = true;
  officer.position.set(spawnX, 0, spawnZ);
  officer.heading = headingFromPoints(officer.position, targetPosition);
  officer.speed = 0;
  officer.group.visible = true;

}

function updatePoliceCar(targetPosition, dt, targetSpeed) {
  if (!policeCar.mesh.group.visible) {
    return;
  }
  const targetVelocity =
    state.mode === 'driving'
      ? new THREE.Vector3(
          Math.cos(player.heading) * player.speed,
          0,
          Math.sin(player.heading) * player.speed,
        )
      : new THREE.Vector3();
  const distanceToTarget = distanceXZ(policeCar.position, targetPosition);
  const lookAhead = clamp(distanceToTarget / 24, 0.12, 1.2);
  const interceptPoint = targetPosition.clone().addScaledVector(targetVelocity, lookAhead);
  const desiredHeading = headingFromPoints(policeCar.position, interceptPoint);
  const headingDelta = normalizeAngle(desiredHeading - policeCar.heading);

  policeCar.steerAngle = moveTowards(policeCar.steerAngle, headingDelta, dt * 3.9);
  policeCar.heading = moveAngleTowards(
    policeCar.heading,
    desiredHeading,
    policeCar.turnRate * dt * (distanceToTarget < 14 ? 2.15 : 1.4),
  );

  const arriveFactor = clamp((distanceToTarget - 3.2) / 26, 0.16, 1);
  const cruiseSpeed = Math.max(4.5, targetSpeed * arriveFactor);
  const accelRate = cruiseSpeed < policeCar.speed ? 38 : policeCar.acceleration;
  policeCar.speed = moveTowards(policeCar.speed, cruiseSpeed, accelRate * dt);

  if (distanceToTarget < 12 && Math.abs(headingDelta) > 1.25) {
    policeCar.speed = moveTowards(policeCar.speed, 6.5, 44 * dt);
  }

  const collided = moveBodyWithCollisions(
    policeCar.position,
    Math.cos(policeCar.heading) * policeCar.speed * dt,
    Math.sin(policeCar.heading) * policeCar.speed * dt,
    2.3,
  );
  if (collided) {
    policeCar.speed *= 0.52;
  }
}

function updateOfficer(officer, targetPosition, dt) {
  if (!officer.active) {
    return;
  }
  const desiredHeading = headingFromPoints(officer.position, targetPosition);
  officer.heading = moveAngleTowards(officer.heading, desiredHeading, dt * 4);
  officer.speed = moveTowards(officer.speed, 8 + state.wantedLevel * 1.5, dt * 14);
  officer.position.x += Math.cos(officer.heading) * officer.speed * dt;
  officer.position.z += Math.sin(officer.heading) * officer.speed * dt;
  officer.group.position.set(
    officer.position.x,
    terrainHeightAt(officer.position.x, officer.position.z) + 0.02,
    officer.position.z,
  );
  officer.group.rotation.y = -officer.heading;
  if (officer.group.userData.walk) {
    officer.group.userData.walk(elapsedTime, clamp(officer.speed / 6, 0.4, 1.8));
  }
}

function updatePolice(dt) {
  if (state.wantedLevel <= 0 || state.trackRaceActive || state.jailTimer > 0) {
    policeCar.mesh.group.visible = false;
    officers.forEach((officer) => {
      officer.active = false;
      officer.group.visible = false;
    });
    state.nextOfficerSpawnAt = 0;
    state.wantedStartTime = -999;
    state.policeVehiclePursuit = false;
    state.arrestMeter = moveTowards(state.arrestMeter, 0, dt * 3);
    return;
  }

  const targetPosition = state.mode === 'driving' ? player.position : avatar.position;
  const chaseDuration = Math.max(0, elapsedTime - state.wantedStartTime);
  const playerSpeed = Math.abs(player.speed);
  const cruiserDistance = policeCar.mesh.group.visible ? distanceXZ(policeCar.position, targetPosition) : Infinity;

  if (state.mode === 'driving' && playerSpeed > 22) {
    state.policeVehiclePursuit = true;
  } else if (
    state.policeVehiclePursuit &&
    (state.mode !== 'driving' || (playerSpeed < 10 && cruiserDistance < 18))
  ) {
    state.policeVehiclePursuit = false;
  }

  if (state.policeVehiclePursuit) {
    if (!policeCar.mesh.group.visible) {
      deployPoliceCarNear(targetPosition);
    }
    officers.forEach((officer) => {
      officer.active = false;
      officer.group.visible = false;
    });
    updatePoliceCar(
      targetPosition,
      dt,
      clamp(playerSpeed + 10 + state.wantedLevel * 2.5, 28, policeCar.maxSpeed + 14),
    );
  } else {
    let activeOfficers = officers.filter((officer) => officer.active);
    const desiredOfficerCount = clamp(state.wantedLevel + Math.floor(chaseDuration / 6), 1, officers.length);

    if (activeOfficers.length === 0 || elapsedTime >= state.nextOfficerSpawnAt) {
      if (activeOfficers.length < desiredOfficerCount) {
        deployOfficerNear(targetPosition);
        state.nextOfficerSpawnAt = elapsedTime + Math.max(3.2, 6 - state.wantedLevel * 0.6);
        activeOfficers = officers.filter((officer) => officer.active);
      }
    }

    updatePoliceCar(targetPosition, dt, 9 + state.wantedLevel * 1.5);
    activeOfficers.forEach((officer) => updateOfficer(officer, targetPosition, dt));
  }

  const closestOfficer = officers
    .filter((officer) => officer.active)
    .reduce((best, officer) => {
      const distance = distanceXZ(officer.position, targetPosition);
      return !best || distance < best.distance ? { officer, distance } : best;
    }, null);
  const closestEnforcerDistance = Math.min(
    cruiserDistance,
    closestOfficer ? closestOfficer.distance : Number.POSITIVE_INFINITY,
  );

  // Keep wanted pressure alive while cops are still nearby so the chase does not cut out abruptly.
  if (closestEnforcerDistance < 85) {
    state.wantedTimer = Math.max(state.wantedTimer, 9);
    state.wantedHeat = Math.max(state.wantedHeat, 0.95 + state.wantedLevel * 0.25);
  }

  if (closestOfficer && closestOfficer.distance < (state.mode === 'driving' ? 4.4 : 2.3)) {
    state.arrestMeter += dt * 1.6;
  } else {
    state.arrestMeter = moveTowards(state.arrestMeter, 0, dt * 1.5);
  }

  if (state.arrestMeter > 2.1) {
    arrestPlayer();
  }
}

function updateTrackBot(bot, dt) {
  const target = trackRoute[bot.routeIndex];
  const desiredHeading = headingFromPoints(bot.position, target);
  bot.steerAngle = moveTowards(bot.steerAngle, normalizeAngle(desiredHeading - bot.heading), dt * 2.8);
  bot.heading = moveAngleTowards(bot.heading, desiredHeading, bot.turnRate * dt);
  const distanceToTarget = distanceXZ(bot.position, target);
  const targetSpeed = distanceToTarget < 18 ? bot.maxSpeed * 0.52 : bot.maxSpeed;
  bot.speed = moveTowards(bot.speed, targetSpeed, (targetSpeed < bot.speed ? 22 : bot.acceleration) * dt);
  bot.position.x += Math.cos(bot.heading) * bot.speed * dt;
  bot.position.z += Math.sin(bot.heading) * bot.speed * dt;
  updateTrackCheckpoint(bot, () => {
    if (bot.laps >= TOTAL_LAPS) {
      registerFinish(bot);
    }
  });
}

function updateVehicleTransform(vehicle, dt = 1 / 60) {
  const groundY = terrainHeightAt(vehicle.position.x, vehicle.position.z);
  vehicle.mesh.group.position.set(
    vehicle.position.x,
    groundY + (vehicle.mesh.groundOffset ?? 0.58),
    vehicle.position.z,
  );
  vehicle.mesh.group.rotation.y = -vehicle.heading + (vehicle.mesh.headingOffset || 0);
  vehicle.wheelSpin += vehicle.speed * dt * 1.75;
  vehicle.mesh.frontWheelPivots.forEach((pivot) => {
    pivot.rotation.y = -clamp(vehicle.steerAngle, -0.6, 0.6);
  });
  vehicle.mesh.wheelMeshes.forEach((wheel) => {
    if (wheel.userData.baseRotation) {
      wheel.rotation.copy(wheel.userData.baseRotation);
    }
    const spinAxis = wheel.userData.spinAxis || 'x';
    wheel.rotation[spinAxis] += vehicle.wheelSpin;
  });
  if (vehicle.mesh.group.userData.flashBeacons) {
    vehicle.mesh.group.userData.flashBeacons(Math.sin(elapsedTime * 9) > 0);
  } else if (vehicle.mesh.sirens.length > 0) {
    vehicle.mesh.sirens[0].material.emissive.setHex(Math.sin(elapsedTime * 9) > 0 ? 0x22577a : 0x000000);
    vehicle.mesh.sirens[1].material.emissive.setHex(Math.sin(elapsedTime * 9) < 0 ? 0x9b2226 : 0x000000);
  }
}

function updateAvatarTransform() {
  avatar.group.position.set(
    avatar.position.x,
    terrainHeightAt(avatar.position.x, avatar.position.z) + 0.02,
    avatar.position.z,
  );
  avatar.group.rotation.y = -avatar.heading;
}

function updateCityBonus(dt) {
  if (state.mode !== 'driving' || state.trackRaceActive || distanceXZ(player.position, TRACK_CENTER) < 180) {
    return;
  }
  state.cityBonusTimer += dt;
  if (state.cityBonusTimer >= CITY_BONUS_INTERVAL) {
    state.cityBonusTimer = 0;
    const payout = Math.round(state.lawfulPayout);
    state.money += payout;
    showToast(
      payout === 100
        ? `Safe city driving bonus: ${formatMoney(payout)}.`
        : `Lawful driving bonus paid ${formatMoney(payout)}.`,
      payout === 100 ? 'good' : 'bad',
    );
    state.lawfulPayout = 100;
    state.speedingTimer = 0;
    state.offRoadTimer = 0;
  }
}

function updateDriving(dt) {
  const locked = controlsLocked();
  const onPaved = isPaved(player.position.x, player.position.z);
  const onTrack = isOnRaceTrack(player.position.x, player.position.z);
  const forwardInput = locked ? 0 : Number(keys.forward) - Number(keys.back) * 0.7;
  const steerInput = locked ? 0 : Number(keys.right) - Number(keys.left);

  applyPlayerCarTuning();
  player.steerAngle = moveTowards(player.steerAngle, steerInput * 0.42, dt * 1.75);
  if (!state.pointerLocked) {
    state.cameraYaw = moveAngleTowards(state.cameraYaw, player.heading, dt * 2.4);
    state.cameraPitch = moveTowards(state.cameraPitch, 0.38, dt * 1.6);
  }
  if (Math.abs(player.speed) > 0.08) {
    const steerStrength = clamp(Math.abs(player.speed) / 16, 0.08, 0.72);
    player.heading += player.steerAngle * player.turnRate * dt * steerStrength * (player.speed >= 0 ? 1 : -1);
  }

  if (forwardInput !== 0 && state.gas > 0.01 && !locked) {
    player.speed += forwardInput * player.acceleration * dt;
  } else {
    player.speed = moveTowards(player.speed, 0, (onPaved ? 8 : 12) * dt);
  }
  if (keys.brake) {
    player.speed = moveTowards(player.speed, 0, 26 * dt);
  }
  if (!onPaved && player.speed > 16) {
    player.speed = moveTowards(player.speed, 16, 22 * dt);
  }

  player.speed = clamp(player.speed, -player.reverseSpeed, onPaved ? player.maxSpeed : 16);
  const deltaX = Math.cos(player.heading) * player.speed * dt;
  const deltaZ = Math.sin(player.heading) * player.speed * dt;
  const collided = moveBodyWithCollisions(player.position, deltaX, deltaZ, 2.3);
  if (collided && Math.abs(player.speed) > 5 && elapsedTime - state.lastConditionHitTime > 0.6) {
    damageCar(7 + Math.abs(player.speed) * 0.28, 'You hit something solid.');
    player.speed *= 0.55;
  }

  const gasDrain =
    (0.05 + Math.abs(player.speed) / Math.max(player.maxSpeed, 1) * 0.18 + Math.abs(forwardInput) * 0.28) *
    (1 + state.engineLevel * 0.08);
  state.gas = Math.max(0, state.gas - gasDrain * dt);
  if (state.gas <= 0.01 && !state.outOfGasToastShown) {
    state.outOfGasToastShown = true;
    showToast('Out of gas. Coast into Fuel Plaza and refuel.', 'bad');
  }
  if (state.gas > 0.5) {
    state.outOfGasToastShown = false;
  }

  if (!onTrack && onPaved && Math.abs(player.speed) > SPEED_LIMIT) {
    state.speedingTimer += dt;
    if (state.speedingTimer > 2.2) {
      applyPenalty(6, 'Speeding ticket. Your lawful payout dropped.', 0.6);
      state.speedingTimer = 0;
    }
  } else {
    state.speedingTimer = moveTowards(state.speedingTimer, 0, dt * 2);
  }

  if (!onPaved && Math.abs(player.speed) > 8) {
    state.offRoadTimer += dt;
    if (state.offRoadTimer > 2) {
      applyPenalty(9, 'Off-road driving cut your lawful payout.', 0.5);
      damageCar(2.5);
      state.offRoadTimer = 0;
    }
  } else {
    state.offRoadTimer = moveTowards(state.offRoadTimer, 0, dt * 2);
  }

  if (!onTrack) {
    const localX = toChunkLocal(player.position.x);
    const localZ = toChunkLocal(player.position.z);
    const insideIntersection =
      Math.abs(localX) < CONTROLLED_INTERSECTION_HALF &&
      Math.abs(localZ) < CONTROLLED_INTERSECTION_HALF;
    if (!player._wasInIntersection && insideIntersection) {
      const movingEastWest = Math.abs(Math.cos(player.heading)) >= Math.abs(Math.sin(player.heading));
      const light = movingEastWest ? stoplightState.ew : stoplightState.ns;
      if (light !== 'green') {
        applyPenalty(16, 'You ran a red light.', 1.2);
      }
    }
    player._wasInIntersection = insideIntersection;
  }

  updateCityBonus(dt);

  if (state.trackRaceActive) {
    updateTrackCheckpoint(player, onPlayerTrackLapComplete);
  }
}

function updateWalking(dt) {
  const locked = controlsLocked();
  const forwardInput = locked ? 0 : Number(keys.forward) - Number(keys.back);
  const strafeInput = locked ? 0 : Number(keys.right) - Number(keys.left);
  const forward = new THREE.Vector3(Math.cos(state.cameraYaw), 0, Math.sin(state.cameraYaw));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const moveVector = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(strafeInput));
  const moveLength = moveVector.length();

  if (!state.pointerLocked) {
    state.cameraPitch = moveTowards(state.cameraPitch, 0.34, dt * 1.8);
  }

  if (moveLength > 0) {
    moveVector.normalize();
    avatar.heading = Math.atan2(moveVector.z, moveVector.x);
    avatar.speed = moveTowards(avatar.speed, 7, 18 * dt);
    moveBodyWithCollisions(avatar.position, moveVector.x * avatar.speed * dt, moveVector.z * avatar.speed * dt, 0.55);
  } else {
    avatar.speed = moveTowards(avatar.speed, 0, 24 * dt);
  }
}

function updatePickups(dt) {
  const targetPosition = state.mode === 'driving' ? player.position : avatar.position;
  pickups.forEach((pickup, index) => {
    if (!pickup.active) {
      pickup.respawnTimer -= dt;
      if (pickup.respawnTimer <= 0) {
        pickup.active = true;
        pickup.mesh.visible = true;
        pickup.type = pickupCatalog[(index + Math.floor(elapsedTime)) % pickupCatalog.length];
        pickup.mesh.material.color.setHex(pickup.type.color);
        pickup.mesh.material.emissive.setHex(pickup.type.color);
      }
      return;
    }
    pickup.mesh.rotation.y += dt * 1.4;
    pickup.mesh.position.y =
      terrainHeightAt(pickup.position.x, pickup.position.z) +
      2.15 +
      Math.sin(elapsedTime * 2 + pickup.bobOffset) * 0.25;
    if (distanceXZ(targetPosition, pickup.position) < 4.5) {
      if (state.backpack.length >= state.backpackCapacity) {
        if (elapsedTime - state.lastBackpackFullToastTime > 2.4) {
          state.lastBackpackFullToastTime = elapsedTime;
          showToast('Backpack full. Sell cargo at Fuel Plaza or buy more space.', 'bad');
        }
        return;
      }
      state.backpack.push({
        id: `${Date.now()}-${Math.random()}`,
        name: pickup.type.name,
        value: pickup.type.value,
      });
      pickup.active = false;
      pickup.mesh.visible = false;
      pickup.respawnTimer = 12 + noise2D(index, elapsedTime, 5) * 10;
      showToast(`Picked up ${pickup.type.name} worth ${formatMoney(pickup.type.value)}.`);
      markUiDirty();
    }
  });
}

function updateInteractionTarget() {
  const reference = state.mode === 'driving' ? player.position : avatar.position;
  let nextInteraction = null;
  let bestDistance = Infinity;

  if (state.mode === 'walking' && distanceXZ(avatar.position, player.position) < 6) {
    nextInteraction = 'car';
    bestDistance = distanceXZ(avatar.position, player.position);
  }

  places.forEach((place) => {
    if (place.type === 'track') {
      return;
    }
    const interactionPoint = place.entryPoint || place.position;
    const distance = distanceXZ(reference, interactionPoint);
    const interactionRadius = place.type === 'business' ? place.radius + 6 : place.radius;
    if (distance > interactionRadius) {
      return;
    }
    if (place.type === 'dealer' && state.mode !== 'walking') {
      return;
    }
    if (place.type === 'dealer' && distanceXZ(player.position, place.position) > place.radius + 8) {
      return;
    }
    if (place.type === 'business' && state.mode !== 'walking') {
      return;
    }
    if (distance < bestDistance) {
      nextInteraction = place.id;
      bestDistance = distance;
    }
  });

  state.interactionId = nextInteraction;
  if (
    state.centerPanel &&
    state.centerPanel !== 'jail-lock' &&
    state.centerPanel !== nextInteraction &&
    !(state.centerPanel === 'gas' && nextInteraction === 'gas')
  ) {
    state.centerPanel = null;
    centerPanelEl.classList.add('hidden');
  }
}

function getInteractionHint() {
  if (state.centerPanel === 'jail-lock') {
    return 'Wait out your jail sentence.';
  }
  if (state.interactionId === 'car') {
    return 'Press Space to enter your car.';
  }
  if (!state.interactionId) {
    const lookHint = state.pointerLocked ? 'Mouse look active.' : 'Click the game to lock the camera.';
    const jobHint =
      !state.currentJobId && state.mode === 'walking'
        ? ' Jobs: Corner Cafe, Parcel Point, Tech Hub.'
        : '';
    return state.mode === 'driving'
      ? `${lookHint} W/S drive, A/D steer, Shift brakes, Space exits.`
      : `${lookHint} WASD moves, E interacts, Space enters car.${jobHint}`;
  }
  const place = placeById.get(state.interactionId);
  if (!place) {
    return '';
  }
  if (place.type === 'gas') return 'Press E to use the gas station.';
  if (place.type === 'mods') return 'Press E to use the mods shop.';
  if (place.type === 'dealer') return 'Press E to enter the dealership showroom.';
  if (place.type === 'business') return `Press E to visit ${place.name}.`;
  return '';
}

function performInteraction() {
  if (state.jailTimer > 0) {
    return;
  }
  if (state.interactionId === 'car') {
    toggleEnterExitCar();
    return;
  }
  if (!state.interactionId) {
    showToast('Nothing to interact with here.', 'bad');
    return;
  }
  openCenterPanel(state.interactionId);
}

function updateCamera(dt) {
  const driving = state.mode === 'driving';
  const source = driving ? player.mesh.group : avatar.group;
  const yaw = state.cameraYaw;
  const pitch = clamp(state.cameraPitch, 0.18, 0.8);
  const radius = driving ? 12 : 7.2;
  const lookTarget = source.position.clone().add(new THREE.Vector3(0, driving ? 1.8 : 1.7, 0));
  const desiredPosition = lookTarget.clone().add(
    new THREE.Vector3(
      -Math.cos(yaw) * Math.cos(pitch) * radius,
      Math.sin(pitch) * radius + (driving ? 0.5 : 0.2),
      -Math.sin(yaw) * Math.cos(pitch) * radius,
    ),
  );
  camera.position.lerp(desiredPosition, 1 - Math.exp(-dt * 5.5));
  camera.lookAt(lookTarget);
}

function updateMarkers() {
  const targetPosition = getTargetPosition();
  const reference = state.mode === 'driving' ? player.position : avatar.position;
  gpsMarker.group.visible = Boolean(targetPosition);
  if (targetPosition) {
    gpsMarker.group.position.set(
      targetPosition.x,
      terrainHeightAt(targetPosition.x, targetPosition.z) + 0.25 + Math.sin(elapsedTime * 2.4) * 0.08,
      targetPosition.z,
    );
    gpsMarker.ring.rotation.z += 0.01;
  }

  const direction = targetPosition
    ? new THREE.Vector3(targetPosition.x - reference.x, 0, targetPosition.z - reference.z)
    : null;
  const hasDirection = direction && direction.length() > 8;
  if (hasDirection) {
    direction.normalize();
  }
  gpsArrows.forEach((arrow, index) => {
    arrow.visible = Boolean(hasDirection);
    if (!hasDirection) {
      return;
    }
    const step = 7 + index * 7;
    const arrowX = reference.x + direction.x * step;
    const arrowZ = reference.z + direction.z * step;
    arrow.position.set(
      arrowX,
      terrainHeightAt(arrowX, arrowZ) + 1.4 + Math.sin(elapsedTime * 3 + index) * 0.14,
      arrowZ,
    );
    arrow.setDirection(direction);
    arrow.setLength(4.8 + Math.sin(elapsedTime * 4 + index) * 0.35, 1.7, 1.05);
  });

  checkpointMarker.group.visible = state.trackRaceActive;
  if (state.trackRaceActive) {
    const target = trackRoute[player.routeIndex];
    checkpointMarker.group.position.set(
      target.x,
      terrainHeightAt(target.x, target.z) + 0.25 + Math.sin(elapsedTime * 2.2) * 0.08,
      target.z,
    );
    checkpointMarker.ring.rotation.z += 0.015;
  }

  const focusTarget = state.mode === 'driving' ? player.position : avatar.position;
  focusRing.position.set(
    focusTarget.x,
    terrainHeightAt(focusTarget.x, focusTarget.z) + 0.06,
    focusTarget.z,
  );
  focusRing.scale.setScalar(state.mode === 'driving' ? 1.1 : 0.72);
}

function renderHud() {
  const reference = state.mode === 'driving' ? player.position : avatar.position;
  const gpsTarget = getTargetPosition();
  const gpsDistance = gpsTarget ? Math.round(distanceXZ(reference, gpsTarget)) : 0;
  const speedDisplay = Math.round(Math.abs(player.speed) * 2);
  const gasPercent = (state.gas / state.gasMax) * 100;
  const conditionPercent = clamp(state.carCondition, 0, 100);
  const bonusPercent = state.trackRaceActive
    ? state.lawfulPayout
    : Math.min(100, (state.cityBonusTimer / CITY_BONUS_INTERVAL) * 100);
  const leaderboardMarkup = state.trackRaceActive
    ? getTrackLeaderboard()
        .map(
          (entry, index) => `
            <div class="leaderboard-row">
              <span>${index + 1}. ${entry.vehicle.name}</span>
              <strong>${Math.min(entry.vehicle.laps, TOTAL_LAPS)}/${TOTAL_LAPS}</strong>
            </div>
          `,
        )
        .join('')
    : `
      <div class="leaderboard-row"><span>Wanted Level</span><strong>${state.wantedLevel}</strong></div>
      <div class="leaderboard-row"><span>Job</span><strong>${state.currentJobId ? placeById.get(state.currentJobId).jobTitle : 'None'}</strong></div>
      <div class="leaderboard-row"><span>Job Places</span><strong>Cafe, Parcel, Tech Hub</strong></div>
      <div class="leaderboard-row"><span>Location</span><strong>${getDistrictName(reference)}</strong></div>
    `;

  hudEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-line"><span>Money</span><strong>${formatMoney(state.money)}</strong></div>
      <div class="stat-line"><span>Mode</span><strong>${state.mode === 'driving' ? 'Driving' : 'Walking'}</strong></div>
      <div class="stat-line"><span>GPS</span><strong>${getTargetLabel()}</strong></div>
      <div class="stat-line"><span>FPS</span><strong>${Math.round(state.fps)}</strong></div>
      <div class="stat-line"><span>Distance</span><strong>${gpsTarget ? `${gpsDistance}m` : '--'}</strong></div>
    </div>
    <div class="stat-card">
      <div class="stat-line"><span>Car</span><strong>${getCarProfile().name}</strong></div>
      <div class="stat-line"><span>Speed</span><strong>${speedDisplay} mph</strong></div>
      <div class="stat-line"><span>Limit</span><strong>${SPEED_LIMIT * 2} mph</strong></div>
      <div class="meters">
        <div class="meter">
          <label><span>Condition</span><span>${Math.round(state.carCondition)}%</span></label>
          <div class="bar"><div class="bar-fill condition" style="width: ${conditionPercent}%"></div></div>
        </div>
        <div class="meter">
          <label><span>Gas</span><span>${Math.round(state.gas)}/${state.gasMax}</span></label>
          <div class="bar"><div class="bar-fill gas" style="width: ${gasPercent}%"></div></div>
        </div>
        <div class="meter">
          <label><span>${state.trackRaceActive ? 'Lawful Lap Payout' : 'Lawful City Bonus'}</span><span>${formatMoney(state.lawfulPayout)}</span></label>
          <div class="bar"><div class="bar-fill law" style="width: ${bonusPercent}%"></div></div>
        </div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-line"><span>${state.trackRaceActive ? 'Track' : 'City'}</span><strong>${state.trackRaceActive ? `${Math.min(player.laps + 1, TOTAL_LAPS)}/${TOTAL_LAPS}` : stoplightState.label}</strong></div>
      <div class="stat-line"><span>Cargo</span><strong>${state.backpack.length}/${state.backpackCapacity}</strong></div>
      <div class="stat-line"><span>Hint</span><strong>${getInteractionHint()}</strong></div>
      <div class="leaderboard">${leaderboardMarkup}</div>
    </div>
  `;
}

function renderUi() {
  // Keep HUD live every frame for speed/FPS while avoiding panel re-renders that can swallow clicks.
  renderHud();
  if (!state.uiDirty) {
    return;
  }
  if (state.backpackOpen) {
    renderBackpackPanel();
  }
  if (state.phoneOpen) {
    renderPhonePanel();
  }
  if (state.centerPanel) {
    renderCenterPanel();
  }
  state.uiDirty = false;
}

function handleCenterPanelAction(action, dataset) {
  if (action.startsWith('gas-')) {
    handleGasStationAction(action.replace('gas-', ''));
    return;
  }
  if (action.startsWith('mods-')) {
    handleModsShopAction(action.replace('mods-', ''));
    return;
  }
  if (action === 'apply-job') {
    applyForJob(placeById.get(dataset.place));
    return;
  }
  if (action === 'work-job') {
    workShift(placeById.get(dataset.place));
    return;
  }
  if (action === 'buy-car') {
    buyCarModel(dataset.car);
    return;
  }
  if (action === 'release-jail') {
    releaseFromJail();
  }
}

function handlePhoneAction(action, dataset) {
  if (action === 'gps') {
    setGpsTarget(dataset.target);
    return;
  }
  if (action === 'gps-clear') {
    setGpsTarget(null);
    return;
  }
  if (action === 'teleport-track') {
    teleportToTrack();
    return;
  }
  if (action === 'teleport-home') {
    teleportHome();
  }
}

function handleAction(action) {
  if (action === 'phone') {
    togglePhone();
  } else if (action === 'track') {
    teleportToTrack();
  } else if (action === 'interact') {
    performInteraction();
  } else if (action === 'bag' || action === 'backpack') {
    toggleBackpack();
  } else if (action === 'reset') {
    performReset();
  } else if (action === 'space') {
    toggleEnterExitCar();
  }
}

function setupInput() {
  const movementBindings = {
    w: 'forward',
    ArrowUp: 'forward',
    s: 'back',
    ArrowDown: 'back',
    a: 'left',
    ArrowLeft: 'left',
    d: 'right',
    ArrowRight: 'right',
    Shift: 'brake',
  };

  const normalizeKey = (key) => (key.length === 1 ? key.toLowerCase() : key);

  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    state.pointerLocked = document.pointerLockElement === canvas;
    markUiDirty();
  });

  window.addEventListener('mousemove', (event) => {
    if (!state.pointerLocked) {
      return;
    }
    state.cameraYaw = normalizeAngle(state.cameraYaw + event.movementX * 0.0035);
    state.cameraPitch = clamp(
      state.cameraPitch - event.movementY * 0.0024,
      state.mode === 'driving' ? 0.2 : 0.22,
      state.mode === 'driving' ? 0.72 : 0.86,
    );
  });

  window.addEventListener('keydown', (event) => {
    const key = normalizeKey(event.key);
    if (movementBindings[key]) {
      keys[movementBindings[key]] = true;
      event.preventDefault();
    }

    if (event.repeat) {
      return;
    }

    if (key === ' ') {
      toggleEnterExitCar();
      event.preventDefault();
    }
    if (key === 'e') performInteraction();
    if (key === 'b') toggleBackpack();
    if (key === 'p') togglePhone();
    if (key === 't') teleportToTrack();
    if (key === 'r') performReset();
    if (key === 'n') {
      if (state.trackRaceActive || distanceXZ(player.position, TRACK_CENTER) < 180) {
        resetTrackRace();
        showToast('New race started.');
      }
    }
    if (key === 'Escape') closePanels();
  });

  window.addEventListener('keyup', (event) => {
    const key = normalizeKey(event.key);
    if (movementBindings[key]) {
      keys[movementBindings[key]] = false;
      event.preventDefault();
    }
  });

  window.addEventListener('blur', () => {
    Object.keys(keys).forEach((key) => {
      keys[key] = false;
    });
  });

  touchControlsEl.querySelectorAll('button').forEach((button) => {
    const boundKey = button.dataset.key;
    const action = button.dataset.action;
    if (boundKey) {
      const setPressed = (pressed) => {
        keys[boundKey] = pressed;
        button.classList.toggle('active', pressed);
      };
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        setPressed(true);
      });
      button.addEventListener('pointerup', () => setPressed(false));
      button.addEventListener('pointercancel', () => setPressed(false));
      button.addEventListener('pointerleave', () => setPressed(false));
    }
    if (action) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        handleAction(action);
      });
    }
  });

  actionBarEl.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) {
      handleAction(button.dataset.action);
    }
  });

  centerPanelEl.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-center-action]');
    if (button) {
      handleCenterPanelAction(button.dataset.centerAction, button.dataset);
    }
  });

  phonePanelEl.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-phone-action]');
    if (button) {
      handlePhoneAction(button.dataset.phoneAction, button.dataset);
    }
  });
}

function setupLighting() {
  const hemisphereLight = new THREE.HemisphereLight(0xe9f5ff, 0x2f5034, 1.15);
  scene.add(hemisphereLight);

  const sun = new THREE.DirectionalLight(0xfff2d3, 1.6);
  sun.position.set(70, 120, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 340;
  scene.add(sun);
}

function populateWorld() {
  places.forEach((place) => createSpecialPlace(place));
  createPickups();
  ensureCityChunks(CITY_SPAWN);
  applyPlayerCarTuning();
  state.cameraYaw = player.heading;
  state.cameraPitch = 0.38;
  updateVehicleTransform(player, 1 / 60);
  updateVehicleTransform(policeCar, 1 / 60);
  trackBots.forEach((bot) => updateVehicleTransform(bot, 1 / 60));
  updateAvatarTransform();
  updateMarkers();
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsedTime += dt;
  const instantFps = 1 / Math.max(dt, 0.0001);
  state.fps = lerp(state.fps, instantFps, 0.12);

  ensureCityChunks(state.mode === 'driving' ? player.position : avatar.position);
  updateTrafficLights(dt);
  updateWanted(dt);

  if (state.jailTimer > 0) {
    state.jailTimer = Math.max(0, state.jailTimer - dt);
    if (state.jailTimer === 0 && state.centerPanel === 'jail-lock') {
      releaseFromJail();
    }
  }

  if (state.mode === 'driving') {
    updateDriving(dt);
  } else {
    updateWalking(dt);
  }

  if (state.trackRaceActive) {
    trackBots.forEach((bot) => updateTrackBot(bot, dt));
  }

  updatePolice(dt);
  updatePickups(dt);
  updateInteractionTarget();
  updateMarkers();

  updateVehicleTransform(player, dt);
  updateVehicleTransform(policeCar, dt);
  trackBots.forEach((bot) => updateVehicleTransform(bot, dt));
  updateAvatarTransform();
  updateCamera(dt);

  renderUi();
  renderer.render(scene, camera);
}

setupLighting();
populateWorld();
setupInput();
window.addEventListener('resize', handleResize);
renderUi();
renderer.setAnimationLoop(animate);
