const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyTokenMiddleware } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');

// Admin Login (no token required)
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get(
    `SELECT * FROM users WHERE username = ?`,
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Verify password
      const passwordMatch = bcrypt.compareSync(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Generate token
      const token = generateToken(user.id, user.telegram_id);

      res.json({
        success: true,
        message: 'Login successful',
        token: token,
        user: {
          id: user.id,
          username: user.username
        }
      });
    }
  );
});

// Admin: Get all users with balance (requires JWT)
router.get('/users', verifyTokenMiddleware, (req, res) => {
  db.all(
    `SELECT u.id, u.username, u.phone_number, u.telegram_id, u.created_at,
            b.balance, b.coins
     FROM users u
     LEFT JOIN balances b ON b.user_id = u.id
     ORDER BY u.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, users: rows });
    }
  );
});

// Admin: Get admin balance (requires JWT)
router.get('/admin-balance', verifyTokenMiddleware, (req, res) => {
  db.get(`SELECT balance FROM admin_balances WHERE id = 1`, (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, balance: row ? row.balance : 0 });
  });
});

// Admin: Get cashier transactions (deposit/withdraw to cashiers)
router.get('/cashier-transactions', verifyTokenMiddleware, (req, res) => {
  db.all(`
    SELECT
      abt.id,
      abt.type,
      abt.amount,
      abt.note,
      abt.created_at,
      abt.user_id AS cashier_id,
      c.name AS cashier_name,
      c.username AS cashier_username
    FROM admin_balance_transactions abt
    LEFT JOIN cashiers c ON c.id = abt.user_id
    WHERE abt.type IN ('cashier_deposit', 'cashier_withdraw')
    ORDER BY abt.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, transactions: rows || [] });
  });
});


// Admin: Get ALL games including inactive (requires JWT)
router.get('/all-games', verifyTokenMiddleware, (req, res) => {
  const db = require('../config/database');
  db.all(`SELECT * FROM games ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, games: rows });
  });
});

// Get all games (public, no token required)
router.get('/list', (req, res) => {
  db.all(
    `SELECT * FROM games WHERE status = 'active'`,
    (err, games) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, games: games });
    }
  );
});

// Admin: Add new game (requires JWT)
router.post('/', verifyTokenMiddleware, (req, res) => {
  const { name, game_url } = req.body;

  if (!name || !game_url) {
    return res.status(400).json({ error: 'Name and Game URL are required' });
  }

  db.run(
    `INSERT INTO games (name, game_url, status) 
     VALUES (?, ?, 'active')`,
    [name, game_url],
    function(err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({ success: true, gameId: this.lastID, message: 'Game added successfully' });
    }
  );
});

// Admin: Update game
router.put('/:id', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, game_url, status } = req.body;

  if (!name || !game_url) {
    return res.status(400).json({ error: 'Name and Game URL are required' });
  }

  db.run(
    `UPDATE games SET name = ?, game_url = ?, status = ? WHERE id = ?`,
    [name, game_url, status, id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update game' });
      }
      res.json({ success: true, message: 'Game updated' });
    }
  );
});

// Admin: Delete game
router.delete('/:id', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM games WHERE id = ?`,
    [id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete game' });
      }
      res.json({ success: true, message: 'Game deleted' });
    }
  );
});

