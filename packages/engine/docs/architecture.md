# Engine Architecture

These diagrams are drawn from the engine's TypeScript source (`src/`). They show the public API only; private helpers are left out. GitHub renders the Mermaid blocks as diagrams.

- [Module overview](#module-overview)
- [Class diagrams](#class-diagrams): [core and map](#core-and-map), [algorithms](#algorithms), [rendering](#rendering), [interaction](#interaction), [lighting](#lighting)
- [Sequence diagrams](#sequence-diagrams): [startup and map loading](#startup-and-map-loading), [one frame](#one-frame), [click to move](#click-to-move-a-and-field-of-view), [opening a door](#opening-a-door-flood-fill-room-reveal)

## Module overview

`GameEngine` owns one instance of each subsystem and wires them together. Game rules (combat, keys, items) live in the application, which talks to the engine through its public fields and events.

```mermaid
flowchart TB
  App["Game / application code"]
  subgraph Engine["GameEngine"]
    direction TB
    Events["EventEmitter<br/>mapLoaded · gridClick · gridHover<br/>update · beforeRender · afterRender · viewResized"]
    subgraph Map["map/"]
      MapLoader --> GameMap --> MapLayer
    end
    subgraph Core["core/"]
      Grid
      TileRegistry
      Vector
    end
    subgraph Algorithms["algorithms/"]
      AStar["AStarPathfinder"]
      FOV["FieldOfView"]
      Fog["FogOfWar"]
      Flood["FloodFill"]
    end
    Lighting["systems/LightingSystem"]
    subgraph Render["render/"]
      Renderer --> Camera
      Particles["ParticleSystem"]
      Anim["AnimationLibrary"]
    end
    subgraph Input["interaction/"]
      Mouse["MouseHandler"]
      Keys["KeyboardHandler"]
    end
  end
  Pixi[("PixiJS 8")]

  App -- "init, loadMap, addEntity, revealRoom" --> Engine
  Events -- "callbacks" --> App
  GameMap -- "ground + collision layers" --> Grid
  Grid -- "walkable, cost" --> TileRegistry
  AStar --> Grid
  FOV --> Grid
  Flood --> Grid
  Lighting -- "one FOV per light" --> FOV
  Lighting -- "visible set" --> Fog
  Renderer -- "tiles by TileRegistry sprite" --> TileRegistry
  Renderer -- "draws" --> GameMap
  Renderer -- "draws" --> Fog
  Mouse -- "screenToWorld" --> Camera
  Renderer --> Pixi
```

## Class diagrams

### Core and map

A map file is parsed into a `GameMap` of `MapLayer`s. Each layer has a role: the ground and collision layers fill the `Grid`, overlay layers are only drawn. Every cell's walkability and cost come from `TileRegistry`.

```mermaid
classDiagram
  direction LR
  class MapLoader {
    +MapLayerNames DEFAULT_LAYER_NAMES$
    +parseMapJSON(mapData, names)$ GameMap
    +createCollisionLayer(...)$ MapLayer
  }
  class GameMap {
    +addLayer(layer)
    +getLayer(index) MapLayer
    +getLayerByName(name) MapLayer
    +getLayers() MapLayer[]
    +getGroundLayer() MapLayer
    +getCollisionLayer() MapLayer
    +getWidth() number
    +getHeight() number
  }
  class MapLayer {
    +getName() string
    +getRole() MapLayerRole
    +setRole(role)
    +getCell(x, y) number
    +getData() number[][]
  }
  class MapLayerRole {
    <<type>>
    ground
    collision
    overlay
  }
  class Grid {
    +resize(width, height)
    +getCell(x, y) Cell
    +setCellType(x, y, type)
    +isInBounds(x, y) boolean
    +getNeighbors(x, y, diagonal) Vector[]
    +getWidth() number
    +getHeight() number
  }
  class Cell {
    <<interface>>
    +x number
    +y number
    +type CellType
    +walkable boolean
    +cost number
  }
  class TileRegistry {
    +registerTile(id, definition)$
    +getTile(id)$ TileDefinition
    +isWalkable(id)$ boolean
    +getCost(id)$ number
    +getSprite(id)$ string
    +getColor(id)$ number
  }
  class TileDefinition {
    <<interface>>
    +cost number
    +walkable boolean
    +sprite string
    +name string
    +color number
  }
  class Vector {
    +x number
    +y number
    +add(other) Vector
    +subtract(other) Vector
    +scale(s) Vector
    +manhattanDistance(other) number
    +euclideanDistance(other) number
    +equals(other) boolean
    +key() string
  }
  MapLoader ..> GameMap : creates
  GameMap "1" *-- "many" MapLayer
  MapLayer --> MapLayerRole
  Grid "1" *-- "many" Cell
  Grid ..> TileRegistry : walkable and cost
  TileRegistry o-- TileDefinition
```

### Algorithms

All four algorithms read the same `Grid`, so a change to a cell (a door opening) is seen by pathfinding, sight and flood fill at once. Cells are passed around as `"x,y"` string keys.

```mermaid
classDiagram
  direction LR
  class AStarPathfinder {
    +findPath(start, goal) Vector[]
  }
  class FieldOfView {
    +calculateFOV(source, radius, algorithm) Set~string~
    +calculateMultipleFOV(sources, falloff) Map
    +isVisible(x, y) boolean
    +getVisibleCells() Set~string~
    +getShadowCells() Set~string~
    +isTargetVisible(from, to) boolean
  }
  class FogOfWar {
    +version number
    +updateFromFOV(cells)
    +markMultipleExplored(cells)
    +getFogState(x, y) FogState
    +isVisible(x, y) boolean
    +isExplored(x, y) boolean
    +reset()
  }
  class FogState {
    <<enumeration>>
    UNKNOWN
    EXPLORED
    VISIBLE
  }
  class FloodFill {
    +fillRoom(start, maxCells) Set~string~
    +findAllRooms() Map
    +isInSameRoom(a, b) boolean
  }
  class Grid
  AStarPathfinder --> Grid
  FieldOfView --> Grid
  FloodFill --> Grid
  FogOfWar --> FogState
  FogOfWar ..> FieldOfView : optional
```

`calculateFOV` takes `'raycast'` (rays to the edge of the radius) or `'shadowcast'` (recursive symmetric shadowcasting over eight octants). Both stop light passing between two walls that touch diagonally.

### Rendering

```mermaid
classDiagram
  direction LR
  class Renderer {
    +camera Camera
    +tileSize number
    +fogStyle
    +init(canvas, width, height, mapW, mapH)
    +loadAssets(assets)
    +loadSpritesheet(path) string[]
    +getTexture(id) Texture
    +renderMap(map)
    +renderFogOfWar(fog, mapW, mapH)
    +renderParticles(particles)
    +showClickCoordinates(x, y, button)
    +drawMarker(x, y, color, size)
    +createSprite(id, x, y) Sprite
    +updateSpritePosition(sprite, x, y)
    +applyCameraTransform()
    +resize(width, height)
    +clearMapCache()
  }
  class Camera {
    +width number
    +height number
    +mapWidth number
    +mapHeight number
    +zoom number
    +offsetX number
    +offsetY number
    +centerOn(target)
    +fitZoomToMap(maxZoom) number
    +getPosition() Vector
    +screenToWorld(x, y) Vector
    +worldToScreen(x, y) Vector
    +getViewWidthInTiles() number
    +getViewHeightInTiles() number
  }
  class ParticleSystem
  class ParticleEmitter
  class AnimationLibrary
  class AnimationController
  class Tween
  Renderer *-- Camera
  ParticleSystem o-- ParticleEmitter
  AnimationController ..> AnimationLibrary : plays definitions from
```

Draw order inside the world container, bottom to top: one container per non-collision map layer (ground first, then overlays in file order), entity sprites, particles, fog, field-of-view debug, markers, click labels.

### Interaction

```mermaid
classDiagram
  direction LR
  class MouseHandler {
    +on(type, callback)
    +getMousePosition() Vector
    +destroy()
  }
  class MouseEventType {
    <<enumeration>>
    LEFT_CLICK
    RIGHT_CLICK
    MOVE
  }
  class ICamera {
    <<interface>>
    +width number
    +height number
    +screenToWorld(x, y) Vector
  }
  class KeyboardHandler {
    +on(type, callback)
    +off(type, callback)
    +isKeyPressed(code) boolean
    +destroy()
  }
  class Camera
  MouseHandler --> ICamera
  MouseHandler --> MouseEventType
  Camera ..|> ICamera
```

### Lighting

```mermaid
classDiagram
  direction LR
  class LightingSystem {
    +addLight(light)
    +removeLight(id) boolean
    +getLight(id) Light
    +getLights() Light[]
    +setEnabled(id, enabled)
    +markDirty()
    +getVisibleCells() Set~string~
    +isLit(x, y) boolean
    +update(fog) boolean
    +clear()
  }
  class Light {
    <<interface>>
    +id string
    +position Vector
    +radius number
    +enabled boolean
    +hiddenUntilExplored boolean
  }
  class GameEngine {
    +map GameMap
    +grid Grid
    +renderer Renderer
    +pathfinder AStarPathfinder
    +fov FieldOfView
    +fogOfWar FogOfWar
    +floodFill FloodFill
    +lighting LightingSystem
    +init(...)
    +initWithOptions(options)
    +loadMap(url)
    +loadMapData(json)
    +addEntity(entity)
    +removeEntity(id)
    +getEntity(id) IEntity
    +getSpawnPoint() Vector
    +revealRoom(start, maxCells, includeWalls) Set~string~
    +fitViewToMap()
    +startGameLoop()
    +stopGameLoop()
    +destroy()
  }
  class IEntity {
    <<interface>>
    +id string
    +position Vector
    +spriteName string
    +isActive boolean
    +update(deltaTime)
  }
  LightingSystem o-- Light
  LightingSystem --> FieldOfView
  LightingSystem ..> FogOfWar : updateFromFOV
  GameEngine *-- LightingSystem
  GameEngine o-- IEntity
```

A light's `position` is read every frame, so a light shares the player's `Vector` to follow it. Lighting only recalculates when a light moved, changed or was toggled, or after `markDirty()`.

## Sequence diagrams

### Startup and map loading

```mermaid
sequenceDiagram
  autonumber
  participant App
  participant E as GameEngine
  participant R as Renderer
  participant ML as MapLoader
  participant G as Grid
  participant TR as TileRegistry

  App->>E: initWithOptions({ canvas, width, height, assets, initialMapUrl })
  E->>R: init(canvas, width, height)
  E->>E: new MouseHandler(canvas, camera)
  E->>R: loadAssets(assets)
  E->>E: loadMap(url): fetch JSON
  E->>ML: parseMapJSON(json, layerNames)
  ML-->>E: GameMap (layers with roles)
  E->>G: resize(width, height)
  loop every cell
    E->>G: setCellType(x, y, collision ≠ 0 ? collision : ground)
    G->>TR: isWalkable(type), getCost(type)
  end
  E->>E: new FogOfWar, lighting.markDirty()
  E->>E: fitViewToMap(): zoom, canvas size, centre
  E-->>App: emit mapLoaded(json)
  App->>E: addEntity(player), lighting.addLight(...)
  E->>E: setupInputHandlers(), startGameLoop()
```

### One frame

```mermaid
sequenceDiagram
  autonumber
  participant T as PixiJS ticker
  participant E as GameEngine
  participant App
  participant L as LightingSystem
  participant F as FieldOfView
  participant Fog as FogOfWar
  participant R as Renderer

  T->>E: tick(deltaMS)
  E->>E: entity.update(deltaTime) for each active entity
  E-->>App: emit update(deltaTime)
  E-->>App: emit beforeRender
  App->>R: camera.centerOn(player)
  E->>R: applyCameraTransform()
  E->>R: renderMap(map) (visible cells only)
  E->>L: update(fogOfWar)
  alt a light moved or changed
    L->>F: calculateFOV(origin, radius) per light
    L->>Fog: updateFromFOV(union of lit cells)
  end
  E->>R: renderFogOfWar(fog) (redrawn only if fog.version changed)
  E->>R: position entity sprites, renderParticles()
  E-->>App: emit afterRender(renderer)
```

### Click to move (A\*) and field of view

```mermaid
sequenceDiagram
  autonumber
  actor U as Player
  participant M as MouseHandler
  participant C as Camera
  participant E as GameEngine
  participant R as Renderer
  participant App
  participant A as AStarPathfinder

  U->>M: right-click on canvas
  M->>C: screenToWorld(x, y)
  C-->>M: grid cell
  M->>E: RIGHT_CLICK(cell)
  E->>R: showClickCoordinates(x, y, 'right')
  E-->>App: emit gridClick(x, y, 'right')
  App->>A: findPath(player.position, cell)
  A-->>App: Vector[] (cheapest path, uses terrain costs)
  loop each frame while walking
    App->>App: step player.position along the path
    Note over App,E: The player's light shares player.position,<br/>so the next frame recalculates FOV and fog
  end
```

### Opening a door (flood-fill room reveal)

```mermaid
sequenceDiagram
  autonumber
  actor U as Player
  participant E as GameEngine
  participant App
  participant FF as FloodFill
  participant Fog as FogOfWar
  participant G as Grid
  participant L as LightingSystem

  U->>E: left-click the door cell
  E-->>App: emit gridClick(x, y, 'left')
  App->>App: check the key, door next to player
  App->>E: revealRoom(cell beyond the door)
  E->>FF: fillRoom(start, maxCells)
  Note over FF: BFS over walkable cells.<br/>The closed door still blocks, so<br/>the fill stays inside the room
  FF-->>E: room cells
  E->>E: add the surrounding walls
  E->>Fog: markMultipleExplored(cells)
  E->>L: markDirty()
  App->>G: setCellType(door, floor) (door is now walkable and see-through)
```
