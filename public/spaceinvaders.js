// spaceinvaders.js

// Create a simple Space Invaders game implementation
document.addEventListener('DOMContentLoaded', function () {
    const gameContent = document.getElementById('gameContent');
    const gameTitle = document.getElementById('gameTitle');

    // Update the game title
    gameTitle.innerText = 'Space Invaders';

    // Create the start button
    const startButton = document.createElement('button');
    startButton.innerText = 'Start Game';
    startButton.addEventListener('click', startGame);
    gameContent.appendChild(startButton);

    // Create a div for the player's gun station
    const gunStation = document.createElement('div');
    gunStation.style.position = 'absolute';
    gunStation.style.bottom = '20px';
    gunStation.style.left = '50%';
    gunStation.style.width = '50px';
    gunStation.style.height = '20px';
    gunStation.style.backgroundColor = 'black';
    gunStation.style.transform = 'translateX(-50%)';
    gunStation.id = 'gunStation';
    gameContent.appendChild(gunStation);

    // Variables to track game state
    let isGameRunning = false;
    let gunStationPosition = gameContent.clientWidth / 2;

    // Function to start the game
    function startGame() {
        if (!isGameRunning) {
            isGameRunning = true;
            startButton.style.display = 'none';
            gameContent.addEventListener('touchmove', moveGunStation);
            gameContent.addEventListener('touchstart', shootProjectile);
        }
    }

    // Function to move the gun station with touch controls
    function moveGunStation(event) {
        const touch = event.touches[0];
        const touchX = touch.clientX;
        const gameContentBounds = gameContent.getBoundingClientRect();
        gunStationPosition = touchX - gameContentBounds.left;
        updateGunStationPosition();
    }

    // Function to update the position of the gun station on the screen
    function updateGunStationPosition() {
        gunStation.style.left = `${Math.max(0, Math.min(gunStationPosition, gameContent.clientWidth - gunStation.offsetWidth))}px`;
    }

    // Function to shoot a projectile
    function shootProjectile() {
        const projectile = document.createElement('div');
        projectile.style.position = 'absolute';
        projectile.style.bottom = '40px';
        projectile.style.left = `${gunStation.offsetLeft + gunStation.offsetWidth / 2 - 2}px`;
        projectile.style.width = '4px';
        projectile.style.height = '10px';
        projectile.style.backgroundColor = 'red';
        gameContent.appendChild(projectile);

        // Animate the projectile moving upwards
        const interval = setInterval(() => {
            const currentBottom = parseInt(projectile.style.bottom);
            if (currentBottom >= gameContent.clientHeight) {
                clearInterval(interval);
                projectile.remove();
            } else {
                projectile.style.bottom = `${currentBottom + 5}px`;
            }
        }, 20);
    }
});