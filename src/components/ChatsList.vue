<template>
  <Card class="chats-list-card">
    <template #title>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="pi pi-comments text-primary"></i>
          <span>Chats</span>
          <Badge
            v-if="chatsStore.totalUnread > 0"
            :value="chatsStore.totalUnread"
            severity="danger"
          />
        </div>
        <div class="flex gap-1">
          <Button
            @click="chatsStore.fetchChats()"
            icon="pi pi-refresh"
            size="small"
            text
            rounded
            :loading="chatsStore.loading"
          />
          <Button
            @click="showCreateRoom"
            icon="pi pi-plus"
            size="small"
            severity="success"
            rounded
            v-tooltip.top="'Create Room'"
          />
        </div>
      </div>
    </template>

    <template #content>
      <!-- Filter Tabs -->
      <div class="filter-tabs mb-3">
        <SelectButton
          v-model="chatsStore.currentFilter"
          :options="filterOptions"
          optionLabel="label"
          optionValue="value"
          :allowEmpty="false"
          class="w-full"
        >
          <template #option="{ option }">
            <div class="flex items-center gap-1">
              <i :class="option.icon" class="text-xs"></i>
              <span>{{ option.label }}</span>
              <Badge
                v-if="chatsStore.unreadByType[option.value] > 0"
                :value="chatsStore.unreadByType[option.value]"
                severity="danger"
                class="ml-1"
              />
            </div>
          </template>
        </SelectButton>
      </div>

      <!-- Search -->
      <div class="mb-3">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="searchQuery"
            placeholder="Search chats..."
            class="w-full"
          />
        </IconField>
      </div>

      <!-- Chats List -->
      <div class="chats-container">
        <div
          v-if="chatsStore.loading && chatsStore.chats.length === 0"
          class="text-center py-4"
        >
          <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
          <p class="text-gray-500 mt-2">Loading chats...</p>
        </div>

        <div
          v-else-if="filteredChats.length === 0"
          class="text-center py-4 text-gray-500"
        >
          <i class="pi pi-inbox text-3xl mb-2"></i>
          <p>No chats found</p>
        </div>

        <TransitionGroup name="chat-list" tag="div" v-else>
          <div
            v-for="chat in filteredChats"
            :key="`${chat.type}-${chat.id}`"
            @click="openChat(chat)"
            :class="[
              'chat-item',
              isActiveChat(chat) ? 'active' : '',
              chat.unread_count > 0 ? 'unread' : '',
            ]"
          >
            <!-- Avatar -->
            <div class="chat-avatar">
              <Avatar
                :label="chat.name?.charAt(0).toUpperCase()"
                :style="{ backgroundColor: getAvatarColor(chat.name) }"
                shape="circle"
                class="text-white"
              />
              <!-- Online indicator for DMs -->
              <span
                v-if="chat.type === 'direct'"
                :class="[
                  'online-indicator',
                  chat.is_online ? 'online' : 'offline',
                ]"
              ></span>
              <!-- Room icon -->
              <span v-else class="room-icon">
                <i
                  :class="chat.is_private ? 'pi pi-lock' : 'pi pi-globe'"
                  class="text-xs"
                ></i>
              </span>
            </div>

            <!-- Content -->
            <div class="chat-content">
              <div class="chat-header">
                <span class="chat-name">{{ chat.name }}</span>
                <span class="chat-time">{{
                  formatTime(chat.last_message_at)
                }}</span>
              </div>
              <div class="chat-preview">
                <!-- Typing indicator -->
                <span v-if="getTypingUser(chat)" class="typing-text">
                  <i class="pi pi-ellipsis-h animate-pulse"></i>
                  {{ getTypingUser(chat) }} is typing...
                </span>
                <!-- Last message -->
                <template v-else-if="chat.last_message">
                  <span
                    class="sender"
                    v-if="chat.last_message.sender_id === authStore.user?.id"
                    >You:
                  </span>
                  <span class="sender" v-else-if="chat.type === 'room'"
                    >{{ chat.last_message.sender_username }}:
                  </span>
                  <span class="message-preview">{{
                    chat.last_message.content
                  }}</span>
                </template>
                <span v-else class="no-messages">No messages yet</span>
              </div>
            </div>

            <!-- Unread Badge -->
            <div class="chat-badge" v-if="chat.unread_count > 0">
              <Badge :value="chat.unread_count" severity="danger" />
            </div>
          </div>
        </TransitionGroup>
      </div>
    </template>
  </Card>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useChatsStore } from "../stores/chats";
