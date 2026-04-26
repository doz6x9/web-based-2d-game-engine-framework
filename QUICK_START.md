# Quick Start Guide - Game Engine Features

## 🎮 Running the Project

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Server runs at: **http://localhost:5173/**

---

## 🌍 Custom Terrain Types

### Add Custom Terrain
```typescript
import { TileRegistry } from './engine/core/TileRegistry'

// Register custom terrain
TileRegistry.registerTile('custom', {
  name: 'Custom Terrain',
  cost: 1.5,
  walkable: true,
  color: 0xFF00FF,
  sprite: 'custom-sprite'
})

// Use in pathfinding
const cost = TileRegistry.getCost('custom')
const isWalkable = TileRegistry.isWalkable('custom')
const color = TileRegistry.getColor('custom')
```

### Default Terrains
- grass (cost: 1.0)
- road (cost: 0.5) - fast travel
- swamp (cost: 3.0) - slow travel
- water (cost: ∞) - impassable
- wall (cost: ∞) - impassable
- tree (cost: 1.5)
- sand (cost: 1.2)
- lava (cost: ∞)
- ice (cost: 0.7)
- mud (cost: 2.0)

---

## 🤖 NPC AI System

### Create and Register NPC
```typescript
import { NPC } from './engine/core/MapObject'
import { Vector } from './engine/core/Vector'

const npc = new NPC('npc_1', new Vector(10, 10))
npc.setPatrolPath([
  new Vector(10, 10),
  new Vector(20, 20),
  new Vector(10, 20)
])

gameEngine.addMapObject(npc)
gameEngine.getAISystem().registerNPC(npc)
```

### NPC Behaviors
- **Patrol**: Walks waypoints
- **Chase**: Follows player when visible
- **Idle**: Waits passively
- **Combat**: Moves to attack range

### NPC Properties
```typescript
npc.visionRange = 15        // How far can see
npc.attackRange = 2         // Distance to attack
npc.setTarget(playerPos)    // Set target
npc.setState('patrol')      // Set AI state
```

---

## 🎬 Animation System

### Create Animation
```typescript
import { AnimationLibrary, AnimationDefinition } from './engine/render/Animation'

const library = gameEngine.getAnimationLibrary()

const walkDef: AnimationDefinition = {
  frameCount: 4,
  frameDuration: 100,
  frames: [0, 1, 2, 3],
  loop: true
}

library.registerAnimation('walk', walkDef)
```

### Play Animation
```typescript
const controller = new AnimationController(walkDef)
controller.play()
controller.pause()
controller.resume()
controller.stop()
```

### Tween Properties
```typescript
import { Tween, EasingFunction } from './engine/render/Animation'

const tween = new Tween(0, 100, 1000, EasingFunction.easeInOutQuad)
tween.start()
```

### Easing Functions
- linear
- easeInQuad / easeOutQuad / easeInOutQuad
- easeInCubic / easeOutCubic / easeInOutCubic
- easeInQuart / easeOutQuart / easeInOutQuart
- easeInQuint / easeOutQuint / easeInOutQuint

---

## ✨ Particle Effects

### Create Particle Emitter
```typescript
import { ParticlePresets } from './engine/render/Particles'

const particles = gameEngine.getParticleSystem()

const emitter = particles.createEmitter(
  new Vector(100, 100),
  ParticlePresets.EXPLOSION
)

particles.addEmitter(emitter)
```

### Preset Effects
```typescript
// Explosion: Yellow burst with gravity
ParticlePresets.EXPLOSION

// Spark: Small white sparks, fast decay
ParticlePresets.SPARK

// Blood: Red particles with slow fade
ParticlePresets.BLOOD

// Heal: Green upward particles
ParticlePresets.HEAL

// Magic: Purple sparkles with curves
ParticlePresets.MAGIC

// Dust: Gray particles settling
ParticlePresets.DUST
```

### Custom Emitter
```typescript
const config = {
  particleCount: 20,
  speed: 100,
  direction: new Vector(0, -1),
  gravity: new Vector(0, 50),
  acceleration: new Vector(0, 0),
  friction: 0.98,
  lifetime: 2000,
  startAlpha: 1.0,
  endAlpha: 0.0,
  color: 0xFF0000
}

const emitter = particles.createEmitter(pos, config)
```

---

## 💾 Save/Load System

### Save Game
```typescript
// Save to slot 0
gameEngine.saveGame(0)

// Quick save
gameEngine.quickSave()

// Automatic save to slot 998
// (Can be configured)
```

### Load Game
```typescript
// Load from slot 0
gameEngine.loadGame(0)

// Quick load
gameEngine.quickLoad()
```

### Save Slots
- Slots 0-9: Regular saves
- Slot 999: Quick save
- Slot 998: Auto save

### Game State Saved
```typescript
{
  playerPosition: { x, y },
  mapName: string,
  npcs: NPC[],
  mapObjects: MapObject[],
  exploredCells: Set<string>,
  fogOfWar: FogOfWarState[][]
}
```

---

## 📝 Level Editor

### Create New Map
```typescript
const editor = gameEngine.getEditor()

const map = editor.createMap(40, 30, 'my-level')
editor.loadMap(map)
```

### Painting Tiles
```typescript
editor.setCurrentTile('grass')
editor.paintTile(10, 10, 'grass')
editor.fillArea(20, 20, 'wall')  // Flood fill
```

