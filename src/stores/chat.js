import { defineStore } from "pinia";
import { ref } from "vue";
import { useAuthStore } from "./auth";
import { useWebSocketStore } from "./websocket";
import { useNotificationStore } from "./notifications";
import { useChatsStore } from "./chats";
import { useToast } from "primevue/usetoast";
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
  const rooms = ref([]);
  const myRooms = ref([]);
  const currentRoomId = ref(null);
  const currentRoomName = ref("");
  const currentDmUserId = ref(null);
  const currentDmUsername = ref("");
  const roomMessages = ref([]);
  const dmMessages = ref([]);
  const roomMembers = ref([]);
  const typingUser = ref("");
  const chatView = ref("default"); // 'default', 'room', 'dm', 'createRoom'

  let typingTimeout = null;

  async function loadUsers() {
    try {
      // First load from cache
      const cachedUsers = await db.getUsers();
      if (cachedUsers.length > 0) {
        users.value = cachedUsers;
      }
      // Then fetch from server
      const serverUsers = await authStore.api("/api/users");
      users.value = serverUsers;
      // Save to IndexedDB
      await db.saveUsers(serverUsers);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  }

  async function loadRooms() {
    try {
      rooms.value = await authStore.api("/api/rooms");
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  }

  async function loadMyRooms() {
    try {
      myRooms.value = await authStore.api("/api/rooms/my");
    } catch (err) {
      console.error("Failed to load my rooms:", err);
    }
  }

  async function createRoom(name, description, isPrivate) {
    try {
      const room = await authStore.api("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ name, description, is_private: isPrivate }),
      });
      await loadRooms();
      await loadMyRooms();
      openRoom(room.id, room.name);
      return true;
    } catch (err) {
      console.error("Failed to create room:", err);
      return false;
    }
  }

  async function joinRoom(roomId, roomName) {
    try {
      await authStore.api(`/api/rooms/${roomId}/join`, { method: "POST" });
      await loadMyRooms();
      openRoom(roomId, roomName);
    } catch (err) {
      // Already a member, just open it
      openRoom(roomId, roomName);
    }
  }

  async function openRoom(roomId, roomName) {
    // Leave previous room if any
    if (currentRoomId.value) {
      wsStore.send("leave_room", { room_id: currentRoomId.value });
    }

    currentRoomId.value = roomId;
    currentRoomName.value = roomName;
    currentDmUserId.value = null;
    currentDmUsername.value = "";
    chatView.value = "room";
    roomMembers.value = [];

    // Join room via WebSocket
    wsStore.send("join_room", { room_id: roomId });

    // Load messages from cache first
    try {
      const cachedMessages = await db.getMessagesByRoom(roomId);
      if (cachedMessages.length > 0) {
        roomMessages.value = cachedMessages;
      }
    } catch (err) {
      console.error("Failed to load cached messages:", err);
    }

    // Then load from server (only new messages if we have cache)
    try {
      const lastMsgId = await db.getLastMessageId("room", roomId);
      let url = `/api/rooms/${roomId}/messages`;
      if (lastMsgId) {
        url += `?after=${lastMsgId}`;
      }
      const serverMessages = await authStore.api(url);

      if (lastMsgId && serverMessages.length > 0) {
        // Append new messages
        roomMessages.value = [...roomMessages.value, ...serverMessages];
        await db.saveMessages(serverMessages, "room");
      } else if (!lastMsgId) {
        // No cache, use server messages
        roomMessages.value = serverMessages;
        await db.saveMessages(serverMessages, "room");
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      if (roomMessages.value.length === 0) {
        roomMessages.value = [];
      }
    }
  }

  async function leaveCurrentRoom() {
    if (!currentRoomId.value) return;
    try {
      await authStore.api(`/api/rooms/${currentRoomId.value}/leave`, {
        method: "POST",
      });
      wsStore.send("leave_room", { room_id: currentRoomId.value });
      currentRoomId.value = null;
      currentRoomName.value = "";
      chatView.value = "default";
      await loadMyRooms();
    } catch (err) {
      console.error("Failed to leave room:", err);
    }
  }

  async function loadRoomMembers() {
    if (!currentRoomId.value) return;
    try {
      const room = await authStore.api(`/api/rooms/${currentRoomId.value}`);
      roomMembers.value = room.members || [];
    } catch (err) {
      console.error("Failed to load members:", err);
    }
  }

  function sendRoomMessage(content) {
    if (!content || !currentRoomId.value) return;
    wsStore.send("chat_message", { room_id: currentRoomId.value, content });
  }

  function sendTyping() {
    if (!currentRoomId.value) return;
    wsStore.send("typing", { room_id: currentRoomId.value });
  }

  async function openDM(userId, username) {
    if (userId === authStore.user?.id) return;

    // Leave room if any
    if (currentRoomId.value) {
      wsStore.send("leave_room", { room_id: currentRoomId.value });
      currentRoomId.value = null;
      currentRoomName.value = "";
    }

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
      const lastMsgId = await db.getLastMessageId(
        "direct",
        userId,
        authStore.user?.id,
      );
      let url = `/api/dm/${userId}`;
      if (lastMsgId) {
        url += `?after=${lastMsgId}`;
      }
      const serverMessages = await authStore.api(url);

      if (lastMsgId && serverMessages.length > 0) {
        // Append new messages
        dmMessages.value = [...dmMessages.value, ...serverMessages];
        await db.saveMessages(serverMessages, "direct");
      } else if (!lastMsgId) {
        // No cache, use server messages
        dmMessages.value = serverMessages;
        await db.saveMessages(serverMessages, "direct");
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

  function handleWebSocketMessage(msg) {
    const chatsStore = useChatsStore();

    switch (msg.type) {
      case "new_message":
        // Update chats store with new message
        chatsStore.handleNewMessage(msg.payload, "room");

        // Save to IndexedDB
        db.saveMessage(msg.payload, "room");

        if (currentRoomId.value === msg.payload.room_id) {
          roomMessages.value.push(msg.payload);
          // Auto-mark as read since user is viewing this room
          chatsStore.markRoomAsRead(msg.payload.room_id);
        } else {
          // Show toast notification for messages in other rooms
          if (toastInstance && msg.payload.sender_id !== authStore.user?.id) {
            playNotificationSound();
            toastInstance.add({
              severity: "info",
              summary: `New message in room`,
              detail: `${msg.payload.sender_username || "Someone"}: ${msg.payload.content?.substring(0, 50)}${msg.payload.content?.length > 50 ? "..." : ""}`,
              life: 5000,
            });

            // Show browser notification if tab is not focused
            browserNotifications.showMessageNotification(
              msg.payload.sender_username || "Someone",
              msg.payload.content,
              "room",
              msg.payload.room_id,
            );
          }
        }
        break;

      case "new_direct_message":
        // Update chats store with new message
        chatsStore.handleNewMessage(msg.payload, "direct");

        // Save to IndexedDB
        db.saveMessage(msg.payload, "direct");

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

      case "user_joined":
        if (currentRoomId.value === msg.payload.room_id) {
          roomMessages.value.push({
            type: "system",
            content: `${msg.payload.username} joined the room`,
          });
        }
        break;

      case "user_left":
        if (currentRoomId.value === msg.payload.room_id) {
          roomMessages.value.push({
            type: "system",
            content: `${msg.payload.username} left the room`,
          });
        }
        break;

      case "user_typing":
        // Update chats store with typing indicator
        chatsStore.setTypingUser(
          msg.payload.room_id ? "room" : "direct",
          msg.payload.room_id || msg.payload.user_id,
          msg.payload.user_id !== authStore.user?.id
            ? msg.payload.username
            : null,
        );

        if (
          currentRoomId.value === msg.payload.room_id &&
          msg.payload.user_id !== authStore.user?.id
        ) {
          typingUser.value = msg.payload.username;
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => {
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
    }
  }

  function showCreateRoom() {
    chatView.value = "createRoom";
  }

  function hideCreateRoom() {
    chatView.value = "default";
  }

  function setToastInstance(toast) {
    toastInstance = toast;
  }

  function reset() {
    users.value = [];
    rooms.value = [];
    myRooms.value = [];
    currentRoomId.value = null;
    currentRoomName.value = "";
    currentDmUserId.value = null;
    currentDmUsername.value = "";
    roomMessages.value = [];
    dmMessages.value = [];
    roomMembers.value = [];
    typingUser.value = "";
    chatView.value = "default";
  }

  return {
    users,
    rooms,
    myRooms,
    currentRoomId,
    currentRoomName,
    currentDmUserId,
    currentDmUsername,
    roomMessages,
    dmMessages,
    roomMembers,
    typingUser,
    chatView,
    loadUsers,
    loadRooms,
    loadMyRooms,
    createRoom,
    joinRoom,
    openRoom,
    leaveCurrentRoom,
    loadRoomMembers,
    sendRoomMessage,
    sendTyping,
    openDM,
    sendDM,
    handleWebSocketMessage,
    showCreateRoom,
    hideCreateRoom,
    setToastInstance,
    reset,
  };
});
