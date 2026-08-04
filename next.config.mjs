/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse (via pdfjs-dist) ships separate browser/node export conditions;
  // Turbopack's bundler was resolving the browser build on Vercel and pulling
  // in canvas-only code that references `DOMMatrix`, crashing every /api/chat
  // request at module evaluation. Marking it external makes Node's own
  // require/import resolve it at runtime instead, using the correct "node"
  // export condition.
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
