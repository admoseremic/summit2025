// spaceinvaders.js

// Function to start Space Invaders
function startSpaceInvaders() {
    
    // Remove any existing canvas
    const existingCanvas = document.getElementById('gameCanvas');
    if (existingCanvas) {
        existingCanvas.parentNode.removeChild(existingCanvas);
    }

    // Remove existing score elements if they exist
    const existingScoreElement = document.getElementById('scoreElement');
    if (existingScoreElement) {
        existingScoreElement.parentNode.removeChild(existingScoreElement);
    }

    const existingHighScoreElement = document.getElementById('highScoreElement');
    if (existingHighScoreElement) {
        existingHighScoreElement.parentNode.removeChild(existingHighScoreElement);
    }

    // Remove any existing "Try Again" button
    const existingTryAgainButton = document.getElementById('tryAgainButton');
    if (existingTryAgainButton) {
        existingTryAgainButton.parentNode.removeChild(existingTryAgainButton);
    }

    // Create and append canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const canvasContainer = document.getElementById('gameContent');
    canvasContainer.appendChild(canvas);

    // Get canvas context
    const ctx = canvas.getContext('2d');
    canvas.style.backgroundColor = 'black';

    // New player status
    let isGameOver = false;

    // Scoring variables
    let currentScore = 0;
    let highScore = 0;
    let username = localStorage.getItem('username');

    // Create a container for score elements
    const scoreContainer = document.createElement('div');
    scoreContainer.id = 'scoreContainer';
    scoreContainer.style.position = 'absolute';
    scoreContainer.style.top = '10px';
    scoreContainer.style.left = '0';
    scoreContainer.style.width = '100%';
    scoreContainer.style.display = 'flex';
    scoreContainer.style.justifyContent = 'space-between';
    scoreContainer.style.padding = '0 10px';
    canvasContainer.appendChild(scoreContainer);

    // Create score display
    const scoreElement = document.createElement('div');
    scoreElement.id = 'scoreElement';
    scoreElement.style.color = 'white';
    scoreElement.style.fontFamily = '"Press Start 2P", Arial, sans-serif';
    scoreElement.style.fontSize = '14px'; // Adjust font size as needed
    scoreElement.innerText = 'Score: 0';
    scoreContainer.appendChild(scoreElement);

    // Create high score display
    const highScoreElement = document.createElement('div');
    highScoreElement.id = 'highScoreElement';
    highScoreElement.style.color = 'white';
    highScoreElement.style.fontFamily = '"Press Start 2P", Arial, sans-serif';
    highScoreElement.style.fontSize = '14px'; // Adjust font size as needed
    highScoreElement.innerText = 'High Score: 0'; // Will be updated after retrieval
    scoreContainer.appendChild(highScoreElement);

    // Retrieve high score from Firebase
    if (username) {
        let userRef = window.db.ref('attendees');
        userRef.orderByChild('name').equalTo(username).once('value', snapshot => {
            if (snapshot.exists()) {
                let userData = snapshot.val();
                let userId = Object.keys(userData)[0];
                let user = userData[userId];
                highScore = user.spaceinvaders || 0;
                highScoreElement.innerText = 'High Score: ' + highScore;
            }
        });
    }

    // Player object
    const player = {
        x: 0, // Will be set in resizeGame
        y: 0, // Will be set in resizeGame
        width: 30,
        height: 30,
        speed: 5,
        bullets: []
    };

    // Enemy settings
    let enemies = [];
    const enemyWidth = 50;
    const enemyHeight = 50;
    const enemyPadding = 15;
    const enemyOffsetTop = 30;
    const enemyOffsetLeft = 10;
    let enemyCols;
    let enemyRows = 3; // Start with 3 rows
    let enemyBullets = [];

    // Formation settings
    let formation = {
        x: 0,
        y: 0,
        dir: 1, // Direction: 1 (right), -1 (left)
        speed: 0.5, // Initial speed
        leftBound: 0,
        rightBound: 0
    };

    // Shield settings
    let shields = [];
    const shieldWidth = 60;
    const shieldHeight = 20;
    const shieldColor = 'blue';
    let shieldY;

    // Control variables
    let isTouching = false;
    let isMouseDown = false;

    // Enemy images
    let enemyImages = [];
    let imagesLoaded = 0;

    function loadEnemyImages() {
        const imageSources = [
            'images/si_pm_1.png',
            'images/si_pm_2.png',
            'images/si_marketer_1.png',
            'images/si_marketer_2.png',
            'images/si_eng_1.png',
            'images/si_eng_2.png'
        ];
    
        imageSources.forEach((src, index) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                imagesLoaded++;
                if (imagesLoaded === imageSources.length) {
                    // Start the game loop after all images are loaded
                    gameLoop();
                }
            };
            img.onerror = () => {
                console.error("Error loading image: " + src);
            };
            enemyImages[index] = img;
        });
    }

    // Function to update player position based on input coordinates
    function updatePlayerPosition(clientX) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        player.x = (clientX - rect.left) * scaleX - player.width / 2;
        // Keep player within bounds
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    }

    // Function to create enemies
    function createEnemies() {
        enemies = [];
        enemyCols = Math.floor((canvas.width - enemyOffsetLeft * 2) / (enemyWidth + enemyPadding));
    
        // Set formation initial position
        formation.x = enemyOffsetLeft;
        formation.y = enemyOffsetTop;
    
        // Set movement boundaries
        formation.leftBound = enemyOffsetLeft;
        formation.rightBound = canvas.width - enemyOffsetLeft - (enemyCols * (enemyWidth + enemyPadding)) + enemyPadding;
    
        for (let row = 0; row < enemyRows; row++) {
            for (let col = 0; col < enemyCols; col++) {
                // Assign images based on the row groupings
                let imageIndices;
                if (row >= enemyRows - 2) {
                    // Bottom two rows use si_pm images
                    imageIndices = [0, 1];
                } else if (row >= enemyRows - 4) {
                    // Next two rows use si_marketer images
                    imageIndices = [2, 3];
                } else {
                    // Other rows use placeholder or default images
                    imageIndices = [4, 5]; // Ensure these images are loaded
                }
    
                enemies.push({
                    x: col * (enemyWidth + enemyPadding),
                    y: row * (enemyHeight + enemyPadding),
                    width: enemyWidth,
                    height: enemyHeight,
                    alive: true,
                    row: row,
                    col: col,
                    animationFrames: imageIndices,
                    currentAnimationFrameIndex: 0,
                    frameSwitchCounter: 0
                });
            }
        }
    }

    // Function to create shields
    function createShields() {
        shields = [];
        const numShields = 3;
        const spacing = (canvas.width - numShields * shieldWidth) / (numShields + 1);
        for (let i = 0; i < numShields; i++) {
            shields.push({
                x: spacing + i * (shieldWidth + spacing),
                y: shieldY,
                width: shieldWidth,
                height: shieldHeight,
                health: 3  // Shields can take 3 hits
            });
        }
    }

    // Function to shoot bullets
    function shootBullet() {
        player.bullets.push({
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            width: 5,
            height: 10,
            speed: 7
        });
    }

    // Function for enemies to shoot question marks
    function enemyShoot(enemy) {
        let enemyX = formation.x + enemy.x;
        let enemyY = formation.y + enemy.y;

        enemyBullets.push({
            x: enemyX + enemy.width / 2 - 2.5,
            y: enemyY + enemy.height,  // Start at the bottom of the enemy
            width: 5,
            height: 10,
            speed: 3,
            isQuestionMark: true
        });
    }

    // Function to resize game and canvas dimensions
    function resizeGame() {
        // Update canvas dimensions to match CSS size
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        // Update player position
        player.x = canvas.width / 2 - player.width / 2;
        player.y = canvas.height - player.height - 20;

        // Update shield position
        shieldY = player.y - 100;

        // Recreate enemies
        createEnemies();

        // Recreate shields
        createShields();
    }

    // Event Handlers
    function handleTouchStart(e) {
        e.preventDefault();
        isTouching = true;
        const touch = e.touches[0];
        updatePlayerPosition(touch.clientX);
        // Shoot bullet on touchstart
        shootBullet();
    }

    function handleTouchMove(e) {
        e.preventDefault();
        if (isTouching) {
            const touch = e.touches[0];
            updatePlayerPosition(touch.clientX);
        }
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        isTouching = false;
    }

    function handleMouseDown(e) {
        e.preventDefault();
        isMouseDown = true;
        updatePlayerPosition(e.clientX);
        // Shoot bullet on mousedown
        shootBullet();
    }

    function handleMouseMove(e) {
        if (isMouseDown) {
            updatePlayerPosition(e.clientX);
        }
    }

    function handleMouseUp(e) {
        isMouseDown = false;
    }

    function handleContextMenu(e) {
        e.preventDefault();
    }

    // Touch controls
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Mouse controls
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', handleContextMenu);

    // Listen for window resize and adjust canvas and game elements
    window.addEventListener('resize', resizeGame);

    // Create enemies and shields initially
    resizeGame();
    createEnemies();
    createShields();

    // Function to check if an enemy is on the "bottom row" (no enemies below it)
    function isBottomRowEnemy(enemy) {
        if (!enemy.alive) return false;

        // Check if any enemy directly below is alive
        for (let row = enemy.row + 1; row < enemyRows; row++) {
            // Find the enemy at the same column and the next row
            const belowEnemy = enemies.find(e => e.row === row && e.col === enemy.col && e.alive);
            if (belowEnemy) {
                return false;
            }
        }
        return true;
    }

    
    formation.speed = 0.2;

    // Function to update game objects   
    function update() {
        if (isGameOver) return;

        // Check if all enemies are cleared
        if (enemies.every(enemy => !enemy.alive)) {
            // Increase formation speed slightly
            formation.speed += 0.2;

            // Increase number of rows
            enemyRows += 1;

            // Reset formation direction and position
            formation.dir = 1;
            formation.x = enemyOffsetLeft;
            formation.y = enemyOffsetTop;

            // Recreate enemies
            createEnemies();
        }

        // Move formation
        formation.x += formation.dir * formation.speed;

        if (formation.x <= formation.leftBound || formation.x >= formation.rightBound) {
            formation.dir *= -1;
            formation.y += enemyHeight;

            // Adjust speed increment
            formation.speed = Math.min(formation.speed + 0.01, 1); // Max speed cap
        }

        // Check for game over condition (enemies reach player)
        let lowestEnemyY = 0;
        enemies.forEach(enemy => {
            if (enemy.alive) {
                let enemyBottomY = formation.y + enemy.y + enemy.height;
                if (enemyBottomY > lowestEnemyY) {
                    lowestEnemyY = enemyBottomY;
                }
            }
        });

        if (lowestEnemyY >= player.y) {
            gameOver();
            return;
        }

        // Allow shooting only for bottom row enemies and reduce firing probability
        enemies.forEach(enemy => {
            if (enemy.alive && Math.random() < 0.0025 && isBottomRowEnemy(enemy)) {
                enemyShoot(enemy);
            }
        });

        // Animation frame switching
        enemies.forEach(enemy => {
            if (enemy.alive) {
                enemy.frameSwitchCounter++;
                if (enemy.frameSwitchCounter >= 30) { // Adjust the threshold as needed
                    // Toggle between 0 and 1 in currentAnimationFrameIndex
                    enemy.currentAnimationFrameIndex = (enemy.currentAnimationFrameIndex === 0) ? 1 : 0;
                    enemy.frameSwitchCounter = 0;
                }
            }
        });

        // Move bullets (player and enemy)
        player.bullets.forEach(bullet => bullet.y -= bullet.speed);
        enemyBullets.forEach(bullet => bullet.y += bullet.speed);

        // Collision detection for player bullets
        player.bullets.forEach(bullet => {
            enemies.forEach(enemy => {
                if (enemy.alive) {
                    let enemyX = formation.x + enemy.x;
                    let enemyY = formation.y + enemy.y;

                    if (
                        bullet.x < enemyX + enemy.width &&
                        bullet.x + bullet.width > enemyX &&
                        bullet.y < enemyY + enemy.height &&
                        bullet.y + bullet.height > enemyY
                    ) {
                        enemy.alive = false;
                        bullet.y = -10;  // Remove bullet from screen
                    
                        // Update the score
                        currentScore += 10;
                        scoreElement.innerText = 'Score: ' + currentScore;
                    
                        // Check for new high score
                        if (currentScore > highScore) {
                            highScore = currentScore;
                            highScoreElement.innerText = 'High Score: ' + highScore;
                        }
                    }
                }
            });
        });

        // Collision detection for enemy bullets hitting shields
        enemyBullets.forEach(bullet => {
            shields.forEach(shield => {
                if (
                    bullet.x < shield.x + shield.width &&
                    bullet.x + bullet.width > shield.x &&
                    bullet.y < shield.y + shield.height &&
                    bullet.y + bullet.height > shield.y
                ) {
                    // Shield is hit
                    shield.health -= 1;
                    bullet.y = canvas.height + 10;  // Remove bullet from screen
                }
            });
        });

        // Collision detection for player bullets hitting shields
        player.bullets.forEach(bullet => {
            shields.forEach(shield => {
                if (
                    bullet.x < shield.x + shield.width &&
                    bullet.x + bullet.width > shield.x &&
                    bullet.y < shield.y + shield.height &&
                    bullet.y + bullet.height > shield.y
                ) {
                    // Shield is hit
                    shield.health -= 1;
                    bullet.y = -10;  // Remove bullet from screen
                }
            });
        });

        // Remove shields that are destroyed
        shields = shields.filter(shield => shield.health > 0);

        // Collision detection for enemy bullets (hitting the player)
        enemyBullets.forEach(bullet => {
            if (
                bullet.x < player.x + player.width &&
                bullet.x + bullet.width > player.x &&
                bullet.y < player.y + player.height &&
                bullet.y + bullet.height > player.y
            ) {
                // Player hit, game over
                gameOver();
            }
        });

        // Remove off-screen bullets
        player.bullets = player.bullets.filter(bullet => bullet.y > -bullet.height);
        enemyBullets = enemyBullets.filter(bullet => bullet.y < canvas.height);
    }

    // Function to render game objects
    function render() {
        if (isGameOver) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw player
        ctx.fillStyle = 'white';
        ctx.fillRect(player.x, player.y, player.width, player.height);

        // Draw enemies
        enemies.forEach(enemy => {
            if (enemy.alive) {
                let enemyX = formation.x + enemy.x;
                let enemyY = formation.y + enemy.y;

                // Get the current frame index for this enemy
                let frameIndex = enemy.animationFrames[enemy.currentAnimationFrameIndex];

                // Check if image exists before drawing it
                if (enemyImages[frameIndex]) {
                    ctx.drawImage(enemyImages[frameIndex], enemyX, enemyY, enemy.width, enemy.height);
                } else {
                    console.error('Image not found for frame:', frameIndex);
                    // Optional: Draw a placeholder
                    ctx.fillStyle = 'gray';
                    ctx.fillRect(enemyX, enemyY, enemy.width, enemy.height);
                }
            }
        });

        // Draw player bullets
        player.bullets.forEach(bullet => {
            ctx.fillStyle = 'red';
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });

        // Draw enemy bullets (question marks)
        enemyBullets.forEach(bullet => {
            ctx.fillStyle = 'yellow';
            ctx.font = '20px "Press Start 2P"';
            ctx.fillText('?', bullet.x, bullet.y);
        });

        // Draw shields
        shields.forEach(shield => {
            ctx.fillStyle = shieldColor;
            ctx.fillRect(shield.x, shield.y, shield.width, shield.height);
        });
    }

    // Game Over function
    function gameOver() {
        isGameOver = true;

        // Update high score in Firebase if currentScore is greater
        if (username && currentScore >= highScore) {
            let userRef = window.db.ref('attendees');

            userRef.orderByChild('name').equalTo(username).once('value', snapshot => {
                if (snapshot.exists()) {
                    let userData = snapshot.val();
                    let userId = Object.keys(userData)[0]; // Get the user's unique ID

                    // Update the high score
                    let updates = {};
                    updates['/attendees/' + userId + '/spaceinvaders'] = highScore;
                    window.db.ref().update(updates);
                }
            });
        }

        // Clear canvas and show "Game Over"
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '40px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 20);

        // Show Try Again button
        const tryAgainButton = document.createElement('button');
        tryAgainButton.innerText = 'Try Again';
        tryAgainButton.style.position = 'absolute';
        tryAgainButton.style.left = '50%';
        tryAgainButton.style.top = '60%';
        tryAgainButton.style.transform = 'translate(-50%, -50%)';
        tryAgainButton.onclick = () => {
            tryAgainButton.remove();
            startSpaceInvaders();
        };
        document.body.appendChild(tryAgainButton);
    }

    // Game loop
    let animationFrameId;
    function gameLoop() {
        update();
        render();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // Start loading images and game loop
    loadEnemyImages();

    // Function to stop the game
    function stopGame() {
        // Cancel the animation frame
        cancelAnimationFrame(animationFrameId);

        // Remove event listeners
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('contextmenu', handleContextMenu);

        // Remove window resize listener
        window.removeEventListener('resize', resizeGame);

        // Remove the canvas from the DOM
        if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }

        console.log('Space Invaders stopped successfully.');
    }

    // Expose stopGame globally
    window.stopGame = stopGame;
}
