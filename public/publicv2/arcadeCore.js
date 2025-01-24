/***********************************************************
 * arcadeCore.js
 * Common logic & lifecycle for the entire arcade
 ***********************************************************/

let db;               // Firebase DB reference
let username = null;  // The player's name
let currentScore = 0; // Score for the current session
let highScore = 0;    // Highest retrieved from Firebase
let game = '';        // Current game name (e.g., 'testgame', 'frogger', etc.)
let isGameOver = false;
let animationFrameId = null;
let canvas, ctx;      // Canvas references
let baseCols = 9;     // Logical grid width
let baseRows = 16;    // Logical grid height

// We'll keep a reference to the scoreboard elements
let scoreElement, highScoreElement;

// Aspect ratio constants
const ASPECT_RATIO = 9 / 16;

// Initialize Firebase and set up event listeners
function initArcade() {
  // 1. FETCH FIREBASE API CONFIG (like you do now)
  fetch('https://us-central1-summit-games-a1f9f.cloudfunctions.net/getApiKey')
    .then(response => response.json())
    .then(data => {
      const firebaseConfig = {
        apiKey: data.apiKey,
        authDomain: "summit-games-a1f9f.firebaseapp.com",
        databaseURL: "https://summit-games-a1f9f-default-rtdb.firebaseio.com/",
        projectId: "summit-games-a1f9f",
        storageBucket: "summit-games-a1f9f.appspot.com",
        messagingSenderId: "441105165656",
        appId: "1:441105165656:web:277897c92f13365a98092d"
      };
      firebase.initializeApp(firebaseConfig);
      db = firebase.database();

      setupUsername();
      listenForGameChanges();
      setupCanvas(); // We'll create & size the canvas
      createScoreboardElements(); // Create overlay scoreboard
    })
    .catch(error => {
      console.error('Error fetching the API key:', error);
    });
}

// Handle retrieving username or prompting user for one
function setupUsername() {
  username = localStorage.getItem('username');
  if (!username) {
    // Show some minimal prompt or handle it in your HTML “nameModal”
    // For brevity, we'll assume you already handle the name form in index.html
  } else {
    // Possibly load total points or do something with the username
    console.log("User is", username);
  }
}

// Listen for "currentGame" changes in Firebase
function listenForGameChanges() {
  const gameRef = db.ref('currentGame');
  gameRef.on('value', (snapshot) => {
    stopGame();
    const newGame = snapshot.val() || 'testgame';
    game = newGame;
    loadGame(game);
  });
}

// Load the relevant game (could be testgame, frogger, etc.)
// For simplicity, we assume all scripts are loaded up front in index.html.
function loadGame(gameName) {
  console.log("Switching to game:", gameName);
  currentScore = 0;
  highScore = 0;
  isGameOver = false;

  // Clear scoreboard
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
        // For testgame, we're storing the score under 'frogger' per your request
        highScore = user.frogger || 0;
        if (highScoreElement) {
          highScoreElement.innerText = 'High Score: ' + highScore;
        }
      }
    });
  }

  // This calls the "init" function of whichever game is selected
  if (gameName === 'testgame') {
    startTestGame();
  } else if (gameName === 'frogger') {
    startFrogger(); // Your existing code
  }
  // etc. for other games...
}

/**
 * Create & style the canvas, add to the DOM, and handle resizing
 */
function setupCanvas() {
  const container = document.getElementById('gameContent');
  if (!container) {
    console.error('No #gameContent found in HTML.');
    return;
  }
  // Clear any existing children
  container.innerHTML = '';

  // Create a fresh canvas
  canvas = document.createElement('canvas');
  canvas.id = 'gameCanvas';
  // White border for differentiating black background
  canvas.style.border = '4px solid white';
  container.appendChild(canvas);

  ctx = canvas.getContext('2d');

  // Resize immediately & on window resize
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = w / h;

    if (ratio > ASPECT_RATIO) {
      // window is wider; constrain by height
      canvas.height = h;
      canvas.width = h * ASPECT_RATIO;
    } else {
      // window is taller; constrain by width
      canvas.width = w;
      canvas.height = w / ASPECT_RATIO;
    }
    // Then center it horizontally or vertically within #gameContent if you wish.
  }

  window.addEventListener('resize', resize);
  resize();
}

/**
 * Create scoreboard overlay elements for "Score" and "High Score"
 */
function createScoreboardElements() {
  // If the scoreboard already exists, skip
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
    pointerEvents: 'none' // Let clicks pass through if needed
  });

  scoreElement = document.createElement('div');
  scoreElement.id = 'scoreElement';
  scoreElement.innerText = 'Score: 0';
  styleScoreElement(scoreElement);

  highScoreElement = document.createElement('div');
  highScoreElement.id = 'highScoreElement';
  highScoreElement.innerText = 'High Score: 0';
  styleScoreElement(highScoreElement);

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
 * COMMON GAME LIFECYCLE FUNCTIONS
 *************************************************************/

// Called by each game when it finishes or on game switch
function stopGame() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
}

// Common gameOver routine
function gameOver() {
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
        // Per your request, store testgame score in "frogger"
        updates['/attendees/' + userId + '/frogger'] = currentScore;
        db.ref().update(updates);
      }
    });
  }

  // Display "Game Over" overlay + "Try Again" button
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = '40px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 20);

  const tryAgainButton = document.createElement('button');
  tryAgainButton.id = 'tryagain';
  tryAgainButton.innerText = 'Try Again';
  Object.assign(tryAgainButton.style, {
    position: 'absolute',
    left: '50%',
    top: '60%',
    transform: 'translate(-50%, -50%)',
    zIndex: '9999'
  });
  tryAgainButton.onclick = () => {
    document.body.removeChild(tryAgainButton);
    loadGame(game); // Start again, skipping the title screen
  };
  document.body.appendChild(tryAgainButton);
}

function showTitleScreen(title, onStartCallback) {
  // Dim background
  const overlay = document.createElement('div');
  overlay.id = 'titleOverlay';
  Object.assign(overlay.style, {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: '9998',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column'
  });

  const titleElem = document.createElement('h1');
  titleElem.innerText = title;
  titleElem.style.color = 'white';

  const startBtn = document.createElement('button');
  startBtn.innerText = 'Start';
  Object.assign(startBtn.style, {
    marginTop: '20px',
    fontFamily: '"Press Start 2P"',
    fontSize: '16px'
  });

  startBtn.onclick = () => {
    document.body.removeChild(overlay);
    if (onStartCallback) onStartCallback();
  };

  overlay.appendChild(titleElem);
  overlay.appendChild(startBtn);
  document.body.appendChild(overlay);
}

function hideTitleScreen() {
  const overlay = document.getElementById('titleOverlay');
  if (overlay) {
    document.body.removeChild(overlay);
  }
}

//
// Make sure to call initArcade() from your index.html
//
