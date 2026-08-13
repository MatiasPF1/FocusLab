import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent browsers from MIME-sniffing a response away from the declared content-type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block the page from being loaded in an iframe (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Only send the origin (no path) when navigating cross-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /*
   * Disable browser features that are not used by this app.
   *
   * autoplay and encrypted-media are the exception: the Spotify Web Playback
   * SDK plays audio inside an iframe it loads from sdk.scdn.co, and both
   * features default to "self" only. Without naming that origin here the
   * browser blocks playback, because protected audio cannot be decrypted.
   */
  {
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), ' +
      'autoplay=(self "https://sdk.scdn.co"), ' +
      'encrypted-media=(self "https://sdk.scdn.co")',
  },
  // Force HTTPS for one year (only effective over HTTPS in production)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

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
