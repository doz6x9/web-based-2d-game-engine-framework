import { Vector } from '../core/Vector';

/**
 * Mouse event types
 */
export enum MouseEventType {
  LEFT_CLICK = 'left',
  RIGHT_CLICK = 'right',
  MOVE = 'move',
}

/**
 * Interface for camera coordinate conversion
 */
export interface ICamera {
  width: number;
  height: number;
  screenToWorld(screenX: number, screenY: number): Vector;
}

/**
 * Mouse interaction handler
 */
export class MouseHandler {
  private canvas: HTMLCanvasElement;
  private camera: ICamera | null = null;
  private tileSize: number = 32;
  private mousePosition: Vector = new Vector(0, 0);
  private callbacks: Map<MouseEventType, Array<(pos: Vector) => void>> = new Map();

  // Elements for printing coordinate debugging to screen
  private coordinateOverlay: HTMLDivElement | null = null;
  private overlayTimeout: number | null = null;

  constructor(canvas: HTMLCanvasElement, camera?: ICamera, tileSize?: number) {
    this.canvas = canvas;
    this.camera = camera || null;
    if (tileSize) this.tileSize = tileSize;

    this.setupCoordinateOverlay();
    this.setupEventListeners();
  }

  /**
   * Setup a DOM overlay to print coordinates cleanly to the screen without cluttering PixiJS
   */
  private setupCoordinateOverlay(): void {
    // Create an absolute positioned div that floats over the canvas
    this.coordinateOverlay = document.createElement('div');
    this.coordinateOverlay.style.position = 'absolute';
    this.coordinateOverlay.style.pointerEvents = 'none';
    this.coordinateOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.coordinateOverlay.style.color = '#00FF00'; // Matrix-green for that hacker feel
    this.coordinateOverlay.style.padding = '4px 8px';
    this.coordinateOverlay.style.borderRadius = '4px';
    this.coordinateOverlay.style.fontFamily = 'monospace';
    this.coordinateOverlay.style.fontSize = '14px';
    this.coordinateOverlay.style.fontWeight = 'bold';
    this.coordinateOverlay.style.zIndex = '1000';
    this.coordinateOverlay.style.display = 'none';
    this.coordinateOverlay.style.transition = 'opacity 0.2s';

    // Append it to the canvas's parent container
    if (this.canvas.parentElement) {
      // Ensure parent has relative positioning so absolute positioning works
      if (getComputedStyle(this.canvas.parentElement).position === 'static') {
        this.canvas.parentElement.style.position = 'relative';
      }
      this.canvas.parentElement.appendChild(this.coordinateOverlay);
    }
  }

  /**
   * Display coordinates at the clicked location
   */
  private printCoordinatesToScreen(gridPos: Vector, clientX: number, clientY: number, button: string): void {
    if (!this.coordinateOverlay || !this.canvas.parentElement) return;

    // Get canvas bounds relative to viewport
    const parentRect = this.canvas.parentElement.getBoundingClientRect();

    // Calculate position relative to parent container
    const xPos = clientX - parentRect.left;
    const yPos = clientY - parentRect.top;

    this.coordinateOverlay.textContent = `${button} Click: (${gridPos.x}, ${gridPos.y})`;

    // Position slightly above the cursor so it's not hidden by it
    this.coordinateOverlay.style.left = `${xPos + 15}px`;
    this.coordinateOverlay.style.top = `${yPos - 25}px`;

    this.coordinateOverlay.style.display = 'block';
    this.coordinateOverlay.style.opacity = '1';

    // Clear previous timeout if multiple rapid clicks occur
    if (this.overlayTimeout !== null) {
      window.clearTimeout(this.overlayTimeout);
    }

    // Hide after a brief moment (1.5 seconds)
    this.overlayTimeout = window.setTimeout(() => {
      if (this.coordinateOverlay) {
        this.coordinateOverlay.style.opacity = '0';
        // Wait for transition before hiding completely
        setTimeout(() => {
          if (this.coordinateOverlay) this.coordinateOverlay.style.display = 'none';
        }, 200);
      }
    }, 1500);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Use mousedown instead of click to reliably capture right-clicks
    this.canvas.addEventListener('mousedown', (e) => {
      const pos = this.getMouseGridPosition(e);
      if (e.button === 0) {
        this.printCoordinatesToScreen(pos, e.clientX, e.clientY, 'Left');
        this.triggerEvent(MouseEventType.LEFT_CLICK, pos);
      } else if (e.button === 2) {
        this.printCoordinatesToScreen(pos, e.clientX, e.clientY, 'Right');
        this.triggerEvent(MouseEventType.RIGHT_CLICK, pos);
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const pos = this.getMouseGridPosition(e);
      this.mousePosition = pos;
      this.triggerEvent(MouseEventType.MOVE, pos);
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Prevent the browser's default context menu
    });
  }

  /**
   * Get mouse position in grid coordinates
   * Properly calculates grid coordinates based on the camera's zoom/scale and offset.
   */
  private getMouseGridPosition(event: MouseEvent): Vector {
    const rect = this.canvas.getBoundingClientRect();

    // Calculate the scale factor to account for CSS resizing
    let scaleX = 1;
    let scaleY = 1;

    // Use intrinsic canvas dimensions to calculate scale against actual rendered size
    scaleX = this.canvas.width / rect.width;
    scaleY = this.canvas.height / rect.height;

    // Calculate exact pixel position on the internal canvas bitmap
    const canvasPixelX = (event.clientX - rect.left) * scaleX;
    const canvasPixelY = (event.clientY - rect.top) * scaleY;

    // If camera is provided, it handles the world offset conversion accurately
    if (this.camera) {
      return this.camera.screenToWorld(canvasPixelX, canvasPixelY);
    }

    // Fallback if no camera (rare in actual engine usage)
    const gridX = Math.floor(canvasPixelX / this.tileSize);
    const gridY = Math.floor(canvasPixelY / this.tileSize);

    return new Vector(gridX, gridY);
  }

  /**
   * Register event callback
   */
  on(
    eventType: MouseEventType,
    callback: (pos: Vector) => void
  ): void {
    if (!this.callbacks.has(eventType)) {
      this.callbacks.set(eventType, []);
    }
    this.callbacks.get(eventType)!.push(callback);
  }

  /**
   * Trigger event
   */
  private triggerEvent(eventType: MouseEventType, pos: Vector): void {
    const callbacks = this.callbacks.get(eventType);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(pos);
      }
    }
  }

  /**
   * Get current mouse position
   */
  getMousePosition(): Vector {
    return this.mousePosition;
  }
}