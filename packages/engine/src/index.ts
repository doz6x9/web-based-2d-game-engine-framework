export {
  GameEngine,
  EventEmitter,
  type AssetConfig,
  type EngineEventMap,
  type EngineInitOptions,
  type EngineLifecycleOptions,
  type EventCallback,
  type IEntity,
} from './engine/GameEngine';

export { Vector } from './engine/core/Vector';
export { Grid, CellType, type Cell } from './engine/core/Grid';
export { MapObject, MapObjectType } from './engine/core/MapObject';
export { TileRegistry, TileType, type TileDefinition } from './engine/core/TileRegistry';

export { GameMap, MapLayer, MapLoader, type MapJSON, type MapLayerJSON } from './engine/map/MapLayer';

export { AStarPathfinder } from './engine/algorithms/AStar';
export { FieldOfView, type CellVisibility, type LightSource } from './engine/algorithms/FieldOfView';
export { FloodFill } from './engine/algorithms/FloodFill';
export { FogOfWar, FogState } from './engine/algorithms/FogOfWar';

export { Camera, Renderer } from './engine/render/Renderer';
export {
  AnimationController,
  AnimationLibrary,
  Tween,
  TweenManager,
  type AnimationDefinition,
  type AnimationFrame,
  type IAnimatable,
} from './engine/render/Animation';
export {
  ParticleEmitter,
  ParticlePresets,
  ParticleSystem,
  type Particle,
  type ParticleEmitterConfig,
} from './engine/render/Particles';

export { KeyboardEventType, KeyboardHandler, type KeyboardCallback } from './engine/interaction/KeyboardHandler';
export { MouseEventType, MouseHandler, type ICamera, type MouseHandlerOptions } from './engine/interaction/MouseHandler';

export { EditorTool, EditorUI, LevelEditor, type EditorState } from './engine/editor/LevelEditor';
