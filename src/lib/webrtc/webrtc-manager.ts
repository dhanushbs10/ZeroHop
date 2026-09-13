import {
  CONTROL_CHANNEL_LABEL,
  CONTROL_MESSAGE_KINDS,
  FILE_CHANNEL_LABEL,
  FILE_CHUNK_HEADER_BYTES,
  FILE_CHUNK_HEADER_OFFSET,
  FILE_CHUNK_INDEX_OFFSET,
  FILE_CHUNK_PAYLOAD_OFFSET,
  type ControlMessage,
  type DataChannelLabel,
  type FileChunkFrame,
  type IceCandidate,
  type SessionDescription,
} from "@/lib/types/protocol";

export interface SdpSignalHandlers {
  onOffer?: (description: SessionDescription) => void;
  onAnswer?: (description: SessionDescription) => void;
  onIceCandidate?: (candidate: IceCandidate) => void;
}

export interface WebRTCManagerOptions {
  initiator: boolean;
  onSignal?: SdpSignalHandlers;
  onDataChannelOpen?: (label: DataChannelLabel) => void;
  onDataChannelClosed?: (label: DataChannelLabel) => void;
  onControlMessage?: (message: ControlMessage) => void;
  onChunkReceived?: (frame: FileChunkFrame) => void;
  onConnectionFailed?: (reason: string) => void;
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

function parseChunkFrame(buffer: ArrayBuffer): FileChunkFrame {
  if (buffer.byteLength < FILE_CHUNK_PAYLOAD_OFFSET) {
    throw new Error("Chunk frame is shorter than its header");
  }
  const view = new DataView(buffer);
  const fileId = view.getUint32(FILE_CHUNK_HEADER_OFFSET, false);
  const chunkIndex = view.getUint32(FILE_CHUNK_INDEX_OFFSET, false);
  const payload = buffer.slice(FILE_CHUNK_PAYLOAD_OFFSET);
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

  private controlChannel: RTCDataChannel | null = null;
  private fileChannel: RTCDataChannel | null = null;

  private makingOffer = false;
  private ignoreOffer = false;

  constructor(options: WebRTCManagerOptions) {
    this.initiator = options.initiator;
    this.polite = !options.initiator;
    this.options = options;

    this.pc = new RTCPeerConnection({
      iceServers: options.iceServers ?? DEFAULT_ICE_SERVERS,
    });

    this.pc.onnegotiationneeded = () => {
      console.log(`[webrtc] onnegotiationneeded, initiator=${this.initiator}`);
      if (this.initiator) {
        void this.makeOffer();
      }
    };
    this.pc.onicecandidate = (event) => {
      console.log(
        `[webrtc] Local ICE candidate generated: ${
          event.candidate ? event.candidate.candidate : "(end of candidates)"
        }`
      );
      if (event.candidate) {
        this.options.onSignal?.onIceCandidate?.(event.candidate.toJSON());
      }
    };
    this.pc.onicecandidateerror = (event) => {
      console.error("[webrtc] ICE candidate error", {
        address: event.address,
        errorCode: event.errorCode,
        errorText: event.errorText,
        url: event.url,
      });
    };
    this.pc.oniceconnectionstatechange = () => {
      console.log(`[webrtc] iceConnectionState: ${this.pc.iceConnectionState}`);
    };
    this.pc.onicegatheringstatechange = () => {
      console.log(`[webrtc] iceGatheringState: ${this.pc.iceGatheringState}`);
    };
    this.pc.onconnectionstatechange = () => {
      console.log(`[webrtc] connectionState: ${this.pc.connectionState}`);
      if (this.pc.connectionState === "failed") {
        this.options.onConnectionFailed?.("Peer connection failed");
      }
    };
    this.pc.ondatachannel = (event) => {
      this.attachChannel(event.channel);
    };
  }

  negotiate(): void {
    console.log(
      `[webrtc] negotiate() called, initiator=${this.initiator}, controlChannel=${
        this.controlChannel?.readyState ?? "none"
      }`
    );
    if (!this.initiator) return;
    if (!this.controlChannel) {
      this.createDataChannels();
    }
    void this.makeOffer();
  }

  async handleRemoteDescription(description: SessionDescription): Promise<void> {
    try {
      const offerCollision =
        description.type === "offer" &&
        (this.makingOffer || this.pc.signalingState !== "stable");
      this.ignoreOffer = !this.polite && offerCollision;
      console.log(
        `[webrtc] handleRemoteDescription: type=${description.type}, offerCollision=${offerCollision}, polite=${this.polite}, makingOffer=${this.makingOffer}, signalingState=${this.pc.signalingState}, ignoreOffer=${this.ignoreOffer}`
      );
      if (this.ignoreOffer) return;

      await this.pc.setRemoteDescription(description);
      if (description.type === "offer") {
        await this.pc.setLocalDescription();
        const local = this.pc.localDescription;
        if (local) {
          this.options.onSignal?.onAnswer?.(local.toJSON());
        }
      }
    } catch (error) {
      console.error("Failed to handle remote description", error);
    }
  }

  async handleIceCandidate(candidate: IceCandidate): Promise<void> {
    console.log(`[webrtc] Adding remote ICE candidate: ${candidate.candidate}`);
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
      if (!this.ignoreOffer) {
        console.error("Failed to add remote ICE candidate", error);
      }
    }
  }

  sendControlMessage(message: ControlMessage): boolean {
    const channel = this.controlChannel;
    if (!channel || channel.readyState !== "open") return false;
    channel.send(JSON.stringify(message));
    return true;
  }

  sendChunk(frame: FileChunkFrame): boolean {
    const channel = this.fileChannel;
    if (!channel || channel.readyState !== "open") return false;

    const header = new Uint8Array(FILE_CHUNK_HEADER_BYTES);
    const view = new DataView(header.buffer);
    view.setUint32(FILE_CHUNK_HEADER_OFFSET, frame.fileId, false);
    view.setUint32(FILE_CHUNK_INDEX_OFFSET, frame.chunkIndex, false);

    const merged = new Uint8Array(
      header.byteLength + frame.payload.byteLength
    );
    merged.set(header, FILE_CHUNK_HEADER_OFFSET);
    merged.set(new Uint8Array(frame.payload), FILE_CHUNK_PAYLOAD_OFFSET);

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
      console.log(
        `[webrtc] makeOffer: starting, signalingState=${this.pc.signalingState}`
      );
      await this.pc.setLocalDescription();
      const local = this.pc.localDescription;
      console.log(
        `[webrtc] makeOffer: setLocalDescription done, type=${local?.type}`
      );
      if (local) {
        this.options.onSignal?.onOffer?.(local.toJSON());
      }
    } catch (error) {
      console.error("Failed to create offer", error);
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
      console.log(`[webrtc] ${channel.label} channel open`);
      this.options.onDataChannelOpen?.(channelLabel(channel.label));
    };
    channel.onclose = () => {
      console.log(`[webrtc] ${channel.label} channel closed`);
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
      this.options.onControlMessage?.(parseControlMessage(await toText(data)));
    } else {
      this.options.onChunkReceived?.(parseChunkFrame(await toArrayBuffer(data)));
    }
  }
}

function channelLabel(label: string): DataChannelLabel {
  return label === CONTROL_CHANNEL_LABEL
    ? CONTROL_CHANNEL_LABEL
    : FILE_CHANNEL_LABEL;
}