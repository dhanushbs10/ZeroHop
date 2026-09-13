"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RoomController } from "@/lib/webrtc/room-controller";
import { initializeSignaling } from "@/lib/webrtc/signaling-client";
import {
  CONTROL_CHANNEL_LABEL,
  FILE_CHANNEL_LABEL,
  MAX_FILE_CHUNK_SIZE,
  ROOM_CODE_PATTERN,
  type Base64Url,
  type FileChunkFrame,
  type FileStart,
  type RoomCode,
} from "@/lib/types/protocol";

const BUFFER_WATERMARK_HIGH = 5 * 1024 * 1024;
const BUFFER_WATERMARK_LOW = 1024 * 1024;

type Status =
  | "idle"
  | "connecting"
  | "connected"
  | "receiving"
  | "sending"
  | "complete"
  | "error";

const STATUS_LABEL: Record<Status, string> = {
  idle: "No share link",
  connecting: "Connecting to peer...",
  connected: "Connected",
  receiving: "Receiving...",
  sending: "Sending...",
  complete: "Transfer complete",
  error: "Something went wrong",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function parseJoinHash(hash: string): {
  roomCode: RoomCode;
  shareToken: Base64Url;
} | null {
  const match = hash.match(/^#!\/join\/([^?]+)\?t=([^&]+)$/);
  if (!match) return null;
  return { roomCode: match[1] as RoomCode, shareToken: match[2] as Base64Url };
}

function parseShareInput(input: string): {
  roomCode: RoomCode;
  shareToken: Base64Url;
} | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let hash: string;
  try {
    hash = new URL(trimmed).hash;
  } catch {
    hash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }
  return parseJoinHash(hash);
}

function StatusDot({ status }: { status: Status }) {
  const color =
    status === "connected" || status === "complete"
      ? "bg-zinc-300"
      : status === "receiving" ||
          status === "sending" ||
          status === "connecting"
        ? "bg-zinc-400"
        : "bg-zinc-600";
  return <span className={`h-1.5 w-1.5 rounded-[1px] ${color}`} />;
}

export default function ReceivePage() {
  const controllerRef = useRef<RoomController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextFileIdRef = useRef(0);

  const metaRef = useRef<Map<number, FileStart>>(new Map());
  const chunkStoreRef = useRef<Map<number, Map<number, Uint8Array<ArrayBuffer>>>>(
    new Map()
  );
  const bytesRef = useRef<Map<number, number>>(new Map());

  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [totalFileSize, setTotalFileSize] = useState(0);
  const [progress, setProgress] = useState(0);
  const [sending, setSending] = useState<{
    fileName: string;
    progress: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [channelsOpen, setChannelsOpen] = useState({
    [CONTROL_CHANNEL_LABEL]: false,
    [FILE_CHANNEL_LABEL]: false,
  });
  const [dragging, setDragging] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const connected =
    channelsOpen[CONTROL_CHANNEL_LABEL] && channelsOpen[FILE_CHANNEL_LABEL];
  const effectiveStatus: Status =
    (status === "idle" || status === "connecting") && connected
      ? "connected"
      : status;
  const showJoinPanel = status === "idle" || status === "error";

  const startJoin = useCallback(
    async (
      roomCode: RoomCode,
      shareToken?: Base64Url,
      isDisposed: () => boolean = () => false,
    ) => {
      const previous = controllerRef.current;
      if (previous) {
        previous.disconnect();
        controllerRef.current = null;
      }

      const signaling = initializeSignaling();
      const controller = new RoomController({
        signaling,
        onDataChannelOpen: (label) =>
          setChannelsOpen((prev) => ({ ...prev, [label]: true })),
        onDataChannelClosed: (label) =>
          setChannelsOpen((prev) => ({ ...prev, [label]: false })),
        onControlMessage: (message) => {
          if (message.kind === "file-start") {
            metaRef.current.set(message.fileId, message);
            bytesRef.current.set(message.fileId, 0);
            setFileName(message.fileName);
            setTotalFileSize(message.fileSize);
            setProgress(0);
            setStatus("receiving");
          } else if (message.kind === "file-end") {
            const entry = metaRef.current.get(message.fileId);
            const byFile = chunkStoreRef.current.get(message.fileId);
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
              chunkStoreRef.current.delete(message.fileId);
              metaRef.current.delete(message.fileId);
              bytesRef.current.delete(message.fileId);
              setStatus("complete");
            }
          }
        },
        onChunkReceived: (frame: FileChunkFrame) => {
          let byFile = chunkStoreRef.current.get(frame.fileId);
          if (!byFile) {
            byFile = new Map();
            chunkStoreRef.current.set(frame.fileId, byFile);
          }
          byFile.set(frame.chunkIndex, new Uint8Array(frame.payload));

          const previous = bytesRef.current.get(frame.fileId) ?? 0;
          const updated = previous + frame.payload.byteLength;
          bytesRef.current.set(frame.fileId, updated);

          controllerRef.current?.sendControlMessage({
            kind: "file-ack",
            fileId: frame.fileId,
            chunkIndex: frame.chunkIndex,
          });

          const entry = metaRef.current.get(frame.fileId);
          if (entry) {
            setProgress(
              Math.min(100, Math.round((updated / entry.fileSize) * 100)),
            );
          }
        },
        onError: (error) => {
          if (!isDisposed()) {
            setErrorMessage(error.message);
            setStatus("error");
          }
        },
        onConnectionFailed: (reason) => {
          if (!isDisposed()) {
            setErrorMessage(
              `${reason}. Ask the sender to create a new room and resend this link.`,
            );
            setStatus("error");
          }
        },
      });
      controllerRef.current = controller;

      setStatus("connecting");
      setErrorMessage(null);
      try {
        await controller.joinRoom(roomCode, shareToken);
      } catch (error) {
        if (!isDisposed()) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to connect to the signaling server",
          );
          setStatus("error");
        }
      }
    },
    [],
  );

  useEffect(() => {
    let disposed = false;
    const meta = metaRef.current;
    const chunks = chunkStoreRef.current;
    const bytes = bytesRef.current;
    const parsed = parseJoinHash(window.location.hash);
    if (parsed) {
      const { roomCode, shareToken } = parsed;
      queueMicrotask(() => void startJoin(roomCode, shareToken, () => disposed));
    }
    return () => {
      disposed = true;
      controllerRef.current?.disconnect();
      controllerRef.current = null;
      meta.clear();
      chunks.clear();
      bytes.clear();
    };
  }, [startJoin]);

  const joinByCode = () => {
    const code = codeInput.trim();
    if (!ROOM_CODE_PATTERN.test(code)) {
      setErrorMessage(
        "That room code is not valid. Codes are 8 characters made up of letters and numbers."
      );
      return;
    }
    void startJoin(code as RoomCode);
  };

  const joinFromInput = () => {
    const parsed = parseShareInput(linkInput);
    if (!parsed) {
      setErrorMessage(
        "That link does not contain a valid room code and share token. Paste the full link, including everything after the hash."
      );
      return;
    }
    void startJoin(parsed.roomCode, parsed.shareToken);
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
    setSending({ fileName: target.name, progress: 0 });
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
        setSending((prev) =>
          prev
            ? {
                ...prev,
                progress: Math.min(
                  100,
                  Math.round((sentBytes / target.size) * 100)
                ),
              }
            : prev
        );
      }

      controller.sendControlMessage({
        kind: "file-end",
        fileId,
        chunksVerified: totalChunks,
      });
      setSending((prev) => (prev ? { ...prev, progress: 100 } : prev));
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
    void transferFile(target);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white">
        Receive
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Enter the room code to start receiving files, or send one back while
        connected.
      </p>

      <div className="mt-8 flex flex-col items-start gap-6">
        <div className="inline-flex h-8 items-center gap-2 rounded-[4px] border border-zinc-800 bg-zinc-900/60 px-3">
          <StatusDot status={effectiveStatus} />
          <span className="text-xs font-medium text-zinc-300">
            {STATUS_LABEL[effectiveStatus]}
          </span>
        </div>

        {showJoinPanel && (
          <div className="w-full rounded-[6px] border border-zinc-800 bg-zinc-900/60 p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                joinByCode();
              }}
            >
              <label
                htmlFor="room-code-input"
                className="text-sm font-medium text-zinc-300"
              >
                Room code
              </label>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  id="room-code-input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={codeInput}
                  onChange={(e) =>
                    setCodeInput(
                      e.target.value
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .toUpperCase()
                        .slice(0, 8)
                    )
                  }
                  placeholder="e.g. 7QKDLX2P"
                  className="h-10 flex-1 rounded-[4px] border border-zinc-800 bg-zinc-950 px-3 font-mono text-sm uppercase tracking-widest text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="rounded-[4px]"
                  disabled={codeInput.trim().length < 8}
                >
                  Join
                </Button>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Ask the sender for the room code shown on their screen.
              </p>
            </form>

            <div className="mt-5 border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => setShowLinkInput((value) => !value)}
                className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
              >
                {showLinkInput
                  ? "Hide link entry"
                  : "Join with a share link instead"}
              </button>
              {showLinkInput && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    joinFromInput();
                  }}
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                >
                  <input
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="https://zerohop.app/receive#!/join/..."
                    className="h-10 flex-1 rounded-[4px] border border-zinc-800 bg-zinc-950 px-3 font-mono text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="lg"
                    className="rounded-[4px]"
                    disabled={linkInput.trim().length === 0}
                  >
                    Join
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}

        {fileName &&
          (status === "receiving" || status === "complete" || progress > 0) && (
            <div className="w-full rounded-[6px] border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium text-white">
                  {fileName}
                </span>
                <span className="ml-4 shrink-0 font-mono text-xs text-zinc-400">
                  {formatBytes(totalFileSize)} {" / "} {progress}%
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

        <div className="w-full rounded-[6px] border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300">
              Send a file back
            </h2>
            {sending && (
              <span className="font-mono text-xs text-zinc-400">
                {sending.progress}%
              </span>
            )}
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
            className={`mt-5 flex w-full cursor-default flex-col items-center justify-center gap-4 rounded-[6px] border-2 border-dashed px-6 py-14 text-center transition-colors duration-200 ${
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
                  : "waiting for a connection"}
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

          {sending && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-[2px] bg-zinc-800">
              <div
                className="h-full rounded-[2px] bg-zinc-300 transition-[width] duration-200"
                style={{ width: `${sending.progress}%` }}
              />
            </div>
          )}
        </div>

        {errorMessage && (
          <p className="w-full rounded-[6px] border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}