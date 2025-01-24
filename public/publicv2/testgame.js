/***********************************************************
 * testgame.js
 ***********************************************************/

// We'll track a few game-specific variables
let playerPos = { x: 4, y: 8 }; // Middle-ish of 9×16
let enemyPos = { x: 4, y: 2 };
let fastSpeed = false;     // Mechanic from Firebase
let invincible = false;    // Mechanic from Firebase

// startTestGame is called from arcadeCore.js's loadGame('testgame')
function startTestGame() {
  // Show the title screen only once, then skip it on "Try Again"
  showTitleScreen('Test Game Title', () => {
    // Once start is pressed
    hideTitleScreen();
    initTestGame();
  });
}

function initTestGame() {
  // Start listening to mechanic toggles in firebase
  listenToMechanics();

  // Reset in-game variables
  currentScore = 0;
  playerPos = { x: 4, y: 8 };
  enemyPos = { x: 4, y: 2 };

  // Start the animation loop
  isGameOver = false;
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Listen for toggles stored in "mechanics/testgame"
function listenToMechanics() {
  const mechanicsRef = db.ref('mechanics/testgame');
  mechanicsRef.off(); // remove old listeners if any

  mechanicsRef.on('value', snapshot => {
    const val = snapshot.val() || {};
    fastSpeed = !!val.fastSpeed;        // convert to boolean
    invincible = !!val.invincible;
    console.log("Mechanics updated:", fastSpeed, invincible);
  });
}

function gameLoop(timestamp) {
  if (isGameOver) return;
  update();
  render();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function update() {
  // Optionally, you can move the enemy or do something to cause collisions
  // We'll do a simple "if the player is on the same square as enemy" => gameOver
  if (!invincible && playerPos.x === enemyPos.x && playerPos.y === enemyPos.y) {
    // Player collided with enemy
    gameOver();
    return;
  }

  // Increase score over time for demonstration
  currentScore += 1;
  if (scoreElement) scoreElement.innerText = 'Score: ' + currentScore;

  // If the player toggled "fast speed," you could move an enemy or something faster
  // But for simplicity, let's leave it at that.
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Each cell in 9×16: figure out the cell size
  const cellW = canvas.width / baseCols;
  const cellH = canvas.height / baseRows;

  // Draw checkerboard
  for (let r = 0; r < baseRows; r++) {
    for (let c = 0; c < baseCols; c++) {
      // Alternate color
      ctx.fillStyle = ((r + c) % 2 === 0) ? '#444' : '#666';
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
    }
  }

  // Draw enemy (car sprite from frogger, or a red square for example)
  ctx.fillStyle = 'red';
  ctx.fillRect(enemyPos.x * cellW, enemyPos.y * cellH, cellW, cellH);

  // Draw player sprite (just a green square for test)
  ctx.fillStyle = 'green';
  ctx.fillRect(playerPos.x * cellW, playerPos.y * cellH, cellW, cellH);
}

// Input: snap the player to nearest grid cell
// We attach listeners on the canvas directly
canvas?.addEventListener('click', e => {
  if (isGameOver) return;

  // Compute which cell was clicked
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const cellW = canvas.width / baseCols;
  const cellH = canvas.height / baseRows;

  let col = Math.floor(x / cellW);
  let row = Math.floor(y / cellH);

  // If "fastSpeed" is true, we could, for example, move 2 steps
  const step = fastSpeed ? 2 : 1;

  // Snap or clamp
  playerPos.x = Math.max(0, Math.min(baseCols - 1, col));
  playerPos.y = Math.max(0, Math.min(baseRows - 1, row));
});
