<template>
  <div
    class="relative rounded-lg overflow-hidden bg-gray-100 h-full"
    :class="['overflow-y-auto']"
  >
    <div
      @scroll="handleScroll"
      ref="scrollPanelRef"
      style="overflow-y: overlay"
      class="h-full"
    >
      <div ref="messagesContainer" class="px-3 py-2">
        <!-- Top Sentinel - triggers loading older messages -->
        <div ref="topSentinel" class="w-full top-0 min-h-[1px]"></div>

        <!-- Loading indicator -->
        <div v-if="isLoadingMore" class="flex justify-center py-2">
          <span class="text-xs text-gray-400">Loading older messages...</span>
        </div>

        <div
          v-if="!hasMoreMessages && messages.length > 0"
          class="flex items-center justify-center p-2 mb-3"
        >
          <span>Beginning of conversation</span>
        </div>

        <div
          v-for="(group, groupIndex) in dateGroupedMessages"
          :key="groupIndex"
        >
          <!-- Date separator -->
          <div class="sticky top-0 z-10 flex justify-center py-2">
            <span
              class="text-xs text-gray-500 font-medium bg-gray-200 rounded-full px-3 py-1 shadow-sm"
            >
              {{ group.date }}
            </span>
          </div>

          <div
            v-for="(msg, index) in group.messages"
            :key="msg._pendingKey || msg.id || index"
            :data-message-id="msg.id"
            :class="getMessageClass(msg)"
          >
            <!-- New messages divider (between cached and fresh messages) -->
            <NewMessages v-if="msg.id === firstNewMessageId">
              New messages
            </NewMessages>

            <!-- Unread divider -->
            <UnreadDivider
              :msg="msg"
              v-if="msg.id === firstUnreadMessageId && !isMine(msg)"
              >Unread messages
            </UnreadDivider>

            <!-- Chat Message -->
            <template v-else>
              <div
                class="flex items-end gap-2 max-w-[75%] transition-all duration-200 ease-in-out"
                :class="isMine(msg) ? 'flex-row-reverse' : ''"
              >
                <!-- Avatar for others' messages -->
                <div
                  :style="{
                    backgroundColor: getAvatarColor(msg.sender_username),
                  }"
                  class="w-8 h-8 flex items-center justify-center rounded-full text-white text-sm flex-shrink-0 transition-all duration-200"
                  shape="circle"
                >
                  {{ msg.sender_username?.charAt(0).toUpperCase() }}
                </div>

                <div
                  class="px-4 py-2.5 shadow-sm"
                  :class="isMine(msg) ? 'bg-purple-400' : 'bg-white'"
                >
                  <!-- Username & Time -->
                  <div
                    class="flex items-center gap-2 mb-1"
                    :class="isMine(msg) ? 'text-white' : 'text-gray-800'"
                    v-if="!isMine(msg)"
                  >
                    <span class="text-xs font-semibold">{{
                      msg.sender_username
                    }}</span>
                    <span class="text-xs opacity-60">{{
                      formatTime(msg.created_at)
                    }}</span>
                  </div>

                  <!-- Message Text -->
                  <div
                    class="text-sm leading-relaxed break-words"
                    :class="isMine(msg) ? 'text-white' : 'text-gray-800'"
                  >
                    {{ msg.content }} - {{ msg.is_read }}
                  </div>

                  <!-- Message Status (for own messages) -->
                  <div
                    v-if="isMine(msg)"
                    class="flex justify-end mt-1 opacity-70"
                    :class="isMine(msg) ? 'text-white' : 'text-gray-800'"
                  >
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
        </div>

        <!-- Empty State -->
        <EmptyState v-if="messages.length === 0">
          Start the conversation!
        </EmptyState>

        <!-- Need Fix Intersection Observer -->
        <div ref="bottomSentinel" class="h-[1px] mt-1 w-full"></div>
      </div>
    </div>

    <!-- Go to Bottom Button -->
    <transition name="fade">
      <button
        v-if="showScrollButton"
        @click="scrollToBottom"
        class="absolute bottom-4 right-4 z-10 shadow-lg rounded-full bg-green-500 text-white p-1"
        :badge="displayUnreadCount > 0 ? String(displayUnreadCount) : null"
        badgeClass="p-badge-danger"
      >
        <ChevronDown :size="30" />
      </button>
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
import { useRoute } from "vue-router";
import {
  formatTime,
  getAvatarColor,
  isMine,
  scrollToMessage,
} from "../composables/helpers";
import { ChevronDown } from "@lucide/vue";
import { UnreadDivider, EmptyState } from "./chat/index.js";
import NewMessages from "./chat/NewMessages.vue";

