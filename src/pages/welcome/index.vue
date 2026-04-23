<template>
  <view class="container">
    <!-- Header -->
    <view class="header">
      <view class="left-actions">
        <view class="menu-icon" @click="goHistory">
          <view class="bar w-full"></view>
          <view class="bar w-half"></view>
          <view class="bar w-full"></view>
        </view>
        <!-- New Chat Button - Only visible when there's history -->
        <AppIcon 
          v-if="messages.length > 0" 
          name="add_comment" 
          size="44" 
          color="#4b5563"
          @click="resetChat" 
        />
      </view>
      <view class="top-logo">{{ pageTitle }}</view>
      <view class="placeholder-box"></view>
    </view>

    <!-- Empty State -->
    <view v-show="messages.length === 0" class="empty-state">
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
      <scroll-view class="suggestions" scroll-y>
        <view 
          v-for="(q, index) in exampleQuestions" 
          :key="index" 
          class="card" 
          @click="sendPreset(q)"
        >
          <text class="card-title">{{ q }}</text>
          <AppIcon name="chevron_right" size="32" color="#d1d5db" />
        </view>
      </scroll-view>
    </view>

    <!-- Chat List -->
    <scroll-view 
      v-show="messages.length > 0" 
      class="chat-content" 
      scroll-y 
      :scroll-top="chatScrollTop"
      :scroll-with-animation="true"
    >
      <view v-for="(msg, index) in messages" :key="index" class="msg-item">
        <!-- User Question -->
        <view v-if="msg.role === 'user'" class="user-msg-row">
          <view class="user-msg">
            <text>{{ msg.content }}</text>
          </view>
        </view>

        <!-- AI Answer -->
        <view v-else class="ai-msg-row">
          <view class="avatar">
            <AppIcon name="security" size="52" color="#1a73e8" fill />
          </view>
          <view class="ai-content-box">
            <view class="ai-msg">
              <view class="rich-text">
                <view class="markdown-body" v-if="!msg.showRaw" v-html="renderMarkdown(msg.content)"></view>
                <view class="raw-content-view" v-else>
                  <text selectable class="raw-text-content">{{ msg.content }}</text>
                </view>
                
                <!-- Sources Section: GPT Style Cards -->
                <view v-if="getDetailedSources(msg.content).length > 0 && !msg.showRaw" class="sources-footer">
                  <view class="sources-list">
                    <view 
                      v-for="source in getDetailedSources(msg.content)" 
                      :key="source.id" 
                      class="source-pill"
                    >
                      <AppIcon name="policy" size="24" color="#94a3b8" />
                      <view class="pill-id">{{ source.id }}</view>
                      <text class="pill-name">{{ source.name }}</text>
                    </view>
                  </view>
                </view>

                <!-- Searching status -->
                <view v-if="isStreaming && index === messages.length - 1" class="searching-status">
                  <view class="search-icon-box">
                    <AppIcon name="search" size="24" color="#1a73e8" />
                  </view>
                  <text class="search-text">正在标准问答库查找资料</text>
                  <view class="loading-dots">
                    <view class="dot"></view>
                    <view class="dot"></view>
                    <view class="dot"></view>
                  </view>
                </view>
              </view>
              
              <view v-if="!isStreaming || index < messages.length - 1" class="interact-bar">
                <view class="interact-btn" @click="msg.showRaw = !msg.showRaw">
                  <AppIcon :name="msg.showRaw ? 'visibility' : 'code'" size="32" :color="msg.showRaw ? '#1a73e8' : '#666'" />
                  <text class="btn-txt">{{ msg.showRaw ? '视图' : '原文' }}</text>
                </view>
                <view 
                  class="interact-btn" 
                  :class="{ active: msg.interaction === 'liked' }"
                  @click="toggleLike(index)"
                >
                  <AppIcon name="thumb_up" size="32" :fill="msg.interaction === 'liked'" />
                  <text class="btn-txt">赞同</text>
                </view>
                <view 
                  class="interact-btn"
                  :class="{ active: msg.interaction === 'feedbacked' }"
                  @click="goFeedback(index)"
                >
                  <AppIcon name="thumb_down" size="32" :fill="msg.interaction === 'feedbacked'" />
                  <text class="btn-txt">反馈</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view class="scroll-anchor"></view>
    </scroll-view>

    <!-- Input Bar -->
    <view class="input-bar-container" :style="{ paddingBottom: keyboardHeight > 0 ? (keyboardHeight + 10) + 'px' : 'calc(40rpx + env(safe-area-inset-bottom))' }">
      <view class="input-bar">
        <input 
          v-model="inputValue"
          class="flex-1 px-2 text-input"
          :placeholder="messages.length === 0 ? '有问题，尽管问我...' : '我也想问...'"
          confirm-type="send"
          :cursor-spacing="20"
          :adjust-position="false"
          :disabled="isStreaming"
          @confirm="handleSend"
          @keyboardheightchange="onKeyboardHeightChange"
        />
        <view class="right-actions">
          <view 
            class="send-btn"
            :class="{ 
              'btn-active': inputValue.trim() && !isStreaming,
              'btn-loading': isStreaming
            }"
            @click="handleSend"
          >
            <AppIcon 
              name="send" 
              size="40" 
              :color="(inputValue.trim() || isStreaming) ? '#fff' : '#d1d5db'" 
              fill 
            />
          </view>
        </view>
      </view>
    </view>

    <!-- Reverted Feedback Modal -->
    <view v-if="showFeedbackModal" class="modal-overlay" @click="closeFeedback">
      <view class="modal-card animate-pop" @click.stop>
        <view class="modal-head">
          <text class="modal-title">帮助我们改进</text>
          <view class="close-hit" @click="closeFeedback">
            <AppIcon name="close" size="36" color="#999" />
          </view>
        </view>
        
        <view class="modal-body">
          <textarea
            v-model="feedbackText"
            placeholder="请描述您遇到的问题或改进建议..."
            class="feedback-area"
            :fixed="true"
            :cursor-spacing="140"
          ></textarea>
        </view>

        <view class="modal-foot">
          <button 
            class="submit-btn" 
            :class="{ active: feedbackText.trim() }"
            :disabled="!feedbackText.trim()"
            @click="submitFeedback"
          >
            提交反馈
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

