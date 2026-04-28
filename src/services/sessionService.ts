/**
 * Service for session management (history)
 */

import { request } from './apiService';

const BASE_URL = 'https://www.agidata.xin';

export interface SessionItem {
  sessionId: string;
  title: string;
  lastReplyPreview: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface SessionsResponse {
  items: SessionItem[];
  total?: number;
  page: number;
  pageSize: number;
}

export interface SessionMessagesResponse {
  sessionId: string;
  title: string;
  messages: SessionMessage[];
}

export interface Feedback {
  id: number;
  feedbackType: string;
  contact: string | null;
  reasonText: string | null;
  createdAt: string;
}

export interface SessionMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  feedback: Feedback | null;
  errorCode: string | null;
  createdAt: string;
}

// 获取会话列表
export async function getSessions(params?: {
  page?: number;
  pageSize?: number;
}): Promise<SessionsResponse> {
  const result = await request<SessionsResponse>({
    url: `${BASE_URL}/api/v1/sessions`,
    method: 'GET',
    data: params
  });
  return result;
}

// 获取会话消息
export async function getSessionMessages(sessionId: string): Promise<SessionMessagesResponse> {
  const result = await request<SessionMessagesResponse>({
    url: `${BASE_URL}/api/v1/sessions/${sessionId}/messages`,
    method: 'GET'
  });
  return result;
}

// 删除会话
export async function deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
  const result = await request<{ deleted: boolean }>({
    url: `${BASE_URL}/api/v1/sessions/${sessionId}`,
    method: 'DELETE'
  });
  return result;
}
