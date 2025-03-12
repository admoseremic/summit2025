// arcadeCore.js
// Import each game’s start function.
import { startTestGame } from './testgame.js';
import { startFrogger } from './frogger.js';
import { startBreakout } from './breakout.js';
import { startRunner } from './runner.js';
import { startSpaceInvaders } from './spaceinvaders.js';
import { showScoreScreen } from './showScore.js';

// Create an AudioContext (with vendor prefix fallback)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Utility function to load and decode a sound file.
async function loadSound(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

// Instantiate arcadeState with a sounds object that will store AudioBuffers.
const arcadeState = {
  isGameOver: false,
  currentScore: 0,
  highScore: 0,
  game: '',
  animationFrameId: null,
  db: null,
  username: '',
  canvas: null,
  ctx: null,
  baseCols: 9,
  baseRows: 16,
  scoreElement: null,
  highScoreElement: null,
  audioContext: audioContext,
  sounds: {},
  images: {
    ship: new Image(),
    enemy1: new Image(),
    ball: new Image(),
    frog: new Image(),
    truck1: new Image(),
    truck2: new Image(),
    skinnyLog: new Image(),
  }
};

// Preload all sounds.
Promise.all([
  loadSound('sounds/ball-brick.mp3').then(buffer => arcadeState.sounds.ballBrick = buffer),
  loadSound('sounds/ball-fall.mp3').then(buffer => arcadeState.sounds.ballFall = buffer),
  loadSound('sounds/ball-paddle.mp3').then(buffer => arcadeState.sounds.ballPaddle = buffer),
  loadSound('sounds/frog-jump.mp3').then(buffer => arcadeState.sounds.frogJump = buffer),
  loadSound('sounds/ship-explode.mp3').then(buffer => arcadeState.sounds.shipExplode = buffer),
  loadSound('sounds/fire.mp3').then(buffer => arcadeState.sounds.shipFire = buffer),
  loadSound('sounds/game-over.mp3').then(buffer => arcadeState.sounds.gameOver = buffer),
  loadSound('sounds/runner-jump.mp3').then(buffer => arcadeState.sounds.runnerJump = buffer),
  loadSound('sounds/runner-coin.mp3').then(buffer => arcadeState.sounds.runnerCoin = buffer),
  loadSound('sounds/invader-drop.mp3').then(buffer => arcadeState.sounds.invaderDrop = buffer),
  loadSound('sounds/invader-ded.mp3').then(buffer => arcadeState.sounds.invaderDead = buffer),
  loadSound('sounds/invader-ded2.mp3').then(buffer => arcadeState.sounds.invaderDead2 = buffer),
  loadSound('sounds/invader-fire.mp3').then(buffer => arcadeState.sounds.invaderFire = buffer),
  loadSound('sounds/invader-respawn.mp3').then(buffer => arcadeState.sounds.invaderRespawn = buffer)
]);

// Function to play a sound given its AudioBuffer.
function playSound(audioBuffer) {
  // Create a new source for each playback.
  const source = arcadeState.audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(arcadeState.audioContext.destination);
  source.start(0);
}
arcadeState.playSound = playSound;

arcadeState.images.ship.src = 'images/ship.png';
arcadeState.images.enemy1.src = 'images/si_pm_1.png';
arcadeState.images.ball.src = 'images/ball.png';
arcadeState.images.frog.src = 'images/frog.png';
arcadeState.images.skinnyLog.src = 'images/log-skinny.png';
arcadeState.images.truck1.src = 'images/car1.png';
arcadeState.images.truck2.src = 'images/car2.png';

window.arcadeState = arcadeState;

const ASPECT_RATIO = 9 / 16;

/*************************************************************
 * STOP GAME
 *************************************************************/
function stopGame() {
  if (arcadeState.animationFrameId) {
    cancelAnimationFrame(arcadeState.animationFrameId);
  }
}

/*************************************************************
 * UNIVERSAL GAME OVER
 * 1) Updates high score if needed
 * 2) Shows "Game Over" text
 * 3) Retro-themed "Try Again" button, calls restartCallback
 *************************************************************/
function gameOver(restartCallback) {
  arcadeState.isGameOver = true;
  arcadeState.playSound(arcadeState.sounds.gameOver);
  stopGame();

  // Use greater-than-or-equal-to check for ties
  submitCurrentScore();

  arcadeState.ctx.clearRect(0, 0, arcadeState.canvas.width, arcadeState.canvas.height);
  arcadeState.ctx.fillStyle = 'white';
  arcadeState.ctx.font = '40px "Press Start 2P"';
  arcadeState.ctx.textAlign = 'center';
  arcadeState.ctx.fillText('Game Over', arcadeState.canvas.width / 2, arcadeState.canvas.height / 2 - 20);

  const tryAgainButton = document.createElement('button');
  tryAgainButton.id = 'tryagain';
  tryAgainButton.innerText = 'Try Again';
  Object.assign(tryAgainButton.style, {
    position: 'absolute',
    left: '50%',
    top: '60%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#000',
    color: '#fff',
    fontFamily: '"Press Start 2P", monospace, sans-serif',
    fontSize: '16px',
    padding: '10px 20px',
    border: '4px solid white',
    cursor: 'pointer',
    zIndex: 9999
  });

  tryAgainButton.onclick = () => {
    document.body.removeChild(tryAgainButton);
    restartCallback();
  };

  document.body.appendChild(tryAgainButton);
}

/*************************************************************
 * loadGame(gameName)
 * Called when 'currentGame' changes or on initial load
 *************************************************************/
export function loadGame(gameName) {
  console.log("Switching to game:", gameName);
  clearGame();
  // Reset common state.
  arcadeState.currentScore = 0;
  const storedHigh = localStorage.getItem('highScore_' + gameName);
  arcadeState.highScore = storedHigh ? parseInt(storedHigh, 10) : 0;
  arcadeState.isGameOver = false;
  arcadeState.game = gameName;

  // Retrieve high score for the selected game.
  if (arcadeState.username) {
    let userRef = arcadeState.db.ref('attendees');
    userRef.orderByChild('name').equalTo(arcadeState.username).once('value', snapshot => {
      if (snapshot.exists()) {
        let userData = snapshot.val();
        let userId = Object.keys(userData)[0];
        let user = userData[userId];
        switch (gameName) {
          case "testgame":
            arcadeState.highScore = user.frogger || 0;
            break;
          case "breakout":
            arcadeState.highScore = user.breakout || 0;
            break;
          case "frogger":
            arcadeState.highScore = user.frogger || 0;
            break;
          case "spaceinvaders":
            arcadeState.highScore = user.spaceinvaders || 0;
            break;
          case "runner":
            arcadeState.highScore = user.runner || 0;
            break;
          default:
            arcadeState.highScore = 0;
        }
        if (arcadeState.highScoreElement) {
          arcadeState.highScoreElement.innerText = 'High Score: ' + arcadeState.highScore;
        }
      }
    });
  }
  // Call the appropriate game start function.
  switch (gameName) {
    case "spaceinvaders":
      startSpaceInvaders();
      break;
    case "frogger":
      startFrogger();
      break;
    case "breakout":
      startBreakout();
      break;
    case "runner":
      startRunner();
      break;
    case "testgame":
      startTestGame();
      break;
    case "showScore":
      showScoreScreen();
      break;
    default:
      console.error("Unknown game:", gameName);
  }
}

function clearGame() {
  // Stop any running animation frames.
  stopGame();

  // Remove the "Try Again" button if it exists.
  const tryAgainButton = document.getElementById('tryagain');
  if (tryAgainButton) {
    tryAgainButton.remove();
  }

  // Remove the title overlay if it exists.
  const titleOverlay = document.getElementById('titleOverlay');
  if (titleOverlay) {
    titleOverlay.remove();
  }

  // Clear the game container so that no remnants of the previous game remain.
  const container = document.getElementById('gameContent');
  container.innerHTML = '';

  // Rebuild the canvas and scoreboard.
  setupCanvas();
  createScoreboardElements();
}

/*************************************************************
 * Canvas / Scoreboard Setup
 *************************************************************/
function setupCanvas() {
  const container = document.getElementById('gameContent');
  container.innerHTML = '';

  // Create a wrapper div to hold the canvas and to provide padding
  const wrapper = document.createElement('div');
  wrapper.id = "gameWrapper";
  // Make sure the wrapper is centered and has padding (4px on all sides)
  wrapper.style.position = "relative";
  wrapper.style.padding = "4px"; // this extra padding ensures the border isn't clipped
  wrapper.style.margin = "auto"; // center the wrapper
  container.appendChild(wrapper);

  arcadeState.canvas = document.createElement('canvas');
  arcadeState.canvas.id = 'gameCanvas';
  // The white border will now be fully visible because the wrapper provides space
  arcadeState.canvas.style.border = '4px solid white';
  wrapper.appendChild(arcadeState.canvas);

  arcadeState.ctx = arcadeState.canvas.getContext('2d');

  function resize() {
    // Subtract the wrapper’s total padding (8px) from the available width/height
    const availableWidth = window.innerWidth - 8;
    const availableHeight = window.innerHeight - 8;
    const ratio = availableWidth / availableHeight;

    if (ratio > ASPECT_RATIO) {
      arcadeState.canvas.height = availableHeight;
      arcadeState.canvas.width = availableHeight * ASPECT_RATIO;
    } else {
      arcadeState.canvas.width = availableWidth;
      arcadeState.canvas.height = availableWidth / ASPECT_RATIO;
    }
  }
  window.addEventListener('resize', resize);
  resize();
}

function resizeCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ratio = w / h;

  if (ratio > ASPECT_RATIO) {
    arcadeState.canvas.height = h;
    arcadeState.canvas.width = h * ASPECT_RATIO;
  } else {
    arcadeState.canvas.width = w;
    arcadeState.canvas.height = w / ASPECT_RATIO;
  }
}

