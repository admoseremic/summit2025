/***********************************************************
 * frogger.js
 * 
 * A simple infinite scrolling Frogger clone.
 * 
 * World Coordinates:
 *   - World y = 0 is at the bottom.
 *   - World y increases upward.
 * The frog starts near the bottom (y = 2) and hops upward 
 * (increasing its y by 1 per hop). The camera auto-scrolls 
 * upward (increasing cameraY) so that new terrain is generated above.
 * 
 * Terrain Generation:
 *   - The first 8 rows (indices 0–7) are empty.
 *   - Then a cycle is generated with four phases:
 *         • "road": L road rows,
 *         • "emptyAfterRoad": 1 empty row,
 *         • "river": L river rows,
 *         • "emptyAfterRiver": 1 empty row.
 *     L starts at 1 and increases by 1 after each full cycle.
 * 
 * Obstacles:
 *   - In each road row, a truck (1×2) is generated and moves horizontally,
 *     wrapping around. Trucks use a collider of 0.9 units tall (centered).
 *   - In each river row, a log is generated:
 *         • normally 1×2 (with snap points computed per grid cell),
 *         • or 1×4 if longerLogs is toggled.
 *     Logs move horizontally and wrap around.
 * 
 * Log-Snapping:
 *   - When the frog lands in a river row (animationState === "sitting"),
 *     maybeSnapFrogToLog() is called.
 *   - If the frog’s targetY is higher than its current y, snapping is skipped.
 *   - Otherwise, the function finds the closest snap point (if within 0.5 units)
 *     and sets frog.snappedLog and frog.snapOffset accordingly, forcing frog.x to equal log.x + snapOffset.
 *   - Once snapped, while the frog is landed and frog.targetY equals frog.y,
 *     every frame the frog’s x is updated to follow the log’s movement.
 *   - New input clears any existing snap.
 * 
 * When leaving a river row:
 *   - If landing on a non-river row, frog.x is rounded to the nearest integer.
 * 
 * Collisions & Scoring:
 *   - Truck collisions (using a 0.9‑unit tall collider) and falling off the screen cause a loss.
 *   - The frog is awarded 20 points for each new maximum y reached.
 * 
 * Camera Modes:
 *   - Auto-scroll: cameraY increases at autoScrollSpeed (initially 1 unit/sec, increasing 10% every 6 sec).
 *   - Vertical centering: if enabled, cameraY lerps to keep the frog centered plus an offset.
 * 
 * Host Mechanics (from Firebase mechanics/frogger):
 *   - longerLogs (boolean): if true, logs are 1×4.
 *   - slowCars (boolean): if true, trucks move at half speed.
 *   - verticalCenterMode (boolean): if true, disable auto-scroll and lerp the camera to keep the frog centered.
 *   - verticalCenterOffset (number): vertical offset (in arcade units) for centering.
 * 
 * Globals:
 *   Assumes arcadeCore.js provides a global object "arcadeState" with:
 *     arcadeState.canvas, arcadeState.ctx, arcadeState.baseCols, arcadeState.baseRows,
 *     arcadeState.isGameOver, arcadeState.currentScore, arcadeState.animationFrameId,
 *     arcadeState.db, and arcadeState.previousTimestamp.
 *   Also assumes common functions: showTitleScreen(), hideTitleScreen(), and gameOver(restartCallback).
 ***********************************************************/

// --------------------
// Module-Scoped Variables
// --------------------
let frog = {
  x: 4,
  y: 2,
  targetX: 4,
  targetY: 2,
  facing: "north",
  animationState: "sitting",
  snappedLog: null,    // Reference to the log the frog is attached to (if any)
  snapOffset: null,     // The offset from the log's left edge
  queuedJump: false,    // Indicates if an upward jump is queued
  edgeCorrected: false  // Flag to ensure a single lateral jump on edge collision
};

let cameraY = 0;
let autoScrollSpeed = 1;
let autoScrollTimer = 0;
let verticalCenterMode = false;
let verticalCenterOffset = 2;

let terrainRows = [];
let highestRowGenerated = 7;  // rows 0-7 are empty
let currentPatternLevel = 1;
// Cycle phases: "road", "emptyAfterRoad", "river", "emptyAfterRiver"
let patternPhase = "road";
let patternRowsLeft = currentPatternLevel;

let trucks = [];
let logs = [];

let frogLerpSpeed = 6;

let longerLogs = false;
let slowCars = false;

