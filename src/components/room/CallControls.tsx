import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Smile,
  LayoutGrid,
  Maximize,
  Tv,
  MessageSquare,
  Shield,
  PhoneOff,
  Check,
  ScanFace,
} from 'lucide-react';
import { AvatarId, ViewLayoutMode } from '../../types';
import { AVATAR_LIST } from '../avatars/avatarConfigs';

interface CallControlsProps {
  isMicActive: boolean;
  isCameraActive: boolean;
  currentAvatarId: AvatarId;
  viewMode: ViewLayoutMode;
  unreadChatCount: number;
  isChatOpen: boolean;
  isAdmin: boolean;
  isAdminPanelOpen: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSelectAvatar: (id: AvatarId) => void;
  onChangeViewMode: (mode: ViewLayoutMode) => void;
  onToggleChat: () => void;
  onToggleAdminPanel: () => void;
  onLeaveCall: () => void;
  onToggleTrackingModule?: () => void;
  isTrackingModuleOpen?: boolean;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isMicActive,
  isCameraActive,
  currentAvatarId,
  viewMode,
  unreadChatCount,
  isChatOpen,
  isAdmin,
  isAdminPanelOpen,
  onToggleMic,
  onToggleCamera,
  onSelectAvatar,
  onChangeViewMode,
  onToggleChat,
  onToggleAdminPanel,
  onLeaveCall,
  onToggleTrackingModule,
  isTrackingModuleOpen,
}) => {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);

  return (
    <div className="h-20 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 px-4 flex items-center justify-between z-20 shrink-0">
      {/* Left: Layout switcher & Admin modal button */}
      <div className="flex items-center gap-2">
        {/* Layout Mode Button */}
        <div className="relative">
          <button
            onClick={() => setShowLayoutPicker(!showLayoutPicker)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            title="Cambiar distribución de vista"
          >
            {viewMode === 'grid' && <LayoutGrid className="w-4 h-4 text-cyan-400" />}
            {viewMode === 'speaker_focus' && <Maximize className="w-4 h-4 text-indigo-400" />}
            {viewMode === 'stage' && <Tv className="w-4 h-4 text-emerald-400" />}
            <span className="hidden sm:inline">
              {viewMode === 'grid' ? 'Cuadrícula' : viewMode === 'speaker_focus' ? 'Orador' : 'Escenario'}
            </span>
          </button>

          {showLayoutPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowLayoutPicker(false)} />
              <div className="absolute left-0 bottom-full mb-2 w-48 rounded-xl bg-slate-900 border border-slate-700 p-1.5 shadow-2xl z-20 space-y-1 text-xs">
                <button
                  onClick={() => {
                    onChangeViewMode('grid');
                    setShowLayoutPicker(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition ${
                    viewMode === 'grid' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4 text-cyan-400" />
                  <span>Cuadrícula (Mosaico)</span>
                </button>
                <button
                  onClick={() => {
                    onChangeViewMode('speaker_focus');
                    setShowLayoutPicker(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition ${
                    viewMode === 'speaker_focus' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Maximize className="w-4 h-4 text-indigo-400" />
                  <span>Orador Principal</span>
                </button>
                <button
                  onClick={() => {
                    onChangeViewMode('stage');
                    setShowLayoutPicker(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition ${
                    viewMode === 'stage' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Tv className="w-4 h-4 text-emerald-400" />
                  <span>Modo Escenario Admin</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Admin Tools Button */}
        {isAdmin && (
          <button
            onClick={onToggleAdminPanel}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
              isAdminPanelOpen
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border-amber-700/60'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Panel Moderador</span>
          </button>
        )}
      </div>

      {/* Center: Core Call Toggles (Mic, Camera, Avatar Switcher) */}
      <div className="flex items-center gap-3">
        {/* Mic Toggle */}
        <button
          onClick={onToggleMic}
          className={`p-3.5 rounded-2xl border transition active:scale-95 shadow-lg ${
            isMicActive
              ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border-slate-600'
              : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-600/30'
          }`}
          title={isMicActive ? 'Silenciar micrófono' : 'Activar micrófono'}
        >
          {isMicActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera / Face Tracking Toggle */}
        <button
          onClick={onToggleCamera}
          className={`p-3.5 rounded-2xl border transition active:scale-95 shadow-lg ${
            isCameraActive
              ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border-slate-600'
              : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-600/30'
          }`}
          title={isCameraActive ? 'Pausar captura de rostro' : 'Activar captura de rostro'}
        >
          {isCameraActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Avatar Quick Switcher Popover */}
        <div className="relative">
          <button
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className={`p-3.5 rounded-2xl border transition active:scale-95 shadow-lg ${
              showAvatarPicker
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-cyan-500/25'
                : 'bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border-slate-600'
            }`}
            title="Cambiar mi Avatar en vivo"
          >
            <Smile className="w-5 h-5" />
          </button>

          {showAvatarPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowAvatarPicker(false)} />
              <div className="absolute -translate-x-1/2 left-1/2 bottom-full mb-3 w-80 rounded-2xl bg-slate-900 border border-slate-700 p-3 shadow-2xl z-20">
                <div className="text-xs font-bold text-slate-300 mb-2 px-1 flex items-center justify-between">
                  <span>Cambiar Avatar en Vivo</span>
                  <span className="text-[10px] text-cyan-400 font-mono">2D Live Rigs</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {AVATAR_LIST.map((avatar) => {
                    const isSelected = avatar.id === currentAvatarId;
                    return (
                      <button
                        key={avatar.id}
                        onClick={() => {
                          onSelectAvatar(avatar.id);
                          setShowAvatarPicker(false);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: avatar.themeColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{avatar.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{avatar.category}</p>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Módulo de Tracking AI (Live wireframe video feed) */}
        {onToggleTrackingModule && (
          <button
            onClick={onToggleTrackingModule}
            className={`p-3.5 rounded-2xl border transition active:scale-95 shadow-lg ${
              isTrackingModuleOpen
                ? 'bg-lime-950 border-lime-400 text-lime-300 shadow-lime-500/25 ring-2 ring-lime-500/30'
                : 'bg-slate-800/90 hover:bg-slate-700 text-lime-400 border-slate-600'
            }`}
            title="Abrir Módulo de Tracking AI (Ver malla verde en tiempo real)"
          >
            <ScanFace className="w-5 h-5" />
          </button>
        )}

        {/* Leave Call Button */}
        <button
          onClick={onLeaveCall}
          className="p-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 transition active:scale-95 shadow-lg shadow-rose-600/30"
          title="Salir de la videollamada"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Right: Chat Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleChat}
          className={`relative p-3 rounded-xl border transition ${
            isChatOpen
              ? 'bg-cyan-500 text-slate-950 border-cyan-400'
              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
          title="Abrir chat de la sala"
        >
          <MessageSquare className="w-4 h-4" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center border-2 border-slate-950 animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