// aiService.ts needs to be correctly imported
import { chatStream, type ChatMessage } from '@/services/aiService';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true // Convert '\n' in paragraphs into <br>
});

const inputValue = ref('');
const chatScrollTop = ref(0);
const isStreaming = ref(false);
const isMounted = ref(false);
const keyboardHeight = ref(0);

const onKeyboardHeightChange = (e: any) => {
  keyboardHeight.value = e.detail.height;
  if (e.detail.height > 0) {
    scrollToBottom(true);
  }
};
const messages = ref<any[]>([]);

const pageTitle = computed(() => {
  if (messages.value.length === 0) return '智护AI';
  const firstUserMsg = messages.value.find(m => m.role === 'user');
  if (!firstUserMsg) return '智护AI';
  const content = firstUserMsg.content || '';
  if (content.length <= 12) return content;
  return content.substring(0, 12) + '...';
});

// Use a throttled version for scrolling
let lastScrollTime = 0;
const scrollToBottom = (force = false) => {
  if (!isMounted.value || messages.value.length === 0) return;
  const now = Date.now();
  if (!force && now - lastScrollTime < 150) return;
  lastScrollTime = now;
  
  // Use a slightly longer delay to ensure the scroll-view is visible and initialized
  setTimeout(() => {
    if (isMounted.value && messages.value.length > 0) {
      // Small random added to force the change detection even if value is same
      chatScrollTop.value = 9999 + Math.random();
    }
  }, 200);
};

// Citation Tokens from Documentation
const CITATION_START = '\uE200';
const CITATION_DELIMITER = '\uE202';
const CITATION_STOP = '\uE201';

