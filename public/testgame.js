// testgame.js
// ES Module for Test Game
// Assumes arcadeCore.js provides globals: canvas, ctx, baseCols (9), baseRows (16),
// isGameOver, currentScore, animationFrameId, showTitleScreen(), hideTitleScreen(), etc.

let playerPos  = { x: 4, y: 8 };  // current player position
let targetPos  = { x: 4, y: 8 };  // grid cell the player is moving toward
let enemyPos   = { x: 4, y: 2 };
let fastSpeed  = false;
let invincible = false;

let baseLerpSpeed = 3;  // cells per second
let previousTimestamp = 0;

// --- Entry Point ---
// Called by arcadeCore.js when currentGame is set to "testgame"
function startTestGame() {
  // Show title screen on first load.
  showTitleScreen('Test Game Title', () => {
    hideTitleScreen();
    initTestGame();
  });
}

// --- Initialization ---
function initTestGame() {
  arcadeState.isGameOver = false;
  arcadeState.currentScore = 0;
  
  // Reset positions
  playerPos  = { x: 4, y: 8 };
  targetPos  = { x: 4, y: 8 };
  enemyPos   = { x: 4, y: 2 };
  
  previousTimestamp = performance.now();
  
  // Listen to mechanic toggles for test game.
  listenToMechanics();
  
  // Attach input listeners (make sure canvas is defined).
  arcadeState.canvas.addEventListener('click', handleCanvasClick);
  arcadeState.canvas.addEventListener('touchstart', handleCanvasTouchStart, { passive: false });
  
  // Start the game loop.
  arcadeStateanimationFrameId = requestAnimationFrame(gameLoopTestGame);
}

function listenToMechanics() {
  const ref = arcadeState.db.ref('mechanics/testgame');
  ref.off();
  ref.on('value', snap => {
    const val = snap.val() || {};
    fastSpeed  = !!val.fastSpeed;
    invincible = !!val.invincible;
  });
}

// --- Game Loop ---
function gameLoopTestGame(timestamp) {
  if (arcadeState.isGameOver) return;
  
  const deltaTime = (timestamp - previousTimestamp) / 1000;
  previousTimestamp = timestamp;
  
  updateTestGame(deltaTime);
  renderTestGame();
  
  arcadeState.animationFrameId = requestAnimationFrame(gameLoopTestGame);
}

// --- Update Logic ---
function updateTestGame(deltaTime) {
  const lerpSpeed = fastSpeed ? baseLerpSpeed * 2 : baseLerpSpeed;
  
  // Lerp playerPos toward targetPos.
  let dx = targetPos.x - playerPos.x;
  let dy = targetPos.y - playerPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > 0.001) {
    const step = lerpSpeed * deltaTime;
    if (step >= dist) {
      playerPos.x = targetPos.x;
      playerPos.y = targetPos.y;
    } else {
      playerPos.x += (dx / dist) * step;
      playerPos.y += (dy / dist) * step;
    }
  }
  
  // Collision with enemy:
  if (!invincible) {
    const ex = enemyPos.x - playerPos.x;
    const ey = enemyPos.y - playerPos.y;
    const enemyDist = Math.sqrt(ex * ex + ey * ey);
    if (enemyDist < 0.5) {
      gameOver(() => { initTestGame(); });
      return;
    }
  }
  
  // Increase score for demonstration.
  arcadeState.currentScore++;
  if (arcadeState.scoreElement) {
    arcadeState.scoreElement.innerText = 'Score: ' + arcadeState.currentScore;
  }
}

// --- Render ---
function renderTestGame() {
  arcadeState.ctx.clearRect(0, 0, arcadeState.canvas.width, arcadeState.canvas.height);
  
  const cellW = arcadeState.canvas.width / arcadeState.baseCols;
  const cellH = arcadeState.canvas.height / arcadeState.baseRows;
  
  // Draw checkerboard.
  for (let r = 0; r < arcadeState.baseRows; r++) {
    for (let c = 0; c < arcadeState.baseCols; c++) {
      arcadeState.ctx.fillStyle = ((r + c) % 2 === 0) ? '#444' : '#666';
      arcadeState.ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
    }
  }
  
  // Draw enemy (red square).
  arcadeState.ctx.fillStyle = 'red';
  arcadeState.ctx.fillRect(enemyPos.x * cellW, enemyPos.y * cellH, cellW, cellH);
  
  // Draw player (green square).
  arcadeState.ctx.fillStyle = 'green';
  arcadeState.ctx.fillRect(playerPos.x * cellW, playerPos.y * cellH, cellW, cellH);
}

// --- Input Handlers ---
function handleCanvasClick(e) {
  if (arcadeState.isGameOver) return;
  
  const rect = arcadeState.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  snapToGrid(x, y);
}

function handleCanvasTouchStart(e) {
  if (arcadeState.isGameOver) return;
  e.preventDefault();
  
  const rect = arcadeState.canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  
  snapToGrid(x, y);
}

/**
 * snapToGrid:
 * Converts pixel coordinates into integer grid coordinates,
 * then sets targetPos for the player.
 */
function snapToGrid(x, y) {
  const cellW = arcadeState.canvas.width / arcadeState.baseCols;
  const cellH = arcadeState.canvas.height / arcadeState.baseRows;
  
  const col = Math.floor(x / cellW);
  const row = Math.floor(y / cellH);
  
  targetPos.x = Math.max(0, Math.min(arcadeState.baseCols - 1, col));
  targetPos.y = Math.max(0, Math.min(arcadeState.baseRows - 1, row));
}

// Export the public API.
export { startTestGame };
