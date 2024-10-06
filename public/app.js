// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentGame = "pacman"; // Default game
let playerName = "";

// Start the game after the name is entered
function startGame() {
  playerName = document.getElementById("player-name").value;
  if (playerName) {
    // Store player in local storage
    localStorage.setItem("playerName", playerName);

    // Check if the user already exists in the Firestore database
    db.collection("users").doc(playerName).get().then((doc) => {
      if (!doc.exists) {
        // If the user doesn't exist, create a new user document
        db.collection("users").doc(playerName).set({
          name: playerName,
          scores: {
            pacman: 0,
            donkey_kong: 0,
            frogger: 0,
            space_invaders: 0
          },
          total_score: 0
        });
      }
    });

    // Hide name entry and show the game screen
    document.getElementById("name-entry").style.display = "none";
    document.getElementById("game-screen").style.display = "block";
    loadCurrentGame();
  }
}

// Load the currently selected game based on Firebase
function loadCurrentGame() {
  db.collection("gameState").doc("currentGame").onSnapshot(doc => {
    currentGame = doc.data().game;
    document.getElementById("game-title").textContent = `Playing: ${currentGame}`;
    loadGame(currentGame);
    updateScoreboard(currentGame);  // Update scoreboard for the current game
  });
}

// Load game content dynamically based on selected game
function loadGame(gameName) {
  const gameArea = document.getElementById("game-area");
  gameArea.innerHTML = `<p>Loading ${gameName} game...</p>`;
  // You will replace this with actual game logic later
}

// Submit score for the current game
function submitScore(score) {
  const gameName = currentGame; // The game currently being played

  db.collection("users").doc(playerName).get().then((doc) => {
    if (doc.exists) {
      let userData = doc.data();
      let newScore = score;
      let currentGameScore = userData.scores[gameName] || 0;

      // Update the score only if the new score is higher
      if (newScore > currentGameScore) {
        userData.scores[gameName] = newScore;
        
        // Recalculate total score
        const totalScore = Object.values(userData.scores).reduce((sum, gameScore) => sum + gameScore, 0);

        // Update the user document with the new scores and total
        db.collection("users").doc(playerName).update({
          scores: userData.scores,
          total_score: totalScore
        });
      }
    }
  });
}

  // Add or update the player's score in Firebase
  db.collection("scores").where("name", "==", playerName).where("game", "==", currentGame)
    .get().then(querySnapshot => {
      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        const existingScore = querySnapshot.docs[0].data().score;
        if (score > existingScore) {
          docRef.update({ score: score }); // Update score if it's higher
        }
      } else {
        db.collection("scores").add(playerData); // Add new score if not found
      }
    });
}

// Update the scoreboard in real time
function updateScoreboard(currentGame) {
  const leaderboard = document.getElementById("leaderboard-list");
  const currentGameName = document.getElementById("current-game-name");
  currentGameName.textContent = currentGame;

  db.collection("scores").where("game", "==", currentGame)
    .orderBy("score", "desc")
    .limit(10)
    .onSnapshot(snapshot => {
      leaderboard.innerHTML = "";
      snapshot.forEach(doc => {
        const player = doc.data();
        leaderboard.innerHTML += `<li>${player.name}: ${player.score}</li>`;
      });
    });
}