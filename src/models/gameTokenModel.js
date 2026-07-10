const db     = require('../config/database');
const crypto = require('crypto');

// ── Queries ───────────────────────────────────────────────────────────────────

const getAll = ({ limit, offset } = {}, callback) => {
  if (typeof limit === 'number') {
    db.all(
      `SELECT gt.*, g.name AS game_name, g.status AS game_status
       FROM game_tokens gt
       JOIN games g ON g.id = gt.game_id
       ORDER BY gt.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset || 0],
      callback
    );
  } else {
    db.all(
      `SELECT gt.*, g.name AS game_name, g.status AS game_status
       FROM game_tokens gt
       JOIN games g ON g.id = gt.game_id
       ORDER BY gt.created_at DESC`,
      callback
    );
  }
};

const count = (callback) => {
  db.get(`SELECT COUNT(*) AS total FROM game_tokens`, callback);
};

const getByGame = (gameId, callback) => {
  db.all(
    `SELECT gt.*, g.name AS game_name
     FROM game_tokens gt
     JOIN games g ON g.id = gt.game_id
     WHERE gt.game_id = ?
     ORDER BY gt.created_at DESC`,
    [gameId],
    callback
  );
};

const getActiveByGame = (gameId, callback) => {
  db.get(
    `SELECT token FROM game_tokens WHERE game_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [gameId],
    callback
  );
};

const findByToken = (token, callback) => {
  db.get(
    `SELECT gt.*, g.id AS game_id, g.name AS game_name, g.status AS game_status
     FROM game_tokens gt
     JOIN games g ON g.id = gt.game_id
     WHERE gt.token = ?`,
    [token],
    callback
  );
};

const create = ({ game_id, label, backend_url }, callback) => {
  const token = 'GT-' + crypto.randomBytes(16).toString('hex').toUpperCase();
  db.run(
    `INSERT INTO game_tokens (game_id, token, label, backend_url) VALUES (?, ?, ?, ?)`,
    [game_id, token, label || null, backend_url || null],
    function (err) { callback(err, { id: this.lastID, token }); }
  );
};

const update = (id, { label, status, token, backend_url }, callback) => {
  if (token) {
    // Check uniqueness first
    db.get(
      `SELECT id FROM game_tokens WHERE token = ? AND id != ?`,
      [token, id],
      (err, existing) => {
        if (err) return callback(err);
        if (existing) return callback(Object.assign(new Error('Token value already exists'), { code: 'DUPLICATE' }));
        db.run(
          `UPDATE game_tokens SET token = ?, label = ?, status = ?, backend_url = ? WHERE id = ?`,
          [token, label || null, status || 'active', backend_url || null, id],
          function (e) { callback(e, this.changes); }
        );
      }
    );
  } else {
    db.run(
      `UPDATE game_tokens SET label = ?, status = ?, backend_url = ? WHERE id = ?`,
      [label || null, status || 'active', backend_url || null, id],
      function (err) { callback(err, this.changes); }
    );
  }
};

const remove = (id, callback) => {
  db.run(`DELETE FROM game_tokens WHERE id = ?`, [id], function (err) { callback(err, this.changes); });
};

module.exports = { getAll, count, getByGame, getActiveByGame, findByToken, create, update, remove };
