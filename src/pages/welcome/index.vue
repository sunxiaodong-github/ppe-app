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
          size="60" 
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
      :scroll-into-view="scrollIntoView"
      :scroll-with-animation="false"
    >
      <view v-for="(msg, index) in messages" :key="index" class="msg-item">
        <!-- User Question -->
        <view v-if="msg.role === 'user'" class="user-msg-row">
          <view class="user-msg">
            <text selectable="true">{{ msg.content }}</text>
          </view>
        </view>

        <!-- AI Answer -->
        <view v-else class="ai-msg-row">
          <view class="avatar">
            <AppIcon name="security" size="52" color="#1a73e8" fill />
          </view>
          <view class="ai-content-box" :class="{ 'is-streaming': isStreaming && index === messages.length - 1 }">
            <view class="ai-msg">
              <view class="rich-text">
                <view class="markdown-body" v-html="renderMarkdown(msg.content)" @click="handleMarkdownClick"></view>
                
                <!-- Sources Section: Refined Citations -->
                <view v-if="getDetailedSources(msg.content).length > 0" class="sources-footer">
                  <view class="sources-header" @click="toggleSources(index)">
                    <view class="sources-header-left">
                      <AppIcon 
                        name="chevron_right" 
                        size="32" 
                        color="#1a73e8" 
                        :style="{ transform: msg.sourcesExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }" 
                      />
                      <text class="sources-title">参考资料</text>
                      <view class="sources-count-badge">{{ getDetailedSources(msg.content).length }}</view>
                    </view>
                  </view>
                  
                  <view 
                    v-if="msg.sourcesExpanded" 
                    class="sources-content-list animate-fade-in"
                  >
                    <view 
                      v-for="source in getDetailedSources(msg.content)" 
                      :key="source.id" 
                      class="source-link-item" 
                      @click="openSource(source)"
                    >
                      <text class="source-no">[{{ source.id }}]</text>
                      <text class="source-label" :class="{ 'clickable-link': source.url }">{{ source.name }}</text>
                      <AppIcon v-if="source.url" name="open_in_new" size="18" color="#1a73e8" />
                    </view>
                  </view>
                </view>

                <view v-if="!isStreaming || index < messages.length - 1" class="interact-bar">
                  <view 
                    class="interact-btn" 
                    :class="{ active: msg.interaction === 'liked' }"
                    @click="toggleLike(index)"
                  >
                    <AppIcon name="thumb_up" size="24" :fill="msg.interaction === 'liked'" :color="msg.interaction === 'liked' ? '#1a73e8' : '#94a3b8'" />
                    <text class="btn-txt">赞同</text>
                  </view>
                  <view 
                    class="interact-btn" 
                    :class="{ active: msg.interaction === 'feedbacked' }"
                    @click="goFeedback(index)"
                  >
                    <AppIcon name="thumb_down" size="24" :fill="msg.interaction === 'feedbacked'" :color="msg.interaction === 'feedbacked' ? '#1a73e8' : '#94a3b8'" />
                    <text class="btn-txt">反馈</text>
                  </view>
                </view>

              </view>
                
              <!-- Searching status: only show when message is empty and streaming -->
              <view v-if="isStreaming && index === messages.length - 1 && !msg.content" class="searching-status">
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
            </view>
          </view>
        </view>
      <view class="bottom-spacer" style="height: 40rpx;"></view>
      <view id="scroll-anchor" class="scroll-anchor" :style="{ height: isStreaming ? '60rpx' : '1px' }"></view>
    </scroll-view>

    <!-- Input Bar -->
    <view 
      class="input-bar-container" 
      :style="{ paddingBottom: keyboardHeight > 0 ? keyboardHeight + 'px' : 'env(safe-area-inset-bottom)' }"
    >
      <view class="input-bar">
        <textarea 
          v-model="inputValue"
          class="flex-1 px-2 text-input-area"
          placeholder="有问题，尽管问我..."
          auto-height
          :maxlength="-1"
          :cursor-spacing="20"
          :adjust-position="false"
          :disabled="isStreaming"
          @confirm="handleSend"
          @focus="onInputFocus"
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
              v-if="!isStreaming"
              class="send-icon"
              name="send" 
              size="48" 
              :color="inputValue.trim() ? '#fff' : '#d1d5db'" 
              fill 
            />
          </view>
        </view>
      </view>
      <view class="ai-disclaimer">内容由AI生成</view>
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
const scrollIntoView = ref('');
const isStreaming = ref(false);
const isMounted = ref(false);
const keyboardHeight = ref(0);

