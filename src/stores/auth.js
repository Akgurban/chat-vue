import { defineStore } from "pinia";
import { ref, computed } from "vue";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem("token"));
  const user = ref(JSON.parse(localStorage.getItem("user") || "null"));
  const error = ref(null);
  const success = ref(null);

  const isAuthenticated = computed(() => !!token.value && !!user.value);

  async function api(endpoint, options = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token.value) headers["Authorization"] = `Bearer ${token.value}`;

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function register(username, email, password) {
    try {
      error.value = null;
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });
      token.value = data.token;
      user.value = data.user;
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      success.value = "Registered successfully!";
      return true;
    } catch (err) {
      error.value = err.message;
      return false;
    }
  }

  async function login(email, password) {
    try {
      error.value = null;
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      token.value = data.token;
      user.value = data.user;
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      success.value = "Logged in successfully!";
      return true;
    } catch (err) {
      error.value = err.message;
      return false;
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  function clearMessages() {
    error.value = null;
    success.value = null;
  }

  return {
    token,
    user,
    error,
    success,
    isAuthenticated,
    api,
    register,
    login,
    logout,
    clearMessages,
  };
});
