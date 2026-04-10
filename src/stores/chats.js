import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useAuthStore } from "./auth";
import { useWebSocketStore } from "./websocket";
import * as db from "../utils/indexedDB";

export const useChatsStore = defineStore("chats", () => {
  const authStore = useAuthStore();
  const wsStore = useWebSocketStore();

  const chats = ref([]);
  const totalUnread = ref(0);
  const loading = ref(false);
  const typingUsers = ref({}); // { chatKey: username }
  const isInitialized = ref(false);

  // Unread count
  const unreadCount = computed(() => {
    return chats.value.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
  });

  // Initialize from IndexedDB
  async function initFromCache() {
    try {
      await db.initDB();
      const cachedChats = await db.getChats();
      if (cachedChats.length > 0) {
        chats.value = cachedChats;
        totalUnread.value = cachedChats.reduce(
          (sum, c) => sum + (c.unread_count || 0),
          0,
        );
        console.log("Loaded", cachedChats.length, "chats from IndexedDB");
      }
      isInitialized.value = true;
    } catch (err) {
      console.error("Failed to load from IndexedDB:", err);
      isInitialized.value = true;
    }
  }

  // Fetch all chats from server and sync to IndexedDB
  async function fetchChats(includeMessages = false) {
    try {
      loading.value = true;
      const params = new URLSearchParams();
      if (includeMessages) {
        params.append("include_messages", "true");
        params.append("message_limit", "10");
      }
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await authStore.api(`/api/chats${query}`);
      chats.value = data.chats || [];
      totalUnread.value = data.total_unread || 0;

      // Save to IndexedDB
      if (chats.value.length > 0) {
        await db.saveChats(chats.value);
        console.log("Saved", chats.value.length, "chats to IndexedDB");
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    } finally {
      loading.value = false;
    }
  }

  // Fetch single chat with messages
  async function fetchChat(id, messageLimit = 50) {
    try {
      const data = await authStore.api(
        `/api/chats/direct/${id}?message_limit=${messageLimit}`,
      );

      // Update the chat in local state if it exists
      if (data) {
        const existingIndex = chats.value.findIndex((c) => c.id === id);
        if (existingIndex !== -1) {
          // Update existing chat
          chats.value[existingIndex] = {
            ...chats.value[existingIndex],
            ...data,
          };
          // Update IndexedDB
          await db.updateChat(chats.value[existingIndex]);
        } else if (data.name) {
          // Add new chat to the list
          chats.value.unshift(data);
          // Save to IndexedDB
          await db.updateChat(data);
        }

        // Save messages to IndexedDB if they exist
        if (data.messages && data.messages.length > 0) {
          await db.saveMessages(data.messages);
        }
      }

      return data;
    } catch (err) {
      console.error("Failed to fetch chat:", err);
      return null;
    }
  }

  // Mark DM as read (via WebSocket)
  async function markDmAsRead(userId) {
    wsStore.send("mark_read", { user_id: userId });
    // Update local state
    const chat = chats.value.find((c) => c.id === userId);
    if (chat) {
      totalUnread.value -= chat.unread_count;
      chat.unread_count = 0;
      // Update IndexedDB
      await db.updateChat(chat);
    }
  }

  // Decrease unread count by 1 (for individual message read tracking)
  async function decreaseUnreadCount(id) {
    const chat = chats.value.find((c) => c.id === id);
    if (chat && chat.unread_count > 0) {
      chat.unread_count--;
      totalUnread.value = Math.max(0, totalUnread.value - 1);
      // Update IndexedDB
      await db.updateChat(chat);
    }
  }

  // Update chat from WebSocket message
  function handleNewMessage(payload) {
    // For DMs: if I sent it, use receiver_id; if I received it, use sender_id
    const chatId =
      payload.sender_id === authStore.user?.id
        ? payload.receiver_id
        : payload.sender_id;

    let chat = chats.value.find((c) => c.id === chatId);

    if (chat) {
      // Update existing chat
      chat.last_message = {
        id: payload.id,
        content: payload.content,
        sender_id: payload.sender_id,
        sender_username: payload.sender_username,
        message_type: payload.message_type || "text",
        created_at: payload.created_at,
      };
      chat.last_message_at = payload.created_at;

      // Increment unread if not from current user
      if (payload.sender_id !== authStore.user?.id) {
        chat.unread_count = (chat.unread_count || 0) + 1;
        totalUnread.value++;
      }

      // Move chat to top
      const index = chats.value.indexOf(chat);
      if (index > 0) {
        chats.value.splice(index, 1);
        chats.value.unshift(chat);
      }
    } else {
      // Create new chat entry
      const chatName =
        payload.sender_id === authStore.user?.id
          ? payload.receiver_username || "Unknown"
          : payload.sender_username || "Unknown";

      const newChat = {
        id: chatId,
        name: chatName,
        unread_count: payload.sender_id !== authStore.user?.id ? 1 : 0,
        last_message: {
          id: payload.id,
          content: payload.content,
          sender_id: payload.sender_id,
          sender_username: payload.sender_username,
          message_type: payload.message_type || "text",
          created_at: payload.created_at,
        },
        last_message_at: payload.created_at,
        is_online: true,
      };
      chats.value.unshift(newChat);
      if (payload.sender_id !== authStore.user?.id) {
        totalUnread.value++;
      }

      // Save to IndexedDB
      db.updateChat(newChat);
    }

    // Also update the existing chat in IndexedDB
    if (chat) {
      db.updateChat(chat);
    }
  }

  // Handle typing indicator
  function setTypingUser(chatId, username) {
    const key = `dm-${chatId}`;
    typingUsers.value[key] = username;

    // Clear after 3 seconds
    setTimeout(() => {
      if (typingUsers.value[key] === username) {
        delete typingUsers.value[key];
      }
    }, 3000);
  }

  // Get typing user for a chat
  function getTypingUser(chatId) {
    return typingUsers.value[`dm-${chatId}`] || null;
  }

  // Update online status
  function updateOnlineStatus(userId, isOnline) {
    const chat = chats.value.find((c) => c.id === userId);
    if (chat) {
      chat.is_online = isOnline;
    }
  }

  // Search users by partial match (username or email)
  async function searchUsers(query, limit = 20) {
    if (!query || query.length < 2) return [];
    try {
      const data = await authStore.api(
        `/api/users/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      );
      return data || [];
    } catch (err) {
      console.error("Failed to search users:", err);
      return [];
    }
  }

  // Find user by exact match (email or username)
  async function findUser(identifier) {
    if (!identifier) return null;
    try {
      const data = await authStore.api(
        `/api/users/find?identifier=${encodeURIComponent(identifier)}`,
      );
      return data;
    } catch (err) {
      console.error("Failed to find user:", err);
      return null;
    }
  }

  // Clear chat messages (keep chat in sidebar but clear messages)
  async function clearChat(userId) {
    try {
      await authStore.api(`/api/dm/clear/${userId}`, {
        method: "DELETE",
      });

      // Update chat in local state - clear messages but keep the chat
      const chat = chats.value.find((c) => c.id === userId);
      if (chat) {
        // Decrease total unread if this chat had unread messages
        totalUnread.value = Math.max(
          0,
          totalUnread.value - (chat.unread_count || 0),
        );
        // Clear the last message and unread count
        chat.last_message = null;
        chat.last_message_at = null;
        chat.unread_count = 0;
        // Update chat in IndexedDB
        await db.updateChat(chat);
      }

      // Clear messages from IndexedDB for this chat
      if (authStore.user?.id) {
        await db.clearChatMessages(userId, authStore.user.id);
      }

      // Clear scroll position for this chat
      if (authStore.user?.id) {
        await db.clearScrollPosition(userId, authStore.user.id);
      }

      return true;
    } catch (err) {
      console.error("Failed to clear chat:", err);
      return false;
    }
  }

  // Reset store
  async function reset() {
    chats.value = [];
    totalUnread.value = 0;
    loading.value = false;
    typingUsers.value = {};
    isInitialized.value = false;
    // Clear IndexedDB data
    try {
      await db.clearUserData();
    } catch (err) {
      console.error("Failed to clear IndexedDB:", err);
    }
  }

  return {
    chats,
    totalUnread,
    loading,
    unreadCount,
    isInitialized,
    initFromCache,
    fetchChats,
    fetchChat,
    markDmAsRead,
    decreaseUnreadCount,
    handleNewMessage,
    setTypingUser,
    getTypingUser,
    updateOnlineStatus,
    searchUsers,
    findUser,
    clearChat,
    reset,
  };
});
