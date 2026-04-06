<template>
  <Card>
    <template #title>
      <div class="flex items-center gap-2">
        <i class="pi pi-plus-circle"></i>
        <span>Create New Room</span>
      </div>
    </template>
    <template #content>
      <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label for="room-name" class="font-medium">Room Name</label>
          <InputText
            id="room-name"
            v-model="form.name"
            placeholder="Enter room name"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="room-desc" class="font-medium">Description</label>
          <Textarea
            id="room-desc"
            v-model="form.description"
            placeholder="Enter description (optional)"
            rows="3"
            class="w-full"
          />
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            v-model="form.isPrivate"
            :binary="true"
            inputId="room-private"
          />
          <label for="room-private">Private Room</label>
        </div>
        <div class="flex gap-2 justify-end">
          <Button
            type="button"
            @click="chatStore.hideCreateRoom"
            label="Cancel"
            severity="secondary"
            outlined
          />
          <Button type="submit" label="Create Room" icon="pi pi-check" />
        </div>
      </form>
    </template>
  </Card>
</template>

<script setup>
import { reactive } from "vue";
import { useChatStore } from "../stores/chat";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Checkbox from "primevue/checkbox";
import Button from "primevue/button";

const chatStore = useChatStore();

const form = reactive({
  name: "",
  description: "",
  isPrivate: false,
});

async function handleSubmit() {
  const success = await chatStore.createRoom(
    form.name,
    form.description,
    form.isPrivate,
  );
  if (success) {
    form.name = "";
    form.description = "";
    form.isPrivate = false;
  }
}
</script>
