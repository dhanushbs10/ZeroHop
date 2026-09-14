import http from "node:http";
import { randomBytes } from "node:crypto";

import cors from "cors";
import express, { type Express } from "express";
import { Server, type Socket } from "socket.io";

import {
  PROTOCOL_VERSION,
  ROOM_CAPACITY,
  ROOM_CODE_PATTERN,
  type PeerId,
  type PeerInfo,
  type PeerOfferRequest,
  type PeerAnswerRequest,
  type PeerIceCandidateRequest,
  type PresenceUpdateEvent,
  type PresenceUpdateRequest,
  type RemoteAnswerEvent,
  type RemoteIceCandidateEvent,
  type RemoteOfferEvent,
  type RoomCode,
  type RoomCreateRequest,
  type RoomCreatedResponse,
  type RoomInfo,
  type RoomJoinRequest,
  type RoomJoinedResponse,
  type RoomLeaveRequest,
  type RoomPeerJoinedEvent,
  type RoomPeerLeftEvent,
  type SignalingError,
  type SignalingErrorCode,
} from "../src/lib/types/protocol";

const PORT = Number(process.env.SIGNALING_PORT ?? 3001);
const ROOM_TTL_MS = 30 * 60 * 1000;
const DEBUG_LOGS = process.env.SIGNALING_DEBUG === "1";

