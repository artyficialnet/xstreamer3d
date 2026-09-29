import { io, Socket } from 'socket.io-client';
import { User, RoomInfo, FaceFeatures, ChatMessage, AvatarId } from '../types';

export class NetworkService {
  private socket: Socket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private localAudioStream: MediaStream | null = null;
  public currentUser: User | null = null;
  public currentRoom: RoomInfo | null = null;
  private lastSentTime: number = 0;

  // Event callbacks
  public onRoomJoined: ((room: RoomInfo, user: User) => void) | null = null;
  public onUserJoined: ((user: User, participants: User[]) => void) | null = null;
  public onUserLeft: ((userId: string, participants: User[]) => void) | null = null;
  public onUserUpdated: ((user: User) => void) | null = null;
  public onPeerFaceData: ((userId: string, features: FaceFeatures) => void) | null = null;
  public onChatMessage: ((message: ChatMessage) => void) | null = null;
  public onRoomLockChanged: ((isLocked: boolean) => void) | null = null;
  public onKicked: ((reason: string) => void) | null = null;
  public onForceMute: ((isMuted: boolean) => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  connect() {
    const signalingUrl = (import.meta as any).env?.VITE_SIGNALING_URL;
    const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

    // Only attempt socket connection if signaling server is specified or running on custom host/backend
    if (signalingUrl || !isGitHubPages) {
      this.socket = io(signalingUrl || undefined, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 4,
        timeout: 8000,
      });
    }

    try {
      if (!this.broadcastChannel) {
        this.broadcastChannel = new BroadcastChannel('xstreamx_mesh_channel');
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      }
    } catch (e) {
      console.warn('[Network] BroadcastChannel not supported in this environment');
    }

    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[XStreamX] Socket connected:', this.socket?.id);
    });

    this.socket.on('user_joined', ({ user, participants }: { user: User; participants: User[] }) => {
      if (this.currentRoom) {
        this.currentRoom.participants = participants;
      }
      if (this.onUserJoined) this.onUserJoined(user, participants);

      // WebRTC audio offer if we have local audio stream
      if (this.localAudioStream && user.id !== this.currentUser?.id) {
        this.initiateWebRTCCall(user.id);
      }
    });

    this.socket.on('user_left', ({ userId, participants }: { userId: string; participants: User[] }) => {
      if (this.currentRoom) {
        this.currentRoom.participants = participants;
      }
      this.closePeerConnection(userId);
      if (this.onUserLeft) this.onUserLeft(userId, participants);
    });

    this.socket.on('user_updated', ({ user }: { user: User }) => {
      if (this.currentRoom) {
        this.currentRoom.participants = this.currentRoom.participants.map((p) =>
          p.id === user.id ? user : p
        );
      }
      if (this.currentUser && this.currentUser.id === user.id) {
        this.currentUser = user;
      }
      if (this.onUserUpdated) this.onUserUpdated(user);
    });

    this.socket.on('peer_face_data', ({ userId, data }: { userId: string; data: FaceFeatures }) => {
      if (this.onPeerFaceData) this.onPeerFaceData(userId, data);
    });

    this.socket.on('chat_message', (message: ChatMessage) => {
      if (this.onChatMessage) this.onChatMessage(message);
    });

    this.socket.on('room_lock_changed', ({ isLocked }: { isLocked: boolean }) => {
      if (this.currentRoom) this.currentRoom.isLocked = isLocked;
      if (this.onRoomLockChanged) this.onRoomLockChanged(isLocked);
    });

    this.socket.on('force_mute', ({ isMuted }: { isMuted: boolean }) => {
      if (this.currentUser) this.currentUser.isMuted = isMuted;
      if (this.onForceMute) this.onForceMute(isMuted);
    });

    this.socket.on('kicked_from_room', ({ reason }: { reason: string }) => {
      this.cleanup();
      if (this.onKicked) this.onKicked(reason);
    });

    // WebRTC Signaling
    this.socket.on('webrtc_signal', async ({ fromUserId, signal }: { fromUserId: string; signal: any }) => {
      this.handleWebRTCSignal(fromUserId, signal);
    });
  }

  joinRoom(roomId: string, userName: string, avatarId: AvatarId, createAsAdmin: boolean) {
    this.connect();

    this.socket?.emit('join_room', { roomId, userName, avatarId, createAsAdmin }, (response: any) => {
      if (response.error) {
        if (this.onError) this.onError(response.error);
        return;
      }

      this.currentUser = response.user;
      this.currentRoom = response.room;

      if (this.onRoomJoined && this.currentUser && this.currentRoom) {
        this.onRoomJoined(this.currentRoom, this.currentUser);
      }

      // Sync across browser tabs via broadcastChannel
      this.broadcastChannel?.postMessage({
        type: 'tab_sync_user_joined',
        user: this.currentUser,
        roomId: this.currentRoom?.id,
      });
    });
  }

  setLocalAudioStream(stream: MediaStream | null) {
    this.localAudioStream = stream;
    // Update existing peer connections
    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      const audioSender = senders.find((s) => s.track?.kind === 'audio');
      if (stream && stream.getAudioTracks().length > 0) {
        const track = stream.getAudioTracks()[0];
        if (audioSender) {
          audioSender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
        }
      } else if (audioSender) {
        pc.removeTrack(audioSender);
      }
    });
  }

  broadcastFaceData(features: FaceFeatures) {
    if (!this.currentUser) return;
    const now = performance.now();
    // Throttle to ~35 fps (~28ms) to optimize networking
    if (now - this.lastSentTime < 28) return;
    this.lastSentTime = now;

    // Send over socket.io
    if (this.socket?.connected) {
      this.socket.emit('face_data', features);
    }

    // Also send over local multi-tab broadcast channel
    this.broadcastChannel?.postMessage({
      type: 'tab_peer_face_data',
      userId: this.currentUser.id,
      features,
    });
  }

  updateAvatar(avatarId: AvatarId) {
    if (this.currentUser) {
      this.currentUser.avatarId = avatarId;
    }
    this.socket?.emit('update_avatar', { avatarId });
  }

  toggleMute(isMuted: boolean) {
    if (this.currentUser) {
      this.currentUser.isMuted = isMuted;
    }
    this.socket?.emit('toggle_mute', { isMuted });
  }

  toggleCamera(isCameraActive: boolean) {
    if (this.currentUser) {
      this.currentUser.isCameraActive = isCameraActive;
    }
    this.socket?.emit('toggle_camera', { isCameraActive });
  }

  sendChatMessage(text: string, reaction?: string) {
    this.socket?.emit('send_chat', { text, reaction });
  }

  // Admin controls
  adminMuteUser(targetUserId: string, muteState: boolean) {
    this.socket?.emit('admin_mute_user', { targetUserId, muteState });
  }

  adminKickUser(targetUserId: string, reason?: string) {
    this.socket?.emit('admin_kick_user', { targetUserId, reason });
  }

  adminToggleLock(isLocked: boolean) {
    this.socket?.emit('admin_toggle_lock', { isLocked });
  }

  // WebRTC Mesh audio implementation
  private async initiateWebRTCCall(targetUserId: string) {
    try {
      const pc = this.createPeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket?.emit('webrtc_signal', {
        targetUserId,
        signal: { type: 'offer', sdp: offer },
      });
    } catch (err) {
      console.warn('[WebRTC] Error initiating call to', targetUserId, err);
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localAudioStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket?.emit('webrtc_signal', {
          targetUserId: peerId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      let audioEl = this.remoteAudioElements.get(peerId);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        this.remoteAudioElements.set(peerId, audioEl);
      }
      audioEl.srcObject = stream;
      audioEl.play().catch((e) => console.warn('[Audio] Autoplay handled:', e));
    };

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  private async handleWebRTCSignal(fromUserId: string, signal: any) {
    try {
      let pc = this.peerConnections.get(fromUserId);
      if (!pc) {
        pc = this.createPeerConnection(fromUserId);
      }

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket?.emit('webrtc_signal', {
          targetUserId: fromUserId,
          signal: { type: 'answer', sdp: answer },
        });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.warn('[WebRTC] Signal handling error:', err);
    }
  }

  private closePeerConnection(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    const audioEl = this.remoteAudioElements.get(peerId);
    if (audioEl) {
      audioEl.srcObject = null;
      this.remoteAudioElements.delete(peerId);
    }
  }

  private handleBroadcastMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'tab_peer_face_data' && msg.userId !== this.currentUser?.id) {
      if (this.onPeerFaceData) {
        this.onPeerFaceData(msg.userId, msg.features);
      }
    }
  }

  cleanup() {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.remoteAudioElements.forEach((el) => {
      el.srcObject = null;
    });
    this.remoteAudioElements.clear();

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentUser = null;
    this.currentRoom = null;
  }
}

export const networkServiceSingleton = new NetworkService();
