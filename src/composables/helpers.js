import { useAuthStore } from "../stores/auth";

export function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function getAvatarColor(username) {
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

export function getBubbleClass(msg, props) {
  return [`color-${props} bubble-rounded`, isMine(msg) ? "mine" : "theirs"];
}

export function isMine(msg) {
  const authStore = useAuthStore();
  return msg.sender_id === authStore.user?.id;
}

export async function scrollToMessage(
  messageId,
  smooth = true,
  scrollPanelRef,
) {
  if (!messageId) return;

  const scrollContent = getScrollContent(scrollPanelRef);
  if (!scrollContent) return;

  const id = String(messageId).replace("#", "");

  const el = scrollContent.querySelector(`[data-message-id="${id}"]`);

  if (!el) {
    console.warn("Message not found:", id);
    return;
  }

  requestAnimationFrame(() => {
    el.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
      block: "start",
    });
  });
}

export function getScrollContent(scrollPanelRef) {
  if (!scrollPanelRef.value?.$el) return null;
  const el = scrollPanelRef.value.$el;
  return (
    el.querySelector(".p-scrollpanel-content-container") ||
    el.querySelector(".p-scrollpanel-content") ||
    el.querySelector(".p-scrollpanel-wrapper")
  );
}
