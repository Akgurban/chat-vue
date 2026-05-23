<template>
  <div class="telegram-layout">
    <aside
      class="sidebar"
      :class="{ 'sidebar-hidden': isChatOpen && isMobile }"
    >
      <!-- Header: Chats + search -->
      <header class="sidebar-header">
        <button
          type="button"
          class="menu-btn"
          :class="{ 'menu-btn--open': showMenu }"
          aria-label="Menu"
          @click="showMenu = !showMenu"
        >
          <i class="pi pi-bars"></i>
        </button>
        <div v-if="wsStore.isConnected" class="header-search">
          <i class="pi pi-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search"
            class="search-input"
            @input="handleSearchInput"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="search-clear"
            aria-label="Clear search"
            @click="clearSearch"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </header>

      <!-- Connection status (replaces search row when offline) -->
      <div v-if="!wsStore.isConnected" class="connection-banner">
        <i
          :class="
            wsStore.isReconnecting
              ? 'pi pi-spin pi-spinner'
              : 'pi pi-exclamation-circle'
          "
        ></i>
        <span>{{
          wsStore.isReconnecting
            ? "Retrying to connect..."
            : "Disconnected"
        }}</span>
      </div>

      <!-- Menu dropdown (settings + logout) -->
      <div v-if="showMenu" class="sidebar-menu">
        <div class="user-menu">
          <Avatar
            :label="authStore.user?.username?.charAt(0).toUpperCase()"
            shape="circle"
            class="user-avatar"
          />
          <div class="user-menu-info">
            <span class="user-menu-name">{{ authStore.user?.username }}</span>
            <span class="user-menu-status">Online</span>
          </div>
        </div>
        <button type="button" class="menu-item" @click="openSettings">
          <i class="pi pi-cog"></i>
          <span>Settings</span>
        </button>
        <button
          type="button"
          class="menu-item menu-item--danger"
          @click="handleLogout"
        >
          <i class="pi pi-sign-out"></i>
          <span>Log out</span>
        </button>
      </div>

      <!-- Search results -->
      <div
        v-if="wsStore.isConnected && searchQuery && searchQuery.length >= 2"
        class="search-results"
      >
        <div v-if="searchLoading" class="search-state">
          <i class="pi pi-spin pi-spinner"></i>
          <span>Searching...</span>
        </div>
        <template v-else-if="searchResults.length > 0">
          <p class="search-label">Global search</p>
          <button
            v-for="user in searchResults"
            :key="'search-' + user.id"
            type="button"
            class="chat-row search-row"
            @click="startChatWithUser(user)"
          >
            <div class="avatar-wrap">
              <Avatar
                :label="user.username?.charAt(0).toUpperCase()"
                :style="{ backgroundColor: getAvatarColor(user.username) }"
                shape="circle"
                class="text-white"
              />
              <span
                :class="['status-dot', user.is_online ? 'online' : 'offline']"
              ></span>
            </div>
            <div class="chat-row-body">
              <span class="chat-row-name">{{ user.username }}</span>
              <span v-if="user.email" class="chat-row-preview">{{
                user.email
              }}</span>
            </div>
          </button>
        </template>
        <div v-else class="search-state">
          <span>No users found</span>
        </div>
      </div>

      <!-- Chats list -->
      <div class="chats-list">
        <div
          v-if="chatsStore.loading && chatsStore.chats.length === 0"
          class="list-state"
        >
          <i class="pi pi-spin pi-spinner"></i>
        </div>
        <div v-else-if="filteredChats.length === 0" class="list-state">
          <i class="pi pi-inbox"></i>
          <span>No chats yet</span>
        </div>
        <TransitionGroup v-else name="chat-list" tag="div">
          <button
            v-for="chat in filteredChats"
            :key="`${chat.type}-${chat.id}`"
            type="button"
            :class="[
              'chat-row',
              { active: isActiveChat(chat), unread: chat.unread_count > 0 },
            ]"
            @click="openChat(chat)"
          >
            <div class="avatar-wrap">
              <Avatar
                :label="chat.name?.charAt(0).toUpperCase()"
                :style="{ backgroundColor: getAvatarColor(chat.name) }"
                shape="circle"
                class="text-white chat-avatar-lg"
              />
              <span
                v-if="chat.type === 'direct'"
                :class="['status-dot', chat.is_online ? 'online' : 'offline']"
              ></span>
            </div>
            <div class="chat-row-body">
              <div class="chat-row-top">
                <span class="chat-row-name">{{ chat.name }}</span>
                <span class="chat-row-time">{{
                  formatTime(chat.last_message_at)
                }}</span>
              </div>
              <div class="chat-row-bottom">
                <span v-if="getTypingUser(chat)" class="typing">typing</span>
                <template v-else-if="chat.last_message">
                  <span
                    v-if="chat.last_message.sender_id === authStore.user?.id"
                    class="you"
                    >You:
                  </span>
                  <span class="chat-row-preview">{{
                    chat.last_message.content
                  }}</span>
                </template>
                <span v-else class="chat-row-preview muted">No messages</span>
              </div>
            </div>
            <span v-if="chat.unread_count > 0" class="unread-pill">
              {{ chat.unread_count > 99 ? "99+" : chat.unread_count }}
            </span>
          </button>
        </TransitionGroup>
      </div>

    </aside>

    <main class="chat-area" :class="{ 'chat-visible': isChatOpen || !isMobile }">
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

    <SettingsDialog v-if="showSettings" @close="showSettings = false" />
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
import Avatar from "primevue/avatar";
import SettingsDialog from "../components/SettingsDialog.vue";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const chatStore = useChatStore();
const notificationStore = useNotificationStore();
const chatsStore = useChatsStore();
const wsStore = useWebSocketStore();

