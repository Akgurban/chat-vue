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
        :badge="newMessagesCount > 0 ? String(newMessagesCount) : null"
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
  // New props for scroll position persistence
  chatType: {
    type: String,
    default: null, // 'room' or 'direct'
  },
  chatId: {
    type: [Number, String],
    default: null, // Room ID or DM User ID
  },
});

const authStore = useAuthStore();
const messagesContainer = ref(null);
const scrollPanelRef = ref(null);
const showScrollButton = ref(true);
const isAtBottom = ref(false);
const newMessagesCount = ref(0);
const lastMessageCount = ref(0);
const savedScrollMessageId = ref(null);

const themeClass = computed(() => `theme-${props.theme}`);

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

        // Clear saved scroll position since user is at bottom
        if (props.chatType && props.chatId) {
          db.clearScrollPosition(
            props.chatType,
            props.chatId,
            authStore.user?.id,
          ).catch((err) =>
            console.error("Failed to clear scroll position:", err),
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

function scrollToNewMessagesDivider() {
  nextTick(() => {
    if (scrollPanelRef.value && props.firstNewMessageId) {
      const scrollContent =
        scrollPanelRef.value.$el?.querySelector(".p-scrollpanel-content") ||
        scrollPanelRef.value.$el?.querySelector(
          ".p-scrollpanel-content-container",
        );
      const dividerElement = scrollContent?.querySelector(
        "[data-new-messages-divider]",
      );
      if (dividerElement) {
        dividerElement.scrollIntoView({ behavior: "instant", block: "start" });
        showScrollButton.value = true;
        isAtBottom.value = false;
        return true;
      }
    }
    return false;
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
  if (!props.chatType || !props.chatId) return;
  const visibleMessageId = getVisibleTopMessageId();
  if (!visibleMessageId) return;
  try {
    await db.saveScrollPosition(
      props.chatType,
      props.chatId,
      visibleMessageId,
      authStore.user?.id,
    );
  } catch (err) {
    console.error("Failed to save scroll position:", err);
  }
}

/**
 * Load saved scroll position from IndexedDB
 */
async function loadSavedScrollPosition() {
  if (!props.chatType || !props.chatId) return null;

  try {
    const scrollData = await db.getScrollPosition(
      props.chatType,
      props.chatId,
      authStore.user?.id,
    );
    return scrollData?.messageId || null;
  } catch (err) {
    console.error("Failed to load scroll position:", err);
    return null;
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
        savedScrollMessageId.value = savedMessageId;
        scrollToMessage(savedMessageId, "instant");
        return;
      }

      // Priority 1: If there's a "new messages" divider, scroll to it
      if (props.firstNewMessageId) {
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
          return;
        }
      }

      // Priority 2: If there are unread messages, scroll to first unread
      if (props.unreadCount > 0 && props.firstUnreadId) {
        scrollToFirstUnread();
        showScrollButton.value = true;
        isAtBottom.value = false;
      } else {
        // No unread messages - instant scroll to bottom (no animation)
        scrollToBottom(false);
      }
    }, 150);
  });
});

// Save scroll position before unmounting (leaving chat)
onBeforeUnmount(() => {
  saveCurrentScrollPosition();
});

// Track previous chatId/chatType to save scroll position when switching chats
const previousChatId = ref(null);
const previousChatType = ref(null);

// Watch for chat changes (when switching between DMs or rooms without unmounting)
watch(
  () => [props.chatType, props.chatId],
  async ([newType, newId], [oldType, oldId]) => {
    // Save scroll position for the previous chat before switching
    if (oldType && oldId && (oldType !== newType || oldId !== newId)) {
      // Save for the OLD chat
      const visibleMessageId = getVisibleTopMessageId();
      if (visibleMessageId && !isAtBottom.value) {
        try {
          await db.saveScrollPosition(
            oldType,
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
          await db.clearScrollPosition(oldType, oldId, authStore.user?.id);
        } catch (err) {
          console.error("Failed to clear scroll position:", err);
        }
      }
    }

    // Update previous values
    previousChatId.value = newId;
    previousChatType.value = newType;

    // Reset state for new chat
    isAtBottom.value = false;
    showScrollButton.value = true;
    newMessagesCount.value = 0;

    // Load scroll position for the new chat after messages are rendered
    if (newType && newId) {
      nextTick(async () => {
        setTimeout(async () => {
          // Priority 0: Check for saved scroll position from IndexedDB
          const savedMessageId = await loadSavedScrollPosition();
          if (savedMessageId) {
            savedScrollMessageId.value = savedMessageId;
            scrollToMessage(savedMessageId, "instant");
            return;
          }

          // Priority 1: If there's a "new messages" divider, scroll to it
          if (props.firstNewMessageId) {
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
              return;
            }
          }

          // Priority 2: If there are unread messages, scroll to first unread
          if (props.unreadCount > 0 && props.firstUnreadId) {
            scrollToFirstUnread();
            showScrollButton.value = true;
            isAtBottom.value = false;
          } else {
            // No unread messages - instant scroll to bottom (no animation)
            scrollToBottom(false);
          }
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
</style>
