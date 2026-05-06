import { Vector } from './core/Vector';
import { Grid, CellType } from './core/Grid';
import { GameMap, MapLoader } from './map/MapLayer';
import { AStarPathfinder } from './algorithms/AStar';
import { FieldOfView } from './algorithms/FieldOfView';
import { FogOfWar } from './algorithms/FogOfWar';
import { FloodFill } from './algorithms/FloodFill';
import { NPCAISystem } from './algorithms/NPCAISystem';
import { NPC, Enemy, MapObject, MapObjectType, InteractiveObject } from './core/MapObject';
import { TileRegistry } from './core/TileRegistry';
import { Renderer } from './render/Renderer';
import { MouseHandler, MouseEventType } from './interaction/MouseHandler';
import { KeyboardHandler } from './interaction/KeyboardHandler';
import { AnimationLibrary } from './render/Animation';
import { ParticleSystem, ParticlePresets } from './render/Particles';
import { SaveLoadManager, QuickSaveManager } from './system/SaveLoadManager';
import { LevelEditor } from './editor/LevelEditor';
import { DialogueLine } from './system/DialogueManager';
import { Inventory } from './core/Inventory';
import { Item, ItemType } from './core/Item';
import { UIManager } from './system/UIManager';
import * as PIXI from 'pixi.js';
import { AudioManager } from './system/AudioManager';

