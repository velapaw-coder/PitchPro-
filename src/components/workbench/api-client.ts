export type ApiProject = {
  id: string;
  userId: string;
  brandName: string;
  country: string;
  track: string;
  stage: string;
  brandId: string | null;
  lockedDesignId?: string | null;
  pinned: boolean;
  note: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type ApiBrief = {
  id: string;
  projectId: string;
  country: string;
  track: string;
  brandName: string;
  goals: string;
  constraints: string;
  audience: string;
  opportunity: string;
  designDirection: string;
  status: string;
  confirmedAt: string | Date | null;
};

export type ApiBrandCard = {
  id: string;
  name: string;
  country: string;
  track: string;
  tone: string;
  imageUrl: string;
  website: string;
  instagram: string;
  facebook: string;
  matchReason: string;
  needsConfirm?: boolean;
};

export type ApiShelfBrand = ApiBrandCard & {
  source?: string;
  status?: string;
};

export type ApiAsset = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  textPreview: string;
  projectId?: string | null;
  createdAt: string | Date;
};

export type ApiChatAttachment = {
  assetId: string;
  fileName: string;
  title: string;
  mimeType: string;
  size: number;
};

export type ApiChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  attachments: ApiChatAttachment[];
  createdAt?: string | Date;
};


export type ApiDesignConcept = {
  id: string;
  projectId: string;
  title: string;
  direction: string;
  summary: string;
  imageUrl: string;
  palette: string;
  locked: boolean;
  version: number;
  status: string;
};

export type ApiDeliverable = {
  id: string;
  projectId: string;
  designId: string;
  kind: string;
  title: string;
  summary: string;
  content: string;
  fileUrl: string;
  version: number;
  status: string;
};

export type ApiGhlHistoryItem = {
  id: string;
  mode: string;
  status: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  note: string;
  externalContactId: string;
  externalOpportunityId: string;
  errorMessage: string;
  syncedAt?: string | Date | null;
};

export type ApiGhlOutreachEmail = {
  subject: string;
  body: string;
  languageName: string;
  markdown: string;
};

export type ApiGhlPreview = {
  mode: 'mock' | 'live' | string;
  contact: { name: string; email: string; phone: string };
  note: string;
  attachmentTitles: string[];
  opportunityName: string;
  outreachEmail?: ApiGhlOutreachEmail;
};

export type ApiVideoRefPrecheck = {
  conceptUrl: string;
  longUrl: string;
  httpsRefs: string[];
  hasConceptHttps: boolean;
  hasLongHttps: boolean;
  okForGk: boolean;
  willFallbackWithoutImage: boolean;
  tipZh: string;
  warnZh: string;
};

/** Enterprise asset file upload ceiling — keep in sync with assets route + next.config. */
export const MAX_ENTERPRISE_ASSET_MB = 25;
export const MAX_ENTERPRISE_ASSET_BYTES = MAX_ENTERPRISE_ASSET_MB * 1024 * 1024;

async function parse<T>(res: Response): Promise<T> {
  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    const lower = raw.trim().toLowerCase();
    if (
      res.status === 413 ||
      lower.includes('payload too large') ||
      lower.includes('request entity too large') ||
      lower.includes('request body too large')
    ) {
      throw new Error(
        `文件过大（单文件上限 ${MAX_ENTERPRISE_ASSET_MB}MB）。请压缩 PDF／拆分后再传。`
      );
    }
    throw new Error(
      raw.trim().slice(0, 180) || `请求失败（HTTP ${res.status}）`
    );
  }
  if (!json || typeof json !== 'object') {
    throw new Error(`请求失败（HTTP ${res.status}）`);
  }
  if (json.code !== 0) {
    throw new Error(json.message || '请求失败');
  }
  return json.data as T;
}

