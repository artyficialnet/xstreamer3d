import React, { useState } from 'react';
import {
  Sparkles,
  Shield,
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ArrowRight,
  Check,
  Dices,
  Zap,
  Link2,
  Share2,
  Copy,
} from 'lucide-react';
import { AvatarId, FaceFeatures } from '../../types';
import { AVATAR_LIST } from '../avatars/avatarConfigs';
import { AvatarCanvas } from '../avatars/AvatarCanvas';
import { AudioWaveform } from '../common/AudioWaveform';

interface LobbyProps {
  onJoinRoom: (config: {
    userName: string;
    roomId: string;
    avatarId: AvatarId;
    createAsAdmin: boolean;
  }) => void;
  localFeatures: FaceFeatures;
  isCameraActive: boolean;
  isMicActive: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  isModelReady: boolean;
}

// Preset Demo Profiles for instant 1-click testing
const DEMO_PROFILES: Array<{
  id: string;
  name: string;
  role: 'admin' | 'participant';
  avatarId: AvatarId;
  label: string;
  badge: string;
  color: string;
}> = [
  {
    id: 'admin_demo',
    name: 'RobotMaster',
    role: 'admin',
    avatarId: 'three_robot',
    label: '🤖 Robot 3D',
    badge: '3D MECHA',
    color: 'from-cyan-500/20 to-emerald-500/20 border-cyan-500/50 text-cyan-300',
  },
  {
    id: 'user_cat',
    name: 'Neko3D',
    role: 'participant',
    avatarId: 'cat_3d',
    label: '🐱 Gato 3D',
    badge: '3D FELINO',
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/50 text-amber-300',
  },
  {
    id: 'user_dog',
    name: 'Doggo3D',
    role: 'participant',
    avatarId: 'dog_3d',
    label: '🐶 Perro 3D',
    badge: '3D CANINO',
    color: 'from-blue-500/20 to-sky-500/20 border-blue-500/50 text-blue-300',
  },
  {
    id: 'user_female',
    name: 'Sakura3D',
    role: 'participant',
    avatarId: 'female_3d',
    label: '🌸 Chica 3D',
    badge: '3D ANIME',
    color: 'from-pink-500/20 to-rose-500/20 border-pink-500/50 text-pink-300',
  },
  {
    id: 'user_horse',
    name: 'Spirit3D',
    role: 'participant',
    avatarId: 'horse_3d',
    label: '🐴 Caballo 3D',
    badge: '3D EQUINO',
    color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/50 text-purple-300',
  },
  {
    id: 'user_mesh',
    name: 'CyberWire',
    role: 'participant',
    avatarId: 'mesh_outline',
    label: '🕸️ Mesh Wireframe',
    badge: 'HOLO MESH',
    color: 'from-cyan-500/20 to-pink-500/20 border-cyan-400/50 text-cyan-300',
  },
];

const ANON_PREFIXES = ['Anon', 'Cyber', 'Ghost', 'Neon', 'Echo', 'Void', 'Quantum', 'Pixel', 'Astro'];
const ANON_SUFFIXES = ['Fox', 'Nova', 'Rider', 'Specter', 'Vortex', 'Pulse', 'Bot', 'Phantom', 'Zero'];

