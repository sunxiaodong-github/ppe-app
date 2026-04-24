<template>
  <view class="container">
    <view class="header">
      <view class="left-actions">
        <AppIcon name="chevron_left" size="44" color="#4b5563" @click="back" />
      </view>
      <view class="header-title">历史会话</view>
      <view class="right-actions">
        <text 
          class="reset-btn"
          @click="resetAgreement"
        >重置</text>
      </view>
    </view>

    <!-- List -->
    <scroll-view v-if="items.length > 0" class="list" scroll-y>
      <view 
        v-for="(item, index) in items" 
        :key="item.id"
        class="item"
        hover-class="item-active"
        @touchstart="startPress(index)"
        @touchend="endPress"
        @touchmove="endPress"
        @mousedown="startPress(index)"
        @mouseup="endPress"
        @mouseleave="endPress"
        @click="navDetail(item)"
        @contextmenu.prevent
      >
        <view class="item-left">
          <AppIcon name="chat" size="40" color="#1a73e8" />
          <text class="item-title">{{ item.title }}</text>
        </view>
        <AppIcon name="chevron_right" size="32" color="#ccc" />
      </view>
    </scroll-view>

    <!-- Empty State -->
    <view v-else class="empty-list">
      <AppIcon name="history" size="140" color="#e5e7eb" />
      <text class="empty-text">暂无历史记录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const items = ref<any[]>([]);

onMounted(() => {
  loadHistory();
});

const loadHistory = () => {
  const history = uni.getStorageSync('chat_history') || [];
  items.value = history;
};

const back = () => uni.navigateBack();

const resetAgreement = () => {
  uni.removeStorageSync('has_agreed');
  uni.reLaunch({ url: '/pages/privacy/index' });
};

const confirmClearAll = () => {
  uni.showModal({
    title: '提示',
    content: '确定要清除所有聊天记录吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('chat_history');
        items.value = [];
      }
    }
  });
};

let pressTimer: any = null;
let isLongPress = false;

const startPress = (index: number) => {
  isLongPress = false;
  pressTimer = setTimeout(() => {
    isLongPress = true;
    onLongPress(index);
  }, 600);
};

const endPress = () => {
  clearTimeout(pressTimer);
};

const navDetail = (item: any) => {
  if (isLongPress) return;
  uni.reLaunch({
    url: `/pages/welcome/index?sessionId=${item.id}`
  });
};

const onLongPress = (index: number) => {
  uni.showModal({
    title: '删除会话',
    content: '删除后无法恢复，确定要删除吗？',
    confirmText: '删除',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        confirmDelete(index);
      }
    }
  });
};

const confirmDelete = (index: number) => {
  items.value.splice(index, 1);
  uni.setStorageSync('chat_history', items.value);
};
</script>

<style>
.container { display: flex; flex-direction: column; height: 100vh; background-color: #f8f9fa; }
.header { 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  padding-top: calc(var(--status-bar-height) + env(safe-area-inset-top) + 160rpx);
  padding-left: 48rpx;
  padding-right: 48rpx;
  padding-bottom: 30rpx;
  background-color: transparent;
  position: relative;
  height: 60rpx;
}
.left-actions { 
  display: flex; 
  align-items: center; 
  position: absolute;
  left: 48rpx;
  height: 60rpx;
}
.header-title { 
  font-size: 34rpx; 
  font-weight: 700; 
  color: #0f172a; 
  letter-spacing: -0.5rpx;
  white-space: nowrap;
  text-align: center;
}
.right-actions {
  position: absolute;
  right: 48rpx;
  display: flex;
  align-items: center;
  height: 60rpx;
}
.reset-btn { font-size: 24rpx; color: #94a3b8; text-decoration: none; border: 1rpx solid #e2e8f0; padding: 4rpx 16rpx; border-radius: 20rpx; }
.clear-all { font-size: 24rpx; color: #999; }

.list { flex: 1; padding: 80rpx 30rpx 24rpx; }
.item {
  background: #fff;
  border-radius: 32rpx;
  padding: 40rpx 36rpx;
  margin-bottom: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 6rpx 20rpx rgba(0,0,0,0.05);
  transition: all 0.15s ease;
}
.item-active { transform: scale(0.98); background-color: #fafafa; }
.item-left { display: flex; align-items: center; gap: 24rpx; flex: 1; overflow: hidden; }
.item-title { font-size: 32rpx; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.empty-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 30rpx;
}
.empty-text { font-size: 32rpx; color: #ccc; }
</style>
