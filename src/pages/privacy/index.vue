<template>
  <view class="container">
    <!-- Welcome Page Mockup (Non-interactive) -->
    <view class="welcome-mock">
      <view class="header">
        <view class="menu-icon">
          <view class="bar w-full"></view>
          <view class="bar w-half"></view>
          <view class="bar w-full"></view>
        </view>
      </view>

      <view class="hero">
        <view class="h1">Hi, 我是智护AI~</view>
        <view class="p">随时为您解答安全生产标准与规范</view>
        
        <view class="categories">
          <view class="cat-chip">安全帽</view>
          <view class="cat-chip">口罩/呼吸</view>
          <view class="cat-chip">安全带/挂钩</view>
        </view>
      </view>

      <view class="section-title">你可以这样问我</view>
      <view class="suggestions">
        <view class="card">
          <text class="card-title">安全帽使用年限标准是多少？</text>
          <text class="icon arrow">chevron_right</text>
        </view>
        <view class="card">
          <text class="card-title">KN95口罩的国家标准号是什么？</text>
          <text class="icon arrow">chevron_right</text>
        </view>
      </view>

      <view class="input-bar-mock">
        <view class="input-bar">
          <AppIcon name="mic" size="36" color="#9ca3af" />
          <text class="placeholder">有问题，尽管问我...</text>
          <view class="right-actions">
            <AppIcon name="add_circle" size="36" color="#9ca3af" />
            <view class="send-btn">
              <AppIcon name="send" size="36" color="#fff" fill />
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- Privacy Sheet Overlay -->
    <view class="modal-overlay"></view>
    <view class="privacy-sheet">
      <view class="sheet-content">
        <view class="modal-title">用户授权许可提示</view>
        <view class="modal-body">
          <view class="p-text">在你使用 智护AI 智能助手 服务之前，请仔细阅读</view>
          <view class="link" @click="goPolicy">《智护AI 智能助手用户授权许可协议》</view>
          <view class="p-text">如你同意该协议，请点击 “同意” 开始使用本小程序。</view>
        </view>
        
        <view class="modal-actions">
          <button class="btn-secondary" @click="reject">拒绝</button>
          <button class="btn-success" @click="agree">同意</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

const agree = () => {
  uni.setStorageSync('has_agreed', 'true');
  uni.reLaunch({
    url: '/pages/welcome/index'
  });
};

const goPolicy = () => {
  uni.navigateTo({
    url: '/pages/privacy/policy'
  });
};

const reject = () => {
  uni.showModal({
    title: '需要授权',
    content: '智护AI 需要您的授权同意《用户授权许可协议》方可为您提供智能安全咨询服务。',
    confirmText: '重新阅读',
    showCancel: true,
    cancelText: '退出',
    success: (res) => {
      if (res.cancel) {
        // Guard the call to prevent "is not a function" error in non-mini-program environments
        if (typeof uni.exitMiniProgram === 'function') {
          uni.exitMiniProgram({
            success: () => {
              console.log('Exit success');
            },
            fail: () => {
              uni.showToast({ title: '请手动关闭页面', icon: 'none' });
            }
          });
        } else {
          // Fallback UI for web preview
          uni.showToast({ title: '非小程序环境，请手动关闭', icon: 'none' });
        }
      }
    }
  });
};
</script>

<style>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(180deg, #f0f4f9 0%, #f6f6f6 100%);
  position: relative;
  overflow: hidden;
}

/* Welcome Mock Overlay Styles */
.welcome-mock {
  opacity: 0.6; /* Slightly fade the background content */
  filter: blur(2px); /* Blur for better focus on modal */
}

.header {
  padding-top: calc(60rpx + env(safe-area-inset-top));
  padding-left: 40rpx;
  padding-right: 40rpx;
  padding-bottom: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.menu-icon {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  width: 44rpx;
  padding: 20rpx 0;
}
.bar {
  height: 3rpx;
  background-color: #4b5563;
  border-radius: 4rpx;
}
.w-full { width: 100%; }
.w-half { width: 60%; }
.icon {
  font-family: 'Material Symbols Outlined';
  font-size: 36rpx;
  color: #6b7280;
}
.fill { font-variation-settings: 'FILL' 1; }

.hero {
  padding: 60rpx 40rpx 40rpx;
  text-align: center;
}
.h1 {
  font-size: 52rpx;
  font-weight: 800;
  color: #1a1a1a;
  margin-bottom: 16rpx;
  letter-spacing: -1rpx;
}
.p {
  color: #666;
  font-size: 28rpx;
  margin-bottom: 40rpx;
  opacity: 0.8;
}
.categories {
  display: flex;
  justify-content: center;
  gap: 20rpx;
  flex-wrap: wrap;
}
.cat-chip {
  background-color: #fff;
  border: 1rpx solid #e5e7eb;
  padding: 12rpx 32rpx;
  border-radius: 100rpx;
  font-size: 24rpx;
  color: #4b5563;
}

.section-title {
  font-size: 24rpx;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  margin: 20rpx 40rpx 10rpx;
  font-weight: 600;
}

.suggestions {
  padding: 0 40rpx;
}
.card {
  background-color: #fff;
  border-radius: 28rpx;
  padding: 32rpx 40rpx;
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1rpx solid rgba(0,0,0,0.02);
}
.card-title {
  flex: 1;
  font-size: 28rpx;
  font-weight: 500;
  color: #374151;
}
.arrow {
  font-size: 32rpx;
  color: #d1d5db;
}

.input-bar-mock {
  padding: 40rpx 40rpx;
}
.input-bar {
  background-color: #fff;
  height: 108rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  border: 1rpx solid #e5e7eb;
}
.text-gray { color: #9ca3af; }
.placeholder {
  flex: 1;
  color: #9ca3af;
  font-size: 28rpx;
  margin-left: 20rpx;
}
.right-actions {
  display: flex;
  align-items: center;
}
.send-btn {
  background-color: #f3f4f6;
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.white { color: #fff; }

/* Privacy Sheet Styles */
.modal-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0,0,0,0.3);
  z-index: 100;
}

.privacy-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #fff;
  border-radius: 64rpx 64rpx 0 0;
  padding: 80rpx 50rpx calc(60rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -10rpx 40rpx rgba(0,0,0,0.1);
  z-index: 101;
}

.sheet-content {
  display: flex;
  flex-direction: column;
}

.modal-title {
  font-size: 44rpx;
  font-weight: bold;
  color: #1a1a1a;
  margin-bottom: 24rpx;
}

.modal-body {
  margin-bottom: 60rpx;
}

.p-text {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
  margin-bottom: 8rpx;
}

.link {
  color: #007AFF;
  text-decoration: underline;
  margin-bottom: 24rpx;
  font-size: 28rpx;
  font-weight: 500;
}

.modal-actions {
  display: flex;
  gap: 30rpx;
}

.btn-secondary {
  flex: 1;
  background-color: #F2F2F2;
  color: #000;
  border-radius: 20rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 32rpx;
  border: none;
}

.btn-success {
  flex: 1;
  background-color: #07C160;
  color: #fff;
  border-radius: 20rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 32rpx;
  border: none;
}
</style>