const searchQuery = ref("");
const searchResults = ref([]);
const searchLoading = ref(false);
const showMenu = ref(false);
const showSettings = ref(false);
const windowWidth = ref(window.innerWidth);

let searchDebounceTimer = null;

const chatViewData = ref({ isRefreshed: false, searchQuery: "" });
const pendingPageRefresh = ref(false);
const childCallbacks = ref({
  onRouteChange: null,
  onPageRefresh: null,
});

function registerCallback(name, callback) {
  childCallbacks.value[name] = callback;
  if (name === "onPageRefresh" && callback && pendingPageRefresh.value) {
    callback();
    pendingPageRefresh.value = false;
  }
}

provide("chatViewData", chatViewData);
provide("registerParentCallback", registerCallback);

const isMobile = computed(() => windowWidth.value < 768);
const isChatOpen = computed(() => route.name === "dm");

const filteredChats = computed(() => {
  let result = chatsStore.chats;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.last_message?.content?.toLowerCase().includes(q),
    );
  }
  return result;
});

function handleSearchInput() {
  clearTimeout(searchDebounceTimer);
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = [];
    searchLoading.value = false;
    return;
  }
  searchLoading.value = true;
  searchDebounceTimer = setTimeout(performSearch, 300);
}

async function performSearch() {
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = [];
    searchLoading.value = false;
    return;
  }
  try {
    const results = await chatsStore.searchUsers(searchQuery.value);
    const existingIds = chatsStore.chats.map((c) => c.id);
    searchResults.value = results.filter(
      (u) => u.id !== authStore.user?.id && !existingIds.includes(u.id),
    );
  } catch {
    searchResults.value = [];
  } finally {
    searchLoading.value = false;
  }
}

function clearSearch() {
  searchQuery.value = "";
  searchResults.value = [];
  searchLoading.value = false;
}

function openSettings() {
  showMenu.value = false;
  showSettings.value = true;
}

function startChatWithUser(user) {
  clearSearch();
  router.push(`/dm/${user.id}`);
}

function handleResize() {
  windowWidth.value = window.innerWidth;
}

onMounted(() => {
  const navEntry = performance.getEntriesByType("navigation")[0];
  if (navEntry?.type === "reload") {
    chatViewData.value.isRefreshed = true;
    pendingPageRefresh.value = true;
  }
  window.addEventListener("resize", handleResize);
  initializeApp();
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});

watch(route, () => {
  chatViewData.value.isRefreshed = false;
  childCallbacks.value.onRouteChange?.();
});

watch(
  () => authStore.isAuthenticated,
  (isAuth) => {
    if (isAuth) initializeApp();
    else router.push("/login");
  },
);

async function initializeApp() {
  if (!authStore.isAuthenticated) return;
  await chatsStore.initFromCache();
  wsStore.connect();
  wsStore.addMessageHandler(chatStore.handleWebSocketMessage);
  await chatsStore.fetchChats();
  browserNotifications.requestPermission();
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
  if (!name) return "#3390ec";
  const colors = [
    "#3390ec",
    "#6fc06f",
    "#e17076",
    "#faa774",
    "#a695e7",
    "#7bc862",
    "#5bc0de",
    "#f06292",
    "#ba68c8",
    "#4db6ac",
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
  --tg-blue: #3390ec;
  --tg-sidebar-bg: #ffffff;
  --tg-sidebar-search: #f4f4f5;
  --tg-text: #000000;
  --tg-secondary: #707579;
  --tg-hover: #f4f4f5;
  --tg-active: #3390ec1a;
  --tg-border: #e7e7e7;

  display: flex;
  height: 100vh;
  background: #e6ebee;
  overflow: hidden;
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
}

.sidebar {
  width: 420px;
  max-width: 33vw;
  min-width: 280px;
  background: var(--tg-sidebar-bg);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--tg-border);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 6px;
  min-height: 56px;
  flex-shrink: 0;
}

