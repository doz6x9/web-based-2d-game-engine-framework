import './styles/main.scss';
import { GameEngine } from './engine/GameEngine';

/**
 * Initialize the game
 */
async function initializeGame() {
  // Get the canvas element
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }

  const gameWidth = 1280;
  const gameHeight = 720;

  // Create and initialize the game engine
  const engine = new GameEngine();

  try {
    // Initialize the engine (including renderer, mouse handler, UI manager, asset loading, map loading)
    await engine.init(canvas, gameWidth, gameHeight);
    console.log('GameEngine initialized successfully.');

    // Update UI with player position
    setInterval(() => {
      const playerPos = engine.getPlayerPosition();
      const coordsElement = document.getElementById('playerCoords');
      if (coordsElement) {
        coordsElement.textContent = `${playerPos.x}, ${playerPos.y}`;
      }
    }, 100);

    // The mouse coordinate display is now handled by the Renderer directly.
    // The mouseHandler in GameEngine will call the Renderer's updateMouseHUD method.

  } catch (error) {
    console.error('Failed to initialize game:', error);
    return;
  }
}

// Start the game when the page loads
initializeGame();
