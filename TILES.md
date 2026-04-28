# Tile Reference Guide

This document outlines the tile IDs used in the map engine and which visual assets (from `/src/assets/textures/`) they are mapped to. You can use these IDs when creating new maps in JSON or building procedural generation logic.

## Base Terrain

| Tile ID | Name | Walkable? | Texture File | Description |
| :--- | :--- | :--- | :--- | :--- |
| **0** | Grass | Yes | `grass.png` | Standard grassy terrain. Often used as a default empty space. |
| **2** | Grass | Yes | `grass.png` | Standard grassy terrain (interchangeable with 0). |
| **3** | Swamp | Yes | `mud.png` | Muddy, dark swampy terrain. |
| **5** | Water | No | `water.png` | Standard water. Generally impassable unless a bridge or shallow water is placed over it. |
| **10** | Shallow Water | Yes | `shallowwater.png` | Water that characters can wade through. |
| **11** | Deep Water | No | `deepocean.png` | Deep ocean water, completely impassable. |

## Paths & Roads

| Tile ID | Name | Walkable? | Texture File | Description |
| :--- | :--- | :--- | :--- | :--- |
| **4** | Grass Path | Yes | `path.png` | A dirt or stone path that blends nicely into grass. |
| **12** | Swamp Path | Yes | `gravel.png` | A gravel path that blends into the swamp/mud areas. |

## Environment & Obstacles

| Tile ID | Name | Walkable? | Texture File | Description |
| :--- | :--- | :--- | :--- | :--- |
| **6** | Tall Grass | Yes | `junglegrass.png` | Overgrown grass. Can be walked through but adds visual variety. |
| **7** | Tree | No | `map tile forest.png` | A tree obstacle blocking movement. |
| **8** | Stone Tile | Yes/No | `stone tile.png` | Can be used as a structural wall or a decorative stone floor courtyard. |
| **9** | Wood Wall | No | `wood wall.png` | A wooden structural wall or barricade. |

## Structural Walls (Autotiled)

The map engine features an autotiling system for structural walls. When you place a Wall tile (ID `1`), the engine automatically looks at the surrounding tiles and selects the appropriate corner or straight edge texture to make the walls look connected.

| Tile ID | Name | Walkable? | Texture File | Description |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Generic Wall | No | `caveCliff2.png` | The engine automatically calculates whether this should be a horizontal wall, vertical wall, or a corner (top-left, top-right, bottom-left, bottom-right) based on its neighbors. Currently, all variations fall back to `caveCliff2.png`. |

---

### How to use this in `test-map.json`

Your map JSON files consist of two primary layers:
1. **`terrain` layer:** Defines the visual appearance (the IDs listed above).
2. **`collision` layer:** Defines walkability independently. A `0` means the player can walk there, and a `1` means the player cannot.

*Note: The engine will safely ignore the `collision` layer visually, so it won't accidentally cover up your beautiful textures with generic grass/walls anymore!*