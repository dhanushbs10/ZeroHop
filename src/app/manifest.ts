import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZeroHop - Secure peer-to-peer file and text transfer",
    short_name: "ZeroHop",
    description:
      "Transfer files directly between browsers over WebRTC with AES-256-GCM end-to-end encryption.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#0c0d10",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
