/**
 * Service to submit feedback for AI responses
 */

import { request } from './apiService';

const BASE_URL = 'https://www.agidata.xin';

export interface FeedbackParams {
  messageId: number;
  feedbackType: string;
  contact?: string;
  reasonText?: string;
}

export async function submitFeedback(params: FeedbackParams): Promise<{ feedbackId: number }> {
  const result = await request<{ feedbackId: number }>({
    url: `${BASE_URL}/api/v1/feedback/submit`,
    method: 'POST',
    data: params
  });
  return result;
}
