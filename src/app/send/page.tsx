"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, FileDown, Link2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RoomController } from "@/lib/webrtc/room-controller";
import { initializeSignaling } from "@/lib/webrtc/signaling-client";
import {
  CONTROL_CHANNEL_LABEL,
  FILE_CHANNEL_LABEL,
  MAX_FILE_CHUNK_SIZE,
  type FileChunkFrame,
  type FileStart,
  type RoomCode,
} from "@/lib/types/protocol";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zerohop.app";
const BUFFER_WATERMARK_HIGH = 5 * 1024 * 1024;
const BUFFER_WATERMARK_LOW = 1024 * 1024;

type Status =
  | "idle"
  | "starting"
  | "waiting"
  | "connected"
  | "sending"
  | "receiving"
  | "complete"
  | "error";

const STATUS_LABEL: Record<Status, string> = {
  idle: "Ready",
  starting: "Initializing room...",
  waiting: "Waiting for receiver...",
  connected: "Connected",
  sending: "Sending...",
  receiving: "Receiving...",
  complete: "Transfer complete",
  error: "Something went wrong",
};

function StatusDot({ status }: { status: Status }) {
  const color =
    status === "connected" || status === "complete"
      ? "bg-zinc-300"
      : status === "sending" ||
          status === "receiving" ||
          status === "waiting" ||
          status === "starting"
        ? "bg-zinc-400"
        : "bg-zinc-600";
  return <span className={`h-1.5 w-1.5 rounded-[1px] ${color}`} />;
}

