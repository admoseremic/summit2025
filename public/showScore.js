// showScore.js
// showScore.js
export function showScoreScreen() {
  /* ---------- 1. clear & size the wrapper exactly as before ---------- */
  const container = document.getElementById('gameContent');
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.id = 'scoreWrapper';
  Object.assign(wrapper.style, { position: 'relative', padding: '4px', margin: 'auto' });
  container.appendChild(wrapper);

  const ASPECT_RATIO = 9 / 16;
  const availW = window.innerWidth - 8;
  const availH = window.innerHeight - 8;
  const height = (availW / availH > ASPECT_RATIO) ? availH : availW / ASPECT_RATIO;
  const width = height * ASPECT_RATIO;

  const scoreContainer = document.createElement('div');
  scoreContainer.id = 'scoreScreen';
  Object.assign(scoreContainer.style, {
    width: width + 'px',
    height: height + 'px',
    border: '4px solid white',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    boxSizing: 'border-box',
    padding: '10px',
    fontFamily: '"Press Start 2P", monospace'
  });
  wrapper.appendChild(scoreContainer);

  /* ---------- 2. username & individual scores ---------- */
  const usernameSize = width * 0.07;
  const scoreSize = width * 0.05;
  const totalLblSize = width * 0.06;
  const totalValSize = width * 0.08;

  const username = localStorage.getItem('username') || 'Guest';
  const nameEl = document.createElement('h2');
  Object.assign(nameEl.style, {
    color: 'red', fontSize: usernameSize + 'px',
    marginBottom: '10px', width: '90%', textAlign: 'center', whiteSpace: 'nowrap'
  });
  nameEl.textContent = username;
  scoreContainer.appendChild(nameEl);

  const games = ['breakout', 'frogger', 'spaceinvaders', 'runner'];
  let total = 0;
  games.forEach(game => {
    const score = parseInt(localStorage.getItem('highScore_' + game)) || 0;
    if (score > 0) {
      total += score;
      const line = document.createElement('div');
      line.style.cssText = `font-size:${scoreSize}px;color:white;margin-bottom:8px;width:90%;text-align:center;white-space:nowrap`;
      line.textContent =
        (game === 'spaceinvaders' ? 'Invaders' : game.charAt(0).toUpperCase() + game.slice(1)) + ': ' + score;
      scoreContainer.appendChild(line);
    }
  });

  /* ---------- 3. TOTAL ---------- */
  const totalLbl = document.createElement('div');
  Object.assign(totalLbl.style, {
    fontSize: totalLblSize + 'px', color: 'yellow', margin: '20px 0 8px',
    width: '90%', textAlign: 'center', whiteSpace: 'nowrap'
  });
  totalLbl.textContent = 'TOTAL SCORE';
  scoreContainer.appendChild(totalLbl);

  const totalVal = document.createElement('div');
  Object.assign(totalVal.style, {
    fontSize: totalValSize + 'px', color: 'yellow',
    width: '90%', textAlign: 'center', whiteSpace: 'nowrap'
  });
  totalVal.textContent = total;
  scoreContainer.appendChild(totalVal);

  /* ---------- 4. NEW “play-a-game” button row (hidden by default) ---------- */
  const btnRow = document.createElement('div');
  Object.assign(btnRow.style, {
    display: 'none',            // toggled by Firebase mechanic
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '10px',
    margin: '40px 0 20px'
  });

  const makeBtn = (label, gameName) => {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      backgroundColor: '#000',
      color: '#fff',
      fontFamily: '"Press Start 2P", monospace',
      fontSize: (width * 0.035) + 'px',
      padding: '10px 18px',
      border: '4px solid white',
      cursor: 'pointer'
    });
    b.onclick = () => import('./arcadeCore.js').then(({ loadGame }) => loadGame(gameName));
    return b;
  };

  btnRow.appendChild(makeBtn('Breakout', 'breakout'));
  btnRow.appendChild(makeBtn('Frogger', 'frogger'));
  btnRow.appendChild(makeBtn('Invaders', 'spaceinvaders'));
  btnRow.appendChild(makeBtn('Runner', 'runner'));
  scoreContainer.appendChild(btnRow);

  /* ---------- 5. resources link (unchanged) ---------- */
  const linkEl = document.createElement('a');
  Object.assign(linkEl.style, {
    color: 'blue', fontSize: (width * 0.04) + 'px', marginTop: '100px',
    display: 'none', textAlign: 'center'
  });
  linkEl.href = 'https://summit2025.trevorwithdata.com/tips_summary.html';
  linkEl.target = '_blank';
  linkEl.textContent = 'Link to resources!';
  scoreContainer.appendChild(linkEl);

  /* ---------- 6. Firebase bindings ---------- */
  const db = firebase.database();
  db.ref('mechanics/showScore/linkVisible')
    .on('value', snap => linkEl.style.display = snap.val() ? 'block' : 'none');

  db.ref('mechanics/showScore/allowAllGames')
    .on('value', snap => btnRow.style.display = snap.val() ? 'flex' : 'none');
}

