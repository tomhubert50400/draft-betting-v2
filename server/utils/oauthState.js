const { randomBytes, timingSafeEqual } = require('node:crypto');

function createState() {
  return randomBytes(32).toString('hex');
}

function verifyState(state, cookieHeader, cookieName) {
  if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)) return false;
  const value = (cookieHeader || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return false;
  return timingSafeEqual(Buffer.from(state), Buffer.from(value));
}

module.exports = { createState, verifyState };
