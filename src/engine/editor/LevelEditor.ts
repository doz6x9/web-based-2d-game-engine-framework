import { Vector } from '../core/Vector';
import { GameMap, MapLayer } from '../map/MapLayer';

/**
 * Level editor tool types
 */
export enum EditorTool {
  SELECT = 'select',
  PAINT = 'paint',
  ERASE = 'erase',
  PLACE_OBJECT = 'place_object',
  DELETE_OBJECT = 'delete_object',
}

/**
 * Editor state
 */
export interface EditorState {
  currentTool: EditorTool;
  currentTile: string;
  currentLayer: number;
  selectedObject: string | null;
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Undo/Redo support
 */
interface EditorAction {
  redo(): void;
  undo(): void;
}

class TileChangeAction implements EditorAction {
  constructor(
    _map: GameMap,
    _x: number,
    _y: number,
    _oldValue: string,
    _newValue: string,
    _layerIndex: number
  ) {
    // Action implementation
  }

  redo(): void {
    // Update map layer
  }

  undo(): void {
    // Restore old value
  }
}

/**
 * Level Editor
 */
export class LevelEditor {
  private map: GameMap | null = null;
  private state: EditorState;
  private history: EditorAction[] = [];
  private historyIndex: number = -1;
  private selectedCells: Set<string> = new Set();
  private clipboard: any = null;

  constructor() {
    this.state = {
      currentTool: EditorTool.PAINT,
      currentTile: 'grass',
      currentLayer: 0,
      selectedObject: null,
      zoom: 1,
      panX: 0,
      panY: 0,
    };
  }

  /**
   * Create new map
   */
  createMap(width: number, height: number, name: string): GameMap {
    this.map = new GameMap(name, width, height);

    // Create terrain layer filled with grass
    const terrainData: string[][] = [];
    for (let y = 0; y < height; y++) {
      const row: string[] = [];
      for (let x = 0; x < width; x++) {
        row.push('grass');
      }
      terrainData.push(row);
    }

    const terrainLayer = new MapLayer('terrain', terrainData as any);
    this.map.addLayer(terrainLayer);

    return this.map;
  }

  /**
   * Load map for editing
   */
  loadMap(map: GameMap): void {
    this.map = map;
    this.history = [];
    this.historyIndex = -1;
  }

  /**
   * Paint tile
   */
  paintTile(x: number, y: number, tileId: string): void {
    if (!this.map) return;

    const layer = this.map.getLayer(this.state.currentLayer);
    if (!layer) return;

    // Record action for undo/redo
    const action = new TileChangeAction(
      this.map,
      x,
      y,
      '',
      tileId,
      this.state.currentLayer
    );
    this.addHistory(action);
  }

