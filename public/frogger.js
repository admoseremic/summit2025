function startFrogger() {
    const gameContent = document.getElementById('gameContent');
    gameContent.innerHTML = '';
    const square = document.createElement('div');
    square.style.width = '100px';
    square.style.height = '100px';
    square.style.backgroundColor = 'green';
    gameContent.appendChild(square);
}