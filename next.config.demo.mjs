/** @type {import('next').NextConfig} */
const demoConfig = {
  // Produces a static HTML/JS export under `out/` at the repo root.
  output: 'export',
  // GitHub Pages cannot run the Next.js image optimizer.
  images: { unoptimized: true },
  // basePath must match the GitHub Pages repo path: /personal-FA
  basePath: '/personal-FA',
  // Emits `out/<route>/index.html` for each tab route.
  trailingSlash: true,
};

export default demoConfig;
