/**
 * lk888.ai media video API (NOT OpenAI /videos).
 * Flow: POST /v1/media/generate → poll GET /v1/media/status?task_id= → download result_url
 *
 * Primary: gk-video-3.5 (display GK-video-3.5 / MC-GK1.5官转, I2V, images required)
 * Fallback: minimax-h3 (display MiniMax H3 / RQ2) — once on submit/poll failure
 */
import { getAllConfigs } from '@/modules/config/service';

const DEFAULT_BASE = 'https://api.lk888.ai';
const DEFAULT_MODEL = 'gk-video-3.5';
const DEFAULT_FALLBACK = 'minimax-h3';

export type Lk888VideoStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'queued'
  | 'in_progress'
  | 'completed'
  | string;

export type Lk888VideoTask = {
  id: string;
  status: Lk888VideoStatus;
  progress?: number;
  error?: { message?: string } | string | null;
  model?: string;
  resultUrl?: string;
  isFinal?: boolean;
  raw?: unknown;
};

function stripTrailingSlash(u: string) {
  return u.replace(/\/+$/, '');
}

/** Normalize display / alias names to canonical API model ids. */
export function canonicalizeVideoModel(model: string): string {
  const m = (model || '').trim();
  const lower = m.toLowerCase().replace(/\s+/g, '-');
  if (lower === 'gk-video-3.5' || lower === 'gk-video-3' || m === 'GK-video-3.5') {
    return 'gk-video-3.5';
  }
  if (
    lower === 'minimax-h3' ||
    lower === 'minimax-h3' ||
    m === 'MiniMax H3' ||
    m === 'MiniMax-H3'
  ) {
    return 'minimax-h3';
  }
  return m || DEFAULT_MODEL;
}

function isGkModel(model: string) {
  return canonicalizeVideoModel(model) === 'gk-video-3.5';
}

function coerceDuration(model: string, raw: number): number {
  const n = Number.isFinite(raw) ? Math.round(raw) : 10;
  if (isGkModel(model)) {
    if (n < 1) return 10;
    if (n > 15) return 15;
    return n;
  }
  // minimax-h3: 4–15
  if (n < 4) return 10;
  if (n > 15) return 15;
  return n;
}

function resolutionFor(model: string, preferred?: string): string {
  if (isGkModel(model)) {
    const p = (preferred || '720p').toLowerCase();
    return p === '480p' ? '480p' : '720p';
  }
  const p = (preferred || '768P').toUpperCase();
  if (p === '1080P' || p === '2K' || p === '4K' || p === '768P') return p;
  return '768P';
}

export async function resolveLk888VideoConfig(): Promise<{
  apiKey: string;
  baseUrl: string;
  model: string;
  fallbackModel: string;
  duration: number;
  ratio: '9:16' | '16:9';
  resolution: string;
}> {
  const configs = await getAllConfigs();
  const apiKey = (
    configs.video_api_key ||
    process.env.LK888_VIDEO_API_KEY ||
    process.env.VIDEO_API_KEY ||
    process.env.WUYEAI_API_KEY ||
    ''
  ).trim();
  const baseUrl = stripTrailingSlash(
    (
      configs.video_base_url ||
      process.env.LK888_BASE_URL ||
      process.env.WUYEAI_BASE_URL ||
      DEFAULT_BASE
    ).trim() || DEFAULT_BASE
  );
  const model = canonicalizeVideoModel(
    (
      configs.video_model ||
      process.env.LK888_VIDEO_MODEL ||
      process.env.WUYEAI_VIDEO_MODEL ||
      DEFAULT_MODEL
    ).trim()
  );
  const fallbackModel = canonicalizeVideoModel(
    (
      configs.video_model_fallback ||
      process.env.LK888_VIDEO_MODEL_FALLBACK ||
      DEFAULT_FALLBACK
    ).trim() || DEFAULT_FALLBACK
  );
  const durationRaw = Number(
    configs.video_duration ||
      process.env.LK888_VIDEO_DURATION ||
      process.env.WUYEAI_VIDEO_DURATION ||
      '10'
  );
  const duration = coerceDuration(model, durationRaw);
  const ratioRaw = (
    configs.video_ratio ||
    process.env.LK888_VIDEO_RATIO ||
    process.env.WUYEAI_VIDEO_RATIO ||
    '16:9'
  ).trim();
  // Default landscape HD; only force portrait when explicitly 9:16
  const ratio: '9:16' | '16:9' = ratioRaw === '9:16' ? '9:16' : '16:9';
  const resolution = resolutionFor(
    model,
    (configs.video_resolution || process.env.LK888_VIDEO_RESOLUTION || '').trim() ||
      undefined
  );
  return {
    apiKey,
    baseUrl,
    model,
    fallbackModel,
    duration,
    ratio,
    resolution,
  };
}

