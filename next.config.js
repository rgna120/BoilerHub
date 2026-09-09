/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Academic responses stay private; public event updates should reach the server.
  workboxOptions: {
    runtimeCaching: [
      { urlPattern: /\/api\/(?:academic(?:\/|\?)|events(?:\/|\?|$))/, handler: "NetworkOnly", method: "GET" },
      ...require("@ducanh2912/next-pwa").runtimeCaching,
    ],
  },
  disable: process.env.NODE_ENV === "development",
});

module.exports = withPWA({
  reactStrictMode: true,
});
