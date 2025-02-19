// runner.js
// ES Module for Runner game (endless runner similar to Chrome Dino)
// Assumes arcadeCore.js provides globals: arcadeState, showTitleScreen, hideTitleScreen, gameOver, etc.
// Also assumes Firebase is initialized in arcadeCore.js.

const GRAVITY = 20; // arcade units/sec²
const BASE_JUMP_HEIGHT = 1.5; // desired jump height (arcade units)
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
  const playerBox = {
    x: runnerState.player.x,
    y: runnerState.player.y,
    width: 1,
    height: 1,
  };

  for (let ob of runnerState.obstacles) {
    if (ob.type === "groundObstacle" || ob.type === "airObstacle") {
      if (checkAABBCollision(playerBox, { x: ob.x, y: ob.y, width: ob.width, height: ob.height })) {
        gameOver(() => { initRunner(); });
        return;
      }
    } else if (ob.type === "bird") {
      if (checkAABBCollision(playerBox, { x: ob.x, y: ob.y, width: ob.width, height: ob.height })) {
        gameOver(() => { initRunner(); });
        return;
      }
    } else if (ob.type === "coin") {
      if (checkAABBCollision(playerBox, { x: ob.x, y: ob.y, width: ob.width, height: ob.height })) {
        arcadeState.currentScore += 500;
        ob.collected = true;
      }
    }
  }
  runnerState.obstacles = runnerState.obstacles.filter(ob => !(ob.type === "coin" && ob.collected));
}

function initRunner() {
  arcadeState.isGameOver = false;
  
  runnerState = {
    player: {
      x: 1,         // Fixed horizontal position (the player remains in column 1)
      y: 0,         // Will be set based on ground
      vy: 0,
      jumpCount: 0,
    },
    // Ground system: fixed array of exactly 10 columns (9 on-screen + 1 off-screen to the right)
    groundProfile: [],
    groundOffset: 0,  // Horizontal offset (in arcade units) of the leftmost column
    pendingElevationChange: 0,   // To be applied to the next new column (for elevation changes)
    pendingPitColumns: 0,        // Number of new columns that should be pits (ground = 0)
    resumeGround: undefined,     // Stored ground level before a pit, so ground resumes at that level
    obstacles: [],
    terrainOffset: 0,            // For obstacle spacing
    nextObstacleDistance: randomRange(4, 6),
    terrainSpeed: 3,             // Base scrolling speed (arcade units/sec)
    speedMultiplier: 1,
    speedIncreaseTimer: 0,
    isCorrecting: false,         // For side collision correction
    mechanics: {
      doubleJump: false,
      bridges: false,
      coins: false,
    },
    prevPlayerGround: undefined, // Effective ground from previous update
  };

  // Initialize groundProfile with 10 columns.
  const cols = 10;
  for (let i = 0; i < cols; i++) {
    runnerState.groundProfile.push(5);
  }
  runnerState.groundOffset = 0;
  runnerState.pendingElevationChange = 0;
  runnerState.pendingPitColumns = 0;
  runnerState.resumeGround = undefined;

  // Set player's starting vertical position based on column 1.
  let currentGround = runnerState.groundProfile[1];
  let groundTop = arcadeState.baseRows - currentGround;
  runnerState.player.y = groundTop - 1;
  runnerState.player.vy = 0;
  runnerState.player.jumpCount = 0;
  runnerState.prevPlayerGround = currentGround;

  arcadeState.currentScore = 0;

  // Use mousedown/touchstart for immediate jump triggering.
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
  // Check if the player's full hitbox (from x to x+1) is over a pit.
  const leftEdge = runnerState.player.x;
  const rightEdge = runnerState.player.x + 1;
  const fullyOverPit = runnerState.obstacles.some(ob =>
    ob.type === "pit" && (leftEdge >= ob.x && rightEdge <= (ob.x + ob.width))
  );
  // Allowed jumps: if fully over a pit, allow jump only if doubleJump is enabled.
  const allowedJumps = fullyOverPit ? (runnerState.mechanics.doubleJump ? 1 : 0)
                                    : (runnerState.mechanics.doubleJump ? 2 : 1);
  if (runnerState.player.jumpCount < allowedJumps) {
    console.log("Jump triggered. Jump count:", runnerState.player.jumpCount + 1);
    runnerState.player.vy = BASE_JUMP_VELOCITY * runnerState.speedMultiplier;
    runnerState.player.jumpCount++;
  }
}

