<template>
  <view class="container">
    <!-- Welcome Page Mockup (Non-interactive) -->
    <view class="welcome-mock">
      <view class="header">
        <view class="header-inner">
          <view class="menu-icon">
            <view class="bar w-full"></view>
            <view class="bar w-half"></view>
            <view class="bar w-full"></view>
          </view>
          <view class="top-logo">智护AI</view>
        </view>
      </view>

      <view class="hero">
        <view class="h1">Hi, 我是智护AI~</view>
        <view class="p">随时为您解答安全生产标准与规范</view>
      </view>

      <view class="section-title">你可以这样问我</view>
      <view class="suggestions">
        <view class="card">
          <text class="card-title">安全帽使用年限标准是多少？</text>
          <AppIcon name="chevron_right" size="32" color="#d1d5db" />
        </view>
        <view class="card">
          <text class="card-title">KN95口罩的国家标准号是什么？</text>
          <AppIcon name="chevron_right" size="32" color="#d1d5db" />
        </view>
        <view class="card">
          <text class="card-title">如何选择高处作业用的安全带？</text>
          <AppIcon name="chevron_right" size="32" color="#d1d5db" />
        </view>
      </view>

      <view class="input-bar-mock">
        <view class="input-bar">
          <text class="placeholder">有问题，尽管问我...</text>
          <view class="right-actions">
            <view class="send-btn">
              <AppIcon class="send-icon" name="send" size="48" color="#d1d5db" fill />
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
import { login, initInterceptors } from '@/services/apiService';

const agree = async () => {
  // 初始化请求拦截器
  initInterceptors();

  // 调用微信登录，获取 token
  const result = await login();

  if (result.success) {
    uni.setStorageSync('has_agreed', 'true');
    uni.reLaunch({
      url: '/pages/welcome/index'
    });
  } else {
    uni.showToast({
      title: result.error || '登录失败',
      icon: 'none'
    });
  }
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
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  position: relative;
  overflow: hidden;
}

/* Welcome Mock Overlay Styles */
.welcome-mock {
  opacity: 0.6; /* Slightly fade the background content */
  filter: blur(2px); /* Blur for better focus on modal */
  display: flex;
  flex-direction: column;
  flex: 1;
}

.header {
  padding: 80rpx 32rpx 20rpx;
  display: flex;
  flex-direction: column;
}
.header-inner {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  width: 100%;
  height: 44px;
}
.menu-icon {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 54rpx;
  height: 36rpx;
  position: absolute;
  left: 0;
}
.bar {
  height: 7rpx;
  background-color: #334155;
  border-radius: 7rpx;
}
.w-full { width: 100%; }
.w-half { width: 60%; }
.top-logo { 
  font-size: 34rpx; 
  font-weight: 700; 
  color: #0f172a; 
}

.hero {
  padding: 60rpx 48rpx 32rpx;
  text-align: center;
  margin-top: 120rpx;
}
.h1 {
  font-size: 56rpx;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 20rpx;
  letter-spacing: -2rpx;
  line-height: 1.1;
}
.hero .p {
  color: #64748b;
  font-size: 30rpx;
  margin-bottom: 40rpx;
}

.section-title {
  font-size: 22rpx;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 4rpx;
  margin: 16rpx 48rpx 10rpx;
  font-weight: 700;
}

.suggestions {
  padding: 0 48rpx;
}
.card {
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 20rpx;
  padding: 24rpx 32rpx;
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
}
.card-title {
  flex: 1;
  font-size: 26rpx;
  font-weight: 500;
  color: #334155;
}

.input-bar-mock {
  padding: 20rpx 32rpx env(safe-area-inset-bottom);
  margin-top: auto;
}
.input-bar {
  background-color: #fff;
  height: 100rpx;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  border: 1rpx solid rgba(0,0,0,0.01);
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.08);
}
.placeholder {
  flex: 1;
  color: #94a3b8;
  font-size: 30rpx;
  margin-left: 16rpx;
}
.send-btn {
  background-color: #f1f5f9;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.send-btn .send-icon {
  transform: rotate(-45deg);
  margin-left: 4rpx;
  margin-top: -4rpx;
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
