<template>
  <div class="chat-container" :class="themeClass">
    <ScrollPanel
      style="width: 100%; height: 100%"
      ref="scrollPanelRef"
      @scroll="handleScroll"
    >
      <div ref="messagesContainer" class="p-3">
        <TransitionGroup name="message" tag="div">
          <div
            v-for="(msg, index) in messages"
            :key="msg.id || index"
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
              v-if="msg.id === firstUnreadId && msg.id !== firstNewMessageId"
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

            <!-- Chat Message -->
            <template v-else>
              <div class="message-bubble" :class="getBubbleClass(msg)">
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
                  <div
                    class="message-header"
                    v-if="showUsername || !isMine(msg)"
                  >
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
                    <i class="pi pi-check text-xs"></i>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </TransitionGroup>

        <!-- Empty State -->
        <div v-if="messages.length === 0" class="empty-state">
          <i class="pi pi-comments"></i>
          <p>No messages yet</p>
          <span>Start the conversation!</span>
        </div>

        <!-- Bottom sentinel for Intersection Observer to detect scroll to bottom -->
        <div ref="bottomSentinel" class="bottom-sentinel"></div>
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
  firstUnreadId: {
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
});

const emit = defineEmits(["messageRead", "markAllRead"]);

const authStore = useAuthStore();
const messagesContainer = ref(null);
const scrollPanelRef = ref(null);
const bottomSentinel = ref(null);
const showScrollButton = ref(true);
const isAtBottom = ref(false);
const newMessagesCount = ref(0);
const lastMessageCount = ref(0);
const savedScrollMessageId = ref(null);
const localUnreadCount = ref(0);

// Track read messages with Intersection Observer
const readMessageIds = ref(new Set());
const messageObserver = ref(null);
const bottomObserver = ref(null);

const themeClass = computed(() => `theme-${props.theme}`);

// Display unread count - use local count that decreases as messages are read
const displayUnreadCount = computed(() => {
  // Show new messages count if higher, otherwise show remaining unread
  return Math.max(newMessagesCount.value, localUnreadCount.value);
});
function isMine(msg) {
  return msg.sender_id === authStore.user?.id;
}

function getMessageClass(msg) {
  return [
    "message-wrapper",
    msg.type === "system" ? "system" : isMine(msg) ? "mine" : "theirs",
  ];
}

function getBubbleClass(msg) {
  return [
    `bubble-${props.bubbleStyle}`,
    `color-${props.myMessageColor}`,
    isMine(msg) ? "mine" : "theirs",
  ];
}

function getAvatarColor(username) {
  if (!username) return "#6366f1";
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
  const index = username.charCodeAt(0) % colors.length;
  return colors[index];
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function scrollToBottom(smooth = true) {
  nextTick(() => {
    if (scrollPanelRef.value) {
      const scrollContent =
        scrollPanelRef.value.$el?.querySelector(".p-scrollpanel-content") ||
        scrollPanelRef.value.$el?.querySelector(
          ".p-scrollpanel-content-container",
        );
      if (scrollContent) {
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
          db.clearScrollPosition(props.chatId, authStore.user?.id).catch(
            (err) => console.error("Failed to clear scroll position:", err),
          );
        }
      }
    }
  });
}

