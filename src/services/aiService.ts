/**
 * Service to interact with Aliyun Bailian (Model Studio) API.
 */

const API_KEY = import.meta.env.VITE_DASHSCOPE_API_KEY;
const APP_ID = import.meta.env.VITE_DASHSCOPE_APP_ID;
const BASE_URL = `https://dashscope.aliyuncs.com/api/v2/apps/agent/${APP_ID}/compatible-mode/v1/responses`;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  showRaw?: boolean;
  interaction?: 'liked' | 'feedbacked' | null;
}

export interface ChatStreamHandle {
  abort: () => void;
}

export function chatStream(
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: any) => void
): ChatStreamHandle {
  if (!API_KEY || !APP_ID) {
    onError(new Error('Missing API_KEY or APP_ID in environment variables.'));
    return { abort: () => {} };
  }

  let fullText = '';
  let buffer = '';

  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

  const requestTask = uni.request({
    url: BASE_URL,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    data: {
      input: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: true
    },
    enableChunked: true,
    success: (res) => {
      if (res.statusCode !== 200) {
        onError(new Error(`Request failed with status ${res.statusCode}`));
      } else {
        onComplete(fullText);
      }
    },
    fail: (err) => {
      const errMsg = err.errMsg || '';
      if (errMsg.includes('abort') || errMsg.includes('BodyStreamBuffer was aborted')) {
        console.log('Request aborted');
        onComplete(fullText); // Complete with what we have
      } else {
        console.error('Request failed:', err);
        onError(err);
      }
    }
  }) as any;

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
        console.error('Decode error:', e);
      }

      buffer += str;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const dataMatch = line.match(/data:(.*)$/);
        if (dataMatch) {
          const rawData = dataMatch[1].trim();
          if (rawData === '[DONE]') continue;
          try {
            const data = JSON.parse(rawData);
            if (data.type === 'response.output_text.delta' && data.delta) {
              onChunk(data.delta);
              fullText += data.delta;
            }
          } catch (e) {}
        }
      }
    });
  }

  return {
    abort: () => {
      if (requestTask && typeof requestTask.abort === 'function') {
        requestTask.abort();
      }
    }
  };
}

// Simple UTF-8 decoder fallback for when TextDecoder is missing
function decodeUtf8(array: Uint8Array): string {
  let out, i, len, c;
  let char2, char3;

  out = "";
  len = array.length;
  i = 0;
  while (i < len) {
    c = array[i++];
    switch (c >> 4) {
      case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12: case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode(((c & 0x0F) << 12) |
          ((char2 & 0x3F) << 6) |
          ((char3 & 0x3F) << 0));
        break;
    }
  }

  return out;
}
