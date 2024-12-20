function startBreakout() {
    resetCanvas();
    isGameOver = false;

    // Create common components
    canvasContainer.appendChild(newScoreContainer());
    scoreContainer.appendChild(newScoreElement());
    scoreContainer.appendChild(newHighScoreElement());

    // Retrieve high score from Firebase
    if (username) {
        let userRef = window.db.ref('attendees');
        userRef.orderByChild('name').equalTo(username).once('value', snapshot => {
            if (snapshot.exists()) {
                let userData = snapshot.val();
                let userId = Object.keys(userData)[0];
                let user = userData[userId];
                highScore = user.breakout || 0;
                highScoreElement.innerText = 'High Score: ' + highScore;
            }
        });
    }

}