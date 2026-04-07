<template>
  <div
    @click="$emit('click')"
    :class="[
      'flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors',
      !notification.is_read ? 'bg-blue-50' : '',
    ]"
  >
    <!-- Icon -->
    <Avatar :icon="iconClass" :class="avatarClass" shape="circle" />

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-gray-900 truncate">
        {{ notification.title }}
      </p>
      <p class="text-sm text-gray-500 truncate">
        {{ notification.body }}
      </p>
      <p class="text-xs text-gray-400 mt-1">
        {{ formatTime(notification.created_at) }}
      </p>
    </div>

    <!-- Actions -->
    <div class="flex-shrink-0 flex items-center gap-2">
      <Badge v-if="!notification.is_read" severity="info" class="w-2 h-2" />
      <Button
        @click.stop="$emit('delete')"
        text
        rounded
        severity="danger"
        size="small"
        icon="pi pi-times"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import Avatar from "primevue/avatar";
import Badge from "primevue/badge";
import Button from "primevue/button";

const props = defineProps({
  notification: {
    type: Object,
    required: true,
  },
});

defineEmits(["click", "delete"]);

const iconClass = computed(() => {
  const icons = {
    direct_message: "pi pi-comment",
    message: "pi pi-comments",
    mention: "pi pi-at",
    system: "pi pi-info-circle",
  };
  return icons[props.notification.type] || "pi pi-info-circle";
});

const avatarClass = computed(() => {
  const colors = {
    direct_message: "bg-blue-500 text-white",
    message: "bg-green-500 text-white",
    mention: "bg-yellow-500 text-white",
    system: "bg-gray-500 text-white",
  };
  return colors[props.notification.type] || "bg-gray-500 text-white";
});

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute
  if (diff < 60000) return "Just now";
  // Less than 1 hour
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  // Less than 24 hours
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  // Less than 7 days
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  // Otherwise show date
  return date.toLocaleDateString();
}
</script>
