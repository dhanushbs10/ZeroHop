"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import { Check, ChevronRight, Clipboard, Code2, Copy, MessageSquare, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoomController } from "@/lib/webrtc/room-controller";
import {
  MAX_FILE_CHUNK_SIZE,
  TEXT_MAX_BYTES,
  type TextMessage,
} from "@/lib/types/protocol";

const BUFFER_WATERMARK_HIGH = 5 * 1024 * 1024;
const BUFFER_WATERMARK_LOW = 1024 * 1024;
const POLL_INTERVAL_MS = 50;

function transferInterrupted(): Error {
  const error = new Error("The connection dropped mid-transfer");
  error.name = "TransferInterrupted";
  return error;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

type TabId = "text" | "password" | "code" | "files";

const TABS: { id: TabId; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "password", label: "Password" },
  { id: "code", label: "Code" },
  { id: "files", label: "Files & Folders" },
];

function detectLanguage(value: string): string {
  const head = value.slice(0, 4000);
  const lines = head.split(/\r?\n/);
  if (/^#!\s*\S*(bash|sh|zsh)\b/m.test(head)) return "bash";
  if (
    lines.some((line) =>
      /^\s*(echo|sudo|curl|wget|export|cd |mkdir|rm|cp|mv|chmod|npm|git |pip |cat )/.test(
        line
      )
    )
  ) {
    return "bash";
  }
  const defs = lines.filter((line) =>
    /^\s*(def |async def |class \w+(\(|:))/.test(line)
  );
  if (defs.length > 0) return "python";
  if (
    lines.some((line) => /^\s*(def |class \w+[:=(]|from \w+ import|import \w+|print\()/.test(line)) &&
    !/[{}]/.test(head)
  ) {
    return "python";
  }
  if (
    /\b(interface |type \w+\s*=|as const|: (string|number|boolean)\b|readonly )/.test(
      head
    )
  ) {
    return "typescript";
  }
  if (/\b(const|let|var)\s+\w+\s*[:<]/.test(head)) return "typescript";
  return "javascript";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const ALLOWED_LANGUAGES = new Set(["javascript", "typescript", "python", "bash"]);

function isAllowedLanguage(language: string | undefined): boolean {
  return language !== undefined && ALLOWED_LANGUAGES.has(language);
}

function highlight(value: string, language: string): string {
  if (!ALLOWED_LANGUAGES.has(language)) return escapeHtml(value);
  const grammar = Prism.languages[language];
  if (!grammar) return escapeHtml(value);
  return Prism.highlight(value, grammar, language);
}

function textByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function maskPassword(value: string): string {
  const length = Math.min(value.length, 16);
  return "*".repeat(length);
}

function SendButton({
  disabled,
  sent,
  onSend,
}: {
  disabled: boolean;
  sent: boolean;
  onSend: () => void;
}) {
  return (
    <Button
      size="sm"
      disabled={disabled}
      onClick={onSend}
      className="gap-2 rounded-[4px]"
    >
      {sent ? (
        <>
          <Check className="h-4 w-4" />
          Sent
        </>
      ) : (
        "Send"
      )}
    </Button>
  );
}

export default function ShareDashboard({
  controller,
}: {
  controller: RoomController;
}) {
  const [tab, setTab] = useState<TabId>("text");
  const [text, setText] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sharing, setSharing] = useState(false);
  const [peerSharing, setPeerSharing] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState<{
    name: string;
    progress: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [clipboardState, setClipboardState] = useState<
    "idle" | "sent" | "error"
  >("idle");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const nextFileIdRef = useRef(0);
  const sentTimerRef = useRef<number | null>(null);
  const clipboardTimerRef = useRef<number | null>(null);
  const disposedRef = useRef(false);
  const pendingTransfersRef = useRef<
    Map<
      number,
      {
        file: File;
        name: string;
        totalChunks: number;
        sentChunks: Set<number>;
      }
    >
  >(new Map());

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const sendTextMessage = async (
    category: TextMessage["category"]
  ) => {
    const value =
      category === "code" ? code : category === "password" ? password : text;
    if (value.trim().length === 0) return;
    if (textByteLength(value) > TEXT_MAX_BYTES) {
      setError(
        "That message is too large. Keep text and code under 8 KB per message."
      );
      return;
    }
    const effectiveLanguage =
      category === "code" ? detectLanguage(value) : undefined;
    const message: TextMessage = {
      kind: "text-message",
      messageId: globalThis.crypto.randomUUID(),
      category,
      text: value,
    };
    if (effectiveLanguage) {
      message.language = effectiveLanguage;
    }
    const ok = await controller.sendControlMessage(message);
    if (!ok) {
      setError("The message could not be sent. The peer may have disconnected.");
      return;
    }
    if (category === "text") setText("");
    if (category === "password") setPassword("");
    if (category === "code") setCode("");
    setSent(true);
    if (sentTimerRef.current !== null) {
      window.clearTimeout(sentTimerRef.current);
    }
    sentTimerRef.current = window.setTimeout(() => setSent(false), 2000);
    setToast(
      category === "text"
        ? "Text sent"
        : category === "password"
          ? "Password sent"
          : "Code sent"
    );
    setError(null);
  };

  const toggleSharing = async () => {
    const ok = await controller.sendControlMessage({
      kind: "share-mode",
      mode: sharing ? "idle" : "active",
    });
    if (!ok) {
      setError("Could not reach the peer. The peer may have disconnected.");
      return;
    }
    if (sharing) {
      setSharing(false);
    } else {
      setSharing(true);
      setPeerSharing(false);
    }
    setError(null);
  };

  const pushClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (!value || value.trim().length === 0) {
        setClipboardState("error");
        setError("Your clipboard is empty.");
        return;
      }
      if (textByteLength(value) > TEXT_MAX_BYTES) {
        setClipboardState("error");
        setError("Your clipboard is too large to push in one message.");
        return;
      }
      const ok = await controller.sendControlMessage({
        kind: "text-message",
        messageId: globalThis.crypto.randomUUID(),
        category: "text",
        text: value,
      });
      if (!ok) {
        setClipboardState("error");
        setError("Could not send the clipboard. The peer may have disconnected.");
        return;
      }
      setError(null);
      setClipboardState("sent");
      setToast("Clipboard sent");
      if (clipboardTimerRef.current !== null) {
        window.clearTimeout(clipboardTimerRef.current);
      }
      clipboardTimerRef.current = window.setTimeout(
        () => setClipboardState("idle"),
        2000
      );
    } catch {
      setClipboardState("error");
      setError(
        "Could not read the clipboard. Grant clipboard permission and try again."
      );
    }
  };

  const waitForFileChannel = useCallback(async () => {
    const deadline = Date.now() + 10000;
    while (!controller.isFileChannelOpen()) {
      if (disposedRef.current) throw transferInterrupted();
      if (Date.now() > deadline) {
        throw new Error("The file channel did not open in time");
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }, [controller]);

  const waitForBufferDrain = useCallback(async () => {
    while (controller.getFileBufferedAmount() > BUFFER_WATERMARK_HIGH) {
      while (controller.getFileBufferedAmount() > BUFFER_WATERMARK_LOW) {
        if (disposedRef.current) throw transferInterrupted();
        if (!controller.isFileChannelOpen()) {
          throw transferInterrupted();
        }
        await sleep(POLL_INTERVAL_MS);
      }
    }
  }, [controller]);

  const transferFile = async (file: File) => {
    const displayName = file.webkitRelativePath || file.name;
    let fileId: number | null = null;
    setError(null);
    setPaused(false);
    setSending({ name: displayName, progress: 0 });
    try {
      await waitForFileChannel();
      fileId = nextFileIdRef.current++;
      const totalChunks = Math.ceil(file.size / MAX_FILE_CHUNK_SIZE);
      const sentChunks = new Set<number>();
      pendingTransfersRef.current.set(fileId, {
        file,
        name: displayName,
        totalChunks,
        sentChunks,
      });

      const started = await controller.sendControlMessage({
        kind: "file-start",
        fileId,
        fileName: displayName,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        totalChunks,
      });
      if (!started) {
        pendingTransfersRef.current.delete(fileId);
        throw new Error(
          "The transfer could not start. The peer may have disconnected."
        );
      }

      let progress = 0;
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        await waitForBufferDrain();
        const start = chunkIndex * MAX_FILE_CHUNK_SIZE;
        const payload = await file
          .slice(start, start + MAX_FILE_CHUNK_SIZE)
          .arrayBuffer();
        const ok = await controller.sendChunk({ fileId, chunkIndex, payload });
        if (!ok) throw transferInterrupted();
        sentChunks.add(chunkIndex);
        progress += payload.byteLength;
        setSending({
          name: displayName,
          progress:
            file.size === 0
              ? 100
              : Math.min(100, Math.round((progress / file.size) * 100)),
        });
      }

      const finished = await controller.sendControlMessage({
        kind: "file-end",
        fileId,
        chunksVerified: sentChunks.size,
      });
      if (!finished) throw transferInterrupted();
      pendingTransfersRef.current.delete(fileId);
      setSending({ name: displayName, progress: 100 });
      setToast("File sent");
    } catch (sendError) {
      if (disposedRef.current) return;
      if (
        sendError instanceof Error &&
        sendError.name === "TransferInterrupted"
      ) {
        setPaused(true);
        return;
      }
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The transfer failed unexpectedly"
      );
      setSending(null);
      if (fileId !== null) {
        pendingTransfersRef.current.delete(fileId);
      }
    }
  };

  const resumeTransfer = useCallback(
    async (fileId: number, missingChunks: number[]) => {
      const pending = pendingTransfersRef.current.get(fileId);
      if (!pending) return;
      setError(null);
      setPaused(false);
      setSending({
        name: pending.name,
        progress: Math.round(
          (pending.sentChunks.size / pending.totalChunks) * 100
        ),
      });
      try {
        await waitForFileChannel();
        for (const chunkIndex of missingChunks) {
          await waitForBufferDrain();
          const start = chunkIndex * MAX_FILE_CHUNK_SIZE;
          const payload = await pending.file
            .slice(start, start + MAX_FILE_CHUNK_SIZE)
            .arrayBuffer();
          const ok = await controller.sendChunk({ fileId, chunkIndex, payload });
          if (!ok) throw transferInterrupted();
          pending.sentChunks.add(chunkIndex);
          setSending({
            name: pending.name,
            progress: Math.round(
              (pending.sentChunks.size / pending.totalChunks) * 100
            ),
          });
        }

        const finished = await controller.sendControlMessage({
          kind: "file-end",
          fileId,
          chunksVerified: pending.sentChunks.size,
        });
        if (!finished) throw transferInterrupted();
        pendingTransfersRef.current.delete(fileId);
        setPaused(false);
        setSending({ name: pending.name, progress: 100 });
        setToast("File sent");
      } catch (resumeError) {
        if (disposedRef.current) return;
        if (
          resumeError instanceof Error &&
          resumeError.name === "TransferInterrupted"
        ) {
          setPaused(true);
          return;
        }
        setError(
          resumeError instanceof Error
            ? resumeError.message
            : "The transfer failed to resume"
        );
        setSending(null);
        pendingTransfersRef.current.delete(fileId);
      }
    },
    [controller, waitForFileChannel, waitForBufferDrain]
  );

  useEffect(() => {
    disposedRef.current = false;
    const pendingTransfers = pendingTransfersRef.current;
    const unsubscribe = controller.onMessage((message) => {
      if (message.kind === "share-mode") {
        if (message.mode === "active") {
          setPeerSharing(true);
          setSharing(false);
        } else {
          setPeerSharing(false);
        }
      } else if (message.kind === "file-resume-req") {
        void resumeTransfer(message.fileId, message.missingChunks);
      }
    });
    return () => {
      disposedRef.current = true;
      unsubscribe();
      if (sentTimerRef.current !== null) {
        window.clearTimeout(sentTimerRef.current);
      }
      if (clipboardTimerRef.current !== null) {
        window.clearTimeout(clipboardTimerRef.current);
      }
      pendingTransfers.clear();
    };
  }, [controller, resumeTransfer]);

  const sendFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    for (const file of list) {
      await transferFile(file);
      if (pendingTransfersRef.current.size > 0) return;
    }
  };

  const inputClass =
    "h-10 w-full rounded-[4px] border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600";

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">
            {sharing
              ? "You are sharing"
              : peerSharing
                ? "Peer is sharing"
                : "Ready to share"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            {sharing
              ? "Only you can send. Press stop to hand control to the peer."
              : peerSharing
                ? "The peer is sharing. You can only receive until you take over."
                : "Press Start sharing to send."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void pushClipboard()}
            className="shrink-0 gap-2 rounded-[4px]"
          >
            {clipboardState === "sent" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Clipboard className="h-4 w-4" />
            )}
            {clipboardState === "sent" ? "Pushed" : "Push Clipboard"}
          </Button>
          <Button
            size="sm"
            onClick={() => void toggleSharing()}
            className="shrink-0 rounded-[4px]"
          >
            {sharing ? "Stop sharing" : peerSharing ? "Take over" : "Start sharing"}
          </Button>
        </div>
      </div>

      {paused && sending && (
        <div className="flex w-full flex-col gap-1 border-t border-zinc-800 pt-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            Transfer paused
          </span>
          <p className="max-w-sm text-sm text-zinc-500">
            {sending.name} will resume automatically when the connection
            reopens.
          </p>
        </div>
      )}

      {sharing && (
        <div className="flex w-full flex-col gap-5">
          <div className="flex items-center gap-1 self-start rounded-[4px] border border-zinc-800 p-1">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={cn(
                  "rounded-[4px] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors",
                  tab === entry.id
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

        {tab === "text" && (
          <div className="flex flex-col gap-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Write something to share"
              className="w-full resize-none rounded-[4px] border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
            />
            <div className="flex justify-end">
              <SendButton
                disabled={text.trim().length === 0}
                sent={sent}
                onSend={() => void sendTextMessage("text")}
              />
            </div>
          </div>
        )}

        {tab === "password" && (
          <div className="flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a password to share"
              className={inputClass}
            />
            <div className="flex justify-end">
              <SendButton
                disabled={password.trim().length === 0}
                sent={sent}
                onSend={() => void sendTextMessage("password")}
              />
            </div>
          </div>
        )}

        {tab === "code" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-[4px] border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                {code.trim().length === 0 ? "auto" : detectLanguage(code)}
              </span>
              <SendButton
                disabled={code.trim().length === 0}
                sent={sent}
                onSend={() => void sendTextMessage("code")}
              />
            </div>
            <div className="overflow-hidden rounded-[4px] border border-zinc-800 bg-zinc-950">
              <Editor
                value={code}
                onValueChange={setCode}
                highlight={(value) => highlight(value, detectLanguage(value))}
                padding={12}
                textareaClassName="outline-none"
                className="min-h-[220px] font-mono text-sm text-zinc-200"
              />
            </div>
          </div>
        )}

        {tab === "files" && (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-[4px] border border-dashed p-3 transition-colors",
              dragOver
                ? "border-zinc-600 bg-zinc-900/50"
                : "border-zinc-800 bg-transparent"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const files = e.dataTransfer.files;
              if (files && files.length > 0) void sendFiles(files);
            }}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={sending !== null}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-[4px]"
              >
                Choose files
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={sending !== null}
                onClick={() => folderInputRef.current?.click()}
                className="rounded-[4px]"
              >
                Choose folder
              </Button>
              <span className="flex items-center px-2 font-mono text-[11px] text-zinc-500">
                or drag and drop any file
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void sendFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={(node) => {
                if (node) {
                  folderInputRef.current = node;
                  node.setAttribute("webkitdirectory", "");
                }
              }}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void sendFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {sending && (
              <div className="flex flex-col gap-2">
                {paused ? (
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                      Transfer paused
                    </span>
                    <p className="text-sm text-zinc-500">
                      {sending.name} will resume automatically when the
                      connection reopens.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-white">
                        {sending.name}
                      </span>
                      <span className="ml-4 shrink-0 font-mono text-xs text-zinc-400">
                        {sending.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-zinc-800">
                      <div
                        className="h-full rounded-[2px] bg-zinc-300 transition-[width] duration-200"
                        style={{ width: `${sending.progress}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-zinc-500">
              Folder uploads preserve the folder structure in the file names.
              Files sent by the peer download automatically when they complete.
            </p>
          </div>
        )}
      </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[4px] border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 shadow-lg">
          <Check className="h-4 w-4 shrink-0 text-zinc-300" />
          {toast}
        </div>
      )}

      {error && (
        <p className="w-full rounded-[6px] border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function ReceivedMessages({
  controller,
}: {
  controller: RoomController;
}) {
  const [messages, setMessages] = useState<TextMessage[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoCopied, setAutoCopied] = useState(false);
  const [listError, setErrorMessage] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const autoCopyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = controller.onMessage((message) => {
      if (message.kind === "text-message") {
        setMessages((prev) => [...prev, message]);
        if (message.category === "text") {
          void navigator.clipboard
            .writeText(message.text)
            .then(() => {
              setAutoCopied(true);
              if (autoCopyTimerRef.current !== null) {
                window.clearTimeout(autoCopyTimerRef.current);
              }
              autoCopyTimerRef.current = window.setTimeout(
                () => setAutoCopied(false),
                1800
              );
            })
            .catch(() => undefined);
        }
      }
    });
    return () => {
      unsubscribe();
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (autoCopyTimerRef.current !== null) {
        window.clearTimeout(autoCopyTimerRef.current);
      }
    };
  }, [controller]);

  const toggleExpand = (messageId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const toggleReveal = (messageId: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const copyMessage = async (messageId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(messageId);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setErrorMessage("Could not write to the clipboard");
    }
  };

  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-800 pb-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-400">
          Received
        </h2>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-wider text-zinc-400 transition-opacity",
              autoCopied ? "opacity-100" : "opacity-0"
            )}
          >
            Copied to clipboard
          </span>
          <span className="font-mono text-xs text-zinc-600">
            {messages.length}
          </span>
        </div>
      </div>

      {listError && (
        <p className="border-b border-red-900/50 bg-red-950/40 px-3 py-3 text-sm text-red-400">
          {listError}
        </p>
      )}

      {messages.length === 0 ? (
        <p className="border-b border-zinc-800 py-5 text-sm text-zinc-500">
          Incoming text, passwords, and code appear here.
        </p>
      ) : (
        <div className="flex max-h-[64vh] flex-col overflow-y-auto">
          {messages.map((message) => {
            const isExpanded = expanded.has(message.messageId);
            const isRevealed = revealed.has(message.messageId);
            const isCopied = copiedId === message.messageId;
            const masked = maskPassword(message.text);
            const Icon =
              message.category === "password"
                ? ShieldCheck
                : message.category === "code"
                  ? Code2
                  : MessageSquare;
            return (
              <div
                key={message.messageId}
                className="border-b border-zinc-800 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(message.messageId)}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                      {message.category}
                      {message.category === "code" && message.language
                        ? ` / ${message.language}`
                        : ""}
                    </span>
                    <ChevronRight
                      className={cn(
                        "ml-auto h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="Copy message"
                    onClick={() =>
                      void copyMessage(message.messageId, message.text)
                    }
                    className="flex shrink-0 items-center gap-1 rounded-[4px] border border-zinc-800 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-200"
                  >
                    {isCopied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {isCopied ? "Copied" : "Copy"}
                  </button>
                </div>

                {message.category === "password" ? (
                  isExpanded ? (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-[4px] border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <span className="break-all font-mono text-sm text-zinc-200">
                        {isRevealed ? message.text : masked}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleReveal(message.messageId)}
                        className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-200"
                      >
                        {isRevealed ? "Hide" : "Show"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1.5 line-clamp-2 break-all pr-9 font-mono text-sm text-zinc-500">
                      {masked}
                    </p>
                  )
                ) : message.category === "code" && isExpanded ? (
                  <pre className="mt-2 overflow-x-auto whitespace-pre rounded-[4px] border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200">
                    <code
                      className={`received-code language-${message.language ?? ""}`}
                      dangerouslySetInnerHTML={{
                        __html: highlight(
                          message.text,
                          isAllowedLanguage(message.language)
                            ? (message.language as string)
                            : ""
                        ),
                      }}
                    />
                  </pre>
                ) : isExpanded ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">
                    {message.text}
                  </p>
                ) : (
                  <p
                    className={`mt-1.5 line-clamp-2 whitespace-pre-wrap break-words pr-9 ${
                      message.category === "code"
                        ? "font-mono text-xs text-zinc-400"
                        : "text-sm text-zinc-400"
                    }`}
                  >
                    {message.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}