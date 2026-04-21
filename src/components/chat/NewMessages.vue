<template>
  <div
    class="flex items-center gap-3 my-4 before:bg-green-500 before:h-px before:flex-1 before:content-[''] after:bg-green-500 after:h-px after:flex-1 after:content-['']"
  >
    <span
      class="text-[12px] font-medium text-green-500 px-3 py-1.5 bg-green-100 rounded-full"
      ><slot></slot
    ></span>
  </div>
</template>
