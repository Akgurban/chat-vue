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
            @click="goBack"
            label="Cancel"
            severity="secondary"
            outlined
          />
          <Button
            type="submit"
            label="Create Room"
            icon="pi pi-check"
            :loading="creating"
          />
        </div>
      </form>
    </template>
  </Card>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useChatStore } from "../stores/chat";
import { useAuthStore } from "../stores/auth";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Checkbox from "primevue/checkbox";
import Button from "primevue/button";

const router = useRouter();
const chatStore = useChatStore();
const authStore = useAuthStore();

const creating = ref(false);

const form = reactive({
  name: "",
  description: "",
  isPrivate: false,
});

async function handleSubmit() {
  if (!form.name.trim()) return;

  creating.value = true;
  try {
    const room = await authStore.api("/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        is_private: form.isPrivate,
      }),
    });

    await chatStore.loadRooms();
    await chatStore.loadMyRooms();

    // Navigate to the new room
    router.push(`/room/${room.id}`);
  } catch (err) {
    console.error("Failed to create room:", err);
  } finally {
    creating.value = false;
  }
}

function goBack() {
  router.push("/");
}
</script>
