# Summit Games Project

This repository contains the source code for the **Summit Games** project, which includes a Firebase Hosting setup, Cloud Functions, and an automated deployment workflow using GitHub Actions. The project consists of an interactive web app that stores and displays game leaderboard data via Firebase Realtime Database.

## Project Overview

### Main Features
- **Interactive Game Leaderboard**: Users can enter their names and see their scores for different games.
- **Firebase Integration**: Uses Firebase Realtime Database to store users and their scores.
- **Automatic Deployment**: GitHub Actions workflow automatically deploys changes to Firebase Hosting when updates are pushed to the `main` branch.

### Folder Structure
```
.
├── functions/                # Backend Firebase functions (Node.js environment)
│   ├── index.js             # Main backend logic
│   ├── package.json         # Dependencies for the Cloud Functions
│   └── package-lock.json
├── public/                   # Firebase hosting files
│   ├── index.html           # Main HTML file (entry point)
│   ├── app.js               # Main JavaScript for front-end logic
│   └── firebase.json        # Firebase configuration
├── .github/
│   └── workflows/           # GitHub Actions workflows
│       └── firebase-hosting.yml  # Workflow for automated deployment to Firebase Hosting
├── .gitignore                # Files to ignore in Git
└── README.md                 # Project documentation (this file)
```

## Firebase Setup
This project uses **Firebase Realtime Database** to store game data and scores, and **Firebase Hosting** for deploying the web application. It also includes Cloud Functions for secure retrieval of the Firebase API key.

### Firebase Configuration
The Firebase configuration, including the API key, is no longer stored directly in the `index.html` file. Instead, it is securely retrieved from a Cloud Function to enhance security.

### Deploying to Firebase
- You can manually deploy by running:
  ```sh
  firebase deploy --only hosting
  ```
  This will deploy only the Hosting part of Firebase, excluding functions for faster deployments.

## GitHub Actions Automation
We have set up **GitHub Actions** to automate Firebase deployments whenever changes are pushed to the `main` branch. The workflow file is located in `.github/workflows/firebase-hosting.yml`.

### GitHub Actions Workflow (`firebase-hosting.yml`)
This workflow automatically deploys to Firebase Hosting by:
1. Checking out the repository code.
2. Setting up Node.js.
3. Installing Firebase CLI using the `w9jds/firebase-action` GitHub action.
4. Deploying to Firebase Hosting using the `FIREBASE_TOKEN` stored in GitHub secrets.

**Important**: Ensure you have a GitHub secret named `FIREBASE_TOKEN` set up, which is required for authentication during the deployment process.

### Adding the Workflow
Here’s how the automated deployment works:
- On every push to the `main` branch, the workflow runs and deploys the latest changes to Firebase Hosting.
- This process is handled by `.github/workflows/firebase-hosting.yml`, ensuring that the live site always reflects the latest changes in the repository.

## Setup Instructions

1. **Clone the Repository**:
   ```sh
   git clone <repository-url>
   ```
2. **Install Dependencies**:
   - For the backend functions:
     ```sh
     cd functions
     npm install
     ```
3. **Firebase Login**:
   Ensure you are logged into Firebase CLI:
   ```sh
   firebase login
   ```
4. **Push Changes to Trigger Deployment**:
   Commit and push changes to the `main` branch to automatically deploy them via GitHub Actions.

## Notes
- **GitHub Secrets**: Remember to add your Firebase token (`FIREBASE_TOKEN`) as a secret in your GitHub repository settings for automated deployment.
- **.gitignore**: The `.gitignore` file includes the `node_modules/` folder, `.firebase/`, and any other unnecessary files to keep your repository clean.

## Useful Commands
- **Manual Deployment**: Deploy only hosting without functions:
  ```sh
  firebase deploy --only hosting
  ```
- **Add and Commit Changes**:
  ```sh
  git add .
  git commit -m "Your commit message"
  ```
- **Push to GitHub**:
  ```sh
  git push origin main
  ```

## Summary
This project demonstrates an end-to-end deployment pipeline using Firebase Hosting, Firebase Functions, and GitHub Actions for automated deployment. The application itself provides an interactive gaming leaderboard using Firebase Realtime Database for data storage, and it utilizes a secure method for handling the Firebase API key.

Feel free to contribute or raise any issues you encounter. Let's keep building! 🚀
