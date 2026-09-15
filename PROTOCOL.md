# DropLink Communication Protocol

Status: draft. Version: 1.

Scope: this document specifies the contract between the DropLink browser client, the signaling server, and the WebRTC peer. It defines message shapes and data layouts only. It intentionally contains no implementation logic.

## 1. Transport overview

| Layer | Transport | Route | Carries |
| --- | --- | --- | --- |
| Signaling | Socket.IO over WebSocket | client to signaling server | Room lifecycle, SDP offers and answers, ICE candidates, presence updates, errors |
| Data | WebRTC DataChannel (SCTP over DTLS) | peer to peer | Text messages and binary file chunks |

Rules:

- Every client announces `clientProtocolVersion` on `room:create`. A mismatch is answered with `PROTOCOL_VERSION_MISMATCH`.
- The signaling server is a rendezvous and message relay for lifecycle and negotiation only. It never receives text payloads, file payloads, or the share token.
- File and text payloads travel only on the DataChannel. A TURN relay may forward them as opaque bytes, never as readable data.

## 2. Signaling protocol

### 2.1 Identity and roles

| Symbol | Type | Description |
| --- | --- | --- |
| `PeerId` | string | Opaque id assigned by the server per socket connection |
| `RoomCode` | string | Public code used to address a room in signaling. It is not a secret |
| `PeerRole` | `sender` \| `receiver` | Assigned by `room:join` |
| `PresenceStatus` | `online` \| `idle` | Drives the Buddy system |

### 2.2 Client to server events

| Event | Payload | When |
| --- | --- | --- |
| `room:create` | `{ clientProtocolVersion }` | Before negotiation. Server assigns `roomCode` and `selfPeerId` |
| `room:join` | `{ roomCode, role, displayName?, resumeToken? }` | Second peer joins a created room |
| `room:leave` | `{ roomCode, reason }` | Manual leave. `reason` is `manual`, `disconnect`, or `timeout` |
| `peer:offer` | `{ roomCode, targetPeerId, sessionDescription }` | Sender offers SDP to the receiver |
| `peer:answer` | `{ roomCode, targetPeerId, sessionDescription }` | Receiver answers the offer |
| `peer:ice-candidate` | `{ roomCode, targetPeerId, candidate }` | Trickle ICE candidate |
| `presence:update` | `{ roomCode, status }` | Local user gained or lost focus |

### 2.3 Server to client events

| Event | Payload | When |
| --- | --- | --- |
| `room:created` | `{ room, selfPeerId }` | Sender created a room |
| `room:joined` | `{ room, selfPeerId }` | Peer joined an existing room |
| `room:peer-joined` | `{ peer }` | A peer entered the room |
| `room:peer-left` | `{ peerId, reason }` | A peer left the room |
| `room:left` | `{ roomCode, reason }` | Confirmation of a local leave |
| `peer:offer` | `{ fromPeerId, sessionDescription }` | Forwarded SDP offer |
| `peer:answer` | `{ fromPeerId, sessionDescription }` | Forwarded SDP answer |
| `peer:ice-candidate` | `{ fromPeerId, candidate }` | Forwarded ICE candidate |
| `presence:update` | `{ peerId, status }` | Buddy status changed |
| `error` | `{ code, message, context? }` | Any signaling failure |

### 2.4 Room lifecycle

1. The sender creates a room. The server returns `roomCode` and a fresh `PeerId`.
2. The sender builds a share URL that embeds `roomCode` plus the secret `shareToken` in the URL fragment.
3. The receiver opens the share URL, reads `roomCode` and `shareToken` from the fragment, and joins with `room:join`.
4. A third join attempt is rejected with `ROOM_FULL`.
5. When both peers are present they negotiate WebRTC (section 3). Once the DataChannels open, transfer begins (section 4).
6. Either peer may leave. The remaining peer receives `room:peer-left` and must tear down the DataChannel.

### 2.5 Error model

| Code | Meaning |
| --- | --- |
| `PROTOCOL_VERSION_MISMATCH` | Client announced a different protocol version |
| `ROOM_NOT_FOUND` | The room code does not exist or is unknown |
| `ROOM_FULL` | The room already holds the maximum two peers |
| `ROOM_EXPIRED` | The room passed its `expiresAt` time |
| `ALREADY_IN_ROOM` | The peer tried to join a room twice |
| `PEER_NOT_FOUND` | `targetPeerId` is not present in the room |
| `INVALID_ROOM_CODE` | Room code failed format validation |
| `INVALID_MESSAGE` | Payload failed schema validation |
| `SIGNALING_TIMEOUT` | A peer did not respond in time |
| `SERVER_ERROR` | Unclassified server failure |

