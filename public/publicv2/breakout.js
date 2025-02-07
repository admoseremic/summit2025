// breakout.js
// ES Module for Breakout
// Assumes that arcadeCore.js sets up globals:
//   canvas, ctx, baseCols (9), baseRows (16),
//   isGameOver, currentScore, animationFrameId,
//   and functions showTitleScreen(), hideTitleScreen()
// Also assumes that Firebase (db) and username are set up in arcadeCore.js,
// and that images brickImg and ballImg are loaded (if available).

// --- Global Breakout Variables (module-scoped) ---
let breakoutPaddle;    // Paddle object
let breakoutBalls = []; // Array of balls
let bricks = [];        // Array of brick objects
let ballSpeed = 5;      // Initial ball speed (arcade units/sec)
let ballSize = 0.5;     // Ball size (0.5 by default; toggles to 1)
let speedTimer = 0;     // Time accumulator for speed increases

// Mechanic toggles coming from the controller
let widerPaddleActive = false; // false: paddle 2 units; true: 4 units
let largerBallsActive = false;   // false: ball size 0.5; true: ball size 1

// Local variable for the game loop timing
let previousTimestamp = 0;

// --- Entry Point ---
// Called by arcadeCore.js when currentGame is set to "breakout"
function startBreakout() {
    // Show the title screen on first load, then initialize breakout.
    showTitleScreen('Breakout', () => {
        hideTitleScreen();
        initBreakout();
    });
}

// --- Initialization ---
function initBreakout() {
    arcadeState.isGameOver = false;
    arcadeState.currentScore = 0;
    ballSpeed = 5;
    ballSize = largerBallsActive ? 1 : 0.5;
    speedTimer = 0;

    // Set paddle dimensions:
    let paddleWidth = widerPaddleActive ? 4 : 2; // in arcade units
    breakoutPaddle = {
        x: (arcadeState.baseCols - paddleWidth) / 2,
        y: arcadeState.baseRows - 0.5,  // Paddle sits in bottom row (its top edge)
        width: paddleWidth,
        height: 0.5,
        targetX: (arcadeState.baseCols - paddleWidth) / 2
    };

    // Initialize the brick grid.
    initBricks();

    // Clear any existing balls and spawn one ball from the paddle.
    breakoutBalls = [];
    spawnBall();

    // Attach paddle control listeners (horizontal movement).
    arcadeState.canvas.addEventListener('mousemove', handlePaddleInput);
    arcadeState.canvas.addEventListener('touchmove', handlePaddleInput, { passive: false });

    // Start the game loop.
    previousTimestamp = performance.now();
    arcadeState.animationFrameId = requestAnimationFrame(gameLoopBreakout);

    // Listen to breakout-specific mechanic toggles from Firebase.
    listenToBreakoutMechanics();
}

function initBricks() {
    bricks = [];
    // Brick grid: starts at arcade row 1 (the second row) and spans 6 rows.
    // Each grid cell (1 unit square) contains 2 bricks stacked vertically.
    // Each brick's base size: width = 1 - 0.2 = 0.8, height = 0.5 - 0.2 = 0.3.
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < arcadeState.baseCols; c++) {
            let cellX = c;
            let cellY = r + 1; // Rows 1 to 6.
            let brickWidth = 0.8;
            let brickHeight = 0.3;
            let topBrick = {
                x: cellX + 0.1,
                y: cellY + 0.1,
                width: brickWidth,
                height: brickHeight,
                exists: true
            };
            let bottomBrick = {
                x: cellX + 0.1,
                y: cellY + 0.5 + 0.1, // cellY + 0.6
                width: brickWidth,
                height: brickHeight,
                exists: true
            };
            bricks.push(topBrick, bottomBrick);
        }
    }
}

// --- Ball Spawning ---
// Spawns a ball at the paddle's center (just above the paddle)
// with a random launch angle deviation of ±10°.
function spawnBall() {
    let paddleCenter = breakoutPaddle.x + breakoutPaddle.width / 2;
    let ballX = paddleCenter - ballSize / 2;
    let ballY = breakoutPaddle.y - ballSize;

    // Random deviation between -10° and +10° (in radians).
    let deviationDeg = (Math.random() * 20) - 10;
    let deviationRad = deviationDeg * Math.PI / 180;
    let vx = ballSpeed * Math.sin(deviationRad);
    let vy = -ballSpeed * Math.cos(deviationRad);

    let ball = {
        x: ballX,
        y: ballY,
        width: ballSize,
        height: ballSize,
        vx: vx,
        vy: vy
    };
    breakoutBalls.push(ball);
    console.log("Sound: ball launch");
}

