<template>
  <div class="chat-container" :class="themeClass">
    <ScrollPanel
      style="width: 100%; height: 100%"
      ref="scrollPanelRef"
      @scroll="handleScroll"
    >
      <div ref="messagesContainer" class="p-3">
        <!-- Top Sentinel - triggers loading older messages -->
        <div ref="topSentinel" class="scroll-sentinel min-h-5 mb-5 bg-red-500">
          {{ isLoadingMore }} Bug: Top and bottom need configured add loading
          ...
          <div v-if="isLoadingMore" class="loading-more">
            <i class="pi pi-spin pi-spinner"></i>
            <span>Loading older messages...</span>
          </div>
          <div
            v-else-if="!hasMoreMessages && messages.length > 0"
            class="no-more-messages"
          >
            <span>Beginning of conversation</span>
          </div>
        </div>

        <div
          v-for="(msg, index) in messages"
          :key="msg._pendingKey || msg.id || index"
          :data-message-id="msg.id"
          :class="getMessageClass(msg)"
        >
          <!-- New messages divider (between cached and fresh messages) -->
          <div
            v-if="msg.id === firstNewMessageId"
            class="new-messages-divider"
            data-new-messages-divider
          >
            <span>New messages</span>
          </div>

          <!-- Unread divider -->
          <div
            v-if="
              msg.id === firstUnreadMessageId && msg.id !== firstNewMessageId
            "
            class="unread-divider"
          >
            <span>Unread messages</span>
          </div>

          <!-- System Message -->
          <template v-if="msg.type === 'system'">
            <div class="system-message">
              <i class="pi pi-info-circle mr-1"></i>
              {{ msg.content }}
            </div>
          </template>
          <!-- System Message -->
          <template v-if="msg.type === 'system'">
            <div class="system-message">
              <i class="pi pi-info-circle mr-1"></i>
              {{ msg.content }}
            </div>
          </template>

          <!-- Chat Message -->
          <template v-else>
            <div
              class="message-bubble"
              :class="getBubbleClass(msg, props.myMessageColor)"
            >
              <!-- Avatar for others' messages -->
              <Avatar
                v-if="!isMine(msg) && showAvatars"
                :label="msg.sender_username?.charAt(0).toUpperCase()"
                :style="{
                  backgroundColor: getAvatarColor(msg.sender_username),
                }"
                class="message-avatar"
                shape="circle"
              />

              <div class="message-content">
                <!-- Username & Time -->
                <div class="message-header" v-if="showUsername || !isMine(msg)">
                  <span class="message-username">{{
                    msg.sender_username
                  }}</span>
                  <span class="message-time">{{
                    formatTime(msg.created_at)
                  }}</span>
                </div>

                <!-- Message Text -->
                <div class="message-text">{{ msg.content }}</div>

                <!-- Message Status (for own messages) -->
                <div v-if="isMine(msg)" class="message-status">
                  <div v-if="msg.is_read">
                    <i class="pi pi-check-circle text-xs"></i>
                  </div>
                  <div v-else>
                    <i class="pi pi-check text-xs"></i>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Empty State -->
        <div v-if="messages.length === 0" class="empty-state">
          <i class="pi pi-comments"></i>
          <p>No messages yet</p>
          <span>Start the conversation!</span>
        </div>

        <!-- Bottom sentinel for Intersection Observer to detect scroll to bottom -->
        <div ref="bottomSentinel" class="h-5 mt-1 w-full bg-blue-500"></div>
      </div>
    </ScrollPanel>

    <!-- Go to Bottom Button -->
    <transition name="fade">
      <Button
        v-if="showScrollButton"
        @click="scrollToBottom"
        icon="pi pi-chevron-down"
        rounded
        class="scroll-to-bottom-btn"
        :badge="displayUnreadCount > 0 ? String(displayUnreadCount) : null"
        badgeClass="p-badge-danger"
      />
    </transition>
  </div>
</template>