  /**
   * Fill area with tile
   */
  fillArea(startX: number, startY: number, tileId: string): void {
    if (!this.map) return;

    const layer = this.map.getLayer(this.state.currentLayer);
    if (!layer) return;

    // Flood fill algorithm
    const visited = new Set<string>();
    const queue: Vector[] = [new Vector(startX, startY)];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.x},${current.y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      this.paintTile(current.x, current.y, tileId);

      // Add neighbors
      const neighbors = [
        new Vector(current.x - 1, current.y),
        new Vector(current.x + 1, current.y),
        new Vector(current.x, current.y - 1),
        new Vector(current.x, current.y + 1),
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor.x >= 0 &&
          neighbor.x < this.map.getWidth() &&
          neighbor.y >= 0 &&
          neighbor.y < this.map.getHeight()
        ) {
          queue.push(neighbor);
        }
      }
    }
  }

  /**
   * Select cells in rectangle
   */
  selectRectangle(x1: number, y1: number, x2: number, y2: number): void {
    this.selectedCells.clear();

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this.selectedCells.add(`${x},${y}`);
      }
    }
  }

  /**
   * Get selected cells
   */
  getSelectedCells(): Set<string> {
    return this.selectedCells;
  }

  /**
   * Copy selection
   */
  copy(): void {
    if (this.selectedCells.size === 0) return;

    this.clipboard = {
      cells: Array.from(this.selectedCells),
      width: this.map?.getWidth() || 0,
      height: this.map?.getHeight() || 0,
    };
  }

  /**
   * Paste clipboard
   */
  paste(x: number, y: number): void {
    if (!this.clipboard) return;

    for (const cellKey of this.clipboard.cells) {
      const [cx, cy] = cellKey.split(',').map(Number);
      const newX = x + (cx - this.clipboard.minX);
      const newY = y + (cy - this.clipboard.minY);
      this.paintTile(newX, newY, this.state.currentTile);
    }
  }

  /**
   * Undo
   */
  undo(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.history[this.historyIndex].undo();
    }
  }

  /**
   * Redo
   */
  redo(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.history[this.historyIndex].redo();
    }
  }

  /**
   * Add action to history
   */
  private addHistory(action: EditorAction): void {
    // Remove redo history
    this.history.splice(this.historyIndex + 1);
    this.history.push(action);
    this.historyIndex++;
  }

  /**
   * Set current tool
   */
  setTool(tool: EditorTool): void {
    this.state.currentTool = tool;
  }

  /**
   * Set current tile
   */
  setCurrentTile(tileId: string): void {
    this.state.currentTile = tileId;
  }

  /**
   * Set current layer
   */
  setCurrentLayer(layerIndex: number): void {
    if (this.map && layerIndex < this.map.getLayers().length) {
      this.state.currentLayer = layerIndex;
    }
  }

  /**
   * Get editor state
   */
  getState(): EditorState {
    return this.state;
  }

  /**
   * Export map to JSON
   */
  exportMap(): any {
    if (!this.map) return null;

    return {
      name: this.map.getName(),
      width: this.map.getWidth(),
      height: this.map.getHeight(),
      layers: this.map.getLayers().map((layer) => ({
        name: layer.getName(),
        data: layer.getData(),
      })),
    };
  }

  /**
   * Get current map
   */
  getMap(): GameMap | null {
    return this.map;
  }

  /**
   * Can undo
   */
  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  /**
   * Can redo
   */
  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }
}

/**
 * Editor UI helpers
 */
export class EditorUI {
  /**
   * Create toolbar buttons
   */
  static createToolbar(): HTMLDivElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    toolbar.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 10px;
      background: #333;
      border-bottom: 1px solid #666;
    `;

    return toolbar;
  }

  /**
   * Create tool button
   */
  static createToolButton(tool: EditorTool, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.dataset.tool = tool;
    button.style.cssText = `
      padding: 8px 12px;
      background: #444;
      color: #fff;
      border: 1px solid #666;
      cursor: pointer;
      border-radius: 4px;
    `;

    button.onmouseover = () => {
      button.style.background = '#555';
    };

    button.onmouseout = () => {
      button.style.background = '#444';
    };

    return button;
  }

  /**
   * Create layer panel
   */
  static createLayerPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'editor-layer-panel';
    panel.style.cssText = `
      width: 200px;
      background: #333;
      border: 1px solid #666;
      padding: 10px;
      border-radius: 4px;
    `;

    return panel;
  }

  /**
   * Create tile palette
   */
  static createTilePalette(tiles: Map<string, any>): HTMLDivElement {
    const palette = document.createElement('div');
    palette.className = 'editor-tile-palette';
    palette.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 10px;
      background: #333;
      border-radius: 4px;
    `;

    for (const [tileId, tileDef] of tiles) {
      const tile = document.createElement('div');
      tile.textContent = tileId;
      tile.style.cssText = `
        padding: 8px;
        background: #${tileDef.color.toString(16).padStart(6, '0')};
        color: #fff;
        cursor: pointer;
        border-radius: 2px;
        text-align: center;
        font-size: 12px;
      `;

      tile.onclick = () => {
        document.querySelectorAll('.editor-tile-palette > div').forEach((t) => {
          (t as HTMLElement).style.border = 'none';
        });
        tile.style.border = '2px solid white';
      };

      palette.appendChild(tile);
    }

    return palette;
  }
}
