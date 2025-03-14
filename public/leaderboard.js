let db;
let currentGame = "testgame"; // Default if not set by host.
const refreshInterval = 1000; // Refresh every 1 second.

// Initialize Firebase when DOM is ready.
document.addEventListener('DOMContentLoaded', initFirebase);

function initFirebase() {
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
      listenForLeaderboardGame();
      // Start periodic refresh.
      setInterval(updateLeaderboard, refreshInterval);
    })
    .catch(error => {
      console.error('Error fetching the API key:', error);
    });
}

// Listen for changes to the leaderboard game.
function listenForLeaderboardGame() {
  db.ref('leaderboardGame').on('value', snapshot => {
    const game = snapshot.val();
    currentGame = game;
    if (game) {
      switch (game) {
        case "showCumulativeScore":
          document.getElementById('leaderboardTitle').innerText = 'Cumulative score!';
          break;
        case "breakout":
          document.getElementById('leaderboardTitle').innerText = 'Breakout!';
          break;
        case "frogger":
          document.getElementById('leaderboardTitle').innerText = 'Frogger!';
          break;
        case "spaceinvaders":
          document.getElementById('leaderboardTitle').innerText = 'Invaders!';
          break;
        case "runner":
          document.getElementById('leaderboardTitle').innerText = 'Runner!';
          break;
        default:
          break;
      }
      updateLeaderboard(); // Immediate update on game change.
    }
  });
}

// Update the leaderboard by querying Firebase for attendees.
function updateLeaderboard() {
  db.ref('attendees').once('value')
    .then(snapshot => {
      const attendees = snapshot.val();
      let scores = [];

      if (currentGame === 'showCumulativeScore') {
        // Calculate cumulative score for each attendee.
        for (let key in attendees) {
          if (attendees.hasOwnProperty(key)) {
            const user = attendees[key];
            const breakout = parseFloat(user.breakout) || 0;
            const runner = parseFloat(user.runner) || 0;
            const spaceinvaders = parseFloat(user.spaceinvaders) || 0;
            const frogger = parseFloat(user.frogger) || 0;
            const total = breakout + runner + spaceinvaders + frogger;
            if (total > 0) {
              scores.push({ name: user.name, score: total });
            }
          }
        }
      } else {
        // Regular mode: get the score for the selected game.
        for (let key in attendees) {
          if (attendees.hasOwnProperty(key)) {
            const user = attendees[key];
            let score = parseFloat(user[currentGame]);
            if (isNaN(score)) score = 0;
            if (score > 0) {
              scores.push({ name: user.name, score });
            }
          }
        }
      }

      // Sort scores in descending order.
      scores.sort((a, b) => b.score - a.score);

      // Determine the highest score for the gradient.
      let highestScore = scores.length > 0 ? scores[0].score : 0;

      // Build the leaderboard list with ranking (ties get same rank).
      const leaderboardList = document.getElementById('leaderboardList');
      leaderboardList.innerHTML = '';
      let currentRank = 0;
      let previousScore = null;
      let playersProcessed = 0;

      scores.forEach(user => {
        if (user.score !== previousScore) {
          currentRank = playersProcessed + 1;
        }
        previousScore = user.score;
        playersProcessed++;

        const li = document.createElement('li');

        // Create rank span.
        const rankSpan = document.createElement('span');
        rankSpan.classList.add('rank');
        rankSpan.textContent = currentRank + '. ';

        // Create name span.
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('name');
        nameSpan.textContent = user.name;

        // Create score span.
        const scoreSpan = document.createElement('span');
        scoreSpan.classList.add('score');
        scoreSpan.textContent = user.score;

        // Calculate the gradient color: highest => yellow (hue 60), 0 => red (hue 0).
        let hue = highestScore > 0 ? (user.score / highestScore) * 60 : 0;
        const color = `hsl(${hue}, 100%, 50%)`;
        rankSpan.style.color = color;
        nameSpan.style.color = color;
        scoreSpan.style.color = color;

        li.appendChild(rankSpan);
        li.appendChild(nameSpan);
        li.appendChild(scoreSpan);
        leaderboardList.appendChild(li);
      });
    })
    .catch(error => {
      console.error('Error updating leaderboard:', error);
    });
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
