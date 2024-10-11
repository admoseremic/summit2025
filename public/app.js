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

        // After Firebase has been initialized, we can enable the rest of the functionality
        initializeAppFunctions();
    })
    .catch(error => {
        console.error('Error fetching the API key:', error);
    });

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
                const userDisplayElement = document.getElementById('userDisplay');
                if (userNameElement && userDisplayElement) {
                    userNameElement.innerText = username;
                    userDisplayElement.style.display = 'block';
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
    }

    // Listen for real-time changes to the current game and update the game view
    function listenForGameChanges() {
        const gameRef = window.db.ref('currentGame');
        gameRef.on('value', (snapshot) => {
            const currentGame = snapshot.val();
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
                    document.getElementById('totalPoints').innerText = totalPoints;
                    break;
                }
            }
        });
    }

    // Check if a username is stored in localStorage
    const storedName = localStorage.getItem('username');
    if (storedName) {
        // Update the user's name display
        const userNameElement = document.getElementById('userName');
        const userDisplayElement = document.getElementById('userDisplay');
        if (userNameElement && userDisplayElement) {
            userNameElement.innerText = storedName;
            userDisplayElement.style.display = 'block';
        }
        document.title = `Summit Arcade - ${storedName}`;
        document.getElementById('nameModal').style.display = 'none';
        // Start real-time listener for the user's total points
        listenForUserTotalPoints(storedName);
    } else {
        // Show the modal if no name is found
        document.getElementById('nameModal').style.display = 'flex';
    }

    // Attach the form submission handler
    document.getElementById('nameForm').addEventListener('submit', submitName);

    // Start listening for game changes after all functions are defined
    listenForGameChanges();
}
