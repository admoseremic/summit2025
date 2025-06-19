/***********************************************************
 * spaceinvaders.js
 * 
 * A simple Space Invaders clone using a top–down coordinate system.
 * 
 * Controls:
 * - The spaceship moves horizontally (lerps toward the tapped x).
 * - Tapping fires a bullet from the center (or two bullets if doubleShot is enabled).
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
 * - The enemy speed increases by 10% every 5 seconds and is preserved upon respawn.
 * - Invaders animate between two images ("a" and "b") every second.
 *   Bottom two rows use invader type 1, the next two rows invader type 2, and the top row invader type 3.
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
 * - A player bullet hitting an enemy destroys it and awards points (20 per enemy).
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
let enemies = []; // enemy objects will include an "invaderType" property.
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

// For invader animation:
let invaderAnimTimer = 0;
let invaderAnimState = "a"; // toggles between "a" and "b"


// --- Initialization Functions ---

// Initialize the spaceship using arcade units.
// The ship is positioned so its bottom is 0.5 arcade units from the bottom.
function initSpaceship() {
  spaceship.x = (arcadeState.baseCols - spaceship.width) / 2;
  spaceship.y = arcadeState.baseRows - spaceship.height - 2.5;
  spaceship.targetX = spaceship.x;
}

// Initialize enemy formation (grid 7 wide by 5 deep, top row at row 1)
// Assign invaderType based on row:
// - Top row (row 0): type 3
// - Next two rows (row 1 and 2): type 2
// - Bottom two rows (row 3 and 4): type 1
function initEnemies() {
  enemies = [];
  // Formation grid: 5 rows x 7 columns.
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      let enemy = {
        x: 1 + col,
        y: 1 + row,
        width: 0.9,
        height: 0.9,
        alive: true,
        // Determine invaderType based on row:
        invaderType: row === 0 ? 3 : (row < 3 ? 2 : 1)
      };
      enemies.push(enemy);
    }
  }
}

// Initialize shields (placed on the third-to-last row)
// Now placed on columns 1, 3, 5, and 7.
function initShields() {
  shields = [];
  let shieldRow = arcadeState.baseRows - 5;
  let shieldColumns = [1, 3, 5, 7];
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
        vy: 10
      };
      playerBullets.push(bullet);
    });
    arcadeState.playSound(arcadeState.sounds.shipFire);
  } else {
    let bullet = {
      x: spaceship.x + 0.5 - 0.05,
      y: spaceship.y,
      width: 0.1,
      height: 0.2,
      vy: 10
    };
    playerBullets.push(bullet);
    arcadeState.playSound(arcadeState.sounds.shipFire);
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
        vy: 3
      };
      enemyBullets.push(bullet);
      arcadeState.playSound(arcadeState.sounds.invaderFire);
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
  firePlayerBullet();
}

// --- Update Functions ---

function updateSpaceInvaders(deltaTime) {
  // Update spaceship movement.
  let dx = spaceship.targetX - spaceship.x;
  if (Math.abs(dx) > 0.001) {
    let step = 10 * deltaTime;
    spaceship.x = Math.abs(dx) < step ? spaceship.targetX : spaceship.x + step * Math.sign(dx);
  }

  // Update player bullets.
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    let bullet = playerBullets[i];
    bullet.y -= bullet.vy * deltaTime;
    if (bullet.y + bullet.height < 0) {
      playerBullets.splice(i, 1);
    }
  }

  // Update enemy bullets.
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
  let aliveEnemies = enemies.filter(enemy => enemy.alive);
  if (aliveEnemies.length > 0) {
    let formationLeft = Infinity, formationRight = -Infinity;
    aliveEnemies.forEach(enemy => {
      formationLeft = Math.min(formationLeft, enemy.x);
      formationRight = Math.max(formationRight, enemy.x + enemy.width);
    });
    if ((enemyGroup.direction > 0 && formationRight >= arcadeState.baseCols - 0.5) ||
      (enemyGroup.direction < 0 && formationLeft <= 0.5)) {
      if (!enemyGroup.isDropping) {
        aliveEnemies.forEach(enemy => {
          enemy.y += 0.5;
        });
        enemyGroup.direction *= -1;
        enemyGroup.isDropping = true;
        arcadeState.playSound(arcadeState.sounds.invaderDrop);
      }
    } else {
      enemyGroup.isDropping = false;
      aliveEnemies.forEach(enemy => {
        enemy.x += enemyGroup.speed * enemyGroup.direction * deltaTime;
      });
    }
  }

  // Increase enemy speed every 5 seconds.
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

  // --- Invader Animation Update ---
  invaderAnimTimer += deltaTime;
  if (invaderAnimTimer >= 0.6) {
    invaderAnimTimer -= 0.6;
    invaderAnimState = invaderAnimState === "a" ? "b" : "a";
  }

  // --- Collision Detection ---

  // Player bullet vs. enemy.
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    let bullet = playerBullets[i];
    for (let j = 0; j < enemies.length; j++) {
      let enemy = enemies[j];
      if (enemy.alive && checkCollision(bullet, enemy)) {
        enemy.alive = false;
        playerBullets.splice(i, 1);
        arcadeState.currentScore += 20;
        arcadeState.playSound(arcadeState.sounds.invaderDead2);
        break;
      }
    }
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
          arcadeState.playSound(arcadeState.sounds.invaderDead);
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
        arcadeState.playSound(arcadeState.sounds.invaderDead);
        break;
      }
    }
  }

  // Enemy bullet vs. spaceship.
  for (let i = 0; i < enemyBullets.length; i++) {
    let bullet = enemyBullets[i];
    if (checkCollision(bullet, spaceship) && !arcadeState.isGameOver) {
      arcadeState.playSound(arcadeState.sounds.shipExplode);
      gameOver(() => { initSpaceInvaders(); });
      break;
    }
  }

  // Enemy vs. spaceship.
  for (let i = 0; i < enemies.length; i++) {
    let enemy = enemies[i];
    if (enemy.alive && checkCollision(enemy, spaceship) && !arcadeState.isGameOver) {
      arcadeState.playSound(arcadeState.sounds.shipExplode);
      gameOver(() => { initSpaceInvaders(); });
      break;
    }
  }

  // Enemy vs. shields.
  for (let i = 0; i < enemies.length; i++) {
    let enemy = enemies[i];
    if (enemy.alive) {
      for (let j = 0; j < shields.length; j++) {
        let shield = shields[j];
        if (checkCollision(enemy, shield)) {
          enemy.alive = false;
          shield.health -= 2;
          break;
        }
      }
    }
  }

  // Remove shields with no health.
  shields = shields.filter(shield => shield.health > 0);

  // When all enemies are cleared, respawn them.
  let remainingEnemies = enemies.filter(enemy => enemy.alive).length;
  if (remainingEnemies === 0) {
    playerBullets = [];
    initEnemies();
    initShields();
    arcadeState.playSound(arcadeState.sounds.invaderRespawn);
    enemyGroup.speed *= 1.1;
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

  // Render player bullets.
  arcadeState.ctx.fillStyle = "white";
  playerBullets.forEach(bullet => {
    arcadeState.ctx.fillRect(bullet.x * cellW, bullet.y * cellH, bullet.width * cellW, bullet.height * cellH);
  });

  // Render enemy bullets.
  // Render enemy bullets with a sprite.
  enemyBullets.forEach(bullet => {
    const sprite = arcadeState.images.question;
    // Calculate the bullet's dimensions in canvas pixels.
    const bulletW = bullet.width * cellW;
    const bulletH = bullet.height * cellH;
    // Desired sprite height is twice the bullet height.
    const desiredHeight = bulletH * 2;
    // Maintain aspect ratio using the sprite's natural dimensions.
    const scale = desiredHeight / sprite.naturalHeight;
    const desiredWidth = sprite.naturalWidth * scale;

    // Compute the bullet center in canvas coordinates.
    const bulletCenterX = bullet.x * cellW + bulletW / 2;
    const bulletCenterY = bullet.y * cellH + bulletH / 2;

    // Compute destination coordinates so the sprite is centered on the bullet.
    const dx = bulletCenterX - desiredWidth / 2;
    const dy = bulletCenterY - desiredHeight / 2;

    arcadeState.ctx.drawImage(sprite, dx, dy, desiredWidth, desiredHeight);
  });

  // Render enemies using animated invader sprites.
  enemies.forEach(enemy => {
    if (enemy.alive) {
      let invaderImage;
      if (enemy.invaderType === 1) {
        invaderImage = (invaderAnimState === "a") ? arcadeState.images.invader1a : arcadeState.images.invader1b;
      } else if (enemy.invaderType === 2) {
        invaderImage = (invaderAnimState === "a") ? arcadeState.images.invader2a : arcadeState.images.invader2b;
      } else if (enemy.invaderType === 3) {
        invaderImage = (invaderAnimState === "a") ? arcadeState.images.invader3a : arcadeState.images.invader3b;
      }
      arcadeState.ctx.drawImage(
        invaderImage,
        enemy.x * cellW,
        enemy.y * cellH,
        enemy.width * cellW,
        enemy.height * cellH
      );
    }
  });

  // Render shields.
  shields.forEach(shield => {
    arcadeState.ctx.drawImage(
      arcadeState.images.workspace,
      shield.x * cellW,
      shield.y * cellH,
      shield.width * cellW,
      shield.height * cellH
    );
    arcadeState.ctx.fillStyle = "white";
    arcadeState.ctx.font = "8px Arial";
    arcadeState.ctx.fillText(shield.health, shield.x * cellW + 2, (shield.y + shield.height / 2) * cellH);
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
  if (arcadeState.scoreElement) {
    arcadeState.scoreElement.innerText = 'Score: ' + arcadeState.currentScore;
  }
}

// --- Start Space Invaders ---
function startSpaceInvaders() {
  showTitleScreen('Collaboration Invaders!', () => {
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
  });
}

// Export the public API.
export { startSpaceInvaders };