function scrollToFirstUnread() {
  nextTick(() => {
    if (scrollPanelRef.value && props.firstUnreadId) {
      const scrollContent =
        scrollPanelRef.value.$el?.querySelector(".p-scrollpanel-content") ||
        scrollPanelRef.value.$el?.querySelector(
          ".p-scrollpanel-content-container",
        );
      const unreadElement = scrollContent?.querySelector(
        `[data-message-id="${props.firstUnreadId}"]`,
      );
      if (unreadElement) {
        unreadElement.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    // Fallback to bottom if no unread found
    scrollToBottom();
  });
}

function handleScroll(event) {
  nextTick(() => {
    if (scrollPanelRef.value) {
      const scrollContent =
        scrollPanelRef.value.$el?.querySelector(".p-scrollpanel-content") ||
        scrollPanelRef.value.$el?.querySelector(
          ".p-scrollpanel-content-container",
        );
      if (scrollContent) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContent;
        const hasScrollableContent = scrollHeight > clientHeight;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        // Consider "at bottom" if within 100px or no scrollable content
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
      }
    }
  });
}

/**
 * Get the message ID that's currently visible at the top of the viewport
 * This will be used to restore scroll position when re-entering the chat
 */
function getVisibleTopMessageId() {
  if (!scrollPanelRef.value) return null;

  const scrollContent =
    scrollPanelRef.value.$el?.querySelector(".p-scrollpanel-content") ||
    scrollPanelRef.value.$el?.querySelector(".p-scrollpanel-content-container");

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
 * Scroll to a specific message by its ID
 */
function scrollToMessage(messageId, behavior = "instant") {
  nextTick(() => {
    if (!scrollPanelRef.value || !messageId) return;

    const scrollContent =
      scrollPanelRef.value.$el?.querySelector(".p-scrollpanel-content") ||
      scrollPanelRef.value.$el?.querySelector(
        ".p-scrollpanel-content-container",
      );

    if (!scrollContent) return;

    const messageElement = scrollContent.querySelector(
      `[data-message-id="${messageId}"]`,
    );

    if (messageElement) {
      messageElement.scrollIntoView({ behavior, block: "start" });
      showScrollButton.value = true;
      isAtBottom.value = false;
    }
  });
}

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
    const localStorageKey = `scroll_position_dm_${props.chatId}_${authStore.user?.id}`;
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

  const scrollContent =
    scrollPanelRef.value?.$el?.querySelector(".p-scrollpanel-content") ||
    scrollPanelRef.value?.$el?.querySelector(
      ".p-scrollpanel-content-container",
    );

  if (!scrollContent) return;

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

  const scrollContent =
    scrollPanelRef.value?.$el?.querySelector(".p-scrollpanel-content") ||
    scrollPanelRef.value?.$el?.querySelector(
      ".p-scrollpanel-content-container",
    );

  if (!scrollContent || !bottomSentinel.value) return;

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
      threshold: 0.1, // Trigger when even 10% of sentinel is visible
      rootMargin: "0px",
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

// Initial state - check if content is scrollable
onMounted(async () => {
  lastMessageCount.value = props.messages.length;

  // Check after content renders
  nextTick(async () => {
    setTimeout(async () => {
      // Priority 0: Check for saved scroll position from IndexedDB
      const savedMessageId = await loadSavedScrollPosition();
      if (savedMessageId) {
        console.log(
          savedMessageId,
          "restoring scroll position to saved message ID",
        );

        savedScrollMessageId.value = savedMessageId;
        scrollToMessage(savedMessageId, "instant");
      } else if (props.firstNewMessageId) {
        // Priority 1: If there's a "new messages" divider, scroll to it
        const scrollContent =
          scrollPanelRef.value?.$el?.querySelector(".p-scrollpanel-content") ||
          scrollPanelRef.value?.$el?.querySelector(
            ".p-scrollpanel-content-container",
          );
        const dividerElement = scrollContent?.querySelector(
          "[data-new-messages-divider]",
        );

        if (dividerElement) {
          dividerElement.scrollIntoView({
            behavior: "instant",
            block: "start",
          });
          showScrollButton.value = true;
          isAtBottom.value = false;
        }
      }

      // Always setup Intersection Observer for tracking read messages
      setupMessageObserver();

      // Setup bottom observer for reliable "at bottom" detection
      setupBottomObserver();
    }, 150);
  });
});

// Save scroll position before unmounting (leaving chat)
onBeforeUnmount(() => {
  saveCurrentScrollPosition();
  cleanupMessageObserver();
  cleanupBottomObserver();
  // Remove beforeunload listener
  window.removeEventListener("beforeunload", handleBeforeUnload);
});

// Handle browser refresh/close - save scroll position synchronously
function handleBeforeUnload() {
  if (!props.chatId || isAtBottom.value) return;

  const visibleMessageId = getVisibleTopMessageId();
  if (!visibleMessageId) return;

  // Use synchronous localStorage as fallback for beforeunload
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

    // Reset read message tracking and cleanup old observers
    readMessageIds.value = new Set();
    cleanupMessageObserver();
    cleanupBottomObserver();

    // Load scroll position for the new chat after messages are rendered
    if (newId) {
      nextTick(async () => {
        setTimeout(async () => {
          // Priority 0: Check for saved scroll position from IndexedDB
          const savedMessageId = await loadSavedScrollPosition();
          if (savedMessageId) {
            savedScrollMessageId.value = savedMessageId;
            scrollToMessage(savedMessageId, "instant");
          } else if (props.firstNewMessageId) {
            // Priority 1: If there's a "new messages" divider, scroll to it
            const scrollContent =
              scrollPanelRef.value?.$el?.querySelector(
                ".p-scrollpanel-content",
              ) ||
              scrollPanelRef.value?.$el?.querySelector(
                ".p-scrollpanel-content-container",
              );
            const dividerElement = scrollContent?.querySelector(
              "[data-new-messages-divider]",
            );
            if (dividerElement) {
              dividerElement.scrollIntoView({
                behavior: "instant",
                block: "start",
              });
              showScrollButton.value = true;
              isAtBottom.value = false;
            }
          } else if (props.unreadCount > 0 && props.firstUnreadId) {
            // Priority 2: If there are unread messages, scroll to first unread
            scrollToFirstUnread();
            showScrollButton.value = true;
            isAtBottom.value = false;
          } else {
            // No unread messages - instant scroll to bottom (no animation)
            scrollToBottom(false);
          }

          // Always setup Intersection Observer for new chat
          setupMessageObserver();

          // Setup bottom observer for reliable "at bottom" detection
          setupBottomObserver();
        }, 150);
      });
    }
  },
  { immediate: false },
);

// Check if content is scrollable and update button visibility
function checkScrollState() {
  if (scrollPanelRef.value) {
    const scrollContent =
      scrollPanelRef.value.$el?.querySelector(".p-scrollpanel-content") ||
      scrollPanelRef.value.$el?.querySelector(
        ".p-scrollpanel-content-container",
      );
    if (scrollContent) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContent;
      const hasScrollableContent = scrollHeight > clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // Only show button if there's scrollable content AND not at bottom
      isAtBottom.value = !hasScrollableContent || distanceFromBottom < 100;
      showScrollButton.value = hasScrollableContent && !isAtBottom.value;
    }
  }
}

// When new messages arrive
watch(
  () => props.messages.length,
  (newLength, oldLength) => {
    if (newLength > oldLength) {
      // New message arrived
      if (isAtBottom.value) {
        // If user was at bottom, scroll to new message
        scrollToBottom();
      } else {
        // User is scrolled up, increment counter and show button
        newMessagesCount.value += newLength - oldLength;
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

/* Make ScrollPanel fill the container */
.chat-container :deep(.p-scrollpanel) {
  height: 100% !important;
}

.chat-container :deep(.p-scrollpanel-content-container) {
  height: 100%;
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

/* Message Wrapper */
.message-wrapper {
  @apply mb-3;
}

.message-wrapper.mine {
  @apply flex justify-end;
}

.message-wrapper.theirs {
  @apply flex justify-start;
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

/* Bottom sentinel - invisible element at bottom of messages */
.bottom-sentinel {
  height: 1px;
  width: 100%;
  pointer-events: none;
}
</style>
