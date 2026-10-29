/**
 * Volcano Engine (火山方舟) OpenAI-compatible chat + Seedream image helpers.
 * Reads openai_* / image_* from admin config. Falls back when keys missing.
 */

import { getAllConfigs } from '@/modules/config/service';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function extractChatContent(message: any): string {
  const content = String(message?.content ?? '').trim();
  if (content) return content;
  const reasoning = String(message?.reasoning_content ?? '').trim();
  if (reasoning) {
    return `（模型仅返回了思考过程摘要）\n${reasoning.slice(0, 400)}`;
  }
  return '';
}

/** OpenAI-compatible chat via openai_base_url + openai_api_key + openai_model. */
export async function volcanoChat(params: {
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<{ content: string; model: string; usedLive: boolean }> {
  const configs = await getAllConfigs();
  const apiKey = (configs.openai_api_key || '').trim();
  const baseUrl = stripTrailingSlash(configs.openai_base_url || '');
  const model = (configs.openai_model || 'kimi-k3.1-pro').trim();

  if (!apiKey || !baseUrl) {
    return {
      content:
        '（未配置对话模型密钥，暂用占位回复）请在后台 AI → OpenAI 填写火山方舟 Base URL 与 API Key。你可继续描述国家/赛道，或粘贴品牌链接。',
      model: 'stub',
      usedLive: false,
    };
  }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: params.messages,
      // kimi / reasoning models need headroom or content can be empty
      max_tokens: params.maxTokens ?? 1024,
    }),
  });

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err =
      data?.error?.message || data?.message || `对话请求失败 (${resp.status})`;
    throw new Error(err);
  }

  const content = extractChatContent(data?.choices?.[0]?.message);
  return {
    content:
      content ||
      '（模型未返回正文，请稍后再试或调大 max_tokens）',
    model: data?.model || model,
    usedLive: true,
  };
}


/**
 * Stream OpenAI-compatible chat completions (SSE).
 * Yields text deltas; resolves with full content + meta when done.
 */
export async function* volcanoChatStream(params: {
  messages: ChatMessage[];
  maxTokens?: number;
}): AsyncGenerator<
  { type: 'delta'; text: string } | { type: 'done'; content: string; model: string; usedLive: boolean }
> {
  const configs = await getAllConfigs();
  const apiKey = (configs.openai_api_key || '').trim();
  const baseUrl = stripTrailingSlash(configs.openai_base_url || '');
  const model = (configs.openai_model || 'kimi-k3.1-pro').trim();

  if (!apiKey || !baseUrl) {
    const content =
      '（未配置对话模型密钥，暂用占位回复）请在后台 AI → OpenAI 填写火山方舟 Base URL 与 API Key。你可继续描述国家/赛道，或粘贴品牌链接。';
    yield { type: 'done', content, model: 'stub', usedLive: false };
    return;
  }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 1024,
      stream: true,
    }),
  });

  if (!resp.ok) {
    const data: any = await resp.json().catch(() => ({}));
    const err =
      data?.error?.message || data?.message || `对话请求失败 (${resp.status})`;
    throw new Error(err);
  }

  if (!resp.body) {
    throw new Error('对话流为空');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let usedModel = model;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let json: any;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }
      if (json?.model) usedModel = json.model;
      const choice = json?.choices?.[0];
      const delta = choice?.delta || {};
      // Only surface visible content (skip reasoning_content while model thinks)
      if (typeof delta.content === 'string' && delta.content) {
        full += delta.content;
        yield { type: 'delta', text: delta.content };
      }
    }
  }

  const content =
    full.trim() ||
    '（模型未返回正文，请稍后再试或调大 max_tokens）';
  yield {
    type: 'done',
    content,
    model: usedModel,
    usedLive: true,
  };
}

/**
 * Seedream image generation via image_base_url (or openai_base_url) + key.
 * POST /images/generations — response_format url.
 * Pass `image` (URL or data URL) for i2i / edit; omit for text-to-image.
 */
export async function volcanoGenerateImage(params: {
  prompt: string;
  size?: string;
  /** Reference image URL(s) for Seedream i2i / edit. */
  image?: string | string[];
}): Promise<{ url: string | null; usedLive: boolean; error?: string }> {
  const configs = await getAllConfigs();
  const apiKey = (
    configs.image_api_key ||
    configs.openai_api_key ||
    ''
  ).trim();
  // Prefer dedicated image endpoint (/api/v3); chat coding path may not serve images
  let baseUrl = stripTrailingSlash(
    configs.image_base_url ||
      configs.openai_base_url ||
      'https://ark.cn-beijing.volces.com/api/v3'
  );
  // If someone pointed image at the coding chat base, rewrite to /api/v3
  if (baseUrl.includes('/api/coding/')) {
    baseUrl = baseUrl.replace(/\/api\/coding\/v3$/, '/api/v3');
  }
  const model = (
    configs.image_model || 'doubao-seedream-5-0-flash-260915'
  ).trim();

  if (!apiKey || !baseUrl) {
    return { url: null, usedLive: false, error: 'missing image key/url' };
  }

  const resp = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: params.prompt,
      size: params.size || '2K',
      response_format: 'url',
      watermark: false,
      ...(params.image
        ? {
            image: params.image,
          }
        : {}),
    }),
  });

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err =
      data?.error?.message || data?.message || `生图失败 (${resp.status})`;
    return { url: null, usedLive: true, error: err };
  }

  const url =
    data?.data?.[0]?.url ||
    data?.data?.[0]?.b64_json ||
    null;
  return {
    url: typeof url === 'string' && url.startsWith('http') ? url : null,
    usedLive: true,
    error: url ? undefined : 'empty image url',
  };
}

