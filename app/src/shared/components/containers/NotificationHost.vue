<template>
  <!--
    NotificationHost — phase-2.1 placeholder.
    Renders the cross-view notification stack defined in PRD §2.4 #9. Real
    styling, lifecycle, and dismiss behaviour land in 2.2; for now the host
    just enumerates the queue so the wiring is visible.
  -->
  <view
    class="notification-host"
    role="region"
    aria-label="通知"
    aria-live="polite"
  >
    <view
      v-for="n in notificationStore.notifications"
      :key="n.id"
      class="notification-host__item"
      :class="`notification-host__item--${n.level ?? 'info'}`"
      role="status"
    >
      <text class="notification-host__message">{{ n.message }}</text>
      <view
        class="notification-host__dismiss"
        role="button"
        tabindex="0"
        aria-label="关闭通知"
        @click="notificationStore.dismiss(n.id)"
        @keydown.enter="notificationStore.dismiss(n.id)"
        @keydown.space.prevent="notificationStore.dismiss(n.id)"
      >×</view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * Name: NotificationHost
 * Purpose: subscribe to the notification store and render the queue at the
 *          page root, above all views.
 * Reason: PRD §2.4 #9 mandates a cross-view error overlay. Mounting this
 *         host once on the main page (and, after 2.2, the fallback page)
 *         keeps notifications visible regardless of which view is active.
 * Data flow: producers call `useNotificationStore().push()`; this host
 *           reads `notifications` reactively and calls `dismiss(id)` from
 *           the placeholder close affordance.
 */
import { useNotificationStore } from '../../store/notification'

const notificationStore = useNotificationStore()
</script>

<style scoped>
.notification-host {
  position: fixed;
  top: env(safe-area-inset-top, 0px);
  left: 0;
  right: 0;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx;
  pointer-events: none;
}

.notification-host__item {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 24rpx;
  border-radius: 12rpx;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  font-size: 24rpx;
  color: var(--color-text-primary);
}

.notification-host__dismiss {
  font-size: 28rpx;
  color: var(--color-text-tertiary);
  cursor: pointer;
}
</style>
