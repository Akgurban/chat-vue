<template>
  <div class="relative">
    <!-- Notification Bell Button -->
    <Button
      @click="toggleDropdown"
      text
      rounded
      severity="secondary"
      class="relative"
      aria-label="Notifications"
    >
      <i class="pi pi-bell text-xl"></i>
      <Badge
        v-if="notificationStore.unreadCount > 0"
        :value="
          notificationStore.unreadCount > 99
            ? '99+'
            : notificationStore.unreadCount
        "
        severity="danger"
        class="absolute -top-1 -right-1"
      />
    </Button>

    <!-- Dropdown Popover -->
    <Popover ref="popoverRef" appendTo="body">
      <div class="w-80">
        <!-- Header -->
        <div
          class="flex items-center justify-between p-3 border-b border-gray-200"
        >
          <span class="font-semibold text-gray-800">Notifications</span>
          <div class="flex gap-2 items-center">
            <Button
              v-if="notificationStore.unreadCount > 0"
              @click="markAllRead"
              text
              size="small"
              label="Mark all read"
            />
            <Button
              @click="openSettings"
              text
              rounded
              size="small"
              severity="secondary"
              icon="pi pi-cog"
            />
          </div>
        </div>

        <!-- Notifications List -->
        <ScrollPanel style="height: 320px">
          <div
            v-if="notificationStore.loading"
            class="p-4 text-center text-gray-500"
          >
            <i class="pi pi-spin pi-spinner mr-2"></i>
            Loading...
          </div>
          <div
            v-else-if="notificationStore.notifications.length === 0"
            class="p-4 text-center text-gray-500"
          >
            <i class="pi pi-inbox text-3xl mb-2 block"></i>
            No notifications
          </div>
          <div v-else>
            <NotificationItem
              v-for="notification in notificationStore.notifications"
              :key="notification.id"
              :notification="notification"
              @click="handleNotificationClick(notification)"
              @delete="deleteNotification(notification.id)"
            />
          </div>
        </ScrollPanel>

        <!-- Footer -->
        <div class="p-2 border-t border-gray-200 text-center">
          <Button
            @click="loadMore"
            text
            size="small"
            label="View all notifications"
          />
        </div>
      </div>
    </Popover>

    <!-- Settings Modal -->
    <NotificationSettings v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useNotificationStore } from "../stores/notifications";
import { useChatStore } from "../stores/chat";
import Button from "primevue/button";
import Badge from "primevue/badge";
import Popover from "primevue/popover";
import ScrollPanel from "primevue/scrollpanel";
import NotificationItem from "./NotificationItem.vue";
import NotificationSettings from "./NotificationSettings.vue";

const notificationStore = useNotificationStore();
const chatStore = useChatStore();

const popoverRef = ref();
const showSettings = ref(false);

function toggleDropdown(event) {
  popoverRef.value.toggle(event);
  if (popoverRef.value.visible) {
    notificationStore.fetchNotifications({ limit: 20 });
  }
}

function handleNotificationClick(notification) {
  // Mark as read
  if (!notification.is_read) {
    notificationStore.markAsRead(notification.id);
  }

  // Handle navigation based on type
  try {
    const data = JSON.parse(notification.data || "{}");

    switch (notification.type) {
      case "direct_message":
        if (data.sender_id) {
          chatStore.openDM(
            data.sender_id,
            notification.title.replace("Message from ", ""),
          );
        }
        break;
      case "message":
      case "room_invite":
      case "room_join":
        if (data.room_id) {
          chatStore.openRoom(data.room_id, data.room_name || "Room");
        }
        break;
    }
  } catch (e) {
    console.error("Failed to parse notification data:", e);
  }

  popoverRef.value.hide();
}

function markAllRead() {
  notificationStore.markAllAsRead();
}

function deleteNotification(id) {
  notificationStore.deleteNotification(id);
}

function openSettings() {
  showSettings.value = true;
  popoverRef.value.hide();
}

function loadMore() {
  notificationStore.fetchNotifications({ limit: 50 });
}

onMounted(() => {
  notificationStore.fetchUnreadCount();
});
</script>