let maxRowReached = frog.y;

// Global toggle for alternating obstacle direction:
let lastDirection = 1; // starts at 1

// --------------------
// Helper: Compute Log Snap Points
// --------------------
function computeLogSnapPoints(log) {
  let snapPoints = [];
  let numPoints = Math.floor(log.width);
  for (let i = 0; i < numPoints; i++) {
    snapPoints.push(log.x + i);
  }
  return snapPoints;
}

// --------------------
// Terrain Generation
// --------------------
function generateNextTerrainPhase() {
  let visibleRows = arcadeState.baseRows;
  while (highestRowGenerated < cameraY + visibleRows) {
    let newRow = { index: highestRowGenerated + 1 };
    if (patternPhase === "road") {
      newRow.type = "road";
      newRow.direction = -lastDirection;
      lastDirection = newRow.direction;
      patternRowsLeft--;
      if (patternRowsLeft <= 0) {
        patternPhase = "emptyAfterRoad";
        patternRowsLeft = 1;
      }
    } else if (patternPhase === "emptyAfterRoad") {
      newRow.type = "empty";
      patternRowsLeft--;
      if (patternRowsLeft <= 0) {
        patternPhase = "river";
        patternRowsLeft = currentPatternLevel;
      }
    } else if (patternPhase === "river") {
      newRow.type = "river";
      newRow.direction = -lastDirection;
      lastDirection = newRow.direction;
      patternRowsLeft--;
      if (patternRowsLeft <= 0) {
        patternPhase = "emptyAfterRiver";
        patternRowsLeft = 1;
      }
    } else if (patternPhase === "emptyAfterRiver") {
      newRow.type = "empty";
      patternRowsLeft--;
      if (patternRowsLeft <= 0) {
        currentPatternLevel++;
        patternPhase = "road";
        patternRowsLeft = currentPatternLevel;
      }
    }
    terrainRows.push(newRow);
    highestRowGenerated = newRow.index;
  }

  terrainRows.forEach(row => {
    if (!row.obstacleAssigned) {
      if (row.type === "road") {
        row.truck = createTruckForRow(row.index, row.direction);
        trucks.push(row.truck);
        row.obstacleAssigned = true;
      } else if (row.type === "river") {
        row.log = createLogForRow(row.index, row.direction);
        row.log.snapPoints = computeLogSnapPoints(row.log);
        logs.push(row.log);
        row.obstacleAssigned = true;
      }
    }
  });

  terrainRows = terrainRows.filter(row => row.index >= cameraY - 5);
}

// --------------------
// Truck and Log Creation
// --------------------
function createTruckForRow(rowIndex, direction) {
  let truck = {
    row: rowIndex,
    x: Math.random() * (arcadeState.baseCols - 2),
    width: 2,
    speed: slowCars ? 0.5 : 2,
    direction: direction
  };
  return truck;
}

function createLogForRow(rowIndex, direction) {
  let logWidth = longerLogs ? 4 : 2;
  let log = {
    row: rowIndex,
    x: Math.random() * (arcadeState.baseCols - logWidth),
    width: logWidth,
    speed: 1.5, // Base speed; will be scaled by autoScrollSpeed.
    direction: direction
  };
  return log;
}

// --------------------
// Entry Point: Start Frogger
// --------------------
function startFrogger() {
  showTitleScreen('CJA Leapfrogger!', () => {
    hideTitleScreen();
    initFrogger();
  });
}

// --------------------
// Initialization
// --------------------
function initFrogger() {
  arcadeState.isGameOver = false;
  arcadeState.currentScore = 0;

  frog.x = 4;
  frog.y = 6;
  frog.targetX = 4;
  frog.targetY = 6;
  frog.facing = "north";
  frog.animationState = "sitting";
  frog.snappedLog = null;
  frog.snapOffset = null;
  frog.queuedJump = false;
  frog.edgeCorrected = false;

  cameraY = 0;
  maxRowReached = frog.y;

  autoScrollSpeed = 1;
  autoScrollTimer = 0;

  terrainRows = [];
  for (let r = 0; r < 8; r++) {
    terrainRows.push({ index: r, type: "empty" });
  }
  highestRowGenerated = 7;

  currentPatternLevel = 1;
  patternPhase = "road";
  patternRowsLeft = currentPatternLevel;
  lastDirection = 1;
  generateNextTerrainPhase();

  trucks = [];
  logs = [];
  terrainRows.forEach(row => {
    if (row.type === "road") {
      if (!row.truck) {
        row.truck = createTruckForRow(row.index, row.direction);
      }
      trucks.push(row.truck);
    } else if (row.type === "river") {
      if (!row.log) {
        row.log = createLogForRow(row.index, row.direction);
        row.log.snapPoints = computeLogSnapPoints(row.log);
      }
      logs.push(row.log);
    }
  });

  arcadeState.canvas.addEventListener('click', handleFroggerInput);
  arcadeState.canvas.addEventListener('touchstart', handleFroggerInput, { passive: false });

  listenToFroggerMechanics();

  arcadeState.previousTimestamp = performance.now();
  arcadeState.animationFrameId = requestAnimationFrame(gameLoopFrogger);
  arcadeState.scoreElement.innerText = 'Score: ' + arcadeState.currentScore;
}

