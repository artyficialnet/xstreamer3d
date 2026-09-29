import React, { useState, useRef, useEffect } from 'react';
import {
  ScanFace,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  X,
  Activity,
  Layers,
  Sparkles,
  Zap,
  Radio,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { FaceFeatures } from '../../types';

interface FaceTrackingVisionModuleProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  features: FaceFeatures;
  landmarks: Array<{ x: number; y: number; z: number }> | null;
  isOpen: boolean;
  onClose: () => void;
  isCameraActive: boolean;
}

/**
 * Complete Landmark Indices for MediaPipe Face Mesh
 * Specially enriched for 40-point mouth articulation and lime-green contours as in reference vision module
 */
export const VISION_CONTOURS = {
  // Face oval / Jawline loop
  faceOval: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
    400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
    54, 103, 67, 109, 10
  ],
  // Eyebrows
  leftEyebrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  rightEyebrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  // Eyes
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33],
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362],
  leftPupil: 468,
  rightPupil: 473,
  // Nose
  noseRidge: [168, 6, 197, 195, 5, 4, 1],
  noseBase: [98, 97, 2, 326, 327],
  // ========================================================
  // 40 MOUTH & LIPS CAPTURE POINTS (Outer, Inner, Corners)
  // ========================================================
  outerLips: [
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
    375, 321, 405, 314, 17, 84, 181, 91, 146, 61
  ],
  innerLips: [
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,
    324, 318, 402, 317, 14, 87, 178, 88, 95, 78
  ],
  mouthAnchorPoints: [
    61, 291, 0, 17, 13, 14, 82, 87, 312, 317, 78, 308,
    37, 84, 267, 314, 185, 409, 164, 18
  ],
};