// Interface to safely handle incoming map JSON data
interface MapEntityData {
  type: string;
  objectType?: string;
  x?: number;
  y?: number;
  id?: string;
  sprite?: string;
  radius?: number;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export class GameEngine {
  private map: GameMap | null = null;
  private grid: Grid;
  private renderer: Renderer;
  private mouseHandler!: MouseHandler;
  private keyboardHandler: KeyboardHandler;
  private uiManager!: UIManager;
  private inventory: Inventory;
  private pathfinder: AStarPathfinder;
  private fov: FieldOfView;
  private fogOfWar!: FogOfWar;
  private floodFill: FloodFill;
  private aiSystem: NPCAISystem;
  private animationLibrary: AnimationLibrary;
  private particleSystem: ParticleSystem;
  private saveLoadManager: SaveLoadManager;
  private quickSaveManager: QuickSaveManager;
  private editor: LevelEditor;

  private currentPlayerPos: Vector = new Vector(10, 10);
  private lastFovPos: Vector = new Vector(-1, -1);
  private cachedVisibleCells: Set<string> = new Set();
  private selectedCell: Vector | null = null;
  private path: Vector[] = [];

  private isPlayerMoving: boolean = false;
  private currentPathIndex: number = 0;
  private moveProgress: number = 0;
  private playerMoveSpeed: number = 0.005;
  private targetPlayerPos: Vector = new Vector(10, 10);

  private mapObjects: Map<string, MapObject> = new Map();
  private pendingInteractionTarget: MapObject | null = null;
  private playerPixiSprite: PIXI.Sprite | null = null;

  private gameTime: number = 0;
  private isRunning: boolean = false;
  private boundGameLoop = this.pixiGameLoop.bind(this);
  private interactionHandler?: (target: MapObject | null) => void;
  private audioManager: AudioManager;

  constructor() {
    this.grid = new Grid(100, 100);
    this.renderer = new Renderer(32);
    this.keyboardHandler = new KeyboardHandler();
    this.inventory = new Inventory();
    this.pathfinder = new AStarPathfinder(this.grid);
    this.fov = new FieldOfView(this.grid);
    this.floodFill = new FloodFill(this.grid);
    this.aiSystem = new NPCAISystem(this.grid);
    this.animationLibrary = new AnimationLibrary();
    this.particleSystem = new ParticleSystem();
    this.saveLoadManager = new SaveLoadManager();
    this.quickSaveManager = new QuickSaveManager();
    this.editor = new LevelEditor();
    this.audioManager = new AudioManager();

    TileRegistry.initialize();
  }

  public setInteractionHandler(handler: (target: MapObject | null) => void): void {
    this.interactionHandler = handler;
  }

  async init(canvas: HTMLCanvasElement, canvasWidth: number, canvasHeight: number): Promise<void> {
    await this.renderer.init(canvas, canvasWidth, canvasHeight, this.grid.getWidth(), this.grid.getHeight());

    this.mouseHandler = new MouseHandler(canvas, this.renderer.getCamera(), this.renderer.tileSize);
    this.uiManager = new UIManager(this.keyboardHandler, this.inventory);
    this.fogOfWar = new FogOfWar(this.grid.getWidth(), this.grid.getHeight(), this.fov);

    this.setupEventHandlers();
    this.startGameLoop();
  }

  // --- MAP LOADING & MANAGEMENT ---

  async loadMap(mapUrl: string): Promise<void> {
    const response = await fetch(mapUrl);
    const mapData = await response.json();
    this.map = MapLoader.parseMapJSON(mapData);

    const collisionLayer = this.map.getLayerByName('collision');
    const terrainLayer = this.map.getLayerByName('terrain');

    if (collisionLayer && terrainLayer) {
      const cData = collisionLayer.getData();
      const tData = terrainLayer.getData();
      for (let y = 0; y < cData.length; y++) {
        for (let x = 0; x < cData[y].length; x++) {
          const type = cData[y][x] !== 0 ? cData[y][x] : tData[y][x];
          this.grid.setCellType(x, y, type as CellType);
        }
      }
    }

    if (mapData.objects && Array.isArray(mapData.objects)) {
      mapData.objects.forEach((objData: any) => this.processMapData(objData));
    }

    this.fogOfWar = new FogOfWar(this.map.getWidth(), this.map.getHeight(), this.fov);
    this.renderer.getCamera().mapWidth = this.map.getWidth();
    this.renderer.getCamera().mapHeight = this.map.getHeight();
    this.lastFovPos = new Vector(-1, -1);
    this.render();
  }

  async loadLevel(mapUrl: string, spawnPoint: Vector): Promise<void> {
    this.clearMap();
    await this.loadMap(mapUrl);
    this.render();
  }

  private clearMap(): void {
    Array.from(this.mapObjects.keys()).forEach(id => this.removeMapObject(id));
    this.path = [];
    this.selectedCell = null;
    this.pendingInteractionTarget = null;
    this.isPlayerMoving = false;
    this.currentPathIndex = 0;
    this.moveProgress = 0;
    this.fogOfWar = new FogOfWar(this.grid.getWidth(), this.grid.getHeight(), this.fov);
    this.renderer.clearMapCache();
    this.map = null;
  }

  // Refactored from the old createMapObjectFromData
  private processMapData(data: MapEntityData): void {
    const x = data.x ?? 0;
    const y = data.y ?? 0;

    if (data.type === "SPAWN" || data.type === "PLAYER_SPAWN") {
        this.currentPlayerPos = new Vector(x, y);
        this.targetPlayerPos = new Vector(x, y);
        return;
    }

    const mapObject = this.createMapEntity(data, x, y);
    this.applyCustomProperties(mapObject, data);
    this.addMapObject(mapObject);
  }

  private createMapEntity(data: MapEntityData, x: number, y: number): MapObject {
    const rawType = data.objectType || data.type || MapObjectType.LIGHT_SOURCE;
    const objType = rawType.toString().toLowerCase() as MapObjectType;
    const position = new Vector(x, y);
    const id = data.id || `${objType}_${x}_${y}`;
    const sprite = data.sprite || 'torch';

    switch (objType) {
        case MapObjectType.ENEMY: return new Enemy(id, position, data.sprite || 'goblin');
        case MapObjectType.NPC: return new NPC(id, position, data.sprite || 'hero');
        case MapObjectType.DOOR:
        case MapObjectType.CHEST:
        case MapObjectType.TELEPORT: return new InteractiveObject(id, objType, position, data.sprite || 'chest');
        default: return new MapObject(id, objType, position, sprite);
    }
  }

  private applyCustomProperties(mapObject: MapObject, data: MapEntityData): void {
    if (data.radius !== undefined) mapObject.radius = data.radius;
    if (data.properties) {
        Object.entries(data.properties).forEach(([k, v]) => mapObject.setProperty(k, v));
    }

    const { type, objectType, x, y, id, sprite, properties, radius, ...customProps } = data;
    Object.entries(customProps).forEach(([k, v]) => mapObject.setProperty(k, v));
  }

  // --- EVENT HANDLING ---

  private setupEventHandlers(): void {
    this.mouseHandler.on(MouseEventType.LEFT_CLICK, (pos) => this.onLeftClick(pos));
    this.mouseHandler.on(MouseEventType.RIGHT_CLICK, (pos) => this.onRightClick(pos));
    this.mouseHandler.on(MouseEventType.MOVE, (pos) => this.onMouseMove(pos));
  }

  private onLeftClick(pos: Vector): void {
    if (this.uiManager.isUIOpen()) return;
    this.selectedCell = pos;
    this.pendingInteractionTarget = null;
    this.path = this.pathfinder.findPath(this.currentPlayerPos, pos);
    this.isPlayerMoving = false;
    this.render();
  }

  private onRightClick(pos: Vector): void {
    if (this.uiManager.isUIOpen()) return;
    this.selectedCell = pos;
    this.pendingInteractionTarget = null;

    const clickedObject = Array.from(this.mapObjects.values()).find(obj =>
      obj.position.equals(pos) &&
      [MapObjectType.NPC, MapObjectType.ENEMY, MapObjectType.ITEM, MapObjectType.DOOR, MapObjectType.CHEST].includes(obj.type)
    );

    if (clickedObject) {
       this.handleObjectClick(clickedObject, pos);
    } else {
       this.moveToPos(pos);
    }
    this.render();
  }

  private onMouseMove(pos: Vector): void {
      this.renderer.updateMouseHUD(pos.x, pos.y);
      this.uiManager.updateMouseCoords(pos.x, pos.y);
  }

  private handleObjectClick(clickedObject: MapObject, pos: Vector): void {
    const targetAdjacentTile = this.grid.getNeighbors(clickedObject.position.x, clickedObject.position.y)
                                        .find(n => this.grid.getCell(n.x, n.y)?.walkable);

    if (targetAdjacentTile) {
      this.pendingInteractionTarget = clickedObject;
      this.moveToPos(targetAdjacentTile);
    } else {
      this.path = [];
      this.isPlayerMoving = false;
    }
  }

  private moveToPos(pos: Vector): void {
    const newPath = this.pathfinder.findPath(this.currentPlayerPos, pos);
    if (newPath.length > 0) {
      this.path = newPath;
      this.isPlayerMoving = true;
      this.currentPathIndex = 0;
      this.moveProgress = 0;
      this.targetPlayerPos = this.currentPlayerPos.clone();
    } else {
      this.path = [];
      this.isPlayerMoving = false;
    }
  }

  private onInteract(targetObject?: MapObject): void {
    if (this.interactionHandler) this.interactionHandler(targetObject || null);
  }

  // --- MAIN LOOP & UPDATE LOGIC ---

  private pixiGameLoop(): void {
    if (!this.isRunning) return;
    this.update(this.renderer.getApp().ticker.deltaMS);
  }

  private startGameLoop(): void {
    this.isRunning = true;
    this.renderer.getApp().ticker.add(this.boundGameLoop);
  }

  stopGameLoop(): void {
    this.isRunning = false;
    this.renderer.getApp().ticker.remove(this.boundGameLoop);
  }

  private update(deltaTime: number): void {
    if (!this.isRunning) return;
    this.gameTime += deltaTime;
    this.uiManager.updateFpsCounter(deltaTime);

    if (!this.uiManager.isUIOpen()) {
      this.processPlayerMovement(deltaTime);
    }

    this.aiSystem.update(this.currentPlayerPos);
    this.particleSystem.update(deltaTime);
    this.uiManager.updatePlayerCoords(Math.round(this.currentPlayerPos.x), Math.round(this.currentPlayerPos.y));
    this.render();
  }

  private processPlayerMovement(deltaTime: number): void {
    if (!this.isPlayerMoving || this.path.length === 0) return;

    const startTile = this.path[this.currentPathIndex];
    const endTile = this.path[this.currentPathIndex + 1];

    if (!endTile) {
      this.stopPlayerMovement();
      return;
    }

    this.moveProgress += this.playerMoveSpeed * deltaTime;

    if (this.moveProgress >= 1) {
      // Reached the next tile
      this.currentPlayerPos = endTile.clone();
      this.targetPlayerPos = endTile.clone();
      this.currentPathIndex++;
      this.moveProgress = 0;

      this.triggerAutoInteractions();

      if (this.currentPathIndex >= this.path.length - 1) {
        this.stopPlayerMovement();
        if (this.pendingInteractionTarget && this.currentPlayerPos.manhattanDistance(this.pendingInteractionTarget.position) <= 1) {
          this.onInteract(this.pendingInteractionTarget);
          this.pendingInteractionTarget = null;
        }
      }
    } else {
      // Interpolate visually
      this.targetPlayerPos.x = startTile.x + (endTile.x - startTile.x) * this.moveProgress;
      this.targetPlayerPos.y = startTile.y + (endTile.y - startTile.y) * this.moveProgress;
    }
  }

  private stopPlayerMovement(): void {
    this.isPlayerMoving = false;
    this.path = [];
    this.selectedCell = null;
  }

  private triggerAutoInteractions(): void {
    for (const object of this.mapObjects.values()) {
      if (object.position.equals(this.currentPlayerPos) && object.type === MapObjectType.ITEM) {
         this.onInteract(object);
      }
    }
  }

  // --- RENDERING ---

  private render(): void {
    if (!this.map) return;

    this.renderer.getCamera().centerOn(this.targetPlayerPos);
    this.renderer.applyCameraTransform();
    this.renderer.renderMap(this.map);

    this.updateVision();
    this.updateSprites();
    this.renderPathMarkers();

    this.renderer.renderParticles(this.particleSystem.getAllParticles());
  }

  private updateVision(): void {
    if (this.currentPlayerPos.equals(this.lastFovPos)) return;

    const combinedFOV = new Set<string>();

    // Player light
    this.fov.calculateFOV(this.currentPlayerPos, 10).forEach(cell => combinedFOV.add(cell));

    // Environmental light
    for (const obj of this.mapObjects.values()) {
      if (obj.getProperty('hasLightSource') && obj.isActive) {
        this.fov.calculateFOV(obj.position, obj.radius || 10).forEach(cell => combinedFOV.add(cell));
      }
    }

    this.cachedVisibleCells = combinedFOV;
    this.fogOfWar.updateFromFOV(this.cachedVisibleCells);
    this.renderer.renderFogOfWar(this.fogOfWar, this.map!.getWidth(), this.map!.getHeight());
    this.renderer.drawFOV(this.cachedVisibleCells, this.map!.getWidth(), this.map!.getHeight());
    this.lastFovPos = this.currentPlayerPos.clone();
  }

  private updateSprites(): void {
    if (this.playerPixiSprite) {
      this.renderer.updateSpritePosition(this.playerPixiSprite, this.targetPlayerPos.x, this.targetPlayerPos.y);
    }

    const cameraPos = this.renderer.getCamera().getPosition();
    const cameraWidth = this.renderer.getCamera().width / this.renderer.tileSize;
    const cameraHeight = this.renderer.getCamera().height / this.renderer.tileSize;

    for (const object of this.mapObjects.values()) {
      if (!object.pixiSprite || !object.isActive) continue;

      const inCameraBounds =
        object.position.x >= cameraPos.x - 2 &&
        object.position.x <= cameraPos.x + cameraWidth + 2 &&
        object.position.y >= cameraPos.y - 2 &&
        object.position.y <= cameraPos.y + cameraHeight + 2;

      if (!inCameraBounds) {
          object.pixiSprite.visible = false;
          continue;
      }

      this.renderer.updateSpritePosition(object.pixiSprite, object.position.x, object.position.y);
      object.pixiSprite.visible = this.fogOfWar.isExplored(object.position.x, object.position.y);
    }
  }

  private renderPathMarkers(): void {
    this.renderer.clearMarkers();
    if (this.selectedCell) this.renderer.drawMarker(this.selectedCell.x, this.selectedCell.y, 0x0000ff, 5);

    for (let i = this.isPlayerMoving ? this.currentPathIndex + 1 : 0; i < this.path.length; i++) {
      const cell = this.path[i];
      const h = ((i * 15) % 360) / 60;
      const xColor = Math.floor((1 - Math.abs(h % 2 - 1)) * 255);

      let r = 0, g = 0, b = 0;
      if (h < 1) { r = 255; g = xColor; b = 0; }
      else if (h < 2) { r = xColor; g = 255; b = 0; }
      else if (h < 3) { r = 0; g = 255; b = xColor; }
      else if (h < 4) { r = 0; g = xColor; b = 255; }
      else if (h < 5) { r = xColor; g = 0; b = 255; }
      else { r = 255; g = 0; b = xColor; }

      this.renderer.drawMarker(cell.x, cell.y, (r << 16) | (g << 8) | b, 3);
    }
  }

  // --- MAP OBJECT MANAGEMENT ---

  addMapObject(object: MapObject): void {
    this.mapObjects.set(object.id, object);
    if (object.sprite) {
      const texture = this.renderer.getTexture(object.sprite);
      if (texture) {
        object.pixiSprite = new PIXI.Sprite(texture);
        object.pixiSprite.width = this.renderer.tileSize;
        object.pixiSprite.height = this.renderer.tileSize;

        if ([MapObjectType.ITEM, MapObjectType.CHEST, MapObjectType.DOOR].includes(object.type)) {
          object.pixiSprite.zIndex = 10;
        } else if ([MapObjectType.ENEMY, MapObjectType.NPC].includes(object.type)) {
          object.pixiSprite.zIndex = 50;
        } else {
          object.pixiSprite.zIndex = 0;
        }

        this.renderer.getSpriteContainer().addChild(object.pixiSprite);
      }
    }
    if (object instanceof NPC || object instanceof Enemy) this.aiSystem.registerNPC(object);
  }

  removeMapObject(objectId: string): void {
    const object = this.mapObjects.get(objectId);
    if (object) {
      if (object.pixiSprite) {
        this.renderer.getSpriteContainer().removeChild(object.pixiSprite);
        object.pixiSprite.destroy();
        object.pixiSprite = null;
      }
      if (object instanceof NPC || object instanceof Enemy) this.aiSystem.unregisterNPC(objectId);
      this.mapObjects.delete(objectId);
    }
  }

  setPlayerSprite(spriteId: string): void {
    const texture = this.renderer.getTexture(spriteId);
    if (texture) {
      if (!this.playerPixiSprite) {
        this.playerPixiSprite = new PIXI.Sprite(texture);
        this.playerPixiSprite.width = this.renderer.tileSize;
        this.playerPixiSprite.height = this.renderer.tileSize;
        this.playerPixiSprite.zIndex = 100;
        this.renderer.getSpriteContainer().addChild(this.playerPixiSprite);
      } else {
        this.playerPixiSprite.texture = texture;
      }
    }
  }

  // --- SAVE / LOAD ---

  saveGame(slot: number): boolean {
    const gameState = SaveLoadManager.createGameState(this.currentPlayerPos, this.map?.getName() || 'Unknown', this.aiSystem.getAllNPCs(), this.getAllMapObjects(), null, this.fogOfWar.getFogMap() as any);
    return this.saveLoadManager.saveGame(slot, gameState);
  }

  loadGame(slot: number): boolean {
    const saveFile = this.saveLoadManager.loadGame(slot);
    if (!saveFile) return false;
    this.currentPlayerPos = new Vector(saveFile.gameState.playerPosition.x, saveFile.gameState.playerPosition.y);
    this.targetPlayerPos = this.currentPlayerPos.clone();
    return true;
  }

  quickSave(): boolean {
    const gameState = SaveLoadManager.createGameState(this.currentPlayerPos, this.map?.getName() || 'Unknown', this.aiSystem.getAllNPCs(), this.getAllMapObjects(), null, this.fogOfWar.getFogMap() as any);
    return this.quickSaveManager.quickSave(gameState);
  }

  quickLoad(): boolean {
    const saveFile = this.quickSaveManager.quickLoad();
    if (!saveFile) return false;
    this.currentPlayerPos = new Vector(saveFile.gameState.playerPosition.x, saveFile.gameState.playerPosition.y);
    this.targetPlayerPos = this.currentPlayerPos.clone();
    return true;
  }

  // --- GETTERS & SETTERS ---

  getMapObject(objectId: string): MapObject | undefined { return this.mapObjects.get(objectId); }
  getAllMapObjects(): MapObject[] { return Array.from(this.mapObjects.values()); }
  getInventory(): Inventory { return this.inventory; }
  getUIManager(): UIManager { return this.uiManager; }
  getGrid(): Grid { return this.grid; }
  getEditor(): LevelEditor { return this.editor; }
  getAISystem(): NPCAISystem { return this.aiSystem; }
  getParticleSystem(): ParticleSystem { return this.particleSystem; }
  getAnimationLibrary(): AnimationLibrary { return this.animationLibrary; }
  getMouseHandler(): MouseHandler { return this.mouseHandler; }
  getKeyboardHandler(): KeyboardHandler { return this.keyboardHandler; }
  getRenderer(): Renderer { return this.renderer; }
  getPlayerPosition(): Vector { return this.currentPlayerPos; }
  setPlayerPosition(pos: Vector): void { this.currentPlayerPos = pos; this.targetPlayerPos = pos.clone(); }
  getAudioManager(): AudioManager { return this.audioManager; }
  getMap(): GameMap | null { return this.map; }
  getRunning(): boolean { return this.isRunning; }
  setRunning(running: boolean): void { this.isRunning = running; }
}