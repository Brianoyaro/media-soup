# MediaSoup WebRTC Application (React + Express + TailwindCSS)

A real-time communication application using MediaSoup WebRTC with a React frontend and Express backend.

## Project Structure

```
temp/
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js           # Express server with Socket.io
│       └── mediasoup-config.js # MediaSoup configuration
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       └── components/
│           ├── JoinScreen.jsx
│           ├── Controls.jsx
│           └── ParticipantView.jsx
└── README.md
```

## Prerequisites

- Node.js (v18 or higher)
- Build tools for MediaSoup (gcc, g++, make, python3)

### Install System Dependencies (Linux)

```bash
sudo apt-get install -y build-essential python3
```

## Installation

### Backend Setup

```bash
cd temp/backend
npm install
```

### Frontend Setup

```bash
cd temp/frontend
npm install
```

## Running the Application

### Start the Backend Server

```bash
cd temp/backend
npm start
```

The backend server will run on `http://localhost:3001`.

### Start the Frontend (in a separate terminal)

```bash
cd temp/frontend
npm run dev
```

The frontend will run on `http://localhost:5173`.

## Usage

1. Open your browser and navigate to `http://localhost:5173`
2. Enter your name and a room ID
3. Click "Join" to enter the room
4. Allow camera and microphone permissions when prompted
5. Use the controls to:
   - **Mute/Unmute**: Toggle your audio
   - **Stop/Start Video**: Toggle your video
   - **Leave Room**: Exit the room

## Features

- **React**: Modern component-based UI
- **TailwindCSS**: Utility-first CSS styling
- **Express**: Node.js backend server
- **Socket.io**: Real-time bidirectional communication
- **MediaSoup**: WebRTC SFU for media routing

## Tech Stack

### Frontend
- React 18
- Vite
- TailwindCSS
- Socket.io-client

### Backend
- Express
- Socket.io
- MediaSoup
- CORS

## License

ISC
