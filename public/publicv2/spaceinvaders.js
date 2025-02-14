/***********************************************************
 * spaceinvaders.js
 * 
 * A simple Space Invaders clone.
 * 
 * Controls:
 * - The spaceship moves horizontally (lerps toward the tapped x).
 * - Tapping fires a bullet from the center (or, if tripleShot is enabled, three bullets simultaneously).
 * 
 * Spaceship:
 * - 1x1 arcade unit, starting centered horizontally,
 *   and positioned 0.5 arcade units from the bottom.
 * 
 * Shields:
 * - Four shield blocks are placed on the third-to-last row (row = arcadeState.baseRows - 3)
 *   at columns 2, 4, 6, and 8 (0-indexed).
 * - Each shield starts with 10 health.
 * 
 * Enemies:
 * - Each enemy is 0.9x0.9 arcade units.
 * - They form a grid 7 wide and 5 deep with 1 arcade unit padding on left/right.
 *   The top row is at row 1.
 * - The entire formation moves horizontally at an initial speed of 0.25 units/sec.
 *   When any enemy gets within 0.5 units of an edge, the whole formation moves down 0.5 units and reverses direction.
 * - The enemy speed increases by 10% every 10 seconds and is preserved on respawn.
 * 
 * Bullets:
 * - Player bullets travel upward at 10 units/sec.
 * - Only one player bullet is allowed at a time unless infiniteShooting is enabled.
 * - If tripleShot is enabled, three bullets are fired simultaneously from the spaceship:
 *   one from the center, one from the top left, and one from the top right.
 * - Enemy bullets travel downward at 3 units/sec.
 * - Enemies fire at a rate starting at 1 bullet per second, increasing by 10% every 5 seconds.
 * 
 * Collisions:
 * - A player bullet hitting an enemy destroys the enemy.
 * - A player bullet hitting a shield (if friendlyFire is off) damages the shield (1 damage).
 * - An enemy bullet hitting a shield damages it (1 damage) and the bullet is removed.
 * - An enemy bullet or an enemy colliding with the spaceship triggers game over.
 * - Enemies colliding with a shield: each enemy collision damages the shield (1 per collision) and destroys the enemy.
 * 
 * Respawning:
 * - When all enemies are defeated, the formation and shields are immediately respawned (with shields reset to 10).
 * 
 * Host Mechanics (from Firebase mechanics/spaceinvaders):
 * - infiniteShooting (boolean): if true, unlimited player bullets are allowed.
 * - tripleShot (boolean): if true, three bullets fire per shot.
 * - friendlyFire (boolean): if true, player bullets do not damage shields.
 * 
 * Console logs for sound effects are included.
 * 
 * Globals:
 *   Assumes arcadeCore.js provides a global object "arcadeState" with:
 *     arcadeState.canvas, arcadeState.ctx, arcadeState.baseCols, arcadeState.baseRows,
 *     arcadeState.isGameOver, arcadeState.currentScore, arcadeState.animationFrameId,
 *     arcadeState.db, and arcadeState.previousTimestamp.
 ***********************************************************/

// --- Module-Scoped Variables ---