// --------------------
// Game Loop
// --------------------
function gameLoopFrogger(timestamp) {
  if (arcadeState.isGameOver) return;
  let deltaTime = (timestamp - arcadeState.previousTimestamp) / 1000;
  arcadeState.previousTimestamp = timestamp;

  updateFrogger(deltaTime);
  renderFrogger();

  arcadeState.animationFrameId = requestAnimationFrame(gameLoopFrogger);
}

// --------------------
// Update Logic
// --------------------
function updateFrogger(deltaTime) {
  // --- Process Queued Jump if Landed ---
  if (frog.animationState === "sitting" && frog.queuedJump) {
    frog.snappedLog = null;
    frog.snapOffset = null;
    frog.targetY = frog.y + 1;
    frog.animationState = "jumping";
    frog.queuedJump = false;
    console.log("Processing queued jump: new targetY =", frog.targetY);
  }

  // --- Frog Movement with Independent X/Y Lerp ---
  let dx = frog.targetX - frog.x;
  let dy = frog.targetY - frog.y;
  let dist = Math.sqrt(dx * dx + dy * dy);

  // Define separate thresholds for snapping x and y
  const horizontalThreshold = 0.1;
  const verticalThreshold = 0.1;

  // Compute a step based on lerp speed.
  let step = frogLerpSpeed * deltaTime;

  if (dist > 0.001) {
    // Calculate the next positions using full interpolation.
    let nextX = frog.x + (dx / dist) * step;
    let nextY = frog.y + (dy / dist) * step;

    // Snap vertical position if close enough.
    if (Math.abs(dy) < verticalThreshold) {
      nextY = Math.round(frog.targetY);
    }
    // Snap horizontal position if close enough.
    if (Math.abs(dx) < horizontalThreshold) {
      nextX = frog.targetX;
    }

    frog.x = nextX;
    frog.y = nextY;

    // Check if both coordinates are within thresholds.
    if (Math.abs(frog.x - frog.targetX) < horizontalThreshold &&
      Math.abs(frog.y - frog.targetY) < verticalThreshold) {
      // Finalize landing.
      frog.x = frog.targetX;
      frog.y = Math.round(frog.targetY)
      frog.targetY = frog.y; // ensure y aligns to a grid row
      frog.animationState = "sitting";
      let currentRow = terrainRows.find(row => row.index === Math.floor(frog.y));
      if (currentRow && currentRow.type !== "river") {
        // For non-river rows, round x to ensure collision checks align.
        frog.x = Math.round(frog.x);
        frog.targetX = frog.x;
      } else {
        // For river rows, attempt to snap the frog to the nearest log.
        maybeSnapFrogToLog();
      }
    } else {
      frog.animationState = "jumping";
      frog.snappedLog = null;
      frog.snapOffset = null;
    }
  } else if (frog.animationState === "sitting" && frog.snappedLog && frog.targetY === frog.y) {
    // If frog is snapped to a log, follow its movement.
    frog.x = frog.snappedLog.x + frog.snapOffset;
    frog.targetX = frog.x;
  }

  // --- Camera Update ---
  if (verticalCenterMode) {
    let targetCameraY = frog.y - (arcadeState.baseRows / 2 - verticalCenterOffset);
    cameraY += (targetCameraY - cameraY) * 0.5;
  } else {
    cameraY += autoScrollSpeed * deltaTime;
    autoScrollTimer += deltaTime;
    if (autoScrollTimer >= 6) {
      autoScrollSpeed *= 1.1;
      autoScrollTimer -= 6;
    }
  }

  // --- Terrain Generation ---
  let visibleRows = arcadeState.baseRows;
  if (highestRowGenerated < cameraY + visibleRows) {
    generateNextTerrainPhase();
  }

  // Update trucks and logs with any mechanic changes.
  trucks.forEach(truck => {
    truck.speed = slowCars ? 0.5 : 3;
  });
  logs.forEach(log => {
    log.width = longerLogs ? 4 : 2;
    log.snapPoints = computeLogSnapPoints(log);
  });

  // --- Update Trucks and Logs Positions ---
  trucks.forEach(truck => {
    truck.x += truck.speed * truck.direction * deltaTime;
    if (truck.x > arcadeState.baseCols) {
      truck.x = -truck.width;
    } else if (truck.x + truck.width < 0) {
      truck.x = arcadeState.baseCols;
    }
  });
  logs.forEach(log => {
    let effectiveSpeed = log.speed * autoScrollSpeed;
    log.x += effectiveSpeed * log.direction * deltaTime;
    if (log.x > arcadeState.baseCols) {
      log.x = -log.width;
    } else if (log.x + log.width < 0) {
      log.x = arcadeState.baseCols;
    }
    log.snapPoints = computeLogSnapPoints(log);
  });

  // --- River and Collision Checks ---
  let frogRow = Math.floor(frog.y);
  let currentRow = terrainRows.find(row => row.index === frogRow && row.type === "river");
  if (currentRow) {
    let log = currentRow.log;
    if (!log) {
      arcadeState.isGameOver = true;
    }
  }

  // --- Scoring ---
  let currentScoreRow = Math.floor(frog.y);
  if (currentScoreRow > maxRowReached) {
    maxRowReached = currentScoreRow;
    arcadeState.currentScore += 100;
    arcadeState.scoreElement.innerText = 'Score: ' + arcadeState.currentScore;
  }


  // Truck collision detection.
  let frogCenterY = frog.y + 0.5;
  let frogGridY = Math.floor(frog.y);
  let roadRow = terrainRows.find(row => row.index === frogGridY && row.type === "road");
  if (roadRow && roadRow.truck) {
    let truck = roadRow.truck;
    let truckRowCenter = roadRow.index + 0.5;
    let colliderHalfHeight = 0.45;
    if (frogCenterY >= truckRowCenter - colliderHalfHeight &&
      frogCenterY <= truckRowCenter + colliderHalfHeight) {
      if (frog.x < truck.x + truck.width && frog.x + 1 > truck.x) {
        arcadeState.isGameOver = true;
      }
    }
  }

  if (frog.y < cameraY - 1) {
    arcadeState.isGameOver = true;
  }

  if (arcadeState.isGameOver) {
    gameOver(() => { initFrogger(); });
  }
}

