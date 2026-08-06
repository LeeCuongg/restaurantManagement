import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    /**
     * Server Action mặc định chỉ nhận body 1MB → form "Nhận diện nhà hàng" gửi logo + ảnh bìa
     * (mỗi ảnh tới 10MB theo validate ở ImageUpload) bị Next CHẶN TRƯỚC khi action chạy: trả 500,
     * không flash, người dùng tưởng bấm hụt. Đặt 25MB để bao 2 ảnh 10MB + overhead multipart,
     * vẫn còn ngưỡng 10MB/ảnh chặn ở cả client lẫn server (lib/storage/images.ts).
     */
    serverActions: { bodySizeLimit: "25mb" },
  },
  // Repo con nằm trong E:\externalProjects (có lockfile cha) — chốt root ở đây
  // để tắt cảnh báo "inferred workspace root".
  outputFileTracingRoot: __dirname,
  // next/image được phép tải ảnh menu/logo từ Supabase Storage (bucket public).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