function createScoreboardElements() {
  // Get the game wrapper (created in setupCanvas)
  const wrapper = document.getElementById('gameWrapper');
  if (!wrapper) {
    console.error("Game wrapper not found.");
    return;
  }
  if (document.getElementById('scoreContainer')) return;

  const scoreContainer = document.createElement('div');
  scoreContainer.id = 'scoreContainer';
  // Position the scoreboard relative to the wrapper
  Object.assign(scoreContainer.style, {
    position: 'absolute',
    top: '10px',
    left: '10px',
    right: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    pointerEvents: 'none'
  });

  arcadeState.scoreElement = document.createElement('div');
  arcadeState.scoreElement.id = 'scoreElement';
  arcadeState.scoreElement.innerText = 'Score: 0';
  styleScoreElement(arcadeState.scoreElement);

  arcadeState.highScoreElement = document.createElement('div');
  arcadeState.highScoreElement.id = 'highScoreElement';
  arcadeState.highScoreElement.innerText = 'High Score: 0';
  styleScoreElement(arcadeState.highScoreElement);

  scoreContainer.appendChild(arcadeState.scoreElement);
  scoreContainer.appendChild(arcadeState.highScoreElement);
  // Append the scoreboard inside the wrapper so it overlays the canvas
  wrapper.appendChild(scoreContainer);

  // After the scoreboard elements are created (e.g., in createScoreboardElements)
  const scoreObserver = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        // Extract the numeric score from the score element's text.
        // Assuming the format is "Score: 100"
        const scoreText = arcadeState.scoreElement.innerText;
        const currentScore = parseInt(scoreText.replace('Score: ', ''), 10);

        // Compare with the stored high score and update if necessary.
        if (currentScore > arcadeState.highScore) {
          arcadeState.highScore = currentScore;
          arcadeState.highScoreElement.innerText = 'High Score: ' + currentScore;
        }
      }
    }
  });

  // Configure the observer to listen for changes to the child nodes.
  const observerConfig = { childList: true };

  // Start observing the score element.
  scoreObserver.observe(arcadeState.scoreElement, observerConfig);

}

