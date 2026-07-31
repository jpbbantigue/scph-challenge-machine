// Per-account data storage using Netlify Blobs — a zero-config key/value
// store bundled into the Netlify platform, so Phase 2 doesn't need a
// separate database service.

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "scph-user-data";

function userKey(user) {
  return user.provider + ":" + user.sub;
}

function defaultUserData() {
  return { favorites: [], history: [], settings: null, updatedAt: 0 };
}

async function loadUserData(user) {
  const store = getStore(STORE_NAME);
  const raw = await store.get(userKey(user), { type: "json" });
  return raw || defaultUserData();
}

async function saveUserData(user, data) {
  const store = getStore(STORE_NAME);
  const toSave = {
    favorites: Array.isArray(data.favorites) ? data.favorites.slice(0, 200) : [],
    history: Array.isArray(data.history) ? data.history.slice(-100) : [],
    settings: data.settings || null,
    updatedAt: Date.now()
  };
  await store.setJSON(userKey(user), toSave);
  return toSave;
}

module.exports = { loadUserData, saveUserData };