const onKeyboardHeightChange = (e: any) => {
  const height = e.detail.height || 0;
  keyboardHeight.value = height;
  if (height > 0) {
    scrollToBottom(true);
  }
};

const onInputFocus = () => {
  // Use a slight delay to ensure the keyboard has started appearing
  setTimeout(() => {
    scrollToBottom(true);
  }, 100);
};

const messages = ref<any[]>([]);

const pageTitle = computed(() => {
  if (messages.value.length === 0) return '智护AI';
  const firstUserMsg = messages.value.find(m => m.role === 'user');
  if (!firstUserMsg) return '智护AI';
  const content = firstUserMsg.content || '';
  if (content.length <= 10) return content;
  return content.substring(0, 10) + '...';
});

// Use a throttled version for scrolling
let lastScrollTime = 0;
const scrollToBottom = (force = false) => {
  if (!isMounted.value || messages.value.length === 0) return;
  const now = Date.now();
  if (!force && now - lastScrollTime < 30) return; 
  lastScrollTime = now;
  
  // Use a slight timeout to ensure Markdown rendering has updated the element height
  // before we calculate the scroll position
  setTimeout(() => {
    chatScrollTop.value = 1000000 + Math.random();
    
    scrollIntoView.value = '';
    nextTick(() => {
      scrollIntoView.value = 'scroll-anchor';
    });
  }, 20);
};

// Citation Tokens from Documentation
const CITATION_START = '\uE200';
const CITATION_DELIMITER = '\uE202';
const CITATION_STOP = '\uE201';

