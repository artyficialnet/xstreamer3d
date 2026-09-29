import React, { useState } from 'react';
import { Shield, Users, Lock, Unlock, Copy, Check, Sparkles, Volume2, Link2, Share2, ScanFace } from 'lucide-react';
import { RoomInfo, User } from '../../types';

interface HeaderProps {
  room: RoomInfo | null;
  currentUser: User | null;
  onToggleLock?: (locked: boolean) => void;
  isAdmin: boolean;
  onToggleTrackingModule?: () => void;
  isTrackingModuleOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  currentUser,
  onToggleLock,
  isAdmin,
  onToggleTrackingModule,
  isTrackingModuleOpen,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const getPublicShareUrl = () => {
    if (!room?.id || typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.id.toLowerCase())}`;
  };

  const handleCopyCode = () => {
    if (!room?.id) return;
    navigator.clipboard.writeText(room.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyUrl = () => {
    const url = getPublicShareUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleShare = async () => {
    const url = getPublicShareUrl();
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'XSTREAMX - Videollamada con Avatares 3D',
          text: `¡Únete a la sala pública "${room?.id.toUpperCase()}" en XSTREAMX!`,
          url,
        });
        return;
      } catch (e) {
        // Fallback
      }
    }
    handleCopyUrl();
  };

  return (
    <header className="h-16 px-4 md:px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-20 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-pink-500 p-0.5 shadow-lg shadow-cyan-500/20">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300">
              XSTREAMX
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              Avatar Mesh Call
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium hidden sm:block">
            Videollamada en tiempo real mediante gestos faciales MediaPipe
          </p>
        </div>
      </div>

      {/* Right Controls (Tracking Module & Room Details) */}
      <div className="flex items-center gap-3">
        {onToggleTrackingModule && (
          <button
            onClick={onToggleTrackingModule}
            title="Abrir módulo de tracking facial en tiempo real"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
              isTrackingModuleOpen
                ? 'bg-lime-950/80 border-lime-500 text-lime-300 ring-2 ring-lime-500/25'
                : 'bg-slate-800/90 border-lime-800/50 text-slate-200 hover:border-lime-500 hover:text-lime-300'
            }`}
          >
            <ScanFace className="w-4 h-4 text-lime-400 animate-pulse" />
            <span className="hidden sm:inline">Módulo Tracking</span>
            <span className="w-2 h-2 rounded-full bg-lime-400" />
          </button>
        )}

        {room && (
          <>
          {/* Room ID Badge & Copy */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-lg p-1 pl-3 gap-2">
            <span className="text-xs text-slate-400">Sala:</span>
            <span className="font-mono text-xs font-bold text-cyan-300 tracking-wider">
              {room.id.toUpperCase()}
            </span>
            <button
              onClick={handleCopyCode}
              title="Copiar código de sala"
              className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Campo con Enlace Público para Enviar a Otro */}
          <div className="flex items-center bg-slate-800/80 border border-cyan-800/50 rounded-lg p-1 pl-2.5 gap-1.5 shadow-sm">
            <Link2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-300 hidden md:inline">Link Público:</span>
            <input
              type="text"
              readOnly
              value={getPublicShareUrl()}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="bg-slate-950/80 text-cyan-300 font-mono text-[11px] px-2 py-0.5 rounded border border-slate-700/80 w-24 sm:w-36 md:w-52 truncate select-all focus:outline-none focus:border-cyan-500"
              title="Enlace público para que otro ingrese a la sala"
            />
            <button
              onClick={handleCopyUrl}
              title="Copiar enlace público para enviar a otro"
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition shrink-0 ${
                copiedUrl
                  ? 'bg-emerald-600 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950'
              }`}
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3 h-3" />
                  <span className="hidden lg:inline">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="hidden lg:inline">Copiar Link</span>
                </>
              )}
            </button>
            <button
              onClick={handleShare}
              title="Compartir enlace con otro participante"
              className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition shrink-0"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          </div>

          {/* Participants Count */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold">{room.participants.length}</span>
          </div>

          {/* Admin Lock Room toggle */}
          {isAdmin && onToggleLock && (
            <button
              onClick={() => onToggleLock(!room.isLocked)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                room.isLocked
                  ? 'bg-rose-950/60 border-rose-700 text-rose-300 hover:bg-rose-900/80'
                  : 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-emerald-900/80'
              }`}
            >
              {room.isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sala Bloqueada</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sala Abierta</span>
                </>
              )}
            </button>
          )}

          {/* User Role Tag */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
              currentUser?.role === 'admin'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {currentUser?.role === 'admin' && <Shield className="w-3.5 h-3.5 text-amber-400" />}
            <span className="capitalize">{currentUser?.role === 'admin' ? 'Admin' : 'Participante'}</span>
          </div>
          </>
        )}
      </div>
    </header>
  );
};
