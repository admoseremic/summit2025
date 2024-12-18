function startFrogger() {
    resetCanvas();

    const canvasContainer = document.getElementById('gameContent');
    const canvas = initializeGameCanvas();
    const ctx = canvas.getContext('2d');
    canvasContainer.appendChild(canvas);

    // New player status
    let isGameOver = false;

    // Scoring variables
    const gridSize = 50;
    let currentScore = 0;
    let highScore = 0;
    let username = localStorage.getItem('username');

    // Create common components
    canvasContainer.appendChild(newScoreContainer());
    scoreContainer.appendChild(newScoreElement());
    scoreContainer.appendChild(newHighScoreElement());

    // Retrieve high score from Firebase
    if (username) {
        let userRef = window.db.ref('attendees');
        userRef.orderByChild('name').equalTo(username).once('value', snapshot => {
            if (snapshot.exists()) {
                let userData = snapshot.val();
                let userId = Object.keys(userData)[0];
                let user = userData[userId];
                highScore = user.frogger || 0;
                highScoreElement.innerText = 'High Score: ' + highScore;
            }
        });
    }

    // Game Variables
    const rows = Math.ceil(canvas.height / gridSize);
    const columns = Math.ceil(canvas.width / gridSize);
    let player = { x: Math.floor(columns / 2), y: rows - 2, onLog: null, drifting: 0 };
    let cameraY = rows * gridSize - canvas.height * 0.25;
    // Starts at 0.5 grid squares/sec
    let cameraSpeed = 0.5;
    let elapsedTime = 0;
    let imagesLoaded = 0;
    const imageAssets = [];
    const imageSources = ['images/frog.png', 'images/car.png', 'images/log.png', 'images/water.png', 'images/road.png'];
    const cars = [];
    const logs = [];
    const rowsData = [];
    let lastUpdate = 0;

    // Image Loading
    function loadAssets(callback) {
        imageSources.forEach((src, index) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                imagesLoaded++;
                if (imagesLoaded === imageSources.length) callback();
            };
            img.onerror = () => console.error("Error loading image: " + src);
            imageAssets[index] = img;
        });
    }

    // Input Handling
    let touchStartX = 0, touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
    });

    window.addEventListener('touchend', (e) => {
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 50) movePlayer('right');
            else if (deltaX < -50) movePlayer('left');
        } else if (deltaY < -50) movePlayer('up');
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') movePlayer('up');
        if (e.key === 'ArrowLeft') movePlayer('left');
        if (e.key === 'ArrowRight') movePlayer('right');
    });

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const playerScreenY = player.y * gridSize - cameraY;

        if (clickY < playerScreenY) movePlayer('up');
        else if (clickX < player.x * gridSize) movePlayer('left');
        else if (clickX > (player.x + 1) * gridSize) movePlayer('right');
    });

    function movePlayer(direction) {
        if (direction === 'up') player.y--;
        if (direction === 'left') player.x = Math.max(0, player.x - 1);
        if (direction === 'right') player.x = Math.min(columns - 1, player.x + 1);
        player.drifting = 0;
    }

    // Game Prefabs
    function createRow(type, frequency) {
        const direction = Math.random() > 0.5 ? 1 : -1;
        const entities = [];
        const spacing = columns / frequency;

        for (let i = 0; i < frequency; i++) {
            entities.push({ x: i * spacing - (direction > 0 ? columns : 0), speed: 0.5 + Math.random() * 0.3, direction });
        }

        rowsData.push({ type, entities, direction });
    }

    function generateRows() {
        let roadWaterCount = 1;
        let nextType = 'road';

        while (rowsData.length < rows + 10) {
            rowsData.push({ type: 'rest', entities: [] });

            for (let i = 0; i < roadWaterCount; i++) {
                createRow(nextType, 3);
            }

            nextType = nextType === 'road' ? 'water' : 'road';
            roadWaterCount++;
        }
    }

    // Game Loop
    function gameLoop(timestamp) {
        const deltaTime = (timestamp - lastUpdate) / 1000;
        lastUpdate = timestamp;
        elapsedTime += deltaTime;

        // Increase camera speed over time
        cameraSpeed = 0.5 + Math.min(0.5, elapsedTime / 30);

        cameraY -= cameraSpeed * gridSize * deltaTime;

        // Update Entities
        player.onLog = null;
        rowsData.forEach((row, index) => {
            if (row.type === 'road' || row.type === 'water') {
                row.entities.forEach(entity => {
                    entity.x += entity.speed * entity.direction * deltaTime;
                    if (entity.x > columns) entity.x = -1;
                    if (entity.x < -1) entity.x = columns;

                    if (row.type === 'road' && Math.abs(entity.x - player.x) < 0.5 && player.y === index) resetGame();
                    if (row.type === 'water' && Math.abs(entity.x - player.x) < 0.5 && player.y === index) player.onLog = entity;
                });
            }
        });

        if (player.onLog) {
            player.drifting += player.onLog.speed * player.onLog.direction * deltaTime;
            player.x += player.drifting;
            if (player.x < 0 || player.x >= columns) resetGame();
        }

        // Camera Boundary Check
        if (player.y * gridSize < cameraY || player.y * gridSize > cameraY + canvas.height) resetGame();

        // Draw
        drawGame();
        requestAnimationFrame(gameLoop);
    }

    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        rowsData.forEach((row, index) => {
            if (row.type === 'road') {
                for (let x = 0; x < columns; x++) {
                    ctx.drawImage(imageAssets[4], x * gridSize, index * gridSize - cameraY, gridSize, gridSize);
                }
                row.entities.forEach(car => {
                    ctx.drawImage(imageAssets[1], car.x * gridSize, index * gridSize - cameraY, gridSize, gridSize);
                });
            } else if (row.type === 'water') {
                for (let x = 0; x < columns; x++) {
                    ctx.drawImage(imageAssets[3], x * gridSize, index * gridSize - cameraY, gridSize, gridSize);
                }
                row.entities.forEach(log => {
                    ctx.drawImage(imageAssets[2], log.x * gridSize, index * gridSize - cameraY, gridSize, gridSize);
                });
            } else {
                for (let x = 0; x < columns; x++) {
                    ctx.fillStyle = "#444";
                    ctx.fillRect(x * gridSize, index * gridSize - cameraY, gridSize, gridSize);
                }
            }
        });

        // Draw Player
        ctx.drawImage(imageAssets[0], player.x * gridSize, player.y * gridSize - cameraY, gridSize, gridSize);
    }

    function resetGame() {
        alert('Game Over!');
        player = { x: Math.floor(columns / 2), y: rows - 2, onLog: null, drifting: 0 };
        rowsData.length = 0;
        generateRows();
        cameraY = rows * gridSize - canvas.height * 0.25;
        elapsedTime = 0;
    }

    // Start the game
    loadAssets(() => {
        generateRows();
        lastUpdate = performance.now();
        requestAnimationFrame(gameLoop);
    });
}