// --------------------
// Snap Frog to Log Function
// --------------------
function maybeSnapFrogToLog() {
  if (frog.targetY > frog.y) {
    frog.snappedLog = null;
    frog.snapOffset = null;
    return;
  }

  let frogRow = Math.floor(frog.y);
  let currentRow = terrainRows.find(row => row.index === frogRow && row.type === "river");
  if (!currentRow || !currentRow.log) {
    frog.snappedLog = null;
    frog.snapOffset = null;
    return;
  }

  let log = currentRow.log;
  if (!log.snapPoints) {
    log.snapPoints = computeLogSnapPoints(log);
  }

  let closest = null;
  let closestDist = Infinity;
  for (let sp of log.snapPoints) {
    let d = Math.abs(frog.x - sp);
    if (d < closestDist) {
      closestDist = d;
      closest = sp;
    }
  }

  if (closest !== null && closestDist < 0.5) {
    frog.snappedLog = log;
    frog.snapOffset = closest - log.x;
    frog.x = log.x + frog.snapOffset;
    frog.targetX = frog.x;
  } else {
    frog.snappedLog = null;
    frog.snapOffset = null;
    arcadeState.isGameOver = true;
  }
}

// --------------------
// Render Function
// --------------------
function renderFrogger() {
  let cellW = arcadeState.canvas.width / arcadeState.baseCols;
  let cellH = arcadeState.canvas.height / arcadeState.baseRows;

  arcadeState.ctx.clearRect(0, 0, arcadeState.canvas.width, arcadeState.canvas.height);

  terrainRows.forEach(row => {
    let yPixel = arcadeState.canvas.height - ((row.index - cameraY) * cellH);
    //if (yPixel + cellH < 0 || yPixel > arcadeState.canvas.height) return;

    if (row.type === "empty") {
      arcadeState.ctx.fillStyle = "#222";
      arcadeState.ctx.fillRect(0, yPixel - cellH, arcadeState.canvas.width, cellH);
    } else if (row.type === "road") {
      arcadeState.ctx.fillStyle = "#555";
      arcadeState.ctx.fillRect(0, yPixel - cellH, arcadeState.canvas.width, cellH);
      if (row.truck) {
        arcadeState.ctx.drawImage(row.direction === 1 ? arcadeState.images.truck2 : arcadeState.images.truck1, row.truck.x * cellW, yPixel - cellH, row.truck.width * cellW, cellH);
      }
    } else if (row.type === "river") {
      arcadeState.ctx.fillStyle = "#3366FF";
      arcadeState.ctx.fillRect(0, yPixel - cellH, arcadeState.canvas.width, cellH);
      if (row.log) {
        arcadeState.ctx.drawImage(arcadeState.images.skinnyLog,row.log.x * cellW, yPixel - cellH, row.log.width * cellW, cellH);
      }
    }
  });

  let angle = 0;
  switch (frog.facing) {
    case "north":
      angle = 0;
      break;
    case "east":
      angle = 90;
      break;
    case "south":
      angle = 180;
      break;
    case "west":
      angle = 270;
      break;
  }

  drawImage(
    arcadeState.ctx,
    arcadeState.images.frog,
    frog.x * cellW,
    arcadeState.canvas.height - ((frog.y - cameraY) * cellH) - cellH,
    cellW,
    cellH,
    angle
  );
}

