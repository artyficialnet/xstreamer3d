import React, { useState } from 'react';
import { RoomInfo, User, FaceFeatures, ChatMessage, ViewLayoutMode, AvatarId } from '../../types';
import { Header } from '../common/Header';
import { ParticipantCard } from './ParticipantCard';
import { CallControls } from './CallControls';
import { ChatSidebar } from './ChatSidebar';
import { AdminControlPanel } from './AdminControlPanel';
import { CameraPreviewPip } from './CameraPreviewPip';
import { FaceTrackingVisionModule } from '../tracking/FaceTrackingVisionModule';

interface RoomViewProps {
  room: RoomInfo;
  currentUser: User;
  localFeatures: FaceFeatures;
  peerFeaturesMap: Map<string, FaceFeatures>;
  isMicActive: boolean;
  isCameraActive: boolean;
  messages: ChatMessage[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  landmarks: Array<{ x: number; y: number; z: number }> | null;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSelectAvatar: (id: AvatarId) => void;
  onSendMessage: (text: string, reaction?: string) => void;
  onAdminMute: (userId: string, state: boolean) => void;
  onAdminKick: (userId: string) => void;
  onToggleLock: (locked: boolean) => void;
  onMuteAll: () => void;
  onLeaveCall: () => void;
}

export const RoomView: React.FC<RoomViewProps> = ({
  room,
  currentUser,
  localFeatures,
  peerFeaturesMap,
  isMicActive,
  isCameraActive,
  messages,
  videoRef,
  landmarks,
  onToggleMic,
  onToggleCamera,
  onSelectAvatar,
  onSendMessage,
  onAdminMute,
  onAdminKick,
  onToggleLock,
  onMuteAll,
  onLeaveCall,
}) => {
  const [viewMode, setViewMode] = useState<ViewLayoutMode>('grid');
  const [focusedSpeakerId, setFocusedSpeakerId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isTrackingModuleOpen, setIsTrackingModuleOpen] = useState(false);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(messages.length);

  const isAdmin = currentUser.role === 'admin';
  const unreadCount = Math.max(0, messages.length - lastReadMessageCount);

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      if (!prev) {
        setLastReadMessageCount(messages.length);
      }
      return !prev;
    });
  };

  // Combine current user with room participants to ensure self is present
  const allParticipants = React.useMemo(() => {
    const list = [...room.participants];
    if (!list.find((p) => p.id === currentUser.id)) {
      list.unshift(currentUser);
    }
    return list;
  }, [room.participants, currentUser]);

  // Determine focus user in speaker_focus or stage mode
  const effectiveFocusUser = React.useMemo(() => {
    if (viewMode === 'stage') {
      const admin = allParticipants.find((p) => p.role === 'admin') || allParticipants[0];
      return admin;
    }
    if (focusedSpeakerId) {
      const found = allParticipants.find((p) => p.id === focusedSpeakerId);
      if (found) return found;
    }
    // Default to first user or someone speaking
    return allParticipants[0];
  }, [viewMode, focusedSpeakerId, allParticipants]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Top Bar Header */}
      <Header
        room={room}
        currentUser={currentUser}
        onToggleLock={onToggleLock}
        isAdmin={isAdmin}
        onToggleTrackingModule={() => setIsTrackingModuleOpen((prev) => !prev)}
        isTrackingModuleOpen={isTrackingModuleOpen}
      />

      {/* Main Video Call Stage Layout */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        
        {/* Participant Avatars Viewport */}
        <div className="flex-1 p-3 sm:p-5 overflow-y-auto flex flex-col justify-center">
          
          {/* ======================================================== */}
          {/* 1. GRID / MOSAIC VIEW */}
          {/* ======================================================== */}
          {viewMode === 'grid' && (
            <div
              className={`w-full h-full grid gap-3 sm:gap-4 auto-rows-fr items-center justify-center ${
                allParticipants.length === 1
                  ? 'grid-cols-1 max-w-2xl mx-auto'
                  : allParticipants.length === 2
                  ? 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto'
                  : allParticipants.length <= 4
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-5xl mx-auto'
                  : allParticipants.length <= 6
                  ? 'grid-cols-2 sm:grid-cols-3 max-w-6xl mx-auto'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-w-7xl mx-auto'
              }`}
            >
              {allParticipants.map((participant) => {
                const isSelf = participant.id === currentUser.id;
                const features = isSelf ? localFeatures : peerFeaturesMap.get(participant.id) || localFeatures;

                return (
                  <ParticipantCard
                    key={participant.id}
                    user={participant}
                    features={features}
                    isSelf={isSelf}
                    isAdmin={isAdmin}
                    onFocusClick={() => {
                      setFocusedSpeakerId(participant.id);
                      setViewMode('speaker_focus');
                    }}
                    onAdminMute={onAdminMute}
                    onAdminKick={onAdminKick}
                  />
                );
              })}
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. SPEAKER FOCUS VIEW */}
          {/* ======================================================== */}
          {viewMode === 'speaker_focus' && (
            <div className="w-full h-full flex flex-col gap-3 max-w-6xl mx-auto">
              {/* Main Focused Participant Card */}
              {effectiveFocusUser && (
                <div className="flex-1 min-h-[300px]">
                  <ParticipantCard
                    user={effectiveFocusUser}
                    features={
                      effectiveFocusUser.id === currentUser.id
                        ? localFeatures
                        : peerFeaturesMap.get(effectiveFocusUser.id) || localFeatures
                    }
                    isSelf={effectiveFocusUser.id === currentUser.id}
                    isAdmin={isAdmin}
                    isFocusSpeaker={true}
                    onAdminMute={onAdminMute}
                    onAdminKick={onAdminKick}
                  />
                </div>
              )}

              {/* Bottom Strip of Other Participants */}
              <div className="h-36 sm:h-44 flex gap-3 overflow-x-auto pb-1 shrink-0">
                {allParticipants
                  .filter((p) => p.id !== effectiveFocusUser?.id)
                  .map((participant) => {
                    const isSelf = participant.id === currentUser.id;
                    const features = isSelf
                      ? localFeatures
                      : peerFeaturesMap.get(participant.id) || localFeatures;
                    return (
                      <div key={participant.id} className="w-48 sm:w-56 h-full shrink-0">
                        <ParticipantCard
                          user={participant}
                          features={features}
                          isSelf={isSelf}
                          isAdmin={isAdmin}
                          onFocusClick={() => setFocusedSpeakerId(participant.id)}
                          onAdminMute={onAdminMute}
                          onAdminKick={onAdminKick}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. STAGE / THEATRE VIEW (Admin Spotlight) */}
          {/* ======================================================== */}
          {viewMode === 'stage' && (
            <div className="w-full h-full grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
              {/* Spotlight Speaker */}
              <div className="lg:col-span-3 h-full">
                {effectiveFocusUser && (
                  <ParticipantCard
                    user={effectiveFocusUser}
                    features={
                      effectiveFocusUser.id === currentUser.id
                        ? localFeatures
                        : peerFeaturesMap.get(effectiveFocusUser.id) || localFeatures
                    }
                    isSelf={effectiveFocusUser.id === currentUser.id}
                    isAdmin={isAdmin}
                    isFocusSpeaker={true}
                    onAdminMute={onAdminMute}
                    onAdminKick={onAdminKick}
                  />
                )}
              </div>

              {/* Side Column of Participants */}
              <div className="lg:col-span-1 flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-170px)] pr-1">
                {allParticipants
                  .filter((p) => p.id !== effectiveFocusUser?.id)
                  .map((participant) => {
                    const isSelf = participant.id === currentUser.id;
                    const features = isSelf
                      ? localFeatures
                      : peerFeaturesMap.get(participant.id) || localFeatures;
                    return (
                      <div key={participant.id} className="min-h-[160px]">
                        <ParticipantCard
                          user={participant}
                          features={features}
                          isSelf={isSelf}
                          isAdmin={isAdmin}
                          onFocusClick={() => setFocusedSpeakerId(participant.id)}
                          onAdminMute={onAdminMute}
                          onAdminKick={onAdminKick}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        </div>

        {/* Live Chat Sidebar */}
        <ChatSidebar
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={messages}
          currentUser={currentUser}
          onSendMessage={onSendMessage}
        />

      </div>

      {/* Floating Camera Preview PIP (MediaPipe Webcam & 478 Landmarks Mesh) */}
      <CameraPreviewPip
        videoRef={videoRef}
        features={localFeatures}
        landmarks={landmarks}
        isCameraActive={isCameraActive}
      />

      {/* Admin Moderation Panel Modal */}
      <AdminControlPanel
        room={room}
        currentUser={currentUser}
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        onAdminMute={onAdminMute}
        onAdminKick={onAdminKick}
        onToggleLock={onToggleLock}
        onMuteAll={onMuteAll}
      />

      {/* Bottom Controls Bar */}
      <CallControls
        isMicActive={isMicActive}
        isCameraActive={isCameraActive}
        currentAvatarId={currentUser.avatarId}
        viewMode={viewMode}
        unreadChatCount={unreadCount}
        isChatOpen={isChatOpen}
        isAdmin={isAdmin}
        isAdminPanelOpen={isAdminPanelOpen}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
        onSelectAvatar={onSelectAvatar}
        onChangeViewMode={setViewMode}
        onToggleChat={handleToggleChat}
        onToggleAdminPanel={() => setIsAdminPanelOpen(!isAdminPanelOpen)}
        onLeaveCall={onLeaveCall}
      />
    </div>
  );
};
