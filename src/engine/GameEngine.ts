import { Vector } from './core/Vector';
import { Grid, CellType } from './core/Grid';
import { GameMap, MapLoader } from './map/MapLayer';
import { AStarPathfinder } from './algorithms/AStar';
import { FieldOfView } from './algorithms/FieldOfView';
import { FogOfWar } from './algorithms/FogOfWar';
import { Renderer } from './render/Renderer';
import { MouseHandler, MouseEventType } from './interaction/MouseHandler';

/**
 * Main Game Engine
 * Orchestrates rendering, algorithms, and interaction
 */
export class GameEngine {
  private map: GameMap | null = null;
  private grid: Grid;
  private renderer: Renderer;
  private mouseHandler: MouseHandler;
  private pathfinder: AStarPathfinder;
  private fov: FieldOfView;

  private fogOfWar: FogOfWar;
  private currentPlayerPos: Vector = new Vector(5, 5);
  private selectedCell: Vector | null = null;
  private path: Vector[] = [];

  constructor(canvas: HTMLCanvasElement, canvasWidth: number, canvasHeight: number) {
    this.grid = new Grid(100, 100);
    this.renderer = new Renderer(canvas, canvasWidth, canvasHeight, 32);
    this.mouseHandler = new MouseHandler(canvas);
    this.pathfinder = new AStarPathfinder(this.grid);
    this.fov = new FieldOfView(this.grid);
    this.fogOfWar = new FogOfWar(100, 100, this.fov);

    this.setupEventHandlers();
  }

  /**
   * Load map from JSON
   */
  async loadMap(mapUrl: string): Promise<void> {
    const response = await fetch(mapUrl);
    const mapData = await response.json();
    this.map = MapLoader.parseMapJSON(mapData);

    // Update grid from collision layer
    const collisionLayer = this.map.getLayerByName('collision');
    if (collisionLayer) {
      const data = collisionLayer.getData();
      for (let y = 0; y < data.length; y++) {
        for (let x = 0; x < data[y].length; x++) {
          const cellType = data[y][x] === 1 ? CellType.WALL : CellType.GRASS;
          this.grid.setCellType(x, y, cellType);
        }
      }
    }

    this.render();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.mouseHandler.on(MouseEventType.LEFT_CLICK, (pos) => {
      this.onLeftClick(pos);
    });

    this.mouseHandler.on(MouseEventType.RIGHT_CLICK, (pos) => {
      this.onRightClick(pos);
    });

    this.mouseHandler.on(MouseEventType.MOVE, (pos) => {
      this.onMouseMove(pos);
    });
  }

  /**
   * Handle left click
   */
  private onLeftClick(pos: Vector): void {
    console.log(`Left clicked: ${pos.x}, ${pos.y}`);
    this.selectedCell = pos;

    // Find path to clicked cell
    this.path = this.pathfinder.findPath(this.currentPlayerPos, pos);
    this.render();
  }

  /**
   * Handle right click
   */
  private onRightClick(pos: Vector): void {
    console.log(`Right clicked: ${pos.x}, ${pos.y}`);
    this.currentPlayerPos = pos;
    this.path = [];
    this.render();
  }

  /**
   * Handle mouse move
   */
  private onMouseMove(_pos: Vector): void {
    // Can be used for highlighting cells
  }

  /**
   * Render the game
   */
  private render(): void {
    if (!this.map) return;

    // Render map
    this.renderer.renderMap(this.map);

    // Update FOV from current player position
    const visibleCells = this.fov.calculateFOV(this.currentPlayerPos, 10);

    // Update fog of war
    this.fogOfWar.updateFromFOV(visibleCells);

    // Render fog of war
    this.renderer.renderFogOfWar(this.fogOfWar, this.map.getWidth(), this.map.getHeight());

    // Draw FOV visualization
    this.renderer.drawFOV(visibleCells, this.map.getWidth(), this.map.getHeight());

    // Draw player position
    this.renderer.drawMarker(this.currentPlayerPos.x, this.currentPlayerPos.y, 0x00ff00, 6);

    // Draw selected cell if any
    if (this.selectedCell) {
      this.renderer.drawMarker(this.selectedCell.x, this.selectedCell.y, 0x0000ff, 5);
    }

    // Draw path
    for (const cell of this.path) {
      this.renderer.drawMarker(cell.x, cell.y, 0xffff00, 3);
    }

    // Center camera on player
    this.renderer.getCamera().centerOn(this.currentPlayerPos);
  }

  /**
   * Update game state
   */
  update(_deltaTime: number): void {
    // Game logic updates
    this.render();
  }

  /**
   * Get mouse handler for custom event binding
   */
  getMouseHandler(): MouseHandler {
    return this.mouseHandler;
  }

  /**
   * Get renderer
   */
  getRenderer(): Renderer {
    return this.renderer;
  }

  /**
   * Get current player position
   */
  getPlayerPosition(): Vector {
    return this.currentPlayerPos;
  }

  /**
   * Set player position
   */
  setPlayerPosition(pos: Vector): void {
    this.currentPlayerPos = pos;
  }
}
