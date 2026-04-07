<template>
  <div class="telegram-chat">
    <!-- Chat Header -->
    <div class="chat-header">
      <div class="header-info">
        <Avatar
          :label="chatStore.currentDmUsername?.charAt(0).toUpperCase()"
          :style="{
            backgroundColor: getAvatarColor(chatStore.currentDmUsername),
          }"
          shape="circle"
          class="text-white"
        />
        <div class="header-text">
          <span class="chat-title">{{ chatStore.currentDmUsername }}</span>
          <span class="chat-subtitle">Direct Message</span>
        </div>
      </div>
      <div class="header-actions">
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          rounded
          size="small"
          v-tooltip.bottom="'Clear chat'"
          @click="confirmClearChat"
          :loading="clearing"
        />
      </div>
    </div>

    <!-- Messages Area -->
    <div class="messages-area">
      <MessageList
        ref="messageListRef"
        :messages="chatStore.dmMessages"
        :theme="chatSettings.theme"
        :bubbleStyle="chatSettings.bubbleStyle"
        :myMessageColor="chatSettings.myMessageColor"
        :showAvatars="chatSettings.showAvatars"
        :unreadCount="currentChatUnread"
        :firstUnreadId="firstUnreadMessageId"
        :firstNewMessageId="chatStore.firstNewDmMessageId"
        chatType="direct"
        :chatId="chatStore.currentDmUserId"
        @messageRead="handleMessageRead"
        @markAllRead="handleMarkAllRead"
      />
    </div>

    <!-- Message Input -->
    <div class="message-input">
      <form @submit.prevent="handleSend" class="input-form">
        <InputText
          v-model="message"
          placeholder="Write a message..."
          class="flex-1"
        />
        <Button
          type="submit"
          icon="pi pi-send"
          rounded
          :disabled="!message.trim()"
        />
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick } from "vue";
import { useChatStore } from "../stores/chat";
import { useChatsStore } from "../stores/chats";
import { useAuthStore } from "../stores/auth";
import { useWebSocketStore } from "../stores/websocket";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Avatar from "primevue/avatar";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import MessageList from "./MessageList.vue";

const chatStore = useChatStore();
const chatsStore = useChatsStore();
const authStore = useAuthStore();
const wsStore = useWebSocketStore();
const message = ref("");
const messageListRef = ref(null);
const clearing = ref(false);

// Get current chat's unread info
const currentChat = computed(() => {
  return chatsStore.chats.find(
    (c) => c.type === "direct" && c.id === chatStore.currentDmUserId,
  );
});

const currentChatUnread = computed(() => {
  return currentChat.value?.unread_count || 0;
});

const firstUnreadMessageId = computed(() => {
  if (currentChatUnread.value === 0) return null;
  // Get the first unread message ID (messages from the end minus unread count)
  const messages = chatStore.dmMessages;
  const unreadIndex = messages.length - currentChatUnread.value;
  if (unreadIndex >= 0 && unreadIndex < messages.length) {
    return messages[unreadIndex]?.id;
  }
  return null;
});

const chatSettings = reactive({
  theme: "modern",
  bubbleStyle: "rounded",
  myMessageColor: "primary",
  showAvatars: true,
});

const themeOptions = [
  { label: "Modern", value: "modern" },
  { label: "Classic", value: "classic" },
  { label: "Minimal", value: "minimal" },
  { label: "Bubble", value: "bubble" },
];

const bubbleOptions = [
  { label: "Rounded", value: "rounded" },
  { label: "Sharp", value: "sharp" },
  { label: "Pill", value: "pill" },
];

const colorOptions = [
  { label: "Purple", value: "primary" },
  { label: "Green", value: "green" },
  { label: "Blue", value: "blue" },
  { label: "Pink", value: "purple" },
];

function getAvatarColor(name) {
  if (!name) return "#6366f1";
  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f43f5e",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
  ];
  return colors[name.charCodeAt(0) % colors.length];
}

function handleSend() {
  if (message.value.trim()) {
    chatStore.sendDM(message.value.trim());
    message.value = "";
    // Scroll to bottom after sending message
    nextTick(() => {
      messageListRef.value?.scrollToBottom();
    });
  }
}

/**
 * Handle individual message being read (via Intersection Observer)
 * Send WebSocket event to mark this specific message as read
 */
function handleMessageRead(messageId) {
  if (!chatStore.currentDmUserId || !messageId) return;

  // Send WebSocket message to mark this message as read
  wsStore.send("message_read", {
    message_id: messageId,
    user_id: chatStore.currentDmUserId,
    type: "direct",
  });

  // Decrease unread count in local state
  chatsStore.decreaseUnreadCount("direct", chatStore.currentDmUserId);
}

/**
 * Handle mark all messages as read (when clicking scroll to bottom)
 * Calls the API to mark all messages as read
 */
async function handleMarkAllRead() {
  if (!chatStore.currentDmUserId) return;

  try {
    await authStore.api(`/api/dm/read/${chatStore.currentDmUserId}`, {
      method: "POST",
    });
    // Update local state
    chatsStore.markDmAsRead(chatStore.currentDmUserId);
  } catch (err) {
    console.error("Failed to mark messages as read:", err);
  }
}

/**
 * Confirm and clear chat
 */
async function confirmClearChat() {
  if (!chatStore.currentDmUserId) return;

  const confirmed = window.confirm(
    `Are you sure you want to clear this chat with ${chatStore.currentDmUsername}? This action cannot be undone.`,
  );

  if (!confirmed) return;

  clearing.value = true;
  try {
    const success = await chatsStore.clearChat(chatStore.currentDmUserId);
    if (success) {
      // Clear local messages
      chatStore.dmMessages.length = 0;
    }
  } finally {
    clearing.value = false;
  }
}
</script>

<style scoped>
.telegram-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.chat-title {
  font-weight: 600;
  font-size: 16px;
  color: #1e293b;
}

.chat-subtitle {
  font-size: 13px;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  align-items: end;
}

.setting-item label {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

/* Messages Area */
.messages-area {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
}

/* Message Input */
.message-input {
  padding: 12px 16px;
  background: #f8fafc;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.input-form {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-form :deep(.p-inputtext) {
  border-radius: 24px;
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
