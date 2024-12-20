function startFrogger() {
    resetCanvas();
    isGameOver = false;

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
    const rows = Math.ceil(canvas.height / scale);
    const columns = Math.ceil(canvas.width / scale);
    let player = { x: 4, y: 10, onLog: null, drifting: 0 };
    console.log("Player: "+ player.x + " x " + player.y);
    let cameraY = rows * scale - canvas.height * 0.25;
    let cameraSpeed = 0.5; // Starts at 0.5 grid squares/sec
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

    window.addEventListener('click', () => movePlayer('up'));

    function movePlayer(direction) {
        if (direction === 'up') player.y--;
        if (direction === 'left') player.x = Math.max(0, player.x - 1);
        if (direction === 'right') player.x = Math.min(columns - 1, player.x + 1);
        player.drifting = 0;
    }

    // Game Prefabs
    function createRow(type, frequency, direction, speed) {
        const entities = [];
        const spacing = columns / frequency;

        for (let i = 0; i < frequency; i++) {
            entities.push({ x: i * spacing - (direction > 0 ? columns : 0), speed, direction });
        }

        rowsData.unshift({ type, entities, direction });
    }

    function generateRows() {
        let roadWaterCount = 1;
        let nextType = 'road';
        let groupSize = 1;
        let lastDirection = 1; // Start with rightward movement

        while (rowsData.length < rows + 10) {
            rowsData.unshift({ type: 'rest', entities: [] });

            for (let i = 0; i < groupSize; i++) {
                const frequency = nextType === 'road' ? 3 + Math.floor(elapsedTime / 20) : 3 - Math.floor(elapsedTime / 20);
                const speed = 0.5 + (Math.random() * 0.1 - 0.05);
                createRow(nextType, Math.max(1, frequency), lastDirection, speed);
                lastDirection *= -1; // Alternate direction
            }

            nextType = nextType === 'road' ? 'water' : 'road';
            if (nextType === 'road') groupSize++;
        }
    }



    // Game Loop
    function gameLoop(timestamp) {

        if (isGameOver) return;
        const deltaTime = (timestamp - lastUpdate) / 1000;
        lastUpdate = timestamp;
        elapsedTime += deltaTime;

        // Increase camera speed over time
        cameraSpeed = 0.5 + Math.min(0.5, elapsedTime / 30);

        cameraY -= cameraSpeed * scale * deltaTime;

        // Update Entities
        player.onLog = null;
        rowsData.forEach((row, index) => {
            if (row.type === 'road' || row.type === 'water') {
                row.entities.forEach(entity => {
                    entity.x += entity.speed * entity.direction * deltaTime;
                    if (entity.x > columns) entity.x = -1;
                    if (entity.x < -1) entity.x = columns;

                    if (row.type === 'road' && Math.abs(entity.x - player.x) < 0.5 && player.y === index) gameOver();
                    if (row.type === 'water' && Math.abs(entity.x - player.x) < 0.5 && player.y === index) player.onLog = entity;
                });
            }
        });

        if (player.onLog) {
            player.drifting += player.onLog.speed * player.onLog.direction * deltaTime;
            player.x += player.drifting;
            if (player.x < 0 || player.x >= columns) gameOver();
        }

        // Camera Boundary Check
        if (player.y * scale < cameraY || player.y * scale > cameraY + canvas.height) gameOver();

        // Draw
        drawGame();
        generateRows(); // Ensure rows are continuously generated
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        rowsData.forEach((row, index) => {
            if (row.type === 'road') {
                for (let x = 0; x < columns; x++) {
                    ctx.drawImage(imageAssets[4], x * scale, index * scale - cameraY, scale, scale);
                }
                row.entities.forEach(car => {
                    ctx.drawImage(imageAssets[1], car.x * scale, index * scale - cameraY, scale, scale);
                });
            } else if (row.type === 'water') {
                for (let x = 0; x < columns; x++) {
                    ctx.drawImage(imageAssets[3], x * scale, index * scale - cameraY, scale, scale);
                }
                row.entities.forEach(log => {
                    ctx.drawImage(imageAssets[2], log.x * scale, index * scale - cameraY, scale, scale);
                });
            } else {
                for (let x = 0; x < columns; x++) {
                    ctx.fillStyle = "#444";
                    ctx.fillRect(x * scale, index * scale - cameraY, scale, scale);
                }
            }
        });

        // Draw Player
        ctx.drawImage(imageAssets[0], player.x * scale, player.y * scale - cameraY, scale, scale);
    }

    // Start the game
    loadAssets(() => {
        generateRows();
        lastUpdate = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
    });
}
