/**
 * launchToken.js
 *
 * Short-lived, signed tokens that carry player context for game launches.
 * Uses DAMA_LAUNCH_SECRET — completely separate from JWT_SECRET (admin auth).
 *
 * Payload contains only what the game needs to identify the player and their
 * starting balance. Nothing else sensitive is included.
 *
 * Expiry: 5 minutes — long enough for a player to tap the button and load the
 * game, short enough to be useless if intercepted.
 */

const jwt = require('jsonwebtoken');

const secret = () => {
  const s = process.env.DAMA_LAUNCH_SECRET;
  if (!s) throw new Error('DAMA_LAUNCH_SECRET is not set');
  return s;
};

const EXPIRY = '5m';

/**
 * Sign a launch token.
 *
 * @param {{ phone: string, username: string, balance: number, gameId: string|number }} payload
 * @returns {string}  signed JWT
 */
const signLaunchToken = ({ phone, username, balance, gameId }) => {
  return jwt.sign(
    {
      phone:    phone    || '',
      username: username || '',
      balance:  Number(balance  ?? 0),
      gameId:   String(gameId   ?? ''),
    },
    secret(),
    { expiresIn: EXPIRY }
  );
};

/**
 * Verify and decode a launch token.
 * Returns the decoded payload or throws on invalid/expired.
 *
 * @param {string} token
 * @returns {{ phone, username, balance, gameId, iat, exp }}
 */
const verifyLaunchToken = (token) => {
  return jwt.verify(token, secret());
};

module.exports = { signLaunchToken, verifyLaunchToken, EXPIRY };
