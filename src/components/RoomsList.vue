<template>
  <Card>
    <template #title>
      <div class="flex items-center gap-2">
        <i class="pi pi-home"></i>
        <span>Rooms</span>
      </div>
    </template>
    <template #header>
      <div class="flex justify-end gap-2 px-4 pt-4">
        <Button
          @click="chatStore.loadRooms"
          icon="pi pi-refresh"
          size="small"
          text
          rounded
        />
        <Button
          @click="showCreateRoom"
          icon="pi pi-plus"
          size="small"
          severity="success"
          rounded
        />
      </div>
    </template>
    <template #content>
      <Listbox
        :options="chatStore.rooms"
        optionLabel="name"
        class="w-full border-0"
        listStyle="max-height: 200px"
        @change="handleRoomSelect"
      >
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <i
              :class="option.is_private ? 'pi pi-lock' : 'pi pi-globe'"
              class="text-sm"
            ></i>
            <span>{{ option.name }}</span>
          </div>
        </template>
        <template #empty>
          <p class="text-gray-500 text-center py-2">No public rooms</p>
        </template>
      </Listbox>
    </template>
  </Card>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useChatStore } from "../stores/chat";
import Card from "primevue/card";
import Button from "primevue/button";
import Listbox from "primevue/listbox";

const router = useRouter();
const chatStore = useChatStore();

function handleRoomSelect(event) {
  const room = event.value;
  if (room) {
    router.push(`/room/${room.id}`);
  }
}

function showCreateRoom() {
  router.push("/create-room");
}
</script>
