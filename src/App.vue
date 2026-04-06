<template>
  <Toast position="top-right" />
  <router-view />
</template>

<script setup>
import { onMounted } from "vue";
import { useAuthStore } from "./stores/auth";
import { useChatStore } from "./stores/chat";
import { useToast } from "primevue/usetoast";
import Toast from "primevue/toast";

const authStore = useAuthStore();
const chatStore = useChatStore();
const toast = useToast();

// Set toast instance for the chat store
onMounted(() => {
  chatStore.setToastInstance(toast);
});
</script>
