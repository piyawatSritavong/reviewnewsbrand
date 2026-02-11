import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "source.unsplash.com" },
      { protocol: "https", hostname: "images.unsplash.com" }, // เผื่อคุณใช้แบบนี้ด้วย
      { protocol: "https", hostname: "i.pravatar.cc" },       // เคยเจอ error ตัวนี้ก่อนหน้า
    ],
  },
};

export default nextConfig;
