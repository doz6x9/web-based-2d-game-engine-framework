# Getting Started with the 2D Game Engine Framework

This guide will help you set up the engine and start building your own game.

## 1. Prerequisites
- **Node.js (v16+)**: [Download here](https://nodejs.org/)
- **Git**: To clone the repository.
- **Code Editor**: [Visual Studio Code](https://code.visualstudio.com/) is recommended.

## 2. Setup
1. **Clone the Repository:**
   ```bash
   git clone <repository-url>
   cd web-based-2d-game-engine-framework
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

## 3. Creating Your First Map
Maps are stored in `public/maps/` as JSON files.

1. **Map Structure:** Create a JSON file (e.g., `my-map.json`):
   ```json
   {
     "name": "My Epic Level",
     "width": 40,
     "height": 40,
     "layers": [
       { "name": "terrain", "data": [[...]] },
       { "name": "collision", "data": [[...]] }
     ],
     "objects": [
       { "type": "PLAYER_SPAWN", "x": 5, "y": 5 },
       { "type": "ITEM", "id": "sword_01", "name": "Sword", "item_type": "WEAPON", "x": 10, "y": 10 }
     ]
   }
   ```
2. **Terrain IDs:**
   - `0`: Grass (Walkable)
   - `1`: Wall (Solid)
   - `4`: Water (Solid)
   - `11`: Cave Floor

## 4. Customizing the Game Logic
The engine is highly modular. Most logic changes happen in:
- `src/engine/GameEngine.ts`: The main brain. This is where you handle interactions, combat rules, and game state.
- `src/engine/core/MapObject.ts`: Define new types of NPCs or Interactive Objects here.

### Example: Adding a New Item Effect
In `GameEngine.ts`, inside the `onInteract` method:
```typescript
if (item.type === ItemType.CONSUMABLE) {
    if (item.id === 'super_potion') {
        this.playerHealth = this.playerMaxHealth; // Full heal!
    }
}
```

## 5. Assets
Add your `.png` sprites to `public/assets/`. To use them in the game, register them in the `init` method of `GameEngine.ts`:
```typescript
await this.renderer.loadAssets([
    { id: 'my_sprite', path: '/assets/my_sprite.png' }
]);
```

## 6. Building for Deployment
When your game is ready, create a production-ready bundle:
```bash
npm run build
```
The contents of the `dist` folder can be uploaded to any web host (GitHub Pages, Netlify, Vercel, etc.).

## 7. Useful Tips
- **Dev Tools:** Check the "Dev Tools" box in the game UI to see real-time FPS and coordinates.
- **Browser Console:** Press `F12` to see debug logs and errors.
- **Mute Music:** Use the Mute button in the menu if the BGM is too loud during development!
