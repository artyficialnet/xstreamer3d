import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AvatarId, FaceFeatures } from '../../types';
import { ThumbsUp, Hand, Music, Flame, Sparkles } from 'lucide-react';
import {
  Character3DController,
  buildCatCharacter,
  buildDogCharacter,
  buildFemaleCharacter,
  buildHorseCharacter,
  buildFoxCharacter,
  buildProceduralRobotCharacter,
  buildMeshOutlineCharacter,
} from './threeCharacterBuilder';

const ROBOT_GLB_URL =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

// Cache for loaded GLTF data
let cachedGLTF: GLTF | null = null;
let loadingPromise: Promise<GLTF> | null = null;

function loadRobotGLTF(): Promise<GLTF> {
  if (cachedGLTF) return Promise.resolve(cachedGLTF);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      ROBOT_GLB_URL,
      (gltf) => {
        cachedGLTF = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.error('[ThreeAvatarCanvas] Error loading RobotExpressive.glb:', err);
        loadingPromise = null;
        reject(err);
      }
    );
  });

  return loadingPromise;
}

interface ThreeAvatarCanvasProps {
  avatarId?: AvatarId;
  features: FaceFeatures;
  userName?: string;
  isSpeaking?: boolean;
  className?: string;
  showEmoteControls?: boolean;
}

