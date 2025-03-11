/***********************************************************
 * spaceinvaders.js
 * 
 * A simple Space Invaders clone using a top–down coordinate system.
 * 
 * Controls:
 * - The spaceship moves horizontally (lerps toward the tapped x).
 * - Tapping fires a bullet from the center (or three bullets if doubleShot is enabled).
 * 
 * Spaceship:
 * - 1x1 arcade unit.
 * - Rests so that there is 0.5 arcade unit padding between the bottom of the ship and the bottom of the screen.
 * 
 * Shields:
 * - Four shield blocks placed on the third-to-last row.
 * - They now appear on columns 1, 3, 5, and 7 (0-indexed).
 * - Each shield has 10 health.
 * 
 * Enemies:
 * - Each enemy is 0.9 x 0.9 arcade units.
 * - They form a grid 7 wide and 5 deep.
 * - The enemy formation moves horizontally at an initial speed of 0.25 units/sec.
 *   When the formation reaches an edge (its right edge ≥ baseCols - 0.5 when moving right or its left edge ≤ 0.5 when moving left),
 *   the formation drops 0.5 arcade units once and then reverses direction.
 * - The enemy speed increases by 10% every 10 seconds and is preserved upon respawn.
 * 
 * Bullets:
 * - Player bullets travel upward at 10 units/sec.
 *   Only one allowed at a time (unless infiniteShooting is enabled).
 *   With doubleShot enabled, two bullets fire simultaneously.
 * - Enemy bullets now fire straight downward at 3 units/sec.
 *   At each firing interval, a random grid position in the enemy formation is chosen.
 *   If the enemy at that position is alive, it fires a bullet straight down.
 * 
 * Collisions:
 * - A player bullet hitting an enemy destroys it and awards points.
 *   Points per enemy = 20.
 * - A player bullet hitting a shield (if friendlyFire is off) reduces its health by 1.
 * - An enemy bullet or enemy colliding with the spaceship triggers game over.
 * - Enemy collisions with shields also damage the shields.
 * 
 * Respawn:
 * - When all enemies are defeated, the enemy formation and shields respawn.
 * 
 * Globals:
 *   Assumes arcadeCore.js provides a global object "arcadeState" with:
 *     canvas, ctx, baseCols, baseRows, isGameOver, currentScore, animationFrameId, db, and previousTimestamp.
 ***********************************************************/

// --- Module-Scoped Variables ---

// Spaceship (player)
let spaceship = {
  width: 1,
  height: 1,
  x: 0, // will be initialized
  y: 0, // will be initialized (top-down coordinate system)
  targetX: 0
};

// Player bullet array
let playerBullets = [];

// Enemy bullet array
let enemyBullets = [];

// Enemies: stored as an array; the formation moves as a unit.
let enemies = [];
let enemyGroup = {
  direction: 1,         // 1 for right, -1 for left
  speed: 0.25,          // initial horizontal speed (arcade units/sec)
  isDropping: false     // flag to ensure only one downward move is triggered
};

// Timers for enemy firing and speed increases
let enemyFireRate = 1; // bullets per second
let enemyFireTimer = 0;
let enemySpeedTimer = 0;
let enemyFireRateTimer = 0;

// Shields array
let shields = [];

// Host mechanics toggles
let infiniteShooting = false;
let doubleShot = false;
let friendlyFire = false;



// --- Initialization Functions ---

// Initialize the spaceship using arcade units.
// The ship is positioned so its bottom is 0.5 arcade units from the bottom.
function initSpaceship() {
  spaceship.x = (arcadeState.baseCols - spaceship.width) / 2;
  spaceship.y = arcadeState.baseRows - spaceship.height - 0.5;
  spaceship.targetX = spaceship.x;
}

// Initialize enemy formation (grid 7 wide by 5 deep, top row at row 1)
function initEnemies() {
  enemies = [];
  // Formation grid: 5 rows x 7 columns.
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      let enemy = {
        // Position enemies starting at x = 1 and y = 1.
        x: 1 + col,
        y: 1 + row,
        width: 0.9,
        height: 0.9,
        alive: true
      };
      enemies.push(enemy);
    }
  }
}

// Initialize shields (placed on the third-to-last row)
// Now placed on columns 1, 3, 5, and 7.
function initShields() {
  shields = [];
  let shieldRow = arcadeState.baseRows - 3;
  let shieldColumns = [1, 3, 5, 7]; // 0-indexed positions.
  shieldColumns.forEach(col => {
    let shield = {
      x: col,
      y: shieldRow,
      width: 1,
      height: 1,
      health: 10
    };
    shields.push(shield);
  });
}

