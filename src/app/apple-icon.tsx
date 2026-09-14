import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          border: "1px solid #27272a",
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 104,
            fontWeight: 600,
            letterSpacing: -4,
            color: "#fafafa",
          }}
        >
          Z
        </div>
      </div>
    ),
    { ...size }
  );
}