Example error doc:

```json
{
  "code": "ROOM_FULL",
  "message": "The room already has two peers.",
  "context": { "roomCode": "M7K2Q9XW" }
}
```

## 3. WebRTC negotiation

- Offers flow sender to receiver. Answers flow receiver to sender.
- Trickle ICE is used. Candidates are forwarded through `peer:ice-candidate` as soon as `onicecandidate` fires.
- The perfect negotiation pattern is required to resolve offer/answer races. The sender is the polite peer.
- No media tracks are negotiated. The handshake exists only to open the two DataChannels in section 4.1.
- The signaling server passes SDP and ICE payloads through unchanged.

## 4. DataChannel protocol

### 4.1 Channels

| Channel | Label | ordered | reliable | Carries |
| --- | --- | --- | --- | --- |
| Control | `droplink-control` | true | true | JSON control messages |
| File | `droplink-file` | false | true | Binary chunk frames |

- The control channel is mandatory and is opened first. The file channel is opened lazily before the first `file-start`.
- A control channel message is exactly one JSON value per DataChannel message, encoded UTF-8, capped at `CONTROL_MAX_BYTES` (16 KB).
- An unknown `kind` is dropped and logged. It never terminates the channel.

### 4.2 Cipher envelope on the wire

Every JSON write on the control channel is a `CipherEnvelope`:

```json
{
  "v": 1,
  "nonce": "<base64url, 12 bytes>",
  "ciphertext": "<base64url, ciphertext plus 16-byte GCM tag>"
}
```

The decrypted plaintext is one `ControlMessage` JSON value (section 4.3).

Rationale: the application layer AEAD keeps text and metadata unreadable to a compromised signaling server, to a TURN relay, and to any entity that captures relayed traffic. DTLS protects the transport; the envelope adds a protocol level boundary.

### 4.3 Control messages (decrypted plaintext)

`ControlMessage` is a discriminated union on `kind`.

| kind | Direction | Payload | Purpose |
| --- | --- | --- | --- |
| `text-message` | sender to receiver | `{ messageId, text }` | Instant text share. `text` capped at `TEXT_MAX_BYTES` |
| `text-message-ack` | receiver to sender | `{ messageId }` | Confirms a stored and rendered text message |
| `file-start` | sender to receiver | `{ fileId, fileName, fileSize, mimeType, totalChunks }` | Announces a file transfer |
| `file-start-ack` | receiver to sender | `{ fileId }` | Confirms the receiver is ready and deduplicated |
| `file-ack` | receiver to sender | `{ fileId, chunkIndex }` | Confirms a validated chunk. Basis for resume |
| `file-resume-req` | receiver to sender | `{ fileId, missingChunks }` | Requests missing chunks after a reconnect |
| `file-end` | sender to receiver | `{ fileId, chunksVerified, checksum? }` | Transfer completion signal |
| `file-end-ack` | receiver to sender | `{ fileId }` | Confirms local flush of the received file |

Examples:

```json
{ "kind": "text-message", "messageId": "t-1", "text": "hello" }
```

```json
{
  "kind": "file-start",
  "fileId": 0,
  "fileName": "bay-of-fundy.mp4",
  "fileSize": 3465678901,
  "mimeType": "video/mp4",
  "totalChunks": 205123
}
```

### 4.4 Binary file chunk frame

A chunk is raw binary, never JSON. Layout:

| Offset | Size | Field | Encoding |
| --- | --- | --- | --- |
| 0 | 4 | `fileId` | uint32, big-endian |
| 4 | 4 | `chunkIndex` | uint32, big-endian |
| 8 | 1 to 16384 | payload | encrypted bytes plus 16-byte GCM tag |