.menu-btn,
.icon-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 50%;
  color: var(--tg-secondary);
  cursor: pointer;
  transition: background 0.15s;
}

.menu-btn:hover,
.icon-btn:hover {
  background: var(--tg-hover);
  color: var(--tg-text);
}

.menu-btn--open {
  background: var(--tg-active);
  color: var(--tg-blue);
}

.sidebar-menu {
  padding: 4px 8px 8px;
  border-bottom: 1px solid var(--tg-border);
  animation: slideDown 0.2s ease;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-size: 15px;
  color: var(--tg-text);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}

.menu-item:hover {
  background: var(--tg-hover);
}

.menu-item i {
  width: 20px;
  color: var(--tg-secondary);
  font-size: 16px;
}

.menu-item--danger {
  color: #dc2626;
}

.menu-item--danger i {
  color: #dc2626;
}

.menu-item--danger:hover {
  background: #fee2e2;
}

.icon-btn--danger:hover {
  background: #fee2e2;
  color: #dc2626;
}

.header-search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--tg-sidebar-search);
  border-radius: 20px;
  padding: 0 12px;
  height: 36px;
  margin: 0 4px;
}

.connection-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 12px 8px;
  padding: 0 14px;
  height: 42px;
  background: #fff3e0;
  color: #e65100;
  border-radius: 22px;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}

.connection-banner .pi-spinner {
  font-size: 14px;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px 10px;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-menu-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-menu-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--tg-text);
}

.user-menu-status {
  font-size: 13px;
  color: var(--tg-blue);
}

.search-icon {
  color: var(--tg-secondary);
  font-size: 14px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  color: var(--tg-text);
  outline: none;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--tg-secondary);
}

.search-clear {
  border: none;
  background: transparent;
  color: var(--tg-secondary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  border-radius: 50%;
}

.search-clear:hover {
  background: rgba(0, 0, 0, 0.06);
}

.search-results {
  border-bottom: 1px solid var(--tg-border);
  max-height: 240px;
  overflow-y: auto;
  flex-shrink: 0;
}

.search-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-blue);
  padding: 8px 20px 4px;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.search-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--tg-secondary);
  font-size: 14px;
}

.chats-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.chats-list::-webkit-scrollbar {
  width: 6px;
}

.chats-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}

.list-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  color: var(--tg-secondary);
  font-size: 15px;
}

.list-state .pi-inbox {
  font-size: 2.5rem;
  opacity: 0.4;
}

.chat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
  position: relative;
}

.chat-row:hover {
  background: var(--tg-hover);
}

.chat-row.active {
  background: var(--tg-active);
}

.chat-row.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--tg-blue);
  border-radius: 0 2px 2px 0;
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.chat-avatar-lg {
  width: 54px !important;
  height: 54px !important;
  font-size: 1.25rem !important;
}

.status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--tg-sidebar-bg);
}

.status-dot.online {
  background: #4dcd5e;
}

.status-dot.offline {
  background: #bdbdbd;
}

.chat-row-body {
  flex: 1;
  min-width: 0;
}

.chat-row-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 2px;
}

.chat-row-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--tg-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-row.unread .chat-row-name {
  font-weight: 600;
}

.chat-row-time {
  font-size: 13px;
  color: var(--tg-secondary);
  flex-shrink: 0;
}

.chat-row.unread .chat-row-time {
  color: var(--tg-blue);
}

.chat-row-bottom {
  font-size: 15px;
  color: var(--tg-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.35;
}

.chat-row.unread .chat-row-bottom {
  color: var(--tg-text);
}

.typing {
  color: var(--tg-blue);
  font-style: italic;
}

.you {
  color: var(--tg-secondary);
}

.chat-row-preview.muted {
  font-style: italic;
  opacity: 0.8;
}

.unread-pill {
  flex-shrink: 0;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tg-blue);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 11px;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #e6ebee;
  position: relative;
}

.mobile-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid var(--tg-border);
  cursor: pointer;
  color: var(--tg-blue);
  font-weight: 500;
  flex-shrink: 0;
}

.chat-list-enter-active,
.chat-list-leave-active {
  transition: all 0.2s ease;
}

.chat-list-enter-from,
.chat-list-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

@media (max-width: 767px) {
  .sidebar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    max-width: 100%;
  }

  .sidebar-hidden {
    transform: translateX(-100%);
  }
}
</style>
