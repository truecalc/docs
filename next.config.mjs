import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  reactStrictMode: true,
  // Set NEXT_PUBLIC_BASE_PATH=/docs when deploying to GitHub Pages
  // (site is served from https://truecalc.github.io/docs/).
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
};

export default withMDX(config);
