import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

// Lazy-loaded views
const ChatView = () => import("../views/ChatView.vue");
const RoomView = () => import("../views/RoomView.vue");
const DMView = () => import("../views/DMView.vue");
const LoginView = () => import("../views/LoginView.vue");
const CreateRoomView = () => import("../views/CreateRoomView.vue");

const routes = [
  {
    path: "/login",
    name: "login",
    component: LoginView,
  },
  {
    path: "/",
    component: ChatView,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        name: "home",
        component: () => import("../components/DefaultView.vue"),
      },
      {
        path: "room/:roomId",
        name: "room",
        component: RoomView,
        props: true,
      },
      {
        path: "dm/:userId",
        name: "dm",
        component: DMView,
        props: true,
      },
      {
        path: "create-room",
        name: "create-room",
        component: CreateRoomView,
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Save the intended destination
    sessionStorage.setItem("redirectPath", to.fullPath);
    next({ name: "login" });
  } else if (to.name === "login" && authStore.isAuthenticated) {
    next({ name: "home" });
  } else {
    next();
  }
});

export default router;
