import * as THREE from 'three';

export class PoliceAI {
  constructor(params) {
    this.model = params.model;
    this.player = params.player;
    this.scene = params.scene;
    this.waypoints = params.waypoints || [this.model.position.clone()];
    this.options = Object.assign(
      {
        patrolSpeed: 2.2,
        chaseSpeed: 6,
        detectionRange: 18,
        fov: Math.PI * 0.6,
        loseSightTime: 4,
        waypointTolerance: 0.6,
      },
      params.options || {},
    );

    this.state = 'patrol';
    this.currentWaypoint = 0;
    this._lostTimer = 0;
    this._lastKnownPlayerPos = null;
    this._time = 0;
    this._beaconOn = false;
  }

  update(dt) {
    this._time += dt;
    const playerPos = this.player.position.clone();
    const dist = playerPos.distanceTo(this.model.position);
    const canSee = this._canSeePlayer(playerPos);

    switch (this.state) {
      case 'patrol':
        if (canSee && dist < this.options.detectionRange) {
          this._enterChase(playerPos);
        } else {
          this._patrol(dt);
        }
        break;
      case 'chase':
        if (canSee) {
          this._lastKnownPlayerPos = playerPos.clone();
          this._lostTimer = 0;
          this._chase(dt, playerPos);
        } else {
          this._lostTimer += dt;
          if (this._lostTimer > this.options.loseSightTime) {
            this._enterSearch();
          } else if (this._lastKnownPlayerPos) {
            this._chase(dt, this._lastKnownPlayerPos);
          }
        }
        break;
      case 'search':
        this._search(dt);
        break;
      case 'return':
        this._returnToPatrol(dt);
        break;
      default:
        break;
    }

    if (this.model.userData && this.model.userData.flashBeacons) {
      this.model.userData.flashBeacons(this._beaconOn && Math.floor(this._time * 6) % 2 === 0);
    }

    if (this.model.userData && this.model.userData.head) {
      const head = this.model.userData.head;
      const lookTarget = (this._lastKnownPlayerPos || this.player.position).clone();
      const local = lookTarget.sub(this.model.position);
      const yaw = Math.atan2(local.x, local.z);
      head.rotation.y += (yaw - head.rotation.y) * Math.min(1, dt * 4);
    }
  }

  _enterChase(playerPos) {
    this.state = 'chase';
    this._beaconOn = true;
    this._lastKnownPlayerPos = playerPos.clone();
    this._lostTimer = 0;
  }

  _enterSearch() {
    this.state = 'search';
    this._searchTimer = 6;
    this._beaconOn = true;
  }

  _endSearch() {
    this.state = 'return';
    this._beaconOn = false;
  }

  _patrol(dt) {
    const target = this.waypoints[this.currentWaypoint];
    this._moveToward(target, this.options.patrolSpeed, dt);
    if (this.model.position.distanceTo(target) < this.options.waypointTolerance) {
      this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
    }
  }

  _chase(dt, targetPos) {
    this._moveToward(targetPos, this.options.chaseSpeed, dt);
    if (this.model.position.distanceTo(targetPos) < 1.2) {
      this._onApprehend();
    }
  }

  _search(dt) {
    if (!this._lastKnownPlayerPos) {
      this._endSearch();
      return;
    }
    const radius = 3;
    const angle = (this._time * 0.8) % (Math.PI * 2);
    const target = this._lastKnownPlayerPos.clone().add(
      new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
    );
    this._moveToward(target, this.options.patrolSpeed, dt);
    this._searchTimer -= dt;
    if (this._searchTimer <= 0) this._endSearch();
  }

  _returnToPatrol(dt) {
    const target = this.waypoints[this.currentWaypoint];
    this._moveToward(target, this.options.patrolSpeed, dt);
    if (this.model.position.distanceTo(target) < this.options.waypointTolerance) {
      this.state = 'patrol';
    }
  }

  _moveToward(target, speed, dt) {
    const dir = target.clone().sub(this.model.position);
    dir.y = 0;
    const len = dir.length();
    if (len < 0.001) return;
    dir.normalize();
    this.model.position.addScaledVector(dir, Math.min(speed * dt, len));
    const targetYaw = Math.atan2(dir.x, dir.z);
    this.model.rotation.y += (targetYaw - this.model.rotation.y) * Math.min(1, dt * 6);
  }

  _canSeePlayer(playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.model.position);
    dirToPlayer.y = 0;
    const dist = dirToPlayer.length();
    if (dist > this.options.detectionRange) return false;

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion);
    const angle = forward.angleTo(dirToPlayer.normalize());
    if (angle > this.options.fov / 2) return false;

    if (this.scene && this.scene.children) {
      const ray = new THREE.Raycaster(
        this.model.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
        dirToPlayer.normalize(),
        0,
        dist,
      );
      const hits = ray.intersectObjects(this.scene.children, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj) {
          if (obj === this.player) return true;
          obj = obj.parent;
        }
        return false;
      }
    }

    return true;
  }

  _onApprehend() {
    this.state = 'patrol';
    this._beaconOn = false;
    if (this.onApprehend) this.onApprehend(this);
  }
}
