// spaceinvaders.js

// Function to start Space Invaders
function startSpaceInvaders() {
    // Remove any existing canvas
    const existingCanvas = document.getElementById('gameCanvas');
    if (existingCanvas) {
        existingCanvas.parentNode.removeChild(existingCanvas);
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
    
    // Player object
    const player = {
        x: 0, // Will be set in resizeGame
        y: 0, // Will be set in resizeGame
        width: 30,
        height: 30,
        speed: 5,
        bullets: []
    };

    // Enemy settings (add a speed multiplier)
    let enemies = [];
    const enemyWidth = 30;
    const enemyHeight = 30;
    const enemyPadding = 10;
    const enemyOffsetTop = 30;
    const enemyOffsetLeft = 10;
    let enemyDir = 1;
    let enemySpeed = 1;  // Start slow
    let enemyBullets = [];

    // Control variables
    let isTouching = false;
    let isMouseDown = false;

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
        const enemyCols = Math.floor((canvas.width - enemyOffsetLeft * 2) / (enemyWidth + enemyPadding));
        const enemyRows = 3;
        for (let row = 0; row < enemyRows; row++) {
            for (let col = 0; col < enemyCols; col++) {
                enemies.push({
                    x: col * (enemyWidth + enemyPadding) + enemyOffsetLeft,
                    y: row * (enemyHeight + enemyPadding) + enemyOffsetTop,
                    width: enemyWidth,
                    height: enemyHeight,
                    alive: true
                });
            }
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
        enemyBullets.push({
            x: enemy.x + enemy.width / 2 - 2.5,
            y: enemy.y + enemy.height,
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

        // Recreate enemies
        createEnemies();
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

    // Create enemies initially
    resizeGame();
    createEnemies();

    // Function to update game objects
    function update() {
        if (isGameOver) return;

        // Move enemies
        let shiftDown = false;
        for (let enemy of enemies) {
            if (enemy.alive) {
                enemy.x += enemyDir * enemySpeed;
                if (enemy.x + enemy.width >= canvas.width || enemy.x <= 0) {
                    shiftDown = true;
                }
            }
        }
        if (shiftDown) {
            enemyDir *= -1;
            for (let enemy of enemies) {
                enemy.y += enemyHeight;
            }
            // Increase speed as enemies move down
            enemySpeed += 0.1;
        }

        // Random enemy shooting
        enemies.forEach(enemy => {
            if (enemy.alive && Math.random() < 0.01) {  // Adjust probability to fire
                enemyShoot(enemy);
            }
        });

        // Move bullets (player and enemy)
        player.bullets.forEach(bullet => bullet.y -= bullet.speed);
        enemyBullets.forEach(bullet => bullet.y += bullet.speed);

        // Collision detection for player bullets
        player.bullets.forEach(bullet => {
            enemies.forEach(enemy => {
                if (
                    enemy.alive &&
                    bullet.x < enemy.x + enemy.width &&
                    bullet.x + bullet.width > enemy.x &&
                    bullet.y < enemy.y + enemy.height &&
                    bullet.y + bullet.height > enemy.y
                ) {
                    enemy.alive = false;
                    bullet.y = -10;  // Remove bullet from screen
                }
            });
        });

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
                ctx.fillStyle = 'green';
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
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
            ctx.font = '20px Arial';
            ctx.fillText('?', bullet.x, bullet.y);
        });
    }

    // Game Over function
    function gameOver() {
        isGameOver = true;

        // Clear canvas and show "Game Over"
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '40px Arial';
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

    // Start the game loop
    gameLoop();

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