<script setup>
import {
  ref,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  computed,
} from "vue";
import { useAuthStore } from "../stores/auth";
import * as db from "../utils/indexedDB";
import ScrollPanel from "primevue/scrollpanel";
import Avatar from "primevue/avatar";
import Button from "primevue/button";
import { useRoute } from "vue-router";
import {
  formatTime,
  getAvatarColor,
  getBubbleClass,
  getScrollContent,
  isMine,
  scrollToMessage,
} from "../composables/helpers";

const props = defineProps({
  messages: {
    type: Array,
    required: true,
  },
  theme: {
    type: String,
    default: "modern", // 'modern', 'classic', 'minimal', 'bubble'
  },
  showAvatars: {
    type: Boolean,
    default: true,
  },
  showUsername: {
    type: Boolean,
    default: true,
  },
  bubbleStyle: {
    type: String,
    default: "rounded", // 'rounded', 'sharp', 'pill'
  },
  myMessageColor: {
    type: String,
    default: "primary", // 'primary', 'green', 'blue', 'purple'
  },
  unreadCount: {
    type: Number,
    default: 0,
  },
  firstUnreadMessageId: {
    type: [Number, String],
    default: null,
  },
  firstNewMessageId: {
    type: [Number, String],
    default: null,
  },
  // Prop for scroll position persistence
  chatId: {
    type: [Number, String],
    default: null, // DM User ID
  },
  // Pagination props
  hasMoreMessages: {
    type: Boolean,
    default: true,
  },
  isLoadingMore: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["messageRead", "markAllRead", "loadMore"]);

const authStore = useAuthStore();
const scrollPanelRef = ref(null);
const bottomSentinel = ref(null);
const topSentinel = ref(null);
const showScrollButton = ref(true);
const isAtBottom = ref(false);
const newMessagesCount = ref(0);
const lastMessageCount = ref(0);
const savedScrollMessageId = ref(null);
const localUnreadCount = ref(0);
const initialScrollDone = ref(false); // Track if initial scroll position has been set

// Track read messages with Intersection Observer
const readMessageIds = ref(new Set());
const messageObserver = ref(null);
const bottomObserver = ref(null);
const topObserver = ref(null); // Observer for loading older messages

const themeClass = computed(() => `theme-${props.theme}`);

// Helper function to get the scrollable content element (PrimeVue compatibility)

// Display unread count - use local count that decreases as messages are read
const displayUnreadCount = computed(() => {
  // Show new messages count if higher, otherwise show remaining unread
  return newMessagesCount.value;
});

function getMessageClass(msg) {
  return [
    "message-wrapper",
    msg.type === "system" ? "system" : isMine(msg) ? "mine" : "theirs",
  ];
}

function scrollToBottom(smooth = true) {
  console.log("scrollToBottomscrollToBottomscrollToBottomscrollToBottom");

  if (!scrollPanelRef.value) {
    console.warn("scrollToBottom: scrollPanelRef is not available");
    return;
  }
  const scrollContent = getScrollContent(scrollPanelRef);
  console.log(scrollContent, scrollPanelRef, "scrollContent--scrollPanelRef");

  if (scrollContent) {
    console.log("scrollToBottom: scrolling to", scrollContent.scrollHeight);
    scrollContent.scrollTo({
      top: scrollContent.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
    // Reset state when scrolling to bottom
    isAtBottom.value = true;
    showScrollButton.value = false;
    newMessagesCount.value = 0;
    localUnreadCount.value = 0;

    // Emit mark all as read when scrolling to bottom
    if (props.unreadCount > 0) {
      emit("markAllRead");
    }

    // Clear saved scroll position since user is at bottom
    if (props.chatId) {
      db.clearScrollPosition(props.chatId, authStore.user?.id).catch((err) =>
        console.error("Failed to clear scroll position:", err),
      );
    }
  } else {
    // console.warn("scrollToBottom: could not find scroll content element");
  }
}

function handleScroll(event) {
  const scrollContent = getScrollContent(scrollPanelRef);
  if (scrollContent) {
    const { scrollTop, scrollHeight, clientHeight } = scrollContent;
    const hasScrollableContent = scrollHeight > clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Consider "at bottom" if within 100px or no scrollable content
    console.log(distanceFromBottom, "distanceFromBottom");

    isAtBottom.value = !hasScrollableContent || distanceFromBottom < 100;
    showScrollButton.value = hasScrollableContent && !isAtBottom.value;

    // Clear new messages count when user scrolls to bottom
    if (isAtBottom.value) {
      console.log(
        isAtBottom.value,
        "User is at bottom, clearing new messages count",
      );
      newMessagesCount.value = 0;
    }

    // Load more messages when scrolling near the top (infinite scroll)
    if (scrollTop < 100 && props.hasMoreMessages && !props.isLoadingMore) {
      setTimeout(() => {
        emit("loadMore");
      }, 1000);
    }
  }
}

/**
 * Get the message ID that's currently visible at the top of the viewport
 * This will be used to restore scroll position when re-entering the chat
 */
function getVisibleTopMessageId() {
  const scrollContent = getScrollContent(scrollPanelRef);
  if (!scrollContent) return null;

  const scrollTop = scrollContent.scrollTop;
  const messageElements = scrollContent.querySelectorAll("[data-message-id]");

  for (const element of messageElements) {
    const rect = element.getBoundingClientRect();
    const containerRect = scrollContent.getBoundingClientRect();

    // Find the first message that's visible in the viewport
    if (rect.top >= containerRect.top - 50) {
      return element.getAttribute("data-message-id");
    }
  }

  // Fallback: return the first message ID
  if (messageElements.length > 0) {
    return messageElements[0].getAttribute("data-message-id");
  }

  return null;
}

/**
 * Scroll to a specific message by its ID (like anchor navigation)
 */

/**
 * Save current scroll position to IndexedDB
 */
async function saveCurrentScrollPosition() {
  if (!props.chatId) return;
  const visibleMessageId = getVisibleTopMessageId();
  if (!visibleMessageId) return;
  try {
    await db.saveScrollPosition(
      props.chatId,
      visibleMessageId,
      authStore.user?.id,
    );
  } catch (err) {
    console.error("Failed to save scroll position:", err);
  }
}

/**
 * Load saved scroll position from IndexedDB or localStorage (fallback for browser refresh)
 */
async function loadSavedScrollPosition() {
  if (!props.chatId) return null;

  try {
    // First check localStorage (used during browser refresh)
    // Key format must match handleBeforeUnload: sort IDs for consistency
    const ids = [props.chatId, authStore.user?.id].sort((a, b) => a - b);
    const localStorageKey = `scroll_position_dm_${ids[0]}_${ids[1]}`;
    const localData = localStorage.getItem(localStorageKey);

    if (localData) {
      const parsed = JSON.parse(localData);
      // Remove from localStorage after reading (one-time use)
      localStorage.removeItem(localStorageKey);

      // Also save to IndexedDB for consistency
      if (parsed.messageId) {
        await db.saveScrollPosition(
          props.chatId,
          parsed.messageId,
          authStore.user?.id,
        );
        return parsed.messageId;
      }
    }

    // Fallback to IndexedDB
    const scrollData = await db.getScrollPosition(
      props.chatId,
      authStore.user?.id,
    );
    return scrollData?.messageId || null;
  } catch (err) {
    console.error("Failed to load scroll position:", err);
    return null;
  }
}

/**
 * Setup Intersection Observer to track which messages become visible
 * This is used to track read messages as user scrolls
 */
function setupMessageObserver() {
  if (messageObserver.value) {
    messageObserver.value.disconnect();
  }

  const scrollContent = getScrollContent(scrollPanelRef);
  if (!scrollContent) {
    console.warn("setupMessageObserver: could not find scroll content");
    return;
  }

  messageObserver.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const messageId = entry.target.getAttribute("data-message-id");
          if (messageId && !readMessageIds.value.has(messageId)) {
            // Find the message to check if it's not our own message
            const msg = props.messages.find(
              (m) => String(m.id) === String(messageId),
            );
            if (msg && !isMine(msg)) {
              readMessageIds.value.add(messageId);
              emit("messageRead", messageId);

              // Decrease local unread count
              if (localUnreadCount.value > 0) {
                localUnreadCount.value--;
              }
            }
          }
        }
      });
    },
    {
      root: scrollContent,
      threshold: 0.5, // Message is considered "read" when 50% visible
      rootMargin: "0px",
    },
  );

  // Observe all unread messages (messages from others)
  const messageElements = scrollContent.querySelectorAll("[data-message-id]");
  messageElements.forEach((el) => {
    const messageId = el.getAttribute("data-message-id");
    const msg = props.messages.find((m) => String(m.id) === String(messageId));
    // Only observe messages from others that haven't been read yet
    if (msg && !isMine(msg) && !readMessageIds.value.has(messageId)) {
      messageObserver.value.observe(el);
    }
  });
}

