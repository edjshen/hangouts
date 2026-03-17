const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Auth middleware (simple token)
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findFirst({ where: { id: token } });
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  
  req.user = user;
  next();
};

// Get current user
app.get('/api/me', auth, async (req, res) => {
  res.json(req.user);
});

// Update status
app.post('/api/status', auth, async (req, res) => {
  const { status, lat, lng } = req.body;
  
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { 
      status: status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
      lat: lat || req.user.lat,
      lng: lng || req.user.lng,
      updatedAt: new Date()
    }
  });
  
  // Broadcast to friends
  const friends = await prisma.friend.findMany({
    where: { userId: req.user.id, status: 'ACCEPTED' },
    select: { friendId: true }
  });
  
  friends.forEach(f => {
    io.to(f.friendId).emit('friendUpdate', {
      id: user.id,
      status: user.status,
      lat: user.lat,
      lng: user.lng
    });
  });
  
  res.json(user);
});

// Get friends
app.get('/api/friends', auth, async (req, res) => {
  const friends = await prisma.friend.findMany({
    where: { 
      userId: req.user.id, 
      status: 'ACCEPTED' 
    },
    include: {
      friend: {
        select: { id: true, name: true, avatar: true, status: true, lat: true, lng: true }
      }
    }
  });
  
  res.json(friends.map(f => f.friend));
});

// Socket.IO for real-time
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(userId);
  });
  
  socket.on('updateLocation', async ({ userId, lat, lng }) => {
    await prisma.user.update({
      where: { id: userId },
      data: { lat, lng, updatedAt: new Date() }
    });
    
    // Store location history
    await prisma.location.create({
      data: { userId, lat, lng }
    });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🎯 Hangouts API on ${PORT}`);
});
