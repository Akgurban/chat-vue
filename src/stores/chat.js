import { defineStore } from "pinia";
import { ref } from "vue";
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
  const chatView = ref("default"); // 'default', 'dm'

  async function openDM(userId, username) {
    if (userId === authStore.user?.id) return;

    currentDmUserId.value = userId;
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

  function sendDM(content) {
    if (!content || !currentDmUserId.value) return;
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

        // Save to IndexedDB
        db.saveMessage(msg.payload);

        if (
          currentDmUserId.value === msg.payload.sender_id ||
          currentDmUserId.value === msg.payload.receiver_id
        ) {
          dmMessages.value.push(msg.payload);
          // Auto-mark as read since user is viewing this DM
          const otherUserId =
            msg.payload.sender_id === authStore.user?.id
              ? msg.payload.receiver_id
              : msg.payload.sender_id;
          chatsStore.markDmAsRead(otherUserId);
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
          msg.payload.last_seen_at
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

  function reset() {
    users.value = [];
    currentDmUserId.value = null;
    currentDmUsername.value = "";
    dmMessages.value = [];
    typingUser.value = "";
    chatView.value = "default";
  }

  return {
    users,
    currentDmUserId,
    currentDmUsername,
    dmMessages,
    typingUser,
    chatView,
    sendTyping,
    openDM,
    sendDM,
    handleWebSocketMessage,
    setToastInstance,
    reset,
  };
});
