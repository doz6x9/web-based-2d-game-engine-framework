import { describe, it, expect } from 'vitest';
import { Camera } from '../src/render/Renderer';
import { MouseHandler, MouseEventType } from '../src/interaction/MouseHandler';
import { Vector } from '../src/core/Vector';

describe('Camera screen <-> cell conversion', () => {
  it('maps pixels to cells at zoom 1', () => {
    const cam = new Camera(320, 320, 10, 10, 32);
    cam.centerOn(new Vector(0, 0));
    expect(cam.screenToWorld(0, 0).key()).toBe('0,0');
    expect(cam.screenToWorld(31, 31).key()).toBe('0,0');
    expect(cam.screenToWorld(32, 0).key()).toBe('1,0');
    expect(cam.screenToWorld(319, 319).key()).toBe('9,9');
  });

  it('picks the largest whole zoom that fits and centres a small map', () => {
    const cam = new Camera(640, 480, 5, 5, 32); // map is 160x160 px
    expect(cam.fitZoomToMap()).toBe(3);         // 480 / 160 = 3
    cam.centerOn(new Vector(2, 2));
    expect(cam.offsetX).toBe(80);               // (640 - 480) / 2
    expect(cam.offsetY).toBe(0);
    expect(cam.screenToWorld(79, 10).x).toBe(-1); // left of the map
    expect(cam.screenToWorld(80, 0).key()).toBe('0,0');
    expect(cam.screenToWorld(80 + 96 * 4 + 95, 479).key()).toBe('4,4');
  });

  it('never zooms below 1 for a map bigger than the view', () => {
    const cam = new Camera(320, 320, 100, 100, 32);
    expect(cam.fitZoomToMap()).toBe(1);
  });

  it('scrolls with the target on a large map and stays inside the map edges', () => {
    const cam = new Camera(320, 320, 100, 100, 32); // 10x10 tiles visible
    cam.centerOn(new Vector(50, 50));
    expect(cam.screenToWorld(0, 0).key()).toBe('45,45');
    cam.centerOn(new Vector(1, 1));
    expect(cam.screenToWorld(0, 0).key()).toBe('0,0');
    cam.centerOn(new Vector(99, 99));
    expect(cam.screenToWorld(319, 319).key()).toBe('99,99');
  });

  it('round-trips cell -> screen -> cell at any zoom', () => {
    for (const zoom of [1, 2, 3]) {
      const cam = new Camera(640, 640, 40, 40, 16);
      cam.zoom = zoom;
      cam.centerOn(new Vector(20, 20));
      for (const [x, y] of [[20, 20], [15, 18], [24, 22]]) {
        const s = cam.worldToScreen(x, y);
        expect(cam.screenToWorld(s.x + 1, s.y + 1).key()).toBe(`${x},${y}`);
      }
    }
  });
});

describe('MouseHandler', () => {
  /** A stand-in canvas: 640x640 pixels drawn at 320x320 CSS pixels, placed at (100, 50). */
  function fakeCanvas() {
    const listeners: Record<string, (e: any) => void> = {};
    const canvas = {
      width: 640,
      height: 640,
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 320, height: 320 }),
      addEventListener: (type: string, fn: (e: any) => void) => (listeners[type] = fn),
      removeEventListener: () => {},
    };
    return { canvas: canvas as unknown as HTMLCanvasElement, listeners };
  }

  it('turns a click into the right cell when the canvas is scaled by CSS', () => {
    const { canvas, listeners } = fakeCanvas();
    const cam = new Camera(640, 640, 20, 20, 32);
    cam.centerOn(new Vector(0, 0));
    const handler = new MouseHandler(canvas, cam, 32);
    const clicks: string[] = [];
    handler.on(MouseEventType.LEFT_CLICK, (p) => clicks.push(`L ${p.key()}`));
    handler.on(MouseEventType.RIGHT_CLICK, (p) => clicks.push(`R ${p.key()}`));

    // 1 CSS px = 2 canvas px, so CSS (16,16) inside the canvas is canvas (32,32) = cell (1,1).
    listeners.mousedown({ clientX: 116, clientY: 66, button: 0 });
    listeners.mousedown({ clientX: 100 + 319, clientY: 50 + 319, button: 2 });
    expect(clicks).toEqual(['L 1,1', 'R 19,19']);
  });

  it('follows the camera zoom and centring offset', () => {
    const { canvas, listeners } = fakeCanvas();
    const cam = new Camera(640, 640, 5, 5, 32); // 160px map in a 640px view
    cam.fitZoomToMap();                         // zoom 4, map fills the view exactly
    cam.centerOn(new Vector(2, 2));
    const handler = new MouseHandler(canvas, cam, 32);
    let cell: Vector | null = null;
    handler.on(MouseEventType.LEFT_CLICK, (p) => (cell = p));
    // CSS (200, 200) inside the canvas = canvas (400, 400) = cell floor(400 / 128) = 3.
    listeners.mousedown({ clientX: 300, clientY: 250, button: 0 });
    expect(cell!.key()).toBe('3,3');
  });
});
