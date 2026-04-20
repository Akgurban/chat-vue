import { defineStore } from "pinia";
import { ref } from "vue";
import { useAuthStore } from "./auth";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

export const useWebSocketStore = defineStore("websocket", () => {
  const ws = ref(null);
  const isConnected = ref(false);
  const messageHandlers = ref([]);

  function connect() {
    const authStore = useAuthStore();
    if (!authStore.token) return;

    ws.value = new WebSocket(`${WS_URL}?token=${authStore.token}`);

    ws.value.onopen = () => {
      console.log("WebSocket connected");
      isConnected.value = true;
    };

    ws.value.onclose = () => {
      console.log("WebSocket disconnected");
      isConnected.value = false;
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (authStore.token) connect();
      }, 3000);
    };

    ws.value.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    ws.value.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      messageHandlers.value.forEach((handler) => handler(msg));
    };
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
  }

  function send(type, payload) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type, payload }));
    }
  }

  function addMessageHandler(handler) {
    messageHandlers.value.push(handler);
  }

  function removeMessageHandler(handler) {
    const index = messageHandlers.value.indexOf(handler);
    if (index > -1) {
      messageHandlers.value.splice(index, 1);
    }
  }

  return {
    isConnected,
    connect,
    disconnect,
    send,
    addMessageHandler,
    removeMessageHandler,
  };
});
