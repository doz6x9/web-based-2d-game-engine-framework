/**
 * Scale the canvas frame (canvas + HUD overlay) to fill the game stage while
 * keeping the canvas's aspect ratio. The canvas bitmap itself is sized by the
 * engine to the map; this only changes how large it is drawn on the page.
 */
export function fitCanvasToStage(): void {
  const stage = document.getElementById('gameStage');
  const frame = document.getElementById('canvasFrame');
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
  if (!stage || !frame || !canvas) return;

  const narrow = window.matchMedia('(max-width: 900px)').matches;
  const maxW = stage.clientWidth;
  const maxH = narrow ? window.innerHeight * 0.7 : stage.clientHeight;
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height);

  frame.style.width = `${Math.floor(canvas.width * scale)}px`;
  frame.style.height = `${Math.floor(canvas.height * scale)}px`;
}
