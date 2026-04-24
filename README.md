# 2D Web-Based Game Engine Framework

A comprehensive TypeScript-based 2D square grid game engine built with PixiJS, featuring advanced algorithms for pathfinding, field of view calculation, fog of war, and room visibility management.

## Features

### Core Rendering
- **Multi-layered Map System**: Support for multiple rendering layers (terrain, entities, effects)
- **PixiJS Integration**: WebGL/Canvas-based rendering optimized for performance
- **Dynamic Camera/View Management**: Automatic viewport centering and boundary management
- **Grid-based Rendering**: 32x32 pixel tiles with customizable colors and styling

### Advanced Algorithms
- **A* Pathfinding**: Optimal path calculation with terrain cost consideration
  - Supports different terrain types (grass, swamp, road, water, etc.)
  - Considers walkability and movement costs
  
- **Dynamic Field of View (FOV)**
  - Ray-casting based visibility calculation
  - Shadow casting from obstacles
  - Support for multiple light sources
  
- **Fog of War System**
  - Three visibility states: Unknown, Explored, Visible
  - Dynamic exploration tracking
  - Greyed-out exploration memory
  
- **Room Visibility (Flood Fill)**
  - Identify connected rooms
  - Determine visible rooms from openings
  - Check if positions are in the same room

### User Interaction
- **Mouse Controls**
  - Left click: Select target/interact
  - Right click: Move character
  - Real-time coordinate tracking
  
- **Grid Coordinate Conversion**: Seamless conversion between screen and world coordinates

## Project Structure

```
src/
├── engine/
│   ├── core/
│   │   ├── Vector.ts          # 2D vector math utilities
│   │   └── Grid.ts            # Grid management and cell types
│   ├── algorithms/
│   │   ├── AStar.ts           # A* pathfinding algorithm
│   │   ├── FieldOfView.ts     # FOV calculation with shadows
│   │   ├── FloodFill.ts       # Room visibility algorithm
│   │   └── FogOfWar.ts        # Fog of war tracking system
│   ├── map/
│   │   └── MapLayer.ts        # Multi-layer map definitions and loading
│   ├── render/
│   │   └── Renderer.ts        # PixiJS renderer and camera system
│   ├── interaction/
│   │   └── MouseHandler.ts    # Mouse event handling
│   └── GameEngine.ts          # Main orchestration class
├── styles/
│   └── main.scss              # Game UI styling
└── main.ts                    # Application entry point

public/
├── maps/
│   └── test-map.json          # Demo map definition
└── assets/                    # Sprite and texture assets

```

## Map JSON Format

Maps are defined in JSON with multiple layers:

```json
{
  "name": "Map Name",
  "width": 40,
  "height": 30,
  "layers": [
    {
      "name": "terrain",
      "data": [[1, 2, 3, ...], ...]
    },
    {
      "name": "collision",
      "data": [[0, 1, 0, ...], ...]
    }
  ]
}
```

### Tile Types
- `0`: Empty/Walkable (grass)
- `1`: Wall/Obstacle
- `2`: Grass
- `3`: Swamp (high movement cost)
- `4`: Road (low movement cost)
- `5`: Water (non-walkable)

## Installation & Setup

### Prerequisites
- Node.js 16+
- npm or yarn

### Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The output will be in the `dist/` directory.

## Usage

### Basic Game Engine Usage

```typescript
import { GameEngine } from './engine/GameEngine';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const engine = new GameEngine(canvas, 1280, 720);

// Load a map
await engine.loadMap('/maps/test-map.json');

// Position the player
engine.setPlayerPosition(new Vector(10, 10));
```

### Using Pathfinding

```typescript
import { AStarPathfinder } from './engine/algorithms/AStar';
import { Vector } from './engine/core/Vector';

const pathfinder = new AStarPathfinder(grid);
const path = pathfinder.findPath(start, goal);
```

### Calculating Field of View

```typescript
import { FieldOfView } from './engine/algorithms/FieldOfView';

const fov = new FieldOfView(grid);
const visibleCells = fov.calculateFOV(playerPosition, 10);
```

### Fog of War Tracking

```typescript
import { FogOfWar } from './engine/algorithms/FogOfWar';

const fogOfWar = new FogOfWar(mapWidth, mapHeight, fov);
fogOfWar.updateFromFOV(visibleCells);

const state = fogOfWar.getFogState(x, y); // UNKNOWN | EXPLORED | VISIBLE
```

## Demo Features

The included demo demonstrates:
- ✅ Multi-layered map rendering
- ✅ Dynamic field of view calculation
- ✅ Fog of war with exploration memory
- ✅ A* pathfinding with terrain costs
- ✅ Real-time player interaction
- ✅ Camera following player
- ✅ Mouse-based grid coordinate system
- ✅ Responsive UI with coordinate display

## Controls

| Action | Effect |
|--------|--------|
| Left Click | Select target cell (shows pathfinding visualization) |
| Right Click | Move player to clicked cell |
| Mouse Move | Updates coordinate display |

The FOV is dynamically recalculated based on the player's position, and the fog of war reflects explored areas and current visibility.

## Architecture Highlights

### Separation of Concerns
- **Grid System**: Handles grid data and walkability
- **Algorithms**: Pure logic for pathfinding, visibility, etc.
- **Renderer**: PixiJS rendering abstraction
- **Interaction**: Input handling and event dispatch
- **GameEngine**: Orchestrates all systems

### Performance Optimizations
- PixiJS WebGL rendering for efficient sprite management
- Heuristic-based A* for faster pathfinding
- Efficient FOV ray-casting
- Cell-based flood fill for room detection

### Extensibility
- Modular architecture allows easy addition of new features
- Pluggable renderer (can swap PixiJS with another)
- Customizable tile colors and properties
- Support for arbitrary number of map layers

## Technologies Used

- **TypeScript**: Type-safe game logic
- **PixiJS 8.x**: High-performance 2D rendering
- **Vite**: Fast build tool and dev server
- **SCSS**: Styled component styling
- **HTML5 Canvas**: Core rendering target

## Future Enhancements

- [ ] Animated sprites and effects
- [ ] Multiple light sources with distance falloff
- [ ] Dynamic pathfinding weights based on FOV
- [ ] Tile-based animation system
- [ ] Particle effects
- [ ] Sound effects and music system
- [ ] Save/load game state
- [ ] Multiplayer support
- [ ] Mobile touch controls
- [ ] Asset loader with caching

## License

This project is provided as-is for educational and development purposes.

## Contributing

This is a framework designed for game development projects. Feel free to extend and customize it for your needs!

---

For more information and updates, visit the project repository.
