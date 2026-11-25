import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { buildPrintStudioScene, type PrintFinishMode, type StudioRig } from './models';
import { createDeskGridTexture } from './textures';

export type CameraPreset = 'overview' | 'printer' | 'document' | 'mascot';

interface CameraTarget {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

const CAMERA_PRESETS: Record<CameraPreset, CameraTarget> = {
  overview: {
    pos: new THREE.Vector3(0.2, 3.25, 6.7),
    look: new THREE.Vector3(0, 0.55, 0.25),
  },
  printer: {
    pos: new THREE.Vector3(1.65, 2.25, 3.65),
    look: new THREE.Vector3(0, 0.85, 0.25),
  },
  document: {
    pos: new THREE.Vector3(-2.15, 1.85, 3.15),
    look: new THREE.Vector3(-2.55, 0.35, 0.55),
  },
  mascot: {
    pos: new THREE.Vector3(3.15, 1.75, 2.95),
    look: new THREE.Vector3(2.45, 0.72, 0.6),
  },
};

const _scratchVec = new THREE.Vector3();
const _rayMouse = new THREE.Vector2();

export interface PrintStudioCanvasProps {
  finishMode: PrintFinishMode;
  onFinishModeChange: (mode: PrintFinishMode) => void;
  paused?: boolean;
  isDark: boolean;
  onQuickOrder?: (mode: PrintFinishMode) => void;
}

export const PrintStudioCanvas: React.FC<PrintStudioCanvasProps> = ({
  finishMode,
  onFinishModeChange,
  paused = false,
  isDark,
  onQuickOrder,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [preset, setPreset] = useState<CameraPreset>('overview');
  const [exploded, setExploded] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [cinemaMode, setCinemaMode] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<boolean>(false);

  // Refs for stable render loop without tearing down WebGL on React state updates
  const finishRef = useRef<PrintFinishMode>(finishMode);
  const presetRef = useRef<CameraPreset>(preset);
  const explodedTargetRef = useRef<number>(exploded);
  const explodedCurrentRef = useRef<number>(0);
  const animatingRef = useRef<boolean>(isAnimating);
  const pausedRef = useRef<boolean>(paused);
  const isDarkRef = useRef<boolean>(isDark);
  const cameraTransitioningRef = useRef<boolean>(false);

  const rigRef = useRef<StudioRig | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const floorMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const darkFloorTexRef = useRef<THREE.CanvasTexture | null>(null);
  const lightFloorTexRef = useRef<THREE.CanvasTexture | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    finishRef.current = finishMode;
    rigRef.current?.applyFinish(finishMode);
    requestRenderRef.current?.();
  }, [finishMode]);

  useEffect(() => {
    presetRef.current = preset;
    cameraTransitioningRef.current = true;
    requestRenderRef.current?.();
  }, [preset]);

  useEffect(() => {
    explodedTargetRef.current = exploded;
    requestRenderRef.current?.();
  }, [exploded]);