### Selection & Clipboard
```typescript
editor.selectRectangle(5, 5, 15, 15)
editor.copy()
editor.paste(25, 25)
```

### Editor Tools
```typescript
import { EditorTool } from './engine/editor/LevelEditor'

editor.setTool(EditorTool.PAINT)    // Paint tiles
editor.setTool(EditorTool.SELECT)   // Select area
editor.setTool(EditorTool.ERASE)    // Erase tiles
editor.setTool(EditorTool.PLACE_OBJECT)   // Add objects
editor.setTool(EditorTool.DELETE_OBJECT)  // Remove objects
```

### Undo/Redo
```typescript
editor.undo()
editor.redo()

if (editor.canUndo()) editor.undo()
if (editor.canRedo()) editor.redo()
```

### Export Map
```typescript
const mapJSON = editor.exportMap()
// Save to file or send to server
```

### Create UI Components
```typescript
import { EditorUI } from './engine/editor/LevelEditor'

const toolbar = EditorUI.createToolbar()
const tileButton = EditorUI.createToolButton('paint', 'Paint')
const layerPanel = EditorUI.createLayerPanel()
const palette = EditorUI.createTilePalette(tileMap)
```

---

## 🏗️ System Integration

### Access Systems from GameEngine
```typescript
const aiSystem = gameEngine.getAISystem()
const particles = gameEngine.getParticleSystem()
const animations = gameEngine.getAnimationLibrary()
const editor = gameEngine.getEditor()
const renderer = gameEngine.getRenderer()
const mouseHandler = gameEngine.getMouseHandler()
```

### Add Custom Objects
```typescript
import { MapObject } from './engine/core/MapObject'

const obj = new MapObject('obj_1', new Vector(15, 15))
gameEngine.addMapObject(obj)
gameEngine.removeMapObject('obj_1')
gameEngine.getMapObject('obj_1')
```

### Game Events
```typescript
// Particle effects on click
gameEngine.getMouseHandler().onEvent((type, pos) => {
  if (type === MouseEventType.LEFT_CLICK) {
    gameEngine.getParticleSystem()
      .createEmitter(pos, ParticlePresets.SPARK)
  }
})
```

---

## 📊 Performance Tips

### Optimize NPC AI
```typescript
// NPCs update every 2 frames by default
// Reduce vision range for large maps
npc.visionRange = 10
```

### Manage Particles
```typescript
// Remove old emitters
particles.removeEmitter(emitter)

// Limit particle count
const config = ParticlePresets.EXPLOSION
config.particleCount = 10  // Reduce from 20
```

### Cache Pathfinding
```typescript
// Store path, reuse if target unchanged
const path = aiSystem.findPath(from, to)
aiSystem.followPath(npc, path)
```

### Update FOV on Move Only
```typescript
// FOV automatically updates in render()
// Called only when player moves
```

---

## 🐛 Debugging

### Check if System is Initialized
```typescript
const engine = new GameEngine(canvas, 1280, 720)
console.log('AISystem:', engine.getAISystem())
console.log('Particles:', engine.getParticleSystem())
console.log('Animations:', engine.getAnimationLibrary())
console.log('Editor:', engine.getEditor())
```

### Monitor Save System
```typescript
const manager = new SaveLoadManager()
const saves = manager.getAllSaves()
console.log('Available saves:', saves)
```

### Validate Custom Terrain
```typescript
const cost = TileRegistry.getCost('custom')
const walkable = TileRegistry.isWalkable('custom')
console.log(`Cost: ${cost}, Walkable: ${walkable}`)
```

---

## 📚 Full Examples

### Complete Game Loop with All Features
```typescript
import { GameEngine } from './engine/GameEngine'
import { NPC, Enemy } from './engine/core/MapObject'
import { Vector } from './engine/core/Vector'
import { ParticlePresets } from './engine/render/Particles'

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement
const engine = new GameEngine(canvas, 1280, 720)

// Load map
await engine.loadMap('/maps/test-map.json')

// Create NPCs
const npc1 = new NPC('guard_1', new Vector(20, 20))
npc1.setPatrolPath([new Vector(20, 20), new Vector(40, 20)])
engine.addMapObject(npc1)
engine.getAISystem().registerNPC(npc1)

// Setup events
engine.getMouseHandler().onEvent((type, pos) => {
  // Particle effects on click
  const particles = engine.getParticleSystem()
  particles.addEmitter(particles.createEmitter(pos, ParticlePresets.SPARK))
})

// Save on key press
document.addEventListener('keydown', (e) => {
  if (e.key === 's') engine.quickSave()
  if (e.key === 'l') engine.quickLoad()
})

// Game runs in game loop (automatically via requestAnimationFrame)
```

---

## 🚀 Next Steps

1. **Add NPCs to test map JSON** - Create NPC definitions in the map
2. **Implement gameplay** - Add game logic and win conditions
3. **Create levels** - Use level editor to build more maps
4. **Add animations** - Define sprite animations for entities
5. **Polish UI** - Create save/load and editor UIs
6. **Add sounds** - Implement audio system
7. **Deploy** - Build and host on web server

---

**For detailed documentation**, see:
- `COMPLETION_SUMMARY.md` - Full feature descriptions
- `VALIDATION_REPORT.md` - Implementation details
- `README.md` - Project overview
- `ARCHITECTURE.md` - System design

