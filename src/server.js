require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const gameApiRoutes = require('./routes/gameApiRoutes');

const apiEndpoints = [
  { method: 'GET', path: '/api/health', description: 'Health check' },
  { method: 'GET', path: '/api', description: 'API overview' },
  { method: 'GET', path: '/api/endpoints', description: 'List all available API endpoints' },
  { method: 'POST', path: '/api/users/register', description: 'Register a new user' },
  { method: 'POST', path: '/api/users/login', description: 'Login a user' },
  { method: 'POST', path: '/api/users/auto-login', description: 'Auto-login with telegram ID' },
  { method: 'GET', path: '/api/users/check/:telegram_id', description: 'Check if a user exists' },
  { method: 'GET', path: '/api/users/:id', description: 'Get a user by ID' },
  { method: 'GET', path: '/api/users/:id/balance', description: 'Get user balance' },
  { method: 'PUT', path: '/api/users/:id/username', description: 'Update username' },
  { method: 'PUT', path: '/api/users/:id/password', description: 'Update password' },
  { method: 'GET', path: '/api/games', description: 'Get all games' },
  { method: 'GET', path: '/api/games/:id', description: 'Get a game by ID' },
  { method: 'POST', path: '/api/games/:id/start', description: 'Start a game session' },
  { method: 'POST', path: '/api/games/session/:session_id/end', description: 'End a game session' },
  { method: 'POST', path: '/api/admin/games/login', description: 'Admin login' },
  { method: 'GET', path: '/api/admin/games/users', description: 'Get all users (admin)' },
  { method: 'GET', path: '/api/admin/games/admin-balance', description: 'Get admin balance' },
  { method: 'GET', path: '/api/admin/games/all-games', description: 'Get all games including inactive (admin)' },
  { method: 'POST', path: '/api/admin/games', description: 'Create a game (admin)' },
  { method: 'PUT', path: '/api/admin/games/:id', description: 'Update a game (admin)' },
  { method: 'DELETE', path: '/api/admin/games/:id', description: 'Delete a game (admin)' },
  { method: 'GET', path: '/api/scores/leaderboard', description: 'Get leaderboard' },
  { method: 'GET', path: '/api/scores/:user_id', description: 'Get user scores' },
  { method: 'POST', path: '/api/game-api/player-balance', description: 'Get player balance for a game' },
  { method: 'POST', path: '/api/game-api/game-action', description: 'Process game balance action' },
  { method: 'POST', path: '/api/game-api/verify', description: 'Verify a player' },
  { method: 'POST', path: '/api/games/start-bet', description: 'Start a Dama-style bet' },
  { method: 'POST', path: '/dama', description: 'Direct partner callback for balance and game actions' }
];

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5000',
  'https://dama-game-backend.onrender.com',
  'https://dama-game-6d2b.onrender.com'
];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Token']
}));
app.use(express.json());

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/games', require('./routes/gameRoutes'));
app.use('/api/admin/games', require('./routes/adminRoutes'));
app.use('/api/scores', require('./routes/scoreRoutes'));
app.use('/api/game-api', gameApiRoutes);
app.post('/dama', gameApiRoutes.handleDamaCallback);

// API overview
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Telegram Games Backend API',
    count: apiEndpoints.length,
    endpoints: apiEndpoints
  });
});

// List all API endpoints
app.get('/api/endpoints', (req, res) => {
  res.json({
    success: true,
    count: apiEndpoints.length,
    endpoints: apiEndpoints
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📝 API Documentation:`);
  console.log(`   - Health: GET /api/health`);
  console.log(`   - List endpoints: GET /api/endpoints`);
  console.log(`   - API overview: GET /api`);
  console.log(`   - Register: POST /api/users/register`);
  console.log(`   - Login: POST /api/users/login`);
  console.log(`   - Games: GET /api/games (requires JWT token)`);
});

module.exports = app;
