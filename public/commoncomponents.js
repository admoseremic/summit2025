function resetCanvas() {
    document.getElementById('gameCanvas')?.remove();
    document.getElementById('scoreElement')?.remove();
    document.getElementById('highScoreElement')?.remove();
    document.getElementById('tryAgainButton')?.remove();
    canvas = createGameCanvas();
    ctx = canvas.getContext('2d');
}

function newScoreContainer() {
    const scoreContainer = document.createElement('div');
    scoreContainer.id = 'scoreContainer';
    scoreContainer.style.position = 'absolute';
    scoreContainer.style.top = '10px';
    scoreContainer.style.left = '0';
    scoreContainer.style.width = '100%';
    scoreContainer.style.display = 'flex';
    scoreContainer.style.justifyContent = 'space-between';
    scoreContainer.style.padding = '0 10px';
    return scoreContainer;
}

function newScoreElement() {
    const scoreElement = document.createElement('div');
    scoreElement.id = 'scoreElement';
    scoreElement.style.color = 'white';
    scoreElement.style.fontFamily = '"Press Start 2P", Arial, sans-serif';
    scoreElement.style.fontSize = '14px';
    scoreElement.innerText = 'Score: 0';
    return scoreElement;
}

function newHighScoreElement() {
    const highScoreElement = document.createElement('div');
    highScoreElement.id = 'highScoreElement';
    highScoreElement.style.color = 'white';
    highScoreElement.style.fontFamily = '"Press Start 2P", Arial, sans-serif';
    highScoreElement.style.fontSize = '14px';
    highScoreElement.innerText = 'High Score: 0';
    return highScoreElement;
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
                updates['/attendees/' + userId + '/' + game] = highScore;
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
    
    stopGame();
    // Show Try Again button
    const tryAgainButton = document.createElement('button');
    tryAgainButton.id = 'tryagain';
    tryAgainButton.innerText = 'Try Again';
    tryAgainButton.style.position = 'absolute';
    tryAgainButton.style.left = '50%';
    tryAgainButton.style.top = '60%';
    tryAgainButton.style.transform = 'translate(-50%, -50%)';
    tryAgainButton.onclick = () => {
        tryAgainButton.remove();
        updateGame(game);
    };
    document.body.appendChild(tryAgainButton);
}

// Function to stop the game
function stopGame() {
    cancelAnimationFrame(animationFrameId);

    const tryAgainButton = document.getElementById('tryagain');
    if(tryAgainButton) {
        tryAgainButton.remove();
    }


    console.log('Game stopped successfully.');
}