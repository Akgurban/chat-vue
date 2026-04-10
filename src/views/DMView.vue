<template>
  <div class="h-full">
    <Card v-if="loading" class="text-center py-8">
      <template #content>
        <i class="pi pi-spin pi-spinner text-4xl text-primary mb-4"></i>
        <p class="text-gray-500">Loading conversation...</p>
      </template>
    </Card>

    <Card v-else-if="error" class="text-center py-8">
      <template #content>
        <i class="pi pi-exclamation-triangle text-4xl text-orange-500 mb-4"></i>
        <p class="text-gray-700 font-semibold mb-2">User not found</p>
        <p class="text-gray-500 mb-4">{{ error }}</p>
        <Button label="Go Home" icon="pi pi-home" @click="router.push('/')" />
      </template>
    </Card>

    <DirectMessageChat v-else class="h-full" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useChatStore } from "../stores/chat";
import { useChatsStore } from "../stores/chats";
import Card from "primevue/card";
import Button from "primevue/button";
import DirectMessageChat from "../components/DirectMessageChat.vue";

const props = defineProps({
  userId: {
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

async function loadDM() {
  loading.value = true;
  error.value = null;

  try {
    const userId = parseInt(props.userId);

    // First check if we have this chat in the chats list
    const chat = chatsStore.chats.find((c) => c.id === userId);

    // Get username from chat, users list, or use a placeholder
    let username = chat?.name;

    if (!username) {
      const user = chatStore.users.find((u) => u.id === userId);
      username = user?.username;
    }

    // Set username if available
    if (username) {
      chatStore.currentDmUsername = username;
    }

    // Mark DM as read
    chatsStore.markDmAsRead(userId);
  } catch (err) {
    console.error("Failed to load DM:", err);
    error.value = "Failed to load conversation. Please try again.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadDM();
});

// Watch for route changes
watch(
  () => props.userId,
  () => {
    loadDM();
  },
);
</script>
