<template>
  <view class="container">
    <view class="header">
      <AppIcon name="chevron_left" size="44" @click="back" />
      <text class="title">用户授权许可协议</text>
    </view>

    <scroll-view class="content" scroll-y>
      <view class="doc-body">
        <text class="p-bold">更新日期：2026年4月21日</text>
        <text class="p-bold">生效日期：2026年4月21日</text>
        
        <text class="section-title">1. 服务内容与授权</text>
        <text class="p">智护AI智能助手为您提供安全生产标准与规范查询服务。通过本协议，您授权我们使用您的输入内容（包括文本、语音等）来生成AI解答。</text>
        <text class="p">为了保障服务安全与质量，我们会收集设备基本信息、登录记录、网络状态等数据。</text>

        <text class="section-title">2. 我们如何存储这些信息</text>
        <text class="p">我们会在法律法规要求的期限内保留您的个人信息。您的个人信息将存储在中华人民共和国境内。</text>

        <text class="section-title">3. 信息安全</text>
        <text class="p">我们努力为用户的信息安全提供保障，以防止信息的丢失、不当使用、未经授权阅览或披露。我们将在合理的安全水平内使用各种安全保护措施以保障信息的安全。</text>

        <text class="section-title">4. 权利与义务</text>
        <text class="p">在使用智护AI服务期间，您应当遵守相关法律法规，不得利用本服务制作、复制、发布、传播违法不良信息。您可以随时访问或停止使用本服务。</text>

        <text class="section-title">5. 未成年人保护</text>
        <text class="p">我们建议：任何未成年人参加网上活动应事先取得家长或其法定监护人的同意。</text>

        <text class="section-title">6. 其他</text>
        <text class="p">如果您对本协议有任何疑问或投诉、建议，请通过官方客服通道联系我们。</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
const back = () => uni.navigateBack();
</script>

<style>
.container { display: flex; flex-direction: column; height: 100vh; background-color: #fff; }
.header { 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  padding-top: calc(60rpx + env(safe-area-inset-top));
  padding-left: 40rpx;
  padding-right: 40rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.icon { font-family: 'Material Symbols Outlined'; font-size: 44rpx; }
.title { font-size: 34rpx; font-weight: bold; }

.content { flex: 1; padding: 40rpx; }
.doc-body { padding-bottom: 80rpx; }
.p-bold { display: block; font-weight: bold; font-size: 28rpx; margin-bottom: 20rpx; color: #333; }
.section-title { display: block; font-size: 32rpx; font-weight: bold; margin: 40rpx 0 20rpx; color: #1a1a1a; }
.p { display: block; font-size: 28rpx; color: #666; line-height: 1.8; margin-bottom: 24rpx; text-align: justify; }
</style>
