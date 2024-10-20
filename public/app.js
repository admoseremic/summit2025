// Fetch the Firebase API key and configuration from the backend
fetch('https://us-central1-summit-games-a1f9f.cloudfunctions.net/getApiKey')
    .then(response => response.json())
    .then(data => {
        // Initialize Firebase with the config that includes the dynamic API key
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
        window.db = firebase.database();  // Make the database reference globally available
        
        // Enable the rest of the functionality
        initializeAppFunctions();
    })
    .catch(error => {
        console.error('Error fetching the API key:', error);
    });

// Flag to check if initial data has been loaded
let initialDataLoaded = false;

// Initialize Firebase-dependent functions after Firebase has been initialized
function initializeAppFunctions() {
    // Function to handle form submission
    function submitName(event) {
        event.preventDefault();  // Prevent form refresh
        const username = document.getElementById('username').value;

        if (username) {
            // Save username to localStorage to persist across sessions
            localStorage.setItem('username', username);

            // Use `push()` to generate a unique ID for each attendee
            const newAttendeeRef = window.db.ref('attendees').push();

            // Write the user's name and example scores to the Realtime Database
            newAttendeeRef.set({
                name: username,
                pacman: 50,         // Example scores
                donkeykong: 100,
                spaceinvaders: 75,
                frogger: 90
            })
            .then(() => {
                // Update the user's name display
                const userNameElement = document.getElementById('userName');
                if (userNameElement) {
                    userNameElement.innerText = username;
                }
                document.title = `Summit Arcade - ${username}`;
                // Hide the modal after submission
                document.getElementById('nameModal').style.display = 'none';
                // After name is submitted, start listening for real-time updates
                listenForUserTotalPoints(username);
            })
            .catch(error => {
                // Optionally display error message
                console.error('Error submitting name:', error);
            });
        }
    }

    // Attach the form submission handler
    document.getElementById('nameForm').addEventListener('submit', submitName);

    // Check if a username is stored in localStorage
    const storedName = localStorage.getItem('username');
    if (storedName) {
        // Update the user's name display
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.innerText = storedName;
        }
        document.title = `Summit Arcade - ${storedName}`;
        // Hide the modal
        document.getElementById('nameModal').style.display = 'none';
        // Start real-time listener for the user's total points
        listenForUserTotalPoints(storedName);
    } else {
        // Show the modal if no name is found
        document.getElementById('nameModal').style.display = 'flex';
    }

    // Prevent default touch behaviors
    document.addEventListener('touchmove', function(event) {
        event.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart', function(event) {
        event.preventDefault();
    });

    // Start listening for game changes after all functions are defined
    listenForGameChanges();
}

// Centralized game canvas creation and resizing logic
function createGameCanvas() {
    const gameContent = document.getElementById('gameContent');
    gameContent.innerHTML = ''; // Clear previous game content

    // Create and configure the game canvas or div container
    const canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    gameContent.appendChild(canvas);

    // Return the created canvas for game-specific logic to use
    return canvas;
}

function resizeGameCanvas() {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        const gameContent = document.getElementById('gameContent');
        // Ensure the canvas takes the full width and height of the gameContent container
        canvas.width = gameContent.clientWidth;
        canvas.height = gameContent.clientHeight;
    }
}

window.addEventListener('resize', resizeGameCanvas);

function initializeGameCanvas() {
    const canvas = createGameCanvas(); // Create the game canvas
    resizeGameCanvas(); // Set its initial size
    return canvas; // Return the canvas element for the game to use
}

// Function to stop the current game before switching to a new one
function stopCurrentGame() {
  // Check if there's a global stopGame function and call it
  if (window.stopGame && typeof window.stopGame === 'function') {
      window.stopGame();
      window.stopGame = null; // Reset the global reference
  }
}

// Function to update game based on the current game
function updateGame(game) {
    const gameTitle = document.getElementById('gameTitle');
    const gameContent = document.getElementById('gameContent');
    gameContent.innerHTML = ''; // Clear previous game content

    switch (game) {
        case 'pacman':
            gameTitle.innerText = 'Pac-Man';
            startPacman();
            break;
        case 'donkeykong':
            gameTitle.innerText = 'Donkey Kong';
            startDonkeyKong();
            break;
        case 'frogger':
            gameTitle.innerText = 'Frogger';
            startFrogger();
            break;
        case 'spaceinvaders':
            gameTitle.innerText = 'Space Invaders';
            startSpaceInvaders();
            break;
        default:
            gameTitle.innerText = 'Select a game to play...';
            gameContent.innerHTML = '<p>Please select a game from the list above.</p>';
    }

    // Resize canvas after switching to a new game
    resizeGameCanvas();

    // Hide loading screen on first data load
    if (!initialDataLoaded) {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        const content = document.getElementById('content');
        if (content) {
            content.style.display = 'block';
        }
        initialDataLoaded = true;
    }
}

// Modify listenForGameChanges to stop the previous game before starting a new one
function listenForGameChanges() {
  const gameRef = window.db.ref('currentGame');
  gameRef.on('value', (snapshot) => {
      const currentGame = snapshot.val();
      console.log('Current game:', currentGame);

      // Stop the previous game before starting a new one
      stopCurrentGame();

      // Update the game view
      updateGame(currentGame);
  });
}

// Listen for real-time changes to the user's total points
function listenForUserTotalPoints(username) {
    window.db.ref('attendees').on('value', (snapshot) => {
        const attendees = snapshot.val();
        for (let key in attendees) {
            if (attendees.hasOwnProperty(key) && attendees[key].name === username) {
                const user = attendees[key];
                const totalPoints = (user.pacman || 0) + (user.donkeykong || 0) + (user.spaceinvaders || 0) + (user.frogger || 0);
                const totalPointsElement = document.getElementById('totalPoints');
                if (totalPointsElement) {
                    totalPointsElement.innerText = totalPoints;
                }
                break;
            }
        }
    });
}

// Function to create a consistent game container/canvas
function createGameCanvas() {
    const gameContent = document.getElementById('gameContent');
    gameContent.innerHTML = ''; // Clear previous game content

    // Create and configure the game canvas or div container
    const canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    gameContent.appendChild(canvas);

    // Return the created canvas for game-specific logic to use
    return canvas;
}

function resizeGameCanvas() {
    const canvas = document.getElementById('gameCanvas');
    const gameContent = document.getElementById('gameContent');
    if (canvas && gameContent) {
        // Set canvas width and height based on its parent container
        canvas.width = gameContent.clientWidth;
        canvas.height = gameContent.clientHeight;
    }
}

// Listen for window resize events
window.addEventListener('resize', resizeGameCanvas);

// Function to handle the creation and resizing of the game canvas
function initializeGameCanvas() {
    const canvas = createGameCanvas(); // Create the game canvas
    resizeGameCanvas(); // Set its initial size
    return canvas; // Return the canvas element for the game to use
}