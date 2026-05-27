# Vercel Deployment Fix

This patch removes the generated package-lock.json that contained sandbox-internal npm tarball URLs and pins the project to stable public npm package versions.

## What changed

1. Removed package-lock.json from the deployable package.
2. Pinned dependencies instead of using latest.
3. Added Node 20.x through package.json engines.
4. Added .npmrc pointing to the public npm registry.
5. Added vercel.json with explicit Vite build settings.
6. Changed PostCSS configuration from Tailwind v4 plugin syntax to Tailwind v3 syntax.

## Local test

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run build
```

## Vercel settings

Framework Preset: Vite
Install Command: npm install --no-audit --no-fund
Build Command: npm run build
Output Directory: dist
Node.js Version: 20.x
```
