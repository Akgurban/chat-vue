<template>
  <div class="default-view">
    <div class="welcome-content">
      <div class="icon-wrapper">
        <i class="pi pi-comments"></i>
      </div>
      <h2>Select a chat to start messaging</h2>
      <p>Choose from your existing conversations or start a new one</p>
    </div>
  </div>
</template>

<script setup></script>

<style scoped>
.default-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
}

.welcome-content {
  text-align: center;
  padding: 48px;
}

.icon-wrapper {
  width: 120px;
  height: 120px;
  margin: 0 auto 24px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.15);
}

.icon-wrapper i {
  font-size: 48px;
  color: #6366f1;
}

h2 {
  font-size: 24px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 12px;
}

p {
  font-size: 15px;
  color: #64748b;
  max-width: 300px;
  margin: 0 auto;
}
</style>
