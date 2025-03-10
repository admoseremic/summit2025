// showScore.js
export function showScoreScreen() {
  // Clear the game container
  const container = document.getElementById('gameContent');
  container.innerHTML = '';

  // Create a wrapper that mimics your canvas setup
  const wrapper = document.createElement('div');
  wrapper.id = "scoreWrapper";
  wrapper.style.position = "relative";
  wrapper.style.padding = "4px"; // same as your canvas wrapper
  wrapper.style.margin = "auto";
  container.appendChild(wrapper);

  // Calculate available width/height using the same 9:16 aspect ratio logic
  const availableWidth = window.innerWidth - 8;
  const availableHeight = window.innerHeight - 8;
  const ASPECT_RATIO = 9 / 16;
  let width, height;
  if (availableWidth / availableHeight > ASPECT_RATIO) {
    height = availableHeight;
    width = height * ASPECT_RATIO;
  } else {
    width = availableWidth;
    height = width / ASPECT_RATIO;
  }

  // Create the score container with a white border
  const scoreContainer = document.createElement('div');
  scoreContainer.id = "scoreScreen";
  scoreContainer.style.width = width + "px";
  scoreContainer.style.height = height + "px";
  scoreContainer.style.border = '4px solid white';
  scoreContainer.style.display = 'flex';
  scoreContainer.style.flexDirection = 'column';
  scoreContainer.style.justifyContent = 'center';
  scoreContainer.style.alignItems = 'center';
  scoreContainer.style.boxSizing = 'border-box';
  scoreContainer.style.padding = '10px';
  scoreContainer.style.fontFamily = '"Press Start 2P", sans-serif';
  wrapper.appendChild(scoreContainer);

  // Set font sizes based on container width (adjusted to avoid wrapping)
  const usernameFontSize = width * 0.07;
  const scoreFontSize = width * 0.05;
  const totalLabelFontSize = width * 0.06;
  const totalScoreFontSize = width * 0.08;

  // Get the username from localStorage
  const username = localStorage.getItem('username') || "Guest";

  // Username element (red)
  const usernameEl = document.createElement('h2');
  usernameEl.textContent = username;
  usernameEl.style.color = 'red';
  usernameEl.style.fontSize = usernameFontSize + "px";
  usernameEl.style.marginBottom = '10px';
  usernameEl.style.width = '90%';
  usernameEl.style.textAlign = 'center';
  usernameEl.style.whiteSpace = 'nowrap';
  scoreContainer.appendChild(usernameEl);

  // Display individual game scores (only if nonzero)
  const games = ['breakout', 'runner', 'spaceinvaders', 'frogger'];
  let total = 0;
  games.forEach(game => {
    let score = parseInt(localStorage.getItem('highScore_' + game)) || 0;
    if (score > 0) {
      total += score;
      const line = document.createElement('div');
      line.style.fontSize = scoreFontSize + "px";
      line.style.color = 'white';
      line.style.marginBottom = '8px';
      line.style.width = '90%';
      line.style.textAlign = 'center';
      line.style.whiteSpace = 'nowrap';
      line.textContent = game.charAt(0).toUpperCase() + game.slice(1) + ': ' + score;
      scoreContainer.appendChild(line);
    }
  });

  // Display cumulative score (label and total)
  const totalLabel = document.createElement('div');
  totalLabel.style.fontSize = totalLabelFontSize + "px";
  totalLabel.style.color = 'yellow';
  totalLabel.style.marginTop = '20px';
  totalLabel.style.marginBottom = '8px';
  totalLabel.style.width = '90%';
  totalLabel.style.textAlign = 'center';
  totalLabel.style.whiteSpace = 'nowrap';
  totalLabel.textContent = 'TOTAL SCORE';
  scoreContainer.appendChild(totalLabel);

  const totalScoreEl = document.createElement('div');
  totalScoreEl.style.fontSize = totalScoreFontSize + "px";
  totalScoreEl.style.color = 'yellow';
  totalScoreEl.style.width = '90%';
  totalScoreEl.style.textAlign = 'center';
  totalScoreEl.style.whiteSpace = 'nowrap';
  totalScoreEl.textContent = total;
  scoreContainer.appendChild(totalScoreEl);

  // Create a hyperlink at the bottom
  const linkEl = document.createElement('a');
  linkEl.href = "https://summit2025.trevorwithdata.com/tips_summary.html"; // Placeholder URL
  linkEl.textContent = "Link to resources!";
  linkEl.style.color = 'blue';
  linkEl.style.fontSize = (width * 0.04) + "px"; // Adjust as needed
  linkEl.style.marginTop = "100px";
  linkEl.style.display = 'none'; // Initially hide the link
  linkEl.style.textAlign = 'center';
  linkEl.target = "_blank"; // Open in new tab
  scoreContainer.appendChild(linkEl);

  firebase.database().ref("mechanics/showScore/linkVisible").on('value', snapshot => {
    const linkVisible = !!snapshot.val(); // Convert to boolean
    linkEl.style.display = linkVisible ? 'block' : 'none';
  });

}

