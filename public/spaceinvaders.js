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
    const enemyWidth = 30;
    const enemyHeight = 30;
    const enemyPadding = 10;
    const enemyOffsetTop = 30;
    const enemyOffsetLeft = 10;
    let enemyDir = 1;

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
        // Move enemies
        let shiftDown = false;
        for (let enemy of enemies) {
            if (enemy.alive) {
                enemy.x += enemyDir * 1;
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
        }

        // Move bullets
        for (let bullet of player.bullets) {
            bullet.y -= bullet.speed;
        }

        // Collision detection
        for (let bullet of player.bullets) {
            for (let enemy of enemies) {
                if (
                    enemy.alive &&
                    bullet.x < enemy.x + enemy.width &&
                    bullet.x + bullet.width > enemy.x &&
                    bullet.y < enemy.y + enemy.height &&
                    bullet.y + bullet.height > enemy.y
                ) {
                    enemy.alive = false;
                    bullet.y = -10; // Remove bullet from screen
                }
            }
        }

        // Remove off-screen bullets
        player.bullets = player.bullets.filter(bullet => bullet.y > -bullet.height);
    }

    // Function to render game objects
    function render() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw player
        ctx.fillStyle = 'white';
        ctx.fillRect(player.x, player.y, player.width, player.height);

        // Draw enemies
        for (let enemy of enemies) {
            if (enemy.alive) {
                ctx.fillStyle = 'green';
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            }
        }

        // Draw bullets
        for (let bullet of player.bullets) {
            ctx.fillStyle = 'red';
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        }
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
