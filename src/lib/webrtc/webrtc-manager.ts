import {
  CONTROL_CHANNEL_LABEL,
  CONTROL_MESSAGE_KINDS,
  FILE_CHANNEL_LABEL,
  FILE_CHUNK_HEADER_BYTES,
  FILE_CHUNK_HEADER_OFFSET,
  FILE_CHUNK_INDEX_OFFSET,
  FILE_CHUNK_PAYLOAD_OFFSET,
  GCM_NONCE_BYTES,
  GCM_TAG_BYTES,
  type CipherEnvelope,
  type ControlMessage,
  type DataChannelLabel,
  type FileChunkFrame,
  type IceCandidate,
  type SessionDescription,
} from "@/lib/types/protocol";
import {
  decryptControlMessage,
  decryptPayload,
  encryptControlMessage,
  encryptPayload,
} from "@/lib/webrtc/crypto";

export interface SdpSignalHandlers {
  onOffer?: (description: SessionDescription) => void;
  onAnswer?: (description: SessionDescription) => void;
  onIceCandidate?: (candidate: IceCandidate) => void;
}

export interface WebRTCManagerOptions {
  initiator: boolean;
  encryptionKey?: CryptoKey | null;
  onSignal?: SdpSignalHandlers;
  onDataChannelOpen?: (label: DataChannelLabel) => void;
  onDataChannelClosed?: (label: DataChannelLabel) => void;
  onControlMessage?: (message: ControlMessage) => void;
  onChunkReceived?: (frame: FileChunkFrame) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onConnectionFailed?: (reason: string) => void;
  onInternalError?: (error: Error) => void;
  iceServers?: RTCIceServer[];
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

function parseControlMessage(data: string): ControlMessage {
  const message: unknown = JSON.parse(data);
  if (typeof message !== "object" || message === null) {
    throw new Error("Control message is not a JSON object");
  }
  const kind = (message as { kind?: unknown }).kind;
  if (
    typeof kind !== "string" ||
    !(CONTROL_MESSAGE_KINDS as readonly string[]).includes(kind)
  ) {
    throw new Error(`Unknown control message kind: ${String(kind)}`);
  }
  return message as ControlMessage;
}

function chunkNonce(fileId: number, chunkIndex: number): Uint8Array {
  const nonce = new Uint8Array(GCM_NONCE_BYTES);
  const view = new DataView(nonce.buffer);
  view.setUint32(0, fileId, false);
  view.setUint32(4, chunkIndex, false);
  return nonce;
}

async function parseChunkFrame(
  buffer: ArrayBuffer,
  encryptionKey: CryptoKey | null
): Promise<FileChunkFrame> {
  if (buffer.byteLength < FILE_CHUNK_PAYLOAD_OFFSET) {
    throw new Error("Chunk frame is shorter than its header");
  }
  const view = new DataView(buffer);
  const fileId = view.getUint32(FILE_CHUNK_HEADER_OFFSET, false);
  const chunkIndex = view.getUint32(FILE_CHUNK_INDEX_OFFSET, false);
  const ciphertext = buffer.slice(FILE_CHUNK_PAYLOAD_OFFSET);
  let payload = ciphertext;
  if (encryptionKey) {
    payload = await decryptPayload(
      encryptionKey,
      ciphertext,
      chunkNonce(fileId, chunkIndex).buffer as ArrayBuffer
    );
  }
  return { fileId, chunkIndex, payload };
}

async function toText(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof Blob) return data.text();
  return new TextDecoder().decode(data as ArrayBuffer);
}

async function toArrayBuffer(data: unknown): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Blob) return data.arrayBuffer();
  throw new Error("Chunk frame arrived with an unexpected payload type");
}

export class WebRTCManager {
  private readonly initiator: boolean;
  private readonly polite: boolean;
  private readonly options: WebRTCManagerOptions;
  private readonly pc: RTCPeerConnection;
  private readonly encryptionKey: CryptoKey | null;

  private controlChannel: RTCDataChannel | null = null;
  private fileChannel: RTCDataChannel | null = null;

