/***********************************************************
 * testgame.js
 * - Snaps to grid (no fractional positions)
 * - Fixes mobile taps via touchstart
 ***********************************************************/

// Game-specific variables
let playerPos  = { x: 4, y: 8  }; // current player position (floating, if you're lerping)
let targetPos  = { x: 4, y: 8  }; // grid cell the player wants to reach
let enemyPos   = { x: 4, y: 2  };
let fastSpeed  = false;
let invincible = false;

let baseLerpSpeed = 3;  // cells per second
let previousTimestamp = 0;

/*************************************************************
 * Called by arcadeCore.js -> loadGame('testgame')
 *************************************************************/
function startTestGame() {
  // Show a title screen the first time
  showTitleScreen('Test Game Title', () => {
    hideTitleScreen();
    initTestGame();
  });
}

/*************************************************************
 * Initialize the game (no additional title screen here)
 *************************************************************/
function initTestGame() {
  isGameOver = false;
  currentScore = 0;

  // Reset positions
  playerPos  = { x: 4, y: 8 };
  targetPos  = { x: 4, y: 8 };
  enemyPos   = { x: 4, y: 2 };

  previousTimestamp = performance.now();

  // Listen to mechanic toggles
  listenToMechanics();

  // Attach input listeners (for both desktop clicks and mobile taps)
  // Make sure these are added AFTER canvas is defined in arcadeCore.js
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('touchstart', handleCanvasTouchStart, { passive: false });

  // Start the game loop
  animationFrameId = requestAnimationFrame(gameLoopTestGame);
}

/*************************************************************
 * Show/Hide Title Screen (you can keep them in testgame.js
 * or move them into arcadeCore)
 *************************************************************/
function showTitleScreen(title, onStart) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999
  });
  overlay.id = 'titleOverlay';

  const h1 = document.createElement('h1');
  h1.innerText = title;
  h1.style.color = 'white';

  const startBtn = document.createElement('button');
  startBtn.innerText = 'Start';
  Object.assign(startBtn.style, {
    fontFamily: '"Press Start 2P", sans-serif',
    fontSize: '16px',
    padding: '10px 20px',
    border: '4px solid white',
    cursor: 'pointer',
    backgroundColor: '#000',
    color: '#fff',
    marginTop: '20px'
  });
  startBtn.onclick = () => {
    document.body.removeChild(overlay);
    if (onStart) onStart();
  };

  overlay.appendChild(h1);
  overlay.appendChild(startBtn);
  document.body.appendChild(overlay);
}

function hideTitleScreen() {
  const overlay = document.getElementById('titleOverlay');
  if (overlay) {
    document.body.removeChild(overlay);
  }
}

/*************************************************************
 * Mechanics toggles (fastSpeed, invincible)
 *************************************************************/
function listenToMechanics() {
  const ref = db.ref('mechanics/testgame');
  ref.off();
  ref.on('value', snap => {
    const val = snap.val() || {};
    fastSpeed  = !!val.fastSpeed;
    invincible = !!val.invincible;
  });
}

/*************************************************************
 * GAME LOOP
 *************************************************************/
function gameLoopTestGame(timestamp) {
  if (isGameOver) return;

  const deltaTime = (timestamp - previousTimestamp) / 1000;
  previousTimestamp = timestamp;

  updateTestGame(deltaTime);
  renderTestGame();

  animationFrameId = requestAnimationFrame(gameLoopTestGame);
}

/*************************************************************
 * UPDATE LOGIC
 *************************************************************/
function updateTestGame(deltaTime) {
  // Lerp speed changes if fastSpeed is true
  const lerpSpeed = fastSpeed ? baseLerpSpeed * 2 : baseLerpSpeed;

  // Lerp from playerPos to targetPos
  let dx = targetPos.x - playerPos.x;
  let dy = targetPos.y - playerPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0.001) {
    const step = lerpSpeed * deltaTime;
    if (step >= dist) {
      // reach target in this frame
      playerPos.x = targetPos.x;
      playerPos.y = targetPos.y;
    } else {
      // partial movement
      playerPos.x += (dx / dist) * step;
      playerPos.y += (dy / dist) * step;
    }
  }

  // Collision check with enemy
  if (!invincible) {
    const ex = enemyPos.x - playerPos.x;
    const ey = enemyPos.y - playerPos.y;
    const enemyDist = Math.sqrt(ex * ex + ey * ey);
    if (enemyDist < 0.5) {
      // Game Over
      gameOver(() => initTestGame());
      return;
    }
  }

  // Increase score continuously for demonstration
  currentScore++;
  if (scoreElement) {
    scoreElement.innerText = 'Score: ' + currentScore;
  }
}

/*************************************************************
 * RENDER
 *************************************************************/
function renderTestGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cellW = canvas.width  / baseCols;  // baseCols=9
  const cellH = canvas.height / baseRows;  // baseRows=16

  // Checkerboard
  for (let r = 0; r < baseRows; r++) {
    for (let c = 0; c < baseCols; c++) {
      ctx.fillStyle = ((r + c) % 2 === 0) ? '#444' : '#666';
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
    }
  }

  // Enemy (red square)
  ctx.fillStyle = 'red';
  ctx.fillRect(enemyPos.x * cellW, enemyPos.y * cellH, cellW, cellH);

  // Player (green square)
  ctx.fillStyle = 'green';
  ctx.fillRect(playerPos.x * cellW, playerPos.y * cellH, cellW, cellH);
}

/*************************************************************
 * INPUT HANDLERS
 *************************************************************/
function handleCanvasClick(e) {
  if (isGameOver) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  snapToGrid(x, y);
}

function handleCanvasTouchStart(e) {
  if (isGameOver) return;
  e.preventDefault();  // allow tap

  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  snapToGrid(x, y);
}

/**
 * snapToGrid:
 * Converts pixel coordinates (x, y) into integer grid coords,
 * then sets targetPos so the player will lerp to that cell.
 */
function snapToGrid(x, y) {
  const cellW = canvas.width  / baseCols; // 9
  const cellH = canvas.height / baseRows; // 16

  // Floor to the nearest integer grid cell
  const col = Math.floor(x / cellW);
  const row = Math.floor(y / cellH);

  // Clamp within 0..(baseCols-1), 0..(baseRows-1)
  targetPos.x = Math.max(0, Math.min(baseCols - 1, col));
  targetPos.y = Math.max(0, Math.min(baseRows - 1, row));
}
