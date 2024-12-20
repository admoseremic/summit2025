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

let initialDataLoaded = false;
let game = '';
let currentScore = 0;
let highScore = 0;
let username = localStorage.getItem('username');
let isGameOver = false;

const GAME_RATIO = 9 / 16;
const canvasContainer = document.getElementById('gameContent');
let canvas = createGameCanvas();
let ctx = canvas.getContext('2d');
let gameLoop = null;
canvasContainer.appendChild(canvas);
let animationFrameId;
let scale = 1;


// Listen for window resize and adjust canvas and game elements
resizeGameCanvas();
window.addEventListener('resize', resizeGameCanvas);

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
                breakout: 50,         // Example scores
                runner: 100,
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
    document.addEventListener('touchmove', function (event) {
        event.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart', function (event) {
        event.preventDefault();
    });

    // Start listening for game changes after all functions are defined
    listenForGameChanges();
}



// Centralized game canvas creation and resizing logic
function createGameCanvas() {
    canvasContainer.innerHTML = '';

    // Create and configure the game canvas or div container
    const _canvas = document.createElement('canvas');
    _canvas.id = 'gameCanvas';
    _canvas.style.backgroundColor = 'black';
    
    // Return the created canvas for game-specific logic to use
    _canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    _canvas.addEventListener('dblclick', (e) => e.preventDefault());
    canvasContainer.appendChild(_canvas);
    return _canvas;
}

// Function to update game based on the current game
function updateGame(switchToGame) {
    const gameTitle = document.getElementById('gameTitle');
    
    canvasContainer.innerHTML = ''; // Clear previous game content
    game = switchToGame;
    switch (game) {
        case 'breakout':
            gameTitle.innerText = 'Breakout';
            startBreakout();
            break;
        case 'runner':
            gameTitle.innerText = 'Runner';
            startRunner();
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
            gameTitle.innerText = 'Please wait...';
            canvasContainer.innerHTML = '<p>Waiting for a game to be selected...</p>';
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
        stopGame();

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
                const totalPoints = (user.breakout || 0) + (user.runner || 0) + (user.spaceinvaders || 0) + (user.frogger || 0);
                const totalPointsElement = document.getElementById('totalPoints');
                if (totalPointsElement) {
                    totalPointsElement.innerText = totalPoints;
                }
                break;
            }
        }
    });
}

function resizeGameCanvas() {
    const canvas = document.getElementById('gameCanvas');
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowRatio = windowWidth / windowHeight;
    const gameContent = document.getElementById('gameContent');
    if (canvas && gameContent) {
        // Ensure the game ratio is maintained
        let newWidth, newHeight;

        if (windowRatio > GAME_RATIO) {
            // Window is wider than game ratio
            newHeight = windowHeight;
            newWidth = newHeight * GAME_RATIO;
        } else {
            // Window is taller than game ratio
            newWidth = windowWidth;
            newHeight = newWidth / GAME_RATIO;
        }

        // Set canvas size
        canvas.width = newWidth;
        canvas.height = newHeight;

        // Optionally, you can adjust the scaling factor here for consistent in-game scaling
        scale = canvas.width / 8;
        // Apply scaling (example for sprite scaling)
        // sprite.style.transform = `scale(${scaleX}, ${scaleY})`; // You would need to update your sprite scaling logic

        console.log(canvas.width + " x " + canvas.height);
    }

}