async function lkFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
}

function extractTaskId(json: any): string {
  const candidates = [
    json?.data?.task_id,
    json?.data?.id,
    json?.task_id,
    json?.id,
    Array.isArray(json?.data?.task_ids) ? json.data.task_ids[0] : null,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).trim()) return String(c);
  }
  return '';
}

function extractDirectUrl(json: any): string {
  if (typeof json?.data?.url === 'string' && /^https?:\/\//i.test(json.data.url)) {
    return json.data.url;
  }
  if (Array.isArray(json?.data) && json.data[0]?.url) {
    return String(json.data[0].url);
  }
  if (typeof json?.result_url === 'string' && /^https?:\/\//i.test(json.result_url)) {
    return json.result_url;
  }
  return '';
}

function buildParams(input: {
  model: string;
  prompt: string;
  referenceImages: string[];
  duration: number;
  ratio: '9:16' | '16:9';
  resolution: string;
}): Record<string, unknown> {
  const model = canonicalizeVideoModel(input.model);
  const images = input.referenceImages.filter((u) => /^https?:\/\//i.test(u));
  const duration = String(coerceDuration(model, input.duration));
  const aspect_ratio = input.ratio === '16:9' ? '16:9' : '9:16';
  const resolution = resolutionFor(model, input.resolution);

  if (isGkModel(model)) {
    // I2V only — images required (array even for one)
    if (!images.length) {
      throw new Error(
        'gk-video-3.5 仅支持图生视频，需要至少 1 张公网参考图（锁定概念图或叙事长图）'
      );
    }
    return {
      prompt: input.prompt,
      images: [images[0]],
      aspect_ratio,
      resolution,
      duration,
    };
  }

  // minimax-h3: T2V or reference
  const params: Record<string, unknown> = {
    prompt: input.prompt,
    duration,
    aspect_ratio,
    resolution,
  };
  if (images.length) {
    params.mode = 'cankaosheng';
    params.image_url = images.slice(0, 9);
  }
  return params;
}

export async function submitLk888Video(params: {
  prompt: string;
  referenceImages?: string[];
  duration?: number;
  ratio?: '9:16' | '16:9';
  model?: string;
}): Promise<{ taskId: string; model: string; raw: unknown }> {
  const cfg = await resolveLk888VideoConfig();
  if (!cfg.apiKey) {
    throw new Error(
      '未配置视频 API Key（video_api_key / LK888_VIDEO_API_KEY / VIDEO_API_KEY）'
    );
  }
  const model = canonicalizeVideoModel(params.model || cfg.model);
  const referenceImages = (params.referenceImages || [])
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 9);
  const duration = coerceDuration(model, params.duration ?? cfg.duration);
  const ratio = params.ratio || cfg.ratio;
  const resolution = resolutionFor(model, cfg.resolution);

  const bodyParams = buildParams({
    model,
    prompt: params.prompt,
    referenceImages,
    duration,
    ratio,
    resolution,
  });

  // Documented shape: top-level model + prompt, params object for the rest
  const { prompt: _p, ...rest } = bodyParams;
  const body: Record<string, unknown> = {
    model,
    prompt: params.prompt,
    params: rest,
  };

  const resp = await lkFetch(cfg.baseUrl, cfg.apiKey, '/v1/media/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!resp.ok) {
    const msg =
      json?.error?.message ||
      json?.msg ||
      json?.message ||
      text.slice(0, 400) ||
      `submit failed (${resp.status})`;
    throw new Error(msg);
  }
  // Sync URL rare for video; still handle
  const direct = extractDirectUrl(json);
  if (direct) {
    return { taskId: `direct:${direct}`, model, raw: json };
  }
  const taskId = extractTaskId(json);
  if (!taskId) throw new Error('视频任务未返回 task_id');
  return { taskId, model, raw: json };
}

