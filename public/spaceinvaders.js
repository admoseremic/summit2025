// Function to start Space Invaders
function startSpaceInvaders() {
    // Add canvas to gameContent
    const canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';

    const canvasContainer = document.getElementById('gameContent');
    canvasContainer.appendChild(canvas);

    // Set initial canvas size
    setCanvasSize(canvas);

    // Get canvas and context
    const ctx = canvas.getContext('2d');

    // Set background color to black
    canvas.style.backgroundColor = 'black';

    // Player object
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

    // Create enemies initially
    createEnemies();

    // Control variables
    let isTouching = false;
    let isMouseDown = false;

    // Touch controls
    canvas.addEventListener('touchstart', (e) => {
        isTouching = true;
        const touch = e.touches[0];
        player.x = touch.clientX - canvas.offsetLeft - player.width / 2;

        // Shoot bullet on touchstart
        shootBullet();
    });

    canvas.addEventListener('touchmove', (e) => {
        if (isTouching) {
            const touch = e.touches[0];
            player.x = touch.clientX - canvas.offsetLeft - player.width / 2;
        }
    });

    canvas.addEventListener('touchend', () => {
        isTouching = false;
    });

    // Mouse controls
    canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        player.x = e.clientX - canvas.offsetLeft - player.width / 2;

        // Shoot bullet on mousedown
        shootBullet();
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isMouseDown) {
            player.x = e.clientX - canvas.offsetLeft - player.width / 2;
        }
    });

    canvas.addEventListener('mouseup', () => {
        isMouseDown = false;
    });

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Listen for window resize and adjust canvas and game elements
    window.addEventListener('resize', () => {
        setCanvasSize(canvas);
        createEnemies(); // Recreate enemies based on the new size
        player.x = Math.min(player.x, canvas.width - player.width); // Ensure player stays within bounds
    });

    // Function to set canvas size
    function setCanvasSize(canvas) {
        canvas.width = Math.min(window.innerWidth * 0.9, 600); // Limit max width to 600px
        canvas.height = Math.min(window.innerHeight * 0.5, 400); // Limit max height to 400px
    }

    // Function to create enemies
    function createEnemies() {
        enemies = [];
        const enemyCols = Math.floor((canvas.width - enemyOffsetLeft * 2) / (enemyWidth + enemyPadding));
        for (let row = 0; row < 3; row++) {
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
    function gameLoop() {
        update();
        render();
        requestAnimationFrame(gameLoop);
    }

    // Update game objects
    function update() {
        // Move enemies
        let shiftDown = false;
        for (let enemy of enemies) {
            if (enemy.alive) {
                enemy.x += enemyDir * 1;
                if (enemy.x + enemy.width > canvas.width || enemy.x < 0) {
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

        // Keep player within canvas bounds
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
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

    // Start the game loop
    gameLoop();
}