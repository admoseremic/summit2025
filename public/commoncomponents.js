function resetCanvas() {
    document.getElementById('gameCanvas')?.remove();
    document.getElementById('scoreElement')?.remove();
    document.getElementById('highScoreElement')?.remove();
    document.getElementById('tryAgainButton')?.remove();
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