const renderMarkdown = (content: string) => {
  if (!content) return '';
  
  // 1. Identify where references start
  const separators = ['参考资料', '参考来源', 'Sources', 'References'];
  let displayBody = content;
  const footnoteIndex = content.search(/\n\[\^(\d+)\]:/);
  
  let sepIndex = -1;
  for (const sep of separators) {
    const index = content.lastIndexOf(sep);
    if (index !== -1 && (sepIndex === -1 || index < sepIndex)) {
      sepIndex = index;
    }
  }

  if (footnoteIndex !== -1) {
    displayBody = content.substring(0, footnoteIndex);
  } else if (sepIndex !== -1) {
    displayBody = content.substring(0, sepIndex);
  } else {
    const listMatch = content.match(/\n[\[\(【]?1[\]\)】†]?[:：\.\s]/);
    if (listMatch && listMatch.index !== undefined && listMatch.index > content.length * 0.6) {
      displayBody = content.substring(0, listMatch.index);
    }
  }

  // Extract sources to used for link transformation
  const sources = getDetailedSources(content);

  // 2. Identify and style citations: Handle Unicode Tokens AND Standard Markdown
  
  // 2a. DOC standards (Unicode tokens)
  const docCitationRegex = new RegExp(`${CITATION_START}cite${CITATION_DELIMITER}([\\s\\S]*?)${CITATION_STOP}`, 'g');
  let processedContent = displayBody.replace(docCitationRegex, (match, body) => {
    const parts = body.split(CITATION_DELIMITER);
    const sourceIdMatch = parts[0].match(/(\d+)/);
    const displayId = sourceIdMatch ? sourceIdMatch[1] : 'i';
    const num = parseInt(displayId);
    const source = sources.find(s => s.id === displayId);
    if (source && source.url) {
      return `<a href="${source.url}" target="_blank" class="citation-link">${displayId}</a>`;
    }
    return `<span class="citation-tag">${displayId}</span>`;
  });

  // 2b. Standard fallback citations: avoid breaking normal links [text](url)
  // We look for [n] or [n, m] where n, m are 1-2 digits, and it's NOT followed by ( or :
  processedContent = processedContent
    .replace(/\[\^?((?:\d{1,2}\s*,\s*)*\d{1,2})\](?!\s*[\(:])/g, (match, ids: string) => {
      const idList = ids.split(',').map((id: string) => id.trim());
      return idList.map((id: string) => {
        const source = sources.find(s => s.id === id);
        if (source && source.url) {
          return `<a href="${source.url}" target="_blank" class="citation-link">${id}</a>`;
        }
        return `<span class="citation-tag">${id}</span>`;
      }).join('');
    })
    .replace(/【((?:\d{1,2}\s*,\s*)*\d{1,2})[†:]?[^】]*】/g, (match, ids: string) => {
      // Handle the 【1, 2】 case too
      const idList = ids.split(',').map((id: string) => id.trim().replace(/[†:]/g, ''));
      return idList.map((id: string) => {
        const source = sources.find(s => s.id === id);
        if (source && source.url) {
          return `<a href="${source.url}" target="_blank" class="citation-link">${id}</a>`;
        }
        return `<span class="citation-tag">${id}</span>`;
      }).join('');
    });
  
  // 3. Table Recognition & Fixes
  // Keep the references part at the end so markdown-it can resolve potentially relative links if any
  // But wrap it in a hidden div so it doesn't show up in the middle of the chat
  const footerContent = content.substring(displayBody.length);
  const fullContentToRender = processedContent + '\n\n<div class="markdown-footer-refs">\n\n' + footerContent + '\n\n</div>';
  let tableFixed = fullContentToRender.replace(/｜/g, '|'); 
  
  const lines = tableFixed.split('\n');
  const resultLines = [];
  let inTable = false;
  
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();
    const hasPipe = trimmedLine.includes('|');
    const isSeparator = /^[:\-\| ]+$/.test(trimmedLine) && trimmedLine.includes('-') && trimmedLine.length > 2;
    
    if (hasPipe || isSeparator) {
      if (!inTable) {
        if (resultLines.length > 0 && resultLines[resultLines.length - 1] !== '') {
          resultLines.push('');
        }
        inTable = true;
      }
      resultLines.push(trimmedLine);
    } else {
      if (inTable) {
        if (trimmedLine === '') {
          let continues = false;
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const lookahead = lines[j].trim();
            if (lookahead.includes('|') || (/^[:\-\| ]+$/.test(lookahead) && lookahead.includes('-'))) {
              continues = true;
              break;
            }
            if (lookahead !== '') break;
          }
          if (continues) continue;
        }
        inTable = false;
        resultLines.push('');
        if (trimmedLine !== '') resultLines.push(rawLine);
      } else {
        resultLines.push(rawLine);
      }
    }
  }

  let finalContent = resultLines.join('\n');
  
  return md.render(finalContent);
};