/**
 * Submit primary GK; on missing refs or submit failure, retry once with MiniMax fallback.
 */
export async function submitLk888VideoWithFallback(params: {
  prompt: string;
  referenceImages?: string[];
  duration?: number;
  ratio?: '9:16' | '16:9';
  model?: string;
  fallbackModel?: string;
}): Promise<{
  taskId: string;
  model: string;
  usedFallback: boolean;
  raw: unknown;
}> {
  const cfg = await resolveLk888VideoConfig();
  const primary = canonicalizeVideoModel(params.model || cfg.model);
  const fallback = canonicalizeVideoModel(
    params.fallbackModel || cfg.fallbackModel || DEFAULT_FALLBACK
  );
  const refs = (params.referenceImages || []).filter((u) =>
    /^https?:\/\//i.test(u)
  );

  const trySubmit = async (model: string) =>
    submitLk888Video({
      ...params,
      model,
      referenceImages: refs,
    });

  // gk-video-3.5 requires an image — skip to MiniMax fallback when none
  if (isGkModel(primary) && !refs.length) {
    const submitted = await trySubmit(fallback);
    return {
      taskId: submitted.taskId,
      model: submitted.model,
      usedFallback: true,
      raw: submitted.raw,
    };
  }

  try {
    const submitted = await trySubmit(primary);
    return {
      taskId: submitted.taskId,
      model: submitted.model,
      usedFallback: false,
      raw: submitted.raw,
    };
  } catch (err) {
    if (canonicalizeVideoModel(fallback) === primary) throw err;
    const submitted = await trySubmit(fallback);
    return {
      taskId: submitted.taskId,
      model: submitted.model,
      usedFallback: true,
      raw: submitted.raw,
    };
  }
}

function mapStateToStatus(state: string): Lk888VideoStatus {
  const raw = (state || '').trim();
  const s = raw.toLowerCase();
  // English
  if (s === 'success' || s === 'completed' || s === 'succeeded' || s === 'done') {
    return 'completed';
  }
  if (
    s === 'failed' ||
    s === 'error' ||
    s === 'cancelled' ||
    s === 'canceled' ||
    s === 'fail'
  ) {
    return 'failed';
  }
  if (
    s === 'running' ||
    s === 'in_progress' ||
    s === 'processing' ||
    s === 'generating'
  ) {
    return 'in_progress';
  }
  if (s === 'pending' || s === 'queued' || s === 'waiting') return 'queued';
  // Defensive: some admin UIs expose Chinese labels; business logic still prefers
  // is_final + result_url below, but map common Chinese so we do not stay "unknown".
  if (/成功|完成|已完成|已成功/.test(raw)) return 'completed';
  if (/失败|错误|取消/.test(raw)) return 'failed';
  if (/进行中|处理中|生成中|运行中/.test(raw)) return 'in_progress';
  if (/排队|等待|待处理/.test(raw)) return 'queued';
  return raw || 'unknown';
}

function pickResultUrl(json: any): string {
  const candidates = [
    json?.result_url,
    json?.data?.result_url,
    Array.isArray(json?.result_urls) ? json.result_urls[0] : null,
    Array.isArray(json?.data?.result_urls) ? json.data.result_urls[0] : null,
    json?.url,
    json?.data?.url,
    Array.isArray(json?.urls) ? json.urls[0] : null,
    Array.isArray(json?.data?.urls) ? json.data.urls[0] : null,
    json?.output?.url,
    json?.data?.output?.url,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c.trim())) return c.trim();
  }
  return '';
}

