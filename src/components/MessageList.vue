<template>
  <div class="message-list-root relative overflow-hidden h-full bg-transparent">
    <div
      ref="scrollPanelRef"
      @scroll="handleScroll"
      style="overflow-y: overlay"
      class="h-full"
    >
      <div class="px-3 py-2">
        <!-- Top sentinel - triggers loading older messages -->
        <div ref="topSentinel" class="w-full min-h-[1px]"></div>

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
            <NewMessages v-if="msg.id === firstNewMessageId">
              New messages
            </NewMessages>

            <UnreadDivider
              :msg="msg"
              v-if="msg.id === firstUnreadMessageId && !isMine(msg)"
              >Unread messages
            </UnreadDivider>

            <template v-else>
              <div
                class="flex items-end gap-2 max-w-[75%] transition-all duration-200 ease-in-out"
                :class="isMine(msg) ? 'flex-row-reverse' : ''"
              >
                <div
                  :style="{
                    backgroundColor: getAvatarColor(msg.sender_username),
                  }"
                  class="w-8 h-8 flex items-center justify-center rounded-full text-white text-sm flex-shrink-0 transition-all duration-200"
                >
                  {{ msg.sender_username?.charAt(0).toUpperCase() }}
                </div>

                <div
                  class="px-4 py-2.5 shadow-sm"
                  :class="isMine(msg) ? 'bg-purple-400' : 'bg-white'"
                >
                  <div
                    class="flex items-center gap-2 mb-1"
                    :class="isMine(msg) ? 'text-white' : 'text-gray-800'"
                    v-if="!isMine(msg)"
                  >
                    <span class="text-xs font-semibold">
                      {{ msg.sender_username }}
                    </span>
                    <span class="text-xs opacity-60">
                      {{ formatTime(msg.created_at) }}
                    </span>
                  </div>

                  <div
                    class="text-sm leading-relaxed break-words"
                    :class="isMine(msg) ? 'text-white' : 'text-gray-800'"
                  >
                    {{ msg.content }} - {{ msg.is_read }}
                  </div>

                  <div
                    v-if="isMine(msg)"
                    class="flex justify-end mt-1 opacity-70 text-white"
                  >
                    <i
                      :class="
                        msg.is_read ? 'pi pi-check-circle' : 'pi pi-check'
                      "
                      class="text-xs"
                    ></i>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <EmptyState v-if="messages.length === 0">
          Start the conversation!
        </EmptyState>
      </div>
    </div>

    <transition name="fade">
      <button
        v-if="showScrollButton"
        @click="scrollToBottom"
        class="absolute bottom-4 right-4 z-10 shadow-lg rounded-full bg-green-500 text-white p-1"
      >
        <ChevronDown :size="30" />
      </button>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from "vue";
import { useAuthStore } from "../stores/auth";
import * as db from "../utils/indexedDB";
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
  messages: { type: Array, required: true },
  unreadCount: { type: Number, default: 0 },
  firstUnreadMessageId: { type: [Number, String], default: null },
  firstNewMessageId: { type: [Number, String], default: null },
  chatId: { type: [Number, String], default: null },
  hasMoreMessages: { type: Boolean, default: true },
  isLoadingMore: { type: Boolean, default: false },
});

const emit = defineEmits(["messageRead", "markAllRead", "loadMore"]);

const authStore = useAuthStore();

// ──────────────────────────────────────────────
// Refs / state
// ──────────────────────────────────────────────
const scrollPanelRef = ref(null);
const topSentinel = ref(null);

const showScrollButton = ref(false);
const isAtBottom = ref(true);

// Read-tracking
const readMessageIds = ref(new Set());
let messageObserver = null;
let topObserver = null;

// Top infinite-scroll: pixel-perfect preservation
const isLoadingOlder = ref(false);
let lengthAtLoadStart = 0;

const TOP_LOAD_THRESHOLD_PX = 200;

