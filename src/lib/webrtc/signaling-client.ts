import { io, Socket } from "socket.io-client";

import {
  PROTOCOL_VERSION,
  type ClientToServerSignaling,
  type PeerAnswerRequest,
  type PeerIceCandidateRequest,
  type PeerOfferRequest,
  type PresenceUpdateRequest,
  type RoomJoinRequest,
  type RoomLeaveRequest,
  type ServerToClientSignaling,
} from "@/lib/types/protocol";

export type SignalingSocket = Socket<
  ServerToClientSignaling,
  ClientToServerSignaling
>;

export interface SignalingClient {
  socket: SignalingSocket;
  createRoom: () => void;
  joinRoom: (request: RoomJoinRequest) => void;
  leaveRoom: (request: RoomLeaveRequest) => void;
  sendOffer: (request: PeerOfferRequest) => void;
  sendAnswer: (request: PeerAnswerRequest) => void;
  sendIceCandidate: (request: PeerIceCandidateRequest) => void;
  updatePresence: (request: PresenceUpdateRequest) => void;
}

function requireSignalingUrl(): string {
  const url = process.env.NEXT_PUBLIC_SIGNALING_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SIGNALING_URL is not set. Add it to .env.local before starting a session."
    );
  }
  return url;
}

export function initializeSignaling(): SignalingClient {
  const url = requireSignalingUrl();
  const socket: SignalingSocket = io(url, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 15000,
  });

  return {
    socket,
    createRoom() {
      socket.emit("room:create", { clientProtocolVersion: PROTOCOL_VERSION });
    },
    joinRoom(request) {
      socket.emit("room:join", {
        ...request,
        clientProtocolVersion: PROTOCOL_VERSION,
      });
    },
    leaveRoom(request) {
      socket.emit("room:leave", request);
    },
    sendOffer(request) {
      socket.emit("peer:offer", request);
    },
    sendAnswer(request) {
      socket.emit("peer:answer", request);
    },
    sendIceCandidate(request) {
      socket.emit("peer:ice-candidate", request);
    },
    updatePresence(request) {
      socket.emit("presence:update", request);
    },
  };
}