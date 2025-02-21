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
      }
    } else {
      // Any other obstacle causes game over.
      if (checkAABBCollision(playerBox, { x: ob.x, y: ob.y, width: ob.width, height: ob.height })) {
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
    console.log("Jump triggered. Jump count:", p.jumpCount + 1);
    p.vy = BASE_JUMP_VELOCITY;
    p.jumpCount++;
  }
}

function generateObstacle() {
  let types = ["pit", "groundObstacle", "airObstacle", "bird", "elevation"];
  if (runnerState.mechanics.coins) {
    types.push("coin");
  }
  let type = types[Math.floor(Math.random() * types.length)];
  let spawnX = arcadeState.baseCols + randomRange(0, 1);

  // For pits: if bridges mechanic is active, generate a bridge column (only one column).
  if (type === "pit") {
    // Always store the current ground level from the last column.
    runnerState.resumeGround = runnerState.groundProfile[runnerState.groundProfile.length - 1];
    console.log("Pit selected. Storing resumeGround =", runnerState.resumeGround);
    // Set pendingPitColumns to 3 (same as before)
    runnerState.pendingPitColumns = 3;
    console.log("Pit selected. Pending pit columns set to", runnerState.pendingPitColumns);
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
      break;
    case "elevation":
      let change = (Math.random() < 0.5) ? 1 : -1;
      if ((change === 1 && currentGround < 10) || (change === -1 && currentGround > 2)) {
        runnerState.pendingElevationChange = change;
      } else {
        runnerState.resumeGround = runnerState.groundProfile[runnerState.groundProfile.length - 1];
        runnerState.pendingPitColumns = 2;
        console.log("Elevation change not allowed; treating as pit. Pending pit columns set to", runnerState.pendingPitColumns);
        return;
      }
      return;
    case "coin":
      obstacle.width = 1;
      obstacle.height = 1;
      if (Math.random() < 0.5) {
        obstacle.y = arcadeState.baseRows - currentGround - 1;
      } else {
        obstacle.y = arcadeState.baseRows - currentGround - 2;
      }
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
  if (runnerState.speedIncreaseTimer >= 5) {
    runnerState.speedMultiplier *= 1.1;
    runnerState.speedIncreaseTimer -= 5;
    console.log("Speed increased; multiplier =", runnerState.speedMultiplier.toFixed(2));
  }

  const moveDist = runnerState.terrainSpeed * runnerState.speedMultiplier * deltaTime;

  // Update terrain offset and generate obstacles.
  runnerState.terrainOffset += moveDist;
  while (runnerState.terrainOffset >= runnerState.nextObstacleDistance) {
    runnerState.terrainOffset -= runnerState.nextObstacleDistance;
    // Fixed nextObstacleDistance value of 6.
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
    const removed = runnerState.groundProfile.shift();
    console.log("Removed ground column:", removed);
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
      // When pit columns finish, resume ground level.
      if (runnerState.pendingPitColumns === 0 && runnerState.resumeGround !== undefined) {
        newColumn = runnerState.resumeGround;
        console.log("Resuming ground level at:", newColumn);
        runnerState.resumeGround = undefined;
      }
    } else if (runnerState.pendingElevationChange !== 0) {
      let last = runnerState.groundProfile[runnerState.groundProfile.length - 1];
      last = Math.max(2, Math.min(10, last + runnerState.pendingElevationChange));
      runnerState.pendingElevationChange = 0;
      newColumn = last;
      console.log("Generated elevated ground column:", newColumn);
    } else {
      let last = runnerState.groundProfile[runnerState.groundProfile.length - 1];
      newColumn = last;
      console.log("Generated ground column:", newColumn);
    }
    arcadeState.currentScore += 10;
    runnerState.groundProfile.push(newColumn);
  }



  // Apply constant gravity and update vertical position.
  runnerState.player.vy -= GRAVITY * deltaTime;
  runnerState.player.y -= runnerState.player.vy * deltaTime;

  checkCollisions();

  const player = runnerState.player;

  // --- Horizontal Collision ---
  // Check right-side using a point at (player.x + 1, player.y + 0.5).
  const hrX = player.x + 1, hrY = player.y + 0.5;
  const colIndex = Math.floor(runnerState.groundOffset + hrX);
  let groundHeight = runnerState.groundProfile[colIndex] || 0;
  // Use absolute value if this is a bridge column.
  const effGround = groundHeight < 0 ? -groundHeight : groundHeight;
  const groundTop = arcadeState.baseRows - effGround;
  if (groundHeight > 0 || groundHeight < 0) {
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
    let chosenGround;
    if (standingLeft && standingRight) {
      chosenGround = Math.max(groundTopLeft, groundTopRight);
    } else if (standingLeft) {
      chosenGround = groundTopLeft;
    } else {
      chosenGround = groundTopRight;
    }
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
    gameOver(() => { initRunner(); });
    return;
  }

  if (arcadeState.scoreElement) {
    arcadeState.scoreElement.innerText = "Score: " + arcadeState.currentScore;
  }

  runnerState.prevPlayerGround = Math.max(effGhLeft, effGhRight);
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
      // Bridge column: absolute value is the resume ground level.
      groundTop = arcadeState.baseRows - (-gHeight);
      gHeight = 1; // Bridge is 1 unit high.
      ctx.fillStyle = "#C68642"; // Lighter brown for bridges.
    } else {
      groundTop = arcadeState.baseRows - gHeight;
      ctx.fillStyle = "#654321";
    }
    ctx.fillRect(colX, groundTop * cellH, cellW, gHeight * cellH);
  }

  // Draw pits.
  runnerState.obstacles.forEach(ob => {
    if (ob.type === "pit") {
      const colX = ob.x * cellW;
      ctx.clearRect(colX, 0, ob.width * cellW, arcadeState.canvas.height);
    }
  });

  // Draw bridges obstacles (if any exist as obstacles).
  runnerState.obstacles.forEach(ob => {
    if (ob.type === "bridge") {
      const colX = ob.x * cellW;
      const lastGround = runnerState.groundProfile[runnerState.groundProfile.length - 1] || 5;
      const groundTop = arcadeState.baseRows - lastGround;
      ctx.fillStyle = "#A0522D";
      ctx.fillRect(colX, groundTop * cellH, ob.width * cellW, lastGround * cellH);
    }
  });

  // Draw other obstacles.
  runnerState.obstacles.forEach(ob => {
    if (["groundObstacle", "airObstacle", "bird", "coin"].includes(ob.type)) {
      switch (ob.type) {
        case "groundObstacle": ctx.fillStyle = "red"; break;
        case "airObstacle": ctx.fillStyle = "orange"; break;
        case "bird": ctx.fillStyle = "purple"; break;
        case "coin": ctx.fillStyle = "gold"; break;
        default: ctx.fillStyle = "white";
      }
      ctx.fillRect(ob.x * cellW, ob.y * cellH, (ob.width || 1) * cellW, (ob.height || 1) * cellH);
      // Removed bird trajectory debug line.
    }
  });

  // Draw the player.
  ctx.fillStyle = "lime";
  ctx.fillRect(runnerState.player.x * cellW, runnerState.player.y * cellH, cellW, cellH);

  // Score is handled via arcadeCore's scoreboard.
}

function gameLoopRunner(timestamp) {
  if (arcadeState.isGameOver) return;
  const deltaTime = (timestamp - arcadeState.previousTimestamp) / 1000;
  arcadeState.previousTimestamp = timestamp;
  updateRunner(deltaTime);
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
    console.log("Runner mechanics updated:", runnerState.mechanics);
  });
}

function startRunner() {
  showTitleScreen("Runner", () => {
    hideTitleScreen();
    initRunner();
  });
}

export { startRunner };
