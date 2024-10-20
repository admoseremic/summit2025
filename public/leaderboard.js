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
        const db = firebase.database();

        // After Firebase has been initialized, display the leaderboard
        listenForGameChanges(db);
    })
    .catch(error => {
        console.error('Error fetching the API key:', error);
    });

// Flag to check if initial data has been loaded
let initialDataLoaded = false;

// Function to retrieve and update the leaderboard for the current game
function updateLeaderboard(currentGame, db) {
    const leaderboardTitle = document.getElementById('leaderboardTitle');
    const leaderboardList = document.getElementById('leaderboardList');

    leaderboardTitle.innerText = currentGame.charAt(0).toUpperCase() + currentGame.slice(1);

    // Fetch all users and their scores for the current game
    db.ref('attendees').on('value', (snapshot) => {
        const attendees = snapshot.val();
        const scores = [];

        // Loop through attendees and get scores for the current game
        for (let key in attendees) {
            if (attendees.hasOwnProperty(key)) {
                const user = attendees[key];
                scores.push({ name: user.name, score: user[currentGame] || 0 });
            }
        }

        // Sort the scores in descending order
        scores.sort((a, b) => b.score - a.score);

        // Clear existing leaderboard
        leaderboardList.innerHTML = '';

        // Initialize variables for rank calculation
        let currentRank = 0;
        let prevScore = null;
        let playersProcessed = 0;

        // Display sorted scores on the leaderboard
        scores.forEach((user, index) => {
            // Increment rank only if the current score is less than the previous score
            if (user.score !== prevScore) {
                currentRank = playersProcessed + 1;
            }
            prevScore = user.score;
            playersProcessed++;

            const li = document.createElement('li');

            // Create span for rank
            const rankSpan = document.createElement('span');
            rankSpan.textContent = currentRank < 10 ? `${currentRank}. ` : `${currentRank}.`;
            rankSpan.classList.add('rank');

            // Create span for name
            const nameSpan = document.createElement('span');
            nameSpan.textContent = user.name;
            nameSpan.classList.add('name');

            // Create span for score
            const scoreSpan = document.createElement('span');
            scoreSpan.textContent = `${user.score}`;
            scoreSpan.classList.add('score');

            // Append spans to li
            li.appendChild(rankSpan);
            li.appendChild(nameSpan);
            li.appendChild(scoreSpan);

            // Apply colors based on position (index + 1)
            const position = index + 1;
            if (position <= 20) {
                const color = getColorGradient(position);
                nameSpan.style.color = color;
                rankSpan.style.color = color;
                scoreSpan.style.color = color;
            } else {
                // Set colors to the same red as rank 20
                const color = getColorGradient(20);
                nameSpan.style.color = color;
                rankSpan.style.color = color;
                scoreSpan.style.color = color;
            }

            leaderboardList.appendChild(li);
        });

        // After updating the leaderboard, hide the loading screen on first data load
        if (!initialDataLoaded) {
            // Hide the loading screen
            const loadingScreen = document.getElementById('loadingScreen');
            loadingScreen.style.display = 'none';

            // Show the main content
            const content = document.getElementById('content');
            content.style.display = 'block';

            initialDataLoaded = true;
        }
    });
}

// Function to generate a gradient from bright yellow to red
function getColorGradient(position) {
    const maxPosition = 20; // Positions to apply the gradient
    const startHue = 60; // Hue for bright yellow
    const endHue = 0;    // Hue for red
    const saturation = 100; // Keep saturation constant at 100%
    const lightness = 50;   // Keep lightness constant at 50%

    // Calculate the ratio based on the position
    const ratio = (position - 1) / (maxPosition - 1);

    // Interpolate the hue
    const hue = startHue - (startHue - endHue) * ratio;

    // Return the HSL color string
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Listen for real-time changes to the current game and update the leaderboard
function listenForGameChanges(db) {
    const gameRef = db.ref('currentGame');
    gameRef.on('value', (snapshot) => {
        const currentGame = snapshot.val();
        updateLeaderboard(currentGame, db);  // Update leaderboard for the current game
    });
}