const renderMarkdown = (content: string) => {
  if (!content) return '';
  
  // 1. Split body content from the citation list more reliably
  const separators = ['参考资料', '参考来源', 'Sources', 'References'];
  let displayBody = content;
  
  // High priority: Footnote definitions [^1]:
  const footnoteIndex = content.search(/\n\[\^(\d+)\]:/);
  
  // Find the earliest occurrence of any separator
  let sepIndex = -1;
  for (const sep of separators) {
    const index = content.lastIndexOf(sep);
    if (index !== -1 && (sepIndex === -1 || index < sepIndex)) {
      sepIndex = index;
    }
  }

  // Decision logic for splitting
  if (footnoteIndex !== -1) {
    displayBody = content.substring(0, footnoteIndex);
  } else if (sepIndex !== -1) {
    displayBody = content.substring(0, sepIndex);
  } else {
    // Falls back to numbered lists at the bottom
    const listMatch = content.match(/\n[\[\(【]?1[\]\)】†]?[:：\.\s]/);
    if (listMatch && listMatch.index !== undefined && listMatch.index > content.length * 0.6) {
      displayBody = content.substring(0, listMatch.index);
    }
  }

  // 2. Identify and style citations: Handle Unicode Tokens AND Standard Markdown
  
  // 2a. DOC standards (Unicode tokens): \uE200cite\uE202source_id(\uE202locator)?\uE201
  const docCitationRegex = new RegExp(`${CITATION_START}cite${CITATION_DELIMITER}([\\s\\S]*?)${CITATION_STOP}`, 'g');
  let processedContent = displayBody.replace(docCitationRegex, (match, body) => {
    const parts = body.split(CITATION_DELIMITER);
    const sourceIdMatch = parts[0].match(/(\d+)/);
    const displayId = sourceIdMatch ? sourceIdMatch[1] : 'i';
    return `<span class="citation-tag">${displayId}</span>`;
  });

  // 2b. Standard fallback citations: [1], [^1^], 【1】, [^1]
  processedContent = processedContent
    .replace(/\[\^?(\d+)\^?\]/g, '<span class="citation-tag">$1</span>')
    .replace(/\[(\d+)\]/g, '<span class="citation-tag">$1</span>')
    .replace(/【(\d+)[†:]?[^】]*】/g, '<span class="citation-tag">$1</span>');
  
  return md.render(processedContent);
};

// Helper to extract and parse actual source names
interface SourceInfo {
  id: string;
  name: string;
}

// Clean markdown links from text [text](url) -> text
const stripMarkdownLinks = (text: string) => {
  return text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
};

const getDetailedSources = (content: string): SourceInfo[] => {
  if (!content) return [];
  
  const separators = ['参考资料', '参考来源', 'Sources', 'References'];
  let sourceText = '';
  
  // Try to find the start of the source section
  const footnoteMatch = content.match(/\n\[\^(\d+)\]:/);
  let splitIndex = -1;
  
  for (const sep of separators) {
    const index = content.lastIndexOf(sep);
    if (index !== -1 && (splitIndex === -1 || index > splitIndex)) {
      splitIndex = index + sep.length;
    }
  }

  if (footnoteMatch && footnoteMatch.index !== undefined) {
    // Footnotes are the strongest signal
    sourceText = content.substring(footnoteMatch.index);
  } else if (splitIndex !== -1) {
    sourceText = content.substring(splitIndex);
  } else {
    // Fallback search only at the bottom part
    const listMatch = content.match(/\n(([\[\(【]?1[\]\)】†]?[:：\.\s]).*)/s);
    if (listMatch && listMatch.index !== undefined && listMatch.index > content.length * 0.6) {
      sourceText = listMatch[1];
    }
  }

  if (!sourceText) return [];

  const lines = sourceText.split('\n')
    .map(l => l.trim())
    .filter(l => l && !separators.some(s => l.toLowerCase().includes(s.toLowerCase())));
    
  const sources: SourceInfo[] = [];
  lines.forEach(line => {
    // Matches patterns like [^1]: content or [1] content
    const match = line.match(/^([\[\(【]?\^?(\d+)[\]\)】†]*[:：\.\s]*)(.*)/);
    if (match) {
      const id = match[2];
      let rawName = match[3].trim();
      
      // Secondary cleaning for standard names wrapped in brackets: [GB 12345] -> GB 12345
      if (rawName.startsWith('[') && rawName.includes(']')) {
        const bracketMatch = rawName.match(/^\[([^\]]+)\]/);
        if (bracketMatch) {
          rawName = bracketMatch[1];
        }
      }
      
      // Clean up markdown bolding, links, etc.
      let name = stripMarkdownLinks(rawName)
        .replace(/\*\*/g, '') // Remove bold
        .replace(/__/g, '')   // Remove italic
        .split(/[|｜]/)[0]
        .trim();
      
      if (name && !sources.some(s => s.id === id)) {
        sources.push({ id, name });
      }
    }
  });

  return sources;
};

