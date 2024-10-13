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

    const canvasContainer = document.getElementById('gameContent');
    canvasContainer.appendChild(canvas);

    // Get canvas context
    const ctx = canvas.getContext('2d');
    canvas.style.backgroundColor = 'black';

    // Player object (Moved before resizeGame call)
    const player = {
        x: canvas.width / 2 - 15,
        y: canvas.height - 50,
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

    // Set canvas dimensions to match its CSS size
    resizeGame();

    // Create enemies initially (Moved after resizeGame call)
    createEnemies();

    // Touch controls
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isTouching = true;
        const touch = e.touches[0];
        updatePlayerPosition(touch.clientX);
        // Shoot bullet on touchstart
        shootBullet();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isTouching) {
            const touch = e.touches[0];
            updatePlayerPosition(touch.clientX);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        isTouching = false;
    }, { passive: false });

    // Mouse controls
    canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isMouseDown = true;
        updatePlayerPosition(e.clientX);
        // Shoot bullet on mousedown
        shootBullet();
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isMouseDown) {
            updatePlayerPosition(e.clientX);
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        isMouseDown = false;
    });

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Listen for window resize and adjust canvas and game elements
    window.addEventListener('resize', resizeGame);

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

    // Game loop
    let animationFrameId;
    function gameLoop() {
        update();
        render();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // Update game objects
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

    // Render game objects
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

    // Function to resize game and canvas dimensions
    function resizeGame() {
        // Update canvas dimensions to match CSS size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Update player position
        player.x = canvas.width / 2 - player.width / 2;
        player.y = canvas.height - player.height - 20;

        // Recreate enemies
        createEnemies();
    }

    // Start the game loop
    gameLoop();

    // Clean up when the game is stopped or the user navigates away
    function stopGame() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeGame);
        // Remove other event listeners if necessary
    }
}
