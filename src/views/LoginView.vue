<template>
  <div class="login-page">
    <!-- Background decoration -->
    <div class="bg-decoration">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <div class="login-container">
      <!-- Logo & Brand -->
      <div class="brand-section">
        <div class="logo-wrapper">
          <i class="pi pi-comments logo-icon"></i>
        </div>
        <h1 class="brand-title">Chat-Go</h1>
        <p class="brand-subtitle">Connect, Chat, Collaborate</p>
      </div>

      <!-- Auth Card -->
      <div class="auth-card">
        <!-- Tab Navigation -->
        <div class="tab-nav">
          <button
            :class="['tab-btn', { active: activeTab === 'login' }]"
            @click="activeTab = 'login'"
          >
            <i class="pi pi-sign-in"></i>
            Sign In
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'register' }]"
            @click="activeTab = 'register'"
          >
            <i class="pi pi-user-plus"></i>
            Sign Up
          </button>
        </div>

        <!-- Login Form -->
        <Transition name="slide-fade" mode="out-in">
          <form
            v-if="activeTab === 'login'"
            @submit.prevent="handleLogin"
            class="auth-form"
            key="login"
          >
            <div class="form-group">
              <label for="login-email">Email</label>
              <div class="input-wrapper">
                <i class="pi pi-envelope input-icon"></i>
                <InputText
                  id="login-email"
                  v-model="loginForm.email"
                  type="email"
                  placeholder="Enter your email"
                  class="w-full"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="login-password">Password</label>
              <div class="input-wrapper">
                <i class="pi pi-lock input-icon"></i>
                <Password
                  id="login-password"
                  v-model="loginForm.password"
                  placeholder="Enter your password"
                  :feedback="false"
                  toggleMask
                  class="w-full"
                  inputClass="w-full"
                />
              </div>
            </div>

            <Button type="submit" :loading="loading" class="submit-btn">
              <i class="pi pi-sign-in" v-if="!loading"></i>
              {{ loading ? "Signing in..." : "Sign In" }}
            </Button>

            <p class="switch-text">
              Don't have an account?
              <a href="#" @click.prevent="activeTab = 'register'">Create one</a>
            </p>
          </form>

          <!-- Register Form -->
          <form
            v-else
            @submit.prevent="handleRegister"
            class="auth-form"
            key="register"
          >
            <div class="form-group">
              <label for="register-username">Username</label>
              <div class="input-wrapper">
                <i class="pi pi-user input-icon"></i>
                <InputText
                  id="register-username"
                  v-model="registerForm.username"
                  placeholder="Choose a username"
                  class="w-full"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="register-email">Email</label>
              <div class="input-wrapper">
                <i class="pi pi-envelope input-icon"></i>
                <InputText
                  id="register-email"
                  v-model="registerForm.email"
                  type="email"
                  placeholder="Enter your email"
                  class="w-full"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="register-password">Password</label>
              <div class="input-wrapper">
                <i class="pi pi-lock input-icon"></i>
                <Password
                  id="register-password"
                  v-model="registerForm.password"
                  placeholder="Create a password"
                  toggleMask
                  class="w-full"
                  inputClass="w-full"
                />
              </div>
            </div>

            <Button type="submit" :loading="loading" class="submit-btn">
              <i class="pi pi-user-plus" v-if="!loading"></i>
              {{ loading ? "Creating account..." : "Create Account" }}
            </Button>

            <p class="switch-text">
              Already have an account?
              <a href="#" @click.prevent="activeTab = 'login'">Sign in</a>
            </p>
          </form>
        </Transition>

        <!-- Messages -->
        <Transition name="fade">
          <Message
            v-if="authStore.error"
            severity="error"
            :closable="true"
            @close="authStore.clearMessages"
            class="auth-message"
          >
            {{ authStore.error }}
          </Message>
        </Transition>
        <Transition name="fade">
          <Message
            v-if="authStore.success"
            severity="success"
            :closable="true"
            @close="authStore.clearMessages"
            class="auth-message"
          >
            {{ authStore.success }}
          </Message>
        </Transition>
      </div>

      <!-- Footer -->
      <p class="footer-text">
        <i class="pi pi-shield"></i>
        Your conversations are secure and private
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Button from "primevue/button";
import Message from "primevue/message";

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref("login");
const loading = ref(false);

