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

export async function deleteChat(id) {
  const database = await getDB();
  const tx = database.transaction("chats", "readwrite");
  const store = tx.objectStore("chats");

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
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

/**
 * Delete a message by ID (used for removing optimistic/pending messages)
 */
export async function deleteMessage(messageId) {
  const database = await getDB();
  const tx = database.transaction("messages", "readwrite");
  const store = tx.objectStore("messages");

  return new Promise((resolve, reject) => {
    const request = store.delete(messageId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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

// ==================== PAGE CACHE ====================

/**
 * Generate a unique key for DM page cache
 */
function getPageCacheKey(chatId, userId) {
  const ids = [parseInt(chatId), parseInt(userId)].sort((a, b) => a - b);
  return `dm_page_cache_${ids[0]}_${ids[1]}`;
}

/**
 * Save page cache info for a DM conversation
 * @param {number|string} chatId - The other user's ID
 * @param {number|string} currentUserId - Current user ID
 * @param {number} page - Page number
 * @param {object} pageData - Page metadata { total_pages, total_count, has_more, limit }
 */
export async function savePageCache(chatId, currentUserId, page, pageData) {
  const key = getPageCacheKey(chatId, currentUserId);

  // Get existing cache
  const existing = (await getMetadata(key)) || { pages: {}, meta: {} };

  // Update page info
  existing.pages[page] = {
    cached_at: new Date().toISOString(),
  };

  // Update metadata
  existing.meta = {
    total_pages: pageData.total_pages,
    total_count: pageData.total_count,
    limit: pageData.limit,
    updated_at: new Date().toISOString(),
  };

  await setMetadata(key, existing);
}

/**
 * Get cached pages info for a DM conversation
 * @param {number|string} chatId - The other user's ID
 * @param {number|string} currentUserId - Current user ID
 * @returns {Promise<{pages: object, meta: object}|null>}
 */
export async function getPageCache(chatId, currentUserId) {
  const key = getPageCacheKey(chatId, currentUserId);
  return await getMetadata(key);
}

/**
 * Check if a specific page is cached
 * @param {number|string} chatId - The other user's ID
 * @param {number|string} currentUserId - Current user ID
 * @param {number} page - Page number to check
 * @param {number} maxAgeMs - Max age in milliseconds (default: 5 minutes)
 * @returns {Promise<boolean>}
 */
export async function isPageCached(
  chatId,
  currentUserId,
  page,
  maxAgeMs = 5 * 60 * 1000,
) {
  const cache = await getPageCache(chatId, currentUserId);
  if (!cache || !cache.pages || !cache.pages[page]) {
    return false;
  }

  // Check if cache is still valid (not expired)
  const cachedAt = new Date(cache.pages[page].cached_at);
  const now = new Date();
  const age = now - cachedAt;

  return age < maxAgeMs;
}

/**
 * Get list of cached page numbers
 * @param {number|string} chatId - The other user's ID
 * @param {number|string} currentUserId - Current user ID
 * @returns {Promise<number[]>}
 */
export async function getCachedPages(chatId, currentUserId) {
  const cache = await getPageCache(chatId, currentUserId);
  if (!cache || !cache.pages) {
    return [];
  }
  return Object.keys(cache.pages).map(Number);
}

/**
 * Clear page cache for a DM conversation
 * @param {number|string} chatId - The other user's ID
 * @param {number|string} currentUserId - Current user ID
 */
export async function clearPageCache(chatId, currentUserId) {
  const key = getPageCacheKey(chatId, currentUserId);
  const database = await getDB();
  const tx = database.transaction("metadata", "readwrite");
  const store = tx.objectStore("metadata");

  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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

export async function clearAllChatMessages() {
  const database = await getDB();
  const tx = database.transaction("messages", "readwrite");
  tx.objectStore("messages").clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function clearChatMessages(chatId, currentUserId) {
  const database = await getDB();
  const tx = database.transaction("messages", "readwrite");
  const store = tx.objectStore("messages");
  const index = store.index("dm_key");

  // Convert to numbers for comparison
  const chatIdNum = parseInt(chatId);
  const currentUserIdNum = parseInt(currentUserId);

  // Generate the dm_key for this conversation
  const ids = [chatIdNum, currentUserIdNum].sort((a, b) => a - b);
  const dmKey = `dm-${ids[0]}-${ids[1]}`;

  console.log("Clearing messages for dm_key:", dmKey);

  return new Promise((resolve, reject) => {
    let deletedCount = 0;

    // Handle transaction completion
    tx.oncomplete = () => {
      console.log(`Deleted ${deletedCount} messages for dm_key: ${dmKey}`);
      resolve(deletedCount);
    };

    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));

    // Use the index to get only messages for this DM conversation
    const request = index.openCursor(IDBKeyRange.only(dmKey));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      }
      // When cursor is null, transaction will complete automatically
    };

    request.onerror = () => {
      tx.abort();
    };
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
  deleteChat,
  saveMessages,
  saveMessage,
  deleteMessage,
  getMessagesByDM,
  getLastMessageId,
  setMetadata,
  getMetadata,
  saveScrollPosition,
  getScrollPosition,
  clearScrollPosition,
  // Page cache
  savePageCache,
  getPageCache,
  isPageCached,
  getCachedPages,
  clearPageCache,
  // Clear data
  clearChatMessages,
  clearAllChatMessages,
  clearAllData,
  clearUserData,
};