  useEffect(() => {
    animatingRef.current = isAnimating;
    requestRenderRef.current?.();
  }, [isAnimating]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) {
      requestRenderRef.current?.();
    }
  }, [paused]);

  useEffect(() => {
    isDarkRef.current = isDark;
    const scene = sceneRef.current;
    const floorMat = floorMatRef.current;
    if (scene) {
      const bgHex = isDark ? 0x0b1220 : 0x0f172a;
      scene.background = new THREE.Color(bgHex);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.setHex(bgHex);
      }
    }
    if (floorMat && darkFloorTexRef.current && lightFloorTexRef.current) {
      floorMat.map = isDark ? darkFloorTexRef.current : darkFloorTexRef.current;
      floorMat.needsUpdate = true;
    }
    requestRenderRef.current?.();
  }, [isDark]);

  // Mount WebGL scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 440;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    const onContextRestored = () => {
      requestRenderRef.current?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const bgHex = 0x0f172a;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.042);
    sceneRef.current = scene;

    // Mandatory Studio Environment Map via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
    camera.position.copy(CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(CAMERA_PRESETS.overview.look);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.2;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minPolarAngle = 0.22;
    controls.enablePan = false;
    controls.update();

    controls.addEventListener('start', () => {
      cameraTransitioningRef.current = false;
    });

    // Warm/Cool Studio 3-Point Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    keyLight.position.set(4.5, 7.5, 5.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -5.5;
    keyLight.shadow.camera.right = 5.5;
    keyLight.shadow.camera.top = 5.5;
    keyLight.shadow.camera.bottom = -5.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(-5.0, 4.0, -4.5);
    scene.add(rimLight);

    // Studio floor desk mat (offset Y = -0.02 below contact shadow planes at 0.015)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const darkTex = createDeskGridTexture(maxAniso, true);
    const lightTex = createDeskGridTexture(maxAniso, false);
    darkFloorTexRef.current = darkTex;
    lightFloorTexRef.current = lightTex;

    const floorGeo = new THREE.CircleGeometry(14, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: darkTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    floorMatRef.current = floorMat;
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.02;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const rig = buildPrintStudioScene(maxAniso, isSoftwareGl);
    rig.applyFinish(finishRef.current);
    scene.add(rig.root);
    rigRef.current = rig;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycaster for clicking hero subjects
    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      _rayMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_rayMouse, camera);
      const hits = raycaster.intersectObjects(rig.interactables, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.subjectId) {
          obj = obj.parent;
        }
        const sid = obj?.userData.subjectId as CameraPreset | undefined;
        if (sid && CAMERA_PRESETS[sid]) {
          setPreset(sid);
          setSelectedSubject(sid);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    let frameId = 0;
    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;
    const startTimeMs = performance.now();
    let lastTimeMs = startTimeMs;
    const getTimings = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTimeMs) / 1000, 0.05);
      lastTimeMs = now;
      return { dt, elapsed: (now - startTimeMs) / 1000 };
    };

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const updateScenePhysics = (dt: number, elapsed: number) => {
      // Exponential camera preset damping
      if (cameraTransitioningRef.current) {
        const target = CAMERA_PRESETS[presetRef.current];
        const alpha = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(target.pos, alpha);
        controls.target.lerp(target.look, alpha);
        if (
          camera.position.distanceTo(target.pos) < 0.02 &&
          controls.target.distanceTo(target.look) < 0.02
        ) {
          camera.position.copy(target.pos);
          controls.target.copy(target.look);
          cameraTransitioningRef.current = false;
        }
      }

      // Smooth exploded-view damping
      if (Math.abs(explodedCurrentRef.current - explodedTargetRef.current) > 0.002) {
        explodedCurrentRef.current = THREE.MathUtils.damp(
          explodedCurrentRef.current,
          explodedTargetRef.current,
          7,
          dt,
        );
        rig.setExploded(explodedCurrentRef.current);
      }

      // Continuous studio motion when active
      if (animatingRef.current) {
        // Exiting printed sheet cycle
        const cycle = (elapsed * 0.45) % 1;
        rig.exitingSheet.position.z = 0.72 + cycle * 0.56;
        rig.exitingSheet.position.y = 0.91 - cycle * 0.08;

        // Gentle cat mascot head look & tail sway
        rig.mascotHead.rotation.y = Math.sin(elapsed * 1.1) * 0.16;
        rig.mascotHead.rotation.z = Math.sin(elapsed * 0.7) * 0.04;
        rig.mascotTail.rotation.y = Math.sin(elapsed * 2.2) * 0.14;

        // Floating workflow cards gentle bob
        rig.floatingCards.children.forEach((card) => {
          const baseY = (card.userData.baseY as number) ?? 2.0;
          const phase = (card.userData.phase as number) ?? 0;
          card.position.y = baseY + Math.sin(elapsed * 1.4 + phase) * 0.09;
        });

        // Subtle turntable idle sway on whole root
        _scratchVec.set(0, Math.sin(elapsed * 0.25) * 0.06, 0);
        rig.root.rotation.y = _scratchVec.y;
      }

      controls.update();
    };

    const requestRender = () => {
      if (disposed || pausedRef.current) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const { dt, elapsed } = getTimings();
        updateScenePhysics(dt, elapsed);
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (!disposed && (renderDirty || animatingRef.current || cameraTransitioningRef.current)) {
            if (animatingRef.current || cameraTransitioningRef.current) {
              scheduleLoop();
            } else {
              requestRender();
            }
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };
    requestRenderRef.current = requestRender;

    const scheduleLoop = () => {
      if (disposed || pausedRef.current) return;
      if (!animatingRef.current && !cameraTransitioningRef.current) {
        return;
      }
      if (isSoftwareGl) {
        // Software-WebGL paced loop: render one frame then wait via afterDraw
        frameId = requestAnimationFrame(() => {
          if (disposed || pausedRef.current) return;
          const { dt, elapsed } = getTimings();
          updateScenePhysics(dt, elapsed);
          renderer.render(scene, camera);
          afterDraw(scheduleLoop);
        });
      } else {
        frameId = requestAnimationFrame(() => {
          if (disposed || pausedRef.current) return;
          const { dt, elapsed } = getTimings();
          updateScenePhysics(dt, elapsed);
          renderer.render(scene, camera);
          scheduleLoop();
        });
      }
    };

    controls.addEventListener('change', () => {
      if (!animatingRef.current) {
        requestRender();
      }
    });

    // Initial render + start loop
    scheduleLoop();

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 440;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      rig.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      darkTex.dispose();
      lightTex.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Re-trigger resize when toggling cinemaMode
  useEffect(() => {
    const t = window.setTimeout(() => {
      requestRenderRef.current?.();
    }, 60);
    return () => window.clearTimeout(t);
  }, [cinemaMode]);

  const subjectLabels: Record<string, { title: string; subtitle: string }> = {
    printer: {
      title: 'Stasiun Laser Print Kampus',
      subtitle: 'Kecepatan cetak hingga 45 ppm · Dupleks otomatis · Toner CMYK presisi',
    },
    document: {
      title: 'Tumpukan Dokumen & Jilid',
      subtitle: 'Pilihan A4, F4, A3 · HVS 70-100gr · Spiral Kawat & Hardcover Emas',
    },
    mascot: {
      title: 'Maskot Kampus PrintKampus',
      subtitle: 'Siap mengantar tugas, modul praktikum, hingga skripsi tepat waktu',
    },
  };

  return (
    <div
      className={
        cinemaMode
          ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col'
          : 'relative w-full h-[400px] sm:h-[440px] lg:h-[480px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950'
      }
      data-testid="print-studio-3d-wrapper"
    >
      {/* Dedicated isolated WebGL mount ref */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        data-testid="print-studio-canvas-container"
        aria-label="Visualisasi 3D Studio Cetak PrintKampus"
      />

      {webglError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-200 p-6 text-center">
          <p className="text-base font-semibold">Studio 3D PrintKampus</p>
          <p className="text-sm text-slate-400 mt-1">
            Peramban tidak mendukung konteks WebGL. Anda tetap dapat memesan cetak melalui tombol di bawah.
          </p>
        </div>
      )}

      {/* Top-left minimal spec overlay (solid rgba surface, zero backdrop-blur) */}
      <div className="pointer-events-none absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 flex items-start justify-between gap-2 sm:gap-4">
        <div className="pointer-events-auto rounded-xl bg-slate-900/92 border border-indigo-500/30 px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 text-slate-100 max-w-[205px] sm:max-w-sm">
          <p className="hidden sm:block text-xs font-medium text-indigo-400">
            Studio 3D Interaktif · Seret untuk Putar
          </p>
          <p className="text-xs sm:text-sm font-semibold text-white truncate">
            {selectedSubject && subjectLabels[selectedSubject]
              ? subjectLabels[selectedSubject].title
              : 'PRINT KAMPUS'}
          </p>
          <p className="hidden sm:block text-xs text-slate-300 mt-0.5 leading-snug">
            {selectedSubject && subjectLabels[selectedSubject]
              ? subjectLabels[selectedSubject].subtitle
              : 'Klik printer, dokumen, atau maskot untuk fokus kamera.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCinemaMode((v) => !v)}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-slate-900/92 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          aria-label={cinemaMode ? 'Keluar Mode Layar Penuh 3D' : 'Buka Mode Layar Penuh 3D'}
        >
          {cinemaMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span className="sm:hidden">{cinemaMode ? 'Tutup' : 'Penuh'}</span>
          <span className="hidden sm:inline">{cinemaMode ? 'Tutup Layar Penuh' : 'Inspeksi Penuh'}</span>
        </button>
      </div>

      {/* Collapsible Bottom Control Dock (zero backdrop-blur, compact, responsive) */}
      <div className="pointer-events-none absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.25rem)] max-w-[820px] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-t-lg bg-slate-900/95 border border-b-0 border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Tampilkan Kontrol 3D</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Sembunyikan Kontrol</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full rounded-xl bg-slate-900/95 border border-slate-700 px-2.5 py-2 sm:px-3.5 sm:py-2.5 shadow-xl flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            {/* Camera presets */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-800/90 p-1 rounded-lg max-w-full">
              {(
                [
                  ['overview', 'Studio'],
                  ['printer', 'Printer'],
                  ['document', 'Dokumen'],
                  ['mascot', 'Maskot'],
                ] as [CameraPreset, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setPreset(key);
                    setSelectedSubject(key === 'overview' ? null : key);
                  }}
                  className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    preset === key
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Print Finish selector */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-800/90 p-1 rounded-lg max-w-full">
              {(
                [
                  ['bw', 'B/W'],
                  ['color', 'CLR'],
                  ['spiral', 'Spiral'],
                  ['hardcover', 'Hardcover'],
                ] as [PrintFinishMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onFinishModeChange(mode)}
                  className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    finishMode === mode
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Exploded View + Play/Reset + Quick Order */}
            <div className="flex flex-wrap items-center gap-2 max-w-full">
              <label className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-300 whitespace-nowrap">
                <span>Bedah</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={exploded}
                  onChange={(e) => setExploded(Number.parseFloat(e.target.value))}
                  aria-label="Eksplosi Komponen 3D"
                  className="w-14 sm:w-20 accent-indigo-500 cursor-pointer"
                />
              </label>

              <button
                type="button"
                onClick={() => setIsAnimating((a) => !a)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                aria-label={isAnimating ? 'Jeda Animasi 3D' : 'Putar Animasi 3D'}
                title={isAnimating ? 'Jeda Animasi' : 'Putar Animasi'}
              >
                {isAnimating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreset('overview');
                  setExploded(0);
                  setSelectedSubject(null);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                aria-label="Reset Kamera 3D"
                title="Reset Tampilan"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {onQuickOrder && (
                <button
                  type="button"
                  onClick={() => onQuickOrder(finishMode)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cetak Preset Ini
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
