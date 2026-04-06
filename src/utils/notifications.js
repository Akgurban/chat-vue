// Browser Notification Service
class BrowserNotificationService {
  constructor() {
    this.isTabFocused = !document.hidden;

    // Listen for visibility changes
    document.addEventListener("visibilitychange", () => {
      this.isTabFocused = !document.hidden;
    });

    window.addEventListener("focus", () => {
      this.isTabFocused = true;
    });

    window.addEventListener("blur", () => {
      this.isTabFocused = false;
    });
  }

  // Request notification permission
  async requestPermission() {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  }

  // Check if notifications are allowed
  isPermissionGranted() {
    return Notification.permission === "granted";
  }

  // Show notification (only if tab is not focused)
  show(title, options = {}) {
    // Only show if tab is not focused and permission is granted
    if (this.isTabFocused) {
      console.log("Tab is focused, skipping browser notification");
      return null;
    }

    if (!this.isPermissionGranted()) {
      console.log(
        "Notification permission not granted:",
        Notification.permission,
      );
      return null;
    }

    const defaultOptions = {
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: "chat-notification",
      renotify: true,
      requireInteraction: false,
      silent: false,
    };

    try {
      const notification = new Notification(title, {
        ...defaultOptions,
        ...options,
      });

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      console.log("Browser notification shown:", title);
      return notification;
    } catch (err) {
      console.error("Failed to show notification:", err);
      return null;
    }
  }

  // Show chat message notification
  showMessageNotification(senderName, message, chatType, chatId, onClick) {
    const notification = this.show(`New message from ${senderName}`, {
      body: message.length > 100 ? message.substring(0, 100) + "..." : message,
      tag: `chat-${chatType}-${chatId}`,
      data: { chatType, chatId },
    });

    if (notification && onClick) {
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        onClick(chatType, chatId);
        notification.close();
      };
    }

    return notification;
  }

  // Show generic notification
  showNotification(title, body, onClick) {
    const notification = this.show(title, {
      body,
      tag: `notification-${Date.now()}`,
    });

    if (notification && onClick) {
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        onClick();
        notification.close();
      };
    }

    return notification;
  }
}

// Export singleton instance
export const browserNotifications = new BrowserNotificationService();

// Export permission request function for use in components
export async function requestNotificationPermission() {
  return await browserNotifications.requestPermission();
}