function generateObstacle() {
  let types = ["pit", "groundObstacle", "airObstacle", "bird", "elevation"];
  if (runnerState.mechanics.coins) {
    types.push("coin");
  }
  let type = types[Math.floor(Math.random() * types.length)];
  let spawnX = arcadeState.baseCols + randomRange(0, 1);
  
  // For pits: Instead of overriding columns immediately, set pendingPitColumns to 2.
  if (type === "pit") {
    if (runnerState.resumeGround === undefined) {
      runnerState.resumeGround = runnerState.groundProfile[runnerState.groundProfile.length - 1];
      console.log("Pit selected. Storing resumeGround =", runnerState.resumeGround);
    }
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
        if (runnerState.resumeGround === undefined) {
          runnerState.resumeGround = runnerState.groundProfile[runnerState.groundProfile.length - 1];
        }
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
  runnerState.speedIncreaseTimer += deltaTime;
  if (runnerState.speedIncreaseTimer >= 5) {
    runnerState.speedMultiplier *= 1.1;
    runnerState.speedIncreaseTimer -= 5;
    console.log("Speed increased; multiplier =", runnerState.speedMultiplier.toFixed(2));
  }
  
  const moveDist = runnerState.terrainSpeed * runnerState.speedMultiplier * deltaTime;
  
  runnerState.terrainOffset += moveDist;
  while (runnerState.terrainOffset >= runnerState.nextObstacleDistance) {
    runnerState.terrainOffset -= runnerState.nextObstacleDistance;
    runnerState.nextObstacleDistance = randomRange(4, 6);
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
  
  runnerState.obstacles.forEach(ob => {
    if (!ob.awarded && ob.x + (ob.width || 1) < 1) {
      arcadeState.currentScore += 50;
      ob.awarded = true;
    }
  });
  runnerState.obstacles = runnerState.obstacles.filter(ob => ob.x + (ob.width || 1) > -2);
  
  // Update ground.
  runnerState.groundOffset += moveDist;
  while (runnerState.groundOffset >= 1) {
    runnerState.groundOffset -= 1;
    // Remove the leftmost column.
    const removed = runnerState.groundProfile.shift();
    console.log("Removed ground column:", removed);
    let newColumn;
    if (runnerState.pendingPitColumns > 0) {
      newColumn = 0;
      runnerState.pendingPitColumns--;
      console.log("Generated pit column: 0");
      // Once the pending pit columns have been used, resume ground at resumeGround if defined.
      
      if (runnerState.pendingPitColumns === 0 && runnerState.resumeGround !== undefined) {
        newColumn = runnerState.resumeGround;
        console.log("Resuming ground level at:", newColumn);
        runnerState.resumeGround = undefined;
      }
    } else {
      let last = runnerState.groundProfile[runnerState.groundProfile.length - 1];
      if (runnerState.pendingElevationChange !== 0) {
        last = Math.max(2, Math.min(10, last + runnerState.pendingElevationChange));
        runnerState.pendingElevationChange = 0;
      }
      newColumn = last;
      console.log("Generated ground column:", newColumn);
    }
    runnerState.groundProfile.push(newColumn);
  }
  
  // Apply constant gravity.
  runnerState.player.vy -= GRAVITY * deltaTime * runnerState.speedMultiplier;
  runnerState.player.y -= runnerState.player.vy * deltaTime;
  
  // Determine effective ground beneath player by checking both bottom corners.
  const leftBottom = runnerState.player.x;
  const rightBottom = runnerState.player.x + 1;
  const bottomY = runnerState.player.y + 1;
  const colLeft = Math.floor(runnerState.groundOffset + leftBottom);
  const colRight = Math.floor(runnerState.groundOffset + rightBottom - 0.001);
  const groundLeft = runnerState.groundProfile[colLeft] || 0;
  const groundRight = runnerState.groundProfile[colRight] || 0;
  const groundTopLeft = arcadeState.baseRows - groundLeft;
  const groundTopRight = arcadeState.baseRows - groundRight;
  const standing = (bottomY >= groundTopLeft) && (bottomY >= groundTopRight);
  
  if (standing) {
    runnerState.player.vy = 0;
    let newY = Math.min(groundTopLeft, groundTopRight) - 1;
    runnerState.player.y = newY;
    runnerState.player.jumpCount = 0;
  }
  
  // Check if player's hitbox touches any screen edge; if so, game over.
  if (runnerState.player.x <= 0 ||
      runnerState.player.x + 1 >= arcadeState.baseCols ||
      runnerState.player.y <= 0 ||
      runnerState.player.y + 1 >= arcadeState.baseRows) {
    gameOver(() => { initRunner(); });
    return;
  }
  
  // If no ground exists (over pit) and player falls below screen, game over.
  if (groundLeft === 0 && groundRight === 0 && runnerState.player.y > arcadeState.baseRows - 1) {
    gameOver(() => { initRunner(); });
    return;
  }
  
  checkCollisions();
  
  if (runnerState.isCorrecting) {
    runnerState.player.x += 0.2 * deltaTime;
    if (runnerState.player.x >= 2) {
      runnerState.player.x = 2;
      runnerState.isCorrecting = false;
    }
    if (runnerState.player.x < 0) {
      gameOver(() => { initRunner(); });
      return;
    }
  }
  
  if (arcadeState.scoreElement) {
    arcadeState.scoreElement.innerText = "Score: " + arcadeState.currentScore;
  }
  
  runnerState.prevPlayerGround = Math.max(groundLeft, groundRight);
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
    const gHeight = runnerState.groundProfile[i];
    const groundTop = arcadeState.baseRows - gHeight;
    ctx.fillStyle = "#654321";
    ctx.fillRect(colX, groundTop * cellH, cellW, gHeight * cellH);
  }
  // Draw pits.
  runnerState.obstacles.forEach(ob => {
    if (ob.type === "pit") {
      const colX = ob.x * cellW;
      ctx.clearRect(colX, 0, ob.width * cellW, arcadeState.canvas.height);
    }
  });
  // Draw bridges.
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
      if (ob.type === "bird") {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ob.spawnX * cellW, ob.spawnY * cellH);
        ctx.lineTo(ob.destX * cellW, ob.destY * cellH);
        ctx.stroke();
      }
    }
  });
  // Draw player.
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
