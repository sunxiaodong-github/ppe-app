<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
onLaunch(() => {
  console.log("App Launch");
  
  // Robust check for agreement on every launch
  const hasAgreed = uni.getStorageSync('has_agreed');
  
  // In Mini Program, redirect logic in onLaunch needs careful timing
  if (!hasAgreed) {
    // Check if current page is already privacy (could happen on direct link)
    setTimeout(() => {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      if (currentPage && !currentPage.route?.includes('pages/privacy/index')) {
        uni.reLaunch({ url: '/pages/privacy/index' });
      } else if (!currentPage) {
        // Fallback for very early triggers
        uni.reLaunch({ url: '/pages/privacy/index' });
      }
    }, 100);
  }
});
onShow(() => {
  console.log("App Show");
  // Double check agreement state when app returns or refreshes
  const hasAgreed = uni.getStorageSync('has_agreed');
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  
  if (!hasAgreed && currentPage && currentPage.route && !currentPage.route.includes('privacy/index')) {
    uni.reLaunch({ url: '/pages/privacy/index' });
  }
});
onHide(() => {
  console.log("App Hide");
});
</script>

<style>
/* Global styles are handled in index.css */
</style>
