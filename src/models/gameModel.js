const db = require('../config/database');

// Get All Games (active only — for bot/public use)
const getAllGames = (callback) => {
  db.all(
    `SELECT * FROM games WHERE status = 'active'`,
    callback
  );
};

// Get All Games including inactive — for admin panel
const getAllGamesAdmin = (callback) => {
  db.all(
    `SELECT * FROM games ORDER BY created_at DESC`,
    callback
  );
};

// Get Game by ID
const getGameById = (gameId, callback) => {
  db.get(
    `SELECT * FROM games WHERE id = ?`,
    [gameId],
    callback
  );
};

// Create Game Session
const createGameSession = (userId, gameId, callback) => {
  db.run(
    `INSERT INTO game_sessions (user_id, game_id) VALUES (?, ?)`,
    [userId, gameId],
    function(err) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, this.lastID);
      }
    }
  );
};

// Update Game Session Result
const updateGameSession = (sessionId, result, score, callback) => {
  db.run(
    `UPDATE game_sessions SET result = ?, score = ?, ended_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [result, score, sessionId],
    callback
  );
};

module.exports = {
  getAllGames,
  getAllGamesAdmin,
  getGameById,
  createGameSession,
  updateGameSession
};
