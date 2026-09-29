import React from 'react';
import { AvatarId, FaceFeatures } from '../../types';
import { ThreeAvatarCanvas } from './ThreeAvatarCanvas';

interface AvatarCanvasProps {
  avatarId: AvatarId;
  features: FaceFeatures;
  userName?: string;
  isSpeaking?: boolean;
  className?: string;
  showLandmarkOverlay?: boolean;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  avatarId,
  features,
  userName,
  isSpeaking = false,
  className = '',
}) => {
  return (
    <ThreeAvatarCanvas
      avatarId={avatarId}
      features={features}
      userName={userName}
      isSpeaking={isSpeaking}
      className={className}
    />
  );
};
