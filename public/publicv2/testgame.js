/***********************************************************
 * testgame.js
 * - Shows a title screen on first load
 * - On game over, calls the common gameOver(...),
 *   passing a "restartCallback" to skip the title
 ***********************************************************/

// Game-specific variables
let playerPos  = { x: 4,  y: 8 };
let targetPos  = { x: 4,  y: 8 };
let enemyPos   = { x: 4,  y: 2 };
let fastSpeed  = false;
let invincible = false;

let baseLerpSpeed = 3;  // cells/sec
let previousTimestamp = 0;

/*************************************************************
 * Called by arcadeCore.js -> loadGame('testgame')
 *************************************************************/
function startTestGame() {
  // Show a title screen only once, then call initTestGame
  showTitleScreen('Test Game Title', () => {
    hideTitleScreen();
    initTestGame();
  });
}

/*************************************************************
 * Initialize game (no title screen)
 *************************************************************/
function initTestGame() {
  isGameOver = false;
  currentScore = 0;

  // Reset positions
  playerPos = { x: 4, y: 8 };
  targetPos = { x: 4, y: 8 };
  enemyPos  = { x: 4, y: 2 };

  previousTimestamp = performance.now();

  // Listen to mechanics toggles
  listenToMechanics();

  // Attach input listeners
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('touchstart', handleCanvasTouchStart, { passive: false });

  // Start loop
  animationFrameId = requestAnimationFrame(gameLoopTestGame);
}

/*************************************************************
 * Title Screen Helpers
 * (You can keep these in testgame.js or unify them in arcadeCore)
 *************************************************************/
function showTitleScreen(title, onStart) {
  // create an overlay
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
    fastSpeed = !!val.fastSpeed;
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
 * UPDATE
 *************************************************************/
function updateTestGame(deltaTime) {
  // Lerp
  const lerpSpeed = fastSpeed ? baseLerpSpeed * 2 : baseLerpSpeed;
  let dx = targetPos.x - playerPos.x;
  let dy = targetPos.y - playerPos.y;
  let dist = Math.sqrt(dx*dx + dy*dy);

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

  // Collision check
  if (!invincible) {
    let ex = enemyPos.x - playerPos.x;
    let ey = enemyPos.y - playerPos.y;
    let enemyDist = Math.sqrt(ex*ex + ey*ey);
    if (enemyDist < 0.5) {
      // Game Over
      gameOver(() => initTestGame());  // <--- PASS RESTART CALLBACK
      return;
    }
  }

  // Increase score
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

  const cellW = canvas.width  / baseCols;
  const cellH = canvas.height / baseRows;

  // Checkerboard
  for (let r = 0; r < baseRows; r++) {
    for (let c = 0; c < baseCols; c++) {
      ctx.fillStyle = ((r + c) % 2 === 0) ? '#444' : '#666';
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
    }
  }

  // Enemy
  ctx.fillStyle = 'red';
  ctx.fillRect(enemyPos.x * cellW, enemyPos.y * cellH, cellW, cellH);

  // Player
  ctx.fillStyle = 'green';
  ctx.fillRect(playerPos.x * cellW, playerPos.y * cellH, cellW, cellH);
}

/*************************************************************
 * INPUT
 *************************************************************/
function handleCanvasClick(e) {
  if (isGameOver) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  movePlayer(x, y);
}

function handleCanvasTouchStart(e) {
  if (isGameOver) return;
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;
  movePlayer(x, y);
}

function movePlayer(x, y) {
  const cellW = canvas.width  / baseCols;
  const cellH = canvas.height / baseRows;
  targetPos.x = Math.min(baseCols - 1, Math.max(0, x / cellW));
  targetPos.y = Math.min(baseRows - 1, Math.max(0, y / cellH));
}
