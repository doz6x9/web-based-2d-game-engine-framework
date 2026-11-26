import { Vector } from '../core/Vector';
import type { FieldOfView } from '../algorithms/FieldOfView';
import type { FogOfWar } from '../algorithms/FogOfWar';

/**
 * A light that reveals the map around it.
 * `position` is read every frame, so a light can follow a moving entity
 * by sharing that entity's Vector.
 */
export interface Light {
  /** Unique id, used to remove, look up or toggle the light. */
  id: string;
  /** Cell the light sits on. Share an entity's Vector to make the light follow it. */
  position: Vector;
  /** Radius in grid cells. */
  radius: number;
  /** Disabled lights are ignored. Defaults to true. */
  enabled?: boolean;
  /**
   * When true, the light stays dark until its own cell has been explored
   * (seen by another light or revealed by flood fill). Use it for torches in
   * rooms the player hasn't found yet, so they don't give the room away.
   */
  hiddenUntilExplored?: boolean;
}

/**
 * Combines the field of view of several lights (the player, torches, ...)
 * into one visible set and feeds it to Fog of War.
 * Recalculation only happens when a light is added, removed, moved,
 * resized or toggled, or when `markDirty()` is called.
 */
export class LightingSystem {
  private lights: Map<string, Light> = new Map();
  private visibleCells: Set<string> = new Set();
  private lastSignature = '';
  private dirty = true;

  constructor(private fov: FieldOfView) {}

  /** Add a light, or replace the light with the same id. */
  addLight(light: Light): void {
    this.lights.set(light.id, light);
    this.dirty = true;
  }

  /**
   * Remove a light.
   * Returns True if a light was removed.
   */
  removeLight(id: string): boolean {
    const removed = this.lights.delete(id);
    if (removed) this.dirty = true;
    return removed;
  }

  /** Returns The light with this id, or undefined. */
  getLight(id: string): Light | undefined {
    return this.lights.get(id);
  }

  /** Returns Every light, enabled or not. */
  getLights(): Light[] {
    return Array.from(this.lights.values());
  }

  /** Turn a light on or off without removing it. */
  setEnabled(id: string, enabled: boolean): void {
    const light = this.lights.get(id);
    if (light && (light.enabled ?? true) !== enabled) {
      light.enabled = enabled;
      this.dirty = true;
    }
  }

  /** Remove every light and forget the visible set. */
  clear(): void {
    this.lights.clear();
    this.visibleCells = new Set();
    this.lastSignature = '';
    this.dirty = true;
  }

  /** Force a recalculation on the next update, e.g. after the grid changed. */
  markDirty(): void {
    this.dirty = true;
  }

  /** Cells lit by at least one enabled light, as "x,y" keys. */
  getVisibleCells(): ReadonlySet<string> {
    return this.visibleCells;
  }

  /** Returns True if at least one enabled light currently reaches cell (x, y). */
  isLit(x: number, y: number): boolean {
    return this.visibleCells.has(`${x},${y}`);
  }

  /**
   * Recalculate lighting if anything changed and push the result into Fog of War.
   * Returns true when a recalculation happened.
   */
  update(fogOfWar?: FogOfWar): boolean {
    const signature = this.computeSignature(fogOfWar);
    if (!this.dirty && signature === this.lastSignature) return false;

    const combined = new Set<string>();
    for (const light of this.lights.values()) {
      if (!this.isActive(light, fogOfWar)) continue;
      const origin = new Vector(Math.round(light.position.x), Math.round(light.position.y));
      this.fov.calculateFOV(origin, light.radius).forEach((key) => combined.add(key));
    }

    this.visibleCells = combined;
    this.lastSignature = signature;
    this.dirty = false;
    fogOfWar?.updateFromFOV(combined);
    return true;
  }

  private isActive(light: Light, fogOfWar?: FogOfWar): boolean {
    if (light.enabled === false || light.radius <= 0) return false;
    if (light.hiddenUntilExplored && fogOfWar) {
      return fogOfWar.isExplored(Math.round(light.position.x), Math.round(light.position.y));
    }
    return true;
  }

  private computeSignature(fogOfWar?: FogOfWar): string {
    const parts: string[] = [];
    for (const light of this.lights.values()) {
      parts.push(
        `${light.id}:${Math.round(light.position.x)},${Math.round(light.position.y)},${light.radius},${this.isActive(light, fogOfWar)}`
      );
    }
    return parts.join('|');
  }
}
