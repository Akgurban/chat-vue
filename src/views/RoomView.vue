<template>
  <div class="h-full">
    <Card v-if="loading" class="text-center py-8">
      <template #content>
        <i class="pi pi-spin pi-spinner text-4xl text-primary mb-4"></i>
        <p class="text-gray-500">Loading room...</p>
      </template>
    </Card>

    <Card v-else-if="error" class="text-center py-8">
      <template #content>
        <i class="pi pi-exclamation-triangle text-4xl text-orange-500 mb-4"></i>
        <p class="text-gray-700 font-semibold mb-2">Room not found</p>
        <p class="text-gray-500 mb-4">{{ error }}</p>
        <Button label="Go Home" icon="pi pi-home" @click="router.push('/')" />
      </template>
    </Card>

    <RoomChat v-else class="h-full" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useChatStore } from "../stores/chat";
import { useChatsStore } from "../stores/chats";
import Card from "primevue/card";
import Button from "primevue/button";
import RoomChat from "../components/RoomChat.vue";

const props = defineProps({
  roomId: {
    type: String,
    required: true,
  },
});

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const chatsStore = useChatsStore();

const loading = ref(true);
const error = ref(null);

async function loadRoom() {
  loading.value = true;
  error.value = null;

  try {
    const roomId = parseInt(props.roomId);

    // Find room in available rooms
    if (chatStore.rooms.length === 0) {
      await chatStore.loadRooms();
    }

    const room = chatStore.rooms.find((r) => r.id === roomId);

    if (room) {
      await chatStore.joinRoom(roomId, room.name);
      // Mark room as read
      chatsStore.markRoomAsRead(roomId);
    } else {
      // Try to load from my rooms
      if (chatStore.myRooms.length === 0) {
        await chatStore.loadMyRooms();
      }
      const myRoom = chatStore.myRooms.find((r) => r.id === roomId);

      if (myRoom) {
        await chatStore.openRoom(roomId, myRoom.name);
        // Mark room as read
        chatsStore.markRoomAsRead(roomId);
      } else {
        error.value = "This room doesn't exist or you don't have access to it.";
      }
    }
  } catch (err) {
    console.error("Failed to load room:", err);
    error.value = "Failed to load room. Please try again.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadRoom();
});

// Watch for route changes
watch(
  () => props.roomId,
  () => {
    loadRoom();
  },
);
</script>
