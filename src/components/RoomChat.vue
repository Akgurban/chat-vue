<template>
  <div class="telegram-chat">
    <!-- Chat Header -->
    <div class="chat-header">
      <div class="header-info">
        <Avatar
          :label="chatStore.currentRoomName?.charAt(0).toUpperCase()"
          :style="{
            backgroundColor: getAvatarColor(chatStore.currentRoomName),
          }"
          shape="circle"
          class="text-white"
        />
        <div class="header-text">
          <span class="chat-title">{{ chatStore.currentRoomName }}</span>
          <span class="chat-subtitle">
            {{ chatStore.roomMembers.length }} members
            <span v-if="chatStore.typingUser" class="typing-text">
              · {{ chatStore.typingUser }} is typing...
            </span>
          </span>
        </div>
      </div>
      <div class="header-actions">
        <Button
          @click="showChatSettings = !showChatSettings"
          icon="pi pi-palette"
          text
          rounded
          size="small"
        />
        <Button
          @click="showMembers = !showMembers"
          icon="pi pi-users"
          text
          rounded
          size="small"
          :class="{ 'bg-primary-100': showMembers }"
        />
        <Button
          @click="handleLeaveRoom"
          icon="pi pi-sign-out"
          text
          rounded
          size="small"
          severity="danger"
        />
      </div>
    </div>

    <!-- Side Panel for Members -->
    <transition name="slide-panel">
      <div v-if="showMembers" class="members-panel">
        <div class="panel-header">
          <span>Members</span>
          <Button
            icon="pi pi-times"
            text
            rounded
            size="small"
            @click="showMembers = false"
          />
        </div>
        <div class="members-list">
          <div
            v-for="member in chatStore.roomMembers"
            :key="member.id"
            class="member-item"
          >
            <Avatar
              :label="member.username?.charAt(0).toUpperCase()"
              :style="{ backgroundColor: getAvatarColor(member.username) }"
              shape="circle"
              size="small"
              class="text-white"
            />
            <span class="member-name">{{ member.username }}</span>
            <Badge
              :severity="member.status === 'online' ? 'success' : 'secondary'"
              class="ml-auto"
            />
          </div>
        </div>
      </div>
    </transition>

    <!-- Chat Settings -->
    <transition name="slide-down">
      <div v-if="showChatSettings" class="chat-settings-panel">
        <div class="settings-grid">
          <div class="setting-item">
            <label>Theme</label>
            <Select
              v-model="chatSettings.theme"
              :options="themeOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>
          <div class="setting-item">
            <label>Bubble Style</label>
            <Select
              v-model="chatSettings.bubbleStyle"
              :options="bubbleOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>
          <div class="setting-item">
            <label>Color</label>
            <Select
              v-model="chatSettings.myMessageColor"
              :options="colorOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>
          <div class="setting-item flex items-center gap-2">
            <Checkbox
              v-model="chatSettings.showAvatars"
              inputId="avatars"
              binary
            />
            <label for="avatars">Show Avatars</label>
          </div>
        </div>
      </div>
    </transition>

    <!-- Messages Area -->
    <div class="messages-area">
      <MessageList
        :messages="chatStore.roomMessages"
        :theme="chatSettings.theme"
        :bubbleStyle="chatSettings.bubbleStyle"
        :myMessageColor="chatSettings.myMessageColor"
        :showAvatars="chatSettings.showAvatars"
      />
    </div>

    <!-- Message Input -->
    <div class="message-input">
      <form @submit.prevent="handleSend" class="input-form">
        <InputText
          v-model="message"
          @input="chatStore.sendTyping"
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
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { useChatStore } from "../stores/chat";
import Avatar from "primevue/avatar";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Badge from "primevue/badge";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import MessageList from "./MessageList.vue";

const router = useRouter();
const chatStore = useChatStore();

const message = ref("");
const showMembers = ref(false);
const showChatSettings = ref(false);

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
    chatStore.sendRoomMessage(message.value.trim());
    message.value = "";
  }
}

async function handleLeaveRoom() {
  await chatStore.leaveCurrentRoom();
  router.push("/");
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

.typing-text {
  color: #22c55e;
  font-style: italic;
}

.header-actions {
  display: flex;
  gap: 4px;
}

/* Members Panel */
.members-panel {
  position: absolute;
  right: 0;
  top: 60px;
  bottom: 70px;
  width: 260px;
  background: white;
  border-left: 1px solid #e5e7eb;
  z-index: 10;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
}

.members-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.15s;
}

.member-item:hover {
  background: #f1f5f9;
}

.member-name {
  flex: 1;
  font-size: 14px;
}

/* Settings Panel */
.chat-settings-panel {
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
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
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.3s ease;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
}

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

  .members-panel {
    width: 100%;
  }
}
</style>
