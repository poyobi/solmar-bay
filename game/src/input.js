// Solmar Bay — keyboard and mouse state for the game loop.
//
// The loop polls this every step: `down` answers "is it held", `pressed` answers "did it go
// down since the last step" (edge-triggered, for menus, doors and punches), and the mouse
// carries a position plus a click edge for the menu screens. Nothing here knows the game.

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    pressed.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
    mouse.down = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });

  return {
    mouse,
    /** Is this key held right now? */
    isDown(code) {
      return down.has(code);
    },
    /** Did this key go down since the last clearFrame? */
    wasPressed(code) {
      return pressed.has(code);
    },
    /** Eat a key's edge so a second step in the same frame does not act on it again. */
    consume(code) {
      pressed.delete(code);
    },
    /** Eat the mouse click's edge, same idea. */
    consumeClick() {
      mouse.clicked = false;
    },
    /** Any of the given keys held? */
    anyDown(codes) {
      return codes.some((code) => down.has(code));
    },
    /** Any of the given keys freshly pressed? */
    anyPressed(codes) {
      return codes.some((code) => pressed.has(code));
    },
    /** Movement axes from the keys: x is -1..1 (right positive), y is -1..1 (down positive). */
    axes() {
      const x = (down.has('KeyD') || down.has('ArrowRight') ? 1 : 0)
        - (down.has('KeyA') || down.has('ArrowLeft') ? 1 : 0);
      const y = (down.has('KeyS') || down.has('ArrowDown') ? 1 : 0)
        - (down.has('KeyW') || down.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Forget the edges; the loop calls this once per step, after everyone has looked. */
    clearFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