export async function getLk888VideoTask(
  taskId: string
): Promise<Lk888VideoTask> {
  const cfg = await resolveLk888VideoConfig();
  if (!cfg.apiKey) throw new Error('未配置视频 API Key');

  // Synthetic sync result
  if (taskId.startsWith('direct:')) {
    const url = taskId.slice('direct:'.length);
    return {
      id: taskId,
      status: 'completed',
      progress: 100,
      resultUrl: url,
      isFinal: true,
    };
  }

  const resp = await lkFetch(
    cfg.baseUrl,
    cfg.apiKey,
    `/v1/media/status?task_id=${encodeURIComponent(taskId)}`
  );
  const text = await resp.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!resp.ok) {
    const msg =
      json?.error?.message ||
      json?.msg ||
      json?.message ||
      text.slice(0, 400) ||
      `poll failed (${resp.status})`;
    throw new Error(msg);
  }

  // Prefer English `state`; never trust Chinese `status` / `status_group` alone.
  const state = String(
    json?.state ||
      json?.data?.state ||
      // Fallback only when state missing: still map via mapStateToStatus
      json?.status ||
      json?.data?.status ||
      ''
  );
  const isFinal = Boolean(json?.is_final ?? json?.data?.is_final);
  const resultUrl = pickResultUrl(json);
  const progressRaw = json?.progress ?? json?.data?.progress;
  const progress =
    typeof progressRaw === 'number'
      ? progressRaw
      : typeof progressRaw === 'string' && progressRaw.trim()
        ? Number(progressRaw)
        : undefined;
  const errField = json?.error ?? json?.data?.error ?? null;
  const error =
    errField === null || errField === ''
      ? null
      : typeof errField === 'string'
        ? errField
        : errField?.message || JSON.stringify(errField);

  let status = mapStateToStatus(state);
  // Provider admin "ready" often means result_url is populated — treat as completed
  // even if state string is odd / Chinese / missing.
  if (resultUrl && status !== 'failed') status = 'completed';
  if (isFinal && resultUrl && status !== 'failed') status = 'completed';
  if (isFinal && !resultUrl && error) status = 'failed';

  return {
    id: String(json?.task_id || taskId),
    status,
    progress: Number.isFinite(progress as number) ? (progress as number) : undefined,
    error,
    resultUrl: resultUrl || undefined,
    isFinal,
    raw: json,
  };
}

export async function downloadLk888VideoContent(
  taskId: string,
  resultUrlHint?: string
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const cfg = await resolveLk888VideoConfig();
  if (!cfg.apiKey) throw new Error('未配置视频 API Key');

  let url = resultUrlHint || '';
  if (taskId.startsWith('direct:')) {
    url = taskId.slice('direct:'.length);
  }
  if (!url) {
    const task = await getLk888VideoTask(taskId);
    if (!isLk888VideoReady(task.status) || !task.resultUrl) {
      throw new Error('视频尚未就绪或缺少 result_url');
    }
    url = task.resultUrl;
  }

  const resp = await fetch(url, {
    headers: {
      // Some CDNs are public; send bearer only if same host family
      ...(url.includes('lk888') || url.includes('lk666')
        ? { Authorization: `Bearer ${cfg.apiKey}` }
        : {}),
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text.slice(0, 400) || `download failed (${resp.status})`);
  }
  const ab = await resp.arrayBuffer();
  const contentType = resp.headers.get('Content-Type') || 'video/mp4';
  return { bytes: new Uint8Array(ab), contentType };
}

export function isLk888VideoTerminal(status: string) {
  const s = (status || '').toLowerCase();
  return (
    s === 'completed' ||
    s === 'success' ||
    s === 'failed' ||
    s === 'cancelled' ||
    s === 'canceled'
  );
}

export function isLk888VideoReady(status: string) {
  const s = (status || '').toLowerCase();
  return s === 'completed' || s === 'success';
}

// Back-compat aliases used by older call sites during migration
export const resolveWuyeVideoConfig = resolveLk888VideoConfig;
export const submitWuyeVideo = submitLk888Video;
export const getWuyeVideoTask = getLk888VideoTask;
export const downloadWuyeVideoContent = downloadLk888VideoContent;
export const isWuyeVideoTerminal = isLk888VideoTerminal;
export const isWuyeVideoReady = isLk888VideoReady;
