/**
 * Service to interact with backend Chat API (SSE streaming)
 */

import { getToken, isTokenExpired, login } from './apiService';

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

// 获取有效的 token（检查过期）
async function getValidToken(): Promise<string | null> {
  let token = getToken();
  if (!token) return null;

  // 检查是否即将过期（提前 60 秒）
  if (isTokenExpired()) {
    // 刷新 token
    const result = await login();
    if (result.success) {
      token = getToken();
    } else {
      return null;
    }
  }

  return token;
}

export function chatStream(
  options: ChatStreamOptions,
  callbacks: ChatStreamCallbacks
): ChatStreamHandle {
  const token = getToken();
  const expired = isTokenExpired();

  if (!token || expired) {
    login().then((result) => {
      if (result.success) {
        const newToken = getToken();
        if (newToken) {
          doChatStream(newToken, options, callbacks);
        } else {
          callbacks.onError({ code: -1, message: '登录失效，请重新登录' });
        }
      } else {
        callbacks.onError({ code: -1, message: result.error || '登录失效，请重新登录' });
      }
    });
    return { abort: () => {} };
  }

  return doChatStream(token, options, callbacks);
}

// 保存当前请求的 abort 函数，用于刷新 token 时中止旧请求
let currentAbortController: (() => void) | null = null;

function doChatStream(
  token: string,
  options: ChatStreamOptions,
  callbacks: ChatStreamCallbacks
): ChatStreamHandle {
  let buffer = '';
  let currentSessionId = '';
  let currentAssistantMessageId = 0;

  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

  // 如果有旧请求在运行，先中止
  if (currentAbortController) {
    currentAbortController();
    currentAbortController = null;
  }

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
      // HTTP 401/403 表示 token 无效
      if (res.statusCode === 401 || res.statusCode === 403) {
        login().then((loginResult) => {
          if (loginResult.success) {
            const newToken = getToken();
            if (newToken) {
              doChatStream(newToken, options, callbacks);
              return;
            }
          }
          callbacks.onError({ code: res.statusCode, message: '登录失效，请重新登录' });
        });
        return;
      }
      // 检查业务错误码（HTTP 200 但 code 不是 0）
      const data = res.data as any;
      if (data && data.code === 1002) {
        login().then((loginResult) => {
          if (loginResult.success) {
            const newToken = getToken();
            if (newToken) {
              doChatStream(newToken, options, callbacks);
              return;
            }
          }
          callbacks.onError({ code: data.code, message: data.message || '登录失效，请重新登录' });
        });
        return;
      }
      if (res.statusCode !== 200) {
        callbacks.onError({ code: res.statusCode || -1, message: `请求失败: ${res.statusCode}` });
      }
    },
    fail: (err) => {
      callbacks.onError({ code: -1, message: err.errMsg || '网络请求失败' });
    }
  }) as any;

  currentRequestTask = requestTask;

  // 保存 abort 函数供刷新时使用
  currentAbortController = () => {
    if (requestTask && typeof requestTask.abort === 'function') {
      requestTask.abort();
    }
  };

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

      // 检查是否是 JSON 错误响应（非 SSE 格式）
      const trimmed = str.trim();
      if (trimmed.startsWith('{')) {
        try {
          const jsonData = JSON.parse(trimmed);
          if (jsonData.code === 1002) {
            // token 无效，刷新并重试
            login().then((loginResult) => {
              if (loginResult.success) {
                const newToken = getToken();
                if (newToken) {
                  doChatStream(newToken, options, callbacks);
                  return;
                }
              }
              callbacks.onError({ code: jsonData.code, message: jsonData.message || '登录失效，请重新登录' });
            });
            return;
          }
        } catch (e) {
          // 不是有效的 JSON，继续按 SSE 处理
        }
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
                // 检查是否是 token 过期错误 (code 1002)
                if (data.code === 1002) {
                  login().then((loginResult) => {
                    if (loginResult.success) {
                      const newToken = getToken();
                      if (newToken) {
                        doChatStream(newToken, options, callbacks);
                        return;
                      }
                    }
                    callbacks.onError({ code: data.code, message: data.message || '登录失效，请重新登录' });
                  });
                  return;
                }
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
