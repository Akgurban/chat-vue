import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useAuthStore } from "./auth";

export const useNotificationStore = defineStore("notifications", () => {
  const authStore = useAuthStore();

  const notifications = ref([]);
  const preferences = ref(null);
  const unreadCounts = ref({
    total_unread: 0,
    direct_message_unread: 0,
    room_unread: {},
    notification_unread: 0,
  });
  const loading = ref(false);

  const unreadCount = computed(() => unreadCounts.value.notification_unread);
  const totalUnread = computed(() => unreadCounts.value.total_unread);

  // Fetch notifications
  async function fetchNotifications(options = {}) {
    try {
      loading.value = true;
      const params = new URLSearchParams();
      if (options.limit) params.append("limit", options.limit);
      if (options.offset) params.append("offset", options.offset);
      if (options.unread) params.append("unread", "true");

      const query = params.toString() ? `?${params.toString()}` : "";
      notifications.value = await authStore.api(`/api/notifications${query}`);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      loading.value = false;
    }
  }

  // Fetch unread count
  async function fetchUnreadCount() {
    try {
      const data = await authStore.api("/api/notifications/count");
      unreadCounts.value.notification_unread = data.count;
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  }

  // Fetch all unread counts
  async function fetchAllUnreadCounts() {
    try {
      unreadCounts.value = await authStore.api("/api/notifications/counts");
    } catch (err) {
      console.error("Failed to fetch unread counts:", err);
    }
  }

  // Mark notification as read
  async function markAsRead(notificationId) {
    try {
      await authStore.api(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });
      const notification = notifications.value.find(
        (n) => n.id === notificationId,
      );
      if (notification) {
        notification.is_read = true;
        notification.read_at = new Date().toISOString();
      }
      await fetchUnreadCount();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }

  // Mark all as read
  async function markAllAsRead() {
    try {
      await authStore.api("/api/notifications/read-all", {
        method: "POST",
      });
      notifications.value.forEach((n) => {
        n.is_read = true;
        n.read_at = new Date().toISOString();
      });
      unreadCounts.value.notification_unread = 0;
      await fetchAllUnreadCounts();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }

  // Delete notification
  async function deleteNotification(notificationId) {
    try {
      await authStore.api(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });
      notifications.value = notifications.value.filter(
        (n) => n.id !== notificationId,
      );
      await fetchUnreadCount();
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  }

  // Fetch preferences
  async function fetchPreferences() {
    try {
      preferences.value = await authStore.api("/api/notifications/preferences");
    } catch (err) {
      console.error("Failed to fetch preferences:", err);
    }
  }

  // Update preferences
  async function updatePreferences(newPreferences) {
    try {
      preferences.value = await authStore.api(
        "/api/notifications/preferences",
        {
          method: "PUT",
          body: JSON.stringify(newPreferences),
        },
      );
      return true;
    } catch (err) {
      console.error("Failed to update preferences:", err);
      return false;
    }
  }

  // Subscribe to push notifications
  async function subscribeToPush(subscription) {
    try {
      const subscriptionJson = subscription.toJSON();
      await authStore.api("/api/notifications/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
          user_agent: navigator.userAgent,
        }),
      });
      return true;
    } catch (err) {
      console.error("Failed to subscribe to push:", err);
      return false;
    }
  }

  // Unsubscribe from push notifications
  async function unsubscribeFromPush(endpoint) {
    try {
      await authStore.api(
        `/api/notifications/push/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: "DELETE",
        },
      );
      return true;
    } catch (err) {
      console.error("Failed to unsubscribe from push:", err);
      return false;
    }
  }

  // Handle incoming WebSocket notification
  function handleWebSocketNotification(payload) {
    // Add to beginning of list
    notifications.value.unshift(payload);
    // Update unread count
    if (!payload.is_read) {
      unreadCounts.value.notification_unread++;
      unreadCounts.value.total_unread++;
    }
  }

  // Reset store
  function reset() {
    notifications.value = [];
    preferences.value = null;
    unreadCounts.value = {
      total_unread: 0,
      direct_message_unread: 0,
      room_unread: {},
      notification_unread: 0,
    };
  }

  return {
    notifications,
    preferences,
    unreadCounts,
    loading,
    unreadCount,
    totalUnread,
    fetchNotifications,
    fetchUnreadCount,
    fetchAllUnreadCounts,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchPreferences,
    updatePreferences,
    subscribeToPush,
    unsubscribeFromPush,
    handleWebSocketNotification,
    reset,
  };
});