// Helper to extract and parse actual source names
interface SourceInfo {
  id: string;
  name: string;
  url?: string;
}

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
    sourceText = content.substring(footnoteMatch.index);
  } else if (splitIndex !== -1) {
    sourceText = content.substring(splitIndex);
  } else {
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
  const urlRegex = /(https?:\/\/[^\s\)\],]+)/g;

  lines.forEach(line => {
    const match = line.match(/^([\[\(【]?\^?(\d+)[\]\)】†]*[:：\.\s]*)(.*)/);
    if (match) {
      const id = match[2];
      const rawText = match[3].trim();
      
      let url = '';
      let name = '';
      
      const mdLinkMatch = rawText.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
      if (mdLinkMatch) {
        name = mdLinkMatch[1];
        url = mdLinkMatch[2];
      } else {
        const urlMatch = rawText.match(urlRegex);
        if (urlMatch) {
          url = urlMatch[0];
          name = rawText.replace(url, '').trim()
            .replace(/[:：\s\-\(\)\[\]]+$/, '')
            .replace(/^[:：\s\-\(\)\[\]]+/, '');
          if (!name) name = url;
        } else {
          name = rawText;
        }
      }
      
      name = name.replace(/[\*\#\_]+/g, '').trim();
      
      if (id && name && !sources.some(s => s.id === id)) {
        sources.push({ id, name, url });
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

const toggleSources = (index: number) => {
  if (messages.value[index]) {
    messages.value[index].sourcesExpanded = !messages.value[index].sourcesExpanded;
  }
};



const openLink = (url: string) => {
  if (!url) return;
  // #ifdef H5
  window.open(url, '_blank');
  // #endif
  // #ifndef H5
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({ title: '链接已复制，请在浏览器中访问', icon: 'none' });
    }
  });
  // #endif
};

const openSource = (source: SourceInfo) => {
  if (source.url) {
    openLink(source.url);
  }
};

const handleMarkdownClick = (e: any) => {
  // Delegate clicks to links
  let target = e.target;
  // Walk up to find A tag (could be clicking a span inside A)
  while (target && target.tagName !== 'A') {
    target = target.parentNode;
  }
  
  if (target && target.tagName === 'A' && target.href) {
    // Check if it's a citation link or standard link
    const href = target.getAttribute('href');
    if (href) {
      // Prevent default and use our opener
      // This is especially needed in uni-app v-html to ensure target="_blank" behavior
      // and platform compatibility
      openLink(href);
    }
  }
};
</script>

<style>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}
.header {
  padding-top: calc(var(--status-bar-height) + env(safe-area-inset-top) + 160rpx);
  padding-left: 48rpx;
  padding-right: 48rpx;
  padding-bottom: 30rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
  z-index: 10;
  position: relative;
  height: 80rpx;
}
.left-actions { 
  display: flex; 
  align-items: center; 
  gap: 32rpx;
  position: absolute;
  left: 48rpx;
  height: 80rpx;
  z-index: 11;
}
.menu-icon {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 60rpx;
  height: 40rpx;
  opacity: 0.7;
  transition: opacity 0.2s;
  flex-shrink: 0;
}
.menu-icon:active { opacity: 1; }
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
  letter-spacing: -0.5rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 350rpx;
  text-align: center;
  margin: 0 auto;
}
.placeholder-box { width: 44rpx; display: none; }

.empty-state {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  justify-content: flex-start;
  padding-top: 120rpx;
}

.hero {
  padding: 60rpx 48rpx 32rpx;
  text-align: center;
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
  font-weight: 400;
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
  max-height: 40vh;
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
  transition: transform 0.2s;
}
.card:active {
  transform: scale(0.98);
}
.card-title {
  flex: 1;
  font-size: 26rpx;
  font-weight: 500;
  color: #334155;
  line-height: 1.4;
}

.chat-content {
  flex: 1;
  padding: 20rpx 40rpx;
  min-height: 0;
  position: relative;
}

.msg-item {
  margin-bottom: 48rpx;
}

.user-msg-row { display: flex; justify-content: flex-end; margin-bottom: 48rpx; }
.user-msg { 
  max-width: 85%; 
  background: linear-gradient(135deg, #1d4ed8 0%, #1a73e8 100%); 
  color: white; 
  padding: 24rpx 36rpx; 
  border-radius: 32rpx 32rpx 8rpx 32rpx; 
  font-size: 30rpx;
  box-shadow: 0 8rpx 24rpx rgba(26, 115, 232, 0.15);
  line-height: 1.6;
  user-select: text;
  -webkit-user-select: text;
}

.ai-msg-row { display: flex; flex-direction: column; align-items: flex-start; gap: 20rpx; margin-bottom: 56rpx; width: 100%; }
.avatar { 
  width: 72rpx; 
  height: 72rpx; 
  background-color: #ffffff;
  border-radius: 20rpx;
  display: flex; 
  align-items: center; 
  justify-content: center; 
  flex-shrink: 0; 
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05);
}
.ai-content-box { width: auto; max-width: 92%; }
.ai-msg { 
  background-color: #fff; 
  padding: 36rpx 44rpx; 
  border-radius: 8rpx 36rpx 36rpx 36rpx; 
  box-shadow: 0 4rpx 24rpx rgba(0,0,0,0.05); 
  border: 1rpx solid rgba(0,0,0,0.02); 
  box-sizing: border-box; 
  user-select: text;
  -webkit-user-select: text;
}

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

:deep(.markdown-body blockquote) {
  margin: 16rpx 0;
  padding: 16rpx 32rpx;
  background-color: #f8fafc;
  border-left: 8rpx solid #e2e8f0;
  color: #64748b;
  font-style: italic;
  border-radius: 4rpx;
}

/* Link styling */
:deep(.markdown-body a) {
  color: #1a73e8;
  text-decoration: none;
  border-bottom: 2rpx solid #1a73e8;
  padding: 0 4rpx;
  font-weight: 500;
}

:deep(.markdown-footer-refs) {
  display: none !important;
}

/* TABLE STYLES - Consolidated and Improved */
:deep(.markdown-body table) {
  width: 100%;
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 24rpx 0;
  font-size: 24rpx;
  background-color: #fff;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  -webkit-overflow-scrolling: touch;
}

:deep(.markdown-body thead) {
  display: table-header-group;
  width: 100%;
}

:deep(.markdown-body tbody) {
  display: table-row-group;
  width: 100%;
}

:deep(.markdown-body tr) {
  display: table-row;
  width: 100%;
}

:deep(.markdown-body th),
:deep(.markdown-body td) {
  display: table-cell;
  border: 1rpx solid #e2e8f0;
  padding: 16rpx 20rpx;
  text-align: left;
  line-height: 1.4;
  min-width: 120rpx;
}

:deep(.markdown-body th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}

:deep(.markdown-body tr:nth-child(even)) {
  background-color: #f9fafb;
}

:deep(.markdown-body tr:hover) {
  background-color: #f1f5f9;
}



/* Citation Tags Styling - Minimalist Grey Style */
:deep(.citation-tag),
:deep(.citation-link) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #f1f5f9;
  color: #64748b;
  font-size: 16rpx;
  min-width: 26rpx;
  height: 26rpx;
  border-radius: 50%;
  margin: 0 4rpx;
  vertical-align: super;
  font-weight: 600;
  border: 1rpx solid #e2e8f0;
  padding: 0 2rpx;
  line-height: 1;
}

