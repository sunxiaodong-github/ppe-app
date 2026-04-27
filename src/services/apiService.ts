/**
 * 统一 API 服务封装
 * - 请求拦截：自动携带 Token
 * - 响应拦截：统一错误处理、Token 刷新
 * - 登录：微信 code 换取后端 token
 */

const BASE_URL = 'https://www.agidata.xin';
const TOKEN_KEY = 'accessToken';
const TOKEN_EXPIRES_KEY = 'tokenExpiresAt';

// ==================== Token 管理 ====================

export function getToken(): string | null {
  return uni.getStorageSync(TOKEN_KEY);
}

export function setToken(token: string, expiresIn: number): void {
  uni.setStorageSync(TOKEN_KEY, token);
  // expiresIn 是秒，转为毫秒存起来方便比较
  const expiresAt = Date.now() + expiresIn * 1000;
  uni.setStorageSync(TOKEN_EXPIRES_KEY, expiresAt);
}

export function clearToken(): void {
  uni.removeStorageSync(TOKEN_KEY);
  uni.removeStorageSync(TOKEN_EXPIRES_KEY);
}

export function isTokenExpired(): boolean {
  const expiresAt = uni.getStorageSync(TOKEN_EXPIRES_KEY);
  if (!expiresAt) return true;
  // 提前 60 秒认为过期，避免临界问题
  return Date.now() > expiresAt - 60000;
}

// ==================== 登录 ====================

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function login(): Promise<LoginResult> {
  return new Promise((resolve) => {
    // 1. 获取微信 code
    uni.login({
      provider: 'weixin',
      success: async (loginRes) => {
        if (!loginRes.code) {
          resolve({ success: false, error: '微信登录失败，无 code' });
          return;
        }

        // 2. 发给后端换 token
        try {
          const res = await uni.request({
            url: `${BASE_URL}/api/v1/auth/login`,
            method: 'POST',
            header: { 'Content-Type': 'application/json' },
            data: { code: loginRes.code }
          });

          const data = res.data as any;
          if (data && data.code === 0 && data.data) {
            // 3. 存储 token
            setToken(data.data.accessToken, data.data.expiresIn);
            resolve({ success: true });
          } else {
            resolve({ success: false, error: data?.message || '登录失败' });
          }
        } catch (err: any) {
          resolve({ success: false, error: err?.message || '网络请求失败' });
        }
      },
      fail: (err) => {
        resolve({ success: false, error: '微信登录失败，请检查网络' });
      }
    });
  });
}

// ==================== 请求拦截器 ====================

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(token: string): void {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// 刷新 token
async function refreshToken(): Promise<string | null> {
  if (isRefreshing) {
    // 等待刷新完成
    return new Promise((resolve) => {
      subscribeTokenRefresh((token) => resolve(token));
    });
  }

  isRefreshing = true;
  clearToken();

  const result = await login();
  isRefreshing = false;

  if (result.success) {
    const token = getToken();
    if (token) {
      onTokenRefreshed(token);
      return token;
    }
  }

  // 刷新失败，所有请求需要重新登录
  onTokenRefreshed('');
  return null;
}

// 初始化拦截器（只初始化一次）
let interceptorInitialized = false;

export function initInterceptors(): void {
  if (interceptorInitialized) return;
  interceptorInitialized = true;

  // 请求拦截
  uni.addInterceptor('request', {
    invoke(options) {
      const token = getToken();
      if (token) {
        options.header = options.header || {};
        options.header['Authorization'] = `Bearer ${token}`;
      }
      return options;
    }
  });

  // 响应拦截
  uni.addInterceptor('response', {
    async return(response) {
      const statusCode = response.statusCode;

      // 非 200 HTTP 状态码
      if (statusCode !== 200) {
        if (statusCode === 401 || statusCode === 403) {
          const newToken = await refreshToken();
          if (newToken) {
            // 重试请求
            response.requestOptions.header = response.requestOptions.header || {};
            response.requestOptions.header['Authorization'] = `Bearer ${newToken}`;
            return uni.request(response.requestOptions);
          }
        }
        return Promise.reject(response);
      }

      // HTTP 200，检查业务 code
      const data = response.data as any;
      if (data && data.code !== 0) {
        if (data.code === 1002) {
          // token 无效，刷新
          const newToken = await refreshToken();
          if (newToken) {
            // 重试请求
            return uni.request(response.requestOptions);
          }
        }
        return Promise.reject(data);
      }

      return response;
    },
    fail(err) {
      return Promise.reject(err);
    }
  });
}

// ==================== 通用请求方法 ====================

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
}

export function request<T = any>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    // Add Authorization header if token exists
    const token = getToken();
    const headers: Record<string, string> = options.header || {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    uni.request({
      url: options.url,
      method: options.method || 'GET',
      header: headers,
      data: options.data,
      success: (res) => {
        const data = res.data as any;
        if (data && data.code === 0) {
          resolve(data.data);
        } else if (data && data.code !== 0) {
          reject(data);
        } else {
          resolve(res.data as T);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

// ==================== 带重试的请求 ====================

export function requestWithRetry<T = any>(
  options: RequestOptions,
  maxRetries = 1
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await request<T>(options);
      resolve(result);
    } catch (err: any) {
      if (maxRetries > 0 && err?.code === 1002) {
        // token 无效，刷新后重试
        const newToken = await refreshToken();
        if (newToken) {
          const retryResult = await request<T>(options);
          resolve(retryResult);
          return;
        }
      }
      reject(err);
    }
  });
}