// Admin: Update user username
router.put('/users/:id/username', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  db.run(
    `UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [username, id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Username already taken' });
        }
        return res.status(500).json({ error: 'Failed to update username' });
      }
      res.json({ success: true, message: 'Username updated' });
    }
  );
});

// Admin: Reset user password
router.put('/users/:id/reset-password', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [hashedPassword, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to reset password' });
      }
      res.json({ success: true, message: 'Password reset successfully' });
    }
  );
});

// Admin: Delete user (requires JWT)
router.delete('/users/:id', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;

  db.serialize(() => {
    db.run(`DELETE FROM balances WHERE user_id = ?`, [id]);
    db.run(`DELETE FROM players WHERE user_id = ?`, [id]);
    db.run(`DELETE FROM game_sessions WHERE user_id = ?`, [id]);
    db.run(`DELETE FROM transactions WHERE user_id = ?`, [id]);
    db.run(`DELETE FROM admin_balance_transactions WHERE user_id = ?`, [id]);
    db.run(`DELETE FROM users WHERE id = ?`, [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete user' });
      }
      res.json({ success: true, message: 'User deleted successfully' });
    });
  });
});

// Admin: Deposit to user balance
router.post('/users/:id/deposit', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  db.run(
    `UPDATE balances SET balance = balance + ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?`,
    [amount, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to deposit' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User balance not found' });
      }
      // Log transaction
      db.run(
        `INSERT INTO transactions (user_id, type, amount, status, note) VALUES (?, 'deposit', ?, 'done', 'Admin deposit')`,
        [id, amount]
      );
      
      // Deduct from admin balance
      db.run(
        `UPDATE admin_balances SET balance = balance - ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1`,
        [amount],
        (adminErr) => {
          if (adminErr) console.error('Failed to deduct from admin balance:', adminErr.message);
          db.run(
            `INSERT INTO admin_balance_transactions (type, amount, user_id, note) VALUES ('deposit_deduction', ?, ?, 'Admin deposit deduction')`,
            [amount, id]
          );
        }
      );

      res.json({ success: true, message: `Deposited $${amount}` });
    }
  );
});

// Admin: Withdraw from user balance
router.post('/users/:id/withdraw', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  // Check current balance first
  db.get(`SELECT balance FROM balances WHERE user_id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'User balance not found' });
    }
    if (row.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    db.run(
      `UPDATE balances SET balance = balance - ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [amount, id],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to withdraw' });
        }
        // Log transaction
        db.run(
          `INSERT INTO transactions (user_id, type, amount, status, note) VALUES (?, 'withdraw', ?, 'done', 'Admin withdraw')`,
          [id, amount]
        );

        // Add to admin balance
        db.run(
          `UPDATE admin_balances SET balance = balance + ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1`,
          [amount],
          (adminErr) => {
            if (adminErr) console.error('Failed to add to admin balance:', adminErr.message);
            db.run(
              `INSERT INTO admin_balance_transactions (type, amount, user_id, note) VALUES ('withdraw_addition', ?, ?, 'Admin withdraw addition')`,
              [amount, id]
            );
          }
        );

        res.json({ success: true, message: `Withdrew $${amount}` });
      }
    );
  });
});

// Submit deposit request (pending, bot user)
router.post('/users/:id/request-deposit', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { amount, method, transaction_id, transaction_number } = req.body;

  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });
  if (!method) return res.status(400).json({ error: 'Payment method is required' });
  if (!transaction_id) return res.status(400).json({ error: 'Transaction ID is required' });

  db.run(
    `INSERT INTO transactions (user_id, type, amount, method, transaction_id, transaction_number, status, note)
     VALUES (?, 'deposit', ?, ?, ?, ?, 'pending', 'User deposit request')`,
    [id, amount, method, transaction_id, transaction_number || null],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to save request' });
      res.json({ success: true, transactionId: this.lastID, message: 'Deposit request submitted' });
    }
  );
});

// Submit withdraw request (pending, bot user)
router.post('/users/:id/request-withdraw', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { amount, method, transaction_id, transaction_number } = req.body;

  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });
  if (!method) return res.status(400).json({ error: 'Payment method is required' });
  if (!transaction_id) return res.status(400).json({ error: 'Transaction ID is required' });

  db.get(`SELECT balance FROM balances WHERE user_id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Balance not found' });
    if (row.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    db.run(
      `INSERT INTO transactions (user_id, type, amount, method, transaction_id, transaction_number, status, note)
       VALUES (?, 'withdraw', ?, ?, ?, ?, 'pending', 'User withdraw request')`,
      [id, amount, method, transaction_id, transaction_number || null],
      function(err2) {
        if (err2) return res.status(500).json({ error: 'Failed to save request' });
        res.json({ success: true, transactionId: this.lastID, message: 'Withdraw request submitted' });
      }
    );
  });
});

