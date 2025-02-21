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
// Helper: World Y to Canvas Y Conversion
// --------------------
function worldYToCanvasY(worldY) {
  let cellH = arcadeState.canvas.height / arcadeState.baseRows;
  return arcadeState.canvas.height - ((worldY - cameraY) * cellH);
}

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
// Horizontal Input Processing Function
// --------------------
function processHorizontalInput(dx) {
  let frogRow = Math.floor(frog.y);
  let currentRow = terrainRows.find(row => row.index === frogRow && row.type === "river");
  if (currentRow && currentRow.log && frog.animationState === "sitting" && frog.snappedLog) {
    let snapPts = currentRow.log.snapPoints;
    let currentSnapIndex = snapPts.findIndex(sp => Math.abs((frog.snappedLog.x + frog.snapOffset) - sp) < 0.3);
    if (currentSnapIndex !== -1) {
      if (dx < 0 && currentSnapIndex > 0) {
        frog.targetX = snapPts[currentSnapIndex - 1];
        frog.facing = "west";
      } else if (dx > 0 && currentSnapIndex < snapPts.length - 1) {
        frog.targetX = snapPts[currentSnapIndex + 1];
        frog.facing = "east";
      } else {
        frog.targetX = frog.x;
      }
    } else {
      if (dx < 0) {
        frog.targetX = frog.x - 1;
        frog.facing = "west";
      } else {
        frog.targetX = frog.x + 1;
        frog.facing = "east";
      }
    }
  } else {
    if (dx < 0) {
      frog.targetX = frog.x - 1;
      frog.facing = "west";
    } else {
      frog.targetX = frog.x + 1;
      frog.facing = "east";
    }
  }
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
    speed: slowCars ? 0.5 : 1,
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
    speed: 1, // Base speed; will be scaled by autoScrollSpeed.
    direction: direction
  };
  return log;
}

// --------------------
// Entry Point: Start Frogger
// --------------------
function startFrogger() {
  showTitleScreen('Frogger', () => {
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
  frog.y = 2;
  frog.targetX = 4;
  frog.targetY = 2;
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

  // --- Frog Movement ---
  let dx = frog.targetX - frog.x;
  let dy = frog.targetY - frog.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 0.001) {
    let step = frogLerpSpeed * deltaTime;
    if (step >= dist) {
      frog.x = frog.targetX;
      frog.y = Math.round(frog.targetY); // Round after landing
      frog.animationState = "sitting";
      let currentRow = terrainRows.find(row => row.index === Math.floor(frog.y));
      if (currentRow && currentRow.type !== "river") {
        frog.x = Math.round(frog.x);
        frog.targetX = frog.x;
      } else {
        maybeSnapFrogToLog();
      }
    } else {
      frog.x += (dx / dist) * step;
      frog.y += (dy / dist) * step;
      frog.animationState = "jumping";
      frog.snappedLog = null;
      frog.snapOffset = null;
    }
  } else if (frog.animationState === "sitting" && frog.snappedLog && frog.targetY === frog.y) {
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

  if (frog.y < cameraY) {
    arcadeState.isGameOver = true;
  }

  // --- Terrain Generation ---
  let visibleRows = arcadeState.baseRows;
  if (highestRowGenerated < cameraY + visibleRows) {
    generateNextTerrainPhase();
  }

  // Update existing entities with current mechanic toggles:
  trucks.forEach(truck => {
    truck.speed = slowCars ? 0.5 : 1;
  });
  logs.forEach(log => {
    // Update width and recalc snap points for logs
    log.width = longerLogs ? 4 : 2;
    log.snapPoints = computeLogSnapPoints(log);
  });

  // --- Update Trucks and Logs ---
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

  // --- Frog and Log Interaction ---
  let frogRow = Math.floor(frog.y);
  let currentRow2 = terrainRows.find(row => row.index === frogRow && row.type === "river");
  if (currentRow2) {
    let log = currentRow2.log;
    if (!log) {
      arcadeState.isGameOver = true;
    }
  }

  // --- Scoring ---
  let currentRow = Math.floor(frog.y);
  if (currentRow > maxRowReached) {
    maxRowReached = currentRow;
    arcadeState.currentScore += 50;
    arcadeState.scoreElement.innerText = 'Score: ' + arcadeState.currentScore;
  }

  // --- Truck Collision ---
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

  if (frog.y < cameraY) {
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
    if (yPixel + cellH < 0 || yPixel > arcadeState.canvas.height) return;

    if (row.type === "empty") {
      arcadeState.ctx.fillStyle = "#222";
      arcadeState.ctx.fillRect(0, yPixel - cellH, arcadeState.canvas.width, cellH);
    } else if (row.type === "road") {
      arcadeState.ctx.fillStyle = "#555";
      arcadeState.ctx.fillRect(0, yPixel - cellH, arcadeState.canvas.width, cellH);
      if (row.truck) {
        arcadeState.ctx.fillStyle = "red";
        arcadeState.ctx.fillRect(row.truck.x * cellW, yPixel - cellH, row.truck.width * cellW, cellH);
      }
    } else if (row.type === "river") {
      arcadeState.ctx.fillStyle = "#3366FF";
      arcadeState.ctx.fillRect(0, yPixel - cellH, arcadeState.canvas.width, cellH);
      if (row.log) {
        arcadeState.ctx.fillStyle = "#8B4513";
        arcadeState.ctx.fillRect(row.log.x * cellW, yPixel - cellH, row.log.width * cellW, cellH);
      }
    }
  });

  let frogYPixel = arcadeState.canvas.height - ((frog.y - cameraY) * cellH);
  arcadeState.ctx.fillStyle = "lime";
  arcadeState.ctx.fillRect(frog.x * cellW, frogYPixel - cellH, cellW, cellH);

  arcadeState.ctx.fillStyle = "black";
  arcadeState.ctx.font = "10px Arial";
  arcadeState.ctx.fillText(frog.facing, (frog.x + 0.2) * cellW, frogYPixel - 0.2 * cellH);
}

// --------------------
// Input Handlers
// --------------------
function handleFroggerInput(e) {
  if (arcadeState.isGameOver) return;
  let rect = arcadeState.canvas.getBoundingClientRect();
  let clientX, clientY;
  e.preventDefault();
  if (e.type === 'click') {
    clientX = e.clientX;
    clientY = e.clientY;
  } else if (e.type === 'touchstart') {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }

  let x = ((clientX - rect.left) / arcadeState.canvas.width) * arcadeState.baseCols;
  let y = ((arcadeState.canvas.height - (clientY - rect.top)) / arcadeState.canvas.height) * arcadeState.baseRows + cameraY;

  let dx = x - frog.x;
  let dy = y - frog.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    frog.snappedLog = null;
    frog.snapOffset = null;
    if (dy > 0) {
      if (frog.animationState === "jumping" && !frog.queuedJump) {
        frog.queuedJump = true;
        console.log("Queued jump");
      } else if (frog.animationState !== "jumping") {
        frog.targetY = frog.y + 1;
        frog.facing = "north";
      }
    }
  } else {
    processHorizontalInput(dx);
  }

  frog.targetX = Math.max(0, Math.min(arcadeState.baseCols - 1, frog.targetX));
  frog.targetY = Math.max(0, frog.targetY);

  if (Math.abs(dy) < Math.abs(dx)) {
    frog.snappedLog = null;
    frog.snapOffset = null;
    frog.queuedJump = false;
  }
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
