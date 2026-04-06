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
  const currentFilter = ref("all"); // 'all', 'direct', 'room'
  const typingUsers = ref({}); // { chatKey: username }
  const isInitialized = ref(false);

  // Filtered chats based on current filter
  const filteredChats = computed(() => {
    if (currentFilter.value === "all") {
      return chats.value;
    }
    return chats.value.filter((chat) => chat.type === currentFilter.value);
  });

  // Unread counts by type
  const unreadByType = computed(() => {
    const counts = { all: 0, direct: 0, room: 0 };
    chats.value.forEach((chat) => {
      counts.all += chat.unread_count || 0;
      counts[chat.type] += chat.unread_count || 0;
    });
    return counts;
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
  async function fetchChat(type, id, messageLimit = 50) {
    try {
      const data = await authStore.api(
        `/api/chats/${type}/${id}?message_limit=${messageLimit}`,
      );
      return data;
    } catch (err) {
      console.error("Failed to fetch chat:", err);
      return null;
    }
  }

  // Mark room messages as read
  async function markRoomAsRead(roomId) {
    try {
      await authStore.api(`/api/rooms/${roomId}/messages/read`, {
        method: "POST",
      });
      // Update local state
      const chat = chats.value.find(
        (c) => c.type === "room" && c.id === roomId,
      );
      if (chat) {
        totalUnread.value -= chat.unread_count;
        chat.unread_count = 0;
        // Update IndexedDB
        await db.updateChat(chat);
      }
    } catch (err) {
      console.error("Failed to mark room as read:", err);
    }
  }

  // Mark DM as read (via WebSocket)
  async function markDmAsRead(userId) {
    wsStore.send("mark_read", { user_id: userId });
    // Update local state
    const chat = chats.value.find(
      (c) => c.type === "direct" && c.id === userId,
    );
    if (chat) {
      totalUnread.value -= chat.unread_count;
      chat.unread_count = 0;
      // Update IndexedDB
      await db.updateChat(chat);
    }
  }

  // Update chat from WebSocket message
  function handleNewMessage(payload, type) {
    // For DMs, use the other user's ID (not the current user's)
    let chatId;
    if (type === "room") {
      chatId = payload.room_id;
    } else {
      // For DMs: if I sent it, use receiver_id; if I received it, use sender_id
      chatId =
        payload.sender_id === authStore.user?.id
          ? payload.receiver_id
          : payload.sender_id;
    }
    const chatType = type === "room" ? "room" : "direct";

    let chat = chats.value.find((c) => c.type === chatType && c.id === chatId);

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
      // For DMs: use the other user's name
      let chatName;
      if (chatType === "direct") {
        chatName =
          payload.sender_id === authStore.user?.id
            ? payload.receiver_username || "Unknown"
            : payload.sender_username || "Unknown";
      } else {
        chatName = payload.room_name || "Unknown";
      }

      const newChat = {
        id: chatId,
        type: chatType,
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
        is_online: chatType === "direct" ? true : undefined,
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
  function setTypingUser(chatType, chatId, username) {
    const key = `${chatType}-${chatId}`;
    typingUsers.value[key] = username;

    // Clear after 3 seconds
    setTimeout(() => {
      if (typingUsers.value[key] === username) {
        delete typingUsers.value[key];
      }
    }, 3000);
  }

  // Get typing user for a chat
  function getTypingUser(chatType, chatId) {
    return typingUsers.value[`${chatType}-${chatId}`] || null;
  }

  // Update online status
  function updateOnlineStatus(userId, isOnline) {
    const chat = chats.value.find(
      (c) => c.type === "direct" && c.id === userId,
    );
    if (chat) {
      chat.is_online = isOnline;
    }
  }

  // Set filter
  function setFilter(filter) {
    currentFilter.value = filter;
  }

  // Reset store
  async function reset() {
    chats.value = [];
    totalUnread.value = 0;
    loading.value = false;
    currentFilter.value = "all";
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
    currentFilter,
    filteredChats,
    unreadByType,
    isInitialized,
    initFromCache,
    fetchChats,
    fetchChat,
    markRoomAsRead,
    markDmAsRead,
    handleNewMessage,
    setTypingUser,
    getTypingUser,
    updateOnlineStatus,
    setFilter,
    reset,
  };
});
