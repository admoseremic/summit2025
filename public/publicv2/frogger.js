// frogger.js
// Placeholder for the Frogger game.
// Assumes that arcadeCore.js has already created globals such as
//   canvas, ctx, and functions showTitleScreen() and hideTitleScreen().

function startFrogger() {
    // Show a title screen (optional) on first load, then clear the canvas and display a message.
    showTitleScreen('Frogger', () => {
        hideTitleScreen();
        // Clear the canvas.
        arcadeState.ctx.clearRect(0, 0, arcadeState.canvas.width, arcadeState.canvas.height);
        // Draw placeholder text.
        arcadeState.ctx.fillStyle = 'white';
        arcadeState.ctx.font = '30px "Press Start 2P"';
        arcadeState.ctx.textAlign = 'center';
        arcadeState.ctx.fillText('Frogger - Coming Soon!', arcadeState.canvas.width / 2, arcadeState.canvas.height / 2);
    });
}

export { startFrogger };