// Spaceship (player)
let spaceship = {
    x: 4, // centered (if baseCols = 9, then columns 0..8; center is 4)
    y: 0.5, // 0.5 units from bottom
    width: 1,
    height: 1,
    targetX: 4
  };
  
  // Player bullet array (only one allowed unless infiniteShooting is enabled)
  let playerBullets = [];
  
  // Enemy bullet array
  let enemyBullets = [];
  
  // Enemy formation: enemies is an array; formation moves as a unit.
  let enemies = [];
  let enemyGroup = {
    direction: 1, // 1 for right, -1 for left
    speed: 0.25  // initial horizontal speed (arcade units/sec)
  };
  
  // Timers for enemy firing and speed increases
  let enemyFireRate = 1; // bullets per second
  let enemyFireTimer = 0;
  let enemySpeedTimer = 0;
  let enemyFireRateTimer = 0;
  
  // Shields: each shield has 10 health.
  let shields = [];
  
  // Host mechanics toggles (read from Firebase)
  let infiniteShooting = false;
  let tripleShot = false;
  let friendlyFire = false;
  
  // --- Initialization Functions ---
  
  // Initialize enemy formation (grid 7x5, top row at 1)
  function initEnemies() {
    enemies = [];
    // Compute starting x such that grid is centered: if baseCols=9 and grid is 7 wide, start at x=1.
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 7; col++) {
        let enemy = {
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
  function initShields() {
    shields = [];
    let shieldY = arcadeState.baseRows - 3; // third-to-last row
    // Place shields at columns 2, 4, 6, 8 (0-indexed)
    let shieldColumns = [2, 4, 6, 8];
    shieldColumns.forEach(col => {
      let shield = {
        x: col,
        y: shieldY,
        width: 1,
        height: 1,
        health: 10
      };
      shields.push(shield);
    });
  }
  
  // Initialize the game state for Space Invaders
  function initSpaceInvaders() {
    arcadeState.isGameOver = false;
    arcadeState.currentScore = 0;
    
    // Initialize spaceship (centered horizontally)
    spaceship.x = (arcadeState.baseCols - spaceship.width) / 2;
    spaceship.y = 0.5;
    spaceship.targetX = spaceship.x;
    
    // Clear bullets
    playerBullets = [];
    enemyBullets = [];
    
    // Initialize enemy formation and shields
    initEnemies();
    initShields();
    
    // Reset enemy group speed and direction
    enemyGroup.speed = 0.25;
    enemyGroup.direction = 1;
    
    // Reset enemy firing parameters
    enemyFireRate = 1;
    enemyFireTimer = 0;
    enemySpeedTimer = 0;
    enemyFireRateTimer = 0;
    
    // Set up input listeners for spaceship movement/firing
    arcadeState.canvas.addEventListener('click', handleSpaceInvadersInput);
    arcadeState.canvas.addEventListener('touchstart', handleSpaceInvadersInput, { passive: false });
    
    // Listen to Space Invaders host mechanics
    listenToSpaceInvadersMechanics();
    
    // Start the game loop
    arcadeState.previousTimestamp = performance.now();
    arcadeState.animationFrameId = requestAnimationFrame(gameLoopSpaceInvaders);
  }
  
  // --- Firing Functions ---
  
  // Spawn player bullet(s)
  function firePlayerBullet() {
    // If not infinite shooting, only allow one bullet at a time.
    if (!infiniteShooting && playerBullets.length > 0) return;
    
    if (tripleShot) {
      // Fire three bullets from different x offsets.
      let offsets = [0.2, 0.5, 0.8];
      offsets.forEach(offset => {
        let bullet = {
          x: spaceship.x + offset - 0.05, // adjust to center bullet
          y: spaceship.y + spaceship.height,
          width: 0.1,
          height: 0.2,
          vy: 10 // bullet speed upward
        };
        playerBullets.push(bullet);
      });
      console.log("Sound: triple shot fire");
    } else {
      let bullet = {
        x: spaceship.x + 0.5 - 0.05,
        y: spaceship.y + spaceship.height,
        width: 0.1,
        height: 0.2,
        vy: 10
      };
      playerBullets.push(bullet);
      console.log("Sound: spaceship fire");
    }
  }
  
  // Spawn an enemy bullet from a random alive enemy.
  function spawnEnemyBullet() {
    let aliveEnemies = enemies.filter(e => e.alive);
    if (aliveEnemies.length === 0) return;
    let shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    let bullet = {
      x: shooter.x + shooter.width/2 - 0.05,
      y: shooter.y,
      width: 0.1,
      height: 0.2,
      vy: 3 // enemy bullet speed (downward)
    };
    enemyBullets.push(bullet);
    console.log("Sound: enemy fire");
  }
  
  // --- Input Handler ---
  
  // Handle input for spaceship movement and firing.
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
    // Compute target X based on input.
    let targetX = ((clientX - rect.left) / arcadeState.canvas.width) * arcadeState.baseCols;
    targetX = Math.max(0, Math.min(arcadeState.baseCols - spaceship.width, targetX));
    spaceship.targetX = targetX;
    
    // If the input occurs near the spaceship (or simply on the spaceship), fire.
    // (You might want to differentiate tapping for movement vs. firing.)
    // For simplicity, we always fire on input.
    firePlayerBullet();
  }
  
  // --- Update Functions ---
  
  function updateSpaceInvaders(deltaTime) {
    // Update spaceship (lerp horizontally)
    let dx = spaceship.targetX - spaceship.x;
    if (Math.abs(dx) > 0.001) {
      let step = 10 * deltaTime; // spaceship moves at 10 units/sec horizontally
      if (Math.abs(dx) < step) {
        spaceship.x = spaceship.targetX;
      } else {
        spaceship.x += step * Math.sign(dx);
      }
    }
    
    // Update player bullets
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      let bullet = playerBullets[i];
      bullet.y += bullet.vy * deltaTime;
      if (bullet.y > arcadeState.baseRows) {
        playerBullets.splice(i, 1);
      }
    }
    
    // Update enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      let bullet = enemyBullets[i];
      bullet.y -= bullet.vy * deltaTime;
      if (bullet.y + bullet.height < 0) {
        enemyBullets.splice(i, 1);
      }
    }
    
    // Update enemy formation movement
    // Determine formation bounds
    let aliveEnemies = enemies.filter(e => e.alive);
    if (aliveEnemies.length > 0) {
      let formationLeft = Math.min(...aliveEnemies.map(e => e.x));
      let formationRight = Math.max(...aliveEnemies.map(e => e.x + e.width));
      if (formationLeft < 0.5 || formationRight > arcadeState.baseCols - 0.5) {
        // Move formation down and reverse direction
        aliveEnemies.forEach(e => {
          e.y -= 0.5;
        });
        enemyGroup.direction *= -1;
        console.log("Sound: enemy formation move down and reverse");
      } else {
        aliveEnemies.forEach(e => {
          e.x += enemyGroup.speed * enemyGroup.direction * deltaTime;
        });
      }
    }
    
    // Increase enemy group speed over time (every 10 seconds, 10% increase)
    enemySpeedTimer += deltaTime;
    if (enemySpeedTimer >= 10) {
      enemyGroup.speed *= 1.1;
      enemySpeedTimer -= 10;
      console.log("Sound: enemy speed increased");
    }
    
    // Enemy firing logic
    enemyFireTimer += deltaTime;
    if (enemyFireTimer >= (1 / enemyFireRate)) {
      spawnEnemyBullet();
      enemyFireTimer = 0;
    }
    enemyFireRateTimer += deltaTime;
    if (enemyFireRateTimer >= 5) {
      enemyFireRate *= 1.1;
      enemyFireRateTimer -= 5;
      console.log("Sound: enemy fire rate increased");
    }
    
    // --- Collision Detection ---
    
    // Player bullet vs. enemy
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      let bullet = playerBullets[i];
      enemies.forEach(enemy => {
        if (enemy.alive && checkCollision(bullet, enemy)) {
          enemy.alive = false;
          playerBullets.splice(i, 1);
          console.log("Sound: enemy destroyed");
        }
      });
    }
    
    // Player bullet vs. shields (if friendlyFire is off)
    if (!friendlyFire) {
      for (let i = playerBullets.length - 1; i >= 0; i--) {
        let bullet = playerBullets[i];
        shields.forEach(shield => {
          if (checkCollision(bullet, shield)) {
            shield.health -= 1;
            playerBullets.splice(i, 1);
            console.log("Sound: shield hit by player bullet");
          }
        });
      }
    }
    
    // Enemy bullet vs. spaceship
    enemyBullets.forEach(bullet => {
      if (checkCollision(bullet, spaceship)) {
        arcadeState.isGameOver = true;
        console.log("Sound: spaceship hit by enemy bullet");
      }
    });
    
    // Enemy bullet vs. shields
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      let bullet = enemyBullets[i];
      shields.forEach(shield => {
        if (checkCollision(bullet, shield)) {
          shield.health -= 1;
          enemyBullets.splice(i, 1);
          console.log("Sound: shield hit by enemy bullet");
        }
      });
    }
    
    // Enemy vs. spaceship
    enemies.forEach(enemy => {
      if (enemy.alive && checkCollision(enemy, spaceship)) {
        arcadeState.isGameOver = true;
        console.log("Sound: spaceship collided with enemy");
      }
    });
    
    // Enemy vs. shields: if an enemy collides with a shield, the enemy is destroyed and the shield takes 1 damage.
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
    
    // Remove shields that have no health left
    shields = shields.filter(shield => shield.health > 0);
    
    // Respawn enemy formation and shields if all enemies are dead.
    if (enemies.filter(e => e.alive).length === 0) {
      initEnemies();
      initShields();
      console.log("Sound: enemy formation respawn");
    }
    
    // Game over if spaceship collides with enemy bullet or enemy (handled above).
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
    
    // Render spaceship
    arcadeState.ctx.fillStyle = "lime";
    arcadeState.ctx.fillRect(spaceship.x * cellW, arcadeState.canvas.height - ((spaceship.y + spaceship.height) * cellH), spaceship.width * cellW, spaceship.height * cellH);
    
    // Render player bullets
    arcadeState.ctx.fillStyle = "white";
    playerBullets.forEach(bullet => {
      arcadeState.ctx.fillRect(bullet.x * cellW, arcadeState.canvas.height - (bullet.y * cellH), bullet.width * cellW, bullet.height * cellH);
    });
    
    // Render enemy bullets
    arcadeState.ctx.fillStyle = "yellow";
    enemyBullets.forEach(bullet => {
      arcadeState.ctx.fillRect(bullet.x * cellW, arcadeState.canvas.height - (bullet.y * cellH), bullet.width * cellW, bullet.height * cellH);
    });
    
    // Render enemies
    arcadeState.ctx.fillStyle = "red";
    enemies.forEach(enemy => {
      if (enemy.alive) {
        arcadeState.ctx.fillRect(enemy.x * cellW, arcadeState.canvas.height - ((enemy.y + enemy.height) * cellH), enemy.width * cellW, enemy.height * cellH);
      }
    });
    
    // Render shields
    arcadeState.ctx.fillStyle = "blue";
    shields.forEach(shield => {
      arcadeState.ctx.fillRect(shield.x * cellW, arcadeState.canvas.height - ((shield.y + shield.height) * cellH), shield.width * cellW, shield.height * cellH);
      // Render shield health (optional)
      arcadeState.ctx.fillStyle = "white";
      arcadeState.ctx.font = "8px Arial";
      arcadeState.ctx.fillText(shield.health, shield.x * cellW + 2, arcadeState.canvas.height - ((shield.y + shield.height/2) * cellH));
      arcadeState.ctx.fillStyle = "blue";
    });
    
    // Render score in top left corner
    arcadeState.ctx.fillStyle = "white";
    arcadeState.ctx.font = "14px Arial";
    arcadeState.ctx.fillText("Score: " + arcadeState.currentScore, 10, 20);
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
  
  // --- Start Space Invaders ---
  function startSpaceInvaders() {
    showTitleScreen('Space Invaders', () => {
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
      tripleShot = !!val.tripleShot;
      friendlyFire = !!val.friendlyFire;
      console.log("Space Invaders mechanics updated:", { infiniteShooting, tripleShot, friendlyFire });
    });
  }
  
  export { startSpaceInvaders };
  