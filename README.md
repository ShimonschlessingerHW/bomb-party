# 💣 Bomb Party

A real-time multiplayer word game for your class — inspired by jklm.fun's Bomb Party.  
Type a word containing the shown letters **before the bomb explodes!**

---

## Setup (one-time)

### 1. Firebase Project
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (or use an existing one)
3. Click **Firestore Database** in the left sidebar → Create database → **Start in test mode** → Next → Done
4. Click the gear ⚙ → **Project Settings** → scroll to **Your apps** → click `</>` (Web)
5. Register the app, then copy the `firebaseConfig` values into `public/firebase-config.js`

### 2. Firestore Security Rules (for class use)
In Firebase Console → Firestore → Rules, paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 3. Run Locally (for development/class use)
```bash
# From the bomb-party/ folder
python3 -m http.server 8080 --directory public
# Then open: http://localhost:8080
```

### 4. Deploy to Firebase Hosting (so classmates can access it)
```bash
npm install -g firebase-tools
firebase login
firebase deploy
```
Firebase will give you a URL everyone can use!

---

## How to Play

1. **Create a room** — enter your name, click "Create Room", share the 4-letter code
2. **Join a room** — enter your name and the room code, click "Join"
3. Host clicks **▶ Start Game** once everyone is in
4. A letter combination (like `ER`, `ING`, `OUR`) appears on the bomb
5. The current player types a word containing those letters and presses **Enter**
6. **Fail** to submit a valid word before the timer runs out → lose a ❤
7. Lose all hearts → eliminated
8. Last player standing **wins!**

---

## How It Works (Tech)

- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Backend**: Firebase Firestore (real-time database)
- **Hosting**: Firebase Hosting or any static file server
- **Word validation**: Free Dictionary API + bundled fallback wordlist

---

## Project Structure
```
bomb-party/
├── public/
│   ├── index.html          # Main SPA
│   ├── style.css           # Dark theme
│   ├── game.js             # Game logic + Firebase
│   ├── words.js            # Word validation + prompts
│   └── firebase-config.js  # ← FILL IN YOUR CONFIG HERE
├── firebase.json           # Firebase hosting config
├── .firebaserc             # Firebase project ID
└── README.md
```
