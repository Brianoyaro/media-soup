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

// Store rooms, peers, transports, producers, and consumers
const rooms = new Map();
const peers = new Map();
const transports = new Map();
const producers = new Map();
const consumers = new Map();

// Initialize MediaSoup Worker and Router
(async () => {
  await getPublicIp();
  await createWorker();
  console.log('MediaSoup worker and router created');
})();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Get router RTP capabilities
  socket.on('getRouterRtpCapabilities', (callback) => {
    const router = getRouter();
    if (router) {
      callback(router.rtpCapabilities);
    } else {
      callback({ error: 'Router not ready' });
    }
  });

  socket.on('joinRoom', async ({ username, roomId }) => {
    console.log(`${username} is joining room: ${roomId}`);
    
    // Store peer info
    peers.set(socket.id, { 
      username, 
      roomId, 
      socket,
      producers: new Map(),
      consumers: new Map(),
      transports: new Map()
    });
    
    // Create or get room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { peers: new Set(), producers: new Map() });
    }
    rooms.get(roomId).peers.add(socket.id);
    
    socket.join(roomId);
    
    // Get existing peers and their producers
    const existingPeers = Array.from(rooms.get(roomId).peers)
      .filter(id => id !== socket.id)
      .map(id => {
        const peer = peers.get(id);
        const peerProducers = [];
        if (peer) {
          peer.producers.forEach((producer, producerId) => {
            peerProducers.push({
              producerId,
              kind: producer.kind
            });
          });
        }
        return { 
          id, 
          username: peer?.username,
          producers: peerProducers
        };
      });

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
  });

  // Create send transport
  socket.on('createProducerTransport', async (callback) => {
    try {
      const router = getRouter();
      const transport = await createWebRtcTransport(router);
      
      const peer = peers.get(socket.id);
      if (peer) {
        peer.transports.set(transport.id, transport);
      }
      transports.set(transport.id, { transport, socketId: socket.id, type: 'producer' });

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      });
    } catch (err) {
      console.error('Error creating producer transport:', err);
      callback({ error: err.message });
    }
  });

  // Create receive transport
  socket.on('createConsumerTransport', async (callback) => {
    try {
      const router = getRouter();
      const transport = await createWebRtcTransport(router);
      
      const peer = peers.get(socket.id);
      if (peer) {
        peer.transports.set(transport.id, transport);
      }
      transports.set(transport.id, { transport, socketId: socket.id, type: 'consumer' });

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      });
    } catch (err) {
      console.error('Error creating consumer transport:', err);
      callback({ error: err.message });
    }
  });

  // Connect transport
  socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
    try {
      const transportData = transports.get(transportId);
      if (!transportData) {
        return callback({ error: 'Transport not found' });
      }
      await transportData.transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (err) {
      console.error('Error connecting transport:', err);
      callback({ error: err.message });
    }
  });

  // Produce media
  socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
    try {
      const transportData = transports.get(transportId);
      if (!transportData) {
        return callback({ error: 'Transport not found' });
      }

      const producer = await transportData.transport.produce({ kind, rtpParameters });
      
      const peer = peers.get(socket.id);
      if (peer) {
        peer.producers.set(producer.id, producer);
        
        // Add producer to room
        const room = rooms.get(peer.roomId);
        if (room) {
          room.producers.set(producer.id, { 
            producer, 
            socketId: socket.id,
            username: peer.username 
          });
        }
      }
      
      producers.set(producer.id, { producer, socketId: socket.id });

      producer.on('transportclose', () => {
        producer.close();
        producers.delete(producer.id);
        if (peer) {
          peer.producers.delete(producer.id);
        }
      });

      // Notify other peers about new producer
      if (peer) {
        socket.to(peer.roomId).emit('newProducer', {
          producerId: producer.id,
          producerSocketId: socket.id,
          kind: producer.kind,
          username: peer.username
        });
      }

      callback({ id: producer.id });
    } catch (err) {
      console.error('Error producing:', err);
      callback({ error: err.message });
    }
  });

  // Consume media
  socket.on('consume', async ({ producerId, rtpCapabilities, transportId }, callback) => {
    try {
      const router = getRouter();
      
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: 'Cannot consume' });
      }

      const transportData = transports.get(transportId);
      if (!transportData) {
        return callback({ error: 'Transport not found' });
      }

      const consumer = await transportData.transport.consume({
        producerId,
        rtpCapabilities,
        paused: true // Start paused, resume after client is ready
      });

      const peer = peers.get(socket.id);
      if (peer) {
        peer.consumers.set(consumer.id, consumer);
      }
      consumers.set(consumer.id, { consumer, socketId: socket.id });

      consumer.on('transportclose', () => {
        consumer.close();
        consumers.delete(consumer.id);
        if (peer) {
          peer.consumers.delete(consumer.id);
        }
      });

      consumer.on('producerclose', () => {
        socket.emit('producerClosed', { consumerId: consumer.id, producerId });
        consumer.close();
        consumers.delete(consumer.id);
        if (peer) {
          peer.consumers.delete(consumer.id);
        }
      });

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });
    } catch (err) {
      console.error('Error consuming:', err);
      callback({ error: err.message });
    }
  });

  // Resume consumer
  socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    try {
      const consumerData = consumers.get(consumerId);
      if (!consumerData) {
        return callback({ error: 'Consumer not found' });
      }
      await consumerData.consumer.resume();
      callback({ success: true });
    } catch (err) {
      console.error('Error resuming consumer:', err);
      callback({ error: err.message });
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
  
  const peer = peers.get(socket.id);
  if (peer) {
    // Close all transports (this will close producers and consumers too)
    peer.transports.forEach((transport) => {
      transport.close();
    });
    
    // Clean up producers from room
    peer.producers.forEach((producer, producerId) => {
      producers.delete(producerId);
      const room = rooms.get(roomId);
      if (room) {
        room.producers.delete(producerId);
      }
    });
    
    // Clean up consumers
    peer.consumers.forEach((consumer, consumerId) => {
      consumers.delete(consumerId);
    });
    
    // Clean up transports
    peer.transports.forEach((transport, transportId) => {
      transports.delete(transportId);
    });
  }
  
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