// --- Game Loop ---
function gameLoopBreakout(timestamp) {
    if (arcadeState.isGameOver) return;
    let deltaTime = (timestamp - previousTimestamp) / 1000;
    previousTimestamp = timestamp;

    updateBreakout(deltaTime);
    renderBreakout();

    arcadeState.animationFrameId = requestAnimationFrame(gameLoopBreakout);
}

// --- Update Logic ---
function updateBreakout(deltaTime) {
    // Paddle movement: Lerp the paddle's x toward targetX (at 6 arcade units/sec).
    const paddleLerpSpeed = 6;
    let diff = breakoutPaddle.targetX - breakoutPaddle.x;
    let step = paddleLerpSpeed * deltaTime;
    if (Math.abs(diff) <= step) {
        breakoutPaddle.x = breakoutPaddle.targetX;
    } else {
        breakoutPaddle.x += step * Math.sign(diff);
    }
    // Clamp paddle within grid bounds.
    breakoutPaddle.x = Math.max(0, Math.min(arcadeState.baseCols - breakoutPaddle.width, breakoutPaddle.x));

    // Update each ball.
    for (let i = breakoutBalls.length - 1; i >= 0; i--) {
        let ball = breakoutBalls[i];
        ball.x += ball.vx * deltaTime;
        ball.y += ball.vy * deltaTime;

        // Wall collisions:
        if (ball.x < 0) {
            ball.x = 0;
            ball.vx *= -1;
            console.log("Sound: ball bounce");
        }
        if (ball.x + ball.width > arcadeState.baseCols) {
            ball.x = arcadeState.baseCols - ball.width;
            ball.vx *= -1;
            console.log("Sound: ball bounce");
        }
        if (ball.y < 0) {
            ball.y = 0;
            ball.vy *= -1;
            console.log("Sound: ball bounce");
        }
        // If the ball falls below the grid, remove it.
        if (ball.y > arcadeState.baseRows) {
            breakoutBalls.splice(i, 1);
            console.log("Sound: ball lost");
        }

        // Paddle collision:
        if (
            ball.y + ball.height >= breakoutPaddle.y &&
            ball.y + ball.height <= breakoutPaddle.y + breakoutPaddle.height &&
            ball.x + ball.width >= breakoutPaddle.x &&
            ball.x <= breakoutPaddle.x + breakoutPaddle.width &&
            ball.vy > 0
        ) {
            // Calculate offset: distance from paddle center (normalized to [-1, 1])
            let ballCenter = ball.x + ball.width / 2;
            let paddleCenter = breakoutPaddle.x + breakoutPaddle.width / 2;
            let offset = (ballCenter - paddleCenter) / (breakoutPaddle.width / 2);

            // Invert vertical velocity and add an offset angle (max ±45°).
            let currentAngle = Math.atan2(ball.vx, -ball.vy);
            let angleAdjustment = offset * (45 * Math.PI / 180);
            let newAngle = currentAngle + angleAdjustment;
            newAngle = Math.max(-45 * Math.PI / 180, Math.min(45 * Math.PI / 180, newAngle));

            let speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.vx = speed * Math.sin(newAngle);
            ball.vy = -speed * Math.cos(newAngle);
            // Position the ball just above the paddle.
            ball.y = breakoutPaddle.y - ball.height - 0.01;
            console.log("Sound: paddle bounce");
        }

        // Brick collisions:
        for (let j = 0; j < bricks.length; j++) {
            let brick = bricks[j];
            if (!brick.exists) continue;
            if (
                ball.x < brick.x + brick.width &&
                ball.x + ball.width > brick.x &&
                ball.y < brick.y + brick.height &&
                ball.y + ball.height > brick.y
            ) {
                // Brick hit: remove brick, award points, and bounce ball.
                brick.exists = false;
                arcadeState.currentScore += 10;
                if (arcadeState.scoreElement) arcadeState.scoreElement.innerText = 'Score: ' + arcadeState.currentScore;
                console.log("Sound: brick break");

                // Determine which side was hit.
                let overlapX = Math.min(ball.x + ball.width - brick.x, brick.x + brick.width - ball.x);
                let overlapY = Math.min(ball.y + ball.height - brick.y, brick.y + brick.height - ball.y);
                if (overlapX < overlapY) {
                    ball.vx *= -1;
                } else {
                    ball.vy *= -1;
                }
                break; // Only handle one brick per update.
            }
        }
    }

    // Increase ball speed every 10 seconds (applies to all balls).
    speedTimer += deltaTime;
    if (speedTimer >= 10) {
        ballSpeed += 1;
        speedTimer -= 10;
        breakoutBalls.forEach(ball => {
            let angle = Math.atan2(ball.vx, -ball.vy);
            ball.vx = ballSpeed * Math.sin(angle);
            ball.vy = -ballSpeed * Math.cos(angle);
        });
        console.log("Sound: ball speed increased");
    }

    // Board clear check: if all bricks are gone.
    let remainingBricks = bricks.filter(b => b.exists);
    if (remainingBricks.length === 0) {
        // Board cleared: store ball count, clear balls, respawn bricks,
        // then respawn balls one every 0.1 sec.
        let ballCount = breakoutBalls.length;
        breakoutBalls = [];
        initBricks();
        for (let i = 0; i < ballCount; i++) {
            setTimeout(spawnBall, i * 100);
        }
        console.log("Sound: board cleared");
    }

    // Game Over check: if no balls remain.
    if (breakoutBalls.length === 0) {
        gameOver(() => { initBreakout(); });
    }
}

