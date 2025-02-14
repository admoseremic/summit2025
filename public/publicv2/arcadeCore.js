// arcadeCore.js
// Import each game’s start function.
import { startTestGame } from './testgame.js';
import { startFrogger } from './frogger.js';
import { startBreakout } from './breakout.js';
import { startRunner } from './runner.js';
import { startSpaceInvaders } from './spaceinvaders.js';

// Global references
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
  highScoreElement: null
}
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
  stopGame();

  // Check if new high score
  if (arcadeState.username && arcadeState.currentScore > arcadeState.highScore) {
    const userRef = arcadeState.db.ref('attendees');
    userRef.orderByChild('name').equalTo(arcadeState.username).once('value', snapshot => {
      if (snapshot.exists()) {
        let userData = snapshot.val();
        let userId = Object.keys(userData)[0];
        let updates = {};
        updates[`/attendees/${userId}/${arcadeState.game}`] = arcadeState.currentScore;
        arcadeState.db.ref().update(updates);
      }
    });
  }
  // Clear canvas and show "Game Over"
  arcadeState.ctx.clearRect(0, 0, arcadeState.canvas.width, arcadeState.canvas.height);
  arcadeState.ctx.fillStyle = 'white';
  arcadeState.ctx.font = '40px "Press Start 2P"';
  arcadeState.ctx.textAlign = 'center';
  arcadeState.ctx.fillText('Game Over', arcadeState.canvas.width / 2, arcadeState.canvas.height / 2 - 20);
  // Retro-themed "Try Again" button
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

  // On click, remove button and call the restart callback (skipping the title screen)
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
  arcadeState.highScore = 0;
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
  // Initialize Firebase
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

      // Setup user, canvas, scoreboard, etc.
      arcadeState.username = localStorage.getItem('username') || "Guest";
      setupCanvas();
      createScoreboardElements();

      // Listen for "currentGame" changes
      listenForGameChanges();
    })
    .catch(err => console.error("Error fetching Firebase config:", err));
}

function listenForGameChanges() {
  const gameRef = arcadeState.db.ref('currentGame');
  gameRef.on('value', snapshot => {
    stopGame();
    const newGame = snapshot.val() || 'testgame';
    loadGame(newGame);
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

window.initArcade = initArcade;
window.showTitleScreen = showTitleScreen;
window.hideTitleScreen = hideTitleScreen;
window.gameOver = gameOver;