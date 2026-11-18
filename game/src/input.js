// Solmar Bay — input.
// Held keys live in a Set keyed by KeyboardEvent.code; one-shot presses are
// queued separately and cleared at the end of each fixed step, so a tap
// between frames is never lost and never counted twice. The mouse position
// is stored in canvas pixels and converted to world space by the camera.

// Keyboard + mouse input: held state, one-shot press queue, aim position in screen space.
export const keys = new Set();
export const pressed = new Set();
export const mouse = {
  x: 640, y: 360, down: false, clicked: false
}
;
let canvasRef = null;
export function initInput(canvas) {
  canvasRef = canvas;
  addEventListener('keydown', (e) => {     if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {     const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true;
      mouse.clicked = true;
    } });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
export function wasPressed(...codes) {
  return codes.some((c) => pressed.has(c));
}
export function endFrameInput() {
  pressed.clear();
  mouse.clicked = false;
}
export function moveAxis() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  const m = Math.hypot(x, y) || 1;
  return {
    x: x / m, y: y / m, active: x !== 0 || y !== 0
  }
  ;
}
export function canvasEl() {
  return canvasRef;
}
