/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AvatarId,
  FaceFeatures,
  RoomInfo,
  User,
  ChatMessage,
} from './types';
import {
  faceTrackerSingleton,
  INITIAL_FACE_FEATURES,
} from './services/mediapipeService';
import { audioServiceSingleton } from './services/audioService';
import { networkServiceSingleton } from './services/networkService';
import { Header } from './components/common/Header';
import { Lobby } from './components/lobby/Lobby';
import { RoomView } from './components/room/RoomView';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning';
  text: string;
}

export default function App() {
  // App state
  const [isInRoom, setIsInRoom] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Hardware states
  const [isMicActive, setIsMicActive] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isModelReady, setIsModelReady] = useState(false);

  // Tracking state
  const [localFeatures, setLocalFeatures] = useState<FaceFeatures>({
    ...INITIAL_FACE_FEATURES,
  });
  const [landmarks, setLandmarks] = useState<Array<{ x: number; y: number; z: number }> | null>(null);
  const [peerFeaturesMap, setPeerFeaturesMap] = useState<Map<string, FaceFeatures>>(new Map());

  // Video element reference
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Toast notification helper
  const addToast = useCallback((text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // 1. Initialize MediaPipe & Camera on mount
  useEffect(() => {
    let isMounted = true;

    async function initHardwareAndAI() {
      // Initialize MediaPipe FaceLandmarker
      try {
        const loaded = await faceTrackerSingleton.initialize();
        if (isMounted) {
          setIsModelReady(loaded);
        }
      } catch (e) {
        console.warn('[App] MediaPipe load error, continuing with fallback:', e);
      }

      // Initialize Webcam
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
        });

        if (isMounted && videoRef.current) {
          cameraStreamRef.current = stream;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // Start tracking loop
          faceTrackerSingleton.startTracking(
            videoRef.current,
            (features) => {
              if (isMounted) {
                setLocalFeatures(features);
                networkServiceSingleton.broadcastFaceData(features);
              }
            },
            (lms) => {
              if (isMounted) setLandmarks(lms);
            }
          );
        }
      } catch (camErr) {
        console.warn('[App] Webcam not available or permission denied:', camErr);
        // Start simulated demo tracking so user can experience avatars immediately
        startDemoSimulation();
      }

      // Initialize Microphone & Audio Analysis
      try {
        const audioStream = await audioServiceSingleton.start((volume) => {
          if (isMounted) {
            faceTrackerSingleton.setAudioVolume(volume);
            setLocalFeatures((prev) => ({
              ...prev,
              audioVolume: volume,
            }));
          }
        });

        if (audioStream) {
          networkServiceSingleton.setLocalAudioStream(audioStream);
        }
      } catch (audioErr) {
        console.warn('[App] Mic not available:', audioErr);
      }
    }

    initHardwareAndAI();

    return () => {
      isMounted = false;
      faceTrackerSingleton.stopTracking();
      audioServiceSingleton.stop();
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Simulation mode fallback if no physical webcam
  const startDemoSimulation = () => {
    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.05;
      const simFeatures: FaceFeatures = {
        pitch: Math.sin(angle * 0.7) * 0.15,
        yaw: Math.cos(angle * 0.5) * 0.25,
        roll: Math.sin(angle * 0.3) * 0.1,
        eyeBlinkLeft: Math.random() < 0.03 ? 1 : 0,
        eyeBlinkRight: Math.random() < 0.03 ? 1 : 0,
        eyeWideLeft: 0,
        eyeWideRight: 0,
        gazeX: Math.cos(angle * 0.5) * 0.3,
        gazeY: Math.sin(angle * 0.4) * 0.2,
        browRaise: (Math.sin(angle * 0.8) + 1) * 0.2,
        browFurrow: 0,
        jawOpen: Math.max(0, Math.sin(angle * 1.5) * 0.3),
        mouthSmile: (Math.cos(angle * 0.4) + 1) * 0.3,
        mouthPucker: 0,
        mouthX: 0,
        audioVolume: 0,
        isFaceDetected: true,
      };
      setLocalFeatures(simFeatures);
      networkServiceSingleton.broadcastFaceData(simFeatures);
    }, 40);

    return () => clearInterval(interval);
  };

  // 2. Set up Network Service listeners
  useEffect(() => {
    networkServiceSingleton.onRoomJoined = (joinedRoom, user) => {
      setRoom(joinedRoom);
      setCurrentUser(user);
      setIsInRoom(true);
      addToast(`Bienvenido a la sala ${joinedRoom.id.toUpperCase()}`, 'success');
    };

    networkServiceSingleton.onUserJoined = (user, participants) => {
      setRoom((prev) => (prev ? { ...prev, participants } : null));
      addToast(`${user.name} se ha unido a la sala`, 'info');
    };

    networkServiceSingleton.onUserLeft = (userId, participants) => {
      setRoom((prev) => (prev ? { ...prev, participants } : null));
      setPeerFeaturesMap((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
      addToast('Un participante ha salido de la sala', 'info');
    };

    networkServiceSingleton.onUserUpdated = (updatedUser) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === updatedUser.id ? updatedUser : p
          ),
        };
      });
      if (currentUser && currentUser.id === updatedUser.id) {
        setCurrentUser(updatedUser);
      }
    };

    networkServiceSingleton.onPeerFaceData = (userId, features) => {
      setPeerFeaturesMap((prev) => {
        const next = new Map(prev);
        next.set(userId, features);
        return next;
      });
    };

    networkServiceSingleton.onChatMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    networkServiceSingleton.onRoomLockChanged = (isLocked) => {
      setRoom((prev) => (prev ? { ...prev, isLocked } : null));
      addToast(
        isLocked
          ? 'El administrador ha bloqueado el acceso a la sala'
          : 'El administrador ha desbloqueado la sala',
        'warning'
      );
    };

    networkServiceSingleton.onForceMute = (isMuted) => {
      setIsMicActive(!isMuted);
      audioServiceSingleton.setMute(isMuted);
      addToast('El administrador ha silenciado tu micrófono', 'warning');
    };

    networkServiceSingleton.onKicked = (reason) => {
      setIsInRoom(false);
      setRoom(null);
      setCurrentUser(null);
      addToast(reason || 'Has sido expulsado de la sala por el administrador', 'warning');
    };

    networkServiceSingleton.onError = (errMsg) => {
      addToast(errMsg, 'warning');
    };

    return () => {
      networkServiceSingleton.cleanup();
    };
  }, [addToast, currentUser]);

  // Handle joining room from lobby
  const handleJoinRoom = ({
    userName,
    roomId,
    avatarId,
    createAsAdmin,
  }: {
    userName: string;
    roomId: string;
    avatarId: AvatarId;
    createAsAdmin: boolean;
  }) => {
    networkServiceSingleton.joinRoom(roomId, userName, avatarId, createAsAdmin);
  };

  // Toggle Microphone
  const handleToggleMic = () => {
    const nextState = !isMicActive;
    setIsMicActive(nextState);
    audioServiceSingleton.setMute(!nextState);
    networkServiceSingleton.toggleMute(!nextState);
  };

  // Toggle Camera / Face Detection
  const handleToggleCamera = () => {
    const nextState = !isCameraActive;
    setIsCameraActive(nextState);
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
    networkServiceSingleton.toggleCamera(nextState);
  };

  // Select Avatar in real time
  const handleSelectAvatar = (avatarId: AvatarId) => {
    if (currentUser) {
      setCurrentUser((prev) => (prev ? { ...prev, avatarId } : null));
    }
    networkServiceSingleton.updateAvatar(avatarId);
  };

  // Chat message send
  const handleSendMessage = (text: string, reaction?: string) => {
    networkServiceSingleton.sendChatMessage(text, reaction);
  };

  // Admin controls
  const handleAdminMute = (targetUserId: string, state: boolean) => {
    networkServiceSingleton.adminMuteUser(targetUserId, state);
  };

  const handleAdminKick = (targetUserId: string) => {
    networkServiceSingleton.adminKickUser(targetUserId);
  };

  const handleToggleLock = (locked: boolean) => {
    networkServiceSingleton.adminToggleLock(locked);
  };

  const handleMuteAll = () => {
    if (!room || !currentUser) return;
    room.participants.forEach((p) => {
      if (p.id !== currentUser.id) {
        networkServiceSingleton.adminMuteUser(p.id, true);
      }
    });
    addToast('Todos los participantes han sido silenciados', 'info');
  };

  // Leave room
  const handleLeaveCall = () => {
    networkServiceSingleton.cleanup();
    setIsInRoom(false);
    setRoom(null);
    setCurrentUser(null);
    setMessages([]);
    addToast('Has salido de la videollamada', 'info');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans antialiased text-slate-100">
      {/* Hidden local video element used as MediaPipe frame source */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="hidden"
        style={{ display: 'none' }}
      />

      {/* Floating Toast Notification Stack */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold backdrop-blur-md border animate-fade-in ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
                : toast.type === 'warning'
                ? 'bg-rose-950/90 border-rose-600 text-rose-200'
                : 'bg-slate-900/90 border-cyan-700 text-cyan-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-cyan-400 shrink-0" />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      {/* Screen Routing: Lobby vs Active Room */}
      {!isInRoom || !room || !currentUser ? (
        <div className="flex-1 flex flex-col min-h-0">
          <Header
            room={null}
            currentUser={null}
            isAdmin={false}
          />
          <Lobby
            onJoinRoom={handleJoinRoom}
            localFeatures={localFeatures}
            isCameraActive={isCameraActive}
            isMicActive={isMicActive}
            onToggleCamera={handleToggleCamera}
            onToggleMic={handleToggleMic}
            isModelReady={isModelReady}
          />
        </div>
      ) : (
        <RoomView
          room={room}
          currentUser={currentUser}
          localFeatures={localFeatures}
          peerFeaturesMap={peerFeaturesMap}
          isMicActive={isMicActive}
          isCameraActive={isCameraActive}
          messages={messages}
          videoRef={videoRef}
          landmarks={landmarks}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onSelectAvatar={handleSelectAvatar}
          onSendMessage={handleSendMessage}
          onAdminMute={handleAdminMute}
          onAdminKick={handleAdminKick}
          onToggleLock={handleToggleLock}
          onMuteAll={handleMuteAll}
          onLeaveCall={handleLeaveCall}
        />
      )}
    </div>
  );
}
