<template>
  <Message
    :severity="wsStore.isConnected ? 'success' : 'error'"
    :closable="false"
    class="mb-4"
  >
    <template #icon>
      <i
        :class="wsStore.isConnected ? 'pi pi-wifi' : 'pi pi-exclamation-circle'"
      ></i>
    </template>
    {{ wsStore.isConnected ? "Connected" : "Disconnected" }}
  </Message>
</template>

<script setup>
import { useWebSocketStore } from "../stores/websocket";
import Message from "primevue/message";

const wsStore = useWebSocketStore();
</script>
