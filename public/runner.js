function startRunner() {
    const gameContent = document.getElementById('gameContent');
    gameContent.innerHTML = '';

    // Create a canvas dynamically and append it to gameContent
    const canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    canvasContainer.appendChild(canvas);

    // Select the most common mobile screen ratio (9:16 for vertical orientation)
    const GAME_RATIO = 9 / 16;

    // Get the canvas and context
    const ctx = canvas.getContext('2d');

    function setupCanvas() {
        // Get the window dimensions
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Determine the maximum size the canvas can be while maintaining the ratio
        const windowRatio = windowWidth / windowHeight;
        if (windowRatio > GAME_RATIO) {
            // Window is wider than our ratio
            canvas.height = windowHeight;
            canvas.width = windowHeight * GAME_RATIO;
        } else {
            // Window is taller or equal to our ratio
            canvas.width = windowWidth;
            canvas.height = windowWidth / GAME_RATIO;
        }

        // Center the canvas by adding black bars (if necessary)
        canvas.style.marginTop = `${(windowHeight - canvas.height) / 2}px`;
        canvas.style.marginLeft = `${(windowWidth - canvas.width) / 2}px`;
        canvas.style.display = 'block';

        // Set the canvas background to blue
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Set up the canvas on game start
    setupCanvas();
}
