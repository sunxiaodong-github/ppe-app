<template>
  <view class="container">
    <view class="header" :style="{ paddingTop: customBarTop }">
      <view class="header-inner" :style="{ height: customBarHeight }">
        <view class="left-actions">
          <AppIcon name="chevron_left" size="56" color="#4b5563" @click="back" />
        </view>
        <view class="header-title">历史会话</view>
        <view class="right-actions">
          <text 
            class="reset-btn"
            @click="resetAgreement"
          >重置</text>
        </view>
      </view>
    </view>

    <!-- List -->
    <scroll-view
      v-if="items.length > 0"
      class="list"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      :lower-threshold="100"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <view
        v-for="(item, index) in items"
        :key="item.sessionId"
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

      <!-- Loading More -->
      <view v-if="loadingMore" class="loading-more">
        <text>加载中...</text>
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
import { getSessions, deleteSession as deleteSessionApi, type SessionItem } from '@/services/sessionService';

const items = ref<SessionItem[]>([]);
const refreshing = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const hasMore = ref(true);
const pageSize = 20;

// 当前会话 ID（从 welcome 页面传递或从 storage 获取）
const currentSessionId = ref<string | null>(null);

// Status bar and capsule alignment
const customBarTop = ref('80rpx');
const customBarHeight = ref('44px');

onMounted(() => {
  loadHistory();

  // 获取当前会话 ID（用于判断删除的是否是当前会话）
  currentSessionId.value = uni.getStorageSync('currentSessionId') || null;
  console.log('[History] Current session ID:', currentSessionId.value);

  // Calculate capsule position for precise alignment
  const sysInfo = uni.getSystemInfoSync();
  const statusBarHeight = sysInfo.statusBarHeight || 20;

  let top = statusBarHeight + 7;
  let height = 32;

  // #ifdef MP-WECHAT
  try {
    const menuButtonInfo = uni.getMenuButtonBoundingClientRect();
    if (menuButtonInfo && menuButtonInfo.top) {
      top = menuButtonInfo.top;
      height = menuButtonInfo.height;
    }
  } catch (e) {
    // Keep defaults
  }
  // #endif

  customBarTop.value = top + 'px';
  customBarHeight.value = height + 'px';
});

const loadHistory = async (reset = false) => {
  try {
    const page = reset ? 1 : currentPage.value;
    const data = await getSessions({ page, pageSize });
    const newItems = data.items || [];

    if (reset) {
      items.value = newItems;
      currentPage.value = 1;
    } else {
      items.value.push(...newItems);
    }

    hasMore.value = newItems.length >= pageSize;
  } catch (err) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
};

const onRefresh = async () => {
  refreshing.value = true;
  currentPage.value = 1;
  await loadHistory(true);
  refreshing.value = false;
};

const onLoadMore = async () => {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  currentPage.value++;
  await loadHistory(false);
  loadingMore.value = false;
};

const back = () => {
  // 返回时判断：如果当前会话存在且未被删除，返回该会话；否则回首页
  const currentId = uni.getStorageSync('currentSessionId');
  if (currentId) {
    // 检查当前会话是否还在列表中
    const stillExists = items.value.some(item => item.sessionId === currentId);
    if (stillExists) {
      uni.reLaunch({ url: `/pages/welcome/index?sessionId=${currentId}` });
      return;
    }
  }
  // 当前会话不存在，回首页
  uni.reLaunch({ url: '/pages/welcome/index' });
};

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

const navDetail = (item: SessionItem) => {
  if (isLongPress) return;
  uni.reLaunch({
    url: `/pages/welcome/index?sessionId=${item.sessionId}`
  });
};

const onLongPress = (index: number) => {
  console.log('[History] Long press detected at index:', index);
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

const confirmDelete = async (index: number) => {
  const item = items.value[index];
  if (!item) return;

  console.log('[History] Deleting session:', item.sessionId);

  try {
    await deleteSessionApi(item.sessionId);
    console.log('[History] Delete success');
    items.value.splice(index, 1);
    // 删除后不跳转，只更新列表，返回时再判断
  } catch (err: any) {
    console.log('[History] Delete error:', err);
    uni.showToast({ title: err?.message || '删除失败', icon: 'none' });
  }
};
</script>

<style>
.container { display: flex; flex-direction: column; height: 100vh; background-color: #f8f9fa; }
.header { 
  display: flex; 
  flex-direction: column;
  padding-left: 32rpx;
  padding-right: 32rpx;
  padding-bottom: 20rpx;
  background-color: transparent;
  position: relative;
}
.header-inner {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  width: 100%;
}
.left-actions { 
  display: flex; 
  align-items: center; 
  position: absolute;
  left: 0;
  height: 100%;
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
  right: 0;
  display: flex;
  align-items: center;
  height: 100%;
}
.reset-btn { font-size: 24rpx; color: #94a3b8; text-decoration: none; border: 1rpx solid #e2e8f0; padding: 4rpx 16rpx; border-radius: 20rpx; }
.clear-all { font-size: 24rpx; color: #999; }

.list { flex: 1; padding: 40rpx 30rpx 24rpx; }
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
.loading-more { padding: 30rpx; text-align: center; font-size: 24rpx; color: #999; }
</style>
