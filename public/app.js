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
                document.getElementById('message').innerText = 'Name submitted successfully!';
                // After name is submitted, start listening for real-time updates
                listenForUserTotalPoints(username);
            })
            .catch(error => {
                document.getElementById('message').innerText = 'Error submitting name: ' + error.message;
            });
        }
    }

    // Function to update game based on the current game
    function updateGame(game) {
        const gameTitle = document.getElementById('gameTitle');
        const gameContent = document.getElementById('gameContent');
        gameContent.innerHTML = ''; // Clear previous game content

        // Remove any previously added game script
        const oldScript = document.getElementById('gameScript');
        if (oldScript) {
            oldScript.remove();
        }

        let scriptSrc = '';

        switch (game) {
            case 'pacman':
                gameTitle.innerText = 'Pac-Man';
                gameContent.innerHTML = '<div id="pacmanGame">Stubbed out version of Pac-Man goes here!</div>';
                scriptSrc = 'pacman.js';
                break;
            case 'donkeykong':
                gameTitle.innerText = 'Donkey Kong';
                gameContent.innerHTML = '<div id="donkeyKongGame">Stubbed out version of Donkey Kong goes here!</div>';
                scriptSrc = 'donkeykong.js';
                break;
            case 'frogger':
                gameTitle.innerText = 'Frogger';
                gameContent.innerHTML = '<div id="froggerGame">Stubbed out version of Frogger goes here!</div>';
                scriptSrc = 'frogger.js';
                break;
            case 'spaceinvaders':
                gameTitle.innerText = 'Space Invaders';
                gameContent.innerHTML = '<div id="spaceInvadersGame">Stubbed out version of Space Invaders goes here!</div>';
                scriptSrc = 'spaceinvaders.js';
                break;
            default:
                gameTitle.innerText = 'Select a game to play...';
                gameContent.innerHTML = '<p>Please select a game from the list above.</p>';
        }

        if (scriptSrc) {
            // Create a new script element for the current game
            const script = document.createElement('script');
            script.src = scriptSrc;
            script.id = 'gameScript';
            document.body.appendChild(script);
        }
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

    // Check if a username is stored in localStorage and pre-fill the form
    const storedName = localStorage.getItem('username');
    if (storedName) {
        document.getElementById('username').value = storedName;
        document.getElementById('message').innerText = `Welcome back, ${storedName}!`;

        // Start real-time listener for the user's total points
        listenForUserTotalPoints(storedName);
    }

    // Attach the form submission handler
    document.getElementById('nameForm').addEventListener('submit', submitName);
}
