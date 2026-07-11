const jwt = require('jsonwebtoken');

const signLaunchToken = ({ phone, username, balance, gameId }) => {
  const secret = process.env.DAMA_LAUNCH_SECRET;
  if (!secret) throw new Error('DAMA_LAUNCH_SECRET is not configured');

  const payload = { phone, username, balance, gameId };
  return jwt.sign(payload, secret, { expiresIn: '5m' });
};

const verifyLaunchToken = (launchToken) => {
  const secret = process.env.DAMA_LAUNCH_SECRET;
  if (!secret) throw new Error('DAMA_LAUNCH_SECRET is not configured');

  return jwt.verify(launchToken, secret);
};

module.exports = { signLaunchToken, verifyLaunchToken };
