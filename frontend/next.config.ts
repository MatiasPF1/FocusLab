import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/auth",
        destination: "/Authentication_Component",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
