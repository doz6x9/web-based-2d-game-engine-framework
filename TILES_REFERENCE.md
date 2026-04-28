# Tile Reference Guide

This document outlines the tile IDs used in the map engine and which visual assets (from `/src/assets/textures/`) they are mapped to. You can use these IDs when creating new maps in JSON or building procedural generation logic.

## Base Terrain

| Tile ID | Name | Walkable? | Movement Cost | Texture File | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | Grass | Yes | 1 | `grass.png` | Standard grassy terrain. Often used as a default empty space. |
| **2** | Water | No | Infinity | `water.png` | Standard water. Generally impassable unless a bridge or shallow water is placed over it. |
| **3** | Sand | Yes | 1.5 | `sand.png` | Sandy terrain, slightly more difficult to traverse than grass. |
| **7** | Snow | Yes | 1.5 | `snow.png` | Snowy terrain, slightly more difficult to traverse. |
| **10** | Swamp | Yes | 3 | `mud.png` | Muddy, dark swampy terrain that is difficult to move through. |

## Paths & Floors

| Tile ID | Name | Walkable? | Movement Cost | Texture File | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **4** | Path | Yes | 0.5 | `path.png` | A dirt or stone path that is easy to walk on. |
| **5** | Stone Floor | Yes | 1 | `stone tile.png` | A solid stone floor, often used in dungeons or courtyards. |
| **8** | Cave Floor | Yes | 1.2 | `cave gravel.png` | Gravelly floor found inside caves. |
| **9** | Wood Floor | Yes | 1 | `wood tile.png` | Wooden floorboards, perfect for indoor areas. |

## Obstacles & Walls

| Tile ID | Name | Walkable? | Movement Cost | Texture File | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Cave Wall | No | Infinity | `caveCliff2.png` | A solid cave wall. The renderer will automatically handle corners and edges. |
| **6** | Deep Water | No | Infinity | `deepocean.png` | Deep ocean water, completely impassable. |
| **11** | Forest | No | Infinity | `map tile forest.png` | A dense forest of trees that blocks movement. |

---

### How to use this in `test-map.json`

Your map JSON files consist of two primary layers:
1. **`terrain` layer:** Defines the visual appearance (the IDs listed above).
2. **`collision` layer:** Defines walkability independently. A `0` means the player can walk there, and a `1` means the player cannot.

*Note: The engine will safely ignore the `collision` layer visually, so it won't accidentally cover up your beautiful textures with generic grass/walls anymore!*