// --- Render ---
function renderBreakout() {
    arcadeState.ctx.clearRect(0, 0, arcadeState.canvas.width, arcadeState.canvas.height);
    const cellW = arcadeState.canvas.width / arcadeState.baseCols;
    const cellH = arcadeState.canvas.height / arcadeState.baseRows;

    // Draw bricks.
    bricks.forEach(brick => {
        if (!brick.exists) return;
        if (typeof brickImg !== "undefined" && brickImg) {
            arcadeState.ctx.drawImage(brickImg, brick.x * cellW, brick.y * cellH, brick.width * cellW, brick.height * cellH);
        } else {
            arcadeState.ctx.fillStyle = 'white';
            arcadeState.ctx.fillRect(brick.x * cellW, brick.y * cellH, brick.width * cellW, brick.height * cellH);
        }
    });

    // Draw paddle (red rectangle).
    arcadeState.ctx.fillStyle = 'red';
    arcadeState.ctx.fillRect(breakoutPaddle.x * cellW, breakoutPaddle.y * cellH, breakoutPaddle.width * cellW, breakoutPaddle.height * cellH);

    // Draw balls.
    breakoutBalls.forEach(ball => {
        if (typeof ballImg !== "undefined" && ballImg) {
            arcadeState.ctx.drawImage(ballImg, ball.x * cellW, ball.y * cellH, ball.width * cellW, ball.height * cellH);
        } else {
            arcadeState.ctx.fillStyle = 'white';
            arcadeState.ctx.beginPath();
            arcadeState.ctx.arc((ball.x + ball.width / 2) * cellW, (ball.y + ball.height / 2) * cellH, (ball.width * cellW) / 2, 0, Math.PI * 2);
            arcadeState.ctx.fill();
        }
    });
}

// --- Paddle Input Handler ---
// Moves the paddle based on horizontal mouse/touch movement.
function handlePaddleInput(e) {
    const rect = arcadeState.canvas.getBoundingClientRect();
    let clientX;
    if (e.type === 'mousemove') {
        clientX = e.clientX;
    } else if (e.type === 'touchmove') {
        e.preventDefault();
        clientX = e.touches[0].clientX;
    }
    const relativeX = clientX - rect.left;
    const arcadeX = (relativeX / arcadeState.canvas.width) * arcadeState.baseCols;
    // Set paddle target so that the paddle's center aligns with arcadeX.
    breakoutPaddle.targetX = arcadeX - breakoutPaddle.width / 2;
    breakoutPaddle.targetX = Math.max(0, Math.min(arcadeState.baseCols - breakoutPaddle.width, breakoutPaddle.targetX));
}

// --- Breakout Mechanics Listener ---
// Listens for breakout-specific mechanic toggles from Firebase.
function listenToBreakoutMechanics() {
    const ref = arcadeState.db.ref('mechanics/breakout');
    ref.off();
    ref.on('value', snap => {
        const val = snap.val() || {};
        // Toggle wider paddle.
        if (typeof val.widerPaddle === 'boolean') {
            widerPaddleActive = val.widerPaddle;
            let newWidth = widerPaddleActive ? 4 : 2;
            breakoutPaddle.width = newWidth;
            breakoutPaddle.x = Math.max(0, Math.min(breakoutPaddle.x, arcadeState.baseCols - newWidth));
            breakoutPaddle.targetX = breakoutPaddle.x;
        }
        // Toggle larger balls.
        if (typeof val.largerBalls === 'boolean') {
            largerBallsActive = val.largerBalls;
            ballSize = largerBallsActive ? 1 : 0.5;
            breakoutBalls.forEach(ball => {
                ball.width = ballSize;
                ball.height = ballSize;
            });
        }
        // Add a ball.
        if (val.addBall) {
            spawnBall();
            // Clear the addBall flag so it doesn’t repeatedly spawn balls.
            arcadeState.db.ref('mechanics/breakout/addBall').set(null);
        }
    });
}

// Export the public API.
export { startBreakout };
