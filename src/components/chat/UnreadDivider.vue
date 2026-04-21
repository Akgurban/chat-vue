<template>
  <div>
    <div
      class="flex items-center justify-center gap-3 my-4 after:content-[''] after:bg-[#6366f1] after:h-[1px] after:flex-1 before:content-[''] before:bg-[#6366f1] before:h-[1px] before:flex-1"
    >
      <span
        class="text-[12px] font-medium text-[#6366f1] px-3 py-1.5 rounded-full"
      >
        <slot></slot>
      </span>
    </div>
    <div
      class="flex items-end gap-2 max-w-[75%] transition-all duration-200 ease-in-out"
      :class="isMine(msg) ? 'flex-row-reverse' : ''"
    >
      <!-- Avatar for others' messages -->
      <div
        :style="{
          backgroundColor: getAvatarColor(msg.sender_username),
        }"
        class="w-8 h-8 flex items-center justify-center rounded-full text-white text-sm flex-shrink-0 transition-all duration-200"
        shape="circle"
      >
        {{ msg.sender_username?.charAt(0).toUpperCase() }}
      </div>
      <div
        class="px-4 py-2.5 shadow-sm w-[200px]"
        :class="isMine(msg) ? 'bg-purple-400' : 'bg-white'"
      >
        <!-- Username & Time -->
        <div
          class="flex items-center gap-2 mb-1"
          :class="isMine(msg) ? 'text-white' : 'text-gray-800'"
          v-if="!isMine(msg)"
        >
          <span class="text-xs font-semibold">{{ msg.sender_username }}</span>
          <span class="text-xs opacity-60">{{
            formatTime(msg.created_at)
          }}</span>
        </div>

        <!-- Message Text -->
        <div
          class="text-sm leading-relaxed break-words"
          :class="isMine(msg) ? 'text-white' : 'text-gray-800'"
        >
          {{ msg.content }} - {{ msg.is_read }}
        </div>

        <!-- Message Status (for own messages) -->
        <div
          v-if="isMine(msg)"
          class="flex justify-end mt-1 opacity-70"
          :class="isMine(msg) ? 'text-white' : 'text-gray-800'"
        >
          <div v-if="msg.is_read">
            <i class="pi pi-check-circle text-xs"></i>
          </div>
          <div v-else>
            <i class="pi pi-check text-xs"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatTime, getAvatarColor, isMine } from "../../composables/helpers";

defineProps({
  msg: {
    type: Object,
    required: true,
  },
});
</script>