// ──────────────────────────────────────────────
// Computed
// ──────────────────────────────────────────────
const dateGroupedMessages = computed(() => {
  const groups = [];
  let current = null;
  for (const msg of props.messages) {
    const date = new Date(msg.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!current || current.date !== date) {
      current = { date, messages: [] };
      groups.push(current);
    }
    current.messages.push(msg);
  }
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

// ──────────────────────────────────────────────
// Scroll helpers
// ──────────────────────────────────────────────
async function scrollToBottom(smooth = true) {
  const el = scrollPanelRef.value;
  if (!el) return;
  await nextTick();
  el.scrollTo({
    top: el.scrollHeight,
    behavior: smooth ? "smooth" : "instant",
  });
  isAtBottom.value = true;
  showScrollButton.value = false;
  if (props.unreadCount > 0) emit("markAllRead");
  if (props.chatId) {
    db.clearScrollPosition(props.chatId, authStore.user?.id).catch(() => {});
  }
}

function handleScroll() {
  const el = scrollPanelRef.value;
  if (!el) return;

  const { scrollTop, scrollHeight, clientHeight } = el;
  const hasScroll = scrollHeight > clientHeight;
  const wasAtBottom = isAtBottom.value;

  isAtBottom.value =
    !hasScroll || scrollHeight - scrollTop - clientHeight < 100;
  showScrollButton.value = hasScroll && !isAtBottom.value;

  if (!wasAtBottom && isAtBottom.value && props.unreadCount > 0) {
    emit("markAllRead");
  }

  // Backup trigger for fast scrolls (IntersectionObserver may miss them)
  if (scrollTop < TOP_LOAD_THRESHOLD_PX) requestLoadMore();
}

function getVisibleTopMessageId() {
  const el = scrollPanelRef.value;
  if (!el) return null;
  const containerTop = el.getBoundingClientRect().top;
  const items = el.querySelectorAll("[data-message-id]");
  for (const m of items) {
    if (m.getBoundingClientRect().bottom > containerTop + 1) {
      return m.getAttribute("data-message-id");
    }
  }
  return items.length ? items[0].getAttribute("data-message-id") : null;
}

// ──────────────────────────────────────────────
// Top infinite-scroll: pixel-perfect anchoring
// ──────────────────────────────────────────────
function requestLoadMore() {
  if (
    !scrollPanelRef.value ||
    !props.hasMoreMessages ||
    props.isLoadingMore ||
    isLoadingOlder.value
  ) {
    return;
  }
  lengthAtLoadStart = props.messages.length;
  isLoadingOlder.value = true;
  emit("loadMore");
}

// ──────────────────────────────────────────────
// Scroll position persistence
// ──────────────────────────────────────────────
async function saveScrollPos() {
  if (!props.chatId) return;
  const id = getVisibleTopMessageId();
  if (!id) return;
  try {
    await db.saveScrollPosition(props.chatId, id, authStore.user?.id);
  } catch (err) {
    console.error("Failed to save scroll position:", err);
  }
}

async function loadScrollPos() {
  if (!props.chatId) return null;
  try {
    const ids = [props.chatId, authStore.user?.id].sort((a, b) => a - b);
    const key = `scroll_position_dm_${ids[0]}_${ids[1]}`;
    const local = localStorage.getItem(key);
    if (local) {
      localStorage.removeItem(key);
      const parsed = JSON.parse(local);
      if (parsed.messageId) {
        await db.saveScrollPosition(
          props.chatId,
          parsed.messageId,
          authStore.user?.id,
        );
        return parsed.messageId;
      }
    }
    const data = await db.getScrollPosition(props.chatId, authStore.user?.id);
    return data?.messageId || null;
  } catch (err) {
    console.error("Failed to load scroll position:", err);
    return null;
  }
}

// ──────────────────────────────────────────────
// Observers
// ──────────────────────────────────────────────
function setupMessageObserver() {
  messageObserver?.disconnect();
  const el = scrollPanelRef.value;
  if (!el) return;

  messageObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.getAttribute("data-message-id");
        if (!id || readMessageIds.value.has(id)) continue;
        const msg = props.messages.find((m) => String(m.id) === String(id));
        if (msg && !isMine(msg)) {
          readMessageIds.value.add(id);
          emit("messageRead", id);
        }
      }
    },
    { root: el, threshold: 0.5 },
  );

  el.querySelectorAll("[data-message-id]").forEach((node) => {
    const id = node.getAttribute("data-message-id");
    const msg = props.messages.find((m) => String(m.id) === String(id));
    if (msg && !isMine(msg) && !readMessageIds.value.has(id)) {
      messageObserver.observe(node);
    }
  });
}

function setupTopObserver() {
  topObserver?.disconnect();
  if (!scrollPanelRef.value || !topSentinel.value) return;

  topObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) requestLoadMore();
      }
    },
    {
      root: scrollPanelRef.value,
      threshold: 0,
      rootMargin: `${TOP_LOAD_THRESHOLD_PX}px 0px 0px 0px`,
    },
  );
  topObserver.observe(topSentinel.value);
}

