/**
 * Service to interact with backend Chat API (SSE streaming)
 */

import { getToken } from './apiService';

const BASE_URL = 'https://www.agidata.xin';

export interface ChatStreamOptions {
  content: string;
  sessionId?: string | null;
}

export interface ChatMeta {
  sessionId: string;
  userMessageId: number;
  assistantMessageId: number;
}

export interface ChatStreamResult {
  sessionId: string;
  assistantMessageId: number;
}

export interface ChatStreamCallbacks {
  onChunk: (delta: string) => void;
  onMeta: (meta: ChatMeta) => void;
  onComplete: (result: ChatStreamResult) => void;
  onError: (error: { code: number; message: string }) => void;
}

export interface ChatStreamHandle {
  abort: () => void;
}

let currentRequestTask: any = null;

export function chatStream(
  options: ChatStreamOptions,
  callbacks: ChatStreamCallbacks
): ChatStreamHandle {
  const token = getToken();
  if (!token) {
    callbacks.onError({ code: -1, message: '未登录，请先登录' });
    return { abort: () => {} };
  }

  let buffer = '';
  let currentSessionId = '';
  let currentAssistantMessageId = 0;

  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

  const requestTask = uni.request({
    url: `${BASE_URL}/api/v1/chat`,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    data: {
      content: options.content,
      sessionId: options.sessionId || null
    },
    enableChunked: true,
    success: (res) => {
      if (res.statusCode !== 200) {
        callbacks.onError({ code: res.statusCode || -1, message: `请求失败: ${res.statusCode}` });
      }
    },
    fail: (err) => {
      callbacks.onError({ code: -1, message: err.errMsg || '网络请求失败' });
    }
  }) as any;

  currentRequestTask = requestTask;

  if (requestTask.onChunkReceived) {
    requestTask.onChunkReceived((res: any) => {
      const arrayBuffer = res.data;
      const uint8Array = new Uint8Array(arrayBuffer);
      let str = '';
      try {
        if (decoder) {
          str = decoder.decode(uint8Array, { stream: true });
        } else {
          str = decodeUtf8(uint8Array);
        }
      } catch (e) {
        // ignore decode error
      }

      buffer += str;

      // Process all complete SSE messages in buffer
      // SSE format: "event: TYPE\ndata: JSON\n\n"
      // We need to find each complete message (ends with double newline)
      while (true) {
        const msgStart = buffer.indexOf('event:');
        if (msgStart === -1) break;

        const msgContent = buffer.slice(msgStart);
        const doubleNewline = msgContent.indexOf('\n\n');

        if (doubleNewline === -1) {
          // Incomplete message, wait for more data
          break;
        }

        const completeMsg = msgContent.slice(0, doubleNewline);
        buffer = buffer.slice(msgStart + doubleNewline + 2);

        // Parse the SSE message
        const eventMatch = completeMsg.match(/event:\s*(\w+)/);
        const dataMatch = completeMsg.match(/data:\s*(\{[\s\S]*?\})/);

        if (eventMatch && dataMatch) {
          const eventType = eventMatch[1];
          try {
            const data = JSON.parse(dataMatch[1]);

            switch (eventType) {
              case 'meta':
                currentSessionId = data.sessionId || '';
                currentAssistantMessageId = data.assistantMessageId || 0;
                callbacks.onMeta({
                  sessionId: currentSessionId,
                  userMessageId: data.userMessageId || 0,
                  assistantMessageId: currentAssistantMessageId
                });
                break;

              case 'chunk':
                if (data.delta) {
                  callbacks.onChunk(data.delta);
                }
                break;

              case 'done':
                callbacks.onComplete({
                  sessionId: currentSessionId,
                  assistantMessageId: currentAssistantMessageId
                });
                break;

              case 'error':
                callbacks.onError({
                  code: data.code || -1,
                  message: data.message || '未知错误'
                });
                break;
            }
          } catch (e) {
            // JSON parse error
          }
        }
      }
    });
  } else {
    callbacks.onError({ code: -1, message: '当前环境不支持流式请求' });
  }

  return {
    abort: () => {
      if (currentRequestTask && typeof currentRequestTask.abort === 'function') {
        currentRequestTask.abort();
      }
    }
  };
}

// Simple UTF-8 decoder fallback for when TextDecoder is missing
function decodeUtf8(array: Uint8Array): string {
  let out = '';
  let i = 0;
  const len = array.length;

  while (i < len) {
    const c = array[i++];
    switch (c >> 4) {
      case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
        out += String.fromCharCode(c);
        break;
      case 12: case 13:
        const char2 = array[i++];
        out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
        break;
      case 14:
        const char3 = array[i++];
        const char4 = array[i++];
        out += String.fromCharCode(((c & 0x0F) << 12) |
          ((char3 & 0x3F) << 6) |
          ((char4 & 0x3F) << 0));
        break;
    }
  }

  return out;
}
