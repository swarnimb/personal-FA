/** @type {import('next').NextConfig} */
// Env var name must match the flag read in src/lib/demo-mode.ts
const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const config = isDemo
  ? (await import('./next.config.demo.mjs')).default
  : {};
export default config;