const registerForm = reactive({
  username: "",
  email: "",
  password: "",
});

const loginForm = reactive({
  email: "",
  password: "",
});

async function handleRegister() {
  loading.value = true;
  const success = await authStore.register(
    registerForm.username,
    registerForm.email,
    registerForm.password,
  );

  if (success) {
    // Registration already logs in the user (stores token and user)
    // Just navigate to the app
    navigateAfterAuth();
  }
  loading.value = false;
}

async function handleLogin() {
  loading.value = true;
  const success = await authStore.login(loginForm.email, loginForm.password);
  if (success) {
    navigateAfterAuth();
  }
  loading.value = false;
}

function navigateAfterAuth() {
  const redirectPath = sessionStorage.getItem("redirectPath");
  if (redirectPath) {
    sessionStorage.removeItem("redirectPath");
    router.push(redirectPath);
  } else {
    router.push("/");
  }
}
</script>

<style scoped>
@reference "tailwindcss";

.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  position: relative;
  overflow: hidden;
}

/* Background Decoration */
.bg-decoration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.5;
  animation: float 20s ease-in-out infinite;
}

.blob-1 {
  width: 400px;
  height: 400px;
  background: #a78bfa;
  top: -100px;
  left: -100px;
  animation-delay: 0s;
}

.blob-2 {
  width: 300px;
  height: 300px;
  background: #f472b6;
  bottom: -50px;
  right: -50px;
  animation-delay: -5s;
}

.blob-3 {
  width: 250px;
  height: 250px;
  background: #60a5fa;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -10s;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(30px, -30px) scale(1.1);
  }
  50% {
    transform: translate(-20px, 20px) scale(0.95);
  }
  75% {
    transform: translate(20px, 30px) scale(1.05);
  }
}

/* Container */
.login-container {
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
}

/* Brand Section */
.brand-section {
  text-align: center;
  margin-bottom: 32px;
}

.logo-wrapper {
  width: 80px;
  height: 80px;
  background: white;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  animation: pulse-shadow 3s ease-in-out infinite;
}

@keyframes pulse-shadow {
  0%,
  100% {
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  }
  50% {
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
  }
}

.logo-icon {
  font-size: 36px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-title {
  font-size: 32px;
  font-weight: 700;
  color: white;
  margin-bottom: 4px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.brand-subtitle {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

/* Auth Card */
.auth-card {
  background: white;
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
}

/* Tab Navigation */
.tab-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 28px;
  background: #f1f5f9;
  padding: 6px;
  border-radius: 16px;
}

.tab-btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.tab-btn:hover {
  color: #475569;
}

.tab-btn.active {
  background: white;
  color: #6366f1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.tab-btn i {
  font-size: 16px;
}

/* Auth Form */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.input-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  font-size: 16px;
  z-index: 1;
  pointer-events: none;
}

.input-wrapper :deep(.p-inputtext),
.input-wrapper :deep(.p-password-input) {
  padding-left: 42px !important;
  border-radius: 12px !important;
  border: 2px solid #e5e7eb !important;
  transition: all 0.3s ease !important;
}

.input-wrapper :deep(.p-inputtext:focus),
.input-wrapper :deep(.p-password-input:focus) {
  border-color: #6366f1 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
}

.input-wrapper :deep(.p-password) {
  width: 100%;
}

/* Submit Button */
.submit-btn {
  width: 100%;
  padding: 14px 24px !important;
  border-radius: 12px !important;
  font-weight: 600 !important;
  font-size: 15px !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  transition: all 0.3s ease !important;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4) !important;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5) !important;
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0) !important;
}

/* Switch Text */
.switch-text {
  text-align: center;
  font-size: 14px;
  color: #6b7280;
  margin-top: 8px;
}

.switch-text a {
  color: #6366f1;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s;
}

.switch-text a:hover {
  color: #4f46e5;
}

/* Auth Message */
.auth-message {
  margin-top: 16px;
  border-radius: 12px !important;
}

/* Footer */
.footer-text {
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  margin-top: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

/* Transitions */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 480px) {
  .auth-card {
    padding: 24px;
    border-radius: 20px;
  }

  .brand-title {
    font-size: 28px;
  }

  .logo-wrapper {
    width: 70px;
    height: 70px;
  }

  .logo-icon {
    font-size: 30px;
  }
}
</style>
