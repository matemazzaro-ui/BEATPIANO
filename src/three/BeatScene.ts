import * as THREE from 'three';
import { LANES, NoteCubeData } from '../types';

export interface SceneCallbacks {
  onHit: (cube: NoteCubeData, rating: 'PERFECT' | 'GREAT' | 'GOOD') => void;
  onMiss: (cube: NoteCubeData) => void;
}

export class BeatScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private isSoftwareGl = false;

  // Visual components
  private sunMesh!: THREE.Mesh;
  private sunMaterial!: THREE.ShaderMaterial;
  private gridMesh!: THREE.LineSegments;
  private trackLines!: THREE.LineSegments;
  private targetLineMesh!: THREE.Mesh;
  private laneTargetMarkers: THREE.Mesh[] = [];
  private mountainGroup!: THREE.Group;
  private starParticles!: THREE.Points;

  // Active note cubes
  private cubeGroup: THREE.Group;
  private cubeMap: Map<THREE.Object3D, NoteCubeData> = new Map();
  private activeCubes: NoteCubeData[] = [];

  // Particle explosion pool
  private particleGroup: THREE.Group;
  private particles: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotationSpeed: THREE.Vector3;
    life: number;
    maxLife: number;
  }[] = [];

  // Hit rings
  private hitRings: { mesh: THREE.Mesh; scale: number; opacity: number }[] = [];

  // Camera orientation & Lerp
  private baseCameraPos = new THREE.Vector3(0, 3.2, 5.5);
  private baseLookAt = new THREE.Vector3(0, 1.2, -20);
  private targetYaw = 0;   // In radians, clamped [-PI/2, PI/2]
  private targetPitch = 0; // In radians, clamped [-0.4, 0.4]
  private currentYaw = 0;
  private currentPitch = 0;

  // Raycaster for touch/click interaction
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  // Animation frame
  private animFrameId: number | null = null;
  private callbacks: SceneCallbacks;

  // Game state
  public isRunning = false;
  public speed = 36; // units per second
  private gridOffset = 0;

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Detect software WebGL
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Scene setup
    this.scene = new THREE.Scene();
    const bgDark = 0x070216;
    this.scene.background = new THREE.Color(bgDark);
    this.scene.fog = new THREE.FogExp2(bgDark, 0.016);

    // 3. Camera
    const aspect = container.clientWidth / (container.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 300);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.baseLookAt);

    // 4. Renderer with pixelRatio capped at 2 for mobile 60fps
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    // 5. Build Synthwave World
    this.setupLighting();
    this.createSynthwaveSun();
    this.createSynthwaveMountains();
    this.createLanesAndGrid();
    this.createStarfield();
    this.createHitMarkers();

    // 6. Bind events
    window.addEventListener('resize', this.onResize);
    this.bindInputs();

    // 7. Start render loop
    this.animate();
  }

  private setupLighting() {
    // Synthwave Dual-Temperature Lighting
    const hemiLight = new THREE.HemisphereLight(0x00f0ff, 0xff007f, 1.2);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xff00aa, 1.4);
    dirLight.position.set(0, 10, -30);
    this.scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0x221144, 0.8);
    this.scene.add(ambientLight);
  }

  /**
   * Signature 80s Synthwave Sun with horizontal glowing blinds
   */
  private createSynthwaveSun() {
    const sunGeo = new THREE.CircleGeometry(26, 48);

    const sunUniforms = {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uColorTop: { value: new THREE.Color(0xfff700) }, // Warm vibrant yellow
      uColorBottom: { value: new THREE.Color(0xff0066) } // Synthwave magenta
    };

    this.sunMaterial = new THREE.ShaderMaterial({
      uniforms: sunUniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColorTop;
        uniform vec3 uColorBottom;
        uniform float uBass;

        void main() {
          // Sunset gradient
          vec3 col = mix(uColorBottom, uColorTop, pow(vUv.y, 0.8));

          // Horizontal slicing lines (synthwave venetian blinds)
          float lineCount = 18.0;
          float linePos = fract(vUv.y * lineCount);
          float lineCut = smoothstep(0.0, 0.45, vUv.y); // lines thicker near bottom
          
          if (vUv.y < 0.65 && linePos < (0.28 * (1.0 - vUv.y * 1.2))) {
            discard;
          }

          // Glow boost
          col += vec3(0.2, 0.05, 0.2) * (1.0 + uBass * 1.5);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.sunMesh = new THREE.Mesh(sunGeo, this.sunMaterial);
    this.sunMesh.position.set(0, 14, -135);
    this.scene.add(this.sunMesh);
  }

  /**
   * Distant Wireframe Neon Mountains on flanks
   */
  private createSynthwaveMountains() {
    this.mountainGroup = new THREE.Group();

    const createRidge = (side: number) => {
      const geo = new THREE.PlaneGeometry(60, 160, 16, 32);
      const pos = geo.attributes.position;

      // Displace heights procedurally
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const distFromCenter = Math.abs(x + (side * 15));
        const height = Math.sin(y * 0.1) * 3 + Math.cos(x * 0.2) * 4 + (distFromCenter * 0.4);
        pos.setZ(i, Math.max(0, height));
      }
      geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color: 0x14052c,
        emissive: 0x9d00ff,
        emissiveIntensity: 0.35,
        wireframe: true,
        roughness: 0.9,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(side * 36, -0.5, -70);
      return mesh;
    };

    this.mountainGroup.add(createRidge(-1));
    this.mountainGroup.add(createRidge(1));
    this.scene.add(this.mountainGroup);
  }

  /**
   * Endless Synthwave Highway and Neon Lane Grid
   */
  private createLanesAndGrid() {
    // 1. Scrolling Grid Lines
    const size = 180;
    const divisions = 60;
    const gridHelper = new THREE.GridHelper(size, divisions, 0x00f0ff, 0x7700aa);
    gridHelper.position.y = -0.05;
    gridHelper.position.z = -50;
    this.gridMesh = gridHelper as unknown as THREE.LineSegments;
    this.scene.add(this.gridMesh);

    // 2. Highway Base Platform
    const roadGeo = new THREE.PlaneGeometry(10, 160);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x0b041e,
      roughness: 0.3,
      metalness: 0.8,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, -0.02, -60);
    this.scene.add(roadMesh);

    // 3. Lane Glowing Boundaries
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
    const points: THREE.Vector3[] = [];
    const laneWidth = 2.0;

    for (let i = -2; i <= 2; i++) {
      points.push(new THREE.Vector3(i * laneWidth, 0.05, 10));
      points.push(new THREE.Vector3(i * laneWidth, 0.05, -130));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    this.trackLines = new THREE.LineSegments(lineGeo, lineMat);
    this.scene.add(this.trackLines);

    // 4. Hit Line Laser Beam at Z = 0
    const laserGeo = new THREE.BoxGeometry(9.6, 0.12, 0.2);
    const laserMat = new THREE.MeshStandardMaterial({
      color: 0xff007f,
      emissive: 0xff007f,
      emissiveIntensity: 2.5,
      roughness: 0.1,
    });
    this.targetLineMesh = new THREE.Mesh(laserGeo, laserMat);
    this.targetLineMesh.position.set(0, 0.06, 0);
    this.scene.add(this.targetLineMesh);
  }

  /**
   * Glowing Hit Target Discs for each lane
   */
  private createHitMarkers() {
    LANES.forEach((lane) => {
      const ringGeo = new THREE.RingGeometry(0.55, 0.75, 32);
      const ringMat = new THREE.MeshStandardMaterial({
        color: lane.hex,
        emissive: lane.hex,
        emissiveIntensity: 1.8,
        side: THREE.DoubleSide,
      });
      const marker = new THREE.Mesh(ringGeo, ringMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(lane.x, 0.08, 0);
      this.laneTargetMarkers.push(marker);
      this.scene.add(marker);
    });
  }

  /**
   * Floating Neon Starfield & Dust reacting to beats
   */
  private createStarfield() {
    const starCount = 350;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = -Math.random() * 150;

      const isCyan = Math.random() > 0.5;
      colors[i * 3] = isCyan ? 0.0 : 1.0;
      colors[i * 3 + 1] = isCyan ? 0.9 : 0.0;
      colors[i * 3 + 2] = 1.0;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.9,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });

    this.starParticles = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starParticles);
  }

  /**
   * Spawn a 3D Composite Note Cube
   */
  public spawnCube(cubeData: NoteCubeData) {
    const lane = LANES[cubeData.lane];
    const group = new THREE.Group();

    // 1. Inner Glowing Core
    const coreGeo = new THREE.BoxGeometry(1.2, 0.9, 1.2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x110222,
      emissive: lane.hex,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.8,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // 2. Outer Wireframe / Beveled Accent
    const wireGeo = new THREE.BoxGeometry(1.28, 0.96, 1.28);
    const wireMat = new THREE.MeshBasicMaterial({
      color: lane.hex,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    group.add(wireMesh);

    // Position at spawn Z
    group.position.set(lane.x, 0.6, cubeData.z);
    group.userData = { cubeData };

    this.cubeGroup.add(group);
    this.cubeMap.set(group, cubeData);
    this.cubeMap.set(coreMesh, cubeData);
    this.activeCubes.push(cubeData);
  }

  /**
   * Trigger Particle Explosion on Hit
   */
  private triggerHitExplosion(x: number, y: number, z: number, colorHex: number) {
    const particleCount = 18;
    const shardGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);

    for (let i = 0; i < particleCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 1.0,
      });

      const shard = new THREE.Mesh(shardGeo, mat);
      shard.position.set(x, y, z);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        Math.random() * 8 + 3,
        (Math.random() - 0.5) * 12
      );

      const rot = new THREE.Vector3(
        Math.random() * 10,
        Math.random() * 10,
        Math.random() * 10
      );

      this.particleGroup.add(shard);
      this.particles.push({
        mesh: shard,
        velocity: vel,
        rotationSpeed: rot,
        life: 0,
        maxLife: 0.65 + Math.random() * 0.35,
      });
    }

    // Impact ring wave
    const ringGeo = new THREE.RingGeometry(0.3, 0.5, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.15, z);
    this.scene.add(ring);
    this.hitRings.push({ mesh: ring, scale: 1, opacity: 1.0 });
  }

  /**
   * Touch & Click Hit Checking with Raycaster
   */
  private bindInputs() {
    const canvas = this.renderer.domElement;

    // Raycast on pointer / touch down
    const handleTap = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);

      // Check cubes
      const intersects = this.raycaster.intersectObjects(this.cubeGroup.children, true);
      let hitCube: NoteCubeData | null = null;

      if (intersects.length > 0) {
        for (const hit of intersects) {
          const data = this.findCubeData(hit.object);
          if (data && !data.hit && !data.missed) {
            // Check if cube is within hit range
            const distFromTarget = Math.abs(data.z - data.targetZ);
            if (distFromTarget < 6.5) {
              hitCube = data;
              break;
            }
          }
        }
      }

      // If no direct cube clicked, check if player tapped one of the lane markers
      if (!hitCube) {
        const laneIntersects = this.raycaster.intersectObjects(this.laneTargetMarkers, false);
        if (laneIntersects.length > 0) {
          const marker = laneIntersects[0].object as THREE.Mesh;
          const laneIdx = this.laneTargetMarkers.indexOf(marker);
          if (laneIdx !== -1) {
            hitCube = this.getClosestHittableCubeInLane(laneIdx);
          }
        }
      }

      // If hit found, trigger success
      if (hitCube) {
        this.processHit(hitCube);
      }
    };

    // Pointer events (handles mouse and single touch)
    canvas.addEventListener('pointerdown', (e) => {
      handleTap(e.clientX, e.clientY);
    });

    // Multi-touch support for tapping multiple lanes simultaneously
    canvas.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        handleTap(touch.clientX, touch.clientY);
      }
    }, { passive: true });
  }

  /**
   * External Trigger for Lane (e.g. keyboard press D, F, J, K or bottom mobile button)
   */
  public triggerLaneHit(laneIdx: number) {
    // Light up target ring briefly
    const marker = this.laneTargetMarkers[laneIdx];
    if (marker && marker.material instanceof THREE.MeshStandardMaterial) {
      marker.material.emissiveIntensity = 4.0;
      setTimeout(() => {
        if (marker.material instanceof THREE.MeshStandardMaterial) {
          marker.material.emissiveIntensity = 1.8;
        }
      }, 120);
    }

    const cube = this.getClosestHittableCubeInLane(laneIdx);
    if (cube) {
      this.processHit(cube);
      return true;
    }
    return false;
  }

  private getClosestHittableCubeInLane(laneIdx: number): NoteCubeData | null {
    let closest: NoteCubeData | null = null;
    let minDistance = 7.0; // Hit window threshold

    for (const cube of this.activeCubes) {
      if (cube.lane === laneIdx && !cube.hit && !cube.missed) {
        const dist = Math.abs(cube.z - cube.targetZ);
        if (dist < minDistance) {
          minDistance = dist;
          closest = cube;
        }
      }
    }
    return closest;
  }

  private processHit(cube: NoteCubeData) {
    cube.hit = true;
    const dist = Math.abs(cube.z - cube.targetZ);

    let rating: 'PERFECT' | 'GREAT' | 'GOOD' = 'GOOD';
    if (dist < 1.2) rating = 'PERFECT';
    else if (dist < 3.2) rating = 'GREAT';

    const lane = LANES[cube.lane];
    this.triggerHitExplosion(lane.x, 0.6, cube.z, lane.hex);
    this.removeCubeMesh(cube);
    this.callbacks.onHit(cube, rating);
  }

  private findCubeData(obj: THREE.Object3D): NoteCubeData | null {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
      if (this.cubeMap.has(curr)) return this.cubeMap.get(curr)!;
      if (curr.userData && curr.userData.cubeData) return curr.userData.cubeData;
      curr = curr.parent;
    }
    return null;
  }

  private removeCubeMesh(cube: NoteCubeData) {
    // Find mesh in group
    for (let i = this.cubeGroup.children.length - 1; i >= 0; i--) {
      const child = this.cubeGroup.children[i];
      if (child.userData && child.userData.cubeData === cube) {
        this.cubeGroup.remove(child);
        this.cubeMap.delete(child);
        break;
      }
    }
  }

  /**
   * Set Gyroscope Target angles with strict clamping
   * Yaw: -90° to +90° (-Math.PI/2 to +Math.PI/2)
   * Pitch: -25° to +25°
   */
  public setGyroscopeAngles(yawDeg: number, pitchDeg: number) {
    // Convert degrees to radians
    const yawRad = THREE.MathUtils.degToRad(yawDeg);
    const pitchRad = THREE.MathUtils.degToRad(pitchDeg);

    // Clamping strictly per SDD
    const maxYaw = Math.PI / 2; // 90 degrees
    this.targetYaw = THREE.MathUtils.clamp(yawRad, -maxYaw, maxYaw);

    const maxPitch = 0.44; // ~25 degrees
    this.targetPitch = THREE.MathUtils.clamp(pitchRad, -maxPitch, maxPitch);
  }

  /**
   * Main Scene Update and Render Tick
   */
  public update(bassIntensity: number) {
    const delta = Math.min(this.clock.getDelta(), 0.08);

    // 1. Advance cubes along track
    if (this.isRunning) {
      for (let i = this.activeCubes.length - 1; i >= 0; i--) {
        const cube = this.activeCubes[i];
        cube.z += this.speed * delta;

        // Update 3D position
        for (const child of this.cubeGroup.children) {
          if (child.userData && child.userData.cubeData === cube) {
            child.position.z = cube.z;
            child.rotation.y += delta * 1.5;
            break;
          }
        }

        // Check if passed hit line without being hit -> MISS
        if (!cube.hit && !cube.missed && cube.z > (cube.targetZ + 5.0)) {
          cube.missed = true;
          this.removeCubeMesh(cube);
          this.callbacks.onMiss(cube);
          this.activeCubes.splice(i, 1);
        } else if (cube.hit) {
          this.activeCubes.splice(i, 1);
        }
      }

      // 2. Scroll Endless Grid
      this.gridOffset = (this.gridOffset + this.speed * delta) % 3;
      if (this.gridMesh) {
        this.gridMesh.position.z = -50 + this.gridOffset;
      }
    }

    // 3. Audio Reactivity: Sun, Starfield & Pulsing Laser
    if (this.sunMaterial) {
      this.sunMaterial.uniforms.uTime.value += delta;
      this.sunMaterial.uniforms.uBass.value = bassIntensity;
      const sunScale = 1.0 + bassIntensity * 0.12;
      this.sunMesh.scale.set(sunScale, sunScale, 1.0);
    }

    if (this.targetLineMesh && this.targetLineMesh.material instanceof THREE.MeshStandardMaterial) {
      this.targetLineMesh.material.emissiveIntensity = 2.0 + bassIntensity * 2.5;
    }

    if (this.starParticles) {
      this.starParticles.rotation.z += delta * 0.02;
    }

    // 4. Update particle debris
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      if (p.life >= p.maxLife) {
        this.particleGroup.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.velocity.y -= 18 * delta; // gravity
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.mesh.rotation.x += p.rotationSpeed.x * delta;
      p.mesh.rotation.y += p.rotationSpeed.y * delta;

      const progress = p.life / p.maxLife;
      if (p.mesh.material instanceof THREE.MeshStandardMaterial) {
        p.mesh.material.opacity = 1.0 - progress;
      }
    }

    // 5. Update hit rings
    for (let i = this.hitRings.length - 1; i >= 0; i--) {
      const r = this.hitRings[i];
      r.scale += delta * 6;
      r.opacity -= delta * 2.5;
      r.mesh.scale.set(r.scale, r.scale, 1);

      if (r.mesh.material instanceof THREE.MeshBasicMaterial) {
        r.mesh.material.opacity = Math.max(0, r.opacity);
      }

      if (r.opacity <= 0) {
        this.scene.remove(r.mesh);
        this.hitRings.splice(i, 1);
      }
    }

    // 6. Camera Gyroscope Lerp (Smooth, no snapping)
    this.currentYaw = THREE.MathUtils.lerp(this.currentYaw, this.targetYaw, 0.12);
    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, this.targetPitch, 0.12);

    // Apply rotation around look center
    this.camera.position.x = this.baseCameraPos.x + Math.sin(this.currentYaw) * 1.5;
    this.camera.position.y = this.baseCameraPos.y - Math.sin(this.currentPitch) * 0.8;
    this.camera.rotation.y = -this.currentYaw * 0.7;
    this.camera.rotation.x = -this.currentPitch * 0.5 - 0.08;

    // 7. Render frame
    this.renderer.render(this.scene, this.camera);
  }

  private animate = () => {
    this.update(0); // fallback tick if external loop isn't calling update
    this.animFrameId = requestAnimationFrame(this.animate);
  };

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public resetGame() {
    // Clear all active cubes
    while (this.cubeGroup.children.length > 0) {
      const child = this.cubeGroup.children[0];
      this.cubeGroup.remove(child);
    }
    this.cubeMap.clear();
    this.activeCubes = [];
  }

  public dispose() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.container && this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
