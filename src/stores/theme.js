import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";

const STORAGE_KEY = "chat_theme_background";

export const BACKGROUND_THEMES = [
  { id: "default", name: "Default", path: null },
  { id: "1", name: "Clouds", path: "/background_images/1.jpg" },
  { id: "2", name: "Mountains", path: "/background_images/2.jpg" },
  { id: "3", name: "Ocean", path: "/background_images/3.jpg" },
  { id: "4", name: "Forest", path: "/background_images/4.jpg" },
  { id: "5", name: "Sunset", path: "/background_images/5.jpg" },
  { id: "6", name: "Night", path: "/background_images/6.jpg" },
];

export const useThemeStore = defineStore("theme", () => {
  const backgroundId = ref("default");

  const activeTheme = computed(
    () =>
      BACKGROUND_THEMES.find((t) => t.id === backgroundId.value) ||
      BACKGROUND_THEMES[0],
  );

  const chatBackgroundStyle = computed(() => {
    if (!activeTheme.value.path) return {};
    return {
      backgroundImage: `url(${activeTheme.value.path})`,
      backgroundRepeat: "repeat",
      backgroundSize: "contain",
      backgroundPosition: "top left",
    };
  });

  const hasCustomBackground = computed(() => !!activeTheme.value.path);

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && BACKGROUND_THEMES.some((t) => t.id === saved)) {
        backgroundId.value = saved;
      }
    } catch {
      /* ignore */
    }
    applyToDocument();
  }

  function setBackground(id) {
    if (!BACKGROUND_THEMES.some((t) => t.id === id)) return;
    backgroundId.value = id;
    localStorage.setItem(STORAGE_KEY, id);
    applyToDocument();
  }

  function applyToDocument() {
    const theme = activeTheme.value;
    document.documentElement.style.setProperty(
      "--chat-bg-image",
      theme.path ? `url(${theme.path})` : "none",
    );
  }

  watch(backgroundId, applyToDocument);

  return {
    backgroundId,
    activeTheme,
    chatBackgroundStyle,
    hasCustomBackground,
    loadFromStorage,
    setBackground,
    applyToDocument,
  };
});
