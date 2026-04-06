<template>
  <Dialog
    v-model:visible="visible"
    header="Notification Settings"
    modal
    :style="{ width: '450px' }"
    @hide="$emit('close')"
  >
    <div class="space-y-6">
      <div v-if="loading" class="text-center py-4 text-gray-500">
        <i class="pi pi-spin pi-spinner mr-2"></i>
        Loading preferences...
      </div>

      <template v-else-if="preferences">
        <!-- General Notifications -->
        <div class="space-y-4">
          <h3 class="font-semibold text-gray-700">General</h3>

          <div class="flex items-center justify-between">
            <label for="email_notify" class="text-gray-600"
              >Email notifications</label
            >
            <ToggleSwitch
              v-model="preferences.email_notifications"
              inputId="email_notify"
            />
          </div>

          <div class="flex items-center justify-between">
            <label for="push_notify" class="text-gray-600"
              >Push notifications</label
            >
            <ToggleSwitch
              v-model="preferences.push_notifications"
              @change="handlePushToggle"
              inputId="push_notify"
            />
          </div>

          <div class="flex items-center justify-between">
            <label for="mute_all" class="text-gray-600">Mute all</label>
            <ToggleSwitch v-model="preferences.mute_all" inputId="mute_all" />
          </div>
        </div>

        <Divider />

        <!-- Notification Types -->
        <div class="space-y-4">
          <h3 class="font-semibold text-gray-700">Notify me about</h3>

          <div class="flex items-center justify-between">
            <label for="dm_notify" class="text-gray-600">Direct messages</label>
            <ToggleSwitch
              v-model="preferences.direct_message_notify"
              inputId="dm_notify"
            />
          </div>

          <div class="flex items-center justify-between">
            <label for="mention_notify" class="text-gray-600">Mentions</label>
            <ToggleSwitch
              v-model="preferences.mention_notify"
              inputId="mention_notify"
            />
          </div>

          <div class="flex items-center justify-between">
            <label for="room_msg_notify" class="text-gray-600"
              >Room messages</label
            >
            <ToggleSwitch
              v-model="preferences.room_message_notify"
              inputId="room_msg_notify"
            />
          </div>
        </div>

        <Divider />

        <!-- Quiet Hours -->
        <div class="space-y-4">
          <h3 class="font-semibold text-gray-700">Quiet Hours</h3>

          <div class="flex items-center justify-between">
            <label for="quiet_hours" class="text-gray-600"
              >Enable quiet hours</label
            >
            <ToggleSwitch
              v-model="preferences.quiet_hours_enabled"
              inputId="quiet_hours"
            />
          </div>

          <div v-if="preferences.quiet_hours_enabled" class="flex gap-4">
            <div class="flex-1">
              <label class="block text-sm text-gray-500 mb-2">Start</label>
              <InputText
                type="time"
                v-model="preferences.quiet_hours_start"
                class="w-full"
              />
            </div>
            <div class="flex-1">
              <label class="block text-sm text-gray-500 mb-2">End</label>
              <InputText
                type="time"
                v-model="preferences.quiet_hours_end"
                class="w-full"
              />
            </div>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          @click="visible = false"
          label="Cancel"
          text
          severity="secondary"
        />
        <Button
          @click="savePreferences"
          :loading="saving"
          :label="saving ? 'Saving...' : 'Save'"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useNotificationStore } from "../stores/notifications";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import ToggleSwitch from "primevue/toggleswitch";
import Divider from "primevue/divider";
import InputText from "primevue/inputtext";

const emit = defineEmits(["close"]);

const notificationStore = useNotificationStore();

const visible = ref(true);
const loading = ref(true);
const saving = ref(false);
const preferences = ref(null);

onMounted(async () => {
  await notificationStore.fetchPreferences();
  preferences.value = { ...notificationStore.preferences };
  loading.value = false;
});

async function handlePushToggle() {
  if (preferences.value.push_notifications) {
    // Request permission and subscribe
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        preferences.value.push_notifications = false;
        alert("Push notification permission denied");
      }
    } catch (err) {
      console.error("Failed to request push permission:", err);
      preferences.value.push_notifications = false;
    }
  }
}

async function savePreferences() {
  saving.value = true;
  const success = await notificationStore.updatePreferences(preferences.value);
  saving.value = false;

  if (success) {
    visible.value = false;
    emit("close");
  } else {
    alert("Failed to save preferences");
  }
}
</script>