export const FaceTrackingVisionModule: React.FC<FaceTrackingVisionModuleProps> = ({
  videoRef,
  features,
  landmarks,
  isOpen,
  onClose,
  isCameraActive,
}) => {
  const [showMeshLines, setShowMeshLines] = useState(true);
  const [showLandmarkDots, setShowLandmarkDots] = useState(true);
  const [highlightMouthPoints, setHighlightMouthPoints] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lineColor, setLineColor] = useState<'lime' | 'cyan' | 'neon'>('lime');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render loop drawing lime-green mesh overlay matching reference image
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const drawFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!landmarks || !isCameraActive) {
        animId = requestAnimationFrame(drawFrame);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;

      // Coordinate converter (with optional mirror flip)
      const getPt = (index: number) => {
        const pt = landmarks[index];
        if (!pt) return null;
        return {
          x: isMirrored ? (1 - pt.x) * w : pt.x * w,
          y: pt.y * h,
          z: pt.z,
        };
      };

      // Vibrant Lime Green palette (exact visual match to screenshot)
      const strokeColor =
        lineColor === 'lime'
          ? 'rgba(132, 235, 30, 0.95)' // Exact bright lime green from reference
          : lineColor === 'cyan'
          ? 'rgba(6, 182, 212, 0.95)'
          : 'rgba(57, 255, 20, 0.95)';

      const mouthStrokeColor =
        highlightMouthPoints
          ? 'rgba(163, 230, 53, 1.0)' // Extra bright neon lime for mouth
          : strokeColor;

      // Draw Path helper
      const drawPath = (indices: number[], color: string, lineWidth = 1.8, isClosed = false) => {
        if (!showMeshLines) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        let started = false;
        for (const idx of indices) {
          const pt = getPt(idx);
          if (!pt) continue;
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
        if (isClosed && started) {
          ctx.closePath();
        }
        ctx.stroke();
      };

      // Draw single dot helper
      const drawDot = (p: { x: number; y: number } | null, color: string, radius = 2.0, glow?: string) => {
        if (!p) return;
        if (glow) {
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius + 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      };

      // ========================================================
      // 1. FACIAL CONTOURS (Exact match to user's photo)
      // ========================================================

      // A. Jawline / Face Oval Outline
      drawPath(VISION_CONTOURS.faceOval, strokeColor, 2.0, true);

      // B. Eyebrows
      drawPath(VISION_CONTOURS.leftEyebrow, strokeColor, 2.0);
      drawPath(VISION_CONTOURS.rightEyebrow, strokeColor, 2.0);

      // C. Eyes
      drawPath(VISION_CONTOURS.leftEye, strokeColor, 1.8, true);
      drawPath(VISION_CONTOURS.rightEye, strokeColor, 1.8, true);

      // D. Pupils & Irises Reticle
      const pupilL = getPt(VISION_CONTOURS.leftPupil);
      const pupilR = getPt(VISION_CONTOURS.rightPupil);
      drawDot(pupilL, '#ffffff', 2.5, 'rgba(132, 235, 30, 0.6)');
      drawDot(pupilR, '#ffffff', 2.5, 'rgba(132, 235, 30, 0.6)');

      // E. Nose Bridge & Nose Base Wings
      drawPath(VISION_CONTOURS.noseRidge, strokeColor, 2.0);
      drawPath(VISION_CONTOURS.noseBase, strokeColor, 2.0);

      // F. Complete Outer & Inner Lips Wireframe (40 Points)
      drawPath(VISION_CONTOURS.outerLips, mouthStrokeColor, 2.2, true);
      drawPath(VISION_CONTOURS.innerLips, mouthStrokeColor, 1.8, true);

      // ========================================================
      // 2. LANDMARK DOTS & MOUTH POINTS HIGHLIGHT
      // ========================================================
      if (showLandmarkDots) {
        // Face oval dots
        VISION_CONTOURS.faceOval.forEach((idx) => {
          drawDot(getPt(idx), '#a3e635', 1.6);
        });

        // Eyebrows dots
        [...VISION_CONTOURS.leftEyebrow, ...VISION_CONTOURS.rightEyebrow].forEach((idx) => {
          drawDot(getPt(idx), '#bef264', 1.8);
        });

        // Eye contour dots
        [...VISION_CONTOURS.leftEye, ...VISION_CONTOURS.rightEye].forEach((idx) => {
          drawDot(getPt(idx), '#d9f99d', 1.6);
        });

        // Nose dots
        [...VISION_CONTOURS.noseRidge, ...VISION_CONTOURS.noseBase].forEach((idx) => {
          drawDot(getPt(idx), '#84cc16', 1.8);
        });

        // 40 Mouth Points (Distinguished Coral/Lime Glow)
        if (highlightMouthPoints) {
          [...VISION_CONTOURS.outerLips, ...VISION_CONTOURS.innerLips].forEach((idx) => {
            drawDot(getPt(idx), '#ffffff', 2.2, 'rgba(234, 88, 12, 0.7)');
          });
          VISION_CONTOURS.mouthAnchorPoints.forEach((idx) => {
            drawDot(getPt(idx), '#f97316', 2.8, 'rgba(255, 255, 255, 0.5)');
          });
        }
      }

      // ========================================================
      // 3. EXPRESSION DYNAMICS HUD OVERLAYS
      // ========================================================
      const jOpen = features.jawOpen || 0;
      const smile = features.mouthSmile || 0;
      const pucker = features.mouthPucker || 0;

      // Draw real-time mouth opening vector
      const topLip = getPt(13);
      const bottomLip = getPt(14);
      if (topLip && bottomLip && jOpen > 0.05) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(topLip.x, topLip.y);
        ctx.lineTo(bottomLip.x, bottomLip.y);
        ctx.stroke();
      }

      animId = requestAnimationFrame(drawFrame);
    };

    animId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, landmarks, showMeshLines, showLandmarkDots, highlightMouthPoints, isMirrored, lineColor, features]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 flex flex-col ${
        isFullscreen
          ? 'inset-0 bg-slate-950/95 backdrop-blur-xl'
          : 'bottom-6 right-6 w-96 md:w-[480px] max-h-[90vh] rounded-3xl bg-slate-950/90 backdrop-blur-2xl border-2 border-lime-500/50 shadow-2xl shadow-lime-950/40 overflow-hidden'
      }`}
    >
      {/* Header bar */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-lime-800/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-lime-500/20 border border-lime-400/50 flex items-center justify-center">
            <ScanFace className="w-4 h-4 text-lime-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black tracking-wider text-lime-300 uppercase">
                Módulo de Tracking Facial
              </h2>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-lime-950 text-lime-400 border border-lime-600">
                LIVE AI
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Captura 478 puntos | 40 puntos en boca | Sincronía 1:1
            </p>
          </div>
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Restaurar tamaño' : 'Maximizar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            title="Cerrar módulo"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col p-4 overflow-y-auto space-y-4">
        {/* Real-time Camera with Lime Green Wireframe Mesh */}
        <div className="relative rounded-2xl bg-black overflow-hidden border border-slate-800 shadow-inner aspect-[4/3] flex items-center justify-center">
          {/* Underlying video element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isMirrored ? '-scale-x-100' : ''}`}
          />

          {/* Interactive Lime Green Vector Contours Canvas */}
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Live Telemetry Pill Overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-lime-500/40 text-[10px] font-mono text-lime-300">
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping" />
            <span className="font-bold">60 FPS</span>
            <span className="text-slate-500">|</span>
            <span>{features.latencyMs || 12} ms lag</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-bold">1:1 Sync</span>
          </div>

          {/* Points Counter Badge */}
          <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700 text-[10px] font-mono text-slate-300">
            <span className="text-lime-400 font-bold">478</span> puntos faciales •{' '}
            <span className="text-orange-400 font-bold">40</span> puntos boca
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setShowMeshLines(!showMeshLines)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              showMeshLines
                ? 'bg-lime-950/60 border-lime-500 text-lime-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Malla Verde</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLandmarkDots(!showLandmarkDots)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              showLandmarkDots
                ? 'bg-lime-950/60 border-lime-500 text-lime-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Puntos</span>
          </button>

          <button
            type="button"
            onClick={() => setHighlightMouthPoints(!highlightMouthPoints)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              highlightMouthPoints
                ? 'bg-orange-950/60 border-orange-500 text-orange-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Destaca los 40 puntos de captura en labios y boca"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>40 Puntos Boca</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMirrored(!isMirrored)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              isMirrored
                ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isMirrored ? 'Espejo: ON' : 'Espejo: OFF'}</span>
          </button>
        </div>

        {/* Real-time Facial Expression Telemetry Bars */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-lime-400" />
              Métricas de Expresiones Capturadas
            </span>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Sincronizado
            </span>
          </div>

          <div className="space-y-2 text-[11px]">
            {/* Jaw Open */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Apertura de Boca (40 puntos):</span>
                <span className="font-mono font-bold text-lime-400">
                  {Math.round((features.jawOpen || 0) * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-lime-500 to-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.round((features.jawOpen || 0) * 100))}%` }}
                />
              </div>
            </div>

            {/* Smile */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Sonrisa (Comisuras L / R):</span>
                <span className="font-mono font-bold text-amber-400">
                  {Math.round((features.mouthSmile || 0) * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-75"
                  style={{ width: `${Math.max(0, Math.min(100, Math.round((features.mouthSmile || 0) * 100)))}%` }}
                />
              </div>
            </div>

            {/* Eye Blinks */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between mb-1 text-[10px]">
                  <span className="text-slate-400">Ojo Izquierdo:</span>
                  <span className="font-mono text-cyan-300">
                    {(features.eyeBlinkLeft || 0) > 0.5 ? 'CERRADO' : 'ABIERTO'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-75"
                    style={{ width: `${Math.round((features.eyeBlinkLeft || 0) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1 text-[10px]">
                  <span className="text-slate-400">Ojo Derecho:</span>
                  <span className="font-mono text-cyan-300">
                    {(features.eyeBlinkRight || 0) > 0.5 ? 'CERRADO' : 'ABIERTO'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-75"
                    style={{ width: `${Math.round((features.eyeBlinkRight || 0) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Orientation */}
            <div className="pt-2 flex items-center justify-between font-mono text-[10px] text-slate-400 border-t border-slate-800">
              <span>
                Pitch:{' '}
                <strong className="text-slate-200">
                  {((features.pitch || 0) * 45).toFixed(1)}°
                </strong>
              </span>
              <span>
                Yaw:{' '}
                <strong className="text-slate-200">
                  {((features.yaw || 0) * 45).toFixed(1)}°
                </strong>
              </span>
              <span>
                Roll:{' '}
                <strong className="text-slate-200">
                  {((features.roll || 0) * 45).toFixed(1)}°
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
