<template>
  <router-view />
</template>

<script setup>
import { onMounted } from "vue";
import { useAuthStore } from "./stores/auth";
import { useChatStore } from "./stores/chat";

const authStore = useAuthStore();
const chatStore = useChatStore();
</script>
