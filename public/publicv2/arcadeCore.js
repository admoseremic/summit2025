/***********************************************************
 * arcadeCore.js (Refactored)
 * 
 * - Has a single "gameOver(restartCallback)" for all games
 * - "Try Again" restarts the game without showing the title
 ***********************************************************/

// Global references
let db;
let username = null;
let currentScore = 0;
let highScore = 0;
let game = '';       
let isGameOver = false;
let animationFrameId = null;
let canvas, ctx;     

// Logical grid size
let baseCols = 9;
let baseRows = 16;

// Aspect ratio
const ASPECT_RATIO = 9 / 16;

// Scoreboard elements (created once)
let scoreElement, highScoreElement;

/*************************************************************
 * STOP GAME
 *************************************************************/
function stopGame() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
}

/*************************************************************
 * UNIVERSAL GAME OVER
 * 1) Updates high score if needed
 * 2) Shows "Game Over" text
 * 3) Retro-themed "Try Again" button, calls restartCallback
 *************************************************************/
function gameOver(restartCallback) {
  isGameOver = true;
  stopGame();

  // Check if new high score
  if (username && currentScore > highScore) {
    const userRef = db.ref('attendees');
    userRef.orderByChild('name').equalTo(username).once('value', snapshot => {
      if (snapshot.exists()) {
        let userData = snapshot.val();
        let userId = Object.keys(userData)[0];
        let updates = {};
        // Example: storing all game scores under "frogger" for now
        updates[`/attendees/${userId}/frogger`] = currentScore;
        db.ref().update(updates);
      }
    });
  }

  // Clear canvas and show "Game Over"
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = '40px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 20);

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
function loadGame(gameName) {
  // Basic resets
  currentScore = 0;
  highScore = 0;
  isGameOver = false;
  game = gameName;

  // Reset scoreboard text
  if (scoreElement) scoreElement.innerText = 'Score: 0';
  if (highScoreElement) highScoreElement.innerText = 'High Score: 0';

  // Retrieve high score from Firebase
  if (username) {
    let userRef = db.ref('attendees');
    userRef.orderByChild('name').equalTo(username).once('value', snapshot => {
      if (snapshot.exists()) {
        let userData = snapshot.val();
        let userId = Object.keys(userData)[0];
        let user = userData[userId];
        // Using the 'frogger' node for consistency
        highScore = user.frogger || 0;
        if (highScoreElement) {
          highScoreElement.innerText = 'High Score: ' + highScore;
        }
      }
    });
  }

  // Start the appropriate game
  if (gameName === 'testgame') {
    startTestGame();  // See testgame.js below
  } else if (gameName === 'frogger') {
    startFrogger();
  } else {
    console.log(`Unknown game: ${gameName}`);
  }
}

/*************************************************************
 * Canvas / Scoreboard Setup
 *************************************************************/
function setupCanvas() {
  const container = document.getElementById('gameContent');
  container.innerHTML = '';

  canvas = document.createElement('canvas');
  canvas.id = 'gameCanvas';
  canvas.style.border = '4px solid white'; // differentiate from black BG
  container.appendChild(canvas);
  ctx = canvas.getContext('2d');

  // Listen to window resize
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
}

function resizeCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ratio = w / h;

  if (ratio > ASPECT_RATIO) {
    canvas.height = h;
    canvas.width = h * ASPECT_RATIO;
  } else {
    canvas.width = w;
    canvas.height = w / ASPECT_RATIO;
  }
}

function createScoreboardElements() {
  if (document.getElementById('scoreContainer')) return;

  const container = document.createElement('div');
  container.id = 'scoreContainer';
  Object.assign(container.style, {
    position: 'absolute',
    top: '10px',
    left: '0',
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 10px',
    pointerEvents: 'none'
  });

  scoreElement = document.createElement('div');
  styleScoreElement(scoreElement);
  scoreElement.innerText = 'Score: 0';

  highScoreElement = document.createElement('div');
  styleScoreElement(highScoreElement);
  highScoreElement.innerText = 'High Score: 0';

  container.appendChild(scoreElement);
  container.appendChild(highScoreElement);
  document.body.appendChild(container);
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
      db = firebase.database();

      // Setup user, canvas, scoreboard, etc.
      username = localStorage.getItem('username') || "Guest";
      setupCanvas();
      createScoreboardElements();

      // Listen for "currentGame" changes
      listenForGameChanges();
    })
    .catch(err => console.error("Error fetching Firebase config:", err));
}

function listenForGameChanges() {
  const gameRef = db.ref('currentGame');
  gameRef.on('value', snapshot => {
    stopGame();
    const newGame = snapshot.val() || 'testgame';
    loadGame(newGame);
  });
}