// Check transaction by system transaction_id (bot user)
router.get('/users/:id/transaction-check', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { ref } = req.query;

  if (!ref) return res.status(400).json({ error: 'Transaction ID is required' });

  db.get(
    `SELECT * FROM transactions WHERE user_id = ? AND transaction_id = ? ORDER BY created_at DESC LIMIT 1`,
    [id, ref],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!row) return res.status(404).json({ error: 'Transaction not found' });
      res.json({ success: true, transaction: row });
    }
  );
});

// Admin: Update transaction status (approve/reject deposit/withdraw)
router.put('/transactions/:txId/status', verifyTokenMiddleware, (req, res) => {
  const { txId } = req.params;
  const { status, rejection_reason } = req.body;

  if (!['pending', 'done', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (status === 'rejected' && !rejection_reason) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  db.get(`SELECT * FROM transactions WHERE id = ?`, [txId], (err, tx) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    db.run(
      `UPDATE transactions SET status = ?, rejection_reason = ? WHERE id = ?`,
      [status, rejection_reason || null, txId],
      function(err2) {
        if (err2) return res.status(500).json({ error: 'Failed to update status' });

        // Approve deposit → credit balance
        if (status === 'done' && tx.type === 'deposit' && tx.status !== 'done') {
          db.run(
            `UPDATE balances SET balance = balance + ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?`,
            [tx.amount, tx.user_id]
          );
          db.run(
            `UPDATE admin_balances SET balance = balance - ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1`,
            [tx.amount]
          );
          db.run(
            `INSERT INTO admin_balance_transactions (type, amount, user_id, note) VALUES ('deposit_deduction', ?, ?, 'Approved user deposit')`,
            [tx.amount, tx.user_id]
          );
        }
        // Approve withdraw → debit balance
        if (status === 'done' && tx.type === 'withdraw' && tx.status !== 'done') {
          db.run(
            `UPDATE balances SET balance = balance - ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?`,
            [tx.amount, tx.user_id]
          );
          db.run(
            `UPDATE admin_balances SET balance = balance + ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1`,
            [tx.amount]
          );
          db.run(
            `INSERT INTO admin_balance_transactions (type, amount, user_id, note) VALUES ('withdraw_addition', ?, ?, 'Approved user withdraw')`,
            [tx.amount, tx.user_id]
          );
        }

        res.json({ success: true, message: `Transaction ${status}` });
      }
    );
  });
});

// Admin: Balance summary across all users
router.get('/balance-summary', verifyTokenMiddleware, (req, res) => {
  db.get(
    `SELECT
       COALESCE(SUM(balance), 0) AS total_balance,
       COUNT(*) AS total_users
     FROM balances`,
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      db.get(
        `SELECT
           COALESCE(SUM(CASE WHEN type='deposit'  AND status='done' THEN amount ELSE 0 END), 0) AS total_deposited,
           COALESCE(SUM(CASE WHEN type='withdraw' AND status='done' THEN amount ELSE 0 END), 0) AS total_withdrawn,
           COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END), 0)                  AS pending_amount,
           COUNT(CASE WHEN status='pending'  THEN 1 END) AS pending_count,
           COUNT(CASE WHEN status='done'     THEN 1 END) AS done_count,
           COUNT(CASE WHEN status='rejected' THEN 1 END) AS rejected_count
         FROM transactions`,
        (err2, txRow) => {
          if (err2) return res.status(500).json({ error: 'Database error' });
          res.json({ success: true, summary: { ...row, ...txRow } });
        }
      );
    }
  );
});

// Admin: Get all pending transactions
router.get('/transactions', verifyTokenMiddleware, (req, res) => {
  const status = req.query.status || 'pending';
  db.all(
    `SELECT t.*, u.username, u.phone_number
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.status = ?
     ORDER BY t.created_at DESC`,
    [status],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, transactions: rows });
    }
  );
});

// Self deposit (bot user initiates — direct, admin-confirmed)
router.post('/users/:id/self-deposit', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { amount, note } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  db.run(
    `UPDATE balances SET balance = balance + ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?`,
    [amount, id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to deposit' });
      if (this.changes === 0) return res.status(404).json({ error: 'Balance record not found' });

      db.run(
        `INSERT INTO transactions (user_id, type, amount, note) VALUES (?, 'deposit', ?, ?)`,
        [id, amount, note || 'User deposit']
      );
      res.json({ success: true, message: `Deposited $${amount}` });
    }
  );
});

