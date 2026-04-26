import './styles/main.scss';
import { GameEngine } from './engine/GameEngine';
import { Item, ItemType } from './engine/core/Item'; // Import Item and ItemType
import { Vector } from './engine/core/Vector'; // Import Vector

async function initializeGame() {
  // Initialize the game engine
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  const engine = new GameEngine(canvas, 1280, 720);

  // Load visual assets
  try {
    await engine.getRenderer().loadAssets([
      { id: 'hero', path: '/src/assets/hero.png' },
      { id: 'potion', path: '/src/assets/potion.png' } // Load potion sprite
      // Add other assets here as needed
    ]);
    console.log('Visual assets loaded successfully.');
  } catch (error) {
    console.error('Failed to load visual assets:', error);
    return; // Stop initialization if assets fail to load
  }

  // Load the demo map
  try {
    await engine.loadMap('/maps/test-map.json');
    console.log('Map loaded successfully.');
  } catch (error) {
    console.error('Failed to load map:', error);
    return; // Stop initialization if map fails to load
  }

  // Add a demo item to the map
  const healthPotion = new Item(
    'health_potion',
    'Health Potion',
    'Restores a small amount of health.',
    'potion', // Use the 'potion' sprite ID
    ItemType.CONSUMABLE,
    true, // Stackable
    5,    // Max stack size
    1     // Initial quantity
  );
  engine.addMapObject(healthPotion.toMapObject(new Vector(3, 3))); // Place at (3,3)

  // Update UI with player position
  setInterval(() => {
    const playerPos = engine.getPlayerPosition();
    document.getElementById('playerCoords')!.textContent = `${playerPos.x}, ${playerPos.y}`;
  }, 100);

  // Update UI with mouse position
  const mouseHandler = engine.getMouseHandler();
  mouseHandler.on(
    'move' as any,
    (pos) => {
      document.getElementById('mouseCoords')!.textContent = `${pos.x}, ${pos.y}`;
    }
  );
}

initializeGame();