function styleScoreElement(el) {
  el.style.color = 'white';
  el.style.fontFamily = '"Press Start 2P", Arial, sans-serif';
  el.style.fontSize = '14px';
  el.style.pointerEvents = 'none';
}

/*************************************************************
 * Initialize Arcade (Called on page load)
 *************************************************************/
function initArcade() {
  fetch('https://us-central1-summit-games-a1f9f.cloudfunctions.net/getApiKey')
    .then(resp => resp.json())
    .then(data => {
      const config = {
        apiKey: data.apiKey,
        authDomain: "summit-games-a1f9f.firebaseapp.com",
        databaseURL: "https://summit-games-a1f9f-default-rtdb.firebaseio.com/",
        projectId: "summit-games-a1f9f",
        storageBucket: "summit-games-a1f9f.appspot.com",
        messagingSenderId: "441105165656",
        appId: "1:441105165656:web:277897c92f13365a98092d"
      };
      firebase.initializeApp(config);
      arcadeState.db = firebase.database();

      // Check for stored user ID and username
      let storedUserId = localStorage.getItem('userId');
      let storedUsername = localStorage.getItem('username');
      if (!storedUserId || !storedUsername) {
        // Prompt for username if missing
        promptForUsername((name) => {
          // Create a new attendee entry in Firebase
          let newUserRef = arcadeState.db.ref('attendees').push();
          newUserRef.set({
            name: name,
            breakout: 0,
            runner: 0,
            spaceinvaders: 0,
            frogger: 0
          })
            .then(() => {
              localStorage.setItem('userId', newUserRef.key);
              localStorage.setItem('username', name);
              arcadeState.username = name;
              arcadeState.userId = newUserRef.key;
              // Proceed with the rest of initialization
              setupCanvas();
              createScoreboardElements();
              listenForGameChanges();
            })
            .catch(error => console.error('Error creating attendee entry:', error));
        });
      } else {
        arcadeState.username = storedUsername;
        arcadeState.userId = storedUserId;
        setupCanvas();
        createScoreboardElements();
        listenForGameChanges();
      }
    })
    .catch(err => console.error("Error fetching Firebase config:", err));
}

