import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronUp, ScanFace } from 'lucide-react';
import { FaceFeatures } from '../../types';

interface CameraPreviewPipProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  features: FaceFeatures;
  landmarks: Array<{ x: number; y: number; z: number }> | null;
  isCameraActive: boolean;
}

/**
 * Full Expressive Face Landmark Points & Contours
 * Captures and visualizes complete facial structure and expressions:
 * 1. Face Oval / Jawline
 * 2. Eyebrows (inner, arch, outer)
 * 3. Eyes & Pupil Gaze
 * 4. Nose Bridge & Base
 * 5. Outer & Inner Lips with Speech Aperture & Smile Dynamics
 */
const FACE_CONTOURS = {
  // Face oval loop (36 points)
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
  leftIris: [468, 469, 470, 471, 472],
  rightIris: [473, 474, 475, 476, 477],
  // Nose
  noseRidge: [168, 6, 197, 195, 5, 4, 1],
  noseBase: [98, 97, 2, 326, 327],
  // Lips
  outerLips: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 61],
  innerLips: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78],
};

export const CameraPreviewPip: React.FC<CameraPreviewPipProps> = ({
  videoRef,
  features,
  landmarks,
  isCameraActive,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMesh, setShowMesh] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !landmarks || !showMesh || !isCameraActive) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Helper to get mirrored coordinate
    const getPoint = (index: number) => {
      const pt = landmarks[index];
      if (!pt) return null;
      return {
        x: (1 - pt.x) * w,
        y: pt.y * h,
      };
    };

    // Draw connected path of points
    const drawPath = (indices: number[], color: string, lineWidth = 1, isClosed = false) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let hasStarted = false;
      for (const idx of indices) {
        const pt = getPoint(idx);
        if (!pt) continue;
        if (!hasStarted) {
          ctx.moveTo(pt.x, pt.y);
          hasStarted = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
      if (isClosed && hasStarted) {
        ctx.closePath();
      }
      ctx.stroke();
    };

    // Draw single indicator dot
    const drawDot = (p: { x: number; y: number } | null, color: string, radius = 2.0, haloColor?: string) => {
      if (!p) return;
      if (haloColor) {
        ctx.fillStyle = haloColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    // ==========================================
    // 1. FULL FACIAL OUTLINE & CONTOURS
    // ==========================================

    // Vibrant Lime Green (exact match to user reference screenshot)
    const limeColor = 'rgba(132, 235, 30, 0.95)';
    const limeMouth = 'rgba(163, 230, 53, 1.0)';

    // Face oval outline
    drawPath(FACE_CONTOURS.faceOval, limeColor, 1.6, true);

    // Eyebrows
    drawPath(FACE_CONTOURS.leftEyebrow, limeColor, 1.8);
    drawPath(FACE_CONTOURS.rightEyebrow, limeColor, 1.8);

    // Eye contours
    drawPath(FACE_CONTOURS.leftEye, limeColor, 1.6, true);
    drawPath(FACE_CONTOURS.rightEye, limeColor, 1.6, true);

    // Nose bridge & base
    drawPath(FACE_CONTOURS.noseRidge, limeColor, 1.8);
    drawPath(FACE_CONTOURS.noseBase, limeColor, 1.8);

    // Outer & Inner Lips (40 capture points)
    drawPath(FACE_CONTOURS.outerLips, limeMouth, 2.0, true);
    drawPath(FACE_CONTOURS.innerLips, limeMouth, 1.6, true);

    // ==========================================
    // 2. EXPANDED FACIAL LANDMARK DOTS
    // ==========================================

    // Face Oval dots (Emerald)
    FACE_CONTOURS.faceOval.forEach((idx) => {
      drawDot(getPoint(idx), '#10b981', 1.4);
    });

    // Eyebrow dots (Purple)
    [...FACE_CONTOURS.leftEyebrow, ...FACE_CONTOURS.rightEyebrow].forEach((idx) => {
      drawDot(getPoint(idx), '#c084fc', 1.6);
    });

    // Eye contour dots (Sky Blue)
    [...FACE_CONTOURS.leftEye, ...FACE_CONTOURS.rightEye].forEach((idx) => {
      drawDot(getPoint(idx), '#38bdf8', 1.5);
    });

    // Pupil Gaze Dots (Electric Cyan with glowing halo)
    const pPupilL = getPoint(FACE_CONTOURS.leftPupil);
    const pPupilR = getPoint(FACE_CONTOURS.rightPupil);
    drawDot(pPupilL, '#22d3ee', 2.8, 'rgba(34, 211, 238, 0.4)');
    drawDot(pPupilR, '#22d3ee', 2.8, 'rgba(34, 211, 238, 0.4)');

    // Nose dots (Teal/Cyan)
    [...FACE_CONTOURS.noseRidge, ...FACE_CONTOURS.noseBase].forEach((idx) => {
      drawDot(getPoint(idx), '#06b6d4', 1.6);
    });

    // Lips dots (Rose/Coral)
    [...FACE_CONTOURS.outerLips, ...FACE_CONTOURS.innerLips].forEach((idx) => {
      drawDot(getPoint(idx), '#fb7185', 1.8);
    });

    // Nose tip anchor (prominent dot)
    drawDot(getPoint(1), '#10b981', 3.0, 'rgba(16, 185, 129, 0.4)');

    // ==========================================
    // 3. REAL-TIME EXPRESSION VECTORS & GAUGES
    // ==========================================
    // Mouth corners smile vectors
    const cornerL = getPoint(61);
    const cornerR = getPoint(291);
    const smile = features.mouthSmile || 0;
    if (cornerL && cornerR && Math.abs(smile) > 0.1) {
      ctx.strokeStyle = smile > 0 ? '#34d399' : '#f87171';
      ctx.lineWidth = 1.5;
      // Left corner smile vector
      ctx.beginPath();
      ctx.moveTo(cornerL.x, cornerL.y);
      ctx.lineTo(cornerL.x - 6, cornerL.y - smile * 8);
      ctx.stroke();
      // Right corner smile vector
      ctx.beginPath();
      ctx.moveTo(cornerR.x, cornerR.y);
      ctx.lineTo(cornerR.x + 6, cornerR.y - smile * 8);
      ctx.stroke();
    }

  }, [landmarks, showMesh, isCameraActive]);

  if (!isCameraActive) return null;

  return (
    <div className="fixed bottom-24 left-4 z-30 transition-all duration-300">
      <div className="rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Header bar */}
        <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
            <ScanFace className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tracking Óptimo</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMesh(!showMesh)}
              title={showMesh ? 'Ocultar indicadores clave' : 'Mostrar indicadores clave'}
              className={`p-1 rounded text-xs transition ${
                showMesh ? 'text-cyan-400 bg-cyan-950/60' : 'text-slate-400 hover:text-white'
              }`}
            >
              {showMesh ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expandir visor' : 'Minimizar visor'}
              className="p-1 rounded text-slate-400 hover:text-white transition"
            >
              {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Video & 30-Dots Mesh view */}
        {!isCollapsed && (
          <div className="p-2 space-y-2">
            <div className="relative w-44 h-32 rounded-xl bg-slate-950 overflow-hidden border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              <canvas
                ref={canvasRef}
                width={176}
                height={128}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {/* 30 Essential points badge */}
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/85 backdrop-blur-sm text-[9px] font-mono flex items-center gap-1 text-slate-300 border border-slate-800">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    features.isFaceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                <span>{features.isFaceDetected ? '30 Puntos Clave' : 'Sin rostro'}</span>
              </div>
            </div>

            {/* Essential Metrics */}
            <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-center text-slate-400 px-0.5">
              <div className="bg-slate-950/60 rounded p-1 border border-slate-800" title="Postura & Orientación">
                <div className="text-emerald-400 font-medium">Postura</div>
                <div className="text-slate-200 font-bold">{Math.round(features.yaw * 30)}°</div>
              </div>
              <div className="bg-slate-950/60 rounded p-1 border border-slate-800" title="Mirada (Eyes Gaze)">
                <div className="text-cyan-400 font-medium">Mirada</div>
                <div className="text-slate-200 font-bold">{Math.round(features.gazeX * 10)}</div>
              </div>
              <div className="bg-slate-950/60 rounded p-1 border border-slate-800" title="Cejas (Eyebrows)">
                <div className="text-purple-400 font-medium">Cejas</div>
                <div className="text-slate-200 font-bold">{Math.round(features.browRaise * 100)}%</div>
              </div>
              <div className="bg-slate-950/60 rounded p-1 border border-slate-800" title="Boca (Mouth)">
                <div className="text-rose-400 font-medium">Boca</div>
                <div className="text-slate-200 font-bold">{Math.round(features.jawOpen * 100)}%</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