const exampleQuestions = [
  '安全帽使用年限标准是多少？',
  'KN95口罩的国家标准号是什么？',
  '如何选择高处作业用的安全带？'
];

const feedbackText = ref('');
const currentFeedbackIndex = ref<number | null>(null);
const showFeedbackModal = ref(false);

const goFeedback = (index: number) => {
  currentFeedbackIndex.value = index;
  showFeedbackModal.value = true;
  feedbackText.value = '';
};

const closeFeedback = () => {
  showFeedbackModal.value = false;
  feedbackText.value = '';
};

const submitFeedback = () => {
  if (feedbackText.value.trim()) {
    if (currentFeedbackIndex.value !== null && messages.value[currentFeedbackIndex.value]) {
       messages.value[currentFeedbackIndex.value].interaction = 'feedbacked';
    }
    closeFeedback();
  }
};
onMounted(() => {
  isMounted.value = true;
  // Check agreement
  const hasAgreed = uni.getStorageSync('has_agreed');
  if (!hasAgreed) {
    uni.reLaunch({ url: '/pages/privacy/index' });
    return;
  }

  // Load session if coming from history
  const pages = getCurrentPages();
  const options = (pages[pages.length - 1] as any).options;
  if (options && options.sessionId) {
    loadSession(options.sessionId);
  }
});

onUnmounted(() => {
  isMounted.value = false;
});

const loadSession = (id: string) => {
  const history = uni.getStorageSync('chat_history') || [];
  const session = history.find((s: any) => s.id.toString() === id.toString());
  if (session) {
    messages.value = session.messages.map((m: any) => ({
      ...m,
      interaction: m.interaction || 'none'
    }));
    // Auto scroll to bottom after state update
    setTimeout(() => {
      scrollToBottom(true);
    }, 150);
  }
};

const goHistory = () => {
  uni.navigateTo({ url: '/pages/history/index' });
};

const resetChat = () => {
  if (isStreaming.value) return;
  messages.value = [];
  inputValue.value = '';
};

const handleSend = () => {
  if (inputValue.value.trim() && !isStreaming.value) {
    const text = inputValue.value;
    inputValue.value = '';
    startChat(text);
  }
};

const sendPreset = (text: string) => {
  if (!isStreaming.value) {
    startChat(text);
  }
};

