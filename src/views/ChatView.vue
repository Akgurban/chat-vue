<template>
  <div class="telegram-layout">
    <!-- Sidebar -->
    <aside
      class="sidebar"
      :class="{ 'sidebar-hidden': isChatOpen && isMobile }"
    >
      <!-- Header -->
      <div class="sidebar-header">
        <div class="flex items-center gap-3">
          <Avatar
            :label="authStore.user?.username?.charAt(0).toUpperCase()"
            shape="circle"
            class="cursor-pointer"
            @click="showMenu = !showMenu"
          />
          <span class="font-semibold text-lg">{{
            authStore.user?.username
          }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Button
            icon="pi pi-cog"
            text
            rounded
            size="small"
            @click="showSettings = true"
          />
        </div>
      </div>

      <!-- Search -->
      <div class="sidebar-search">
        <div class="flex items-center">
          <Search />
          <InputText
            v-model="searchQuery"
            placeholder="Search chats or users..."
            class="w-full"
            @input="handleSearchInput"
          />
          <Search
            v-if="searchQuery"
            class="pi pi-times cursor-pointer"
            @click="clearSearch"
          />
        </div>
      </div>

      <!-- Search Results (Users from API) -->
      <div v-if="searchQuery && searchQuery.length >= 2" class="search-results">
        <!-- Loading -->
        <div v-if="searchLoading" class="search-loading">
          <i class="pi pi-spin pi-spinner"></i>
          <span>Searching users...</span>
        </div>

        <!-- User Search Results -->
        <div v-else-if="searchResults.length > 0" class="search-section">
          <div class="search-section-title">
            <i class="pi pi-users"></i>
            <span>Users</span>
          </div>
          <div
            v-for="user in searchResults"
            :key="'search-' + user.id"
            @click="startChatWithUser(user)"
            class="search-item"
          >
            <Avatar
              :label="user.username?.charAt(0).toUpperCase()"
              :style="{ backgroundColor: getAvatarColor(user.username) }"
              shape="circle"
              class="text-white"
            />
            <div class="search-item-info">
              <span class="search-item-name">{{ user.username }}</span>
              <span class="search-item-email" v-if="user.email">{{
                user.email
              }}</span>
            </div>
            <span
              :class="['status-dot', user.is_online ? 'online' : 'offline']"
            ></span>
          </div>
        </div>

        <!-- No Results -->
        <div
          v-else-if="!searchLoading && searchQuery.length >= 2"
          class="search-empty"
        >
          <i class="pi pi-search"></i>
          <span>No users found</span>
        </div>
      </div>

      <!-- Chats List -->
      <div class="chats-list">
        <div
          v-if="chatsStore.loading && chatsStore.chats.length === 0"
          class="loading-state"
        >
          <i class="pi pi-spin pi-spinner text-2xl"></i>
          <span>Loading...</span>
        </div>

        <div v-else-if="filteredChats.length === 0" class="empty-state">
          <i class="pi pi-inbox text-4xl"></i>
          <span>No chats found</span>
        </div>

        <TransitionGroup name="chat-list" tag="div" v-else>
          <div
            v-for="chat in filteredChats"
            :key="`${chat.type}-${chat.id}`"
            @click="openChat(chat)"
            :class="[
              'chat-item',
              { active: isActiveChat(chat), unread: chat.unread_count > 0 },
            ]"
          >
            <!-- Avatar -->
            <div class="chat-avatar">
              <Avatar
                :label="chat.name?.charAt(0).toUpperCase()"
                :style="{ backgroundColor: getAvatarColor(chat.name) }"
                shape="circle"
                size="large"
                class="text-white"
              />
              <span
                v-if="chat.type === 'direct'"
                :class="['status-dot', chat.is_online ? 'online' : 'offline']"
              ></span>
              <span v-else class="type-icon">
                <i
                  :class="chat.is_private ? 'pi pi-lock' : 'pi pi-users'"
                  style="font-size: 10px"
                ></i>
              </span>
            </div>

            <!-- Content -->
            <div class="chat-info">
              <div class="chat-top">
                <span class="chat-name">{{ chat.name }}</span>
                <span class="chat-time">{{
                  formatTime(chat.last_message_at)
                }}</span>
              </div>
              <div class="chat-bottom">
                <span v-if="getTypingUser(chat)" class="typing">
                  {{ getTypingUser(chat) }} is typing...
                </span>
                <template v-else-if="chat.last_message">
                  <span
                    class="sender"
                    v-if="chat.last_message.sender_id === authStore.user?.id"
                    >You:
                  </span>
                  <span class="preview">{{ chat.last_message.content }}</span>
                </template>
                <span v-else class="no-msg">No messages yet</span>
              </div>
            </div>

            <!-- Unread Badge -->
            <Badge
              v-if="chat.unread_count > 0"
              :value="chat.unread_count"
              severity="danger"
              class="unread-badge"
            />
          </div>
        </TransitionGroup>

        <!-- End of chats list -->
      </div>

      <!-- Logout at bottom -->
      <div class="sidebar-footer">
        <ConnectionStatus />
        <Button
          @click="handleLogout"
          label="Logout"
          severity="danger"
          text
          icon="pi pi-sign-out"
          class="w-full"
        />
      </div>
    </aside>

    <!-- Main Chat Area -->
    <main
      class="chat-area"
      :class="{ 'chat-visible': isChatOpen || !isMobile }"
    >
      <!-- Back button for mobile -->
      <div v-if="isMobile && isChatOpen" class="mobile-back" @click="goBack">
        <i class="pi pi-arrow-left"></i>
        <span>Back</span>
      </div>

      <router-view v-slot="{ Component }">
        <transition name="slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, provide } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useWebSocketStore } from "../stores/websocket";