/**
 * Cleanup the Intersection Observer
 */
function cleanupMessageObserver() {
  if (messageObserver.value) {
    messageObserver.value.disconnect();
    messageObserver.value = null;
  }
}

/**
 * Setup Intersection Observer for the bottom sentinel
 * This reliably detects when user scrolls to bottom
 */
function setupBottomObserver() {
  if (bottomObserver.value) {
    bottomObserver.value.disconnect();
  }

  const scrollContent = getScrollContent(scrollPanelRef);
  if (!scrollContent || !bottomSentinel.value) {
    console.warn(
      "setupBottomObserver: could not find scroll content or bottom sentinel",
    );
    return;
  }

  bottomObserver.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const wasAtBottom = isAtBottom.value;
        isAtBottom.value = entry.isIntersecting;

        // When user scrolls to bottom
        if (entry.isIntersecting) {
          showScrollButton.value = false;
          newMessagesCount.value = 0;
          localUnreadCount.value = 0;

          // If user just arrived at bottom (wasn't there before), mark all as read
          if (!wasAtBottom && props.unreadCount > 0) {
            emit("markAllRead");
          }
        } else {
          // Check if there's scrollable content
          const { scrollHeight, clientHeight } = scrollContent;
          const hasScrollableContent = scrollHeight > clientHeight;
          showScrollButton.value = hasScrollableContent;
        }
      });
    },
    {
      root: scrollContent,
      threshold: 0.3, // Trigger when even 10% of sentinel is visible
      rootMargin: "500px",
    },
  );

  bottomObserver.value.observe(bottomSentinel.value);
}

