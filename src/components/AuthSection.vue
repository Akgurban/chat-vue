<template>
  <Card class="mb-5">
    <template #title>Authentication</template>
    <template #content>
      <div class="flex gap-5 flex-col md:flex-row">
        <!-- Register Form -->
        <div class="flex-1">
          <h3 class="text-lg font-medium mb-3">Register</h3>
          <form @submit.prevent="handleRegister" class="flex flex-col gap-3">
            <InputText
              v-model="registerForm.username"
              placeholder="Username"
              class="w-full"
            />
            <InputText
              v-model="registerForm.email"
              type="email"
              placeholder="Email"
              class="w-full"
            />
            <Password
              v-model="registerForm.password"
              placeholder="Password"
              :feedback="false"
              toggleMask
              class="w-full"
              inputClass="w-full"
            />
            <Button type="submit" label="Register" class="w-full" />
          </form>
        </div>

        <!-- Login Form -->
        <div class="flex-1">
          <h3 class="text-lg font-medium mb-3">Login</h3>
          <form @submit.prevent="handleLogin" class="flex flex-col gap-3">
            <InputText
              v-model="loginForm.email"
              type="email"
              placeholder="Email"
              class="w-full"
            />
            <Password
              v-model="loginForm.password"
              placeholder="Password"
              :feedback="false"
              toggleMask
              class="w-full"
              inputClass="w-full"
            />
            <Button type="submit" label="Login" class="w-full" />
          </form>
        </div>
      </div>

      <!-- Messages -->
      <Message
        v-if="authStore.error"
        severity="error"
        :closable="true"
        @close="authStore.clearMessages"
        class="mt-4"
      >
        {{ authStore.error }}
      </Message>
      <Message
        v-if="authStore.success"
        severity="success"
        :closable="true"
        @close="authStore.clearMessages"
        class="mt-4"
      >
        {{ authStore.success }}
      </Message>
    </template>
  </Card>
</template>

<script setup>
import { reactive } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Button from "primevue/button";
import Message from "primevue/message";

const router = useRouter();
const authStore = useAuthStore();

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
  await authStore.register(
    registerForm.username,
    registerForm.email,
    registerForm.password,
  );
}

async function handleLogin() {
  const success = await authStore.login(loginForm.email, loginForm.password);
  if (success) {
    // Check for saved redirect path
    const redirectPath = sessionStorage.getItem("redirectPath");
    if (redirectPath) {
      sessionStorage.removeItem("redirectPath");
      router.push(redirectPath);
    } else {
      router.push("/");
    }
  }
}
</script>