- Maximum frame size is 8 plus 16384, or 16392 bytes, well below the browser DataChannel message limit.
- The header stays plaintext because the receiver must route `(fileId, chunkIndex)` before decryption.
- Every payload is exactly `MAX_FILE_CHUNK_SIZE` bytes except the last. The last is at least 1 byte.
- `totalChunks = ceil(fileSize / MAX_FILE_CHUNK_SIZE)`.
- Last chunk length = `fileSize - (totalChunks - 1) * MAX_FILE_CHUNK_SIZE`.
- The sender must copy payload into a single contiguous ArrayBuffer with the header.
- On receive, a Blob-backed message must be converted to an ArrayBuffer before parsing.
- The receiver rejects a frame when `chunkIndex >= totalChunks`, when the payload is empty, or when aggregate decoded bytes would exceed `fileSize`.

Example: a 33,000 byte file with 16 KB chunks is sent as 3 frames of payload sizes 16384, 16384, and 232.

### 4.5 Text message flow

1. Sender encrypts `text-message` and sends a `CipherEnvelope` on the control channel.
2. Receiver decrypts, stores and renders, then replies `text-message-ack`.

### 4.6 File transfer flow

1. Sender emits `file-start`. Receiver validates and replies `file-start-ack`.
2. Sender opens the file channel and iterates `chunkIndex` from 0 to `totalChunks - 1`.
3. Receiver replies `file-ack` for every validated chunk. Acks may be coalesced by the transport, but the type stays per-chunk.
4. On completion the sender emits `file-end`.
5. After a reconnect, the receiver emits `file-resume-req` with the missing chunk list, and the sender retransmits exactly those chunks. The retransmit re-encrypts identical bytes with the same deterministic nonce, so the output is byte-identical and idempotent.

### 4.7 Presence (Buddy system)

- Status updates flow through signaling events in section 2.
- `idle` is announced when the local tab loses focus. `online` is announced on focus restore.
- The remote peer badge derives from the last `presence:update` it received.

## 5. Security and encryption flow

### 5.1 Key generation and the URL fragment

- The sender generates `shareToken` as 32 random bytes (256 bit), base64url encoded.
- Share URL shape: `https://droplink.app/receive#!/join/<roomCode>?t=<shareToken>`. The fragment content is the contract; the exact route prefix is not.
- Browsers never send the URL fragment to any server. The signaling server and analytics can see `roomCode` but never `shareToken`.
- `roomCode` and `shareToken` are distinct: the code routes signaling, and the token derives the encryption key.

### 5.2 Key derivation

- HKDF-SHA256 with IKM equal to the raw `shareToken` bytes, salt `"droplink-signal-v1"`, and info `"droplink-aes-256-gcm-v1"`.
- Output length is 32 bytes, the AES-256-GCM key.
- The key exists only in the browser and never appears in any signaling or control message.

### 5.3 AEAD nonce rules

- Text and serialized control messages use a random 12-byte nonce carried inside the envelope.
- File chunks use a deterministic 12-byte nonce: `uint32BE(fileId) || uint32BE(chunkIndex) || 0x00000000`.
- `fileId` is strictly increasing and never reused for the lifetime of a connection, which keeps chunk nonces unique.
- The GCM authentication tag is 16 bytes, appended to the ciphertext.
- Re-sending the same chunk reuses the same nonce and plaintext, so ciphertext stays identical: safe and resume-friendly.

### 5.4 Threat model

- Signaling server: sees room lifecycle and negotiation metadata only.
- TURN relay: sees ciphertext bytes only.
- Because of the application layer AEAD, captured relayed traffic cannot be decrypted without the share token.
- The signaling server can suppress or drop a transfer, but it cannot read or forge payloads.

## 6. Constants

| Constant | Value | Meaning |
| --- | --- | --- |
| `PROTOCOL_VERSION` | 1 | Signaling version |
| `ROOM_CAPACITY` | 2 | One sender, one receiver |
| `MAX_FILE_CHUNK_SIZE` | 16384 | Chunk payload cap, 16 KB |
| `FILE_CHUNK_HEADER_BYTES` | 8 | 4-byte `fileId` plus 4-byte `chunkIndex` |
| `MAX_CHUNK_FRAME_SIZE` | 16392 | Header plus a full chunk payload |
| `CONTROL_MAX_BYTES` | 16384 | Control JSON cap |
| `TEXT_MAX_BYTES` | 8192 | Text message cap |
| `GCM_TAG_BYTES` | 16 | GCM authentication tag length |
| `GCM_NONCE_BYTES` | 12 | Nonce length |
| `AES_256_KEY_BYTES` | 32 | Derived key length |