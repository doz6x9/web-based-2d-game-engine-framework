# Web-Based 2D Game Engine Framework

This repository is an npm workspaces monorepo:

- `packages/engine` is the engine, published to npm as `web-based-2d-game-engine-framework`. See its [README](packages/engine/README.md).
- `apps/demo` is a demo game that imports the engine only by its package name, so it always runs on what gets published.

## Development

```bash
npm install
npm run build:engine   # build the engine package (dist/)
npm run dev            # build the engine, then start the demo dev server
npm run build          # build the engine, then the demo
```