import { useChatStore } from "../stores/chat";
import { useNotificationStore } from "../stores/notifications";
import { useChatsStore } from "../stores/chats";
import { browserNotifications } from "../utils/notifications";
import Button from "primevue/button";
import Avatar from "primevue/avatar";
import Badge from "primevue/badge";
import InputText from "primevue/inputtext";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import { Search } from "@lucide/vue";

import ConnectionStatus from "../components/ConnectionStatus.vue";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const wsStore = useWebSocketStore();
const chatStore = useChatStore();
const notificationStore = useNotificationStore();
const chatsStore = useChatsStore();

const searchQuery = ref("");
const searchResults = ref([]);
const searchLoading = ref(false);
const showMenu = ref(false);
const showSettings = ref(false);
const windowWidth = ref(window.innerWidth);

let searchDebounceTimer = null;

// Data to share with child components (DirectMessageChat)
const chatViewData = ref({
  isRefreshed: false,
  searchQuery: "",
  // Add any other data you want to pass
});

// Track if page was refreshed - will be consumed by child when ready
const pendingPageRefresh = ref(false);

// Store for child callbacks - child registers, parent calls
const childCallbacks = ref({
  onRouteChange: null,
  onPageRefresh: null, // Called when page is refreshed (F5) without route change
  // Add more callbacks as needed
});

// Function for child to register its callback
function registerCallback(name, callback) {
  childCallbacks.value[name] = callback;

  // If child registers onPageRefresh and we have a pending refresh, call it immediately
  if (name === "onPageRefresh" && callback && pendingPageRefresh.value) {
    callback();
    pendingPageRefresh.value = false;
  }
}

// Provide data and register function to all child components
provide("chatViewData", chatViewData);
provide("registerParentCallback", registerCallback);

const isMobile = computed(() => windowWidth.value < 768);
const isChatOpen = computed(() => route.name === "dm");

const filteredChats = computed(() => {
  let result = chatsStore.chats;
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

// Handle search input with debounce
function handleSearchInput() {
  clearTimeout(searchDebounceTimer);

  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = [];
    searchLoading.value = false;
    return;
  }

  searchLoading.value = true;
  searchDebounceTimer = setTimeout(async () => {
    await performSearch();
  }, 300);
}

// Perform the actual search
async function performSearch() {
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = [];
    searchLoading.value = false;
    return;
  }

  try {
    const results = await chatsStore.searchUsers(searchQuery.value);
    // Filter out current user and users already in chat list
    const existingChatIds = chatsStore.chats.map((c) => c.id);
    searchResults.value = results.filter(
      (user) =>
        user.id !== authStore.user?.id && !existingChatIds.includes(user.id),
    );
  } catch (err) {
    console.error("Search failed:", err);
    searchResults.value = [];
  } finally {
    searchLoading.value = false;
  }
}

// Clear search
function clearSearch() {
  searchQuery.value = "";
  searchResults.value = [];
  searchLoading.value = false;
}

// Start chat with a user from search results
function startChatWithUser(user) {
  clearSearch();
  router.push(`/dm/${user.id}`);
}

function handleResize() {
  windowWidth.value = window.innerWidth;
}

onMounted(() => {
  const navEntry = performance.getEntriesByType("navigation")[0];
  const isPageRefresh = navEntry?.type === "reload";

  if (isPageRefresh) {
    console.log("Page was refreshed (F5)!");
    chatViewData.value.isRefreshed = true;
    pendingPageRefresh.value = true; // Mark as pending, child will consume when ready
  }

  window.addEventListener("resize", handleResize);
  initializeApp();
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});