function debugLog(message: string, details?: Record<string, unknown>): void {
  if (DEBUG_LOGS) {
    console.log(message, details);
  }
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

interface Room {
  roomCode: RoomCode;
  createdAt: number;
  expiresAt: number;
  peers: Map<PeerId, PeerInfo>;
  sockets: Map<PeerId, Socket>;
}

interface Registration {
  roomCode: RoomCode;
  peer: PeerInfo;
}

const rooms = new Map<RoomCode, Room>();
const registrations = new Map<string, Registration>();

function emitError(
  socket: Socket,
  code: SignalingErrorCode,
  message: string
): void {
  const error: SignalingError = { code, message };
  socket.emit("error", error);
}

function generateRoomCode(): RoomCode {
  let code = "";
  do {
    const bytes = randomBytes(8);
    code = Array.from(
      bytes,
      (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function resolveRoom(socket: Socket, roomCode: RoomCode): Room | null {
  const room = rooms.get(roomCode);
  if (!room) {
    emitError(socket, "ROOM_NOT_FOUND", "Room not found.");
    return null;
  }
  if (Date.now() > room.expiresAt) {
    rooms.delete(roomCode);
    emitError(socket, "ROOM_EXPIRED", "Room has expired.");
    return null;
  }
  return room;
}

function toRoomInfo(room: Room): RoomInfo {
  return {
    roomCode: room.roomCode,
    peers: Array.from(room.peers.values()),
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
  };
}

function relayToPeer(
  socket: Socket,
  roomCode: RoomCode,
  targetPeerId: PeerId,
  event: "peer:offer" | "peer:answer" | "peer:ice-candidate",
  makePayload: (
    fromPeerId: PeerId
  ) => RemoteOfferEvent | RemoteAnswerEvent | RemoteIceCandidateEvent
): void {
  const room = resolveRoom(socket, roomCode);
  if (!room) return;
  const target = room.sockets.get(targetPeerId);
  if (!target) {
    emitError(socket, "PEER_NOT_FOUND", "Target peer is not in this room.");
    return;
  }
  debugLog(
    `[server] relaying ${event} from ${socket.id} to ${targetPeerId}`
  );
  target.emit(event, makePayload(socket.id));
}

function removePeer(socket: Socket, reason: "manual" | "disconnect" | "timeout"): void {
  const registration = registrations.get(socket.id);
  if (!registration) return;
  const { roomCode, peer } = registration;
  registrations.delete(socket.id);

  const room = rooms.get(roomCode);
  if (!room) return;

  room.peers.delete(peer.peerId);
  room.sockets.delete(peer.peerId);
  socket.leave(roomCode);

  const peerLeft: RoomPeerLeftEvent = { peerId: peer.peerId, reason };
  for (const otherSocket of room.sockets.values()) {
    otherSocket.emit("room:peer-left", peerLeft);
  }
  socket.emit("room:left", { roomCode, reason });

  if (room.peers.size === 0) {
    rooms.delete(roomCode);
  }
}

const app: Express = express();
app.use(cors({ origin: true }));
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
  },
});

io.on("connection", (socket: Socket) => {
  socket.on("room:create", (payload: RoomCreateRequest) => {
    debugLog("[server] room:create", { socket: socket.id });
    if (registrations.has(socket.id)) {
      emitError(socket, "ALREADY_IN_ROOM", "This connection is already in a room.");
      return;
    }
    if (payload?.clientProtocolVersion !== PROTOCOL_VERSION) {
      emitError(
        socket,
        "PROTOCOL_VERSION_MISMATCH",
        "Client protocol version is not supported."
      );
      return;
    }

    const roomCode = generateRoomCode();
    const now = Date.now();
    const peer: PeerInfo = {
      peerId: socket.id,
      role: "sender",
      presenceStatus: "online",
    };
    const room: Room = {
      roomCode,
      createdAt: now,
      expiresAt: now + ROOM_TTL_MS,
      peers: new Map([[socket.id, peer]]),
      sockets: new Map([[socket.id, socket]]),
    };

    rooms.set(roomCode, room);
    registrations.set(socket.id, { roomCode, peer });
    socket.join(roomCode);

    const response: RoomCreatedResponse = {
      room: toRoomInfo(room),
      selfPeerId: socket.id,
    };
    socket.emit("room:created", response);
  });

  socket.on("room:join", (payload: RoomJoinRequest) => {
    debugLog("[server] room:join", {
      roomCode: payload.roomCode,
      socket: socket.id,
      role: payload.role,
    });
    if (registrations.has(socket.id)) {
      emitError(socket, "ALREADY_IN_ROOM", "This connection is already in a room.");
      return;
    }
    if (typeof payload?.roomCode !== "string" || !ROOM_CODE_PATTERN.test(payload.roomCode)) {
      emitError(socket, "INVALID_ROOM_CODE", "Room code is not valid.");
      return;
    }

    const room = rooms.get(payload.roomCode);
    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND", "Room not found.");
      return;
    }
    if (room.peers.size >= ROOM_CAPACITY) {
      emitError(socket, "ROOM_FULL", "Room is already full.");
      return;
    }
    if (Date.now() > room.expiresAt) {
      rooms.delete(room.roomCode);
      emitError(socket, "ROOM_EXPIRED", "Room has expired.");
      return;
    }

    const peer: PeerInfo = {
      peerId: socket.id,
      role: payload.role ?? "receiver",
      presenceStatus: "online",
      displayName: payload.displayName,
    };
    room.peers.set(socket.id, peer);
    room.sockets.set(socket.id, socket);
    registrations.set(socket.id, { roomCode: room.roomCode, peer });
    socket.join(room.roomCode);

    const response: RoomJoinedResponse = {
      room: toRoomInfo(room),
      selfPeerId: socket.id,
    };
    socket.emit("room:joined", response);

    const peerJoined: RoomPeerJoinedEvent = { peer };
    for (const [peerId, otherSocket] of room.sockets) {
      if (peerId !== socket.id) {
        otherSocket.emit("room:peer-joined", peerJoined);
      }
    }
  });

  socket.on("room:leave", (payload: RoomLeaveRequest) => {
    debugLog("[server] room:leave", {
      roomCode: payload?.roomCode,
      reason: payload?.reason,
      socket: socket.id,
    });
    removePeer(socket, payload?.reason ?? "manual");
  });

  socket.on("peer:offer", (payload: PeerOfferRequest) => {
    debugLog("[server] peer:offer", {
      roomCode: payload.roomCode,
      from: socket.id,
      to: payload.targetPeerId,
      type: payload.sessionDescription.type,
    });
    relayToPeer(socket, payload.roomCode, payload.targetPeerId, "peer:offer", (fromPeerId) => ({
      fromPeerId,
      sessionDescription: payload.sessionDescription,
    }));
  });

  socket.on("peer:answer", (payload: PeerAnswerRequest) => {
    debugLog("[server] peer:answer", {
      roomCode: payload.roomCode,
      from: socket.id,
      to: payload.targetPeerId,
      type: payload.sessionDescription.type,
    });
    relayToPeer(socket, payload.roomCode, payload.targetPeerId, "peer:answer", (fromPeerId) => ({
      fromPeerId,
      sessionDescription: payload.sessionDescription,
    }));
  });

  socket.on("peer:ice-candidate", (payload: PeerIceCandidateRequest) => {
    debugLog("[server] peer:ice-candidate", {
      roomCode: payload.roomCode,
      from: socket.id,
      to: payload.targetPeerId,
    });
    relayToPeer(
      socket,
      payload.roomCode,
      payload.targetPeerId,
      "peer:ice-candidate",
      (fromPeerId) => ({ fromPeerId, candidate: payload.candidate })
    );
  });

  socket.on("presence:update", (payload: PresenceUpdateRequest) => {
    debugLog("[server] presence:update", {
      roomCode: payload.roomCode,
      socket: socket.id,
      status: payload.status,
    });
    const registration = registrations.get(socket.id);
    if (!registration) return;
    const room = resolveRoom(socket, registration.roomCode);
    if (!room) return;
    const peer = room.peers.get(socket.id);
    if (!peer) return;
    peer.presenceStatus = payload.status;

    const event: PresenceUpdateEvent = {
      peerId: socket.id,
      status: payload.status,
    };
    for (const [peerId, otherSocket] of room.sockets) {
      if (peerId !== socket.id) {
        otherSocket.emit("presence:update", event);
      }
    }
  });

  socket.on("disconnect", () => {
    debugLog("[server] disconnect", { socket: socket.id });
    removePeer(socket, "disconnect");
  });
});

server.listen(PORT, () => {
  console.log(`[zerohop] signaling server listening on http://localhost:${PORT}`);
});