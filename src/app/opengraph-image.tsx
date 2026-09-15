import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt = "DropLink - Secure peer-to-peer file and text transfer";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#09090b",
          border: "1px solid #27272a",
          padding: "72px 80px",
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 28,
            letterSpacing: 8,
            color: "#71717a",
          }}
        >
DROPLINK
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: -2,
              color: "#fafafa",
            }}
          >
            Peer to peer,
            <br />
            nothing in between.
          </div>
          <div style={{ fontSize: 30, color: "#a1a1aa" }}>
            End-to-end encrypted file and text transfer. No server in the data
            path.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            letterSpacing: 4,
            color: "#52525b",
          }}
        >
          <span>WEBRTC : AES-256-GCM</span>
          <span>DROPLINK.APP</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
