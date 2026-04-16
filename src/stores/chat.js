import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useAuthStore } from "./auth";
import { useWebSocketStore } from "./websocket";
import { useNotificationStore } from "./notifications";
import { useChatsStore } from "./chats";
import { browserNotifications } from "../utils/notifications";
import * as db from "../utils/indexedDB";

export const useChatStore = defineStore("chat", () => {
  const authStore = useAuthStore();
  const wsStore = useWebSocketStore();

  // Toast instance - will be set from component
  let toastInstance = null;

  // Notification sound
  const notificationSound = new Audio("/notification.mp3");

  // Play notification sound
  function playNotificationSound() {
    try {
      notificationSound.currentTime = 0;
      notificationSound.play().catch((err) => {
        console.log("Could not play notification sound:", err);
      });
    } catch (err) {
      console.log("Notification sound error:", err);
    }
  }

  const users = ref([]);
  const currentDmUserId = ref(null);
  const currentDmUsername = ref("");
  const dmMessages = ref([]);
  const typingUser = ref("");
  const firstUnreadMessageId = ref(null);
  const chatView = ref("default"); // 'default', 'dm'

  // Pagination state
  const currentPage = ref(1);
  const totalPages = ref(1);
  const totalCount = ref(0);
  const hasMoreMessages = ref(true);
  const isLoadingMore = ref(false);

  async function openDM(userId, username) {
    if (userId === authStore.user?.id) return;

    // Normalize userId to number for consistent comparison with WebSocket messages
    const normalizedUserId =
      typeof userId === "string" ? parseInt(userId, 10) : userId;
    currentDmUserId.value = normalizedUserId;
    currentDmUsername.value = username;
    chatView.value = "dm";

    // Load messages from cache first
    try {
      const cachedMessages = await db.getMessagesByDM(
        authStore.user?.id,
        userId,
      );
      if (cachedMessages.length > 0) {
        dmMessages.value = cachedMessages;
      }
    } catch (err) {
      console.error("Failed to load cached DMs:", err);
    }

    // Then load from server
    try {
      const lastMsgId = await db.getLastMessageId(userId, authStore.user?.id);
      let url = `/api/dm/${userId}`;
      if (lastMsgId) {
        url += `?after=${lastMsgId}&unread_only=true`;
      }
      const serverMessages = await authStore.api(url);

      if (lastMsgId && serverMessages.length > 0) {
        // Append new messages
        dmMessages.value = [...dmMessages.value, ...serverMessages];
        await db.saveMessages(serverMessages);
      } else if (!lastMsgId) {
        // No cache, use server messages
        dmMessages.value = serverMessages;
        await db.saveMessages(serverMessages);
      }
    } catch (err) {
      console.error("Failed to load DMs:", err);
      if (dmMessages.value.length === 0) {
        dmMessages.value = [];
      }
    }
  }

  async function getDMMessages(
    userId,
    page = 1,
    limit = 25,
    unread_only = false,
    forceRefresh = false,
  ) {
    if (userId === authStore.user?.id) return;

    const currentUserId = authStore.user?.id;

    // If it's a new chat (page 1), reset state
    if (page === 1) {
      // Normalize userId to number for consistent comparison with WebSocket messages
      currentDmUserId.value =
        typeof userId === "string" ? parseInt(userId, 10) : userId;
      chatView.value = "dm";
      currentPage.value = 1;
      hasMoreMessages.value = true;
      dmMessages.value = [];

      // Load from cache first for instant display
      try {
        const cachedMessages = await db.getMessagesByDM(currentUserId, userId);

        if (cachedMessages.length > 0) {
          dmMessages.value = cachedMessages;

          // Check if page 1 is cached and still valid
          const isCached = await db.isPageCached(userId, currentUserId, 1);
          if (isCached && !forceRefresh && !unread_only) {
            // Get cached metadata
            const pageCache = await db.getPageCache(userId, currentUserId);
            if (pageCache?.meta) {
              totalPages.value = pageCache.meta.total_pages || 1;
              totalCount.value = pageCache.meta.total_count || 0;
              hasMoreMessages.value = page < totalPages.value;
            }
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load cached DMs:", err);
      }
    } else {
      // For pagination (page > 1), check if this page is cached
      if (!forceRefresh && !unread_only) {
        const isCached = await db.isPageCached(userId, currentUserId, page);
        if (isCached) {
          console.log(`Page ${page} already cached, skipping server request`);
          // Messages are already in dmMessages from previous loads
          // Just update the current page
          currentPage.value = page;
          return;
        }
      }
    }

    // Prevent duplicate loading
    if (isLoadingMore.value) return;
    isLoadingMore.value = true;

    try {
      // Fetch from server with pagination
      const url = `/api/dm/${userId}?page=${page}&limit=${limit}&unread_only=${unread_only}`;
      const response = await authStore.api(url);

      // Handle new API response format:
      // { messages: [...], current_page: 1, total_pages: 5, total_count: 243, limit: 50, has_more: true }
      const serverMessages = response.messages || [];

      // Update pagination state from API response
      totalPages.value = response.total_pages || 1;
      totalCount.value = response.total_count || 0;
      currentPage.value = response.current_page || page;

      // Use has_more from API response
      hasMoreMessages.value = response.has_more ?? page < totalPages.value;

      if (serverMessages.length > 0) {
        // Save new messages to IndexedDB
        await db.saveMessages(serverMessages);

        // Save page cache info
        await db.savePageCache(userId, currentUserId, page, {
          total_pages: response.total_pages,
          total_count: response.total_count,
          limit: response.limit,
          has_more: response.has_more,
        });

        if (page === 1) {
          // First page - replace or merge with cache
          const existingIds = new Set(dmMessages.value.map((m) => m.id));
          const newMessages = serverMessages.filter(
            (m) => !existingIds.has(m.id),
          );

          if (newMessages.length > 0) {
            // Merge and sort by date
            dmMessages.value = [...dmMessages.value, ...newMessages].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at),
            );
          }
        } else {
          // Older messages (pagination) - prepend to existing
          const existingIds = new Set(dmMessages.value.map((m) => m.id));
          const newMessages = serverMessages.filter(
            (m) => !existingIds.has(m.id),
          );

          if (newMessages.length > 0) {
            dmMessages.value = [...newMessages, ...dmMessages.value].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at),
            );
          }
        }
      } else if (page === 1) {
        // No messages at all
        dmMessages.value = [];
        hasMoreMessages.value = false;
      }
    } catch (err) {
      console.error("Failed to load DMs:", err);
      if (page === 1 && dmMessages.value.length === 0) {
        dmMessages.value = [];
      }
    } finally {
      isLoadingMore.value = false;
    }
  }

  /**
   * Load more (older) messages - for infinite scroll
   */
  async function loadMoreMessages(limit = 25) {
    if (
      !hasMoreMessages.value ||
      isLoadingMore.value ||
      !currentDmUserId.value
    ) {
      return false;
    }

    const nextPage = currentPage.value + 1;
    await getDMMessages(currentDmUserId.value, nextPage, limit);
    return hasMoreMessages.value;
  }

  function sendDM(content) {
    if (!content || !currentDmUserId.value) return;

    // Create a stable key for Vue's TransitionGroup that won't change when server confirms
    const pendingKey = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create optimistic message for instant UI feedback
    const optimisticMessage = {
      id: `temp_${Date.now()}`, // Temporary ID until server confirms
      sender_id: authStore.user?.id,
      sender_username: authStore.user?.username,
      receiver_id: currentDmUserId.value,
      content,
      created_at: new Date().toISOString(),
      is_read: false,
      delivered_at: null,
      read_at: null,
      _pending: true, // Mark as pending until confirmed
      _pendingKey: pendingKey, // Stable key for Vue reactivity
    };

    // Add to state immediately for instant UI update
    dmMessages.value.push(optimisticMessage);

    // Save to IndexedDB (will be updated when server confirms)
    db.saveMessage(optimisticMessage).catch((err) => {
      console.error("Failed to save optimistic message to IndexedDB:", err);
    });

    // Send via WebSocket
    wsStore.send("direct_message", {
      receiver_id: currentDmUserId.value,
      content,
    });
  }

  function sendTyping() {
    if (!currentDmUserId.value) return;
    wsStore.send("typing", { user_id: currentDmUserId.value });
  }

  function handleWebSocketMessage(msg) {
    const chatsStore = useChatsStore();

    switch (msg.type) {
      case "new_direct_message":
        // Update chats store with new message
        chatsStore.handleNewMessage(msg.payload);

        // Check if this is a confirmation of our own sent message
        const isOwnMessage = msg.payload.sender_id === authStore.user?.id;

        if (isOwnMessage) {
          // Find and replace the optimistic/pending message with the real one
          const pendingIndex = dmMessages.value.findIndex(
            (m) =>
              m._pending &&
              m.content === msg.payload.content &&
              m.receiver_id === msg.payload.receiver_id,
          );

          if (pendingIndex !== -1) {
            // Remove the pending message from IndexedDB
            const pendingMsg = dmMessages.value[pendingIndex];
            if (pendingMsg.id && String(pendingMsg.id).startsWith("temp_")) {
              db.deleteMessage(pendingMsg.id).catch((err) => {
                console.error(
                  "Failed to delete pending message from IndexedDB:",
                  err,
                );
              });
            }
            // Update the existing message object in place (avoids Vue reactivity flicker)
            // This prevents TransitionGroup from seeing it as remove + add
            // IMPORTANT: Preserve _pendingKey so Vue's :key doesn't change
            const existingPendingKey = pendingMsg._pendingKey;
            Object.assign(dmMessages.value[pendingIndex], {
              ...msg.payload,
              _pending: false,
              _pendingKey: existingPendingKey, // Keep the stable key
            });
            // Save the confirmed message to IndexedDB
            db.saveMessage(msg.payload).catch((err) => {
              console.error("Failed to save own message to IndexedDB:", err);
            });
          } else {
            // No pending message found - check if we already have this message by ID
            const existingIndex = dmMessages.value.findIndex(
              (m) => m.id === msg.payload.id,
            );
            if (existingIndex !== -1) {
              // Already have this message (maybe from a race condition), just update it
              Object.assign(dmMessages.value[existingIndex], msg.payload);
            }
            // Don't add new message here - if there's no pending message,
            // it means we didn't send it from this client or it's a duplicate
          }
        } else {
          // Message from another user - check if we already have it
          const existingIndex = dmMessages.value.findIndex(
            (m) => m.id === msg.payload.id,
          );
          if (existingIndex !== -1) {
            // Already have this message, skip
            break;
          }

          // Save to IndexedDB first
          db.saveMessage(msg.payload).catch((err) => {
            console.error("Failed to save received message to IndexedDB:", err);
          });

          // Check if user is currently viewing the conversation with the sender
          // msg.payload.sender_id is the person who sent the message
          // msg.payload.receiver_id is us (the current user)
          const senderId =
            typeof msg.payload.sender_id === "string"
              ? parseInt(msg.payload.sender_id, 10)
              : msg.payload.sender_id;
          const isViewingThisConversation =
            currentDmUserId.value != null && currentDmUserId.value === senderId;

          console.log("New message received:", {
            sender_id: msg.payload.sender_id,
            senderId,
            currentDmUserId: currentDmUserId.value,
            isViewingThisConversation,
          });

          if (isViewingThisConversation) {
            dmMessages.value.push(msg.payload);
            // Auto-mark as read since user is viewing this DM
            chatsStore.markDmAsRead(msg.payload.sender_id);
          } else {
            // Show toast notification for DMs when not in that conversation
            if (toastInstance && msg.payload.sender_id !== authStore.user?.id) {
              playNotificationSound();
              toastInstance.add({
                severity: "info",
                summary: `Message from ${msg.payload.sender_username || "Someone"}`,
                detail:
                  msg.payload.content?.substring(0, 50) +
                  (msg.payload.content?.length > 50 ? "..." : ""),
                life: 5000,
              });

              // Show browser notification if tab is not focused
              browserNotifications.showMessageNotification(
                msg.payload.sender_username || "Someone",
                msg.payload.content,
                "dm",
                msg.payload.sender_id,
              );
            }
          }
        }
        break;

      case "user_typing":
        // Update chats store with typing indicator
        chatsStore.setTypingUser(
          msg.payload.user_id,
          msg.payload.user_id !== authStore.user?.id
            ? msg.payload.username
            : null,
        );

        if (
          currentDmUserId.value === msg.payload.user_id &&
          msg.payload.user_id !== authStore.user?.id
        ) {
          typingUser.value = msg.payload.username;
          setTimeout(() => {
            typingUser.value = "";
          }, 2000);
        }
        break;

      case "user_online":
      case "user_offline":
        // Update online status in chats store
        chatsStore.updateOnlineStatus(
          msg.payload.user_id,
          msg.type === "user_online",
          msg.payload.last_seen_at,
        );
        break;

      case "notification":
        // Handle real-time notifications
        const notificationStore = useNotificationStore();
        notificationStore.handleWebSocketNotification(msg.payload);
        // Show toast for the notification
        if (toastInstance) {
          playNotificationSound();
          toastInstance.add({
            severity: "info",
            summary: msg.payload.title || "New Notification",
            detail: msg.payload.body || "",
            life: 5000,
          });
        }
        break;

      case "message_delivered":
        // Update message status to delivered (single tick)
        const messageToDeliver = dmMessages.value.find(
          (m) => m.id === msg.payload.message_id,
        );
        if (messageToDeliver) {
          messageToDeliver.delivered_at = msg.payload.delivered_at;
        }
        break;

      case "messages_read":
        // Update all messages from the other user to read (double tick)
        // Mark all messages sent by the current user to the reader as read
        dmMessages.value.forEach((m) => {
          if (
            m.sender_id === authStore.user?.id &&
            m.receiver_id === msg.payload.reader_id
          ) {
            m.is_read = true;
            m.read_at = msg.payload.read_at;
          }
        });
        break;
    }
  }

  function setToastInstance(toast) {
    toastInstance = toast;
  }

  watch(dmMessages, (newMessages) => {
    newMessages.find((msg) => {
      if (!msg.is_read) {
        firstUnreadMessageId.value = msg.id;
        return true; // Stop after finding the first unread message
      }
    });
  });

  async function clearChatMessages(chatId) {
    try {
      const currentUserId = authStore.user?.id;
      console.log(authStore.user.id, "authStore");

      if (currentUserId && chatId) {
        dmMessages.value = [];
        await db.clearChatMessages(chatId, currentUserId);
        // Also clear the page cache for this conversation
        await db.clearPageCache(chatId, currentUserId);
        console.log(dmMessages.value, "dmMessages clearChatMessages");
      }
    } catch (err) {
      console.error("Failed to clear cached DMs:", err);
    }
  }
  async function clearAllChatMessages() {
    try {
      const currentUserId = authStore.user?.id;

      if (currentUserId) {
        dmMessages.value = [];
        await db.clearAllChatMessages(currentUserId);
        // Clear page cache for current DM if exists
        if (currentDmUserId.value) {
          await db.clearPageCache(currentDmUserId.value, currentUserId);
        }
        console.log(dmMessages.value, "dmMessages clearAllChatMessages");
      }
    } catch (err) {
      console.error("Failed to clear cached DMs:", err);
    }
  }

  function reset() {
    users.value = [];
    currentDmUserId.value = null;
    currentDmUsername.value = "";
    dmMessages.value = [];
    typingUser.value = "";
    chatView.value = "default";
    currentPage.value = 1;
    totalPages.value = 1;
    totalCount.value = 0;
    hasMoreMessages.value = true;
    isLoadingMore.value = false;
  }

  return {
    users,
    firstUnreadMessageId,
    currentDmUserId,
    currentDmUsername,
    dmMessages,
    typingUser,
    chatView,
    // Pagination state
    currentPage,
    totalPages,
    totalCount,
    hasMoreMessages,
    isLoadingMore,
    // Functions
    clearChatMessages,
    sendTyping,
    openDM,
    getDMMessages,
    clearAllChatMessages,
    loadMoreMessages,
    sendDM,
    handleWebSocketMessage,
    setToastInstance,
    reset,
  };
});