const props = defineProps({
  messages: {
    type: Array,
    required: true,
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
const route = useRoute();

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
const topObserver = ref(null);

// Display unread count - use local count that decreases as messages are read
const displayUnreadCount = computed(() => {
  // Show new messages count if higher, otherwise show remaining unread
  return newMessagesCount.value;
});

const dateGroupedMessages = computed(() => {
  const groups = [];
  let currentGroup = null;
  props.messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!currentGroup || currentGroup.date !== msgDate) {
      currentGroup = { date: msgDate, messages: [] };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(msg);
  });
  return groups;
});

function getMessageClass(msg) {
  return [
    "mb-3",
    msg.type === "system"
      ? "flex justify-center"
      : isMine(msg)
        ? "flex justify-end"
        : "theirs",
  ];
}

async function scrollToBottom(smooth = true) {
  if (!scrollPanelRef.value) {
    console.warn("scrollToBottom: scrollPanelRef is not available");
    return;
  }
  await nextTick();

  if (scrollPanelRef.value) {
    scrollPanelRef.value.scrollTo({
      top: scrollPanelRef.value.scrollHeight,
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
    console.warn("scrollToBottom: could not find scroll content element");
  }
}
const isLoading = ref(false);
function handleScroll(event) {
  if (scrollPanelRef.value) {
    const { scrollTop, scrollHeight, clientHeight } = scrollPanelRef.value;
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

/**
 * Get the message ID that's currently visible at the top of the viewport
 * This will be used to restore scroll position when re-entering the chat
 */
function getVisibleTopMessageId() {
  if (!scrollPanelRef.value) return null;

  const scrollTop = scrollPanelRef.value.scrollTop;
  const messageElements =
    scrollPanelRef.value.querySelectorAll("[data-message-id]");

  for (const element of messageElements) {
    const rect = element.getBoundingClientRect();
    const containerRect = scrollPanelRef.value.getBoundingClientRect();

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

  if (!scrollPanelRef.value) {
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
      root: scrollPanelRef.value,
      threshold: 0.5, // Message is considered "read" when 50% visible
      rootMargin: "0px",
    },
  );

  // Observe all unread messages (messages from others)
  const messageElements =
    scrollPanelRef.value.querySelectorAll("[data-message-id]");
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

  if (!scrollPanelRef.value || !bottomSentinel.value) {
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
          const { scrollHeight, clientHeight } = scrollPanelRef.value;
          const hasScrollableContent = scrollHeight > clientHeight;
          showScrollButton.value = hasScrollableContent;
        }
      });
    },
    {
      root: scrollPanelRef.value,
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
 * Triggers loading older messages when user scrolls near the top
 */
function setupTopObserver() {
  if (topObserver.value) {
    topObserver.value.disconnect();
  }

  if (!scrollPanelRef.value || !topSentinel.value) {
    console.warn(
      "setupTopObserver: could not find scroll content or top sentinel",
    );
    return;
  }

  topObserver.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (
          entry.isIntersecting &&
          props.hasMoreMessages &&
          !props.isLoadingMore
        ) {
          isLoading.value = true;
          emit("loadMore");
        }
      });
    },
    {
      root: scrollPanelRef.value,
      threshold: 0,
      rootMargin: "100px 0px 0px 0px",
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
  lastMessageCount.value = props.messages.length;

  // If messages already exist on mount, handle initial scroll
  if (props.messages.length > 0) {
    initialScrollDone.value = true;

    // Check after content renders
    // Always setup Intersection Observer for tracking read messages
    setupMessageObserver();
    // Setup bottom observer for reliable "at bottom" detection
    setupBottomObserver();
    setupTopObserver();

    // Setup top observer for loading older messages
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
    cleanupTopObserver();

    // The messages watcher will handle scrolling when messages load for the new chat
  },
  { immediate: false },
);

// When new messages arrive
watch(
  () => [props.messages.length, route.params.userId],
  async (newLength, oldLength) => {
    isLoading.value = false;

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

      if (isAtBottom.value) {
        console.log("scrollToBottom(false); C");
        scrollToBottom(true);
      } else {
        // User is scrolled up, increment counter and show button
        showScrollButton.value = true;
      }
    }

    lastMessageCount.value = newLength;
  },
);
onMounted(() => {
  scrollPanelRef.value.addEventListener("scroll", () => {
    if (scrollPanelRef.value.scrollTop <= 10) {
      scrollPanelRef.value.scrollTop = 10;
    }
  });
});
// Sync local unread count with props
watch(
  () => props.unreadCount,
  (newCount) => {
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
