const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BRAIN_DIR = process.env.BRAIN_DIR || '/root/.openclaw/workspace/.brain/hangouts';
const BRAIN_FILE = path.join(BRAIN_DIR, 'brain.enc');

// Ensure brain directory exists
if (!fs.existsSync(BRAIN_DIR)) {
  fs.mkdirSync(BRAIN_DIR, { recursive: true });
}

// Generate or load encryption key from env
const getKey = () => {
  const envKey = process.env.BRAIN_KEY;
  if (envKey) {
    return Buffer.from(envKey.padEnd(32).slice(0, 32));
  }
  // Generate deterministic key from machine fingerprint
  const fingerprint = require('os').hostname() + require('os').userInfo().username;
  return crypto.createHash('sha256').update(fingerprint).digest();
};

const KEY = getKey();
const ALGORITHM = 'aes-256-gcm';

function encrypt(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted.toString('base64')
  };
}

function decrypt(encryptedObj) {
  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      KEY,
      Buffer.from(encryptedObj.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedObj.data, 'base64')),
      decipher.final()
    ]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (e) {
    console.error('Brain decryption failed:', e.message);
    return null;
  }
}

function loadBrain() {
  if (!fs.existsSync(BRAIN_FILE)) {
    return { friendHomes: {}, createdAt: new Date().toISOString() };
  }
  try {
    const encrypted = JSON.parse(fs.readFileSync(BRAIN_FILE, 'utf8'));
    return decrypt(encrypted) || { friendHomes: {}, createdAt: new Date().toISOString() };
  } catch (e) {
    console.error('Brain load failed:', e.message);
    return { friendHomes: {}, createdAt: new Date().toISOString() };
  }
}

function saveBrain(data) {
  const encrypted = encrypt(data);
  fs.writeFileSync(BRAIN_FILE, JSON.stringify(encrypted, null, 2));
}

// Brain API
const brain = {
  data: loadBrain(),
  
  getFriendHome(friendId) {
    return this.data.friendHomes[friendId] || null;
  },
  
  setFriendHome(friendId, lat, lng, address = null) {
    this.data.friendHomes[friendId] = {
      lat,
      lng,
      address,
      updatedAt: new Date().toISOString()
    };
    saveBrain(this.data);
    return this.data.friendHomes[friendId];
  },
  
  getAllFriendHomes() {
    return this.data.friendHomes;
  },
  
  // Generic storage for future local-only data
  set(key, value) {
    this.data[key] = value;
    saveBrain(this.data);
  },
  
  get(key) {
    return this.data[key];
  }
};

module.exports = brain;