export const Lobby: React.FC<LobbyProps> = ({
  onJoinRoom,
  localFeatures,
  isCameraActive,
  isMicActive,
  onToggleCamera,
  onToggleMic,
  isModelReady,
}) => {
  const [roomId, setRoomId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room') || params.get('r');
      if (urlRoom) return urlRoom.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const hash = window.location.hash.replace('#', '').replace('room=', '');
      if (hash && hash.length >= 2) return hash.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    }
    return 'alpha';
  });

  const [hasRoomFromUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return Boolean(params.get('room') || params.get('r') || (window.location.hash && window.location.hash.length > 2));
    }
    return false;
  });

  const [selectedAvatarId, setSelectedAvatarId] = useState<AvatarId>('cyber_nova');
  const [mode, setMode] = useState<'create' | 'join'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room') || params.get('r') || (window.location.hash && window.location.hash.length > 2)) {
        return 'join';
      }
    }
    return 'create';
  });
  const [copiedLink, setCopiedLink] = useState(false);
  const [userName, setUserName] = useState('Admin_Master');
  const [error, setError] = useState<string | null>(null);
  const selectedAvatar = AVATAR_LIST.find((a) => a.id === selectedAvatarId) || AVATAR_LIST[0];

  // Helper to build the full public room URL
  const getPublicShareUrl = (roomCode: string) => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const cleanRoom = roomCode.trim().toLowerCase() || 'alpha';
    return `${origin}${pathname}?room=${encodeURIComponent(cleanRoom)}`;
  };

  const handleCopyLink = () => {
    const url = getPublicShareUrl(roomId);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleNativeShare = async () => {
    const url = getPublicShareUrl(roomId);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'XSTREAMX - Videollamada con Avatares 3D',
          text: `¡Únete a mi videollamada en vivo en la sala pública "${roomId.toUpperCase()}" de XSTREAMX!`,
          url,
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }
    handleCopyLink();
  };

  // Quick 1-click Demo Entry
  const handleQuickDemoEnter = (profile: typeof DEMO_PROFILES[0]) => {
    setUserName(profile.name);
    setSelectedAvatarId(profile.avatarId);
    setMode(profile.role === 'admin' ? 'create' : 'join');
    onJoinRoom({
      userName: profile.name,
      roomId: roomId.trim().toLowerCase() || 'alpha',
      avatarId: profile.avatarId,
      createAsAdmin: profile.role === 'admin',
    });
  };

  // Generate random anonymous name
  const handleGenerateRandomAnon = () => {
    const p = ANON_PREFIXES[Math.floor(Math.random() * ANON_PREFIXES.length)];
    const s = ANON_SUFFIXES[Math.floor(Math.random() * ANON_SUFFIXES.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    setUserName(`${p}${s}_${num}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = userName.trim();
    const trimmedRoom = roomId.trim();

    if (!trimmedName) {
      setError('Por favor escribe tu nombre o alias para identificarte.');
      return;
    }
    if (!trimmedRoom) {
      setError('Por favor indica un código o nombre de sala.');
      return;
    }

    setError(null);
    onJoinRoom({
      userName: trimmedName,
      roomId: trimmedRoom.toLowerCase(),
      avatarId: selectedAvatarId,
      createAsAdmin: mode === 'create',
    });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Column: Interactive Avatar Mirror Preview */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full max-w-md bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-2xl relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Espejo de Avatar en Vivo
                </span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                {selectedAvatar.badge}
              </span>
            </div>

            {/* Avatar Canvas Interactive Viewport (Fixed 320x320 size) */}
            <div className="relative w-[320px] h-[320px] mx-auto rounded-xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800/80 overflow-hidden flex items-center justify-center shrink-0">
              <AvatarCanvas
                avatarId={selectedAvatarId}
                features={localFeatures}
                userName={userName || 'Tu Avatar'}
                isSpeaking={localFeatures.audioVolume > 0.15}
              />

              {/* Status overlay */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/85 backdrop-blur border border-slate-700/60 text-[11px] text-slate-300">
                  <span className={`w-2 h-2 rounded-full ${localFeatures.isFaceDetected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>
                    {localFeatures.isFaceDetected
                      ? 'Rostro detectado (MediaPipe)'
                      : isModelReady
                      ? 'Buscando rostro en cámara...'
                      : 'Cargando red neuronal...'}
                  </span>
                </div>
              </div>

              {/* Audio Waveform in Mirror */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-800">
                <AudioWaveform
                  audioVolume={localFeatures.audioVolume}
                  isMuted={!isMicActive}
                  width={60}
                  height={18}
                />
                <span className="text-[10px] font-mono text-slate-400">
                  {isMicActive ? (localFeatures.audioVolume > 0.1 ? 'Voz' : 'Mic') : 'Silencio'}
                </span>
              </div>

              {/* Hardware toggles bar */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`p-2.5 rounded-lg border transition ${
                    isMicActive
                      ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-600'
                      : 'bg-rose-950/80 text-rose-300 border-rose-800'
                  }`}
                  title={isMicActive ? 'Micrófono activo' : 'Micrófono silenciado'}
                >
                  {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={onToggleCamera}
                  className={`p-2.5 rounded-lg border transition ${
                    isCameraActive
                      ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-600'
                      : 'bg-rose-950/80 text-rose-300 border-rose-800'
                  }`}
                  title={isCameraActive ? 'Cámara activa' : 'Cámara pausada'}
                >
                  {isCameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Selected Avatar Info */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">{selectedAvatar.name}</h4>
                <p className="text-xs text-slate-400">{selectedAvatar.tagline}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Demo Profiles, Identity & Join Form */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-7 shadow-2xl">
            
            {/* Quick Demo Access Bar */}
            <div className="mb-5 p-3.5 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-800/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                  <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>Accesos Demo Rápidos (1-Clic)</span>
                </div>
                <span className="text-[10px] text-slate-400">100% Anónimo</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {DEMO_PROFILES.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleQuickDemoEnter(profile)}
                    className={`p-2.5 rounded-lg border bg-gradient-to-br ${profile.color} text-left transition hover:scale-[1.02] active:scale-[0.98] group flex flex-col justify-between`}
                    title={`Entrar inmediatamente como ${profile.name} (${profile.role})`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black truncate">{profile.label}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 font-mono font-bold">
                        {profile.badge}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-300">
                      <span className="font-mono truncate">{profile.name}</span>
                      <span className="text-[10px] font-bold text-cyan-400 group-hover:translate-x-0.5 transition">
                        Entrar ➔
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Selector Tabs (Admin vs Participant) */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition ${
                  mode === 'create'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Crear Sala (Admin)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition ${
                  mode === 'join'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Unirse a Sala</span>
              </button>
            </div>

            {hasRoomFromUrl && (
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-cyan-950/80 to-slate-900 border border-cyan-500/50 flex items-center gap-2.5 text-xs text-cyan-200 shadow-lg shadow-cyan-950/50">
                <Link2 className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
                <div className="leading-tight">
                  <span className="font-bold text-white">Invitación Pública Recibida:</span> Has recibido un link para entrar a la sala{' '}
                  <span className="font-mono font-bold text-cyan-300 uppercase tracking-wider">{roomId}</span>. Elige tu avatar y pulsa Unirse.
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Alias input with Randomizer button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Tu Alias o Nombre
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomAnon}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>Generar Aleatorio</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Ej. Admin_Master, CyberPhantom_99"
                  maxLength={24}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
              </div>

              {/* Room ID input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Código de Sala (Ambos deben usar el mismo)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="ALPHA"
                    maxLength={20}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 uppercase transition"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                    #SALA
                  </div>
                </div>
              </div>

              {/* Campo con el Link Público para Enviar a Otro */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                    Enlace Público para Enviar a Otro
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/80">
                    Sala Pública
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={getPublicShareUrl(roomId)}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 min-w-0 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 select-all focus:outline-none focus:border-cyan-500 truncate"
                    title="Enlace público para invitar a cualquier persona"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    }`}
                    title="Copiar link público para ingresar"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition shrink-0"
                    title="Compartir enlace con otro participante"
                  >
                    <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Copia y envía este link para que otra persona ingrese directamente a esta sala pública con su avatar en tiempo real.
                </p>
              </div>

              {/* Avatar Selector Grid */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Elige tu Avatar (2D o 3D Three.js WebGL)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {AVATAR_LIST.map((avatar) => {
                    const isSelected = avatar.id === selectedAvatarId;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setSelectedAvatarId(avatar.id)}
                        className={`relative p-1.5 rounded-xl border text-left flex flex-col items-center gap-1 transition ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-400 ring-2 ring-cyan-400/30'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-lg border flex items-center justify-center text-xl shadow-inner shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${avatar.themeColor}22, ${avatar.accentColor}33)`,
                            borderColor: `${avatar.themeColor}55`,
                          }}
                        >
                          {avatar.emoji || '🎭'}
                        </div>
                        <span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">
                          {avatar.name}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-cyan-400 flex items-center justify-center">
                            <Check className="w-2 h-2 text-slate-950" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error feedback */}
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-xs text-rose-300">
                  {error}
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black tracking-wide text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition active:scale-[0.99]"
              >
                <span>
                  {mode === 'create' ? 'Crear e Ingresar como Admin' : 'Unirse a la Videollamada'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-3 text-center">
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Acceso 100% libre y anónimo. Sin contraseñas ni almacenamiento de video.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
