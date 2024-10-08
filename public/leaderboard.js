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

    leaderboardTitle.innerText = currentGame.charAt(0).toUpperCase() + currentGame.slice(1) + " Leaderboard";

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

        // Display sorted scores on the leaderboard
        scores.forEach((user) => {
            const li = document.createElement('li');
            li.innerText = `${user.name}: ${user.score} points`;
            leaderboardList.appendChild(li);
        });
    });
}

// Listen for real-time changes to the current game and update the leaderboard
function listenForGameChanges(db) {
    const gameRef = db.ref('currentGame');
    gameRef.on('value', (snapshot) => {
        const currentGame = snapshot.val();
        updateLeaderboard(currentGame, db);  // Update leaderboard for the current game
    });
}