watch(route, () => {
  chatViewData.value.isRefreshed = false;

  // Call the child's registered callback if it exists
  if (childCallbacks.value.onRouteChange) {
    childCallbacks.value.onRouteChange();
  }
});

watch(
  () => authStore.isAuthenticated,
  (isAuth) => {
    if (isAuth) {
      initializeApp();
    } else {
      router.push("/login");
    }
  },
);

async function initializeApp() {
  if (authStore.isAuthenticated) {
    // Initialize from IndexedDB cache first (fast load)
    await chatsStore.initFromCache();

    // Connect WebSocket
    wsStore.connect();
    wsStore.addMessageHandler(chatStore.handleWebSocketMessage);

    // Fetch chats from server (updates cache)
    await chatsStore.fetchChats();

    // Request notification permission
    browserNotifications.requestPermission();
  }
}

function handleLogout() {
  wsStore.disconnect();
  authStore.logout();
  chatStore.reset();
  notificationStore.reset();
  chatsStore.reset();
  router.push("/login");
}

function openChat(chat) {
  router.push(`/dm/${chat.id}`);
}

function isActiveChat(chat) {
  return route.name === "dm" && route.params.userId == chat.id;
}

function goBack() {
  router.push("/");
}

function getTypingUser(chat) {
  return chatsStore.getTypingUser(chat.id);
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
  return colors[name.charCodeAt(0) % colors.length];
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 172800000) return "Yesterday";
  if (diff < 604800000)
    return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
</script>

<style scoped>
.telegram-layout {
  display: flex;
  height: 100vh;
  background: #f0f2f5;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 350px;
  min-width: 350px;
  background: white;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  transition: transform 0.3s ease;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.sidebar-search {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.search-input-wrapper {
  position: relative;
}

.search-clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.search-clear-btn:hover {
  background: #f1f5f9;
  color: #64748b;
}

/* Search Results */
.search-results {
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  max-height: 300px;
  overflow-y: auto;
}

.search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #64748b;
  font-size: 14px;
  gap: 8px;
}

.search-section {
  padding: 8px;
}

.search-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  padding: 8px 12px 4px;
  letter-spacing: 0.5px;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.search-item:hover {
  background: #e2e8f0;
}

.search-item-info {
  flex: 1;
  min-width: 0;
}

.search-item-name {
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-item-email {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #94a3b8;
  font-size: 14px;
  gap: 4px;
}

.sidebar-filters {
  display: flex;
  padding: 8px 16px;
  gap: 8px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.filter-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
}

.filter-tab:hover {
  background: #e2e8f0;
}

.filter-tab.active {
  background: #6366f1;
  color: white;
}

.filter-tab.active .p-badge {
  background: white;
  color: #6366f1;
}

/* Chats List */
.chats-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #94a3b8;
  gap: 8px;
}

/* Chat Item */
.chat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chat-item:hover {
  background: #f1f5f9;
}

.chat-item.active {
  background: #e0e7ff;
}

.chat-item.unread {
  background: #fefce8;
}

.chat-item.unread:hover {
  background: #fef9c3;
}

.chat-avatar {
  position: relative;
  flex-shrink: 0;
}

.status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
}

.status-dot.online {
  background: #22c55e;
}

.status-dot.offline {
  background: #94a3b8;
}

.type-icon {
  position: absolute;
  bottom: 0;
  right: 0;
  background: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.chat-info {
  flex: 1;
  min-width: 0;
}

.chat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.chat-name {
  font-weight: 600;
  font-size: 15px;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item.unread .chat-name {
  font-weight: 700;
}

.chat-time {
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}

.chat-bottom {
  font-size: 14px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item.unread .chat-bottom {
  color: #334155;
  font-weight: 500;
}

.typing {
  color: #22c55e;
  font-style: italic;
}

.sender {
  color: #6366f1;
  font-weight: 500;
}

.no-msg {
  font-style: italic;
  color: #94a3b8;
}

.unread-badge {
  flex-shrink: 0;
}

/* Sidebar Footer */
.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
}

/* Main Chat Area */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
  position: relative;
}

.mobile-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  color: #6366f1;
  font-weight: 500;
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

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Mobile */
@media (max-width: 767px) {
  .sidebar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    z-index: 10;
  }

  .sidebar-hidden {
    transform: translateX(-100%);
  }

  .chat-area {
    width: 100%;
  }
}
</style>