:deep(.citation-link) {
  cursor: pointer;
  background-color: #f8fafc;
}

:deep(.citation-link:active) {
  background-color: #e2e8f0;
  transform: scale(0.9);
}

/* Sources Footer Styling */
.sources-footer {
  margin-top: 24rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f1f5f9;
}

.sources-header {
  display: flex;
  align-items: center;
  padding: 8rpx 0;
  cursor: pointer;
}

.sources-header-left {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.sources-title {
  font-size: 26rpx;
  color: #1a73e8;
  font-weight: 600;
}

.sources-count-badge {
  font-size: 18rpx;
  color: #1a73e8;
  background: #eff6ff;
  padding: 2rpx 12rpx;
  border-radius: 20rpx;
  margin-left: 8rpx;
  border: 1rpx solid rgba(26, 115, 232, 0.1);
}

.sources-header:active {
  background-color: #f0f7ff;
  border-radius: 12rpx;
}

.sources-content-list {
  padding: 12rpx 0 8rpx 40rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.source-link-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f8fafc;
}

.source-link-item:last-child {
  border-bottom: none;
}

.source-no {
  font-size: 20rpx;
  color: #94a3b8;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 4rpx;
  background: #f1f5f9;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}

.source-label {
  flex: 1;
  font-size: 24rpx;
  color: #475569;
  line-height: 1.5;
  word-break: break-all;
}

.source-label.clickable-link {
  color: #1a73e8 !important;
  text-decoration: underline !important;
}

.source-link-item:active {
  opacity: 0.7;
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

.source-pill.has-link {
  border-color: rgba(26,115,232,0.2);
  background-color: #f8fbff;
}

.source-pill.has-link .pill-name {
  color: #1a73e8;
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

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
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

/* List Styles */
:deep(.markdown-body ul), :deep(.markdown-body ol) {
  padding-left: 40rpx;
  margin: 16rpx 0;
}
:deep(.markdown-body li) {
  margin-bottom: 8rpx;
  color: #333;
}

/* Mobile-safe table container */
.markdown-body {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

.is-streaming .markdown-body > *:last-child::after,
.is-streaming .markdown-body li:last-child::after {
  content: '';
  display: inline-block;
  width: 12rpx;
  height: 12rpx;
  background-color: #1a73e8;
  margin-left: 8rpx;
  vertical-align: middle;
  border-radius: 50%;
  animation: cursor-blink 0.8s infinite;
  box-shadow: 0 0 8rpx rgba(26, 115, 232, 0.4);
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.searching-status {
  display: inline-flex;
  align-items: center;
  background-color: #f0f7ff;
  padding: 16rpx 28rpx;
  border-radius: 100rpx;
  margin-top: 24rpx;
  border: 1rpx solid #dbeafe;
  box-shadow: 0 4rpx 15rpx rgba(26,115,232,0.1);
  animation: bg-pulse 2s infinite ease-in-out;
}
@keyframes bg-pulse {
  0% { background-color: #f0f7ff; }
  50% { background-color: #e0f0ff; }
  100% { background-color: #f0f7ff; }
}
.search-icon-box {
  margin-right: 16rpx;
  display: flex;
  align-items: center;
  animation: spin 1s linear infinite;
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
  width: 10rpx;
  height: 10rpx;
  background-color: #1a73e8;
  border-radius: 50%;
  animation: dot-bounce 1s infinite ease-in-out both;
}
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1.0); }
}

.interact-bar { display: flex; gap: 32rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid #f8fafc; }
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
  padding: 20rpx 32rpx 0;
  background-color: transparent;
  position: relative;
  z-index: 100;
  transition: padding-bottom 0.15s ease-out;
}
.input-bar {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 48rpx;
  padding: 10rpx 24rpx 10rpx 28rpx;
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.08);
  border: 1rpx solid rgba(0,0,0,0.01);
}
.flex-1 { flex: 1; }
.px-2 { padding: 0 20rpx; }
.text-input-area { 
  min-height: 60rpx; 
  max-height: 300rpx; 
  font-size: 30rpx; 
  color: #1e293b; 
  padding: 10rpx 0 10rpx 16rpx;
  line-height: 1.5;
}
.right-actions {
  display: flex;
  align-items: center;
}
.ai-disclaimer {
  text-align: center;
  font-size: 20rpx;
  color: #94a3b8;
  margin-top: 16rpx;
  opacity: 0.6;
}
.send-btn { 
  width: 72rpx; 
  height: 72rpx; 
  border-radius: 50%; 
  display: flex; 
  align-items: center; 
  justify-content: center;
  background-color: #f1f5f9;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.send-btn.btn-active {
  background: linear-gradient(135deg, #1d4ed8 0%, #1a73e8 100%);
  box-shadow: 0 4rpx 12rpx rgba(26, 115, 232, 0.3);
  transform: scale(1.05);
}
.send-btn.btn-active:active {
  transform: scale(0.92);
}
.send-btn.btn-loading {
  background-color: #1a73e8;
  position: relative;
}
.send-btn.btn-loading::after {
  content: '';
  position: absolute;
  width: 32rpx;
  height: 32rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.send-btn .send-icon {
  transform: rotate(-45deg);
  margin-left: 4rpx;
  margin-top: -4rpx;
}
</style>