function drawImage(ctx, image, x, y, w, h, degrees) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(degrees * Math.PI / 180.0);
  ctx.translate(-x - w / 2, -y - h / 2);
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
}

// --------------------
// Input Handlers
// --------------------
function handleFroggerInput(e) {
  const cellW = arcadeState.canvas.width / arcadeState.baseCols;
  const cellH = arcadeState.canvas.height / arcadeState.baseRows;

  if (arcadeState.isGameOver) return;
  e.preventDefault();

  let clientX, clientY;
  if (e.type === 'click') {
    clientX = e.clientX;
    clientY = e.clientY;
  } else if (e.type === 'touchstart') {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }

  // Convert the client coordinates to canvas coordinates.
  const rect = arcadeState.canvas.getBoundingClientRect();
  const tapX = clientX - rect.left;
  const tapY = clientY - rect.top;

  // Calculate the frog's drawn center position.
  const frogPixelX = frog.x * cellW;
  const frogPixelY = arcadeState.canvas.height - ((frog.y - cameraY) * cellH);
  const frogCenterX = frogPixelX + cellW / 2;
  const frogCenterY = frogPixelY - cellH / 2;

  // Determine movement based on tap location:
  if (tapY < frogCenterY - 0.5 * cellH) {
    // Tap is more than 0.5 cells above the frog: move upward.
    frog.targetY = frog.y + 1;
    frog.facing = "north";
  } else {
    // Otherwise, if the tap is below that horizontal line:
    if (tapX < frogCenterX) {
      frog.targetX = frog.x - 1;
      frog.facing = "west";
    } else if (tapX > frogCenterX) {
      frog.targetX = frog.x + 1;
      frog.facing = "east";
    }
  }

  // Constrain the target positions to within grid boundaries.
  frog.targetX = Math.max(0, Math.min(arcadeState.baseCols - 1, frog.targetX));
  frog.targetY = Math.max(0, frog.targetY);

  arcadeState.playSound(arcadeState.sounds.frogJump);
}

// --------------------
// Listen to Frogger Mechanics from Firebase
// --------------------
function listenToFroggerMechanics() {
  const ref = arcadeState.db.ref('mechanics/frogger');
  ref.off();
  ref.on('value', snap => {
    const val = snap.val() || {};
    longerLogs = !!val.longerLogs;
    slowCars = !!val.slowCars;
    verticalCenterMode = !!val.verticalCenterMode;
    if (typeof val.verticalCenterOffset === 'number') {
      verticalCenterOffset = val.verticalCenterOffset;
    }
    console.log("Frogger mechanics updated:", { longerLogs, slowCars, verticalCenterMode, verticalCenterOffset });
  });
}

export { startFrogger };
