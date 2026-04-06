<template>
  <div
    :class="[
      'p-3 my-2 rounded',
      type === 'error'
        ? 'bg-red-100 text-red-700'
        : 'bg-green-100 text-green-700',
    ]"
  >
    <div class="flex justify-between items-center">
      <span>{{ message }}</span>
      <button
        @click="$emit('close')"
        class="ml-2 text-lg font-bold hover:opacity-70"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    default: "error",
    validator: (value) => ["error", "success"].includes(value),
  },
  message: {
    type: String,
    required: true,
  },
});

defineEmits(["close"]);
</script>