// Self withdraw (bot user initiates)
router.post('/users/:id/self-withdraw', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { amount, note } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  db.get(`SELECT balance FROM balances WHERE user_id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Balance record not found' });
    if (row.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    db.run(
      `UPDATE balances SET balance = balance - ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [amount, id],
      function(updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Failed to withdraw' });

        db.run(
          `INSERT INTO transactions (user_id, type, amount, note) VALUES (?, 'withdraw', ?, ?)`,
          [id, amount, note || 'User withdraw']
        );
        res.json({ success: true, message: `Withdrew $${amount}` });
      }
    );
  });
});

// Get transaction history for a user
router.get('/users/:id/transactions', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  db.all(
    `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [id, limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, transactions: rows });
    }
  );
});

// ── Game Tokens ───────────────────────────────────────────────────────────────

// Get active token for a game (used by bot to build launch URL)
router.get('/game-tokens/active/:gameId', verifyTokenMiddleware, (req, res) => {
  db.get(
    `SELECT token FROM game_tokens WHERE game_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [req.params.gameId],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, token: row ? row.token : null });
    }
  );
});

// Get all tokens (with game name)
router.get('/game-tokens', verifyTokenMiddleware, (req, res) => {
  db.all(
    `SELECT gt.*, g.name AS game_name, g.status AS game_status
     FROM game_tokens gt
     JOIN games g ON g.id = gt.game_id
     ORDER BY gt.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, tokens: rows });
    }
  );
});

// Get tokens for a specific game
router.get('/game-tokens/game/:gameId', verifyTokenMiddleware, (req, res) => {
  db.all(
    `SELECT gt.*, g.name AS game_name FROM game_tokens gt
     JOIN games g ON g.id = gt.game_id
     WHERE gt.game_id = ?
     ORDER BY gt.created_at DESC`,
    [req.params.gameId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, tokens: rows });
    }
  );
});

// Generate a new token for a game
router.post('/game-tokens', verifyTokenMiddleware, (req, res) => {
  const { game_id, label, backend_url } = req.body;
  if (!game_id) return res.status(400).json({ error: 'game_id is required' });

  // Generate a secure random token
  const crypto = require('crypto');
  const token = 'GT-' + crypto.randomBytes(16).toString('hex').toUpperCase();

  db.run(
    `INSERT INTO game_tokens (game_id, token, label, backend_url) VALUES (?, ?, ?, ?)`,
    [game_id, token, label || null, backend_url || null],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to generate token' });
      res.json({ success: true, tokenId: this.lastID, token, message: 'Token generated' });
    }
  );
});

// Update token label, status, token value, or backend_url
router.put('/game-tokens/:id', verifyTokenMiddleware, (req, res) => {
  const { label, status, token, backend_url } = req.body;

  if (token) {
    db.get(
      `SELECT id FROM game_tokens WHERE token = ? AND id != ?`,
      [token, req.params.id],
      (err, existing) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (existing) return res.status(409).json({ error: 'Token value already exists' });

        db.run(
          `UPDATE game_tokens SET token = ?, label = ?, status = ?, backend_url = ? WHERE id = ?`,
          [token, label || null, status || 'active', backend_url || null, req.params.id],
          function(err2) {
            if (err2) return res.status(500).json({ error: 'Failed to update token' });
            res.json({ success: true, message: 'Token updated' });
          }
        );
      }
    );
  } else {
    db.run(
      `UPDATE game_tokens SET label = ?, status = ?, backend_url = ? WHERE id = ?`,
      [label || null, status || 'active', backend_url || null, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update token' });
        res.json({ success: true, message: 'Token updated' });
      }
    );
  }
});

// Delete token
router.delete('/game-tokens/:id', verifyTokenMiddleware, (req, res) => {
  db.run(`DELETE FROM game_tokens WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete token' });
    res.json({ success: true, message: 'Token deleted' });
  });
});

// ── Cashier CRUD ──────────────────────────────────────────────────────────────