export const ThreeAvatarCanvas: React.FC<ThreeAvatarCanvasProps> = ({
  avatarId = 'three_robot',
  features,
  userName,
  isSpeaking = false,
  className = '',
  showEmoteControls = true,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const isGLBRobot = avatarId === 'three_robot';
  const [isLoading, setIsLoading] = useState(isGLBRobot && !cachedGLTF);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentEmote, setCurrentEmote] = useState<string | null>(null);

  // References across render loop
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const headBoneRef = useRef<THREE.Bone | null>(null);
  const neckBoneRef = useRef<THREE.Bone | null>(null);
  const initialHeadRotationRef = useRef<THREE.Euler | null>(null);
  const initialNeckRotationRef = useRef<THREE.Euler | null>(null);
  const faceMeshesRef = useRef<THREE.Mesh[]>([]);
  const robotMouthBarsRef = useRef<THREE.Mesh[]>([]);
  const characterControllerRef = useRef<Character3DController | null>(null);

  const featuresRef = useRef(features);
  featuresRef.current = features;

  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  // Internal continuous smoothed tracking state to eliminate all jitter/sobresaltos
  const smoothPoseRef = useRef({
    yaw: 0,
    pitch: 0,
    roll: 0,
    jawOpen: 0,
    mouthSmile: 0,
    mouthPucker: 0,
    browRaise: 0,
    browFurrow: 0,
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    gazeX: 0,
    gazeY: 0,
    lastValidTime: performance.now(),
  });

  const emoteTriggerRef = useRef<{ name: string; start: number } | null>(null);

  // Crossfade from current state to new emote/state
  const playEmote = useCallback(
    (emoteName: string, duration = 0.25) => {
      setCurrentEmote(emoteName);
      emoteTriggerRef.current = { name: emoteName, start: performance.now() };

      // If GLTF robot
      const actions = actionsRef.current;
      const mixer = mixerRef.current;
      if (actions[emoteName] && mixer) {
        const prevAction = activeActionRef.current;
        const newAction = actions[emoteName];

        if (prevAction && prevAction !== newAction) {
          prevAction.fadeOut(duration);
        }

        newAction
          .reset()
          .setEffectiveTimeScale(1)
          .setEffectiveWeight(1)
          .fadeIn(duration)
          .play();

        activeActionRef.current = newAction;

        const onFinished = (e: any) => {
          if (e.action === newAction) {
            mixer.removeEventListener('finished', onFinished);
            setCurrentEmote(null);
            emoteTriggerRef.current = null;
            const idleAction = actions['Idle'] || actions['Standing'];
            if (idleAction) {
              newAction.fadeOut(duration);
              idleAction.reset().fadeIn(duration).play();
              activeActionRef.current = idleAction;
            }
          }
        };

        mixer.addEventListener('finished', onFinished);
      } else {
        // Procedural Emote Auto-reset after 2.5s
        setTimeout(() => {
          setCurrentEmote(null);
          emoteTriggerRef.current = null;
        }, 2500);
      }
    },
    []
  );

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    let animationFrameId: number;
    const clock = new THREE.Clock();

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera Setup (fixed 1:1 square frame)
    const FIXED_WIDTH = 320;
    const FIXED_HEIGHT = 320;
    const aspect = 1.0;
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    camera.position.set(0, 4.4, 4.8);
    camera.lookAt(0, 3.8, 0);
    cameraRef.current = camera;

    // 3. Renderer Setup (fixed 320x320 resolution)
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(FIXED_WIDTH, FIXED_HEIGHT);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Studio 3D Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.8);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.4);
    dirLight.position.set(4, 10, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    scene.add(dirLight);

    // Dynamic Character Rim Light
    const themeRimColors: Record<string, number> = {
      three_robot: 0x06b6d4,
      cat_3d: 0xf472b6,
      dog_3d: 0x38bdf8,
      female_3d: 0xa855f7,
      horse_3d: 0xf97316,
    };
    const rimColor = themeRimColors[avatarId] || 0x06b6d4;

    const rimLight = new THREE.PointLight(rimColor, 3.5, 12);
    rimLight.position.set(-3, 5, -2);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xa855f7, 1.8, 10);
    fillLight.position.set(3, 3, -1);
    scene.add(fillLight);

    // 5. Stylized Holographic Pedestal
    const groundGeo = new THREE.CircleGeometry(2.4, 48);
    const groundMat = new THREE.MeshBasicMaterial({
      color: rimColor,
      transparent: true,
      opacity: 0.12,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    scene.add(ground);

    const ringGeo = new THREE.RingGeometry(2.1, 2.25, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: rimColor,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    // 6. Build the appropriate 3D Avatar
    if (isGLBRobot) {
      // Robot 3D from GLTF (RobotExpressive.glb)
      loadRobotGLTF()
        .then((gltf) => {
          if (isDisposed) return;
          setIsLoading(false);

          const clonedScene = SkeletonUtils.clone(gltf.scene) as THREE.Group;
          clonedScene.position.set(0, 0, 0);
          clonedScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          scene.add(clonedScene);

          // Locate Bones and store initial rest pose
          clonedScene.traverse((child) => {
            if (child.name === 'Head' && (child as THREE.Bone).isBone) {
              headBoneRef.current = child as THREE.Bone;
              initialHeadRotationRef.current = child.rotation.clone();
            }
            if (child.name === 'Neck' && (child as THREE.Bone).isBone) {
              neckBoneRef.current = child as THREE.Bone;
              initialNeckRotationRef.current = child.rotation.clone();
            }
          });

          // Locate All Face Meshes for Morph Target Blendshapes (Head_2, Head_3, Head_4)
          const targetMeshes: THREE.Mesh[] = [];
          ['Head_2', 'Head_3', 'Head_4'].forEach((name) => {
            const m = clonedScene.getObjectByName(name) as THREE.Mesh;
            if (m && m.morphTargetDictionary) {
              targetMeshes.push(m);
            }
          });
          faceMeshesRef.current = targetMeshes;

          // ========================================================
          // PERFECT ROBOT MOUTH MAPPING: 7-BAR CYBER LED MATRIX
          // Attached directly to Head_4 face plate, centered and aligned
          // ========================================================
          const head4Mesh = clonedScene.getObjectByName('Head_4') as THREE.Mesh;
          if (head4Mesh) {
            const mouthGroup = new THREE.Group();
            // Located on the lower face visor screen
            mouthGroup.position.set(0, -0.0098, 0.0050);

            const ledMat = new THREE.MeshBasicMaterial({
              color: 0x06b6d4, // Glowing Cyan Neon
              transparent: true,
              opacity: 0.95,
            });

            const bars: THREE.Mesh[] = [];
            for (let i = 0; i < 7; i++) {
              const bar = new THREE.Mesh(
                new THREE.BoxGeometry(0.00065, 0.0012, 0.00025),
                ledMat
              );
              bar.position.set((i - 3) * 0.0011, 0, 0);
              mouthGroup.add(bar);
              bars.push(bar);
            }
            head4Mesh.add(mouthGroup);
            robotMouthBarsRef.current = bars;
          }

          // Setup Mixer & Actions
          // CRITICAL: Filter out any head, neck, or morph tracks from GLTF clips
          // so the animation mixer never conflicts with head tracking or facial expressions!
          const mixer = new THREE.AnimationMixer(clonedScene);
          mixerRef.current = mixer;
          const actions: Record<string, THREE.AnimationAction> = {};

          gltf.animations.forEach((clip) => {
            const cleanClip = clip.clone();
            cleanClip.tracks = cleanClip.tracks.filter((t) => {
              const lower = t.name.toLowerCase();
              return (
                !lower.startsWith('head') &&
                !lower.startsWith('neck') &&
                !lower.includes('morphtargetinfluences')
              );
            });

            const action = mixer.clipAction(cleanClip);
            actions[cleanClip.name] = action;

            if (
              ['Wave', 'ThumbsUp', 'Dance', 'Jump', 'Death', 'Punch', 'Yes', 'No'].includes(
                cleanClip.name
              )
            ) {
              action.loop = THREE.LoopOnce;
              action.clampWhenFinished = true;
            }
          });

          actionsRef.current = actions;

          const startAction = actions['Idle'] || actions['Standing'] || actions['Walking'];
          if (startAction) {
            startAction.play();
            activeActionRef.current = startAction;
          }
        })
        .catch((err) => {
          if (!isDisposed) {
            setIsLoading(false);
            setLoadError('Error al cargar robot 3D');
          }
        });
    } else {
      // Distinct 3D Characters Built Instantly
      setIsLoading(false);
      let controller: Character3DController;

      if (avatarId === 'cat_3d' || avatarId === 'neko_pop') {
        controller = buildCatCharacter();
      } else if (avatarId === 'dog_3d') {
        controller = buildDogCharacter();
      } else if (avatarId === 'female_3d') {
        controller = buildFemaleCharacter();
      } else if (avatarId === 'horse_3d') {
        controller = buildHorseCharacter();
      } else if (avatarId === 'fox_sensei') {
        controller = buildFoxCharacter();
      } else if (avatarId === 'mesh_outline') {
        controller = buildMeshOutlineCharacter();
      } else if (avatarId === 'cyber_nova') {
        controller = buildProceduralRobotCharacter('cyber');
      } else if (avatarId === 'pixel_punk') {
        controller = buildProceduralRobotCharacter('punk');
      } else {
        controller = buildProceduralRobotCharacter('mecha');
      }

      characterControllerRef.current = controller;
      scene.add(controller.group);
    }

    // 7. Main 60fps Three.js Render Loop with Continuous Smoothing Filter
    const render = () => {
      if (isDisposed) return;
      animationFrameId = requestAnimationFrame(render);

      const dt = clock.getDelta();
      const now = performance.now();
      const feat = featuresRef.current;
      const cur = smoothPoseRef.current;

      // ========================================================
      // ADAPTIVE CONTINUOUS SMOOTHING (ELIMINATES ALL SOBRESALTOS)
      // When tracking is momentarily lost or coordinates fluctuate,
      // it holds pose steadily and glides without any jerking.
      // ========================================================
      const isDetected = feat.isFaceDetected;

      if (isDetected) {
        cur.lastValidTime = now;

        const safeYaw = Number.isFinite(feat.yaw) ? feat.yaw : 0;
        const safePitch = Number.isFinite(feat.pitch) ? feat.pitch : 0;
        const safeRoll = Number.isFinite(feat.roll) ? feat.roll : 0;

        const targetYaw = safeYaw * 0.85;
        // Non-inverted vertical tilt: Looking UP tilts UP, Nodding DOWN nods DOWN
        const targetPitch = -safePitch * 0.75;
        const targetRoll = safeRoll * 0.75;

        // Direct camera synchronization with smooth motion
        const maxDelta = 0.55;
        const deltaYaw = THREE.MathUtils.clamp(targetYaw - cur.yaw, -maxDelta, maxDelta);
        const deltaPitch = THREE.MathUtils.clamp(targetPitch - cur.pitch, -maxDelta, maxDelta);
        const deltaRoll = THREE.MathUtils.clamp(targetRoll - cur.roll, -maxDelta, maxDelta);

        // Instantaneous, zero-lag interpolation synchronized with webcam
        cur.yaw += deltaYaw * 0.75;
        cur.pitch += deltaPitch * 0.75;
        cur.roll += deltaRoll * 0.75;

        // Instant mouth tracking (fast opening attack, snappy release)
        const targetJaw = Math.min(1, Math.max(0, Number.isFinite(feat.jawOpen) ? feat.jawOpen : 0));
        const jawLerpRate = targetJaw > cur.jawOpen ? 0.85 : 0.65;
        cur.jawOpen = THREE.MathUtils.lerp(cur.jawOpen, targetJaw, jawLerpRate);

        cur.mouthSmile = THREE.MathUtils.lerp(cur.mouthSmile, Number.isFinite(feat.mouthSmile) ? feat.mouthSmile : 0, 0.70);
        cur.mouthPucker = THREE.MathUtils.lerp(cur.mouthPucker, Number.isFinite(feat.mouthPucker) ? feat.mouthPucker : 0, 0.70);
        cur.browRaise = THREE.MathUtils.lerp(cur.browRaise, Number.isFinite(feat.browRaise) ? feat.browRaise : 0, 0.70);
        cur.browFurrow = THREE.MathUtils.lerp(cur.browFurrow, Number.isFinite(feat.browFurrow) ? feat.browFurrow : 0, 0.70);
        cur.eyeBlinkLeft = THREE.MathUtils.lerp(cur.eyeBlinkLeft, Number.isFinite(feat.eyeBlinkLeft) ? feat.eyeBlinkLeft : 0, 0.85);
        cur.eyeBlinkRight = THREE.MathUtils.lerp(cur.eyeBlinkRight, Number.isFinite(feat.eyeBlinkRight) ? feat.eyeBlinkRight : 0, 0.85);
        cur.gazeX = THREE.MathUtils.lerp(cur.gazeX, Number.isFinite(feat.gazeX) ? feat.gazeX : 0, 0.65);
        cur.gazeY = THREE.MathUtils.lerp(cur.gazeY, Number.isFinite(feat.gazeY) ? feat.gazeY : 0, 0.65);
      } else {
        // Face tracking interrupted / frame drop:
        // Hold pose steadily during short interruptions (<400ms), then gently decay to neutral
        const timeSinceLost = now - cur.lastValidTime;
        if (timeSinceLost >= 400) {
          const decay = 0.025; // Completely smooth gradual return to neutral
          cur.yaw = THREE.MathUtils.lerp(cur.yaw, 0, decay);
          cur.pitch = THREE.MathUtils.lerp(cur.pitch, 0, decay);
          cur.roll = THREE.MathUtils.lerp(cur.roll, 0, decay);
          cur.jawOpen = THREE.MathUtils.lerp(cur.jawOpen, 0, decay);
          cur.mouthSmile = THREE.MathUtils.lerp(cur.mouthSmile, 0, decay);
          cur.browRaise = THREE.MathUtils.lerp(cur.browRaise, 0, decay);
          cur.browFurrow = THREE.MathUtils.lerp(cur.browFurrow, 0, decay);
          cur.eyeBlinkLeft = THREE.MathUtils.lerp(cur.eyeBlinkLeft, 0, decay);
          cur.eyeBlinkRight = THREE.MathUtils.lerp(cur.eyeBlinkRight, 0, decay);
        }
      }

      // ========================================================
      // A. UPDATE GLTF ROBOT (three_robot)
      // ========================================================
      if (isGLBRobot) {
        if (mixerRef.current) {
          mixerRef.current.update(dt);
        }

        // 1. Head Bone Rotation (smooth offset applied to rest pose)
        if (headBoneRef.current && initialHeadRotationRef.current) {
          const rest = initialHeadRotationRef.current;
          headBoneRef.current.rotation.x = rest.x + cur.pitch;
          headBoneRef.current.rotation.y = rest.y + cur.yaw;
          headBoneRef.current.rotation.z = rest.z + cur.roll;
        }

        // 2. Neck Bone Rotation (anatomical sway applied to rest pose)
        if (neckBoneRef.current && initialNeckRotationRef.current) {
          const rest = initialNeckRotationRef.current;
          neckBoneRef.current.rotation.x = rest.x + cur.pitch * 0.25;
          neckBoneRef.current.rotation.y = rest.y + cur.yaw * 0.35;
          neckBoneRef.current.rotation.z = rest.z + cur.roll * 0.30;
        }

        // Real-time mouth mapping combining jaw aperture and audio speech volume
        const speechVol = Math.max(0, Math.min(1, feat.audioVolume || 0));
        const speakingBoost = isSpeakingRef.current ? 0.45 : 0;
        const activeMouthOpen = Math.min(1, Math.max(cur.jawOpen, speechVol * 1.8, speakingBoost));

        // 3. Perfect Cyber Mouth Mapping (Animated Equalizer LED Matrix)
        const mouthBars = robotMouthBarsRef.current;
        if (mouthBars.length > 0) {
          const smile = cur.mouthSmile;
          const pucker = cur.mouthPucker;

          mouthBars.forEach((bar, i) => {
            const dist = Math.abs(i - 3) / 3; // 0 at center, 1 at edge
            const centerFactor = 1 - dist * 0.55;

            // Height reacts in real time to jaw aperture & speech audio volume
            const targetH = 1.0 + (activeMouthOpen * 5.2 + speechVol * 3.5) * centerFactor;
            bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, Math.max(0.4, targetH), 0.35);

            // Width contracts with mouth pucker
            bar.scale.x = THREE.MathUtils.lerp(bar.scale.x, Math.max(0.4, 1.0 - pucker * 0.45), 0.3);

            // Curvature: smile curves outer bars up; frown curves outer bars down
            const smileCurve = (i - 3) * (i - 3) * 0.00016 * smile;
            bar.position.y = THREE.MathUtils.lerp(bar.position.y, smileCurve, 0.3);
            bar.position.x = (i - 3) * 0.00105 * (1.0 - pucker * 0.35);
          });
        }

        // 4. Synchronized Morph Targets: Surprised morph target opens the robot mouth!
        const targetSurprised = activeMouthOpen;
        const targetSad = cur.mouthSmile < -0.15 ? Math.min(1, (-cur.mouthSmile - 0.15) * 1.8) : 0;
        const targetAngry = Math.min(1, Math.max(0, cur.browFurrow * 1.2));

        faceMeshesRef.current.forEach((face) => {
          const dict = face.morphTargetDictionary;
          const influences = face.morphTargetInfluences;
          if (!dict || !influences) return;

          const angryIdx = dict['Angry'];
          if (angryIdx !== undefined) {
            influences[angryIdx] = THREE.MathUtils.lerp(influences[angryIdx], targetAngry, 0.25);
          }
          const surprisedIdx = dict['Surprised'];
          if (surprisedIdx !== undefined) {
            influences[surprisedIdx] = THREE.MathUtils.lerp(influences[surprisedIdx], targetSurprised, 0.35);
          }
          const sadIdx = dict['Sad'];
          if (sadIdx !== undefined) {
            influences[sadIdx] = THREE.MathUtils.lerp(influences[sadIdx], targetSad, 0.25);
          }
        });
      }

      // ========================================================
      // B. UPDATE PROCEDURAL 3D CHARACTERS (Cat, Dog, Female, Horse, etc.)
      // ========================================================
      const controller = characterControllerRef.current;
      if (controller) {
        // Pass the silky-smooth tracking state to character controller
        const smoothFeat: FaceFeatures = {
          ...feat,
          yaw: cur.yaw / 0.85,
          pitch: -cur.pitch / 0.75, // Standard pitch convention (positive = looking up)
          roll: cur.roll / 0.75,
          jawOpen: cur.jawOpen,
          mouthSmile: cur.mouthSmile,
          mouthPucker: cur.mouthPucker,
          browRaise: cur.browRaise,
          browFurrow: cur.browFurrow,
          eyeBlinkLeft: cur.eyeBlinkLeft,
          eyeBlinkRight: cur.eyeBlinkRight,
          gazeX: cur.gazeX,
          gazeY: cur.gazeY,
        };

        controller.update(smoothFeat, dt, now);

        // Procedural Emote Motion
        const em = emoteTriggerRef.current;
        if (em) {
          const elapsed = (now - em.start) / 1000;
          if (em.name === 'Dance') {
            controller.group.position.x = Math.sin(elapsed * 8) * 0.25;
            controller.group.rotation.y = Math.sin(elapsed * 6) * 0.3;
          } else if (em.name === 'Jump') {
            controller.group.position.y = Math.max(0, Math.sin(elapsed * 6) * 0.45);
          } else if (em.name === 'Wave') {
            controller.headPivot.rotation.z += Math.sin(elapsed * 10) * 0.15;
          } else if (em.name === 'ThumbsUp') {
            controller.group.position.y = Math.sin(elapsed * 5) * 0.12;
          }
        } else {
          controller.group.position.set(0, 0, 0);
          controller.group.rotation.set(0, 0, 0);
        }
      }

      renderer.render(scene, camera);
    };

    render();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      if (characterControllerRef.current) {
        characterControllerRef.current.dispose();
      }
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [avatarId]);

  return (
    <div
      ref={mountRef}
      style={{ width: 320, height: 320 }}
      className={`relative w-[320px] h-[320px] shrink-0 flex items-center justify-center overflow-hidden select-none bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-xl ${className}`}
    >
      {/* 3D Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-xs z-10">
          <div className="w-9 h-9 rounded-full border-3 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <span className="text-xs font-semibold text-cyan-300">
            Cargando Three.js 3D Mesh...
          </span>
        </div>
      )}

      {/* Error State */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-rose-400 text-xs text-center px-4 z-10">
          {loadError}
        </div>
      )}

      {/* Quick 3D Emotes Bar */}
      {showEmoteControls && !isLoading && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
          <button
            type="button"
            onClick={() => playEmote('Wave')}
            title="Saludar (Wave)"
            className={`p-1.5 rounded-lg border text-xs font-medium transition backdrop-blur-md flex items-center gap-1 ${
              currentEmote === 'Wave'
                ? 'bg-cyan-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/30'
                : 'bg-slate-900/80 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => playEmote('ThumbsUp')}
            title="Aprobar (Thumbs Up)"
            className={`p-1.5 rounded-lg border text-xs font-medium transition backdrop-blur-md flex items-center gap-1 ${
              currentEmote === 'ThumbsUp'
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/30'
                : 'bg-slate-900/80 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => playEmote('Dance')}
            title="Bailar (Dance)"
            className={`p-1.5 rounded-lg border text-xs font-medium transition backdrop-blur-md flex items-center gap-1 ${
              currentEmote === 'Dance'
                ? 'bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/30'
                : 'bg-slate-900/80 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => playEmote('Jump')}
            title="Saltar (Jump)"
            className={`p-1.5 rounded-lg border text-xs font-medium transition backdrop-blur-md flex items-center gap-1 ${
              currentEmote === 'Jump'
                ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/30'
                : 'bg-slate-900/80 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* User Name Badge & Speaking Indicator */}
      {userName && (
        <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-semibold text-slate-100 flex items-center gap-1.5 border border-slate-700/60 shadow-lg z-20 pointer-events-none">
          <span
            className={`w-2 h-2 rounded-full ${
              isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
            }`}
          />
          <span className="truncate max-w-[120px]">{userName}</span>
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
            3D WEBGL
          </span>
        </div>
      )}
    </div>
  );
};
