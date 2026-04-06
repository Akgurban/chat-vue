<template>
  <div>
    <!-- Connection Status -->
    <ConnectionStatus />

    <!-- User Info -->
    <Card class="mb-5">
      <template #content>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Avatar
              :label="authStore.user?.username?.charAt(0).toUpperCase()"
              shape="circle"
            />
            <span
              >Logged in as:
              <strong>{{ authStore.user?.username }}</strong></span
            >
          </div>
          <div class="flex items-center gap-3">
            <NotificationBell />
            <Button
              @click="handleLogout"
              label="Logout"
              severity="danger"
              icon="pi pi-sign-out"
            />
          </div>
        </div>
      </template>
    </Card>

    <div class="flex gap-5 flex-col lg:flex-row">
      <!-- Left Panel: Users & Rooms -->
      <div class="w-full lg:w-72 space-y-5">
        <UsersList />
        <RoomsList />
        <MyRoomsList />
      </div>

      <!-- Right Panel: Chat Area -->
      <div class="flex-1">
        <CreateRoomForm v-if="chatStore.chatView === 'createRoom'" />
        <RoomChat v-else-if="chatStore.chatView === 'room'" />
        <DirectMessageChat v-else-if="chatStore.chatView === 'dm'" />
        <DefaultView v-else />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from "../stores/auth";
import { useWebSocketStore } from "../stores/websocket";
import { useChatStore } from "../stores/chat";
import { useNotificationStore } from "../stores/notifications";
import Card from "primevue/card";
import Button from "primevue/button";
import Avatar from "primevue/avatar";
import ConnectionStatus from "./ConnectionStatus.vue";
import UsersList from "./UsersList.vue";
import RoomsList from "./RoomsList.vue";
import MyRoomsList from "./MyRoomsList.vue";
import CreateRoomForm from "./CreateRoomForm.vue";
import RoomChat from "./RoomChat.vue";
import DirectMessageChat from "./DirectMessageChat.vue";
import DefaultView from "./DefaultView.vue";
import NotificationBell from "./NotificationBell.vue";

const authStore = useAuthStore();
const wsStore = useWebSocketStore();
const chatStore = useChatStore();
const notificationStore = useNotificationStore();

function handleLogout() {
  wsStore.disconnect();
  authStore.logout();
  chatStore.reset();
  notificationStore.reset();
}
</script>