// --- Bullet Firing Functions ---

// Fires a player bullet (or double shot) from the spaceship.
function firePlayerBullet() {
  if (!infiniteShooting && playerBullets.length > 0) return;
  if (doubleShot) {
    let offsets = [0.2, 0.8];
    offsets.forEach(offset => {
      let bullet = {
        x: spaceship.x + offset - 0.05,
        y: spaceship.y,
        width: 0.1,
        height: 0.2,
        vy: 10 // upward speed (arcade units/sec)
      };
      playerBullets.push(bullet);
    });
    arcadeState.sounds.shipFire.cloneNode(true).play();
  } else {
    let bullet = {
      x: spaceship.x + 0.5 - 0.05,
      y: spaceship.y,
      width: 0.1,
      height: 0.2,
      vy: 10
    };
    playerBullets.push(bullet);
    arcadeState.sounds.shipFire.cloneNode(true).play();
  }
}

// At each firing interval, pick a random grid position in the enemy formation.
// If the enemy at that position is alive, fire a bullet straight down.
function spawnEnemyBulletFromGrid() {
  // Formation grid dimensions: 5 rows x 7 columns.
  let randomRow = Math.floor(Math.random() * 5);
  let randomCol = Math.floor(Math.random() * 7);
  let index = randomRow * 7 + randomCol;
  if (index < enemies.length) {
    let shooter = enemies[index];
    if (shooter.alive) {
      // Fire bullet straight down from the enemy's bottom-center.
      let shooterCenterX = shooter.x + shooter.width / 2;
      let shooterBottomY = shooter.y + shooter.height;
      let bullet = {
        x: shooterCenterX - 0.05,
        y: shooterBottomY,
        width: 0.1,
        height: 0.2,
        vx: 0,
        vy: 3 // bullet travels straight down
      };
      enemyBullets.push(bullet);
      arcadeState.sounds.invaderFire.cloneNode(true).play();
    }
  }
}

// --- Input Handler ---

function handleSpaceInvadersInput(e) {
  if (arcadeState.isGameOver) return;
  let rect = arcadeState.canvas.getBoundingClientRect();
  let clientX;
  if (e.type === 'click') {
    clientX = e.clientX;
  } else if (e.type === 'touchstart') {
    e.preventDefault();
    clientX = e.touches[0].clientX;
  }
  // Target the ship's center to the tap.
  let targetX = (((clientX - rect.left) / arcadeState.canvas.width) * arcadeState.baseCols) - spaceship.width / 2;
  targetX = Math.max(0, Math.min(arcadeState.baseCols - spaceship.width, targetX));
  spaceship.targetX = targetX;

  // Also fire a bullet when tapped.
  firePlayerBullet();
}

// --- Update Functions ---