function listenForGameChanges() {
  const gameRef = arcadeState.db.ref('currentGame');
  gameRef.on('value', snapshot => {
    stopGame();
    const newGame = snapshot.val() || 'testgame';
    submitCurrentScore()
      .then(() => {
        loadGame(newGame);
      })
      .catch(err => {
        console.error("Error submitting score:", err);
        loadGame(newGame);
      });
  });
}


function showTitleScreen(title, onStart) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999
  });
  overlay.id = 'titleOverlay';

  const h1 = document.createElement('h1');
  h1.innerText = title;
  h1.style.color = 'white';
  h1.style.textAlign = 'center';
  h1.style.whiteSpace = 'pre-line';
  h1.style.lineHeight = '1.5';

  const startBtn = document.createElement('button');
  startBtn.innerText = 'Start';
  Object.assign(startBtn.style, {
    fontFamily: '"Press Start 2P", sans-serif',
    fontSize: '16px',
    padding: '10px 20px',
    border: '4px solid white',
    cursor: 'pointer',
    backgroundColor: '#000',
    color: '#fff',
    marginTop: '20px'
  });
  startBtn.onclick = () => {
    document.body.removeChild(overlay);
    if (onStart) onStart();
  };

  overlay.appendChild(h1);
  overlay.appendChild(startBtn);
  document.body.appendChild(overlay);
}

function hideTitleScreen() {
  const overlay = document.getElementById('titleOverlay');
  if (overlay) {
    document.body.removeChild(overlay);
  }
}

function promptForUsername(callback) {
  const overlay = document.createElement('div');
  overlay.id = 'usernameOverlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000
  });

  const label = document.createElement('label');
  label.innerText = "Enter your username to play:";
  label.style.color = 'white';
  label.style.fontFamily = '"Press Start 2P", sans-serif';
  label.style.fontSize = '16px';
  label.style.marginBottom = '20px';
  overlay.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  Object.assign(input.style, {
    fontSize: '16px',
    padding: '10px',
    border: '2px solid white',
    backgroundColor: '#333',
    color: 'white',
    fontFamily: '"Press Start 2P", sans-serif',
    textAlign: 'center'
  });
  overlay.appendChild(input);

  const button = document.createElement('button');
  button.innerText = "Submit";
  Object.assign(button.style, {
    marginTop: '20px',
    fontFamily: '"Press Start 2P", sans-serif',
    fontSize: '16px',
    padding: '10px 20px',
    border: '4px solid white',
    cursor: 'pointer',
    backgroundColor: '#000',
    color: '#fff'
  });
  overlay.appendChild(button);

  button.addEventListener('click', () => {
    const name = input.value.trim();
    if (name) {
      document.body.removeChild(overlay);
      callback(name);
    } else {
      alert("Please enter a valid username.");
    }
  });

  input.addEventListener('keyup', (e) => {
    if (e.key === "Enter") {
      button.click();
    }
  });

  document.body.appendChild(overlay);
}

function submitCurrentScore() {
  // Only submit if a game is active, not in showScore mode, and there is a positive score.
  if (arcadeState.game && arcadeState.game !== 'showScore' && arcadeState.currentScore > 0 && arcadeState.currentScore >= arcadeState.highScore) {
    if (arcadeState.username && arcadeState.userId) {
      return arcadeState.db.ref(`attendees/${arcadeState.userId}`)
        .update({
          [arcadeState.game]: arcadeState.currentScore,
          name: localStorage.getItem('username')
        })
        .then(() => {
          arcadeState.highScore = arcadeState.currentScore;
          localStorage.setItem('highScore_' + arcadeState.game, arcadeState.highScore);
          console.log("Submitted current score for", arcadeState.game);
        })
        .catch(err => {
          console.error('Error submitting score:', err);
          // Still return a resolved promise so the chain continues.
          return Promise.resolve();
        });
    } else {
      return Promise.resolve();
    }
  } else {
    return Promise.resolve();
  }
}

window.initArcade = initArcade;
window.showTitleScreen = showTitleScreen;
window.hideTitleScreen = hideTitleScreen;
window.gameOver = gameOver;