// Get all cashiers
router.get('/cashiers', verifyTokenMiddleware, (req, res) => {
  db.all(
    `SELECT id, name, username, balance, status, created_at FROM cashiers ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, cashiers: rows });
    }
  );
});

// Add cashier
router.post('/cashiers', verifyTokenMiddleware, (req, res) => {
  const { name, username, password, balance } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Name, username and password are required' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  db.run(
    `INSERT INTO cashiers (name, username, password, balance) VALUES (?, ?, ?, ?)`,
    [name, username, hashed, parseFloat(balance) || 0],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
        return res.status(500).json({ error: 'Failed to create cashier' });
      }
      res.json({ success: true, cashierId: this.lastID, message: 'Cashier created' });
    }
  );
});

// Update cashier
router.put('/cashiers/:id', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, username, password, status } = req.body;
  if (!name || !username) return res.status(400).json({ error: 'Name and username are required' });

  if (password) {
    const hashed = bcrypt.hashSync(password, 10);
    db.run(
      `UPDATE cashiers SET name=?, username=?, password=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [name, username, hashed, status || 'active', id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
          return res.status(500).json({ error: 'Failed to update cashier' });
        }
        res.json({ success: true, message: 'Cashier updated' });
      }
    );
  } else {
    db.run(
      `UPDATE cashiers SET name=?, username=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [name, username, status || 'active', id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
          return res.status(500).json({ error: 'Failed to update cashier' });
        }
        res.json({ success: true, message: 'Cashier updated' });
      }
    );
  }
});

// Delete cashier
router.delete('/cashiers/:id', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM cashiers WHERE id=?`, [id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete cashier' });
    res.json({ success: true, message: 'Cashier deleted' });
  });
});

// Deposit to cashier balance  (admin balance -= amount)
router.post('/cashiers/:id/deposit', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

  // 1. Check admin has enough balance
  db.get(`SELECT balance FROM admin_balances WHERE id = 1`, (err, adminRow) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!adminRow || adminRow.balance < amount)
      return res.status(400).json({ error: 'Insufficient admin balance' });

    // 2. Add to cashier balance
    db.run(
      `UPDATE cashiers SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id=?`,
      [amount, id],
      function(err2) {
        if (err2) return res.status(500).json({ error: 'Failed to deposit' });
        if (this.changes === 0) return res.status(404).json({ error: 'Cashier not found' });

        // 3. Deduct from admin balance
        db.run(
          `UPDATE admin_balances SET balance = balance - ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1`,
          [amount],
          (err3) => {
            if (err3) return res.status(500).json({ error: 'Failed to update admin balance' });

            // 4. Log transaction
            db.run(
              `INSERT INTO admin_balance_transactions (type, amount, user_id, note)
               VALUES ('cashier_deposit', ?, ?, ?)`,
              [amount, id, `Deposited $${amount} to cashier #${id}`],
              () => {}
            );

            res.json({ success: true, message: `Deposited $${amount} to cashier` });
          }
        );
      }
    );
  });
});

// Withdraw from cashier balance  (admin balance += amount)
router.post('/cashiers/:id/withdraw', verifyTokenMiddleware, (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

  // 1. Check cashier has enough balance
  db.get(`SELECT balance FROM cashiers WHERE id=?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Cashier not found' });
    if (row.balance < amount) return res.status(400).json({ error: 'Insufficient cashier balance' });

    // 2. Deduct from cashier balance
    db.run(
      `UPDATE cashiers SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id=?`,
      [amount, id],
      function(err2) {
        if (err2) return res.status(500).json({ error: 'Failed to withdraw' });

        // 3. Add back to admin balance
        db.run(
          `UPDATE admin_balances SET balance = balance + ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1`,
          [amount],
          (err3) => {
            if (err3) return res.status(500).json({ error: 'Failed to update admin balance' });

            // 4. Log transaction
            db.run(
              `INSERT INTO admin_balance_transactions (type, amount, user_id, note)
               VALUES ('cashier_withdraw', ?, ?, ?)`,
              [amount, id, `Withdrew $${amount} from cashier #${id}`],
              () => {}
            );

            res.json({ success: true, message: `Withdrew $${amount} from cashier` });
          }
        );
      }
    );
  });
});

module.exports = router;
