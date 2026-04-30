# 2D Web-Based Game Engine Framework (Core Engine Branch)

A modular, event-driven TypeScript 2D square grid game engine built with PixiJS. 

> **Note:** This branch (`engineFramework`) contains the **pure, decoupled engine core**. It provides rendering, pathfinding, visibility algorithms, and an event system. **It does not contain any specific game logic (like health, inventory, or specific enemy AI).** To see a fully playable game built on top of this framework, check out the `develop` branch.

## 🚀 Framework Features
* **Decoupled Architecture:** Strictly separates rendering and algorithms from game logic using an Event-Driven architecture.
* **Core Rendering:** Multi-layered map system powered by WebGL (PixiJS 8.x) with automatic camera tracking.
* **Advanced Algorithms Built-in:**  
  * Optimal A* Pathfinding with terrain costs (e.g., roads, swamps).
  * Real-time Ray-casting Field of View (FOV) with shadows.  
  * Three-state Fog of War (Unknown, Explored, Visible).  
  * Flood-fill algorithms for room visibility.
* **Generic Entity System:** A flexible `IEntity` interface allows you to define any game object (Player, NPC, Chest, Door) in your own application code.

## 📦 Installation & Setup

**Prerequisites:** Node.js 16+ and npm/yarn.

1. Clone the repository and checkout this branch:
   ```bash
   git clone <your-repo-url>
   git checkout engineFramework
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🛠️ How to Build a Game Using This Framework

This framework uses Dependency Inversion. The engine handles the heavy lifting (graphics, algorithms, grid math), and your application listens to engine events to execute game logic.

### 1. Initialize the Engine
First, instantiate the engine, define your assets, and call `init()`.
```typescript
import { GameEngine } from './engine/GameEngine';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const engine = new GameEngine();

const assets = [
  { id: 'player', path: '/assets/hero.png' },
  { id: 'goblin', path: '/assets/goblin.png' },
  // ... environment textures
];

// Initialize engine and load the first map
await engine.init(canvas, 1280, 720, assets, '/maps/level1.json');
```

### 2. Define Your Game Entities
Instead of modifying the engine, create your own classes that implement the framework's `IEntity` interface.
```typescript
import { IEntity, Vector } from './engine/GameEngine'; // Adjust import path

export class Player implements IEntity {
  id: string = 'player_1';
  position: Vector;
  spriteName = 'player'; // Must match an asset ID
  isActive: boolean = true;
  health: number = 100;

  constructor(startX: number, startY: number) {
    this.position = new Vector(startX, startY);
  }

  update(deltaTime: number): void {
    // Handle player-specific update logic (e.g., smooth movement interpolation)
  }

  onInteract(): void {
    // Logic for when something interacts with the player
  }
}
```

### 3. Listen for Map Loading to Spawn Entities
When a map JSON is loaded, the engine emits a `mapLoaded` event. Use this to parse the custom objects array in your JSON and spawn your entities.
```typescript
engine.on('mapLoaded', (mapData) => {
  console.log("Map loaded! Spawning entities...");
  
  if (mapData.objects) {
    mapData.objects.forEach((obj: any) => {
      if (obj.type === "PLAYER_SPAWN") {
        const player = new Player(obj.x, obj.y);
        engine.addEntity(player);
      }
      if (obj.type === "ENEMY") {
        const enemy = new Enemy(obj.x, obj.y); // Assuming you made an Enemy class
        engine.addEntity(enemy);
      }
    });
  }
});
```

### 4. Handle Input & Game Logic
The framework automatically converts screen clicks to grid coordinates and emits them. Listen to these events to trigger your game mechanics (like pathfinding or combat).
```typescript
engine.on('gridClick', (x: number, y: number, button: string) => {
  const targetPos = new Vector(x, y);

  if (button === 'right') {
    // Example: Move player using framework's A* Pathfinder
    const player = engine.getEntity('player_1');
    if (player) {
      const path = engine.pathfinder.findPath(player.position, targetPos);
      // ... pass path to player class to begin movement
    }
  }

  if (button === 'left') {
    // Example: Check for combat
    const clickedEntity = engine.getAllEntities().find(e => e.position.equals(targetPos));
    if (clickedEntity && clickedEntity.id.startsWith('enemy')) {
      console.log("Attacking enemy!");
      // ... execute your custom combat math
    }
  }
});
```

### 5. Hooking into the Game Loop
If you need a global game state manager (e.g., checking win/loss conditions), listen to the engine's update and render events:
```typescript
engine.on('update', (deltaTime: number) => {
  // Check global game rules, manage UI, update turn-based systems
});

engine.on('beforeRender', () => {
  // E.g., center the framework's camera on the player before drawing
  const player = engine.getEntity('player_1');
  if (player) {
    engine.renderer.getCamera().centerOn(player.position);
  }
});
```

## 📡 Engine Event API Reference
The `GameEngine` extends a custom EventEmitter. Available events include:

| Event Name | Callback Arguments | Description |
|---|---|---|
| `mapLoaded` | `(mapData: any)` | Fired when a JSON map finishes parsing. |
| `gridClick` | `(x: number, y: number, button: 'left' \| 'right')` | Fired when the canvas is clicked. Coordinates are already converted to the grid! |
| `gridHover` | `(x: number, y: number)` | Fired on mouse movement over the grid. |
| `update` | `(deltaTime: number)` | Fired every tick before entities update. |
| `beforeRender`| `()` | Fired right before the PixiJS rendering pipeline begins. |
| `afterRender` | `(renderer: Renderer)` | Fired after the map and entities are drawn. |

## 🗺️ Map JSON Format Expected
The engine requires maps defined in a specific multi-layered JSON structure:
```json
{
  "name": "Level 1",
  "width": 40,
  "height": 30,
  "layers": [
    {
      "name": "terrain",
      "data": [[2, 2, 2], [2, 2, 2]] 
    },
    {
      "name": "collision",
      "data": [[0, 1, 0], [0, 1, 0]]
    }
  ],
  "objects": [
    { "type": "PLAYER_SPAWN", "x": 5, "y": 5 },
    { "type": "ENEMY", "x": 10, "y": 8 }
  ]
}
```
*(Note: Tile types (0=Empty, 1=Wall, 2=Grass, 3=Swamp, 4=Road, 5=Water) dictate A* pathfinding movement costs automatically).*

## 📄 License & Academic Integrity
This framework was developed as part of a university thesis project focused on advanced algorithms and decoupled software architecture in web-based game engines. Provided as-is for educational purposes.