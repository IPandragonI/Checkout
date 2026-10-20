import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Checkout — Marqueur de fléchettes",
    short_name: "Checkout",
    description: "Marqueur 501/301 ultra-rapide avec aide au checkout.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f4f8",
    theme_color: "#111f42",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
