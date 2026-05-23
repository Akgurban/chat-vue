<template>
  <div class="default-view">
    <div class="welcome-content">
      <div class="icon-wrapper">
        <i class="pi pi-send"></i>
      </div>
      <h2>Select a chat</h2>
      <p>Choose a conversation from the list or search for people</p>
    </div>
  </div>
</template>

<style scoped>
.default-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: #e6ebee;
}

.welcome-content {
  text-align: center;
  padding: 40px 24px;
  max-width: 360px;
}

.icon-wrapper {
  width: 100px;
  height: 100px;
  margin: 0 auto 20px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.icon-wrapper i {
  font-size: 42px;
  color: #3390ec;
}

h2 {
  font-size: 22px;
  font-weight: 600;
  color: #000;
  margin: 0 0 8px;
}

p {
  font-size: 15px;
  color: #707579;
  margin: 0;
  line-height: 1.45;
}
</style>
