// src/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createWorker, getRouter } = require('./mediasoup-config');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'https://media-soup-1.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000'
];

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: ALLOWED_ORIGINS
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get public IP for WebRTC (auto-detect on Render)
let announcedIp = process.env.ANNOUNCED_IP || '127.0.0.1';

const getPublicIp = async () => {
  if (announcedIp !== 'auto') return;
  try {
    const response = await fetch('https://api.ipify.org');
    announcedIp = await response.text();
    console.log('Auto-detected public IP:', announcedIp);
  } catch (err) {
    console.error('Failed to get public IP, using 127.0.0.1:', err.message);
    announcedIp = '127.0.0.1';
  }
};

// Create WebRTC Transport helper
const createWebRtcTransport = async (router) => {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transport.on('dtlsstatechange', dtlsState => {
    if (dtlsState === 'closed') {
      transport.close();
    }
  });

  transport.on('close', () => {
    console.log('Transport closed');
  });

  return transport;
};

// Store rooms and peers
const rooms = new Map();
const peers = new Map();

// Initialize MediaSoup Worker and Router
(async () => {
  await getPublicIp();
  await createWorker();
  console.log('MediaSoup worker and router created');
})();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoom', async ({ username, roomId }) => {
    console.log(`${username} is joining room: ${roomId}`);
    
    // Store peer info
    peers.set(socket.id, { username, roomId, socket });
    
    // Create or get room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { peers: new Set() });
    }
    rooms.get(roomId).peers.add(socket.id);
    
    socket.join(roomId);
    
    // Get existing peers in room
    const existingPeers = Array.from(rooms.get(roomId).peers)
      .filter(id => id !== socket.id)
      .map(id => ({ id, username: peers.get(id)?.username }));

    // Notify the joining user
    socket.emit('roomJoined', { 
      username, 
      roomId,
      existingPeers 
    });

    // Notify others in the room
    socket.to(roomId).emit('newParticipant', { 
      id: socket.id, 
      username 
    });

    // Create transport for the client
    const router = getRouter();
    if (router) {
      const transport = await createWebRtcTransport(router);
      socket.emit('transportCreated', {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      });
    }
  });

  socket.on('leaveRoom', ({ username, roomId }) => {
    handleLeaveRoom(socket, username, roomId);
  });

  socket.on('disconnect', () => {
    const peer = peers.get(socket.id);
    if (peer) {
      handleLeaveRoom(socket, peer.username, peer.roomId);
    }
    console.log('Client disconnected:', socket.id);
  });
});

const handleLeaveRoom = (socket, username, roomId) => {
  socket.leave(roomId);
  peers.delete(socket.id);
  
  const room = rooms.get(roomId);
  if (room) {
    room.peers.delete(socket.id);
    
    // Notify others
    socket.to(roomId).emit('participantLeft', { 
      id: socket.id, 
      username 
    });
    
    // Delete room if empty
    if (room.peers.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted`);
    }
  }
};

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