function updateSpaceInvaders(deltaTime) {
  // Update spaceship horizontal movement.
  let dx = spaceship.targetX - spaceship.x;
  if (Math.abs(dx) > 0.001) {
    let step = 10 * deltaTime;
    if (Math.abs(dx) < step) {
      spaceship.x = spaceship.targetX;
    } else {
      spaceship.x += step * Math.sign(dx);
    }
  }

  // Update player bullets (move upward).
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    let bullet = playerBullets[i];
    bullet.y -= bullet.vy * deltaTime;
    if (bullet.y + bullet.height < 0) {
      playerBullets.splice(i, 1);
    }
  }

  // Update enemy bullets (move using their vx and vy).
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    let bullet = enemyBullets[i];
    bullet.x += bullet.vx * deltaTime;
    bullet.y += bullet.vy * deltaTime;
    // Remove bullet if it goes off the grid.
    if (bullet.y > arcadeState.baseRows || bullet.y + bullet.height < 0 ||
      bullet.x > arcadeState.baseCols || bullet.x + bullet.width < 0) {
      enemyBullets.splice(i, 1);
    }
  }

  // --- Enemy Formation Movement ---
  let aliveEnemies = enemies.filter(e => e.alive);
  if (aliveEnemies.length > 0) {
    let formationLeft = Math.min(...aliveEnemies.map(e => e.x));
    let formationRight = Math.max(...aliveEnemies.map(e => e.x + e.width));
    // Check if the formation has reached an edge.
    if ((enemyGroup.direction > 0 && formationRight >= arcadeState.baseCols - 0.5) ||
      (enemyGroup.direction < 0 && formationLeft <= 0.5)) {
      if (!enemyGroup.isDropping) {
        // Drop formation by 0.5 arcade units once and reverse direction.
        aliveEnemies.forEach(e => { e.y += 0.5; });
        enemyGroup.direction *= -1;
        enemyGroup.isDropping = true;
        arcadeState.sounds.invaderDrop.play();
      }
    } else {
      enemyGroup.isDropping = false;
      // Move formation horizontally.
      aliveEnemies.forEach(e => {
        e.x += enemyGroup.speed * enemyGroup.direction * deltaTime;
      });
    }
  }

  // Increase enemy group speed every 10 seconds (10% increase).
  enemySpeedTimer += deltaTime;
  if (enemySpeedTimer >= 5) {
    enemyGroup.speed *= 1.1;
    enemySpeedTimer -= 5;
  }

  // --- Enemy Firing ---
  enemyFireTimer += deltaTime;
  if (enemyFireTimer >= (1 / enemyFireRate)) {
    enemyFireTimer = 0;
    // Choose a random grid position and fire if that enemy is alive.
    spawnEnemyBulletFromGrid();
  }
  enemyFireRateTimer += deltaTime;
  if (enemyFireRateTimer >= 5) {
    enemyFireRate *= 1.1;
    enemyFireRateTimer -= 5;
  }

  // --- Collision Detection ---

  // Player bullet vs. enemy.
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    let bullet = playerBullets[i];
    enemies.forEach(enemy => {
      if (enemy.alive && checkCollision(bullet, enemy)) {
        enemy.alive = false;
        playerBullets.splice(i, 1);
        arcadeState.currentScore += 20;
        arcadeState.sounds.invaderDead2.cloneNode(true).play();
      }
    });
  }

  // Update score display.
  if (arcadeState.scoreElement) {
    arcadeState.scoreElement.innerText = 'Score: ' + arcadeState.currentScore;
  }

  // Player bullet vs. shields (if friendlyFire is off).
  if (!friendlyFire) {
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      let bullet = playerBullets[i];
      for (let j = 0; j < shields.length; j++) {
        let shield = shields[j];
        if (checkCollision(bullet, shield)) {
          shield.health -= 1;
          playerBullets.splice(i, 1);
          arcadeState.sounds.invaderDead.cloneNode(true).play();
          break;
        }
      }
    }
  }
  
  // Enemy bullet vs. shields.
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    let bullet = enemyBullets[i];
    for (let j = 0; j < shields.length; j++) {
      let shield = shields[j];
      if (checkCollision(bullet, shield)) {
        shield.health -= 1;
        enemyBullets.splice(i, 1);
        arcadeState.sounds.invaderDead.cloneNode(true).play();
        break;
      }
    }
  }

  // Enemy bullet vs. spaceship.
  enemyBullets.forEach(bullet => {
    if (checkCollision(bullet, spaceship) && !arcadeState.isGameOver) {
      arcadeState.sounds.shipExplode.play();
      gameOver(() => { initSpaceInvaders(); });
    }
  });

  // Enemy vs. spaceship.
  enemies.forEach(enemy => {
    if (enemy.alive && checkCollision(enemy, spaceship) && !arcadeState.isGameOver) {
      arcadeState.sounds.shipExplode.play();
      gameOver(() => { initSpaceInvaders(); });
    }
  });

  // Enemy vs. shields.
  enemies.forEach(enemy => {
    if (enemy.alive) {
      shields.forEach(shield => {
        if (checkCollision(enemy, shield)) {
          enemy.alive = false;
          shield.health -= 1;
          console.log("Sound: enemy hit shield");
        }
      });
    }
  });

  // Remove shields that have no health.
  shields = shields.filter(shield => shield.health > 0);

  // When all enemies are cleared, respawn them.
  if (enemies.filter(e => e.alive).length === 0) {
    playerBullets = [];
    initEnemies();
    initShields();
    arcadeState.sounds.invaderRespawn.play();
    if (arcadeState.scoreElement) {
      arcadeState.scoreElement.innerText = 'Score: ' + arcadeState.currentScore;
    }
  }
}

