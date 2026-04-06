<template>
  <Card>
    <template #title>
      <div class="flex items-center gap-2">
        <i class="pi pi-users"></i>
        <span>Users</span>
      </div>
    </template>
    <template #header>
      <div class="flex justify-end px-4 pt-4">
        <Button
          @click="chatStore.loadUsers"
          icon="pi pi-refresh"
          size="small"
          text
          rounded
        />
      </div>
    </template>
    <template #content>
      <Listbox
        :options="chatStore.users"
        optionLabel="username"
        class="w-full border-0"
        listStyle="max-height: 200px"
        @change="handleUserSelect"
      >
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <Badge
              :severity="option.status === 'online' ? 'success' : 'secondary'"
              class="w-2 h-2 min-w-0 p-0"
            />
            <span>{{ option.username }}</span>
            <Tag
              v-if="option.id === authStore.user?.id"
              value="you"
              severity="info"
              class="text-xs"
            />
          </div>
        </template>
        <template #empty>
          <p class="text-gray-500 text-center py-2">No users found</p>
        </template>
      </Listbox>
    </template>
  </Card>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useChatStore } from "../stores/chat";
import Card from "primevue/card";
import Button from "primevue/button";
import Listbox from "primevue/listbox";
import Badge from "primevue/badge";
import Tag from "primevue/tag";

const router = useRouter();
const authStore = useAuthStore();
const chatStore = useChatStore();

function handleUserSelect(event) {
  const user = event.value;
  if (user && user.id !== authStore.user?.id) {
    router.push(`/dm/${user.id}`);
  }
}
</script>
