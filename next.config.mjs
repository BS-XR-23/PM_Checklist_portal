/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a local production-mode server (`start:local`) build into its own
  // directory so it doesn't collide with `next dev`'s .next cache when both
  // run at once (dev and build write incompatible formats to the same dir).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