const startChat = async (userText: string) => {
  if (isStreaming.value) return;

  // 1. Add user message
  messages.value.push({ role: 'user', content: userText });
  
  // 2. Prepare AI message placeholder
  const aiMsgIndex = messages.value.length;
  messages.value.push({ role: 'assistant', content: '', interaction: 'none' });
  
  isStreaming.value = true;
  scrollToBottom(true);

  // 3. Prepare full conversation for API (keeping it simple for now)
  const apiMessages: ChatMessage[] = messages.value.slice(0, aiMsgIndex).map(m => ({
    role: m.role as any,
    content: m.content
  }));

  // 4. Call Aliyun Bailian API
  chatStream(
    apiMessages,
    (delta) => {
      if (messages.value[aiMsgIndex]) {
        messages.value[aiMsgIndex].content += delta;
        scrollToBottom();
      }
    },
    (fullText) => {
      isStreaming.value = false;
      saveToHistory();
      scrollToBottom(true);
    },
    (error) => {
      isStreaming.value = false;
      if (messages.value[aiMsgIndex] && !messages.value[aiMsgIndex].content) {
        messages.value[aiMsgIndex].content = '抱歉，服务出现了一点问题，请稍后再试。';
      }
      uni.showToast({ title: '连接失败', icon: 'none' });
    }
  );
};

const saveToHistory = () => {
  const history = uni.getStorageSync('chat_history') || [];
  const firstUserMsg = messages.value.find(m => m.role === 'user')?.content || '新会话';
  
  // For simplicity, we just add the current session
  history.unshift({
    id: Date.now(),
    title: firstUserMsg,
    messages: JSON.parse(JSON.stringify(messages.value))
  });
  
  uni.setStorageSync('chat_history', history.slice(0, 20)); // Limit to 20
};

const toggleLike = (index: number) => {
  if (!messages.value[index]) return;
  const currentStatus = messages.value[index].interaction;
  messages.value[index].interaction = currentStatus === 'liked' ? 'none' : 'liked';
};
</script>