// Simple AABB collision detection.
function checkCollision(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

// --- Render Function ---
function renderSpaceInvaders() {
  let cellW = arcadeState.canvas.width / arcadeState.baseCols;
  let cellH = arcadeState.canvas.height / arcadeState.baseRows;
  arcadeState.ctx.clearRect(0, 0, arcadeState.canvas.width, arcadeState.canvas.height);

  // Render spaceship.
  arcadeState.ctx.drawImage(
    arcadeState.images.ship,
    spaceship.x * cellW,
    spaceship.y * cellH,
    spaceship.width * cellW,
    spaceship.height * cellH
  );
  //arcadeState.ctx.fillStyle = "lime";
  //arcadeState.ctx.fillRect(spaceship.x * cellW, spaceship.y * cellH, spaceship.width * cellW, spaceship.height * cellH);

  // Render player bullets.
  arcadeState.ctx.fillStyle = "white";
  playerBullets.forEach(bullet => {
    arcadeState.ctx.fillRect(bullet.x * cellW, bullet.y * cellH, bullet.width * cellW, bullet.height * cellH);
  });

  // Render enemy bullets.
  arcadeState.ctx.fillStyle = "yellow";
  enemyBullets.forEach(bullet => {
    arcadeState.ctx.fillRect(bullet.x * cellW, bullet.y * cellH, bullet.width * cellW, bullet.height * cellH);
  });

  // Render enemies.
  //arcadeState.ctx.fillStyle = "red";
  enemies.forEach(enemy => {
    if (enemy.alive) {
      arcadeState.ctx.drawImage(
        arcadeState.images.enemy1,
        enemy.x * cellW,
        enemy.y * cellH,
        enemy.width * cellW,
        enemy.height * cellH
      );
      //arcadeState.ctx.fillRect(enemy.x * cellW, enemy.y * cellH, enemy.width * cellW, enemy.height * cellH);
    }
  });

  // Render shields.
  arcadeState.ctx.fillStyle = "blue";
  shields.forEach(shield => {
    arcadeState.ctx.fillRect(shield.x * cellW, shield.y * cellH, shield.width * cellW, shield.height * cellH);
    arcadeState.ctx.fillStyle = "white";
    arcadeState.ctx.font = "8px Arial";
    arcadeState.ctx.fillText(shield.health, shield.x * cellW + 2, (shield.y + shield.height / 2) * cellH);
    arcadeState.ctx.fillStyle = "blue";
  });
}

// --- Game Loop ---
function gameLoopSpaceInvaders(timestamp) {
  if (arcadeState.isGameOver) return;
  let deltaTime = (timestamp - arcadeState.previousTimestamp) / 1000;
  arcadeState.previousTimestamp = timestamp;

  updateSpaceInvaders(deltaTime);
  renderSpaceInvaders();

  arcadeState.animationFrameId = requestAnimationFrame(gameLoopSpaceInvaders);
}

// --- Initialization Function for Space Invaders ---
function initSpaceInvaders() {
  // Reset global game state.
  arcadeState.isGameOver = false;
  arcadeState.currentScore = 0;

  // Initialize spaceship, enemies, and shields.
  initSpaceship();
  initEnemies();
  initShields();

  // Reset bullet arrays.
  playerBullets = [];
  enemyBullets = [];

  // Reset enemy group properties and timers.
  enemyGroup.direction = 1;
  enemyGroup.speed = 0.25;
  enemyGroup.isDropping = false;
  enemyFireRate = 1;
  enemyFireTimer = 0;
  enemySpeedTimer = 0;
  enemyFireRateTimer = 0;

  // Remove any existing input listeners to avoid duplicates.
  arcadeState.canvas.removeEventListener('click', handleSpaceInvadersInput);
  arcadeState.canvas.removeEventListener('touchstart', handleSpaceInvadersInput);

  // Set up input listeners.
  arcadeState.canvas.addEventListener('click', handleSpaceInvadersInput);
  arcadeState.canvas.addEventListener('touchstart', handleSpaceInvadersInput, { passive: false });

  // Start the game loop.
  arcadeState.previousTimestamp = performance.now();
  arcadeState.animationFrameId = requestAnimationFrame(gameLoopSpaceInvaders);

  // Listen for Firebase mechanics updates.
  listenToSpaceInvadersMechanics();
}

// --- Start Space Invaders ---
function startSpaceInvaders() {
  showTitleScreen('Data Viz Invaders!', () => {
    hideTitleScreen();
    initSpaceInvaders();
  });
}

// --- Listen to Space Invaders Mechanics ---
function listenToSpaceInvadersMechanics() {
  const ref = arcadeState.db.ref('mechanics/spaceinvaders');
  ref.off();
  ref.on('value', snap => {
    const val = snap.val() || {};
    infiniteShooting = !!val.infiniteShooting;
    doubleShot = !!val.doubleShot;
    friendlyFire = !!val.friendlyFire;
    console.log("Space Invaders mechanics updated:", { infiniteShooting, doubleShot: doubleShot, friendlyFire });
  });
}

// Export the public API.
export { startSpaceInvaders };