export const pitchApi = {
  listProjects: () =>
    fetch('/api/pitchpro/projects').then((r) => parse<ApiProject[]>(r)),

  createProject: (body: Partial<ApiProject> = {}) =>
    fetch('/api/pitchpro/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => parse<ApiProject>(r)),

  getProject: (id: string) =>
    fetch(`/api/pitchpro/projects/${id}`).then((r) =>
      parse<{ project: ApiProject; brief: ApiBrief }>(r)
    ),

  updateProject: (id: string, body: Record<string, unknown>) =>
    fetch(`/api/pitchpro/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => parse<ApiProject>(r)),

  archiveProject: (id: string) =>
    fetch(`/api/pitchpro/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    }).then((r) => parse<ApiProject>(r)),

  deleteProject: (id: string) =>
    fetch(`/api/pitchpro/projects/${id}`, { method: 'DELETE' }).then((r) =>
      parse<unknown>(r)
    ),

  attachBrand: (
    id: string,
    brand: Partial<ApiBrandCard> & { name: string },
    saveToShelf = true
  ) =>
    fetch(`/api/pitchpro/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachBrand: brand, saveToShelf }),
    }).then((r) => parse<any>(r)),

  getBrief: (id: string) =>
    fetch(`/api/pitchpro/projects/${id}/brief`).then((r) => parse<ApiBrief>(r)),

  saveBrief: (id: string, brief: Partial<ApiBrief>) =>
    fetch(`/api/pitchpro/projects/${id}/brief`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brief),
    }).then((r) => parse<ApiBrief>(r)),

  confirmBrief: (id: string, brief?: Partial<ApiBrief>) =>
    fetch(`/api/pitchpro/projects/${id}/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', brief }),
    }).then((r) =>
      parse<{ brief: ApiBrief; project: ApiProject }>(r)
    ),

  reopenBrief: (id: string) =>
    fetch(`/api/pitchpro/projects/${id}/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reopen' }),
    }).then((r) =>
      parse<{
        brief: ApiBrief;
        project: ApiProject;
        chatMessage?: ApiChatMessage | null;
      }>(r)
    ),

  listMessages: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/messages`).then((r) =>
      parse<ApiChatMessage[]>(r)
    ),

  appendMessage: (
    projectId: string,
    body: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      attachments?: ApiChatAttachment[];
    }
  ) =>
    fetch(`/api/pitchpro/projects/${projectId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => parse<ApiChatMessage>(r)),

  /**
   * User message + live volcano assistant reply (both persisted).
   * Uses SSE by default; optional onDelta for token streaming UI.
   */
  chat: async (
    projectId: string,
    body: { content: string; attachments?: ApiChatAttachment[] },
    opts?: { onDelta?: (text: string) => void; onUser?: (user: ApiChatMessage) => void }
  ) => {
    const resp = await fetch(`/api/pitchpro/projects/${projectId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });

    const ctype = resp.headers.get('content-type') || '';
    // Legacy JSON fallback
    if (!ctype.includes('text/event-stream')) {
      return parse<{
        user: ApiChatMessage;
        assistant: ApiChatMessage;
        usedLive: boolean;
        model: string;
        brief?: ApiBrief;
        project?: ApiProject;
      }>(resp);
    }

    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => '');
      throw new Error(errText || `Chat failed (${resp.status})`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let final: {
      user: ApiChatMessage;
      assistant: ApiChatMessage;
      usedLive: boolean;
      model: string;
      brief?: ApiBrief;
      project?: ApiProject;
    } | null = null;
    let errorMessage: string | null = null;

    const handleBlock = (block: string) => {
      const lines = block.split('\n');
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) return;
      let data: any;
      try {
        data = JSON.parse(dataLines.join('\n'));
      } catch {
        return;
      }
      if (event === 'user') {
        opts?.onUser?.(data as ApiChatMessage);
      } else if (event === 'delta' && typeof data?.text === 'string') {
        opts?.onDelta?.(data.text);
      } else if (event === 'done') {
        final = data;
      } else if (event === 'error') {
        errorMessage = data?.message || 'Chat failed';
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        if (part.trim()) handleBlock(part);
      }
    }
    if (buffer.trim()) handleBlock(buffer);

    if (errorMessage) throw new Error(errorMessage);
    if (!final) throw new Error('Chat stream ended without result');
    return final;
  },

  searchBrands: (q: {
    country?: string;
    track?: string;
    query?: string;
    url?: string;
  }) =>
    fetch('/api/pitchpro/brands/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q),
    }).then((r) =>
      parse<{ items: ApiBrandCard[]; source: string; notice: string }>(r)
    ),

  listShelf: () =>
    fetch('/api/pitchpro/brands').then((r) => parse<ApiShelfBrand[]>(r)),

  saveShelf: (brand: Partial<ApiBrandCard> & { name: string }) =>
    fetch('/api/pitchpro/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brand),
    }).then((r) => parse<ApiShelfBrand>(r)),

  listAssets: () =>
    fetch('/api/pitchpro/assets').then((r) => parse<ApiAsset[]>(r)),

  uploadAssetFile: async (
    file: File,
    opts?: { title?: string; projectId?: string }
  ) => {
    if (file.size > MAX_ENTERPRISE_ASSET_BYTES) {
      throw new Error(
        `文件过大（单文件上限 ${MAX_ENTERPRISE_ASSET_MB}MB，当前 ${(file.size / (1024 * 1024)).toFixed(1)}MB）。请压缩 PDF／拆分后再传。`
      );
    }
    const fd = new FormData();
    fd.append('file', file);
    if (opts?.title) fd.append('title', opts.title);
    if (opts?.projectId) fd.append('projectId', opts.projectId);
    return fetch('/api/pitchpro/assets', { method: 'POST', body: fd }).then(
      (r) => parse<ApiAsset>(r)
    );
  },

  createAssetNote: (
    title: string,
    textContent: string,
    projectId?: string
  ) =>
    fetch('/api/pitchpro/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        fileName: `${title}.txt`,
        textContent,
        projectId,
      }),
    }).then((r) => parse<ApiAsset>(r)),

  deleteAsset: (id: string) =>
    fetch(`/api/pitchpro/assets?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).then((r) => parse<unknown>(r)),

  listDesigns: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/designs`).then((r) =>
      parse<ApiDesignConcept[]>(r)
    ),

  regenerateDesigns: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/designs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate', force: true }),
    }).then((r) => parse<ApiDesignConcept[]>(r)),

  lockDesign: (projectId: string, designId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/designs/${designId}/lock`, {
      method: 'POST',
    }).then((r) =>
      parse<{
        design: ApiDesignConcept;
        project: ApiProject;
        deliverables: ApiDeliverable[];
        chatMessage?: ApiChatMessage;
      }>(r)
    ),

  /** Per-image edit (Seedream i2i) or single-slot regen. */
  refineDesign: (
    projectId: string,
    designId: string,
    opts: { instruction?: string; mode?: 'edit' | 'regen' | 'remove-bg' }
  ) =>
    fetch(
      `/api/pitchpro/projects/${projectId}/designs/${designId}/refine`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: opts.instruction || '',
          mode: opts.mode || 'edit',
        }),
      }
    ).then((r) =>
      parse<{
        design: ApiDesignConcept;
        chatMessage: ApiChatMessage;
        apiPath: 'i2i-edit' | 't2i-regen' | string;
      }>(r)
    ),

  getPdp: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/pdp`).then((r) =>
      parse<{
        pdp: ApiDeliverable | null;
        project: ApiProject;
        lockedDesignId: string | null;
        stage: string;
        narrativeChatMessage?: ApiChatMessage;
        longImageUrls?: string[];
        selectedLongImageUrl?: string;
      }>(r)
    ),

  regeneratePdp: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/pdp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate', force: true }),
    }).then((r) =>
      parse<{
        pdp: ApiDeliverable | null;
        project: ApiProject;
        lockedDesignId: string;
      }>(r)
    ),

  confirmNarrative: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/pdp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm-narrative' }),
    }).then((r) =>
      parse<{
        project: ApiProject;
        pdp: ApiDeliverable;
        chatMessage: ApiChatMessage;
        longImageUrls?: string[];
        status?: 'generating' | 'ready' | 'failed';
      }>(r)
    ),

  advanceLongImages: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/pdp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'advance-long-images' }),
    }).then((r) =>
      parse<{
        project: ApiProject;
        pdp: ApiDeliverable;
        longImageUrls?: string[];
        status?: 'generating' | 'ready' | 'failed';
        chatMessage?: ApiChatMessage;
        progress?: { done: number; total: number };
      }>(r)
    ),

  selectPdpLongImage: (projectId: string, url: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/pdp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'select-long-image', url }),
    }).then((r) =>
      parse<{
        project: ApiProject;
        pdp: ApiDeliverable;
      }>(r)
    ),

  confirmPdp: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/pdp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm' }),
    }).then((r) =>
      parse<{
        project: ApiProject;
        deliverables: ApiDeliverable[];
        pdp: ApiDeliverable;
        chatMessage?: ApiChatMessage;
      }>(r)
    ),


  confirmProposalPdf: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm-proposal' }),
    }).then((r) =>
      parse<{
        project: ApiProject;
        proposal: ApiDeliverable;
        chatMessage: ApiChatMessage;
        fileUrl: string;
        videoChatMessage?: ApiChatMessage;
      }>(r)
    ),

  /** Focus left chat to revise outline; does not generate PDF. */
  beginProposalRevise: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revise-proposal' }),
    }).then((r) =>
      parse<{
        project: ApiProject;
        proposalChatMessage?: ApiChatMessage | null;
        chatMessage: ApiChatMessage;
      }>(r)
    ),

  advanceToVideo: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'advance_video' }),
    }).then((r) =>
      parse<{
        project: ApiProject;
        videoChatMessage?: ApiChatMessage;
      }>(r)
    ),

  advanceAssets: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'advance_assets' }),
    }).then((r) => parse<{ project: ApiProject }>(r)),

  listDeliverables: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/deliverables`).then((r) =>
      parse<{
        items: ApiDeliverable[];
        lockedDesignId: string | null;
        stage: string;
        proposalChatMessage?: ApiChatMessage;
        videoChatMessage?: ApiChatMessage;
        videoPrecheck?: ApiVideoRefPrecheck;
      }>(r)
    ),

  regenerateDeliverables: (projectId: string, designId?: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate', force: true, designId }),
    }).then((r) =>
      parse<{
        items: ApiDeliverable[];
        lockedDesignId: string;
        proposalChatMessage?: ApiChatMessage;
        videoChatMessage?: ApiChatMessage;
      }>(r)
    ),

  advanceFollowup: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'advance_followup' }),
    }).then((r) => parse<{ project: ApiProject }>(r)),

  getGhl: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/ghl`).then((r) =>
      parse<{
        meta: { mode: 'mock' | 'live'; configured: boolean };
        preview: ApiGhlPreview;
        history: ApiGhlHistoryItem[];
      }>(r)
    ),

  syncGhl: (
    projectId: string,
    body: {
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      note?: string;
    }
  ) =>
    fetch(`/api/pitchpro/projects/${projectId}/ghl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) =>
      parse<{ sync: ApiGhlHistoryItem; preview: ApiGhlPreview }>(r)
    ),

  exportMarkdownUrl: (projectId: string) =>
    `/api/pitchpro/projects/${projectId}/export`,

  exportZipUrl: (projectId: string) =>
    `/api/pitchpro/projects/${projectId}/export?format=zip`,

  proposalPdfUrl: (projectId: string) =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/pitchpro/projects/${projectId}/proposal-pdf`
      : `/api/pitchpro/projects/${projectId}/proposal-pdf`,

  /** Auth-cookie fetch → blob → open/download (relative markdown links don't work in chat). */
  openProposalPdf: async (projectId: string, opts?: { download?: boolean }) => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/pitchpro/projects/${projectId}/proposal-pdf`
        : `/api/pitchpro/projects/${projectId}/proposal-pdf`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as { message?: string }));
      throw new Error(
        (j as { message?: string }).message || `打开 PDF 失败 (${res.status})`
      );
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename="([^"]+)"/.exec(cd);
    const name = m?.[1] || 'product-proposal.pdf';
    const objectUrl = URL.createObjectURL(blob);
    try {
      if (opts?.download) {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const w = window.open(objectUrl, '_blank', 'noopener,noreferrer');
        if (!w) {
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      }
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }
  },


  confirmVideo: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm-video' }),
    }).then((r) =>
      parse<{
        project: ApiProject;
        video: ApiDeliverable;
        chatMessage: ApiChatMessage;
        status: 'generating' | 'ready' | 'failed';
        taskId: string;
        fileUrl?: string;
      }>(r)
    ),

  pollVideo: (projectId: string) =>
    fetch(`/api/pitchpro/projects/${projectId}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'poll-video' }),
    }).then((r) =>
      parse<{
        project: ApiProject;
        video: ApiDeliverable;
        status: 'generating' | 'ready' | 'failed';
        taskId: string;
        progress?: number;
        chatMessage?: ApiChatMessage;
        fileUrl?: string;
      }>(r)
    ),

  videoUrl: (projectId: string) =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/pitchpro/projects/${projectId}/video`
      : `/api/pitchpro/projects/${projectId}/video`,

  /** Auth-cookie fetch → blob → open/download video. */
  openVideo: async (projectId: string, opts?: { download?: boolean }) => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/pitchpro/projects/${projectId}/video`
        : `/api/pitchpro/projects/${projectId}/video`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as { message?: string }));
      throw new Error(
        (j as { message?: string }).message || `打开视频失败 (${res.status})`
      );
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename="([^"]+)"/.exec(cd);
    const name = m?.[1] || 'lifestyle-video.mp4';
    const objectUrl = URL.createObjectURL(blob);
    try {
      if (opts?.download) {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const w = window.open(objectUrl, '_blank', 'noopener,noreferrer');
        if (!w) {
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      }
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
    }
    return objectUrl;
  },

  seedDemo: () =>
    fetch('/api/pitchpro/demo/seed', { method: 'POST' }).then((r) =>
      parse<ApiProject>(r)
    ),
};
