// IndexedDB Service for Chat Application
const DB_NAME = "chat-vue-db";
const DB_VERSION = 1;

let db = null;

// ==================== HELPERS ====================

/**
 * Helper to clone object for IndexedDB (removes Vue reactivity)
 */
function cloneForDB(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generic helper for read operations
 */
async function readFromStore(storeName, operation) {
  const database = await getDB();
  const tx = database.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return operation(store);
}

/**
 * Generic helper for write operations
 */
async function writeToStore(storeName, operation) {
  const database = await getDB();
  const tx = database.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  operation(store);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Wrap IndexedDB request in a Promise
 */
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== INITIALIZATION ====================

/**
 * Initialize IndexedDB
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log("IndexedDB initialized successfully");
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Users store
      if (!database.objectStoreNames.contains("users")) {
        const usersStore = database.createObjectStore("users", {
          keyPath: "id",
        });
        usersStore.createIndex("username", "username", { unique: false });
      }

      // Chats store (DM conversations)
      if (!database.objectStoreNames.contains("chats")) {
        const chatsStore = database.createObjectStore("chats", {
          keyPath: "id",
        });
        chatsStore.createIndex("last_message_at", "last_message_at", {
          unique: false,
        });
      }

      // Messages store (DM messages)
      if (!database.objectStoreNames.contains("messages")) {
        const messagesStore = database.createObjectStore("messages", {
          keyPath: "id",
        });
        messagesStore.createIndex("dm_key", "dm_key", { unique: false });
        messagesStore.createIndex("created_at", "created_at", {
          unique: false,
        });
      }

      // Metadata store (for sync info, scroll positions, etc.)
      if (!database.objectStoreNames.contains("metadata")) {
        database.createObjectStore("metadata", { keyPath: "key" });
      }

      console.log("IndexedDB schema created/updated");
    };
  });
}

/**
 * Get database instance
 */
async function getDB() {
  if (!db) {
    await initDB();
  }
  return db;
}

// ==================== USERS ====================

export async function saveUsers(users) {
  const database = await getDB();
  const tx = database.transaction("users", "readwrite");
  const store = tx.objectStore("users");

  for (const user of users) {
    store.put(cloneForDB(user));
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getUsers() {
  const database = await getDB();
  const tx = database.transaction("users", "readonly");
  const store = tx.objectStore("users");

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getUser(userId) {
  const database = await getDB();
  const tx = database.transaction("users", "readonly");
  const store = tx.objectStore("users");

  return new Promise((resolve, reject) => {
    const request = store.get(userId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== CHATS (DM Conversations) ====================

export async function saveChats(chats) {
  const database = await getDB();
  const tx = database.transaction("chats", "readwrite");
  const store = tx.objectStore("chats");

  for (const chat of chats) {
    store.put(cloneForDB(chat));
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getChats() {
  const database = await getDB();
  const tx = database.transaction("chats", "readonly");
  const store = tx.objectStore("chats");

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const chats = request.result || [];
      chats.sort((a, b) => {
        const dateA = new Date(a.last_message_at || 0);
        const dateB = new Date(b.last_message_at || 0);
        return dateB - dateA;
      });
      resolve(chats);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getChat(id) {
  const database = await getDB();
  const tx = database.transaction("chats", "readonly");
  const store = tx.objectStore("chats");

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateChat(chat) {
  const database = await getDB();
  const tx = database.transaction("chats", "readwrite");
  const store = tx.objectStore("chats");

  return new Promise((resolve, reject) => {
    const request = store.put(cloneForDB(chat));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== MESSAGES (DM Messages) ====================

// Generate DM key for indexing
function getDMKey(message) {
  const ids = [message.sender_id, message.receiver_id].sort((a, b) => a - b);
  return `dm-${ids[0]}-${ids[1]}`;
}

export async function saveMessages(messages) {
  const database = await getDB();
  const tx = database.transaction("messages", "readwrite");
  const store = tx.objectStore("messages");

  for (const message of messages) {
    const msgWithKey = cloneForDB({
      ...message,
      dm_key: getDMKey(message),
    });
    store.put(msgWithKey);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMessage(message) {
  return saveMessages([message]);
}

export async function getMessagesByDM(userId1, userId2) {
  const database = await getDB();
  const tx = database.transaction("messages", "readonly");
  const store = tx.objectStore("messages");
  const index = store.index("dm_key");

  const ids = [userId1, userId2].sort((a, b) => a - b);
  const dmKey = `dm-${ids[0]}-${ids[1]}`;

  return new Promise((resolve, reject) => {
    const request = index.getAll(dmKey);
    request.onsuccess = () => {
      const messages = request.result || [];
      messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getLastMessageId(chatId, userId) {
  const messages = await getMessagesByDM(chatId, userId);
  if (messages.length === 0) return null;
  return messages[messages.length - 1].id;
}

// ==================== METADATA ====================

export async function setMetadata(key, value) {
  const database = await getDB();
  const tx = database.transaction("metadata", "readwrite");
  const store = tx.objectStore("metadata");

  return new Promise((resolve, reject) => {
    const request = store.put({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMetadata(key) {
  const database = await getDB();
  const tx = database.transaction("metadata", "readonly");
  const store = tx.objectStore("metadata");

  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

// ==================== SCROLL POSITION ====================

/**
 * Save the last visible message ID for scroll position restoration
 * @param {number|string} chatId - User ID for DM
 * @param {number|string} messageId - The message ID that was at the top of viewport
 * @param {number} userId - Current user ID (for DM key generation)
 */
export async function saveScrollPosition(chatId, messageId, userId) {
  const key = getScrollPositionKey(chatId, userId);
  await setMetadata(key, {
    messageId,
    savedAt: new Date().toISOString(),
  });
}

/**
 * Get the saved scroll position for a chat
 * @param {number|string} chatId - User ID for DM
 * @param {number} userId - Current user ID (for DM key generation)
 * @returns {Promise<{messageId: number|string, savedAt: string}|null>}
 */
export async function getScrollPosition(chatId, userId) {
  const key = getScrollPositionKey(chatId, userId);
  return await getMetadata(key);
}

/**
 * Clear scroll position for a chat (e.g., when user scrolls to bottom)
 * @param {number|string} chatId - User ID for DM
 * @param {number} userId - Current user ID (for DM key generation)
 */
export async function clearScrollPosition(chatId, userId) {
  const key = getScrollPositionKey(chatId, userId);
  const database = await getDB();
  const tx = database.transaction("metadata", "readwrite");
  const store = tx.objectStore("metadata");

  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate a unique key for scroll position storage
 */
function getScrollPositionKey(chatId, userId) {
  const ids = [chatId, userId].sort((a, b) => a - b);
  return `scroll_position_dm_${ids[0]}_${ids[1]}`;
}

// ==================== CLEAR DATA ====================

export async function clearAllData() {
  const database = await getDB();
  const tx = database.transaction(
    ["users", "chats", "messages", "metadata"],
    "readwrite",
  );

  tx.objectStore("users").clear();
  tx.objectStore("chats").clear();
  tx.objectStore("messages").clear();
  tx.objectStore("metadata").clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log("All IndexedDB data cleared");
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearUserData() {
  const database = await getDB();
  const tx = database.transaction(["chats", "messages"], "readwrite");

  tx.objectStore("chats").clear();
  tx.objectStore("messages").clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clear messages for a specific chat (DM conversation)
 * @param {number} chatId - The user ID of the DM partner
 */
export async function clearChatMessages(chatId) {
  const database = await getDB();
  const tx = database.transaction("messages", "readwrite");
  const store = tx.objectStore("messages");
  const index = store.index("dm_key");

  // Get all possible dm_key combinations for this chatId
  // We need to iterate through all messages and delete those matching the chatId
  return new Promise((resolve, reject) => {
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const message = cursor.value;
        // Check if this message belongs to the chat (either as sender or receiver)
        if (message.sender_id === chatId || message.receiver_id === chatId) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Export all functions
export default {
  initDB,
  saveUsers,
  getUsers,
  getUser,
  saveChats,
  getChats,
  getChat,
  updateChat,
  saveMessages,
  saveMessage,
  getMessagesByDM,
  getLastMessageId,
  setMetadata,
  getMetadata,
  saveScrollPosition,
  getScrollPosition,
  clearScrollPosition,
  clearChatMessages,
  clearAllData,
  clearUserData,
};
