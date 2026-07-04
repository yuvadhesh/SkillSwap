import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../../config';

interface VideoCallProps {
  roomName: string;
  subject: string;
  partnerName: string;
  onLeave: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const VideoCall: React.FC<VideoCallProps> = ({ roomName, subject, partnerName, onLeave }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isInitiatorRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');

  // Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [remoteHandRaised, setRemoteHandRaised] = useState(false);

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  // ─── Peer Connection ───────────────────────────────────────────────────────
  const createPeerConnection = useCallback((iceServers: RTCIceServer[]) => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit('ice_candidate', { room: roomName, candidate: e.candidate.toJSON() });
      }
    };

    pc.ontrack = (e) => {
      const [remoteStream] = e.streams;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        setStatus('connected');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('connected');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('connecting');
      }
    };

    return pc;
  }, [roomName]);

  // ─── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (socketRef.current) {
      socketRef.current.emit('leave_call', { room: roomName });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [roomName]);

  // ─── Main Effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        // 1. Get media with fallbacks
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          try { stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); }
          catch { stream = null; }
        }

        if (cancelled) { stream?.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        if (stream && localVideoRef.current) localVideoRef.current.srcObject = stream;

        // 2. Connect socket
        const socket = io(API_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => socket.emit('join_call_room', { room: roomName }));

        let receivedIceServers: RTCIceServer[] | null = null;
        let isInitiator = false;
        const pendingCandidates: RTCIceCandidateInit[] = [];

        const setupPC = (iceServers: RTCIceServer[]) => {
          if (pcRef.current) return pcRef.current;
          const pc = createPeerConnection(iceServers);
          pcRef.current = pc;
          stream?.getTracks().forEach(track => pc.addTrack(track, stream!));
          return pc;
        };

        const sendOffer = async () => {
          if (!receivedIceServers) return;
          const pc = setupPC(receivedIceServers);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('call_offer', { room: roomName, sdp: pc.localDescription });
        };

        socket.on('ice_servers', (servers: RTCIceServer[]) => {
          if (cancelled) return;
          receivedIceServers = servers?.length > 0 ? servers : ICE_SERVERS;
          if (!isInitiator) setupPC(receivedIceServers);
        });

        socket.on('room_joined', ({ isInitiator: init }: { isInitiator: boolean }) => {
          isInitiator = init;
          isInitiatorRef.current = init;
          if (!init && receivedIceServers) setupPC(receivedIceServers);
        });

        socket.on('user_joined', () => { if (isInitiator) sendOffer(); });

        socket.on('call_offer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
          if (cancelled || !receivedIceServers) return;
          const pc = setupPC(receivedIceServers);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          for (const c of pendingCandidates) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          pendingCandidates.length = 0;
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call_answer', { room: roomName, sdp: pc.localDescription });
        });

        socket.on('call_answer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
          if (!pcRef.current) return;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          for (const c of pendingCandidates) await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          pendingCandidates.length = 0;
        });

        socket.on('ice_candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
          const pc = pcRef.current;
          if (!pc) return;
          if (!pc.remoteDescription) { pendingCandidates.push(candidate); return; }
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        });

        // ─── In-call chat ──────────────────────────────────────────────────
        socket.on('call_chat', ({ text, time }: { text: string; time: string }) => {
          setChatMessages(prev => [...prev, { id: Date.now().toString(), sender: 'them', text, time }]);
          setUnreadCount(prev => (showChat ? 0 : prev + 1));
        });

        // ─── Hand raise ────────────────────────────────────────────────────
        socket.on('hand_raise', ({ raised }: { raised: boolean }) => {
          setRemoteHandRaised(raised);
        });

        socket.on('user_left', () => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          setStatus('connecting');
          setRemoteHandRaised(false);
        });

        socket.on('connect_error', err => console.error('Socket error:', err));

      } catch (err: any) {
        if (cancelled) return;
        setErrorMsg(err?.message || 'Failed to start call.');
        setStatus('error');
      }
    };

    start();
    return () => { cancelled = true; cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Clear unread when chat opened
  useEffect(() => {
    if (showChat) setUnreadCount(0);
  }, [showChat]);

  // ─── Controls ─────────────────────────────────────────────────────────────
  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCamOff(c => !c);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen share, revert to camera
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack && pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      }
      if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        // Replace video track in peer connection
        if (pcRef.current) {
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        }
        // Show screen in local preview
        if (localVideoRef.current) {
          const previewStream = new MediaStream([screenTrack]);
          localVideoRef.current.srcObject = previewStream;
        }
        // When screen share ends naturally
        screenTrack.onended = () => {
          screenStreamRef.current = null;
          const videoTrack = localStreamRef.current?.getVideoTracks()[0];
          if (videoTrack && pcRef.current) {
            const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack);
          }
          if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
          setIsScreenSharing(false);
        };
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Screen share error:', err);
      }
    }
  };

  const toggleHandRaise = () => {
    const newVal = !handRaised;
    setHandRaised(newVal);
    socketRef.current?.emit('hand_raise', { room: roomName, raised: newVal });
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text || !socketRef.current) return;
    const time = timeNow();
    socketRef.current.emit('call_chat', { room: roomName, text, time });
    setChatMessages(prev => [...prev, { id: Date.now().toString(), sender: 'me', text, time }]);
    setChatInput('');
    chatInputRef.current?.focus();
  };

  // ─── Error UI ─────────────────────────────────────────────────────────────
  if (status === 'error') {
    const isDeviceInUse = errorMsg?.toLowerCase().includes('in use') || errorMsg?.toLowerCase().includes('notreadable');
    return (
      <div className="flex-1 bg-zinc-950 flex flex-col items-center justify-center text-white gap-5 px-6 text-center">
        <div className="text-5xl">{isDeviceInUse ? '📷' : '⚠️'}</div>
        <div>
          <p className="text-white font-semibold text-base mb-1">
            {isDeviceInUse ? 'Camera/Mic already in use' : 'Could not start video call'}
          </p>
          <p className="text-zinc-400 text-sm max-w-xs">
            {isDeviceInUse ? 'Close other apps/tabs using the camera and retry.' : (errorMsg || 'An error occurred.')}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onLeave} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition">Cancel</button>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition">Retry</button>
        </div>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-950 relative">
      {/* Remote video */}
      <div className="flex-1 relative">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

        {/* Waiting overlay */}
        {status === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-zinc-700 border-t-indigo-500 animate-spin" />
            <div className="text-center">
              <p className="text-white font-semibold">Waiting for {partnerName}…</p>
              <p className="text-zinc-500 text-sm mt-1">Share the room link to invite them</p>
            </div>
          </div>
        )}

        {/* Remote hand raised */}
        {remoteHandRaised && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-black text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-2 animate-bounce">
            ✋ {partnerName} raised their hand
          </div>
        )}

        {/* My hand raised indicator */}
        {handRaised && (
          <div className="absolute top-4 left-4 bg-yellow-400/90 text-black text-xs font-bold px-3 py-1 rounded-full">
            ✋ Hand Raised
          </div>
        )}

        {/* Local video PiP */}
        <div className="absolute bottom-24 right-4 w-32 h-24 sm:w-40 sm:h-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-800">
          {isCamOff ? (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400">
              <span className="text-3xl">🚫</span>
            </div>
          ) : (
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          )}
          <div className="absolute bottom-1 left-1 text-[9px] text-white/60 bg-black/40 px-1 rounded">You</div>
        </div>

        {/* Left Sidebar Controls */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center justify-center gap-4 px-4 py-4"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.85), transparent)' }}>

          {/* Mic */}
          <ControlBtn
            active={!isMuted}
            activeIcon="🎤"
            inactiveIcon="🔇"
            activeLabel="Mute"
            inactiveLabel="Unmute"
            danger={isMuted}
            onClick={toggleMute}
          />

          {/* Camera */}
          <ControlBtn
            active={!isCamOff}
            activeIcon="📹"
            inactiveIcon="📷"
            activeLabel="Stop Video"
            inactiveLabel="Start Video"
            danger={isCamOff}
            onClick={toggleCam}
          />

          {/* Screen Share */}
          <ControlBtn
            active={!isScreenSharing}
            activeIcon="🖥️"
            inactiveIcon="🖥️"
            activeLabel="Share Screen"
            inactiveLabel="Stop Share"
            accent={isScreenSharing}
            onClick={toggleScreenShare}
          />

          {/* Hand Raise */}
          <ControlBtn
            active={!handRaised}
            activeIcon="✋"
            inactiveIcon="✋"
            activeLabel="Raise Hand"
            inactiveLabel="Lower Hand"
            accent={handRaised}
            onClick={toggleHandRaise}
          />

          {/* Chat */}
          <div className="relative">
            <ControlBtn
              active={true}
              activeIcon="💬"
              inactiveIcon="💬"
              activeLabel="Chat"
              inactiveLabel="Chat"
              accent={showChat}
              onClick={() => setShowChat(s => !s)}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>

          {/* End Call */}
          <button
            onClick={onLeave}
            className="flex flex-col items-center gap-1 group"
            title="End Call"
          >
            <div className="w-14 h-12 rounded-2xl bg-red-600 hover:bg-red-500 flex items-center justify-center text-2xl shadow-lg transition-all group-hover:scale-110">
              📵
            </div>
            <span className="text-[10px] text-zinc-400 group-hover:text-white transition">End</span>
          </button>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="w-72 flex flex-col bg-zinc-900 border-l border-zinc-800 flex-shrink-0">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-white font-semibold text-sm">In-call Chat</span>
            <button onClick={() => setShowChat(false)} className="text-zinc-400 hover:text-white text-lg leading-none">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {chatMessages.length === 0 ? (
              <div className="text-zinc-600 text-xs text-center mt-8">No messages yet.<br/>Say hi! 👋</div>
            ) : (
              chatMessages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'me'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-zinc-700 text-zinc-100 rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-zinc-600 mt-0.5 px-1">{msg.time}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-zinc-800 flex gap-2">
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
              placeholder="Type a message…"
              className="flex-1 bg-zinc-800 text-white text-sm rounded-xl px-3 py-2 outline-none placeholder-zinc-500 focus:ring-1 focus:ring-indigo-500 border border-zinc-700"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
              className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition text-base"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Control Button Component ────────────────────────────────────────────────
interface ControlBtnProps {
  active: boolean;
  activeIcon: string;
  inactiveIcon: string;
  activeLabel: string;
  inactiveLabel: string;
  danger?: boolean;
  accent?: boolean;
  onClick: () => void;
}

const ControlBtn: React.FC<ControlBtnProps> = ({ active, activeIcon, inactiveIcon, activeLabel, inactiveLabel, danger, accent, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 group" title={active ? activeLabel : inactiveLabel}>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-all group-hover:scale-110 ${
      danger ? 'bg-red-600 hover:bg-red-500' :
      accent ? 'bg-indigo-600 hover:bg-indigo-500' :
      'bg-zinc-700/80 hover:bg-zinc-600'
    }`}>
      {active ? activeIcon : inactiveIcon}
    </div>
    <span className="text-[10px] text-zinc-400 group-hover:text-white transition">
      {active ? activeLabel : inactiveLabel}
    </span>
  </button>
);

export default VideoCall;