/**
 * Cleanup the bottom observer
 */
function cleanupBottomObserver() {
  if (bottomObserver.value) {
    bottomObserver.value.disconnect();
    bottomObserver.value = null;
  }
}

/**
 * Setup Intersection Observer for the top sentinel
 * This triggers loading older messages when user scrolls to top
 */
function setupTopObserver() {
  if (topObserver.value) {
    topObserver.value.disconnect();
  }

  const scrollContent = getScrollContent(scrollPanelRef);
  if (!scrollContent || !topSentinel.value) {
    console.warn(
      "setupTopObserver: could not find scroll content or top sentinel",
    );
    return;
  }

  topObserver.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // When top sentinel becomes visible and we have more messages to load
        if (
          entry.isIntersecting &&
          props.hasMoreMessages &&
          !props.isLoadingMore
        ) {
          console.log("Top sentinel visible - loading older messages...");
          setTimeout(() => {
            emit("loadMore");
          }, 1000);
        }
      });
    },
    {
      root: scrollContent,
      threshold: 0.3, // Trigger when 30% of sentinel is visible
      rootMargin: "300px 0px 0px 0px", // Trigger 300px before reaching top
    },
  );

  topObserver.value.observe(topSentinel.value);
}

/**
 * Cleanup the top observer
 */
