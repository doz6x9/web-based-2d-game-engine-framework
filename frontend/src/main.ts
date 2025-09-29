// frontend/src/main.ts
import * as PIXI from 'pixi.js';

// 1. Create a new application instance
const app = new PIXI.Application({
    width: 800,
    height: 600,
    backgroundColor: 0x1099bb,
});

// 2. Add the view to the HTML document body
document.body.appendChild(app.view as HTMLCanvasElement);

// 3. Create a spinning square (a simple sprite)
const square = new PIXI.Graphics();
square.beginFill(0xffffff); // White color
square.drawRect(0, 0, 100, 100);
square.endFill();
square.x = app.screen.width / 2;
square.y = app.screen.height / 2;
square.pivot.x = 50; // Set pivot to center for spinning
square.pivot.y = 50;

app.stage.addChild(square);

// 4. Game loop / Ticker
app.ticker.add((delta) => {
    square.rotation += 0.01 * delta; // Spin the square
});

console.log("PixiJS Application Initialized.");