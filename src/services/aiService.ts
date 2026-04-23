/**
 * Service to interact with Aliyun Bailian (Model Studio) API.
 */

const API_KEY = import.meta.env.VITE_DASHSCOPE_API_KEY;
const APP_ID = import.meta.env.VITE_DASHSCOPE_APP_ID;
const BASE_URL = `https://dashscope.aliyuncs.com/api/v2/apps/agent/${APP_ID}/compatible-mode/v1/responses`;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function chatStream(
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: any) => void
) {
  if (!API_KEY || !APP_ID) {
    onError(new Error('Missing API_KEY or APP_ID in environment variables.'));
    return;
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
      // For chunked, success is called when the connection is closed
      if (res.statusCode !== 200) {
        onError(new Error(`Request failed with status ${res.statusCode}`));
      } else {
        onComplete(fullText);
      }
    },
    fail: (err) => {
      console.error('Request failed:', err);
      onError(err);
    }
  }) as any;

  // WeChat Mini Program specific: onChunkReceived
  if (requestTask.onChunkReceived) {
    requestTask.onChunkReceived((res: any) => {
      const arrayBuffer = res.data;
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert ArrayBuffer to string (UTF-8)
      let str = '';
      try {
        if (decoder) {
          // Use stream: true to maintain state between chunks
          str = decoder.decode(uint8Array, { stream: true });
        } else {
          // Fallback: This is not ideal for multi-byte, but better than nothing
          // For Mini Program, normally TextDecoder is available in newer versions
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
          try {
            const data = JSON.parse(dataMatch[1]);
            
            if (data.type === 'response.output_text.delta' && data.delta) {
              onChunk(data.delta);
              fullText += data.delta;
            }
          } catch (e) {
            // Might be a partial JSON or non-JSON data line
          }
        }
      }
    });

    // Also handle finish if onComplete wasn't called by data events
  } else {
    onError(new Error('This environment does not support streaming requests (chunked response).'));
  }
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