<style>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(180deg, #f0f4f9 0%, #f6f6f6 100%);
}
.header {
  padding-top: calc(60rpx + env(safe-area-inset-top));
  padding-left: 40rpx;
  padding-right: 40rpx;
  padding-bottom: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f0f4f9;
  z-index: 10;
}
.left-actions { display: flex; align-items: center; gap: 30rpx; }
.menu-icon {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  width: 44rpx;
  padding: 10rpx 0;
}
.bar {
  height: 3rpx;
  background-color: #4b5563;
  border-radius: 4rpx;
}
.w-full { width: 100%; }
.w-half { width: 60%; }
.top-logo { font-size: 32rpx; font-weight: bold; color: #1a1a1a; flex: 1; text-align: center; margin-right: 74rpx; }
.placeholder-box { width: 44rpx; display: none; }

.empty-state {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

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
.hero .p {
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
  box-shadow: 0 2rpx 4rpx rgba(0,0,0,0.02);
}

.section-title {
  font-size: 24rpx;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  margin: 40rpx 40rpx 10rpx;
  font-weight: 600;
}

.suggestions {
  flex: 1;
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
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.02);
}
.card-title {
  flex: 1;
  font-size: 28rpx;
  font-weight: 500;
  color: #374151;
}

.chat-content {
  flex: 1;
  padding: 20rpx 40rpx;
  overflow: hidden;
}

.msg-item {
  margin-bottom: 40rpx;
}

.user-msg-row { display: flex; justify-content: flex-end; margin-bottom: 40rpx; }
.user-msg { max-width: 85%; background-color: #1a73e8; color: white; padding: 24rpx 36rpx; border-radius: 32rpx 32rpx 4rpx 32rpx; font-size: 30rpx; }

.ai-msg-row { display: flex; flex-direction: column; align-items: flex-start; gap: 16rpx; margin-bottom: 48rpx; width: 100%; }
.avatar { 
  width: 80rpx; 
  height: 80rpx; 
  background-color: #f0f7ff;
  border-radius: 16rpx;
  display: flex; 
  align-items: center; 
  justify-content: center; 
  flex-shrink: 0; 
}
.ai-content-box { width: 100%; }
.ai-msg { background-color: #fff; padding: 28rpx 36rpx; border-radius: 4rpx 28rpx 28rpx 28rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05); border: 1rpx solid #f0f0f0; width: 100%; box-sizing: border-box; }

/* Markdown Body Enhancements */
.markdown-body {
  font-size: 28rpx;
  line-height: 1.6;
  color: #333;
  word-break: break-all;
}

:deep(.markdown-body p) {
  margin-bottom: 20rpx;
  display: block;
}

:deep(.markdown-body p:last-child) {
  margin-bottom: 0;
}

:deep(.markdown-body ul), 
:deep(.markdown-body ol) {
  margin-bottom: 20rpx;
  padding-left: 40rpx;
}

:deep(.markdown-body li) {
  margin-bottom: 8rpx;
}

/* TABLE STYLES - CRITICAL FIX */
:deep(.markdown-body table) {
  width: 100% !important;
  border-collapse: collapse;
  margin: 20rpx 0;
  font-size: 24rpx;
  background-color: #fff;
  border: 1rpx solid #e5e7eb;
}

:deep(.markdown-body th),
:deep(.markdown-body td) {
  border: 1rpx solid #e5e7eb;
  padding: 12rpx 16rpx;
  text-align: left;
}

:deep(.markdown-body th) {
  background-color: #f9fafb;
  font-weight: bold;
  color: #374151;
}

:deep(.markdown-body tr:nth-child(even)) {
  background-color: #fbfbfb;
}

.raw-content-view {
  background-color: #1e293b;
  padding: 24rpx;
  border-radius: 12rpx;
  margin: 16rpx 0;
  border: 1rpx solid #334155;
  box-shadow: inset 0 2rpx 8rpx rgba(0,0,0,0.2);
}
.raw-text-content {
  font-family: 'Courier New', Courier, monospace;
  font-size: 24rpx;
  color: #e2e8f0;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Citation Tags Styling - GPT Bubble Style */
:deep(.citation-tag) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #f1f5f9;
  color: #64748b;
  font-size: 16rpx;
  min-width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  margin: 0 4rpx;
  vertical-align: super;
  font-weight: 700;
  border: 1rpx solid #e2e8f0;
  padding: 0 2rpx;
  line-height: 1;
}

/* Sources Footer Styling - GPT Source Cards */
.sources-footer {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #f1f5f9;
}

.sources-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.source-pill {
  display: flex;
  align-items: center;
  background-color: #fff;
  padding: 8rpx 16rpx 8rpx 10rpx;
  border-radius: 12rpx;
  border: 1.5rpx solid #e2e8f0;
  max-width: 100%;
  transition: all 0.2s ease;
  box-shadow: 0 2rpx 4rpx rgba(0,0,0,0.02);
  gap: 8rpx;
}

.source-pill:active {
  background-color: #f8fafc;
  transform: scale(0.98);
}

.pill-id {
  font-size: 14rpx;
  color: #94a3b8;
  font-weight: bold;
  padding: 2rpx 6rpx;
  background: #f1f5f9;
  border-radius: 4rpx;
  line-height: 1;
}

.pill-name {
  font-size: 24rpx;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

:deep(blockquote) {
  border-left: 8rpx solid #e5e7eb;
  padding-left: 24rpx;
  color: #666;
  font-style: italic;
  margin: 16rpx 0;
  background-color: #f9fafb;
  padding: 12rpx 24rpx;
  border-radius: 4rpx;
}
.rich-text .p { font-size: 28rpx; line-height: 1.6; color: #333; word-break: break-all; margin-bottom: 16rpx; }

/* Markdown Table Styles */
:deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 20rpx 0;
  font-size: 24rpx;
  background-color: #fff;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  overflow: hidden;
}
:deep(th), :deep(td) {
  padding: 16rpx 20rpx;
  border: 1rpx solid #e2e8f0;
  text-align: left;
}
:deep(th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #475569;
}
:deep(tr:nth-child(even)) {
  background-color: #fafafa;
}

/* List Styles */
:deep(ul), :deep(ol) {
  padding-left: 40rpx;
  margin: 16rpx 0;
}
:deep(li) {
  margin-bottom: 8rpx;
  color: #333;
}

/* Mobile-safe table container */
.markdown-body {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.searching-status {
  display: inline-flex;
  align-items: center;
  background-color: #f0f7ff;
  padding: 12rpx 24rpx;
  border-radius: 100rpx;
  margin-top: 20rpx;
  border: 1rpx solid #dbeafe;
}
.search-icon-box {
  margin-right: 12rpx;
  display: flex;
  align-items: center;
  animation: spin 2s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.search-text {
  font-size: 24rpx;
  color: #1a73e8;
  font-weight: 500;
  margin-right: 16rpx;
}
.loading-dots {
  display: flex;
  gap: 6rpx;
  align-items: center;
}
.dot {
  width: 8rpx;
  height: 8rpx;
  background-color: #1a73e8;
  border-radius: 50%;
  animation: dot-bounce 1.4s infinite ease-in-out both;
}
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1.0); }
}

.interact-bar { display: flex; gap: 40rpx; margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid #f0f0f0; }
.interact-btn { display: flex; align-items: center; gap: 12rpx; color: rgba(0,0,0,0.4); transition: all 0.2s; }
.interact-btn.active { color: #1a73e8; font-weight: bold; transform: scale(1.05); }
.btn-txt { font-size: 24rpx; }

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(12rpx);
  -webkit-backdrop-filter: blur(12rpx);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.modal-card {
  width: 85%;
  max-width: 580rpx;
  background: #fff;
  border-radius: 48rpx;
  padding: 40rpx;
  box-shadow: 0 30rpx 80rpx rgba(0,0,0,0.15);
  transform: translateY(-160rpx); /* Move up more to clear typical keyboard + toolbar */
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 800;
  color: #1a1a1a;
}

.close-hit {
  width: 50rpx;
  height: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 50%;
  color: #999;
}

.modal-body {
  padding: 0rpx;
}

.feedback-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 30rpx;
}

.feedback-tags .tag {
  background: #f5f7fa;
  padding: 10rpx 20rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  color: #606266;
  border: 1rpx solid #e4e7ed;
  transition: all 0.2s;
}

.feedback-tags .tag.selected {
  background: #ecf5ff;
  color: #1a73e8;
  border-color: #1a73e8;
}

.feedback-area {
  width: 100%;
  height: 200rpx;
  background: #f8f9fa;
  border: 2rpx solid #eee;
  border-radius: 24rpx;
  padding: 24rpx;
  font-size: 26rpx;
  box-sizing: border-box;
  margin-bottom: 30rpx;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: #f0f1f2;
  color: #aaa;
  border-radius: 28rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  font-size: 30rpx;
  transition: all 0.2s;
}

.submit-btn.active {
  background: #1a73e8;
  color: #fff;
  box-shadow: 0 10rpx 20rpx rgba(26,115,232,0.2);
}

.submit-btn:disabled {
  opacity: 0.6;
}

.animate-pop {
  animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes popIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.input-bar-container {
  padding: 30rpx 40rpx calc(60rpx + env(safe-area-inset-bottom));
  background-color: #f6f6f6;
}
.input-bar {
  background-color: #fff;
  height: 110rpx;
  border-radius: 60rpx;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  border: 1rpx solid #eee;
  box-shadow: 0 8rpx 30rpx rgba(0,0,0,0.05);
}
.flex-1 { flex: 1; }
.px-2 { padding: 0 20rpx; }
.text-input { font-size: 30rpx; height: 80rpx; }
.right-actions {
  display: flex;
  align-items: center;
}
.send-btn {
  background-color: #f0f0f0;
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.send-btn.btn-loading {
  background-color: #1a73e8;
  position: relative;
}
.send-btn.btn-loading::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border: 4rpx solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  box-sizing: border-box;
}
.send-btn.btn-active {
  background-color: #1a73e8;
}
.send-btn:not(.btn-loading) .app-icon {
  transform: rotate(-45deg);
  margin-left: 4rpx;
  margin-top: -4rpx;
}
.ai-tip { font-size: 22rpx; color: #aaa; text-align: center; margin-top: 16rpx; display: block; }
</style>
