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
 * Terrain:
 *   - The first 8 rows (indices 0–7) are empty.
 *   - Then rows are generated in a repeating pattern:
 *         currentPatternLevel road rows, 1 empty row, 
 *         currentPatternLevel river rows,
 *     with currentPatternLevel starting at 1 and increasing indefinitely.
 * 
 * Obstacles:
 *   - In each road row, a truck (1x2) is generated and moves horizontally,
 *     wrapping around. Trucks use a collider of 0.9 units tall.
 *   - In each river row, a log is generated:
 *         • normally 1x2, with snap points [log.x, log.x + 1];
 *         • if longerLogs is true, logs become 1x4, with snap points 
 *           [log.x, log.x+1, log.x+2, log.x+3].
 *     Logs move horizontally and wrap around.
 *   - When the frog is on a river row and landed (animationState === "sitting"),
 *     we check the frog’s distance to each snap point from the log.
 *     If any snap point is within 0.5 units, we snap the frog to that point.
 *     (This is done only if the frog’s intended target remains on the log;
 *      otherwise, the frog is allowed to jump off.)
 * 
 * Collisions & Scoring:
 *   - Collisions with trucks (using a collider height of 0.9) and falling off the screen cause a loss.
 *   - The frog is awarded 20 points each time it reaches a new maximum y.
 * 
 * Camera Modes:
 *   - Auto-scroll: cameraY increases at autoScrollSpeed (initially 1 unit/sec, increasing 10% every 6 sec).
 *   - Vertical centering: if enabled, cameraY lerps to keep the frog centered plus an offset.
 * 
 * Host Mechanics (from Firebase mechanics/frogger):
 *   - longerLogs (boolean): if true, logs are 1x4.
 *   - slowCars (boolean): if true, trucks move at half speed.
 *   - verticalCenterMode (boolean): if true, disable auto-scroll and instead lerp
 *       the camera to keep the frog centered.
 *   - verticalCenterOffset (number): vertical offset for centering.
 * 
 * Globals (via arcadeState):
 *   arcadeState.canvas, arcadeState.ctx, arcadeState.baseCols, arcadeState.baseRows,
 *   arcadeState.isGameOver, arcadeState.currentScore, arcadeState.animationFrameId,
 *   arcadeState.db, arcadeState.previousTimestamp.
 * Also assumed are common functions:
 *   showTitleScreen(), hideTitleScreen(), gameOver(restartCallback).
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
    animationState: "sitting"
  };
  
  let cameraY = 0;                
  let autoScrollSpeed = 1;
  let autoScrollTimer = 0;
  let verticalCenterMode = false;
  let verticalCenterOffset = 2;
  
  let terrainRows = [];
  let highestRowGenerated = 7;
  let currentPatternLevel = 1;
  let patternPhase = "road";
  let patternRowsLeft = currentPatternLevel;
  
  let trucks = [];
  let logs = [];
  
  let frogLerpSpeed = 6;
  
  let longerLogs = false;
  let slowCars = false;
  
  let maxRowReached = frog.y;
  
  // --------------------
  // Helper: World Y to Canvas Y Conversion
  // --------------------
  function worldYToCanvasY(worldY) {
    let cellH = arcadeState.canvas.height / arcadeState.baseRows;
    return arcadeState.canvas.height - ((worldY - cameraY) * cellH);
  }
  
  // --------------------
  // Log Snap Points
  // --------------------
  function computeLogSnapPoints(log) {
    // For a log with width W, generate snap points for each grid cell it covers.
    let snapPoints = [];
    let numPoints = Math.floor(log.width); // For width=2, two points; for width=4, four points.
    for (let i = 0; i < numPoints; i++) {
      snapPoints.push(log.x + i);
    }
    return snapPoints;
  }
  
  // --------------------
  // Entry Point
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
    generateNextTerrainPhase();
    
    // Rebuild obstacles arrays.
    trucks = [];
    logs = [];
    terrainRows.forEach(row => {
      if (row.type === "road") {
        if (!row.truck) {
          row.truck = createTruckForRow(row.index);
        }
        trucks.push(row.truck);
      } else if (row.type === "river") {
        if (!row.log) {
          row.log = createLogForRow(row.index);
        }
        // Compute and store snap points for the log.
        row.log.snapPoints = computeLogSnapPoints(row.log);
        logs.push(row.log);
      }
    });
    
    arcadeState.canvas.addEventListener('click', handleFroggerInput);
    arcadeState.canvas.addEventListener('touchstart', handleFroggerInput, { passive: false });
    
    listenToFroggerMechanics();
    
    arcadeState.previousTimestamp = performance.now();
    arcadeState.animationFrameId = requestAnimationFrame(gameLoopFrogger);
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
        patternRowsLeft--;
        if (patternRowsLeft <= 0) {
          patternPhase = "empty";
          patternRowsLeft = 1;
        }
      } else if (patternPhase === "empty") {
        newRow.type = "empty";
        patternPhase = "river";
        patternRowsLeft = currentPatternLevel;
      } else if (patternPhase === "river") {
        newRow.type = "river";
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
          row.truck = createTruckForRow(row.index);
          trucks.push(row.truck);
          row.obstacleAssigned = true;
        } else if (row.type === "river") {
          row.log = createLogForRow(row.index);
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
  function createTruckForRow(rowIndex) {
    let truck = {
      row: rowIndex,
      x: Math.random() * (arcadeState.baseCols - 2),
      width: 2,
      speed: slowCars ? 0.5 : 1,
      direction: Math.random() < 0.5 ? 1 : -1
    };
    return truck;
  }
  
  function createLogForRow(rowIndex) {
    let logWidth = longerLogs ? 4 : 2;
    let log = {
      row: rowIndex,
      x: Math.random() * (arcadeState.baseCols - logWidth),
      width: logWidth,
      speed: 1,
      direction: Math.random() < 0.5 ? 1 : -1
    };
    return log;
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
    // --- Frog Movement ---
    let dx = frog.targetX - frog.x;
    let dy = frog.targetY - frog.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.001) {
      let step = frogLerpSpeed * deltaTime;
      if (step >= dist) {
        frog.x = frog.targetX;
        frog.y = frog.targetY;
        frog.animationState = "sitting";
        // Once landed, attempt snapping if in a river row.
        maybeSnapFrogToLog();
      } else {
        frog.x += (dx / dist) * step;
        frog.y += (dy / dist) * step;
        frog.animationState = "jumping";
      }
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
    
    // --- Clamp Frog Movement ---
    frog.x = Math.max(0, Math.min(arcadeState.baseCols - 1, frog.x));
    if (frog.y < cameraY) {
      arcadeState.isGameOver = true;
    }
    
    // --- Terrain Generation ---
    let visibleRows = arcadeState.baseRows;
    if (highestRowGenerated < cameraY + visibleRows) {
      generateNextTerrainPhase();
    }
    
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
      log.x += log.speed * log.direction * deltaTime;
      if (log.x > arcadeState.baseCols) {
        log.x = -log.width;
      } else if (log.x + log.width < 0) {
        log.x = arcadeState.baseCols;
      }
      // Recompute snap points if log length changed dynamically.
      log.snapPoints = computeLogSnapPoints(log);
    });
    
    // --- Frog and Log Interaction ---
    let frogRow = Math.floor(frog.y);
    let currentRow = terrainRows.find(row => row.index === frogRow && row.type === "river");
    if (currentRow) {
      let log = currentRow.log;
      if (log) {
        // If frog is not landed, do nothing (allow mid-jump freedom).
        // If frog is landed, snapping occurs in maybeSnapFrogToLog().
        // (No extra logic needed here.)
      } else {
        arcadeState.isGameOver = true;
      }
    }
    
    // --- Scoring ---
    if (frog.y > maxRowReached) {
      maxRowReached = frog.y;
      arcadeState.currentScore += 20;
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
    
    // --- Lose Condition: Falling Off Bottom ---
    if (frog.y < cameraY) {
      arcadeState.isGameOver = true;
    }
    
    if (arcadeState.isGameOver) {
      gameOver(() => { initFrogger(); });
    }
  }
  
  // --------------------
  // Snap Frog to Log (if appropriate)
  // --------------------
  function maybeSnapFrogToLog() {
    // Only snap if the frog is in a river row.
    let frogRow = Math.floor(frog.y);
    let currentRow = terrainRows.find(row => row.index === frogRow && row.type === "river");
    if (!currentRow || !currentRow.log) {
      return;
    }
    
    // If the frog's target (from input) is within the log boundaries, then snap.
    let log = currentRow.log;
    // Ensure the log has its snapPoints computed.
    if (!log.snapPoints) {
      log.snapPoints = computeLogSnapPoints(log);
    }
    
    // Iterate over each snap point and check distance.
    for (let sp of log.snapPoints) {
      if (Math.abs(frog.x - sp) < 0.5) {
        frog.x = sp;
        // Once snapped, set targetX equal to frog.x to prevent further movement until new input.
        frog.targetX = frog.x;
        return;
      }
    }
    
    // If none of the snap points are within threshold, then the frog isn't properly on the log.
    arcadeState.isGameOver = true;
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
    if (e.type === 'click') {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (e.type === 'touchstart') {
      e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    
    let x = ((clientX - rect.left) / arcadeState.canvas.width) * arcadeState.baseCols;
    let y = ((arcadeState.canvas.height - (clientY - rect.top)) / arcadeState.canvas.height) * arcadeState.baseRows + cameraY;
    
    let dx = x - frog.x;
    let dy = y - frog.y;
    if (Math.abs(dy) >= Math.abs(dx)) {
      if (dy > 0) {
        frog.targetY = frog.y + 1;
        frog.facing = "north";
      }
    } else {
      // For lateral movement, if frog is on a river row with a log and landed, update to the next snap point.
      let frogRow = Math.floor(frog.y);
      let currentRow = terrainRows.find(row => row.index === frogRow && row.type === "river");
      if (currentRow && currentRow.log && frog.animationState === "sitting") {
        let snapPts = currentRow.log.snapPoints;
        // Determine current snap index (if frog is snapped, it should be near one snap point).
        let currentSnapIndex = snapPts.findIndex(sp => Math.abs(frog.x - sp) < 0.3);
        if (currentSnapIndex !== -1) {
          if (dx < 0 && currentSnapIndex > 0) {
            frog.targetX = snapPts[currentSnapIndex - 1];
            frog.facing = "west";
          } else if (dx > 0 && currentSnapIndex < snapPts.length - 1) {
            frog.targetX = snapPts[currentSnapIndex + 1];
            frog.facing = "east";
          } else {
            // No change if there's no adjacent snap point.
            frog.targetX = frog.x;
          }
        } else {
          // Not currently snapped, so do normal lateral hop.
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
    
    frog.targetX = Math.max(0, Math.min(arcadeState.baseCols - 1, frog.targetX));
    frog.targetY = Math.min(arcadeState.baseRows - 1, frog.targetY);
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
  