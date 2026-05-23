<template>
  <Dialog
    v-model:visible="visible"
    header="Settings"
    modal
    :style="{ width: 'min(480px, 92vw)' }"
    :draggable="false"
    class="settings-dialog"
    @hide="emit('close')"
  >
    <div class="settings-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="['settings-tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        <i :class="tab.icon"></i>
        {{ tab.label }}
      </button>
    </div>

    <!-- Appearance -->
    <div v-show="activeTab === 'appearance'" class="settings-panel">
      <p class="panel-desc">Choose a chat background (Telegram style)</p>
      <div class="bg-grid">
        <button
          v-for="theme in themes"
          :key="theme.id"
          type="button"
          :class="[
            'bg-option',
            { selected: themeStore.backgroundId === theme.id },
          ]"
          @click="themeStore.setBackground(theme.id)"
        >
          <div
            class="bg-preview"
            :class="{ 'bg-preview--default': !theme.path }"
            :style="
              theme.path
                ? { backgroundImage: `url(${theme.path})` }
                : undefined
            "
          >
            <i
              v-if="themeStore.backgroundId === theme.id"
              class="pi pi-check bg-check"
            ></i>
          </div>
          <span class="bg-label">{{ theme.name }}</span>
        </button>
      </div>
    </div>

    <!-- Notifications -->
    <div v-show="activeTab === 'notifications'" class="settings-panel">
      <div v-if="notifLoading" class="panel-loading">
        <i class="pi pi-spin pi-spinner"></i>
        Loading...
      </div>
      <template v-else-if="preferences">
        <div class="setting-row">
          <label for="email_notify">Email notifications</label>
          <ToggleSwitch
            v-model="preferences.email_notifications"
            inputId="email_notify"
          />
        </div>
        <div class="setting-row">
          <label for="push_notify">Push notifications</label>
          <ToggleSwitch
            v-model="preferences.push_notifications"
            inputId="push_notify"
            @change="handlePushToggle"
          />
        </div>
        <div class="setting-row">
          <label for="mute_all">Mute all</label>
          <ToggleSwitch v-model="preferences.mute_all" inputId="mute_all" />
        </div>
        <Divider />
        <p class="panel-subtitle">Notify me about</p>
        <div class="setting-row">
          <label for="dm_notify">Direct messages</label>
          <ToggleSwitch
            v-model="preferences.direct_message_notify"
            inputId="dm_notify"
          />
        </div>
        <div class="setting-row">
          <label for="mention_notify">Mentions</label>
          <ToggleSwitch
            v-model="preferences.mention_notify"
            inputId="mention_notify"
          />
        </div>
      </template>
    </div>

    <template #footer>
      <Button label="Close" text severity="secondary" @click="close" />
      <Button
        v-if="activeTab === 'notifications' && preferences"
        label="Save"
        :loading="saving"
        @click="savePreferences"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, onMounted } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import ToggleSwitch from "primevue/toggleswitch";
import Divider from "primevue/divider";
import {
  useThemeStore,
  BACKGROUND_THEMES,
} from "../stores/theme";
import { useNotificationStore } from "../stores/notifications";

const emit = defineEmits(["close"]);

const themeStore = useThemeStore();
const notificationStore = useNotificationStore();

const themes = BACKGROUND_THEMES;
const visible = ref(true);
const activeTab = ref("appearance");
const notifLoading = ref(true);
const saving = ref(false);
const preferences = ref(null);

const tabs = [
  { id: "appearance", label: "Chat background", icon: "pi pi-image" },
  { id: "notifications", label: "Notifications", icon: "pi pi-bell" },
];

onMounted(async () => {
  await notificationStore.fetchPreferences();
  preferences.value = { ...notificationStore.preferences };
  notifLoading.value = false;
});

function close() {
  visible.value = false;
  emit("close");
}

async function handlePushToggle() {
  if (!preferences.value?.push_notifications) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      preferences.value.push_notifications = false;
    }
  } catch {
    preferences.value.push_notifications = false;
  }
}

async function savePreferences() {
  saving.value = true;
  const ok = await notificationStore.updatePreferences(preferences.value);
  saving.value = false;
  if (!ok) alert("Failed to save preferences");
}
</script>

<style scoped>
.settings-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--tg-sidebar-search, #f4f4f5);
  border-radius: 12px;
  margin-bottom: 20px;
}

.settings-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #707579;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.settings-tab:hover {
  color: #222;
}

.settings-tab.active {
  background: #fff;
  color: #3390ec;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.panel-desc {
  font-size: 14px;
  color: #707579;
  margin: 0 0 16px;
}

.panel-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: #222;
  margin: 0 0 12px;
}

.panel-loading {
  text-align: center;
  padding: 24px;
  color: #707579;
}

.bg-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.bg-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.bg-preview {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  border: 3px solid transparent;
  transition: border-color 0.15s, transform 0.15s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.bg-preview--default {
  background: linear-gradient(135deg, #e8f4fc 0%, #d4e8f7 50%, #c5ddf0 100%);
}

.bg-option:hover .bg-preview {
  transform: scale(1.03);
}

.bg-option.selected .bg-preview {
  border-color: #3390ec;
}

.bg-check {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3390ec;
  color: #fff;
  border-radius: 50%;
  font-size: 12px;
}

.bg-label {
  font-size: 12px;
  color: #707579;
  font-weight: 500;
}

.bg-option.selected .bg-label {
  color: #3390ec;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
}

.setting-row label {
  font-size: 14px;
  color: #222;
}

@media (max-width: 400px) {
  .bg-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