export default function SendPage() {
  const controllerRef = useRef<RoomController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextFileIdRef = useRef(0);

  const metaRef = useRef<Map<number, FileStart>>(new Map());
  const chunkStoreRef = useRef<Map<number, Map<number, Uint8Array<ArrayBuffer>>>>(
    new Map()
  );
  const bytesRef = useRef<Map<number, number>>(new Map());

  const [status, setStatus] = useState<Status>("idle");
  const [roomCode, setRoomCode] = useState<RoomCode | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [incoming, setIncoming] = useState<{
    fileName: string;
    fileSize: number;
    progress: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [channelsOpen, setChannelsOpen] = useState({
    [CONTROL_CHANNEL_LABEL]: false,
    [FILE_CHANNEL_LABEL]: false,
  });
  const [dragging, setDragging] = useState(false);

  const connected =
    channelsOpen[CONTROL_CHANNEL_LABEL] && channelsOpen[FILE_CHANNEL_LABEL];
  const effectiveStatus: Status =
    (status === "idle" ||
      status === "starting" ||
      status === "waiting") &&
    connected
      ? "connected"
      : status;

  useEffect(() => {
    if (controllerRef.current) return;
    let disposed = false;
    const meta = metaRef.current;
    const chunks = chunkStoreRef.current;
    const bytes = bytesRef.current;

    const setup = async () => {
      try {
        const signaling = initializeSignaling();
        const controller = new RoomController({
          signaling,
          onDataChannelOpen: (label) =>
            setChannelsOpen((prev) => ({ ...prev, [label]: true })),
          onDataChannelClosed: (label) =>
            setChannelsOpen((prev) => ({ ...prev, [label]: false })),
          onControlMessage: (message) => {
            if (message.kind === "file-start") {
              meta.set(message.fileId, message);
              bytes.set(message.fileId, 0);
              setIncoming({
                fileName: message.fileName,
                fileSize: message.fileSize,
                progress: 0,
              });
              setStatus("receiving");
            } else if (message.kind === "file-end") {
              const entry = meta.get(message.fileId);
              const byFile = chunks.get(message.fileId);
              if (entry && byFile) {
                const parts: BlobPart[] = [];
                for (let i = 0; i < entry.totalChunks; i += 1) {
                  const chunk = byFile.get(i);
                  if (chunk) parts.push(chunk);
                }
                const blob = new Blob(parts, { type: entry.mimeType });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = entry.fileName;
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                chunks.delete(message.fileId);
                meta.delete(message.fileId);
                bytes.delete(message.fileId);
                setIncoming((prev) =>
                  prev ? { ...prev, progress: 100 } : prev
                );
              }
            }
          },
          onChunkReceived: (frame: FileChunkFrame) => {
            let byFile = chunks.get(frame.fileId);
            if (!byFile) {
              byFile = new Map();
              chunks.set(frame.fileId, byFile);
            }
            byFile.set(frame.chunkIndex, new Uint8Array(frame.payload));

            const previous = bytes.get(frame.fileId) ?? 0;
            const updated = previous + frame.payload.byteLength;
            bytes.set(frame.fileId, updated);

            controllerRef.current?.sendControlMessage({
              kind: "file-ack",
              fileId: frame.fileId,
              chunkIndex: frame.chunkIndex,
            });

            const entry = meta.get(frame.fileId);
            if (entry) {
              setIncoming((prev) =>
                prev
                  ? {
                      ...prev,
                      progress: Math.min(
                        100,
                        Math.round((updated / entry.fileSize) * 100)
                      ),
                    }
                  : prev
              );
            }
          },
          onConnectionFailed: (reason) => {
            setErrorMessage(
              `${reason}. The link dropped before the transfer could start; create a new room and retry.`
            );
            setStatus("error");
          },
          onError: (error) => setErrorMessage(error.message),
        });
        if (disposed) {
          controller.disconnect();
          return;
        }
        controllerRef.current = controller;
      } catch (error) {
        if (!disposed) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to start the signaling session"
          );
          setStatus("error");
        }
      }
    };

    void setup();

    return () => {
      disposed = true;
      controllerRef.current?.disconnect();
      controllerRef.current = null;
      meta.clear();
      chunks.clear();
      bytes.clear();
    };
  }, []);

  const initializeRoom = async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    setStatus("starting");
    setErrorMessage(null);
    try {
      const initiated = await controller.initiateRoom();
      setRoomCode(initiated.roomCode);
      setShareLink(
        `${SITE_URL}/receive#!/join/${initiated.roomCode}?t=${initiated.shareToken}`
      );
      setStatus("waiting");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to initialize the room"
      );
      setStatus("error");
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage("Could not write to the clipboard");
    }
  };

  const copyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setErrorMessage("Could not write to the clipboard");
    }
  };

  const waitForFileChannel = async () => {
    const controller = controllerRef.current;
    if (!controller) throw new Error("Session is not initialized");
    const deadline = Date.now() + 10000;
    while (!controller.isFileChannelOpen()) {
      if (Date.now() > deadline) {
        throw new Error("The file channel did not open in time");
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  const transferFile = async (target: File) => {
    const controller = controllerRef.current;
    if (!controller) return;
    setStatus("sending");
    setProgress(0);
    try {
      await waitForFileChannel();
      const fileId = nextFileIdRef.current++;
      const totalChunks = Math.ceil(target.size / MAX_FILE_CHUNK_SIZE);
      controller.sendControlMessage({
        kind: "file-start",
        fileId,
        fileName: target.name,
        fileSize: target.size,
        mimeType: target.type || "application/octet-stream",
        totalChunks,
      });

      let sentBytes = 0;
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        while (controller.getFileBufferedAmount() > BUFFER_WATERMARK_HIGH) {
          await controller.waitForFileBufferLow(BUFFER_WATERMARK_LOW);
        }
        const start = chunkIndex * MAX_FILE_CHUNK_SIZE;
        const payload = await target
          .slice(start, start + MAX_FILE_CHUNK_SIZE)
          .arrayBuffer();
        controller.sendChunk({ fileId, chunkIndex, payload });
        sentBytes += payload.byteLength;
        setProgress(Math.min(100, Math.round((sentBytes / target.size) * 100)));
      }

      controller.sendControlMessage({
        kind: "file-end",
        fileId,
        chunksVerified: totalChunks,
      });
      setProgress(100);
      setStatus("complete");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The transfer failed unexpectedly"
      );
      setStatus("error");
    }
  };

  const acceptFiles = (files: FileList | File[]) => {
    if (!connected) return;
    const target = files[0];
    if (!target) return;
    setFile(target);
    void transferFile(target);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white">
        Send
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Initialize a room, share the link, and transfer files directly.
      </p>

      <div className="mt-8 flex flex-col items-start gap-6">
        <div className="inline-flex h-8 items-center gap-2 rounded-[4px] border border-zinc-800 bg-zinc-900/60 px-3">
          <StatusDot status={effectiveStatus} />
          <span className="text-xs font-medium text-zinc-300">
            {STATUS_LABEL[effectiveStatus]}
          </span>
        </div>

        {!roomCode ? (
          <Button
            size="lg"
            disabled={status === "starting"}
            onClick={() => void initializeRoom()}
            className="rounded-[4px]"
          >
            Initialize Room
          </Button>
        ) : (
          <div className="flex w-full flex-col gap-6">
<div className="flex w-full flex-col gap-5 rounded-[6px] border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Room code
                  </span>
                  <span className="mt-1 font-mono text-xl font-semibold tracking-[0.15em] text-white">
                    {roomCode}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => void copyRoomCode()}
                  className="gap-2 rounded-[4px]"
                >
                  {copiedCode ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedCode ? "Copied" : "Copy Code"}
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Share link
                </span>
                <div className="flex items-center gap-2 rounded-[4px] border border-zinc-800 bg-zinc-950 py-1.5 pl-3 pr-1.5">
                  <input
                    readOnly
                    value={shareLink ?? ""}
                    className="min-w-0 flex-1 bg-transparent font-mono text-xs text-zinc-400 outline-none"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copyShareLink()}
                    className="shrink-0 gap-2 rounded-[4px]"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    {copied ? "Copied" : "Copy Link"}
                  </Button>
                </div>
              </div>
            </div>

            <div
              role="button"
              tabIndex={connected ? 0 : -1}
              aria-disabled={!connected}
              onClick={() => {
                if (connected) fileInputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (connected) fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (connected) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                acceptFiles(e.dataTransfer.files);
              }}
              className={`flex w-full cursor-default flex-col items-center justify-center gap-4 rounded-[6px] border-2 border-dashed px-6 py-16 text-center transition-colors duration-200 ${
                connected
                  ? dragging
                    ? "cursor-pointer border-zinc-500 bg-zinc-900/70"
                    : "cursor-pointer border-zinc-700 bg-zinc-900/40 hover:border-zinc-600"
                  : "border-zinc-800 bg-zinc-900/20 opacity-50"
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-zinc-800 bg-zinc-800">
                <Upload className="h-5 w-5 text-zinc-300" />
              </span>
              <div>
                <p className="font-medium text-white">
                  Drag and drop files here
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {connected
                    ? "or click to choose a file"
                    : "waiting for the receiver to connect"}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) acceptFiles(files);
                  e.target.value = "";
                }}
              />
            </div>

            {file &&
              (status === "sending" || status === "complete") && (
                <div className="rounded-[6px] border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium text-white">
                      {file.name}
                    </span>
                    <span className="ml-4 shrink-0 font-mono text-xs text-zinc-400">
                      {progress}%
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-[2px] bg-zinc-800">
                    <div
                      className="h-full rounded-[2px] bg-zinc-300 transition-[width] duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

            <div className="flex w-full flex-col gap-4">
              <h2 className="text-sm font-medium text-zinc-300">
                Incoming Files
              </h2>
              {incoming ? (
                <div className="rounded-[6px] border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileDown className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="truncate font-medium text-white">
                        {incoming.fileName}
                      </span>
                    </span>
                    <span className="ml-4 shrink-0 font-mono text-xs text-zinc-400">
                      {incoming.progress}%
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-[2px] bg-zinc-800">
                    <div
                      className="h-full rounded-[2px] bg-zinc-300 transition-[width] duration-200"
                      style={{ width: `${incoming.progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  Files sent by the receiver will appear here.
                </p>
              )}
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="w-full rounded-[6px] border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}