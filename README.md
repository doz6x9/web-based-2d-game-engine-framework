# Web-Based 2D Game Engine Framework

A modular TypeScript framework for browser-based 2D grid games, powered by PixiJS. It provides rendering, map loading, pathfinding, visibility, fog of war, particles, input handling, animation helpers, and a small editor toolkit while keeping game-specific rules in your application.

## Features

- PixiJS 8 renderer with layered tile maps, camera control, sprite containers, particles, markers, and fog overlays.
- Grid primitives, vectors, tile definitions, map parsing, and generic entity contracts.
- A* pathfinding with terrain costs, raycast/shadowcast field of view, fog of war, and flood fill utilities.
- Event-driven engine lifecycle with typed events for map loading, input, update, and render hooks.
- ESM and CommonJS package output with TypeScript declaration files.
- Demo app remains available locally through Vite, separate from the npm package build.

## Install

```bash
npm install web-based-2d-game-engine-framework pixi.js
```

PixiJS is a peer dependency so host applications can control their renderer version.

## Quick Start

```ts
import { GameEngine, Vector, type AssetConfig, type IEntity } from 'web-based-2d-game-engine-framework';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const engine = new GameEngine();

const assets: AssetConfig[] = [
  { id: 'grass', path: '/assets/grass.png' },
  { id: 'hero', path: '/assets/hero.png' },
];

await engine.initWithOptions({
  canvas,
  width: 1280,
  height: 720,
  assets,
  initialMapUrl: '/maps/level-1.json',
});

class Player implements IEntity {
  id = 'player';
  position = new Vector(2, 2);
  spriteName = 'hero';
  isActive = true;

  update(deltaTime: number): void {
    // Put game-specific movement, combat, or interaction logic here.
  }
}

engine.on('mapLoaded', () => {
  engine.addEntity(new Player());
});

engine.on('gridClick', (x, y, button) => {
  if (button !== 'right') return;

  const player = engine.getEntity('player');
  if (!player) return;

  const path = engine.pathfinder.findPath(player.position, new Vector(x, y));
  console.log(path);
});
```

## Public API

Import from the package root:

```ts
import {
  GameEngine,
  Renderer,
  Grid,
  Vector,
  TileRegistry,
  AStarPathfinder,
  FieldOfView,
  FogOfWar,
  FloodFill,
  ParticleSystem,
  AnimationLibrary,
  LevelEditor,
} from 'web-based-2d-game-engine-framework';
```

The root export intentionally exposes engine building blocks instead of forcing one game architecture. Use `GameEngine` for an integrated runtime, or compose lower-level modules directly for custom tools, simulations, editors, and tests.

## Map Format

Maps are JSON objects with named layers. A `terrain` layer defines tile types; an optional `collision` layer can override walkability.

```json
{
  "name": "Level 1",
  "width": 40,
  "height": 30,
  "layers": [
    { "name": "terrain", "data": [[0, 0, 0], [0, 4, 0]] },
    { "name": "collision", "data": [[0, 1, 0], [0, 0, 0]] }
  ],
  "objects": [
    { "type": "PLAYER_SPAWN", "x": 5, "y": 5 }
  ]
}
```

`MapLoader` also accepts flat one-dimensional layer data, which is useful for maps exported from tile editors.

## Engine Events

| Event | Callback |
| --- | --- |
| `mapLoaded` | `(mapData)` |
| `gridClick` | `(x, y, button)` |
| `gridHover` | `(x, y)` |
| `update` | `(deltaTime)` |
| `beforeRender` | `()` |
| `afterRender` | `(renderer)` |

## Local Development

```bash
npm install
npm run dev
```

Useful scripts:

- `npm run build` builds the npm package into `dist/`.
- `npm run build:demo` builds the local demo app into `dist-demo/`.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm pack --dry-run` verifies the exact package contents before publishing.

## Publish Checklist

1. Update `name`, `version`, `author`, `repository`, and `keywords` in `package.json`.
2. Run `npm run build`.
3. Run `npm pack --dry-run` and check that only package files are included.
4. Publish with `npm publish --access public` when ready.

## License

MIT
