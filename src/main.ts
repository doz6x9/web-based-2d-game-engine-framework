import './styles/main.scss';
import { GameApp } from './GameApp';

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

  // Create and initialize the game app
  const gameApp = new GameApp();

  try {
    await gameApp.init(canvas, gameWidth, gameHeight);
    console.log('GameApp initialized successfully.');

    // Update UI with player position
    setInterval(() => {
      const playerPos = gameApp.getEngine().getPlayerPosition();
      const coordsElement = document.getElementById('playerCoords');
      if (coordsElement) {
        coordsElement.textContent = `${playerPos.x}, ${playerPos.y}`;
      }
    }, 100);

  } catch (error) {
    console.error('Failed to initialize game:', error);
    return;
  }
}

// Start the game when the page loads
initializeGame();
