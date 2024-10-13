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
            rankSpan.textContent = `${currentRank}.`;
            rankSpan.classList.add('rank');

            // Create span for name
            const nameSpan = document.createElement('span');
            nameSpan.textContent = user.name;
            nameSpan.classList.add('name');

            // Create span for score
            const scoreSpan = document.createElement('span');
            scoreSpan.textContent = `${user.score} points`;
            scoreSpan.classList.add('score');

            // Append spans to li
            li.appendChild(rankSpan);
            li.appendChild(nameSpan);
            li.appendChild(scoreSpan);

            // Apply color gradient to top 20
            if (index < 20) {
                // Generate color based on position
                const color = getColorGradient(index);
                li.style.color = color;
            }

            leaderboardList.appendChild(li);
        });
    });
}

// Function to generate color gradient
function getColorGradient(index) {
    const maxIndex = 19; // 0-based index for top 20
    const hueStart = 60; // Starting hue (yellow)
    const hueEnd = 0;    // Ending hue (red)
    const lightnessStart = 50; // Starting lightness
    const lightnessEnd = 25;   // Ending lightness

    const hue = hueStart - ((hueStart - hueEnd) * (index / maxIndex));
    const lightness = lightnessStart - ((lightnessStart - lightnessEnd) * (index / maxIndex));

    return `hsl(${hue}, 100%, ${lightness}%)`;
}

// Listen for real-time changes to the current game and update the leaderboard
function listenForGameChanges(db) {
    const gameRef = db.ref('currentGame');
    gameRef.on('value', (snapshot) => {
        const currentGame = snapshot.val();
        updateLeaderboard(currentGame, db);  // Update leaderboard for the current game
    });
}