function cleanupTopObserver() {
  if (topObserver.value) {
    topObserver.value.disconnect();
    topObserver.value = null;
  }
}
// Initial state - check if content is scrollable
onMounted(async () => {
  console.log("onmounted works!!!!");

  lastMessageCount.value = props.messages.length;

  // If messages already exist on mount, handle initial scroll
  if (props.messages.length > 0) {
    initialScrollDone.value = true;

    // Check after content renders
    // Always setup Intersection Observer for tracking read messages
    setupMessageObserver();

    // Setup bottom observer for reliable "at bottom" detection
    setupBottomObserver();

    // Setup top observer for loading older messages
    setupTopObserver();
    // Priority 0: Check for saved scroll position from IndexedDB
    const savedMessageId = loadSavedScrollPosition();
    console.log(savedMessageId, "savedMessageId");

    if (savedMessageId) {
      savedScrollMessageId.value = savedMessageId;
      scrollToMessage(savedMessageId, false, scrollPanelRef);
      console.log('scrollToMessage(savedMessageId, "false");');
    } else if (props.firstUnreadMessageId) {
      scrollToMessage(props.firstUnreadMessageId, false, scrollPanelRef);
      console.log('scrollToMessage(props.firstUnreadMessageId, "false");');
    } else {
      // No saved position and no new messages divider - scroll to bottom
      console.log("scrollToBottom(false); B");
      scrollToBottom(false);
    }
  }

  // If no messages yet, the watcher will handle scroll when messages load
});

// Save scroll position before unmounting (leaving chat)
onBeforeUnmount(() => {
  console.log("Component unmounting, saving scroll position");

  saveCurrentScrollPosition();
  cleanupMessageObserver();
  cleanupBottomObserver();
  cleanupTopObserver();
  // Remove beforeunload listener
  window.removeEventListener("beforeunload", handleBeforeUnload);
});

