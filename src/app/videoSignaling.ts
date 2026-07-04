import { io } from 'socket.io-client';
import { API_URL } from '../config';

// Dedicated socket for video signalling.
const socket = io(API_URL);

export const joinCallRoom = (room: string) => {
  if (!room) return;
  socket.emit('join_call_room', { room });
};

export const leaveCallRoom = (room: string) => {
  if (!room) return;
  socket.emit('leave_call', { room });
};

export const sendOffer = (room: string, sdp: RTCSessionDescriptionInit) => {
  socket.emit('call_offer', { room, sdp });
};

export const sendAnswer = (room: string, sdp: RTCSessionDescriptionInit) => {
  socket.emit('call_answer', { room, sdp });
};

export const sendIceCandidate = (room: string, candidate: RTCIceCandidateInit) => {
  socket.emit('ice_candidate', { room, candidate });
};

export const onOffer = (cb: (payload: { sdp: RTCSessionDescriptionInit; sender: string }) => void) => {
  socket.on('call_offer', cb);
};

export const onAnswer = (cb: (payload: { sdp: RTCSessionDescriptionInit; sender: string }) => void) => {
  socket.on('call_answer', cb);
};

export const onIceCandidate = (cb: (payload: { candidate: RTCIceCandidateInit; sender: string }) => void) => {
  socket.on('ice_candidate', cb);
};

export const onIceServers = (cb: (servers: RTCIceServer[]) => void) => {
  socket.on('ice_servers', cb);
};

export const offAll = () => {
  socket.off('call_offer');
  socket.off('call_answer');
  socket.off('ice_candidate');
  socket.off('ice_servers');
};