function setupObservers() {
  setupMessageObserver();
  setupTopObserver();
}

function cleanupObservers() {
  messageObserver?.disconnect();
  messageObserver = null;
  topObserver?.disconnect();
  topObserver = null;
}

// ──────────────────────────────────────────────
// Initial scroll positioning
// ──────────────────────────────────────────────
async function performInitialScroll() {
  const savedId = await loadScrollPos();
  if (props.firstUnreadMessageId) {
    scrollToMessage(props.firstUnreadMessageId, false, scrollPanelRef);
  } else if (savedId) {
    scrollToMessage(savedId, false, scrollPanelRef);
  } else {
    scrollToBottom(false);
  }
}

// ──────────────────────────────────────────────
// beforeunload (browser refresh / close)
// ──────────────────────────────────────────────
function handleBeforeUnload() {
  if (!props.chatId) return;
  const id = getVisibleTopMessageId();
  if (!id) return;
  try {
    const ids = [props.chatId, authStore.user?.id].sort((a, b) => a - b);
    const key = `scroll_position_dm_${ids[0]}_${ids[1]}`;
    localStorage.setItem(
      key,
      JSON.stringify({ messageId: id, timestamp: Date.now() }),
    );
  } catch (err) {
    console.error("Failed to save scroll position on beforeunload:", err);
  }
}

// ──────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────
onMounted(async () => {
  window.addEventListener("beforeunload", handleBeforeUnload);
  if (props.messages.length > 0) {
    await nextTick();
    setupObservers();
    await performInitialScroll();
  }
});

onBeforeUnmount(() => {
  saveScrollPos();
  cleanupObservers();
  window.removeEventListener("beforeunload", handleBeforeUnload);
});

// ──────────────────────────────────────────────
// Watchers
// ──────────────────────────────────────────────
watch(
  () => props.chatId,
  async (newId, oldId) => {
    if (oldId && oldId !== newId) {
      const id = getVisibleTopMessageId();
      try {
        if (id && !isAtBottom.value) {
          await db.saveScrollPosition(oldId, id, authStore.user?.id);
        } else if (isAtBottom.value) {
          await db.clearScrollPosition(oldId, authStore.user?.id);
        }
      } catch (err) {
        console.error("Failed to persist scroll position:", err);
      }
    }

    isAtBottom.value = false;
    showScrollButton.value = true;
    readMessageIds.value = new Set();
    isLoadingOlder.value = false;
    cleanupObservers();

    await nextTick();
    if (props.messages.length > 0) {
      setupObservers();
      await performInitialScroll();
    }
  },
);

watch(
  () => props.messages.length,
  async (newLen, oldLen) => {
    if (newLen === oldLen) return;

    // Older messages prepended via load-more.
    // Capture scroll BEFORE the DOM re-renders, then restore the pixel
    // position after Vue flushes the new nodes.
    if (isLoadingOlder.value && newLen > oldLen) {
      const el = scrollPanelRef.value;
      const heightBefore = el?.scrollHeight ?? 0;
      const topBefore = el?.scrollTop ?? 0;

      await nextTick();

      if (el) {
        const diff = el.scrollHeight - heightBefore;
        if (diff > 0) el.scrollTop = topBefore + diff;
      }

      isLoadingOlder.value = false;
      setupMessageObserver();

      // Auto-fetch next page if sentinel is still in view
      requestAnimationFrame(() => {
        if (el && el.scrollTop < TOP_LOAD_THRESHOLD_PX) requestLoadMore();
      });
      return;
    }

    // First-ever messages for this chat
    if (oldLen === 0 && newLen > 0) {
      await nextTick();
      setupObservers();
      await performInitialScroll();
      return;
    }

    // Live message appended at bottom
    if (newLen > oldLen) {
      if (isAtBottom.value) scrollToBottom(true);
      else showScrollButton.value = true;
      setupMessageObserver();
    }
  },
);

// Release the load guard if the API finished without prepending anything
watch(
  () => props.isLoadingMore,
  (loading, was) => {
    if (
      was &&
      !loading &&
      isLoadingOlder.value &&
      props.messages.length === lengthAtLoadStart
    ) {
      isLoadingOlder.value = false;
    }
  },
);

defineExpose({ scrollToBottom });
</script>
