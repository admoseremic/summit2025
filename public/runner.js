// runner.js
// ES Module for Runner game (endless runner similar to Chrome Dino)
// Assumes arcadeCore.js provides globals: arcadeState, showTitleScreen, hideTitleScreen, gameOver, etc.
// Also assumes Firebase is initialized in arcadeCore.js.

const GRAVITY = 25; // arcade units/sec²
const BASE_JUMP_HEIGHT = 3; // desired jump height (arcade units)
const BASE_JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * BASE_JUMP_HEIGHT);

let runnerState = null;

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function checkAABBCollision(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function checkCollisions() {
  // For collision, any obstacle (except coins) overlapping the player triggers game over.
  const playerBox = {
    x: runnerState.player.x,
    y: runnerState.player.y,
    width: 1,
    height: 1,
  };

  for (let ob of runnerState.obstacles) {
    if (ob.type === "coin") {
      if (checkAABBCollision(playerBox, { x: ob.x, y: ob.y, width: ob.width, height: ob.height })) {
        arcadeState.currentScore += 500;
        ob.collected = true;
        arcadeState.playSound(arcadeState.sounds.runnerCoin);
      }
    } else {
      // On collision with any non-coin obstacle, set player state to "hit" and then trigger game over.
      if (checkAABBCollision(playerBox, { x: ob.x, y: ob.y, width: ob.width, height: ob.height })) {
        runnerState.player.state = "hit";
        gameOver(() => { initRunner(); });
        return;
      }
    }
  }
  runnerState.obstacles = runnerState.obstacles.filter(ob => !(ob.type === "coin" && ob.collected));
}

function initRunner() {
  arcadeState.isGameOver = false;

  runnerState = {
    player: {
      x: 1,         // Player should be in the second column (x = 1)
      y: 0,         // Will be set based on ground
      vy: 0,
      jumpCount: 0,
      // Animation properties:
      state: "run",       // "run", "jump", "fall", or "hit"
      frameIndex: 0,
      frameTimer: 0,
      frameDuration: 100,  // milliseconds per frame
      frameDirection: 1
    },
    // Ground system: fixed array of exactly 10 columns (9 on-screen + 1 off-screen to the right)
    groundProfile: [],
    groundOffset: 0,  // Horizontal offset (in arcade units) of the leftmost column
    pendingElevationChange: 0,   // For upcoming elevation changes
    pendingPitColumns: 0,        // Number of columns that should be pits
    pendingBridge: false,        // Flag for bridges mechanic
    resumeGround: undefined,     // Stored ground level before a pit, to resume later
    obstacles: [],
    terrainOffset: 0,            // For obstacle spacing
    nextObstacleDistance: 6,
    terrainSpeed: 3,             // Base scrolling speed (arcade units/sec)
    speedMultiplier: 1,
    speedIncreaseTimer: 0,
    mechanics: {
      doubleJump: false,
      bridges: false,
      coins: false,
    },
    prevPlayerGround: undefined, // For tracking effective ground level
  };

  // Initialize groundProfile with 10 columns.
  const cols = 10;
  for (let i = 0; i < cols; i++) {
    runnerState.groundProfile.push(5);
  }
  runnerState.groundOffset = 0;
  runnerState.pendingElevationChange = 0;
  runnerState.pendingPitColumns = 0;
  runnerState.pendingBridge = false;
  runnerState.resumeGround = undefined;

  // Set player's starting vertical position based on the second column (index 1).
  let currentGround = runnerState.groundProfile[1];
  let groundTop = arcadeState.baseRows - currentGround;
  runnerState.player.y = groundTop - 1;
  runnerState.player.vy = 0;
  runnerState.player.jumpCount = 0;
  runnerState.prevPlayerGround = currentGround;

  arcadeState.currentScore = 0;

  // Set up input for immediate jump triggering.
  arcadeState.canvas.removeEventListener("mousedown", handleRunnerInput);
  arcadeState.canvas.removeEventListener("touchstart", handleRunnerInput);
  arcadeState.canvas.addEventListener("mousedown", handleRunnerInput);
  arcadeState.canvas.addEventListener("touchstart", handleRunnerInput, { passive: false });

  listenToRunnerMechanics();

  arcadeState.previousTimestamp = performance.now();
  arcadeState.animationFrameId = performance.now();
  arcadeState.animationFrameId = requestAnimationFrame(gameLoopRunner);
}

function handleRunnerInput(e) {
  if (arcadeState.isGameOver) return;
  e.preventDefault();

  const p = runnerState.player;
  // Compute floor check points, offset 10% inward.
  const blX = p.x + 0.1, blY = p.y + 1;
  const brX = p.x + 0.9, brY = p.y + 1;
  const colIndexLeft = Math.floor(runnerState.groundOffset + blX);
  const colIndexRight = Math.floor(runnerState.groundOffset + brX - 0.001);
  const groundHeightLeft = runnerState.groundProfile[colIndexLeft] || 0;
  const groundHeightRight = runnerState.groundProfile[colIndexRight] || 0;
  // Use absolute values for collision (for bridges, negative values become positive).
  const effGroundLeft = groundHeightLeft < 0 ? -groundHeightLeft : groundHeightLeft;
  const effGroundRight = groundHeightRight < 0 ? -groundHeightRight : groundHeightRight;
  const groundTopLeft = arcadeState.baseRows - effGroundLeft;
  const groundTopRight = arcadeState.baseRows - effGroundRight;
  const isStanding = (blY >= groundTopLeft) || (brY >= groundTopRight);

  // Check if the player's full hitbox is over a pit.
  const leftEdge = p.x, rightEdge = p.x + 1;
  const fullyOverPit = runnerState.obstacles.some(ob =>
    ob.type === "pit" && (leftEdge >= ob.x && rightEdge <= (ob.x + ob.width))
  );
  const allowedJumps = fullyOverPit
    ? (runnerState.mechanics.doubleJump ? 1 : 0)
    : (runnerState.mechanics.doubleJump ? 2 : 1);

  // Always apply full jump impulse if allowed.
  if (p.jumpCount < allowedJumps) {
    p.vy = BASE_JUMP_VELOCITY;
    p.jumpCount++;
    arcadeState.playSound(arcadeState.sounds.runnerJump);
  }
}

function generateObstacle() {
  let types = ["pit", "groundObstacle", "airObstacle", "bird", "elevation"];
  if (runnerState.mechanics.coins) {
    types.push("coin");
  }
  let type = types[Math.floor(Math.random() * types.length)];
  let spawnX = arcadeState.baseCols + randomRange(0, 1);

  if (type === "pit") {
    runnerState.resumeGround = runnerState.groundProfile[runnerState.groundProfile.length - 1];
    runnerState.pendingPitColumns = 3;
    return;
  }

  let obstacle = { type, x: spawnX, awarded: false };
  let currentGround = runnerState.groundProfile[runnerState.groundProfile.length - 1] || 5;

  switch (type) {
    case "groundObstacle":
      obstacle.width = 0.5;
      obstacle.height = 0.5;
      obstacle.y = arcadeState.baseRows - currentGround - 0.5;
      break;
    case "airObstacle":
      obstacle.width = 0.5;
      obstacle.height = 0.5;
      obstacle.y = arcadeState.baseRows - currentGround - 1.1 - 0.5;
      break;
    case "bird":
      obstacle.width = 0.5;
      obstacle.height = 0.5;
      const destX = 5;
      const destY = (Math.random() < 0.5)
        ? (arcadeState.baseRows - currentGround - 0.6)
        : (arcadeState.baseRows - currentGround - 1.6);
      obstacle.destX = destX;
      obstacle.destY = destY;
      const spawnY = destY - (spawnX - destX);
      obstacle.spawnX = spawnX;
      obstacle.spawnY = spawnY;
      obstacle.y = spawnY;
      const currentScrollSpeed = runnerState.terrainSpeed * runnerState.speedMultiplier;
      const v = 2;
      obstacle.vx = -v + currentScrollSpeed;
      obstacle.vy = v;
      obstacle.phase = "swooping";
      arcadeState.playSound(arcadeState.sounds.swoop);
      break;
    case "elevation":
      let change = (Math.random() < 0.5) ? 1 : -1;
      if ((change === 1 && currentGround < 10) || (change === -1 && currentGround > 2)) {
        runnerState.pendingElevationChange = change;
      } else {
        runnerState.resumeGround = runnerState.groundProfile[runnerState.groundProfile.length - 1];
        runnerState.pendingPitColumns = 2;
        return;
      }
      return;
    case "coin":
      obstacle.width = 1;
      obstacle.height = 1;
      obstacle.y = arcadeState.baseRows - currentGround - (Math.random() < 0.5 ? 1 : 2);
      break;
    default:
      break;
  }
  obstacle.id = Date.now() + Math.random();
  runnerState.obstacles.push(obstacle);
}

function updateRunner(deltaTime) {
  // Increase speed over time.
  runnerState.speedIncreaseTimer += deltaTime;
  if (runnerState.speedIncreaseTimer >= 4) {
    runnerState.speedMultiplier *= 1.1;
    runnerState.speedIncreaseTimer -= 4;
  }

  const moveDist = runnerState.terrainSpeed * runnerState.speedMultiplier * deltaTime;

  // Update terrain offset and generate obstacles.
  runnerState.terrainOffset += moveDist;
  while (runnerState.terrainOffset >= runnerState.nextObstacleDistance) {
    runnerState.terrainOffset -= runnerState.nextObstacleDistance;
    runnerState.nextObstacleDistance = 6;
    generateObstacle();
  }

  // Update obstacles.
  runnerState.obstacles.forEach(ob => {
    if (ob.type === "bird") {
      ob.x = ob.x - moveDist + ob.vx * deltaTime;
      if (ob.vy !== undefined) {
        ob.y += ob.vy * deltaTime;
      }
      if (ob.phase === "swooping" && ob.x <= ob.destX) {
        ob.phase = "horizontal";
        ob.x = ob.destX;
        ob.y = ob.destY;
        ob.vx = -2;
        ob.vy = 0;
      }
    } else {
      ob.x -= moveDist;
      if (ob.vy !== undefined) {
        ob.y += ob.vy * deltaTime;
      }
    }
  });

  runnerState.obstacles = runnerState.obstacles.filter(ob => ob.x + (ob.width || 1) > -2);

  // Update ground.
  runnerState.groundOffset += moveDist;
  while (runnerState.groundOffset >= 1) {
    runnerState.groundOffset -= 1;
    runnerState.groundProfile.shift();
    let newColumn;
    if (runnerState.pendingPitColumns > 0) {
      // If bridges mechanic is active, generate a bridge column;
      // otherwise, generate a pit column (0 height).
      if (runnerState.mechanics.bridges) {
        newColumn = -runnerState.resumeGround;
      } else {
        newColumn = 0;
      }
      runnerState.pendingPitColumns--;
      if (runnerState.pendingPitColumns === 0 && runnerState.resumeGround !== undefined) {
        newColumn = runnerState.resumeGround;
        runnerState.resumeGround = undefined;
      }
    } else if (runnerState.pendingElevationChange !== 0) {
      let last = runnerState.groundProfile[runnerState.groundProfile.length - 1];
      last = Math.max(2, Math.min(10, last + runnerState.pendingElevationChange));
      runnerState.pendingElevationChange = 0;
      newColumn = last;
    } else {
      let last = runnerState.groundProfile[runnerState.groundProfile.length - 1];
      newColumn = last;
    }
    arcadeState.currentScore += 10;
    runnerState.groundProfile.push(newColumn);
  }

  // Apply gravity and update vertical position.
  runnerState.player.vy -= GRAVITY * deltaTime;
  runnerState.player.y -= runnerState.player.vy * deltaTime;

  checkCollisions();

  const player = runnerState.player;

  // --- Horizontal Collision ---
  // Check right-side using a point at (player.x + 1, player.y + 0.5).
  const hrX = player.x + 1, hrY = player.y + 0.5;
  const colIndex = Math.floor(runnerState.groundOffset + hrX);
  let groundHeight = runnerState.groundProfile[colIndex] || 0;
  const effGround = groundHeight < 0 ? -groundHeight : groundHeight;
  const groundTop = arcadeState.baseRows - effGround;
  if (groundHeight !== 0) {
    if (hrY >= groundTop) {
      player.x = (colIndex - runnerState.groundOffset) - 1;
    }
  }

  // --- Vertical (Floor) Collision ---
  // Compute two bottom points, each inset by 0.1 units.
  const bottomLeftX = player.x + 0.1, bottomLeftY = player.y + 1;
  const bottomRightX = player.x + 0.9, bottomRightY = player.y + 1;
  const colIndexLeft = Math.floor(runnerState.groundOffset + bottomLeftX);
  const colIndexRight = Math.floor(runnerState.groundOffset + bottomRightX - 0.001);
  let ghLeft = runnerState.groundProfile[colIndexLeft] || 0;
  let ghRight = runnerState.groundProfile[colIndexRight] || 0;
  const effGhLeft = ghLeft < 0 ? -ghLeft : ghLeft;
  const effGhRight = ghRight < 0 ? -ghRight : ghRight;
  const groundTopLeft = arcadeState.baseRows - effGhLeft;
  const groundTopRight = arcadeState.baseRows - effGhRight;

  // If either bottom point is supported, snap vertically.
  const standingLeft = (bottomLeftY >= groundTopLeft);
  const standingRight = (bottomRightY >= groundTopRight);
  if (standingLeft || standingRight) {
    let chosenGround = standingLeft && standingRight ? Math.max(groundTopLeft, groundTopRight)
      : (standingLeft ? groundTopLeft : groundTopRight);
    player.y = chosenGround - 1;
    player.vy = 0;
    player.jumpCount = 0;
  }

  // --- Horizontal Recovery ---
  if (player.x < 1) {
    player.x = Math.min(1, player.x + 0.2 * deltaTime);
  }

  // Check if the player has left the playable area.
  if (player.x <= 0 ||
    player.x + 1 >= arcadeState.baseCols ||
    player.y + 1 >= arcadeState.baseRows) {
    runnerState.player.state = "hit";
    gameOver(() => { initRunner(); });
    return;
  }

  if (arcadeState.scoreElement) {
    arcadeState.scoreElement.innerText = "Score: " + arcadeState.currentScore;
  }

  runnerState.prevPlayerGround = Math.max(effGhLeft, effGhRight);

  // Update player's animation state based on vertical velocity (if not already in "hit" state).
  if (!arcadeState.isGameOver && player.state !== "hit") {
    if (player.vy > 0) {
      player.state = "jump";
    } else if (player.vy < 0) {
      player.state = "fall";
    } else {
      player.state = "run";
    }
  }
}

// Function to update player animation frame.
function updatePlayerAnimation(deltaTime) {
  const player = runnerState.player;
  const animFrames = arcadeState.images.player[player.state];
  if (!animFrames || animFrames.length === 0) return;

  // If there's only one frame, no oscillation is needed.
  if (animFrames.length === 1) {
    player.frameIndex = 0;
    return;
  }

  // For states with multiple frames (oscillating animation)
  player.frameTimer += deltaTime * 1000; // Convert seconds to milliseconds
  if (player.frameTimer >= player.frameDuration) {
    // Reverse direction if we hit the end or beginning.
    if (player.frameIndex === animFrames.length - 1) {
      player.frameDirection = -1;
    } else if (player.frameIndex === 0) {
      player.frameDirection = 1;
    }

    player.frameIndex += player.frameDirection;
    player.frameTimer = 0;
  }
}


function renderRunner() {
  const ctx = arcadeState.ctx;
  const cellW = arcadeState.canvas.width / arcadeState.baseCols;
  const cellH = arcadeState.canvas.height / arcadeState.baseRows;
  ctx.clearRect(0, 0, arcadeState.canvas.width, arcadeState.canvas.height);

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, arcadeState.canvas.width, arcadeState.canvas.height);

  // Draw ground columns.
  for (let i = 0; i < runnerState.groundProfile.length; i++) {
    const colX = (i - runnerState.groundOffset) * cellW;
    let gHeight = runnerState.groundProfile[i];
    let groundTop;
    if (gHeight < 0) {
      groundTop = arcadeState.baseRows - (-gHeight);
      gHeight = 1;
      ctx.fillStyle = "#C68642";
    } else {
      groundTop = arcadeState.baseRows - gHeight;
      ctx.fillStyle = "#654321";
    }
    ctx.fillRect(colX, groundTop * cellH, cellW, gHeight * cellH);
  }

  runnerState.obstacles.forEach(ob => {
    const colX = ob.x * cellW;
    const colY = ob.y * cellH;
    const width = (ob.width || 1) * cellW;
    const height = (ob.height || 1) * cellH;

    switch (ob.type) {
      case "pit":
        ctx.clearRect(colX, 0, width, arcadeState.canvas.height);
        break;
      case "bridge": {
        const lastGround = runnerState.groundProfile[runnerState.groundProfile.length - 1] || 5;
        const groundTop = arcadeState.baseRows - lastGround;
        ctx.fillStyle = "#A0522D";
        ctx.fillRect(colX, groundTop * cellH, width, lastGround * cellH);
        break;
      }
      case "groundObstacle":
        ctx.drawImage(arcadeState.images.spike1, colX - width / 2, colY + height - height * 2, width * 2, height * 2);
        break;
      case "airObstacle":
        ctx.drawImage(arcadeState.images.spike2, colX - width / 2, colY + height - height * 2, width * 2, height * 2);
        break;
      case "bird":
        ctx.drawImage(arcadeState.images.spike3, colX - width / 2, colY + height - height * 2, width * 2, height * 2);
        break;
      case "coin":
        ctx.drawImage(arcadeState.images.coin, colX, colY, width, height);
        break;
      default:
        break;
    }
  });

  // Draw the player using the appropriate animation frame.
  const p = runnerState.player;
  const animFrames = arcadeState.images.player[p.state];
  if (animFrames && animFrames.length > 0) {
    const currentFrame = animFrames[p.frameIndex];
    ctx.drawImage(currentFrame, p.x * cellW, p.y * cellH, cellW, cellH);
  } else {
    ctx.fillStyle = "lime";
    ctx.fillRect(p.x * cellW, p.y * cellH, cellW, cellH);
  }
}

function gameLoopRunner(timestamp) {
  if (arcadeState.isGameOver) return;
  const deltaTime = (timestamp - arcadeState.previousTimestamp) / 1000;
  arcadeState.previousTimestamp = timestamp;
  updateRunner(deltaTime);
  updatePlayerAnimation(deltaTime);
  renderRunner();
  arcadeState.animationFrameId = requestAnimationFrame(gameLoopRunner);
}

function listenToRunnerMechanics() {
  const ref = arcadeState.db.ref("mechanics/runner");
  ref.off();
  ref.on("value", snap => {
    const val = snap.val() || {};
    runnerState.mechanics = {
      doubleJump: !!val.doubleJump,
      bridges: !!val.bridges,
      coins: !!val.coins,
    };
  });
}

function startRunner() {
  showTitleScreen("Data & Insights Runner!", () => {
    hideTitleScreen();
    initRunner();
  });
}

export { startRunner };