// Handle browser refresh/close - save scroll position synchronously
function handleBeforeUnload() {
  if (!props.chatId) return;

  const visibleMessageId = getVisibleTopMessageId();
  if (!visibleMessageId) return;

  // IndexedDB is async and may not complete before page unloads
  try {
    const ids = [props.chatId, authStore.user?.id].sort((a, b) => a - b);
    const key = `scroll_position_dm_${ids[0]}_${ids[1]}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        messageId: visibleMessageId,
        timestamp: Date.now(),
      }),
    );
  } catch (err) {
    console.error("Failed to save scroll position on beforeunload:", err);
  }
}

// Add beforeunload listener when mounted
window.addEventListener("beforeunload", handleBeforeUnload);

// Track previous chatId to save scroll position when switching chats
const previousChatId = ref(null);

// Watch for chat changes (when switching between DMs without unmounting)
watch(
  () => props.chatId,
  async (newId, oldId) => {
    // Save scroll position for the previous chat before switching
    if (oldId && oldId !== newId) {
      // Save for the OLD chat
      const visibleMessageId = getVisibleTopMessageId();
      if (visibleMessageId && !isAtBottom.value) {
        try {
          await db.saveScrollPosition(
            oldId,
            visibleMessageId,
            authStore.user?.id,
          );
        } catch (err) {
          console.error(
            "Failed to save scroll position for previous chat:",
            err,
          );
        }
      } else if (isAtBottom.value) {
        // Clear scroll position if user was at bottom
        try {
          await db.clearScrollPosition(oldId, authStore.user?.id);
        } catch (err) {
          console.error("Failed to clear scroll position:", err);
        }
      }
    }

    // Update previous value
    previousChatId.value = newId;

    // Reset state for new chat
    isAtBottom.value = false;
    showScrollButton.value = true;
    newMessagesCount.value = 0;
    initialScrollDone.value = false; // Reset for new chat

    // Reset read message tracking and cleanup old observers
    readMessageIds.value = new Set();
    cleanupMessageObserver();
    cleanupBottomObserver();

    // The messages watcher will handle scrolling when messages load for the new chat
  },
  { immediate: false },
);

// Check if content is scrollable and update button visibility
function checkScrollState() {
  const scrollContent = getScrollContent(scrollPanelRef);
  if (scrollContent) {
    const { scrollTop, scrollHeight, clientHeight } = scrollContent;
    const hasScrollableContent = scrollHeight > clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Only show button if there's scrollable content AND not at bottom
    isAtBottom.value = !hasScrollableContent || distanceFromBottom < 100;
    showScrollButton.value = hasScrollableContent && !isAtBottom.value;
  }
}
const route = useRoute();
// When new messages arrive
watch(
  () => [props.messages.length, route.params.userId],
  async (newLength, oldLength) => {
    if (newLength[0] === oldLength[0]) return;
    // Handle initial messages load (when messages go from 0 to some value)
    if (oldLength[0] === 0 && newLength[0] > 0) {
      // Wait for DOM to update
      setupMessageObserver();
      setupBottomObserver();
      setupTopObserver();
      // Priority 0: Check for saved scroll position
      const savedMessageId = await loadSavedScrollPosition();
      if (props.firstUnreadMessageId) {
        scrollToMessage(props.firstUnreadMessageId, false, scrollPanelRef);
        console.log("scrollToMessage QQQ ", props.firstUnreadMessageId);
        return;
      } else if (savedMessageId && props.firstUnreadMessageId) {
        savedScrollMessageId.value = savedMessageId;
        scrollToMessage(savedMessageId, false, scrollPanelRef);
        console.log("scrollToMessage(props.firstUnreadMessageId,  uuuu ");
      } else {
        console.log("scrollToBottom(false); A");

        scrollToBottom(false);
      }
    }
    // Handle subsequent new messages (not initial load)
    if (newLength[0] > oldLength[0]) {
      // Check if the new message is our own (sent by us)
      // In that case, we already scrolled when sending, so just ensure we stay at bottom
      const lastMessage = props.messages[props.messages.length - 1];
      const isOwnMessage = lastMessage && isMine(lastMessage);
      console.log(isOwnMessage, "isOwnMessage");

      if (isAtBottom.value || isOwnMessage) {
        console.log("scrollToBottom(false); C");
        scrollToBottom(isOwnMessage ? false : true);
      } else {
        // User is scrolled up, increment counter and show button
        showScrollButton.value = true;
      }
    }

    lastMessageCount.value = newLength;

    // Recheck scroll state after content changes
    setTimeout(() => {
      checkScrollState();
    }, 100);
  },
);

// Sync local unread count with props
watch(
  () => props.unreadCount,
  (newCount) => {
    // Only update if the new count is higher (new unread messages arrived)
    // or if it's a reset (0)
    if (newCount > localUnreadCount.value || newCount === 0) {
      localUnreadCount.value = newCount;
    }
  },
  { immediate: true },
);

// Expose scrollToBottom so parent components can call it
defineExpose({
  scrollToBottom,
});
</script>

<style scoped>
@reference "tailwindcss";

/* Message Transitions */
.message-enter-active {
  animation: messageIn 0.3s ease-out;
}

.message-leave-active {
  animation: messageOut 0.2s ease-in;
}

@keyframes messageIn {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes messageOut {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.95);
  }
}

/* Chat Container */
.chat-container {
  @apply rounded-lg overflow-hidden;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  position: relative;
  height: 100%;
}

/* Make ScrollPanel fill the container and show scrollbar */
.chat-container :deep(.p-scrollpanel) {
  height: 100% !important;
  width: 100% !important;
}

.chat-container :deep(.p-scrollpanel-content-container) {
  height: 100%;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}

.chat-container :deep(.p-scrollpanel-content) {
  height: auto !important;
  min-height: 100%;
  padding-right: 12px; /* Space for scrollbar */
}

/* Ensure scrollbar is always visible */
.chat-container :deep(.p-scrollpanel-bar-y) {
  opacity: 1 !important;
  background: #cbd5e1 !important;
}

.chat-container :deep(.p-scrollpanel-bar-y:hover) {
  background: #94a3b8 !important;
}

/* Scroll to Bottom Button */
.scroll-to-bottom-btn {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Fade transition for button */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Unread Divider */
.unread-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}

.unread-divider::before,
.unread-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #6366f1;
}

.unread-divider span {
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
  padding: 4px 12px;
  background: #e0e7ff;
  border-radius: 12px;
}

/* New Messages Divider */
.new-messages-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}

.new-messages-divider::before,
.new-messages-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #22c55e;
}

.new-messages-divider span {
  font-size: 12px;
  color: #22c55e;
  font-weight: 500;
  padding: 4px 12px;
  background: #dcfce7;
  border-radius: 12px;
}

/* Loading More Messages */
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  color: #64748b;
  font-size: 14px;
}

.loading-more i {
  font-size: 16px;
  color: #6366f1;
}

.no-more-messages {
  display: flex;
  justify-content: center;
  padding: 8px;
  margin-bottom: 12px;
}

.no-more-messages span {
  font-size: 12px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 4px 12px;
  border-radius: 12px;
}

/* Scroll Sentinels for Intersection Observer */
.scroll-sentinel {
  height: 1px;
  width: 100%;
  pointer-events: none;
}

/* Message Wrapper */
.message-wrapper {
  @apply mb-3;
}

.message-wrapper.mine {
  @apply flex justify-end;
}

.message-wrapper.system {
  @apply flex justify-center;
}

/* System Message */
.system-message {
  @apply text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full italic;
}

/* Message Bubble */
.message-bubble {
  @apply flex items-end gap-2 max-w-[75%];
  transition: all 0.2s ease;
}

.message-bubble:hover {
  transform: scale(1.01);
}

.message-bubble.mine {
  @apply flex-row-reverse;
}

.message-avatar {
  @apply w-8 h-8 text-white text-sm flex-shrink-0;
  transition: transform 0.2s ease;
}

.message-bubble:hover .message-avatar {
  transform: scale(1.1);
}

/* Message Content */
.message-content {
  @apply px-4 py-2.5 shadow-sm;
  transition: all 0.2s ease;
}

.message-bubble.mine .message-content {
  @apply text-white;
}

.message-bubble.theirs .message-content {
  @apply bg-white text-gray-800 border border-gray-100;
}

/* Bubble Styles */
.bubble-rounded .message-content {
  @apply rounded-2xl;
}

.bubble-rounded.mine .message-content {
  @apply rounded-br-sm;
}

.bubble-rounded.theirs .message-content {
  @apply rounded-bl-sm;
}

.bubble-sharp .message-content {
  @apply rounded-lg;
}

.bubble-pill .message-content {
  @apply rounded-full px-5;
}

/* Color Variants */
.color-primary.mine .message-content {
  @apply bg-gradient-to-br from-indigo-500 to-purple-600;
}

.color-green.mine .message-content {
  @apply bg-gradient-to-br from-green-500 to-emerald-600;
}

.color-blue.mine .message-content {
  @apply bg-gradient-to-br from-blue-500 to-cyan-600;
}

.color-purple.mine .message-content {
  @apply bg-gradient-to-br from-purple-500 to-pink-600;
}

/* Message Header */
.message-header {
  @apply flex items-center gap-2 mb-1;
}

.message-username {
  @apply text-xs font-semibold;
}

.message-bubble.theirs .message-username {
  @apply text-gray-600;
}

.message-bubble.mine .message-username {
  @apply text-white/80;
}

.message-time {
  @apply text-xs opacity-60;
}

/* Message Text */
.message-text {
  @apply text-sm leading-relaxed break-words;
}

/* Message Status */
.message-status {
  @apply flex justify-end mt-1 opacity-70;
}

/* Empty State */
.empty-state {
  @apply flex flex-col items-center justify-center py-12 text-gray-400;
}

.empty-state i {
  @apply text-5xl mb-3;
  animation: float 3s ease-in-out infinite;
}

.empty-state p {
  @apply text-lg font-medium text-gray-500;
}

.empty-state span {
  @apply text-sm;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* Theme Variations */
.theme-modern .chat-container {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.theme-classic .message-bubble .message-content {
  @apply shadow-md;
}

.theme-minimal .message-bubble .message-content {
  @apply shadow-none border-0;
}

.theme-minimal .message-bubble.theirs .message-content {
  @apply bg-gray-100;
}

.theme-bubble .message-content {
  @apply rounded-3xl;
}
</style>
