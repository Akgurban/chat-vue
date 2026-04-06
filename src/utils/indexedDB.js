// IndexedDB Service for Chat Application
const DB_NAME = "chat-vue-db";
const DB_VERSION = 1;

let db = null;

// Initialize IndexedDB
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

      // Chats store (unified list of rooms and DMs)
      if (!database.objectStoreNames.contains("chats")) {
        const chatsStore = database.createObjectStore("chats", {
          keyPath: ["type", "id"],
        });
        chatsStore.createIndex("type", "type", { unique: false });
        chatsStore.createIndex("last_message_at", "last_message_at", {
          unique: false,
        });
      }

      // Messages store (both room and DM messages)
      if (!database.objectStoreNames.contains("messages")) {
        const messagesStore = database.createObjectStore("messages", {
          keyPath: "id",
        });
        messagesStore.createIndex("room_id", "room_id", { unique: false });
        messagesStore.createIndex("dm_key", "dm_key", { unique: false }); // "sender_id-receiver_id" sorted
        messagesStore.createIndex("created_at", "created_at", {
          unique: false,
        });
        messagesStore.createIndex("chat_key", "chat_key", { unique: false }); // "type-id" for easy lookup
      }

      // Metadata store (for sync info, last fetch time, etc.)
      if (!database.objectStoreNames.contains("metadata")) {
        database.createObjectStore("metadata", { keyPath: "key" });
      }

      console.log("IndexedDB schema created/updated");
    };
  });
}

// Get database instance
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
    // Clone to remove Vue reactivity
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

// ==================== CHATS ====================

export async function saveChats(chats) {
  const database = await getDB();
  const tx = database.transaction("chats", "readwrite");
  const store = tx.objectStore("chats");

  for (const chat of chats) {
    // Clone to remove Vue reactivity
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
      // Sort by last_message_at descending
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

export async function getChat(type, id) {
  const database = await getDB();
  const tx = database.transaction("chats", "readonly");
  const store = tx.objectStore("chats");

  return new Promise((resolve, reject) => {
    const request = store.get([type, id]);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper to clone object for IndexedDB (removes Vue reactivity)
function cloneForDB(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export async function updateChat(chat) {
  const database = await getDB();
  const tx = database.transaction("chats", "readwrite");
  const store = tx.objectStore("chats");

  return new Promise((resolve, reject) => {
    // Clone to remove Vue reactivity
    const request = store.put(cloneForDB(chat));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== MESSAGES ====================

// Generate chat key for indexing
function getChatKey(message, type) {
  if (type === "room") {
    return `room-${message.room_id}`;
  } else {
    // For DMs, create a consistent key regardless of sender/receiver order
    const ids = [message.sender_id, message.receiver_id].sort((a, b) => a - b);
    return `direct-${ids[0]}-${ids[1]}`;
  }
}

export async function saveMessages(messages, type) {
  const database = await getDB();
  const tx = database.transaction("messages", "readwrite");
  const store = tx.objectStore("messages");

  for (const message of messages) {
    // Clone and add chat_key for easy lookup
    const msgWithKey = cloneForDB({
      ...message,
      chat_key: getChatKey(message, type),
      message_type: type,
    });
    store.put(msgWithKey);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMessage(message, type) {
  return saveMessages([message], type);
}

export async function getMessagesByRoom(roomId) {
  const database = await getDB();
  const tx = database.transaction("messages", "readonly");
  const store = tx.objectStore("messages");
  const index = store.index("chat_key");

  return new Promise((resolve, reject) => {
    const request = index.getAll(`room-${roomId}`);
    request.onsuccess = () => {
      const messages = request.result || [];
      messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getMessagesByDM(userId1, userId2) {
  const database = await getDB();
  const tx = database.transaction("messages", "readonly");
  const store = tx.objectStore("messages");
  const index = store.index("chat_key");

  const ids = [userId1, userId2].sort((a, b) => a - b);
  const chatKey = `direct-${ids[0]}-${ids[1]}`;

  return new Promise((resolve, reject) => {
    const request = index.getAll(chatKey);
    request.onsuccess = () => {
      const messages = request.result || [];
      messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getLastMessageId(type, chatId, userId = null) {
  let messages;
  if (type === "room") {
    messages = await getMessagesByRoom(chatId);
  } else {
    messages = await getMessagesByDM(chatId, userId);
  }

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
  getMessagesByRoom,
  getMessagesByDM,
  getLastMessageId,
  setMetadata,
  getMetadata,
  clearAllData,
  clearUserData,
};