  private sendQueue: Promise<void> = Promise.resolve();

  private makingOffer = false;
  private ignoreOffer = false;
  private reconnecting = false;

  constructor(options: WebRTCManagerOptions) {
    this.initiator = options.initiator;
    this.polite = !options.initiator;
    this.options = options;
    this.encryptionKey = options.encryptionKey ?? null;

    this.pc = new RTCPeerConnection({
      iceServers: options.iceServers ?? DEFAULT_ICE_SERVERS,
    });

    this.pc.onnegotiationneeded = () => {
      if (this.initiator) {
        void this.makeOffer();
      }
    };
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.options.onSignal?.onIceCandidate?.(event.candidate.toJSON());
      }
    };
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc.iceConnectionState;
      if (state === "disconnected" || state === "failed") {
        this.handleConnectionDrop();
      } else if (
        (state === "connected" || state === "completed") &&
        this.reconnecting
      ) {
        this.reconnecting = false;
        this.options.onReconnected?.();
      }
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === "failed") {
        this.options.onConnectionFailed?.("Peer connection failed");
      }
    };
    this.pc.ondatachannel = (event) => {
      this.attachChannel(event.channel);
    };
  }

  negotiate(): void {
    if (!this.initiator) return;
    if (!this.controlChannel) {
      this.createDataChannels();
    }
    void this.makeOffer();
  }

  private handleConnectionDrop(): void {
    if (this.pc.signalingState === "closed" || this.reconnecting) return;
    this.reconnecting = true;
    this.options.onReconnecting?.();
    if (this.initiator) {
      this.pc.restartIce();
      void this.makeOffer();
    }
  }

  async handleRemoteDescription(description: SessionDescription): Promise<void> {
    const offerCollision =
      description.type === "offer" &&
      (this.makingOffer || this.pc.signalingState !== "stable");
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;
    try {
      await this.pc.setRemoteDescription(description);
      if (description.type === "offer") {
        await this.pc.setLocalDescription();
        const local = this.pc.localDescription;
        if (local) {
          this.options.onSignal?.onAnswer?.(local.toJSON());
        }
      }
    } catch (error) {
      this.reportError(error);
    }
  }

  async handleIceCandidate(candidate: IceCandidate): Promise<void> {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      return;
    }
  }

  async sendControlMessage(message: ControlMessage): Promise<boolean> {
    const channel = this.controlChannel;
    if (!channel || channel.readyState !== "open") return false;

    const task = async (): Promise<void> => {
      if (!this.encryptionKey) {
        channel.send(JSON.stringify(message));
        return;
      }
      const envelope = await encryptControlMessage(
        this.encryptionKey,
        JSON.stringify(message)
      );
      channel.send(JSON.stringify(envelope));
    };

    const scheduled = this.sendQueue.then(task);
    this.sendQueue = scheduled.catch(() => undefined);
    try {
      await scheduled;
      return true;
    } catch {
      return false;
    }
  }

  async sendChunk(frame: FileChunkFrame): Promise<boolean> {
    const channel = this.fileChannel;
    if (!channel || channel.readyState !== "open") return false;

    const header = new Uint8Array(FILE_CHUNK_HEADER_BYTES);
    const view = new DataView(header.buffer);
    view.setUint32(FILE_CHUNK_HEADER_OFFSET, frame.fileId, false);
    view.setUint32(FILE_CHUNK_INDEX_OFFSET, frame.chunkIndex, false);

    let payload = frame.payload;
    if (this.encryptionKey) {
      payload = await encryptPayload(
        this.encryptionKey,
        payload,
        chunkNonce(frame.fileId, frame.chunkIndex).buffer as ArrayBuffer
      );
      if (payload.byteLength !== frame.payload.byteLength + GCM_TAG_BYTES) {
        throw new Error("Encrypted chunk is the wrong length");
      }
    }

    const merged = new Uint8Array(
      header.byteLength + payload.byteLength
    );
    merged.set(header, FILE_CHUNK_HEADER_OFFSET);
    merged.set(new Uint8Array(payload), FILE_CHUNK_PAYLOAD_OFFSET);

    channel.send(merged.buffer);
    return true;
  }

  isFileChannelOpen(): boolean {
    return this.fileChannel?.readyState === "open";
  }

  getFileBufferedAmount(): number {
    return this.fileChannel?.bufferedAmount ?? 0;
  }

  async waitForFileBufferLow(threshold: number): Promise<void> {
    const channel = this.fileChannel;
    if (!channel || channel.bufferedAmount <= threshold) return;
    channel.bufferedAmountLowThreshold = threshold;
    await new Promise<void>((resolve) => {
      const onLow = () => {
        channel.removeEventListener("bufferedamountlow", onLow);
        resolve();
      };
      channel.addEventListener("bufferedamountlow", onLow);
    });
  }

  close(): void {
    for (const channel of [this.controlChannel, this.fileChannel]) {
      if (channel && channel.readyState !== "closed") {
        channel.close();
      }
    }
    this.pc.close();
  }

  private async makeOffer(): Promise<void> {
    if (this.pc.signalingState !== "stable" || this.makingOffer) return;
    try {
      this.makingOffer = true;
      await this.pc.setLocalDescription();
      const local = this.pc.localDescription;
      if (local) {
        this.options.onSignal?.onOffer?.(local.toJSON());
      }
    } catch {
      return;
    } finally {
      this.makingOffer = false;
    }
  }

  private createDataChannels(): void {
    const control = this.pc.createDataChannel(CONTROL_CHANNEL_LABEL, {
      ordered: true,
    });
    const file = this.pc.createDataChannel(FILE_CHANNEL_LABEL, {
      ordered: false,
    });
    this.attachChannel(control);
    this.attachChannel(file);
  }

  private attachChannel(channel: RTCDataChannel): void {
    if (channel.label === CONTROL_CHANNEL_LABEL) {
      this.controlChannel = channel;
    } else if (channel.label === FILE_CHANNEL_LABEL) {
      this.fileChannel = channel;
    } else {
      channel.close();
      return;
    }

    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      this.options.onDataChannelOpen?.(channelLabel(channel.label));
    };
    channel.onclose = () => {
      this.options.onDataChannelClosed?.(channelLabel(channel.label));
    };
    channel.onmessage = (event) => {
      void this.routeMessage(channel.label as DataChannelLabel, event.data);
    };
  }

  private async routeMessage(
    label: DataChannelLabel,
    data: unknown
  ): Promise<void> {
    if (label === CONTROL_CHANNEL_LABEL) {
      try {
        let wire = await toText(data);
        if (this.encryptionKey) {
          const envelope = JSON.parse(wire) as unknown;
          if (
            envelope === null ||
            typeof envelope !== "object" ||
            (envelope as { v?: unknown }).v !== 1 ||
            typeof (envelope as { nonce?: unknown }).nonce !== "string" ||
            typeof (envelope as { ciphertext?: unknown }).ciphertext !==
              "string"
          ) {
            throw new Error(
              "Encrypted control message is not a valid cipher envelope"
            );
          }
          wire = await decryptControlMessage(
            this.encryptionKey,
            envelope as CipherEnvelope
          );
        }
        this.options.onControlMessage?.(parseControlMessage(wire));
      } catch (error) {
        this.reportError(error);
      }
      return;
    }
    try {
      this.options.onChunkReceived?.(
        await parseChunkFrame(
          await toArrayBuffer(data),
          this.encryptionKey
        )
      );
    } catch {
      return;
    }
  }

  private reportError(error: unknown): void {
    const normalized =
      error instanceof Error ? error : new Error("WebRTC operation failed");
    this.options.onInternalError?.(normalized);
  }
}

function channelLabel(label: string): DataChannelLabel {
  return label === CONTROL_CHANNEL_LABEL
    ? CONTROL_CHANNEL_LABEL
    : FILE_CHANNEL_LABEL;
}