import Card from "primevue/card";
import Button from "primevue/button";
import Badge from "primevue/badge";
import Avatar from "primevue/avatar";
import SelectButton from "primevue/selectbutton";
import InputText from "primevue/inputtext";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const chatsStore = useChatsStore();

const searchQuery = ref("");

const filterOptions = [
  { label: "All", value: "all", icon: "pi pi-list" },
  { label: "DMs", value: "direct", icon: "pi pi-user" },
  { label: "Rooms", value: "room", icon: "pi pi-home" },
];

const filteredChats = computed(() => {
  let result = chatsStore.filteredChats;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (chat) =>
        chat.name?.toLowerCase().includes(query) ||
        chat.last_message?.content?.toLowerCase().includes(query),
    );
  }

  return result;
});

function openChat(chat) {
  if (chat.type === "direct") {
    router.push(`/dm/${chat.id}`);
  } else {
    router.push(`/room/${chat.id}`);
  }
}

function isActiveChat(chat) {
  if (chat.type === "direct") {
    return route.name === "dm" && route.params.userId == chat.id;
  }
  return route.name === "room" && route.params.roomId == chat.id;
}

function showCreateRoom() {
  router.push("/create-room");
}

function getTypingUser(chat) {
  return chatsStore.getTypingUser(chat.type, chat.id);
}

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
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // Today - show time
  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  // Yesterday
  if (diff < 172800000) {
    return "Yesterday";
  }
  // This week - show day name
  if (diff < 604800000) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  // Older - show date
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
</script>

<style scoped>
.chats-list-card {
  height: 100%;
}

.filter-tabs :deep(.p-selectbutton) {
  display: flex;
}

.filter-tabs :deep(.p-selectbutton .p-togglebutton) {
  flex: 1;
  justify-content: center;
}

.chats-container {
  max-height: 400px;
  overflow-y: auto;
}

/* Chat Item */
.chat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 0.25rem;
}

.chat-item:hover {
  background-color: #f1f5f9;
}

.chat-item.active {
  background-color: #e0e7ff;
}

.chat-item.unread {
  background-color: #fef3c7;
}

.chat-item.unread:hover {
  background-color: #fde68a;
}

/* Avatar */
.chat-avatar {
  position: relative;
  flex-shrink: 0;
}

.online-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid white;
}

.online-indicator.online {
  background-color: #22c55e;
}

.online-indicator.offline {
  background-color: #9ca3af;
}

.room-icon {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: white;
  border-radius: 50%;
  padding: 2px;
  font-size: 10px;
}

/* Content */
.chat-content {
  flex: 1;
  min-width: 0;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.chat-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item.unread .chat-name {
  font-weight: 700;
}

.chat-time {
  font-size: 0.7rem;
  color: #9ca3af;
  flex-shrink: 0;
}

.chat-preview {
  font-size: 0.8rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item.unread .chat-preview {
  color: #374151;
  font-weight: 500;
}

.typing-text {
  color: #22c55e;
  font-style: italic;
}

.sender {
  font-weight: 500;
  color: #6366f1;
}

.no-messages {
  font-style: italic;
  color: #9ca3af;
}

/* Badge */
.chat-badge {
  flex-shrink: 0;
}

/* Transitions */
.chat-list-enter-active,
.chat-list-leave-active {
  transition: all 0.3s ease;
}

.chat-list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.chat-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.chat-list-move {
  transition: transform 0.3s ease;
}
</style>
