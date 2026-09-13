import {
  GCM_NONCE_BYTES,
  GCM_TAG_BYTES,
  type Base64Url,
  type CipherEnvelope,
} from "@/lib/types/protocol";

function bytesToBase64Url(bytes: Uint8Array): Base64Url {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: Base64Url): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptPayload(
  key: CryptoKey,
  data: ArrayBuffer,
  nonce: ArrayBuffer
): Promise<ArrayBuffer> {
  return globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, tagLength: GCM_TAG_BYTES * 8 },
    key,
    data
  );
}

export async function decryptPayload(
  key: CryptoKey,
  encrypted: ArrayBuffer,
  nonce: ArrayBuffer
): Promise<ArrayBuffer> {
  if (encrypted.byteLength <= GCM_TAG_BYTES) {
    throw new Error("Ciphertext is too short to contain a GCM tag");
  }
  try {
    return await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, tagLength: GCM_TAG_BYTES * 8 },
      key,
      encrypted
    );
  } catch (error) {
    throw new Error(
      `Failed to decrypt payload: ${error instanceof Error ? error.message : "AEAD authentication failed"}`
    );
  }
}

export async function encryptControlMessage(
  key: CryptoKey,
  json: string
): Promise<CipherEnvelope> {
  const nonce = new Uint8Array(GCM_NONCE_BYTES);
  globalThis.crypto.getRandomValues(nonce);
  const plaintext = new TextEncoder().encode(json);
  const ciphertext = await encryptPayload(
    key,
    plaintext.buffer as ArrayBuffer,
    nonce.buffer as ArrayBuffer
  );
  return {
    v: 1,
    nonce: bytesToBase64Url(nonce),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptControlMessage(
  key: CryptoKey,
  envelope: CipherEnvelope
): Promise<string> {
  if (envelope.v !== 1) {
    throw new Error(`Unsupported cipher envelope version: ${envelope.v}`);
  }
  if (envelope.nonce.length === 0 || envelope.ciphertext.length === 0) {
    throw new Error("Cipher envelope is missing nonce or ciphertext");
  }
  const nonce = base64UrlToBytes(envelope.nonce);
  if (nonce.byteLength !== GCM_NONCE_BYTES) {
    throw new Error("Cipher envelope nonce has the wrong length");
  }
  const ciphertext = base64UrlToBytes(envelope.ciphertext);
  const plaintext = await decryptPayload(
    key,
    ciphertext.buffer as ArrayBuffer,
    nonce.buffer as ArrayBuffer
  );
  return new TextDecoder().decode(plaintext);
}