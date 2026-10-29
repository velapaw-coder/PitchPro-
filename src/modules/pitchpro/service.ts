import path from 'path';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  enterpriseAsset,
  enterpriseBrand,
  pitchBrief,
  pitchChatMessage,
  pitchDeliverable,
  pitchDesignConcept,
  pitchGhlSync,
  pitchProject,
  type EnterpriseAsset,
  type EnterpriseBrand,
  type PitchBrief,
  type PitchChatMessage,
  type PitchDeliverable,
  type PitchDesignConcept,
  type PitchGhlSync,
  type PitchProject,
} from '@/config/db/schema';
import { getUuid } from '@/lib/hash';

import {
  stubBrandFromUrl,
  stubSearchBrands,
  type BrandSearchCard,
} from './brand-search-stub';
import {
  buildDeliverablePack,
  buildDesignStubs,
  buildOutreachEmail,
} from './design-stub';
import {
  NARRATIVE_MARKER,
  PROPOSAL_MARKER,
  VIDEO_MARKER,
  toApiChatMessage,
} from './chat-serialize';
import {
  downloadLk888VideoContent,
  getLk888VideoTask,
  isLk888VideoReady,
  isLk888VideoTerminal,
  resolveLk888VideoConfig,
  submitLk888VideoWithFallback,
} from './lk888-video';
import {
  buildPdpCopy,
  buildProposalContent,
  isLegacyThinProposalOutline,
  mergeDeliveryIntoConstraints,
  parseDeliveryFacts,
  buildPdpNarrativeIntro,
  buildPdpStructured,
  embedPdpLongImages,
  formatNarrativeChatMessage,
  formatPdpChatMessage,
  mergePdpStructured,
  parsePdpLongImages,
  parsePdpStructured,
  resolveMarketCulture,
  resolveBrandLifestyleForPrompt,
  resolveOnImageLanguage,
  serializePdpContent,
  type PdpStructured,
  assertDeliveryGate,
  isDeliveryDeferred,
  type ProposalDeliveryFacts,
} from './pdp-copy';
import { volcanoChat, volcanoChatStream, volcanoGenerateImage } from './volc-ai';
import {
  extractPdfText,
  isAssetTextPlaceholder,
  pdfEmptyExtractNote,
  pdfPartialExtractPrefix,
} from './pdf-text';

import { getRequestExecutionContext } from 'vinext/shims/request-context';
import {
  buildGhlPreview,
  getGhlMode,
  pushGhlSync,
  type GhlSyncPreview,
} from './ghl-client';

export type { BrandSearchCard };
export { stubBrandFromUrl };

export const STAGE_LABEL: Record<string, string> = {
  brief: '聊方案',
  design: '选设计',
  pdp: '叙事长图',
  proposal: '产品提案',
  video: '场景视频',
  assets: '出素材',
  followup: '做跟进',
};

// Avoid importing @/lib/env here: that module pulls Node fs into the Worker bundle.
function isWorkersRuntime() {
  return (
    (typeof navigator !== 'undefined' &&
      navigator.userAgent === 'Cloudflare-Workers') ||
    (typeof globalThis !== 'undefined' && 'Cloudflare' in globalThis) ||
    process.env.DATABASE_PROVIDER === 'd1'
  );
}

// Local-only fallback root. On Cloudflare Workers, fs writes are forbidden
// ("operation not permitted"); use the R2 binding `BUCKET` instead.
function localUploadRoot() {
  return path.join(process.cwd(), 'data', 'enterprise-uploads');
}

async function persistEnterpriseFile(options: {
  userId: string;
  id: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string> {
  const safeName = options.fileName
    .replace(/[^\w.\u4e00-\u9fff-]+/g, '_')
    .slice(0, 120);
  const relative = `${options.userId}/${options.id}-${safeName}`;

  // Prefer R2 whenever we are on Workers / D1 preview. Local Node keeps disk.
  const useR2 = isWorkersRuntime();

  if (useR2) {
    const { putEnterpriseObject } = await import('@/core/storage/r2-binding');
    const key = `enterprise-uploads/${relative}`;
    await putEnterpriseObject({
      key,
      body: options.buffer,
      contentType: options.mimeType,
    });
    // Prefix so future readers know the object lives in R2, not local disk.
    return `r2:${key}`;
  }

  const { mkdir, writeFile } = await import('fs/promises');
  const root = localUploadRoot();
  await mkdir(path.join(root, options.userId), { recursive: true });
  await writeFile(path.join(root, relative), options.buffer);
  return relative;
}

/** Load previously persisted enterprise file bytes (R2 or local disk). */
async function loadEnterpriseFileBuffer(
  storagePath: string
): Promise<Buffer | null> {
  if (!storagePath) return null;
  try {
    if (storagePath.startsWith('r2:')) {
      const key = storagePath.slice(3);
      const { getEnterpriseObject } = await import('@/core/storage/r2-binding');
      const bytes = await getEnterpriseObject(key);
      return bytes ? Buffer.from(bytes) : null;
    }
    const { readFile } = await import('fs/promises');
    const full = path.isAbsolute(storagePath)
      ? storagePath
      : path.join(localUploadRoot(), storagePath);
    return await readFile(full);
  } catch {
    return null;
  }
}

// ─── Enterprise assets ───────────────────────────────────────────────────────

export async function listAssets(userId: string): Promise<EnterpriseAsset[]> {
  return db()
    .select()
    .from(enterpriseAsset)
    .where(
      and(
        eq(enterpriseAsset.userId, userId),
        eq(enterpriseAsset.status, 'active'),
        isNull(enterpriseAsset.deletedAt)
      )
    )
    .orderBy(desc(enterpriseAsset.createdAt));
}

/** Assets useful for this project's proposal (project-scoped + user library). */
export async function listAssetsForProposal(
  userId: string,
  projectId: string
): Promise<EnterpriseAsset[]> {
  const all = await listAssets(userId);
  const scoped = all.filter(
    (a) => !a.projectId || a.projectId === projectId
  );
  return scoped.length ? scoped : all;
}

/** Build factoryMaterialsNote from uploaded enterprise docs (MVP: list + text snippets). */
export async function buildFactoryMaterialsNoteFromAssets(
  userId: string,
  projectId: string
): Promise<string> {
  const assets = await listAssetsForProposal(userId, projectId);
  if (!assets.length) return '';
  const lines: string[] = [];
  for (const a of assets.slice(0, 8)) {
    const title = (a.title || a.fileName || '未命名资料').trim();
    const preview = (a.textPreview || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);
    if (preview && !isAssetTextPlaceholder(preview)) {
      lines.push(`「${title}」摘录：${preview}`);
    } else {
      lines.push(`「${title}」${a.fileName ? `（${a.fileName}）` : ''}`.trim());
    }
  }
  if (assets.length > 8) {
    lines.push(`另有 ${assets.length - 8} 份资料未展开`);
  }
  return lines.join('；').slice(0, 1800);
}

export async function createAsset(params: {
  userId: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  buffer?: Buffer;
  textContent?: string;
  projectId?: string | null;
}): Promise<EnterpriseAsset> {
  const id = getUuid();
  let storagePath = '';
  let textPreview = (params.textContent || '').slice(0, 4000);

  if (params.buffer && params.buffer.length > 0) {
    storagePath = await persistEnterpriseFile({
      userId: params.userId,
      id,
      fileName: params.fileName,
      mimeType: params.mimeType || 'application/octet-stream',
      buffer: params.buffer,
    });

    if (!textPreview) {
      const lowerName = (params.fileName || '').toLowerCase();
      const mt = (params.mimeType || '').toLowerCase();
      const isTextish =
        mt.startsWith('text/') ||
        mt.includes('json') ||
        mt.includes('csv') ||
        mt.includes('markdown') ||
        /\.(txt|md|csv|json|tsv|log)$/i.test(lowerName);
      if (isTextish) {
        textPreview = params.buffer.toString('utf8').slice(0, 4000);
      } else if (mt.includes('pdf') || lowerName.endsWith('.pdf')) {
        // Never fail the upload because text extract blew up (Worker OOM / timeout).
        try {
          const extracted = await extractPdfText(params.buffer);
          if (extracted.likelyScannedOrEmpty) {
            textPreview = pdfEmptyExtractNote(
              params.fileName,
              params.size,
              extracted.reason
            );
          } else {
            const prefix = pdfPartialExtractPrefix(
              extracted.pagesExtracted,
              extracted.pageCount
            );
            textPreview = (prefix + extracted.text).slice(0, 8000);
          }
        } catch {
          textPreview = pdfEmptyExtractNote(
            params.fileName,
            params.size,
            'parse_error'
          );
        }
      } else {
        textPreview = `已上传文件「${params.fileName}」（${params.mimeType}，${params.size} bytes）。提案会列出此资料；建议补充 txt/csv/pdf 报价或规格便于摘录。`;
      }
    }
  }

  if (!textPreview) {
    textPreview = `资料「${params.title}」已入库，待解析。`;
  }

  const [row] = await db()
    .insert(enterpriseAsset)
    .values({
      id,
      userId: params.userId,
      projectId: params.projectId || null,
      title: params.title || params.fileName,
      fileName: params.fileName,
      mimeType: params.mimeType || 'application/octet-stream',
      size: params.size || 0,
      storagePath,
      textPreview,
      status: 'active',
    })
    .returning();

  return row;
}

export async function removeAsset(userId: string, id: string) {
  await db()
    .update(enterpriseAsset)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(and(eq(enterpriseAsset.id, id), eq(enterpriseAsset.userId, userId)));
}

// ─── Brand shelf + search ────────────────────────────────────────────────────

export function searchBrands(input: {
  country?: string;
  track?: string;
  query?: string;
}): BrandSearchCard[] {
  return stubSearchBrands(input);
}

export async function listShelfBrands(userId: string): Promise<EnterpriseBrand[]> {
  return db()
    .select()
    .from(enterpriseBrand)
    .where(
      and(
        eq(enterpriseBrand.userId, userId),
        eq(enterpriseBrand.status, 'active'),
        isNull(enterpriseBrand.deletedAt)
      )
    )
    .orderBy(desc(enterpriseBrand.createdAt));
}

export async function saveBrandToShelf(
  userId: string,
  card: {
    name: string;
    country?: string;
    track?: string;
    tone?: string;
    imageUrl?: string;
    website?: string;
    instagram?: string;
    facebook?: string;
    matchReason?: string;
    source?: string;
  }
): Promise<EnterpriseBrand> {
  // Dedupe by name+user among active
  const existing = await db()
    .select()
    .from(enterpriseBrand)
    .where(
      and(
        eq(enterpriseBrand.userId, userId),
        eq(enterpriseBrand.name, card.name),
        eq(enterpriseBrand.status, 'active'),
        isNull(enterpriseBrand.deletedAt)
      )
    )
    .limit(1);

  if (existing[0]) {
    const [updated] = await db()
      .update(enterpriseBrand)
      .set({
        country: card.country ?? existing[0].country,
        track: card.track ?? existing[0].track,
        tone: card.tone ?? existing[0].tone,
        imageUrl: card.imageUrl ?? existing[0].imageUrl,
        website: card.website ?? existing[0].website,
        instagram: card.instagram ?? existing[0].instagram,
        facebook: card.facebook ?? existing[0].facebook,
        matchReason: card.matchReason ?? existing[0].matchReason,
      })
      .where(eq(enterpriseBrand.id, existing[0].id))
      .returning();
    return updated;
  }

  const [row] = await db()
    .insert(enterpriseBrand)
    .values({
      id: getUuid(),
      userId,
      name: card.name,
      country: card.country || '',
      track: card.track || '',
      tone: card.tone || '',
      imageUrl: card.imageUrl || '',
      website: card.website || '',
      instagram: card.instagram || '',
      facebook: card.facebook || '',
      matchReason: card.matchReason || '',
      source: card.source || 'search',
      status: 'active',
    })
    .returning();
  return row;
}

export async function removeShelfBrand(userId: string, id: string) {
  await db()
    .update(enterpriseBrand)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(and(eq(enterpriseBrand.id, id), eq(enterpriseBrand.userId, userId)));
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function listProjects(userId: string): Promise<PitchProject[]> {
  return db()
    .select()
    .from(pitchProject)
    .where(
      and(
        eq(pitchProject.userId, userId),
        eq(pitchProject.status, 'active'),
        isNull(pitchProject.deletedAt)
      )
    )
    .orderBy(desc(pitchProject.pinned), desc(pitchProject.updatedAt));
}

export async function getProject(
  userId: string,
  id: string
): Promise<PitchProject | null> {
  const [row] = await db()
    .select()
    .from(pitchProject)
    .where(
      and(
        eq(pitchProject.id, id),
        eq(pitchProject.userId, userId),
        eq(pitchProject.status, 'active'),
        isNull(pitchProject.deletedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function createProject(params: {
  userId: string;
  brandName?: string;
  country?: string;
  track?: string;
  brandId?: string;
  note?: string;
  pinned?: boolean;
}): Promise<PitchProject> {
  const id = getUuid();
  const [row] = await db()
    .insert(pitchProject)
    .values({
      id,
      userId: params.userId,
      brandName: params.brandName || '新项目',
      country: params.country || '',
      track: params.track || '',
      brandId: params.brandId || null,
      note: params.note || '',
      pinned: params.pinned ?? false,
      stage: 'brief',
      status: 'active',
    })
    .returning();

  // Ensure a draft brief exists
  await db().insert(pitchBrief).values({
    id: getUuid(),
    projectId: row.id,
    userId: params.userId,
    country: row.country,
    track: row.track,
    brandName: row.brandName === '新项目' ? '' : row.brandName,
    status: 'draft',
  });

  return row;
}

export async function updateProject(
  userId: string,
  id: string,
  patch: Partial<{
    brandName: string;
    country: string;
    track: string;
    stage: string;
    brandId: string | null;
    lockedDesignId: string | null;
    note: string;
    pinned: boolean;
    status: string;
  }>
): Promise<PitchProject | null> {
  const existing = await getProject(userId, id);
  if (!existing) return null;

  const [row] = await db()
    .update(pitchProject)
    .set({
      ...(patch.brandName !== undefined ? { brandName: patch.brandName } : {}),
      ...(patch.country !== undefined ? { country: patch.country } : {}),
      ...(patch.track !== undefined ? { track: patch.track } : {}),
      ...(patch.stage !== undefined ? { stage: patch.stage } : {}),
      ...(patch.brandId !== undefined ? { brandId: patch.brandId } : {}),
      ...(patch.lockedDesignId !== undefined
        ? { lockedDesignId: patch.lockedDesignId }
        : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    })
    .where(and(eq(pitchProject.id, id), eq(pitchProject.userId, userId)))
    .returning();
  return row ?? null;
}

export async function archiveProject(userId: string, id: string) {
  return updateProject(userId, id, { status: 'archived' });
}

export async function softDeleteProject(userId: string, id: string) {
  const existing = await getProject(userId, id);
  if (!existing) return null;
  const [row] = await db()
    .update(pitchProject)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(and(eq(pitchProject.id, id), eq(pitchProject.userId, userId)))
    .returning();
  return row ?? null;
}

export type ChatAttachment = {
  assetId: string;
  fileName: string;
  title: string;
  mimeType: string;
  size: number;
};

export async function getAssetsByIds(
  userId: string,
  ids: string[]
): Promise<EnterpriseAsset[]> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return [];
  return db()
    .select()
    .from(enterpriseAsset)
    .where(
      and(
        eq(enterpriseAsset.userId, userId),
        inArray(enterpriseAsset.id, uniq),
        eq(enterpriseAsset.status, 'active'),
        isNull(enterpriseAsset.deletedAt)
      )
    );
}

/** Cap total attachment excerpts injected into the model turn. */
const CHAT_ATTACHMENT_EXCERPT_CAP = 5500;
const CHAT_ATTACHMENT_PER_FILE = 4000;

/**
 * When textPreview is empty/placeholder, try one re-extract from R2/local storage
 * and persist the result so later turns reuse it.
 */
async function maybeReextractAssetPreview(
  asset: EnterpriseAsset
): Promise<string> {
  const existing = (asset.textPreview || '').trim();
  if (existing && !isAssetTextPlaceholder(existing)) return existing;
  // Avoid re-running heavy PDF.js on every chat turn after a failed retry.
  if (existing.includes('【已重试抽取】')) return existing;

  const lowerName = (asset.fileName || '').toLowerCase();
  const mt = (asset.mimeType || '').toLowerCase();
  const isPdf = mt.includes('pdf') || lowerName.endsWith('.pdf');
  if (!isPdf || !asset.storagePath) {
    return existing;
  }

  const buf = await loadEnterpriseFileBuffer(asset.storagePath);
  if (!buf || buf.length === 0) {
    const note =
      existing ||
      pdfEmptyExtractNote(
        asset.fileName || '附件.pdf',
        asset.size || 0,
        'parse_error'
      );
    const stamped = note.includes('【已重试抽取】')
      ? note
      : `${note}【已重试抽取】`;
    try {
      await db()
        .update(enterpriseAsset)
        .set({ textPreview: stamped })
        .where(eq(enterpriseAsset.id, asset.id));
      asset.textPreview = stamped;
    } catch {
      /* ignore */
    }
    return stamped;
  }

  let next = existing;
  try {
    const extracted = await extractPdfText(buf);
    if (extracted.likelyScannedOrEmpty) {
      next = pdfEmptyExtractNote(
        asset.fileName || '附件.pdf',
        asset.size || buf.length,
        extracted.reason
      );
      if (!next.includes('【已重试抽取】')) next = `${next}【已重试抽取】`;
    } else {
      const prefix = pdfPartialExtractPrefix(
        extracted.pagesExtracted,
        extracted.pageCount
      );
      next = (prefix + extracted.text).slice(0, 8000);
    }
  } catch {
    next = `${pdfEmptyExtractNote(
      asset.fileName || '附件.pdf',
      asset.size || buf.length,
      'parse_error'
    )}【已重试抽取】`;
  }

  if (next && next !== existing) {
    try {
      await db()
        .update(enterpriseAsset)
        .set({ textPreview: next })
        .where(eq(enterpriseAsset.id, asset.id));
      asset.textPreview = next;
    } catch {
      /* keep in-memory next for this turn */
    }
  }
  return next || existing;
}

/**
 * Load asset textPreview for chat attachments and build a model-facing excerpt block.
 * UI still shows the chip; this text is appended only to the LLM user turn.
 * Empty/placeholder previews trigger one R2 re-extract attempt.
 */
export async function buildAttachmentExcerptForChat(
  userId: string,
  attachments?: ChatAttachment[] | null
): Promise<{ excerptBlock: string; combinedText: string }> {
  if (!attachments?.length) return { excerptBlock: '', combinedText: '' };
  const assets = await getAssetsByIds(
    userId,
    attachments.map((a) => a.assetId)
  );
  const byId = new Map(assets.map((a) => [a.id, a]));
  const parts: string[] = [];
  let used = 0;
  for (const att of attachments) {
    if (used >= CHAT_ATTACHMENT_EXCERPT_CAP) break;
    const asset = byId.get(att.assetId);
    const label = (att.fileName || att.title || asset?.fileName || '附件').trim();
    if (!asset) {
      parts.push(
        `[附件 · ${label}]（未找到企业资料库条目。请重新上传附件。）`
      );
      continue;
    }
    let preview = (asset.textPreview || '').trim();
    if (!preview || isAssetTextPlaceholder(preview)) {
      preview = (await maybeReextractAssetPreview(asset)).trim();
    }
    if (!preview || isAssetTextPlaceholder(preview)) {
      parts.push(
        `[附件 · ${label}]（文件已入库企业资料库，但正文抽取失败：可能体积过大、解析超时，或为扫描件/图片型 PDF；OCR 暂不支持。请压缩/拆分后重传，或另传 txt。勿声称「未同步到资料库」。）`
      );
      continue;
    }
    const room = Math.min(
      CHAT_ATTACHMENT_PER_FILE,
      CHAT_ATTACHMENT_EXCERPT_CAP - used
    );
    const chunk = preview.slice(0, room);
    parts.push(`[附件摘录 · ${label}]\n${chunk}`);
    used += chunk.length;
  }
  const excerptBlock = parts.join('\n\n');
  const combinedText = parts
    .map((p) => p.replace(/^\[附件[^\]]*\]\n?/, ''))
    .join('\n');
  return { excerptBlock, combinedText };
}

const ATTACHMENT_PROMPT_RULE =
  '附件：用户消息里若出现「[附件摘录 · 文件名]」块，那是系统从上传 PDF/文本抽出的摘录（大厂册可能只含前若干页），可据此归纳工厂能力与交付字段并追问缺口。若出现「文件已入库企业资料库，但正文抽取失败」，说明文件已在资料库，只是读不出正文——勿说「未同步到资料库」；引导压缩/拆分 PDF 或另传 txt。OCR 暂不支持。';

export async function listChatMessages(
  userId: string,
  projectId: string
): Promise<PitchChatMessage[]> {
  const project = await getProject(userId, projectId);
  if (!project) throw new Error('Project not found');
  return db()
    .select()
    .from(pitchChatMessage)
    .where(eq(pitchChatMessage.projectId, projectId))
    .orderBy(asc(pitchChatMessage.createdAt));
}

export async function appendChatMessage(params: {
  userId: string;
  projectId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ChatAttachment[];
}): Promise<PitchChatMessage> {
  const project = await getProject(params.userId, params.projectId);
  if (!project) throw new Error('Project not found');
  const [row] = await db()
    .insert(pitchChatMessage)
    .values({
      id: getUuid(),
      projectId: params.projectId,
      userId: params.userId,
      role: params.role,
      content: params.content,
      attachments: JSON.stringify(params.attachments || []),
    })
    .returning();
  return row;
}

/** Insert chat row without re-checking project ownership (caller already did). */
async function insertChatMessageTrusted(params: {
  userId: string;
  projectId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ChatAttachment[];
}): Promise<PitchChatMessage> {
  const [row] = await db()
    .insert(pitchChatMessage)
    .values({
      id: getUuid(),
      projectId: params.projectId,
      userId: params.userId,
      role: params.role,
      content: params.content,
      attachments: JSON.stringify(params.attachments || []),
    })
    .returning();
  return row;
}


async function loadLockedDesignForChat(
  project: PitchProject
): Promise<{ title: string; direction: string; summary: string; imageUrl: string } | null> {
  if (!project.lockedDesignId) return null;
  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, project.lockedDesignId))
    .limit(1);
  if (!design) return null;
  return {
    title: design.title || '',
    direction: design.direction || '',
    summary: design.summary || '',
    imageUrl: design.imageUrl || '',
  };
}

function parsePdpJsonBlock(text: string): {
  visible: string;
  structured: PdpStructured | null;
} {
  const re = /<<<PDP_JSON\s*([\s\S]*?)\s*PDP_JSON>>>/i;
  const m = text.match(re);
  if (!m) return { visible: text.trim(), structured: null };
  const visible = text.replace(re, '').trim();
  try {
    const structured = JSON.parse(m[1]) as PdpStructured;
    if (!structured || typeof structured !== 'object') {
      return { visible, structured: null };
    }
    return { visible, structured };
  } catch {
    return { visible, structured: null };
  }
}

/** Persist structured PDP from chat onto the draft deliverable. */
async function applyPdpStructuredFromChat(
  userId: string,
  projectId: string,
  structured: PdpStructured
): Promise<PitchDeliverable | null> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId || project.stage !== 'pdp') return null;

  const existing = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, project.lockedDesignId),
        eq(pitchDeliverable.kind, 'pdp')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);

  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, project.lockedDesignId))
    .limit(1);

  const base =
    (existing[0] && parsePdpStructured(existing[0].content)) ||
    buildPdpStructured({
      brandName: project.brandName,
      track: project.track,
      country: project.country,
      designTitle: design?.title || structured.designTitle || '',
      designDirection: design?.direction || structured.designDirection || '',
      designSummary: design?.summary || structured.subheadline || '',
    });

  const merged = mergePdpStructured(base, {
    ...structured,
    designTitle: structured.designTitle || base.designTitle,
    designDirection: structured.designDirection || base.designDirection,
    brandName: structured.brandName || base.brandName,
    track: structured.track || base.track,
    country: structured.country || base.country,
  });

  const content = serializePdpContent(merged);
  const title = `${merged.brandName} · 详情页`;
  const summary = `基于锁定视觉「${merged.designTitle}」的详情长图叙事结构`;
  const fileUrl = existing[0]?.fileUrl || design?.imageUrl || '';
  // Keep 'narrative' until user confirms story; never silently promote to ready.
  const nextStatus =
    existing[0]?.status === 'ready' || existing[0]?.status === 'confirmed'
      ? existing[0].status
      : 'narrative';

  if (existing[0]) {
    const [row] = await db()
      .update(pitchDeliverable)
      .set({ title, summary, content, fileUrl, status: nextStatus })
      .where(eq(pitchDeliverable.id, existing[0].id))
      .returning();
    return row;
  }

  const [row] = await db()
    .insert(pitchDeliverable)
    .values({
      id: getUuid(),
      projectId,
      userId,
      designId: project.lockedDesignId,
      kind: 'pdp',
      title,
      summary,
      content,
      fileUrl,
      version: 1,
      status: 'narrative',
    })
    .returning();
  return row;
}

function buildChatSystemPrompt(
  project: PitchProject,
  brief: PitchBrief,
  lockedDesign?: { title: string; direction: string; summary: string; imageUrl: string } | null
): string {
  const baseCtx = [
    ATTACHMENT_PROMPT_RULE,
    `当前项目：${project.brandName || '新项目'}`,
    `国家：${project.country || brief.country || '未定'}`,
    `赛道：${project.track || brief.track || '未定'}`,
    `阶段：${STAGE_LABEL[project.stage] || project.stage}`,
    `简报状态：${brief.status}`,
    `共创目标：${brief.goals || '未填'}`,
    `受众：${brief.audience || '未填'}`,
    `设计方向：${brief.designDirection || '未填'}`,
    `约束：${brief.constraints || '未填'}`,
    brief.status === 'confirmed'
      ? '简报已确认锁定。若用户要改品牌调性／设计方向／人群／共创目标：明确提示他们点右侧「修正简报」解锁后再改；不要假装简报字段已写入。用户说「修正简报／调性错了／重新聊方案」时，系统可能已 reopen，之后可继续写 BRIEF。'
      : '',
  ].filter(Boolean);

  if (project.stage === 'proposal') {
    const designLines = lockedDesign
      ? [
          `锁定概念：${lockedDesign.title}`,
          `视觉方向：${lockedDesign.direction}`,
          lockedDesign.imageUrl
            ? `主视觉 URL：${lockedDesign.imageUrl}`
            : '主视觉：暂无图',
        ]
      : ['锁定概念：尚未加载'];
    return [
      '你是「呈品 · 提案」助手。',
      '用户已确认叙事长图。当前阶段对齐 **产品提案画册大纲**（给品牌买家看的图文册，不是抽象 Who/Why/How 空壳）。',
      '大纲结构必须覆盖：封面主张 → 品牌世界（调性/人群/向往生活）→ 产品概念与视觉方向 → 为何契合该品牌 → 工厂交付要点（价格带/MOQ/交期/打样/产能/包装；缺失写「待共创确认」，禁止空 TBD）→ 下一步（打样/报价/跟进）。',
      '用目标市场语言改大纲；非中国市场不要用中文正文。可保留 [[VISUAL:hero]] / [[VISUAL:long]] 标记供 PDF 插图。',
      '定稿后用户会点「确认并生成 PDF」；不要假装 PDF 已生成。',
      '回复可输出完整 Markdown 大纲供用户改；鼓励补全交付数字与品牌生活方式表述。',
      '',
      ...baseCtx,
      ...designLines,
    ].join('\n');
  }

  if (project.stage === 'video') {
    const designLines = lockedDesign
      ? [
          `锁定概念：${lockedDesign.title}`,
          `视觉方向：${lockedDesign.direction}`,
          lockedDesign.summary ? `概念说明：${lockedDesign.summary}` : '',
          lockedDesign.imageUrl
            ? `主视觉 URL：${lockedDesign.imageUrl}`
            : '主视觉：暂无图',
        ].filter(Boolean)
      : ['锁定概念：尚未加载'];
    const marketCountry = project.country || brief.country || '';
    const lang = resolveOnImageLanguage(marketCountry);
    const culture = resolveMarketCulture(marketCountry);
    return [
      '你是「呈品 · 视频提示词工程师」（B2B 外贸商业提案视频提示词撰写&校验专家）。',
      '当前阶段对齐 **生活方式品牌短视频** 的 5 段式文生视频提示词（约 10s · 横屏 16:9 · 720p · GK-video-3.5，失败回退 MiniMax H3）。',
      '视频物料主看：聊方案调性 + 锁定设计图 + 叙事长图 + 品牌向往生活方式；**不要依赖产品提案脚本**。≤15s 产品生活方式介绍，不是提案 PDF 朗读，也不是电影化强戏剧冲突。',
      `目标市场：${marketCountry || '未定'} · 画面/旁白语种：${lang.languageName} · 人文区域：${culture.regionKey}`,
      lang.forbidChinese
        ? 'HARD：非中国市场 — 5 段式大纲正文（人物/场景/分镜动作/画面字/旁白示例）禁止中文汉字；结构标题可用中文或英文【Core theme】，但旁白与画面字必须是当地语言。'
        : '中国市场：大纲与画面字可用简体中文。',
      `人文规范（非场景模板）：区域 ${culture.regionKey}；着装：${culture.wardrobeCue}；光线气候：${culture.lightCue}。场景必须来自品牌生活世界／叙事确认，禁止国家默认咖啡／厨房／客厅／办公室模板。`,
      culture.forbidChinaAesthetics
        ? '禁止中国大陆室内审美默认（红灯笼/中式屏风/大陆电商包装字样等），除非国家就是中国。'
        : '',
      '用户改需求时：重写完整 5 段式 Markdown 大纲，全部落地具体名词（材质/色彩/设备），禁止空泛「高端商务感」类形容词单独存在。',
      '硬性要求每次大纲包含：【核心主题】【人物与设定】【氛围与画质】（须写摄影机+镜头）【运镜规则】（含呼吸感微浮动）【分镜】0-2s/2-4s/4-6s/6-8s【声音】；产品至少 2 处微小现实瑕疵；附简短负面提示词与一行验证建议。',
      `画面字 / 旁白示例须用 ${lang.languageName}（可参考：${culture.sampleOnScreenLines.join(' / ')}）。`,
      '不要假装视频已生成；定稿后用户点「确认并生成视频」。商业文生视频常需 3–5 次重跑，可在验证建议里提醒。',
      '回复保持可编辑 Markdown；不要编造任务 ID 或视频 URL。',
      '',
      ...baseCtx,
      ...designLines,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (project.stage === 'pdp') {
    const designLines = lockedDesign
      ? [
          `锁定概念：${lockedDesign.title}`,
          `视觉方向：${lockedDesign.direction}`,
          `概念说明：${lockedDesign.summary}`,
          lockedDesign.imageUrl
            ? `主视觉 URL（回复里请用 markdown 引用）：${lockedDesign.imageUrl}`
            : '主视觉：暂无图',
        ]
      : ['锁定概念：尚未加载'];
    const marketCountry = project.country || brief.country || '';
    const lang = resolveOnImageLanguage(marketCountry);
    const culture = resolveMarketCulture(marketCountry);
    return [
      '你是「呈品 · 叙事师」（全球品牌产品延伸生活方式叙事长图的上游对齐角色）。',
      '用户已锁定概念图。当前阶段只在左侧用文字对齐「详情长图会讲什么」——品牌调性、目标人群、向往身份、品牌生活世界、社交形式、产品如何融入；不是货架卖点清单，也不是冲突/痛点戏剧。',
      '最终交付物是 **两张** 竖版详情长图（非网页 / 非手机电商 UI）：像淘宝商品详情里的品牌叙事长图；图上用当地语言文案，把制造商产品嵌入该品牌消费者真实且向往的生活世界。',
      `目标市场：${marketCountry || '未定'} · 图上文案语种：${lang.languageName} · 人文区域：${culture.regionKey}（仅人物／语言／光线规范）`,
      lang.forbidChinese
        ? 'HARD：非中国市场 — 图上可见文案示例禁止中文汉字；左聊可用中文跟操作者对齐，但 PDP_JSON 里打算上图的 headline/cta 请用目标市场语言或注明「生图时译成当地语言」。'
        : '中国市场：左聊与图上文案可用简体中文。',
      `人文规范（禁止当场景模板）：着装 ${culture.wardrobeCue}；光线 ${culture.lightCue}。`,
      'HARD 场景规则：严格采用已确认的品牌生活世界与本张指定场景；根据人群真实生活、社交关系、兴趣活动、向往目的地和产品角色构建画面；禁止国家默认咖啡／厨房／客厅／办公室固定模板；禁止仅根据行业机械决定场景。居家／咖啡等仅当品牌依据明确时才允许。',
      culture.forbidChinaAesthetics
        ? '禁止中国大陆室内审美默认（红灯笼/中式屏风/大陆电商包装字样等），除非国家就是中国。'
        : '',
      '两张长图：A=品牌人群／向往生活／社交活动／环境与品牌精神，产品自然融入；B=延续 A 的品牌世界，产品实际参与生活并积极收束。系列共享产品外观／品牌色／人物关系；相机语言按品牌调性与场景选定后系列锁定（不固定所有品牌同一镜头）。',
      'HARD：禁止「痛点→冲突→解决方案→价值成果」戏剧弧；禁止堆砌劣质样品压力桌、采购崩溃等冲突场面。',
      '可见回复要求：具体名词（地点／活动／社交关系／人物情绪／产品融合方式），禁止空泛「高级品牌故事感」；人物是品牌人群主角，产品是品质与品牌意义的载体。',
      '回复结构建议：',
      '1) 目标人群 + 向往身份',
      '2) 品牌生活世界（去哪玩／社交形式／向往目的地）+ A／B 场景候选（具体地点与活动意义）',
      '3) 社交关系与生活活动；产品如何融入（真实功能）',
      '4) 若有主视觉 URL，可用 markdown 引用：![锁定主视觉](url)',
      '5) 结尾提醒：定稿后点「确认这版叙事」，系统按品牌生活世界提示词生成两张长图到右侧对比；用户说「确认生成/按这版出图」也视为确认',
      '6) 叙事有更新时，在回复末尾附加（系统剥离）结构化字段：',
      '<<<PDP_JSON',
      '{"headline":"...","subheadline":"...","features":[{"title":"...","desc":"..."}],"materials":"...","scenarios":"...","specs":"...","cta":"...","designTitle":"...","designDirection":"...","brandName":"...","track":"...","country":"...","lifestyleWorld":"...","selectedScenes":{"A":"...","B":"..."},"socialDynamics":"...","aspirationalIdentity":"...","productRole":"...","targetAudience":"..."}',
      'PDP_JSON>>>',
      'features 固定 3 条，从品牌理念／生活方式／品质仪式提炼（不要痛点冲突）；lifestyleWorld / selectedScenes / socialDynamics / aspirationalIdentity / productRole / targetAudience 为可选扩展，有则优先用于生图场景；不要编造图片 URL；复杂 LOGO 可读文字勿假设 AI 能画清，可写「后期叠字」。',
      '用户说「更贴品牌 / 换场景 / 语气」时，重写生活方式叙事并输出完整 PDP_JSON。不要假装右侧已经出了长图。',
      '',
      ...baseCtx,
      ...designLines,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    '你是「呈品」共创顾问，帮助工厂与海外品牌做产品共创提案。',
    '用简洁中文回复（优先短句，控制在 200 字内除非用户要细节）。左侧聊天是主交互：一起共创方案；右侧成果区只供用户确认/点选，不要让用户去右侧填表。',
    '需要时可引导用户在对话中补充国家、赛道、目标品牌、共创目标、品牌调性、向往生活方式，以及工厂交付事实（出厂价/价格带 priceBand、MOQ、大货交期、打样周期、产能、包装）与建议零售价 suggestedRetail。',
    'HARD GATE：离开聊方案 / 确认简报前，必须齐备 priceBand、moq、leadTime 三项；每一项要么是具体数字/区间，要么用户明确说「本次暂无」并写入对应字段（禁止空 TBD / 待补充 / 未定）。缺则继续追问，最多一次列清缺项。suggestedRetail 是软项，不阻断确认简报。',
    'HARD：聊方案要尽量聊透，方便后面生成给品牌看的厚提案（图文画册 + 交付数字）；缺交付数字时提醒工厂补充，勿用空 TBD 糊弄。',
    '建议零售价（软）：在齐备出厂价/价格带后，按品牌定位（平价/中端/高端/设计师等）与目标市场，主动给出建议零售价区间 suggestedRetail。写清币种与单位；可简述相对出厂价的大致倍率或毛利逻辑（常见约 2.5–4×，视品类/渠道浮动），不要编造精确到分的假数。说明这是给品牌看的「大概能卖多少」、最终零售由品牌定；用户可写「本次暂无」。priceBand = 工厂出货/FOB；suggestedRetail = 建议零售/MSRP，二者勿混写。',
    '拿订单检查清单（右侧也有）：①品牌调性 ②目标人群 ③向往生活方式 ④出厂价/MOQ/交期（硬）⑤建议零售价（软）⑥包装/包材。开场可按清单追问；已齐的项不必重复。',
    '当你从对话中归纳出简报字段时，在回复末尾附加（系统会剥离，用户看不到）：',
    '<<<BRIEF',
    'brandName: ...',
    'country: ...',
    'track: ...',
    'goals: ...',
    'audience: ...',
    'opportunity: ...',
    'designDirection: ...',
    'constraints: ...',
    'brandTone: ...',
    'lifestyleAspiration: ...',
    'priceBand: ...',
    'suggestedRetail: ...',
    'moq: ...',
    'leadTime: ...',
    'sampleTimeline: ...',
    'capacity: ...',
    'packaging: ...',
    'factoryMaterialsNote: ...',
    'BRIEF>>>',
    '只填有把握的字段；空字段可省略。priceBand/moq/leadTime 若用户说本次不做报价，写「本次暂无」。suggestedRetail 同理可写「本次暂无」。priceBand 只写出厂/FOB；建议零售写进 suggestedRetail。交付类字段写入后会进入提案「工厂交付要点」。不要编造图片 URL；选设计/出素材由系统其它步骤处理。',
    '',
    ...baseCtx,
  ].join('\n');
}



/** User clearly asks to reopen / fix confirmed brief tone. */
function wantsBriefReopen(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  return /修正简报|重新做简报|重新聊方案|回到聊方案|解开简报|解锁简报|调性错了|调性不对|品牌调性错|改(一?下)?调性|改(一?下)?设计方向|重新确认简报|reopen\s*brief|unlock\s*brief/i.test(
    t
  );
}

/** Persist user message, call volcano chat, persist assistant reply. */
export async function sendChatAndReply(params: {
  userId: string;
  projectId: string;
  content: string;
  attachments?: ChatAttachment[];
}): Promise<{
  user: PitchChatMessage;
  assistant: PitchChatMessage;
  usedLive: boolean;
  model: string;
  brief: PitchBrief;
  project: PitchProject;
}> {
  // Parallel ownership + brief load (was sequential)
  const [project0, brief0] = await Promise.all([
    getProjectOrThrow(params.userId, params.projectId),
    getOrCreateBrief(params.userId, params.projectId),
  ]);
  let brief = brief0;
  let project = project0;

  const { excerptBlock, combinedText: attachmentText } =
    await buildAttachmentExcerptForChat(params.userId, params.attachments);
  const contentForHints = [params.content, attachmentText]
    .filter(Boolean)
    .join('\n');

  // Explicit reopen request while brief is locked
  if (brief.status === 'confirmed' && wantsBriefReopen(contentForHints)) {
    const reopened = await reopenBrief(params.userId, params.projectId, {
      skipChatNotice: true,
    });
    brief = reopened.brief;
    project = reopened.project;
  }

  // Heuristic: lift country / track / goals + delivery facts from the user turn (+ PDF 摘录)
  if (brief.status !== 'confirmed') {
    const heuristic = extractBriefHintsFromText(contentForHints);
    const deliveryHints = extractDeliveryHintsFromText(contentForHints);
    const patch: Record<string, string> = { ...heuristic };
    if (Object.keys(deliveryHints).length > 0) {
      patch.constraints = mergeDeliveryIntoConstraints(
        brief.constraints,
        deliveryHints
      );
    }
    if (Object.keys(patch).length > 0) {
      brief = await updateBrief(params.userId, params.projectId, patch);
    }
  }

  // Load prior history BEFORE inserting user (avoids re-fetch + ownership check)
  const prior = await db()
    .select()
    .from(pitchChatMessage)
    .where(eq(pitchChatMessage.projectId, params.projectId))
    .orderBy(asc(pitchChatMessage.createdAt));

  const userMsg = await insertChatMessageTrusted({
    userId: params.userId,
    projectId: params.projectId,
    role: 'user',
    content: params.content,
    attachments: params.attachments,
  });

  const recent = [
    ...prior.filter(
      (m: PitchChatMessage) => m.role === 'user' || m.role === 'assistant'
    ),
    userMsg,
  ]
    .slice(-12)
    .map((m: PitchChatMessage) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  // Inject attachment excerpts into the model-facing user turn only (UI keeps chip + short line)
  if (excerptBlock && recent.length) {
    const last = recent[recent.length - 1];
    if (last.role === 'user') {
      last.content = `${last.content}\n\n${excerptBlock}`;
    }
  }

  const lockedDesign = await loadLockedDesignForChat(project);
  const system = buildChatSystemPrompt(project, brief, lockedDesign);

  let usedLive = false;
  let model = 'stub';
  let replyText: string;
  try {
    const result = await volcanoChat({
      messages: [{ role: 'system', content: system }, ...recent],
      // PDP narrative needs more room; other stages stay snappy
      maxTokens: project.stage === 'pdp' || project.stage === 'proposal' ? 1800 : 1024,
    });
    replyText = result.content;
    usedLive = result.usedLive;
    model = result.model;
  } catch (e: any) {
    replyText = `对话模型暂时不可用：${e?.message || '未知错误'}。你仍可在左侧继续描述，或粘贴品牌链接；右侧只需确认。`;
  }

  const { visible, patch, delivery } = parseBriefBlock(replyText);
  replyText = visible;
  if (Object.keys(delivery).length > 0) {
    patch.constraints = mergeDeliveryIntoConstraints(
      patch.constraints ?? brief.constraints,
      delivery
    );
  }
  if (brief.status !== 'confirmed' && Object.keys(patch).length > 0) {
    brief = await updateBrief(params.userId, params.projectId, patch);
  }

  const pdpParsed = parsePdpJsonBlock(replyText);
  replyText = pdpParsed.visible;
  if (project.stage === 'pdp' && pdpParsed.structured) {
    await applyPdpStructuredFromChat(
      params.userId,
      params.projectId,
      pdpParsed.structured
    );
  }

  const assistantMsg = await insertChatMessageTrusted({
    userId: params.userId,
    projectId: params.projectId,
    role: 'assistant',
    content: replyText,
  });

  return { user: userMsg, assistant: assistantMsg, usedLive, model, brief, project };
}

/**
 * Streaming variant: yields SSE-friendly events.
 * Events: user → delta* → done (with assistant + brief).
 */
export async function* sendChatAndReplyStream(params: {
  userId: string;
  projectId: string;
  content: string;
  attachments?: ChatAttachment[];
}): AsyncGenerator<{
  event: 'user' | 'delta' | 'done' | 'error';
  data: any;
}> {
  try {
    const [project0, brief0] = await Promise.all([
      getProjectOrThrow(params.userId, params.projectId),
      getOrCreateBrief(params.userId, params.projectId),
    ]);
    let brief = brief0;
    let project = project0;

    const { excerptBlock, combinedText: attachmentText } =
      await buildAttachmentExcerptForChat(params.userId, params.attachments);
    const contentForHints = [params.content, attachmentText]
      .filter(Boolean)
      .join('\n');

    if (brief.status === 'confirmed' && wantsBriefReopen(contentForHints)) {
      const reopened = await reopenBrief(params.userId, params.projectId, {
        skipChatNotice: true,
      });
      brief = reopened.brief;
      project = reopened.project;
    }

    if (brief.status !== 'confirmed') {
      const heuristic = extractBriefHintsFromText(contentForHints);
      const deliveryHints = extractDeliveryHintsFromText(contentForHints);
      const patch: Record<string, string> = { ...heuristic };
      if (Object.keys(deliveryHints).length > 0) {
        patch.constraints = mergeDeliveryIntoConstraints(
          brief.constraints,
          deliveryHints
        );
      }
      if (Object.keys(patch).length > 0) {
        brief = await updateBrief(params.userId, params.projectId, patch);
      }
    }

    const prior = await db()
      .select()
      .from(pitchChatMessage)
      .where(eq(pitchChatMessage.projectId, params.projectId))
      .orderBy(asc(pitchChatMessage.createdAt));

    const userMsg = await insertChatMessageTrusted({
      userId: params.userId,
      projectId: params.projectId,
      role: 'user',
      content: params.content,
      attachments: params.attachments,
    });

    yield {
      event: 'user',
      data: {
        id: userMsg.id,
        role: userMsg.role,
        content: userMsg.content,
        attachments: params.attachments || [],
        createdAt: userMsg.createdAt,
      },
    };

    const recent = [
      ...prior.filter(
        (m: PitchChatMessage) => m.role === 'user' || m.role === 'assistant'
      ),
      userMsg,
    ]
      .slice(-12)
      .map((m: PitchChatMessage) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    if (excerptBlock && recent.length) {
      const last = recent[recent.length - 1];
      if (last.role === 'user') {
        last.content = `${last.content}\n\n${excerptBlock}`;
      }
    }

    const lockedDesign = await loadLockedDesignForChat(project);
    const system = buildChatSystemPrompt(project, brief, lockedDesign);
    let usedLive = false;
    let model = 'stub';
    let replyText = '';

    try {
      for await (const chunk of volcanoChatStream({
        messages: [{ role: 'system', content: system }, ...recent],
        maxTokens: project.stage === 'pdp' || project.stage === 'proposal' ? 1800 : 1024,
      })) {
        if (chunk.type === 'delta') {
          // Strip brief/PDP markers from streamed text so users never see them mid-stream
          yield { event: 'delta', data: { text: chunk.text } };
        } else if (chunk.type === 'done') {
          replyText = chunk.content;
          usedLive = chunk.usedLive;
          model = chunk.model;
        }
      }
    } catch (e: any) {
      replyText = `对话模型暂时不可用：${e?.message || '未知错误'}。你仍可在左侧继续描述，或粘贴品牌链接；右侧只需确认。`;
    }

    const { visible, patch, delivery } = parseBriefBlock(replyText);
    replyText = visible;
    if (Object.keys(delivery).length > 0) {
      patch.constraints = mergeDeliveryIntoConstraints(
        patch.constraints ?? brief.constraints,
        delivery
      );
    }
    if (brief.status !== 'confirmed' && Object.keys(patch).length > 0) {
      brief = await updateBrief(params.userId, params.projectId, patch);
    }

    const pdpParsed = parsePdpJsonBlock(replyText);
    replyText = pdpParsed.visible;
    if (project.stage === 'pdp' && pdpParsed.structured) {
      await applyPdpStructuredFromChat(
        params.userId,
        params.projectId,
        pdpParsed.structured
      );
    }

    const assistantMsg = await insertChatMessageTrusted({
      userId: params.userId,
      projectId: params.projectId,
      role: 'assistant',
      content: replyText,
    });

    yield {
      event: 'done',
      data: {
        user: {
          id: userMsg.id,
          role: userMsg.role,
          content: userMsg.content,
          attachments: params.attachments || [],
          createdAt: userMsg.createdAt,
        },
        assistant: {
          id: assistantMsg.id,
          role: assistantMsg.role,
          content: assistantMsg.content,
          attachments: [],
          createdAt: assistantMsg.createdAt,
        },
        usedLive,
        model,
        brief,
        project,
      },
    };
  } catch (e: any) {
    yield { event: 'error', data: { message: e?.message || 'Chat failed' } };
  }
}

function parseBriefBlock(text: string): {
  visible: string;
  patch: Partial<{
    country: string;
    track: string;
    brandName: string;
    goals: string;
    constraints: string;
    audience: string;
    opportunity: string;
    designDirection: string;
  }>;
  delivery: ReturnType<typeof parseDeliveryFacts>;
} {
  const re = /<<<BRIEF\s*([\s\S]*?)BRIEF>>>/i;
  const m = text.match(re);
  if (!m) return { visible: text.trim(), patch: {}, delivery: {} };
  const visible = text.replace(re, '').trim();
  const patch: Record<string, string> = {};
  const delivery: Record<string, string> = {};
  const allowed = new Set([
    'country',
    'track',
    'brandName',
    'goals',
    'constraints',
    'audience',
    'opportunity',
    'designDirection',
  ]);
  const deliveryKeys = new Set([
    'priceBand',
    'suggestedRetail',
    'moq',
    'leadTime',
    'sampleTimeline',
    'capacity',
    'packaging',
    'brandTone',
    'lifestyleAspiration',
    'factoryMaterialsNote',
  ]);
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([a-zA-Z]+)\s*[:：]\s*(.+?)\s*$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();
    if (!val || val === '...' || val === '…') continue;
    if (allowed.has(key)) patch[key] = val;
    else if (deliveryKeys.has(key)) delivery[key] = val;
  }
  return { visible, patch, delivery };
}

function extractBriefHintsFromText(text: string): Partial<{
  country: string;
  track: string;
  brandName: string;
  goals: string;
}> {
  const patch: Partial<{
    country: string;
    track: string;
    brandName: string;
    goals: string;
  }> = {};
  for (const c of ['美国', '英国', '德国', '北欧', '日本', '澳洲', '加拿大', '法国']) {
    if (text.includes(c)) {
      patch.country = c;
      break;
    }
  }
  for (const c of [
    '生活方式香氛',
    '香氛',
    '护肤',
    '宠物用品',
    '咖啡器具',
    '儿童家居',
  ]) {
    if (text.includes(c)) {
      patch.track = c === '香氛' ? '生活方式香氛' : c;
      break;
    }
  }
  const brand = text.match(
    /(?:品牌|目标品牌|叫|名为)\s*[「"']?([A-Za-z0-9][A-Za-z0-9 &\-]{1,40})/
  );
  if (brand) patch.brandName = brand[1].trim();
  const goals = text.match(
    /(?:共创目标|目标是|我们想|希望)\s*[:：]?\s*(.+)$/m
  );
  if (goals && goals[1].trim().length >= 6) {
    patch.goals = goals[1].trim().slice(0, 500);
  }
  return patch;
}

/** Heuristic lift of priceBand / suggestedRetail / moq / leadTime (or 本次暂无) from free chat. */
function extractDeliveryHintsFromText(text: string): ProposalDeliveryFacts {
  const out: ProposalDeliveryFacts = {};
  const t = text || '';
  const deferredRe =
    /(价格带|出厂价|FOB|EXW|建议零售|零售价|MSRP|报价|MOQ|起订|交期|工期|交货)[^。；\n]{0,24}(本次暂无|暂无|暂缓)/i;
  if (deferredRe.test(t) || /三项都?暂无|交付.*本次暂无/.test(t)) {
    // Factory price deferred — do NOT treat bare 零售 as priceBand
    if (
      /(价格带|出厂价|FOB|EXW|出厂|工厂价)/i.test(t) &&
      /(本次暂无|暂无|暂缓)/.test(t) &&
      !/(建议零售|零售价|MSRP|retail)/i.test(t)
    ) {
      out.priceBand = '本次暂无';
    }
    // Explicit factory quote deferred without retail wording
    if (
      /报价/.test(t) &&
      /(本次暂无|暂无|暂缓)/.test(t) &&
      !/(建议零售|零售价|MSRP|retail)/i.test(t)
    ) {
      out.priceBand = out.priceBand || '本次暂无';
    }
    if (/(建议零售|零售价|MSRP|retail)/i.test(t) && /(本次暂无|暂无|暂缓)/.test(t)) {
      out.suggestedRetail = '本次暂无';
    }
    if (/MOQ|起订/.test(t) && /(本次暂无|暂无|暂缓)/.test(t)) {
      out.moq = '本次暂无';
    }
    if (/交期|工期|交货/.test(t) && /(本次暂无|暂无|暂缓)/.test(t)) {
      out.leadTime = '本次暂无';
    }
    if (/三项|全都|都暂无|都说暂无/.test(t)) {
      out.priceBand = out.priceBand || '本次暂无';
      out.moq = out.moq || '本次暂无';
      out.leadTime = out.leadTime || '本次暂无';
    }
  }
  // Factory / FOB only — never route retail into priceBand
  const price = t.match(
    /(?:价格带|出厂价|工厂价|FOB|EXW|出厂单价|工厂报价)\s*[:：]?\s*([^\n。；]{2,60})/i
  );
  if (price && !isDeliveryDeferred(out.priceBand)) {
    const v = price[1].trim();
    if (!/本次暂无|暂无|暂缓|待定|TBD/i.test(v)) out.priceBand = v.slice(0, 80);
  }
  const retail = t.match(
    /(?:建议零售价|建议零售|零售价|MSRP|suggested\s*retail|retail\s*price)\s*[:：]?\s*([^\n。；]{2,60})/i
  );
  if (retail && !isDeliveryDeferred(out.suggestedRetail)) {
    const v = retail[1].trim();
    if (!/本次暂无|暂无|暂缓|待定|TBD/i.test(v)) {
      out.suggestedRetail = v.slice(0, 100);
    }
  }
  const moq = t.match(
    /(?:MOQ|起订量|最小起订|最小订单)\s*[:：]?\s*([^\n。；]{1,40})/i
  );
  if (moq && !isDeliveryDeferred(out.moq)) {
    const v = moq[1].trim();
    if (!/本次暂无|暂无|暂缓|待定|TBD/i.test(v)) out.moq = v.slice(0, 80);
  }
  const lead = t.match(
    /(?:大货交期|交期|交货周期|工期|lead\s*time)\s*[:：]?\s*([^\n。；]{1,40})/i
  );
  if (lead && !isDeliveryDeferred(out.leadTime)) {
    const v = lead[1].trim();
    if (!/本次暂无|暂无|暂缓|待定|TBD/i.test(v)) out.leadTime = v.slice(0, 80);
  }
  return out;
}

/** Apply a brand card to the project (from search or shelf). */
export async function attachBrandToProject(
  userId: string,
  projectId: string,
  brand: {
    id?: string;
    name: string;
    country?: string;
    track?: string;
    tone?: string;
  },
  opts?: { saveToShelf?: boolean }
): Promise<{ project: PitchProject; shelfBrand?: EnterpriseBrand }> {
  let shelfBrand: EnterpriseBrand | undefined;
  let brandId = brand.id;

  if (opts?.saveToShelf !== false) {
    // If id looks like stub search id, save a shelf copy
    if (!brandId || brandId.startsWith('stub-')) {
      shelfBrand = await saveBrandToShelf(userId, {
        name: brand.name,
        country: brand.country,
        track: brand.track,
        tone: brand.tone,
        source: 'search',
      });
      brandId = shelfBrand.id;
    }
  }

  const project = await updateProject(userId, projectId, {
    brandName: brand.name,
    country: brand.country || '',
    track: brand.track || '',
    brandId: brandId || null,
  });
  if (!project) throw new Error('Project not found');

  // Sync brief fields
  const brief = await getOrCreateBrief(userId, projectId);
  await db()
    .update(pitchBrief)
    .set({
      brandName: brand.name,
      country: brand.country || brief.country,
      track: brand.track || brief.track,
    })
    .where(eq(pitchBrief.id, brief.id));

  return { project, shelfBrand };
}

// ─── Brief ───────────────────────────────────────────────────────────────────

export async function getOrCreateBrief(
  userId: string,
  projectId: string
): Promise<PitchBrief> {
  const project = await getProject(userId, projectId);
  if (!project) throw new Error('Project not found');

  const [existing] = await db()
    .select()
    .from(pitchBrief)
    .where(eq(pitchBrief.projectId, projectId))
    .orderBy(desc(pitchBrief.updatedAt))
    .limit(1);

  if (existing) return existing;

  const [row] = await db()
    .insert(pitchBrief)
    .values({
      id: getUuid(),
      projectId,
      userId,
      country: project.country,
      track: project.track,
      brandName: project.brandName === '新项目' ? '' : project.brandName,
      status: 'draft',
    })
    .returning();
  return row;
}

export async function updateBrief(
  userId: string,
  projectId: string,
  patch: Partial<{
    country: string;
    track: string;
    brandName: string;
    goals: string;
    constraints: string;
    audience: string;
    opportunity: string;
    designDirection: string;
  }>
): Promise<PitchBrief> {
  const brief = await getOrCreateBrief(userId, projectId);
  if (brief.status === 'confirmed') {
    // Allow edits that reopen as draft
  }

  const [row] = await db()
    .update(pitchBrief)
    .set({
      ...patch,
      status: 'draft',
      confirmedAt: null,
    })
    .where(and(eq(pitchBrief.id, brief.id), eq(pitchBrief.userId, userId)))
    .returning();

  // Keep project meta in sync
  await updateProject(userId, projectId, {
    ...(patch.brandName !== undefined ? { brandName: patch.brandName || '新项目' } : {}),
    ...(patch.country !== undefined ? { country: patch.country } : {}),
    ...(patch.track !== undefined ? { track: patch.track } : {}),
    stage: 'brief',
  });

  return row;
}

export async function confirmBrief(
  userId: string,
  projectId: string
): Promise<{ brief: PitchBrief; project: PitchProject }> {
  const brief = await getOrCreateBrief(userId, projectId);

  if (!brief.brandName?.trim()) {
    throw new Error('请先选择或填写目标品牌');
  }
  if (!brief.country?.trim() || !brief.track?.trim()) {
    throw new Error('请填写国家与赛道');
  }
  if (!brief.goals?.trim()) {
    throw new Error('请填写共创目标');
  }

  const deliveryGate = assertDeliveryGate(parseDeliveryFacts(brief.constraints));
  if (!deliveryGate.ok) {
    throw new Error(deliveryGate.message || '请先补齐价格带 / MOQ / 交期');
  }

  const [updatedBrief] = await db()
    .update(pitchBrief)
    .set({
      status: 'confirmed',
      confirmedAt: new Date(),
    })
    .where(and(eq(pitchBrief.id, brief.id), eq(pitchBrief.userId, userId)))
    .returning();

  const project = await updateProject(userId, projectId, {
    brandName: updatedBrief.brandName,
    country: updatedBrief.country,
    track: updatedBrief.track,
    stage: 'design',
  });
  if (!project) throw new Error('Project not found');

  return { brief: updatedBrief, project };
}

export async function reopenBrief(
  userId: string,
  projectId: string,
  opts?: { skipChatNotice?: boolean }
): Promise<{
  brief: PitchBrief;
  project: PitchProject;
  chatMessage: ReturnType<typeof toApiChatMessage> | null;
}> {
  await getProjectOrThrow(userId, projectId);
  const brief = await getOrCreateBrief(userId, projectId);

  const [updatedBrief] = await db()
    .update(pitchBrief)
    .set({
      status: 'draft',
      confirmedAt: null,
    })
    .where(and(eq(pitchBrief.id, brief.id), eq(pitchBrief.userId, userId)))
    .returning();

  // Unlock all locked concepts; keep files / rows so user can re-lock or regenerate
  const concepts = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.projectId, projectId));
  for (const c of concepts) {
    if (c.locked) {
      await db()
        .update(pitchDesignConcept)
        .set({ locked: false })
        .where(eq(pitchDesignConcept.id, c.id));
    }
  }

  const updated = await updateProject(userId, projectId, {
    stage: 'brief',
    lockedDesignId: null,
  });
  if (!updated) throw new Error('Project not found');

  let chatMessage: ReturnType<typeof toApiChatMessage> | null = null;
  if (!opts?.skipChatNotice) {
    try {
      const row = await insertChatMessageTrusted({
        userId,
        projectId,
        role: 'assistant',
        content: [
          '已回到「聊方案」：简报已解开确认，可改品牌调性、设计方向、人群等字段。',
          '改完后请再点「确认简报，进入选设计」。',
          '提示：调性改了后，建议重生概念图、重新锁定视觉，并按新调性重做叙事（旧图仍保留作参考，不会静默删除）。',
        ].join('\n'),
      });
      chatMessage = toApiChatMessage(row);
    } catch (e) {
      console.error('[reopenBrief] chat notice failed', e);
    }
  }

  return { brief: updatedBrief, project: updated, chatMessage };
}




// ─── Design concepts ─────────────────────────────────────────────────────────

export async function listDesignConcepts(
  userId: string,
  projectId: string
): Promise<PitchDesignConcept[]> {
  await getProjectOrThrow(userId, projectId);
  return db()
    .select()
    .from(pitchDesignConcept)
    .where(
      and(
        eq(pitchDesignConcept.projectId, projectId),
        eq(pitchDesignConcept.status, 'active')
      )
    )
    .orderBy(asc(pitchDesignConcept.createdAt));
}

export async function ensureDesignConcepts(
  userId: string,
  projectId: string,
  opts?: { force?: boolean }
): Promise<PitchDesignConcept[]> {
  const project = await getProjectOrThrow(userId, projectId);
  const existing = await listDesignConcepts(userId, projectId);
  if (existing.length > 0 && !opts?.force) return existing;

  // Keep previous active concepts when regenerating; only block if one is locked
  if (opts?.force && existing.length) {
    const locked = existing.find((c) => c.locked);
    if (locked) {
      throw new Error('已锁定视觉，请先解锁或进入出素材后再调整');
    }
  }

  const brief = await getOrCreateBrief(userId, projectId);
  const seeds = buildDesignStubs({
    brandName: project.brandName,
    track: project.track,
    country: project.country,
    goals: brief.goals,
    designDirection: brief.designDirection,
    constraints: brief.constraints,
  });

  // Prefer Seedream when image_* / openai keys present; keep stub URL on failure
  const enriched = await Promise.all(
    seeds.map(async (s) => {
      const prompt = [
        `产品共创概念视觉，商业摄影，高品质，无文字水印。`,
        `品牌：${project.brandName || '目标品牌'}`,
        `赛道：${project.track || ''}`,
        `市场：${project.country || ''}`,
        `方向：${s.direction}`,
        `说明：${s.summary}`,
        brief.designDirection
          ? `整体设计方向：${brief.designDirection}`
          : '',
      ]
        .filter(Boolean)
        .join('。');
      try {
        const gen = await volcanoGenerateImage({ prompt, size: '2K' });
        if (gen.url) return { ...s, imageUrl: gen.url };
      } catch {
        // keep stub
      }
      return s;
    })
  );

  const version =
    (existing.reduce((m: number, c: { version: number }) => Math.max(m, c.version), 0) || 0) + 1;

  for (const s of enriched) {
    await db()
      .insert(pitchDesignConcept)
      .values({
        id: getUuid(),
        projectId,
        userId,
        title: s.title,
        direction: s.direction,
        summary: s.summary,
        imageUrl: s.imageUrl,
        palette: JSON.stringify(s.palette),
        locked: false,
        version,
        status: 'active',
      })
      .returning();
  }
  // Return all active so the panel keeps prior batches + the new one
  return listDesignConcepts(userId, projectId);
}

export async function lockDesignConcept(
  userId: string,
  projectId: string,
  designId: string
): Promise<{
  design: PitchDesignConcept;
  project: PitchProject;
  deliverables: PitchDeliverable[];
  chatMessage: ReturnType<typeof toApiChatMessage>;
}> {
  const project = await getProjectOrThrow(userId, projectId);
  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(
      and(
        eq(pitchDesignConcept.id, designId),
        eq(pitchDesignConcept.projectId, projectId),
        eq(pitchDesignConcept.status, 'active')
      )
    )
    .limit(1);
  if (!design) throw new Error('设计概念不存在');

  // unlock others
  const all = await listDesignConcepts(userId, projectId);
  for (const c of all) {
    if (c.id !== designId && c.locked) {
      await db()
        .update(pitchDesignConcept)
        .set({ locked: false })
        .where(eq(pitchDesignConcept.id, c.id));
    }
  }

  const [lockedRow] = await db()
    .update(pitchDesignConcept)
    .set({ locked: true })
    .where(eq(pitchDesignConcept.id, designId))
    .returning();
  const locked = lockedRow || { ...design, locked: true };

  const updated = await updateProject(userId, projectId, {
    lockedDesignId: designId,
    stage: 'pdp',
  });
  if (!updated) throw new Error('Project not found');

  // After lock succeeds, never throw — PDP seed + narrative must not wipe the lock.
  let deliverables: PitchDeliverable[] = [];
  try {
    deliverables = await ensurePdpDeliverable(userId, projectId, designId, {
      force: true,
      generateImage: false,
      status: 'narrative',
    });
  } catch (e) {
    console.error('[lockDesignConcept] ensurePdpDeliverable failed', e);
  }

  let chatMessage: ReturnType<typeof toApiChatMessage>;
  try {
    chatMessage = await seedNarrativeChatMessage(userId, projectId, updated, locked);
  } catch (e) {
    console.error('[lockDesignConcept] narrative seed failed', e);
    try {
      const fallback = await insertChatMessageTrusted({
        userId,
        projectId,
        role: 'assistant',
        content: [
          `我是「${NARRATIVE_MARKER}」。视觉「${locked.title}」已锁定。`,
          '',
          '请在左侧对齐详情长图叙事；满意后点「确认这版叙事」，右侧会出两张长图供对比。',
          locked.imageUrl
            ? `![锁定主视觉 · ${locked.title}](${locked.imageUrl})`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });
      chatMessage = toApiChatMessage(fallback);
    } catch (e2) {
      console.error('[lockDesignConcept] fallback narrative insert failed', e2);
      chatMessage = {
        id: `local-narrative-${Date.now()}`,
        role: 'assistant',
        content: `我是「${NARRATIVE_MARKER}」。视觉「${locked.title}」已锁定。请在左侧对齐详情长图叙事，再点「确认这版叙事」生成两张长图。`,
        attachments: [],
        createdAt: new Date().toISOString(),
      };
    }
  }

  return { design: locked, project: updated, deliverables, chatMessage };
}

/** Insert lifestyle narrative assistant message (idempotent-ish: caller may check first). */
async function seedNarrativeChatMessage(
  userId: string,
  projectId: string,
  project: PitchProject,
  design: Pick<
    PitchDesignConcept,
    'title' | 'direction' | 'summary' | 'imageUrl'
  >
): Promise<ReturnType<typeof toApiChatMessage>> {
  const brief = await getOrCreateBrief(userId, projectId);
  const narrative = buildPdpNarrativeIntro({
    brandName: project.brandName,
    track: project.track,
    country: project.country,
    designTitle: design.title,
    designDirection: design.direction,
    designSummary: design.summary,
    audience: brief.audience,
    goals: brief.goals,
  });
  const chatBody = formatNarrativeChatMessage({
    brandName: project.brandName,
    designTitle: design.title,
    narrative,
    heroUrl: design.imageUrl || '',
  });
  const row = await insertChatMessageTrusted({
    userId,
    projectId,
    role: 'assistant',
    content: chatBody,
  });
  return toApiChatMessage(row);
}

/**
 * If project is locked into PDP but left chat has no 叙事师 message, insert one once.
 * Safe to call on PDP load / chat open.
 */
export async function ensureNarrativeChatMessage(
  userId: string,
  projectId: string
): Promise<ReturnType<typeof toApiChatMessage> | null> {
  const project = await getProject(userId, projectId);
  if (!project?.lockedDesignId) return null;
  if (
    project.stage !== 'pdp' &&
    project.stage !== 'proposal' &&
    project.stage !== 'video' &&
    project.stage !== 'assets' &&
    project.stage !== 'followup'
  ) {
    return null;
  }

  const messages = await listChatMessages(userId, projectId);
  const hasNarrative = messages.some(
    (m) =>
      m.role === 'assistant' &&
      typeof m.content === 'string' &&
      m.content.includes(NARRATIVE_MARKER)
  );
  if (hasNarrative) return null;

  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, project.lockedDesignId))
    .limit(1);
  if (!design) return null;

  try {
    return await seedNarrativeChatMessage(userId, projectId, project, design);
  } catch (e) {
    console.error('[ensureNarrativeChatMessage] failed', e);
    return null;
  }
}

/**
 * Refine a single concept image (Seedream i2i when possible).
 * Replaces only that row's imageUrl; keeps locked/selection.
 * Posts a short assistant note + updated image into chat.
 */
export async function refineDesignConcept(
  userId: string,
  projectId: string,
  designId: string,
  opts?: { instruction?: string; mode?: 'edit' | 'regen' | 'remove-bg' }
): Promise<{
  design: PitchDesignConcept;
  chatMessage: ReturnType<typeof toApiChatMessage>;
  apiPath: 'i2i-edit' | 't2i-regen';
}> {
  const project = await getProjectOrThrow(userId, projectId);
  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(
      and(
        eq(pitchDesignConcept.id, designId),
        eq(pitchDesignConcept.projectId, projectId),
        eq(pitchDesignConcept.status, 'active')
      )
    )
    .limit(1);
  if (!design) throw new Error('设计概念不存在');

  const mode = opts?.mode || 'edit';
  let instruction = (opts?.instruction || '').trim();
  if (mode === 'remove-bg' && !instruction) {
    instruction =
      '移除背景，保留产品主体边缘清晰，输出干净纯白或浅灰摄影棚背景的电商抠图效果，无文字水印';
  }
  const wantEdit = mode !== 'regen' || !!instruction;
  const brief = await getOrCreateBrief(userId, projectId);

  const prompt = [
    mode === 'remove-bg' && design.imageUrl
      ? '在参考图基础上移除背景，保留主体产品造型与材质细节，商业产品摄影抠图，高品质，无文字水印。'
      : wantEdit && design.imageUrl
        ? '在参考图基础上按用户说明修改细节，尽量保持构图、主体造型与整体风格一致，商业摄影，高品质，无文字水印。'
        : '产品共创概念视觉，商业摄影，高品质，无文字水印。在保持原方向与构图的前提下单独重生这一张。',
    `品牌：${project.brandName || '目标品牌'}`,
    `赛道：${project.track || ''}`,
    `市场：${project.country || ''}`,
    `方向：${design.direction || ''}`,
    `概念：${design.title || ''}`,
    design.summary ? `说明：${design.summary}` : '',
    brief.designDirection ? `整体设计方向：${brief.designDirection}` : '',
    instruction ? `修改要求：${instruction}` : '',
  ]
    .filter(Boolean)
    .join('。');

  let apiPath: 'i2i-edit' | 't2i-regen' = 't2i-regen';
  let url: string | null = null;
  let lastErr = '';

  if (wantEdit && design.imageUrl) {
    try {
      const gen = await volcanoGenerateImage({
        prompt,
        size: '2K',
        image: design.imageUrl,
      });
      if (gen.url) {
        url = gen.url;
        apiPath = 'i2i-edit';
      } else {
        lastErr = gen.error || 'i2i empty';
      }
    } catch (e: any) {
      lastErr = e?.message || 'i2i failed';
    }
  }

  if (!url) {
    try {
      const gen = await volcanoGenerateImage({ prompt, size: '2K' });
      if (gen.url) {
        url = gen.url;
        apiPath = 't2i-regen';
      } else {
        lastErr = gen.error || lastErr || 't2i empty';
      }
    } catch (e: any) {
      lastErr = e?.message || lastErr || 't2i failed';
    }
  }

  if (!url) {
    throw new Error(lastErr || '生图失败，请稍后重试');
  }

  const [updated] = await db()
    .update(pitchDesignConcept)
    .set({ imageUrl: url })
    .where(eq(pitchDesignConcept.id, designId))
    .returning();

  const note =
    mode === 'remove-bg'
      ? `已为「${design.title}」移除背景`
      : instruction && mode !== 'regen'
        ? `已按说明改「${design.title}」：${instruction}`
        : `已单独重生「${design.title}」`;
  const pathHint =
    apiPath === 'i2i-edit' ? '（参考原图编辑）' : '（按原方向重生）';
  const chatMessage = await appendChatMessage({
    userId,
    projectId,
    role: 'assistant',
    content: `${note}${pathHint}。\n![${design.title}§${design.id}](${url})`,
  });

  return { design: updated, chatMessage: toApiChatMessage(chatMessage), apiPath };
}

async function getProjectOrThrow(userId: string, projectId: string) {
  const project = await getProject(userId, projectId);
  if (!project) throw new Error('Project not found');
  return project;
}

// ─── Deliverables (同源素材包) ────────────────────────────────────────────────

export async function listDeliverables(
  userId: string,
  projectId: string
): Promise<PitchDeliverable[]> {
  await getProjectOrThrow(userId, projectId);
  return db()
    .select()
    .from(pitchDeliverable)
    .where(eq(pitchDeliverable.projectId, projectId))
    .orderBy(asc(pitchDeliverable.createdAt));
}

/** Fixed Seedream WxH for BOTH long-image variants (same ratio).
 * Seedream 5.0 flash custom size: total pixels in [921600, 4624220], ratio [1/16,16].
 * 1080x3240 = 3.5MP, 1:3 portrait, short side 1080 (1080p+). 1440x4320 exceeds flash max.
 */
const PDP_LONG_IMAGE_SIZE = '1080x3240';
const PDP_LONG_IMAGE_SIZE_FALLBACKS = ['1440x2880', '2K'] as const;

/**
 * Brand lifestyle PDP long-image prompt (Seedream) — 全球品牌产品延伸生活方式叙事长图.
 * Scene from brand lifestyle world only — NEVER nation-default coffee/kitchen/office.
 * A = brand world / aspired life; B = product participation + close.
 */
function buildPdpLongImagePrompt(input: {
  brandName: string;
  track: string;
  country: string;
  designTitle: string;
  designDirection: string;
  designSummary: string;
  narrativeText: string;
  structured: PdpStructured | null;
  variant: 1 | 2;
  audience?: string;
}): string {
  const s = input.structured;
  const lang = resolveOnImageLanguage(input.country);
  const culture = resolveMarketCulture(input.country);
  const brand = input.brandName || 'target brand';
  const track = input.track || 'category';
  const design = input.designTitle || 'locked concept';
  const direction =
    (input.designDirection || '').trim() || 'brand-aligned lifestyle';
  const summary = (input.designSummary || '').trim();
  const lifestyle = resolveBrandLifestyleForPrompt({
    brandName: brand,
    track,
    audience: input.audience || s?.targetAudience,
    designDirection: direction,
    designSummary: summary,
    narrativeText: input.narrativeText || '',
    structured: s,
  });
  const selectedScene =
    input.variant === 1 ? lifestyle.selectedSceneA : lifestyle.selectedSceneB;
  const imagePart = input.variant === 1 ? 'A' : 'B';
  const imagePartLabel =
    input.variant === 1
      ? 'A — 品牌人群／向往生活／社交活动／环境与品牌精神；产品自然融入'
      : 'B — 延续 A 的品牌世界；产品实际参与生活；积极收束';
  const brandDNA = [
    direction,
    summary ? summary.slice(0, 220) : '',
    (input.narrativeText || '').trim().slice(0, 400),
  ]
    .filter(Boolean)
    .join(' · ');
  const productSpecification = [
    `赛道／品类：${track}`,
    `锁定概念：${design}`,
    summary ? `概念说明：${summary.slice(0, 220)}` : '',
  ]
    .filter(Boolean)
    .join('；');
  const productReference = `严格锁定参考图中的产品真实轮廓、材质、结构、比例与关键设计细节；外观不得漂移；不得增加虚构功能；不得异常尺寸或不符合物理规律的手部／佩戴方式。概念名：「${design}」。`;
  const sampleLines = culture.sampleOnScreenLines.join(' / ');
  const localizedBits = [
    s?.headline ? `headline: ${s.headline}` : '',
    s?.subheadline ? `subheadline: ${s.subheadline}` : '',
    s?.scenarios ? `scenarios: ${s.scenarios}` : '',
    s?.materials ? `materials: ${s.materials}` : '',
    s?.cta ? `cta: ${s.cta}` : '',
    `on-image language: ${lang.languageName} (${lang.localeHint})`,
    `sample lines: ${sampleLines}`,
  ]
    .filter(Boolean)
    .join('；');
  const brandVisual = `品牌视觉与配色跟随锁定概念方向（${direction.slice(0, 120)}）；系列内统一，禁止品牌色漂移。`;
  const seriesContinuity = [
    `产品外观锁定参考图 +「${design}」，A／B 不漂移`,
    '人物身份／五官／着装基线一致，仅情绪与姿态随叙事阶段变化',
    '同一品牌生活世界；允许按叙事换地点／构图／景别',
    '相机语言按品牌调性与指定场景选定后，系列锁定同一套摄影语言（不强制所有品牌同一 Sony 85mm）',
  ].join('；');
  const marketCultureBlock = [
    `区域：${culture.regionKey}`,
    `人物着装文化：${culture.wardrobeCue}`,
    `光线气候：${culture.lightCue}`,
    culture.forbidChinaAesthetics
      ? '禁止中国大陆室内审美默认／大陆电商包装字样／中式屏风红灯笼等（市场非中国时）'
      : '',
    '本块仅人物／语言／文化规范，禁止当作咖啡／厨房／客厅／办公室场景模板',
  ]
    .filter(Boolean)
    .join('；');

  const languageRules = lang.forbidChinese
    ? [
        `HARD — 图上可见文字（标题／副文／CTA／包装字／贴纸）必须仅为 ${lang.languageName}（市场：${lang.localeHint}）。示例：${sampleLines}。`,
        'FORBIDDEN：画面任何位置出现中文／汉字（含包装 mock、水印、UI）。',
        '若叙事或结构化字段为中文，须翻译成目标图上语种后再上图，禁止原样抄中文。',
        '禁止中英混排同一画布脚本冲突。',
      ]
    : [
        `图上文案语种：全部可见文字须为 ${lang.languageName}（市场：${lang.localeHint}）。示例：${sampleLines}。`,
      ];

  return [
    '# Seedream｜全球品牌产品延伸生活方式叙事长图',
    '',
    '## 创作定位',
    '你是一名国际品牌商业摄影、生活方式视觉叙事与产品广告创意总监。',
    '请根据输入的品牌资料、制造商产品资料、目标市场信息及已确认的品牌叙事方案，创作一张高品质品牌生活方式商业摄影长图。',
    '核心目标：视觉化展示制造商产品成为客户品牌旗下新品后，如何自然进入该品牌消费者真实且向往的生活世界。',
    '画面必须让品牌方感受到：这是符合自己品牌审美、消费者身份、生活价值观与商业定位的产品延伸提案。',
    '',
    '## 一、动态输入',
    `【客户品牌名称】${brand}`,
    `【品牌定位与调性】${brandDNA.slice(0, 900)}`,
    `【品牌目标人群】${lifestyle.targetAudience}`,
    `【品牌向往身份】${lifestyle.aspirationalIdentity}`,
    `【品牌生活世界】${lifestyle.brandLifestyleWorld}`,
    `【本张图指定场景】${selectedScene}`,
    `【社交关系与生活活动】${lifestyle.socialDynamics}`,
    `【制造商产品资料】${productSpecification}`,
    `【产品参考图与外观锁定】${productReference}`,
    `【产品使用与融合方式】${lifestyle.productRole}`,
    `【目标国家及地区】${input.country || lang.localeHint}（${culture.regionKey}）`,
    `【当地文化与人物规范】${marketCultureBlock}`,
    `【本土化文案及语言】${localizedBits}`,
    `【品牌视觉与配色规范】${brandVisual}`,
    `【系列人物与画面一致性】${seriesContinuity}`,
    `【本张图的叙事阶段】imagePart=${imagePart} — ${imagePartLabel}`,
    '',
    '## 二、场景生成规则',
    '严格采用已确认的品牌生活世界与本张图指定场景。',
    '根据品牌人群的真实生活、社交关系、兴趣活动、向往目的地和产品角色构建画面。',
    '场景必须具体、具有活动意义和品牌适配理由。',
    '禁止用国家默认生活模板填充。',
    '禁止仅根据行业机械决定场景。',
    '当品牌明确具有居家、办公、咖啡、户外、旅行或其他生活方式属性时，允许自然出现对应场景，但必须有品牌依据。',
    'FORBIDDEN nation defaults: coffee pour-over, kitchen island, living-room sofa wind-down, home-office nook, after-work kettle — unless the brand lifestyle explicitly justifies them.',
    '',
    '## 三、人物与互动',
    `人物符合品牌消费者画像（${lifestyle.targetAudience}）和目标市场背景。`,
    `着装气质参考：${culture.wardrobeCue}；年龄、服饰、妆发、动作及社交关系必须统一。`,
    '人物不只是广告模特，而是在真实生活中参与活动的人；体现自然行为、交流、情绪与环境互动。',
    '快乐不等于所有人物都夸张微笑；应根据品牌选择适合的轻松、自信、热情、宁静、亲密、兴奋或其他积极情绪。',
    '若场景不适合出现人物，可以采用符合品牌叙事的无人物生活方式画面，不强行添加模特。',
    '至少 1 处人物微瑕（袖口褶皱或自然肤质）以避免塑料感。',
    '',
    '## 四、产品融合与真实性',
    productReference,
    `产品角色：${lifestyle.productRole}`,
    '根据产品真实功能呈现合理的使用、穿戴、携带、操作、展示、陈列或空间融合。',
    '不得擅自增加不存在的功能；不得改变已锁定的产品结构。',
    '产品应与生活叙事建立明确联系，并保持足够的视觉识别度。',
    '产品至少 2 处微小现实瑕疵：（1）极浅合模线（2）边缘发丝级微划痕。禁止第三方商标原名，只描述视觉特征。',
    '',
    '## 五、目标市场本土化',
    ...languageRules,
    `人物、环境、生活文化、社交行为、服饰和视觉表达符合目标市场及品牌消费者定位（${culture.regionKey}）。`,
    '允许符合当地真实人口结构的多样人物形象。',
    '品牌名、Logo、型号及指定标识以提供的准确素材为准，不得擅自改写；复杂字体可留后期合成空间。',
    '',
    '## 六、两张图的叙事定位',
    imagePart === 'A'
      ? '本张为 A：重点展示品牌人群、向往生活、社交活动、环境与品牌精神；产品自然融入；构建令人想要进入的生活世界。'
      : '本张为 B：延续 A 图的品牌世界；重点展示产品实际参与生活的情境，以及带来的功能体验、情绪体验或社交连接；形成有吸引力的积极收束。',
    '同一系列保持产品设计、品牌调性、人物关系和画面语言一致；允许根据叙事需要改变地点、构图和镜头距离。',
    '',
    '## 七、商业摄影语言',
    '高品质国际品牌商业摄影；真实自然的人物表情、肤质、身体姿态与环境互动。',
    '符合品牌审美的服装、道具、建筑、景观与生活细节。',
    '根据品牌调性与指定场景选择光线、镜头语言、景深、色彩与构图；不固定所有品牌使用同一镜头、滤镜或色调。',
    '选定后本系列锁定同一相机语言（仅调景别／构图）。',
    '使用适合电商详情页的竖向叙事长图构图，目标比例约 1:3；建立有主次、有节奏、有视觉呼吸感的长图内容。',
    `主光参考气候：${culture.lightCue}（按场景调整，不强制居家窗光）。`,
    '',
    '## 八、禁止内容',
    '禁止国家默认咖啡、厨房、客厅、办公室等固定模板。',
    '禁止与品牌定位不匹配的通用广告场景。',
    '禁止不真实的产品操作；禁止产品外观漂移、尺寸失真及虚构功能。',
    '禁止不符合目标市场的语言、服饰或文化表达。',
    '禁止人物无意义地摆拍或强行手持产品。',
    '禁止过度拥挤的拼贴、无关道具和没有逻辑的场景混搭。',
    '禁止为了视觉冲击而牺牲品牌辨识度和产品真实性。',
    '禁止痛点／冲突／解决方案戏剧弧（劣质样品桌、采购崩溃等）。',
    'NEGATIVES: logo warp / brand-color drift; garbled text / watermarks; product morph; bad hands / extra fingers / warped faces; game CG / plastic skin; over-FX; webpage UI chrome.',
    lang.forbidChinese ? 'NEGATIVE: ANY Chinese characters / 汉字 on canvas.' : '',
    culture.forbidChinaAesthetics
      ? 'NEGATIVE: CN-default aesthetics when market is not China.'
      : '',
    '',
    '## 最终标准',
    '品牌专属性；消费者向往感；真实生活方式；清晰产品价值；自然社交与情绪；本土化文化与语言；可信的品牌产品延伸；高水平商业摄影质感；A／B 系列一致性。',
    '最终画面应能作为制造商向潜在品牌客户展示 OEM、ODM、产品定制或联合开发机会的高品质视觉提案。',
    'MICRO FLAWS mandatory. DISCLAIMER: commercial lifestyle gens often need 2–4 reruns; complex logos prefer post overlay.',
  ]
    .filter(Boolean)
    .join('\n');
}


async function generateOnePdpLongImage(input: {
  prompt: string;
  referenceImageUrl?: string;
}): Promise<{ url: string; error?: string; sizeUsed: string }> {
  const ref = input.referenceImageUrl || undefined;
  const sizes = [PDP_LONG_IMAGE_SIZE, ...PDP_LONG_IMAGE_SIZE_FALLBACKS];
  let lastErr = '';
  for (const size of sizes) {
    try {
      const prompt =
        size === PDP_LONG_IMAGE_SIZE
          ? input.prompt
          : `${input.prompt} Vertical tall long image 1:3 portrait.`;
      const gen = await volcanoGenerateImage({
        prompt,
        size,
        image: ref,
      });
      if (gen.url) {
        if (size !== PDP_LONG_IMAGE_SIZE) {
          console.error(
            `[pdp-long-images] primary size ${PDP_LONG_IMAGE_SIZE} failed (${lastErr || 'no url'}); using fallback size=${size}`
          );
        }
        return { url: gen.url, sizeUsed: size };
      }
      lastErr = gen.error || 'empty url';
      console.error(`[pdp-long-images] size=${size} failed: ${lastErr}`);
    } catch (e: any) {
      lastErr = e?.message || String(e);
      console.error(`[pdp-long-images] size=${size} threw: ${lastErr}`);
    }
  }
  return { url: '', error: lastErr || 'empty url', sizeUsed: '' };
}


/** Draft or regenerate the PDP deliverable shell (narrative phase; no long image yet). */
export async function ensurePdpDeliverable(
  userId: string,
  projectId: string,
  designId: string,
  opts?: { force?: boolean; generateImage?: boolean; status?: string }
): Promise<PitchDeliverable[]> {
  const project = await getProjectOrThrow(userId, projectId);
  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(
      and(
        eq(pitchDesignConcept.id, designId),
        eq(pitchDesignConcept.projectId, projectId)
      )
    )
    .limit(1);
  if (!design) throw new Error('设计概念不存在');

  const existing = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, designId),
        eq(pitchDeliverable.kind, 'pdp')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt));

  if (existing.length > 0 && !opts?.force) return existing;

  if (opts?.force && existing.length) {
    for (const d of existing) {
      await db().delete(pitchDeliverable).where(eq(pitchDeliverable.id, d.id));
    }
  }

  const brief = await getOrCreateBrief(userId, projectId);
  const copy = buildPdpCopy({
    brandName: project.brandName,
    track: project.track,
    country: project.country,
    designTitle: design.title,
    designDirection: design.direction,
    designSummary: design.summary,
    goals: brief.goals,
    audience: brief.audience,
  });

  // Long images are generated only in confirmNarrative (two variants).
  // Optional generateImage=true is kept for assets pack fallback (still dual).
  let fileUrl = design.imageUrl || '';
  let content = copy.content;
  if (opts?.generateImage === true) {
    const structured = parsePdpStructured(copy.content);
    const narrativeText = [
      structured?.headline,
      structured?.subheadline,
      structured?.scenarios,
      structured?.materials,
    ]
      .filter(Boolean)
      .join('\n');
    const genResult = await generateTwoPdpLongImages({
      brandName: project.brandName,
      track: project.track,
      country: project.country,
      designTitle: design.title,
      designDirection: design.direction,
      designSummary: design.summary,
      narrativeText,
      structured,
      referenceImageUrl: design.imageUrl || '',
    });
    if (genResult.urls.length) {
      fileUrl = genResult.urls[0];
      content = embedPdpLongImages(copy.content, genResult.urls, genResult.urls[0]);
    }
  }

  const version =
    (existing.reduce((m: number, d: { version: number }) => Math.max(m, d.version), 0) ||
      0) + 1;

  const [row] = await db()
    .insert(pitchDeliverable)
    .values({
      id: getUuid(),
      projectId,
      userId,
      designId,
      kind: 'pdp',
      title: copy.title,
      summary: copy.summary,
      content,
      fileUrl,
      version,
      status: opts?.status || 'narrative',
    })
    .returning();

  return [row];
}

async function generateTwoPdpLongImages(input: {
  brandName: string;
  track: string;
  country: string;
  designTitle: string;
  designDirection: string;
  designSummary: string;
  narrativeText: string;
  structured: PdpStructured | null;
  referenceImageUrl: string;
  audience?: string;
}): Promise<{ urls: string[]; errors: string[] }> {
  const errors: string[] = [];
  // Sequential (not parallel): more reliable under Worker subrequest limits.
  // Both variants use the exact same size string (PDP_LONG_IMAGE_SIZE).
  const urls: string[] = [];
  for (const variant of [1, 2] as const) {
    const prompt = buildPdpLongImagePrompt({ ...input, variant });
    const gen = await generateOnePdpLongImage({
      prompt,
      referenceImageUrl: input.referenceImageUrl,
    });
    if (gen.url) {
      urls.push(gen.url);
      continue;
    }
    errors.push(`v${variant}: ${gen.error || 'empty url'}`);
  }
  return { urls, errors };
}

async function getLatestPdpRow(
  projectId: string,
  designId: string
): Promise<PitchDeliverable | null> {
  const rows = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, designId),
        eq(pitchDeliverable.kind, 'pdp')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);
  return rows[0] || null;
}

function scheduleBackground(promise: Promise<unknown>) {
  try {
    const ctx = getRequestExecutionContext();
    if (ctx?.waitUntil) {
      ctx.waitUntil(promise);
      return;
    }
  } catch {
    /* fall through */
  }
  // Dev / no waitUntil: still fire-and-forget (do not block response)
  void promise.catch((e) => console.error('[pdp-long-images] bg', e));
}

/** Confirm left narrative → start async dual long-image job (waitUntil) → poll via GET. */
export async function confirmNarrative(
  userId: string,
  projectId: string
): Promise<{
  project: PitchProject;
  pdp: PitchDeliverable;
  chatMessage: ReturnType<typeof toApiChatMessage>;
  longImageUrls: string[];
  status: 'generating' | 'ready' | 'failed';
}> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) throw new Error('请先锁定设计视觉');

  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, project.lockedDesignId))
    .limit(1);
  if (!design) throw new Error('锁定设计不存在');

  let pdpRow = await getLatestPdpRow(projectId, project.lockedDesignId);
  if (!pdpRow) {
    const created = await ensurePdpDeliverable(
      userId,
      projectId,
      project.lockedDesignId,
      { generateImage: false, status: 'narrative' }
    );
    pdpRow = created[0] || null;
  }
  if (!pdpRow) throw new Error('详情页交付物不存在');

  // Prefer latest assistant narrative from chat; fall back to structured fields.
  const recent = await db()
    .select()
    .from(pitchChatMessage)
    .where(eq(pitchChatMessage.projectId, projectId))
    .orderBy(desc(pitchChatMessage.createdAt))
    .limit(12);
  const latestNarrative =
    recent.find(
      (m: PitchChatMessage) =>
        m.role === 'assistant' &&
        (m.content.includes(NARRATIVE_MARKER) ||
          m.content.includes('长图') ||
          m.content.includes('叙事'))
    )?.content ||
    recent.find((m: PitchChatMessage) => m.role === 'assistant')?.content ||
    '';

  const structured = parsePdpStructured(pdpRow.content);
  const narrativeText = (
    latestNarrative
      .replace(/<<<PDP_JSON[\s\S]*?PDP_JSON>>>/g, '')
      .replace(/<<<PDP_LONG_IMAGES[\s\S]*?PDP_LONG_IMAGES>>>/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .trim() ||
    [
      structured?.headline,
      structured?.subheadline,
      structured?.scenarios,
      structured?.materials,
      structured?.cta,
    ]
      .filter(Boolean)
      .join('\n')
  ).slice(0, 2000);

  const [pdp] = await db()
    .update(pitchDeliverable)
    .set({
      status: 'generating',
      summary: '正在按确认叙事生成两张详情长图…',
      title:
        (pdpRow.title || '')
          .replace('电商详情页', '详情长图')
          .replace('详情页', '详情长图') ||
        `${project.brandName || '品牌'} · 详情长图`,
    })
    .where(eq(pitchDeliverable.id, pdpRow.id))
    .returning();

  const marketLang = resolveOnImageLanguage(project.country);
  const marketCulture = resolveMarketCulture(project.country);
  const chatMessage = await insertChatMessageTrusted({
    userId,
    projectId,
    role: 'assistant',
    content: [
      '已确认这版叙事。',
      '',
      '## 生活方式详情长图简报（两张 · 品牌生活世界）',
      `- **方案 A**：进入品牌人群向往的生活世界（社交／环境／品牌精神）；产品自然融入`,
      `- **方案 B**：延续 A 的世界；产品实际参与生活；积极收束`,
      `- 一致性锁定：产品外观（参考概念图）· 品牌色随概念方向 · 同一人物关系 · 相机语言按品牌调性选定后系列锁定（不固定所有品牌同一镜头）`,
      `- 图上文案：${marketLang.languageName} · 人文区域：${marketCulture.regionKey}（仅人物／语言／光线；不当场景模板）${marketLang.forbidChinese ? ' · 禁中文上图' : ''}`,
      '- 硬性：场景来自品牌生活世界；禁止国家默认咖啡／厨房／客厅／办公室；具体名词、≥2 产品微瑕、人物微瑕；禁止冲突/痛点戏剧',
      '- 下游：整套可对接「场景视频」图生视频，产品／品牌色与视频工程师对齐',
      '',
      '正在按品牌生活世界生成 **两张** 竖版详情长图（约 1–2 分钟）…',
      '生成完成后会出现在左侧聊天与右侧对比栏。请稍候，不要重复点击。',
    ].join('\n'),
  });

  const jobInput = {
    userId,
    projectId,
    pdpId: pdp.id,
    brandName: project.brandName,
    track: project.track,
    country: project.country,
    designTitle: design.title,
    designDirection: design.direction,
    designSummary: design.summary,
    narrativeText,
    structured,
    referenceImageUrl: design.imageUrl || '',
    baseContent:
      pdpRow.content ||
      serializePdpContent(
        structured ||
          buildPdpStructured({
            brandName: project.brandName,
            track: project.track,
            country: project.country,
            designTitle: design.title,
            designDirection: design.direction,
            designSummary: design.summary,
          })
      ),
  };

  // Client-driven ticks via advancePdpLongImages (waitUntil was unreliable on this Worker).
  // jobInput retained for potential future queue; no background schedule.
  void jobInput;

  return {
    project,
    pdp,
    chatMessage: toApiChatMessage(chatMessage),
    longImageUrls: [],
    status: 'generating',
  };
}

async function runPdpLongImageJob(input: {
  userId: string;
  projectId: string;
  pdpId: string;
  brandName: string;
  track: string;
  country: string;
  designTitle: string;
  designDirection: string;
  designSummary: string;
  narrativeText: string;
  structured: PdpStructured | null;
  referenceImageUrl: string;
  baseContent: string;
  audience?: string;
}) {
  try {
    const { urls, errors } = await generateTwoPdpLongImages({
      brandName: input.brandName,
      track: input.track,
      country: input.country,
      designTitle: input.designTitle,
      designDirection: input.designDirection,
      designSummary: input.designSummary,
      narrativeText: input.narrativeText,
      structured: input.structured,
      referenceImageUrl: input.referenceImageUrl,
      audience: input.audience,
    });

    if (!urls.length) {
      console.error('[pdp-long-images] empty urls', errors);
      await db()
        .update(pitchDeliverable)
        .set({
          status: 'failed',
          summary: `长图生成失败：${errors.slice(0, 2).join('；') || '无 URL'}`,
        })
        .where(eq(pitchDeliverable.id, input.pdpId));
      await insertChatMessageTrusted({
        userId: input.userId,
        projectId: input.projectId,
        role: 'assistant',
        content: [
          '详情长图生成失败，请再点一次「确认这版叙事」重试。',
          errors[0] ? `原因：${errors[0]}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });
      return;
    }

    const selected = urls[0];
    const structured =
      input.structured ||
      buildPdpStructured({
        brandName: input.brandName,
        track: input.track,
        country: input.country,
        designTitle: input.designTitle,
        designDirection: input.designDirection,
        designSummary: input.designSummary,
      });
    const content = embedPdpLongImages(input.baseContent, urls, selected);

    await db()
      .update(pitchDeliverable)
      .set({
        status: 'ready',
        summary: `叙事已确认 · 已生成 ${urls.length} 张详情长图，请在右侧选择`,
        content,
        fileUrl: selected,
      })
      .where(eq(pitchDeliverable.id, input.pdpId));

    await insertChatMessageTrusted({
      userId: input.userId,
      projectId: input.projectId,
      role: 'assistant',
      content: formatPdpChatMessage({
        structured,
        narrative: '已按左侧确认的叙事生成两张详情长图。',
        longImageUrls: urls,
        longImageUrl: selected,
      }),
    });
  } catch (e: any) {
    console.error('[pdp-long-images] job failed', e);
    try {
      await db()
        .update(pitchDeliverable)
        .set({
          status: 'failed',
          summary: `长图生成异常：${e?.message || 'unknown'}`,
        })
        .where(eq(pitchDeliverable.id, input.pdpId));
      await insertChatMessageTrusted({
        userId: input.userId,
        projectId: input.projectId,
        role: 'assistant',
        content: `详情长图生成异常：${e?.message || '请稍后重试'}`,
      });
    } catch (e2) {
      console.error('[pdp-long-images] failure persist failed', e2);
    }
  }
}


/** Generate the next missing long image (1 Seedream call). Client polls until 2 urls. */
export async function advancePdpLongImages(
  userId: string,
  projectId: string
): Promise<{
  project: PitchProject;
  pdp: PitchDeliverable;
  longImageUrls: string[];
  status: 'generating' | 'ready' | 'failed';
  chatMessage?: ReturnType<typeof toApiChatMessage>;
  progress: { done: number; total: number };
}> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) throw new Error('请先锁定设计视觉');

  const pdpRow = await getLatestPdpRow(projectId, project.lockedDesignId);
  if (!pdpRow) throw new Error('详情页交付物不存在');
  if (pdpRow.status === 'ready') {
    const parsed = parsePdpLongImages(pdpRow.content);
    const urls = parsed?.urls?.length
      ? parsed.urls
      : [pdpRow.fileUrl].filter(Boolean);
    const chatMessage = await ensureLongImagesChatMessage(
      userId,
      projectId,
      project,
      pdpRow,
      urls
    );
    return {
      project,
      pdp: pdpRow,
      longImageUrls: urls,
      status: 'ready',
      chatMessage,
      progress: { done: urls.length, total: 2 },
    };
  }

  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, project.lockedDesignId))
    .limit(1);
  if (!design) throw new Error('锁定设计不存在');

  const structured = parsePdpStructured(pdpRow.content);
  const existing = parsePdpLongImages(pdpRow.content);
  const have = existing?.urls?.filter(Boolean) || [];
  const nextVariant = (have.length + 1) as 1 | 2;
  if (have.length >= 2) {
    const [pdp] = await db()
      .update(pitchDeliverable)
      .set({
        status: 'ready',
        summary: `叙事已确认 · 已生成 ${have.length} 张详情长图，请在右侧选择`,
        fileUrl: have[0],
      })
      .where(eq(pitchDeliverable.id, pdpRow.id))
      .returning();
    const chatMessage = await ensureLongImagesChatMessage(
      userId,
      projectId,
      project,
      pdp,
      have
    );
    return {
      project,
      pdp,
      longImageUrls: have,
      status: 'ready',
      chatMessage,
      progress: { done: 2, total: 2 },
    };
  }

  // Narrative text from summary-carrying chat if present
  const recent = await db()
    .select()
    .from(pitchChatMessage)
    .where(eq(pitchChatMessage.projectId, projectId))
    .orderBy(desc(pitchChatMessage.createdAt))
    .limit(12);
  const latestNarrative =
    recent.find(
      (m: PitchChatMessage) =>
        m.role === 'assistant' &&
        (m.content.includes(NARRATIVE_MARKER) ||
          m.content.includes('长图') ||
          m.content.includes('叙事')) &&
        !m.content.includes('正在生成')
    )?.content || '';
  const narrativeText = (
    latestNarrative
      .replace(/<<<PDP_JSON[\s\S]*?PDP_JSON>>>/g, '')
      .replace(/<<<PDP_LONG_IMAGES[\s\S]*?PDP_LONG_IMAGES>>>/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .trim() ||
    [
      structured?.headline,
      structured?.subheadline,
      structured?.scenarios,
      structured?.materials,
      structured?.cta,
    ]
      .filter(Boolean)
      .join('\n')
  ).slice(0, 2000);

  const prompt = buildPdpLongImagePrompt({
    brandName: project.brandName,
    track: project.track,
    country: project.country,
    designTitle: design.title,
    designDirection: design.direction,
    designSummary: design.summary,
    narrativeText,
    structured,
    variant: nextVariant,
  });
  const gen = await generateOnePdpLongImage({
    prompt,
    referenceImageUrl: design.imageUrl || '',
  });
  const url = gen.url || '';
  const err = gen.error || '';

  if (!url) {
    const [failed] = await db()
      .update(pitchDeliverable)
      .set({
        status: 'failed',
        summary: `长图方案${nextVariant}生成失败：${err || '无 URL'}`,
      })
      .where(eq(pitchDeliverable.id, pdpRow.id))
      .returning();
    const chatMessage = await insertChatMessageTrusted({
      userId,
      projectId,
      role: 'assistant',
      content: `详情长图方案 ${nextVariant} 生成失败，请再点「确认这版叙事」重试。${err ? `原因：${err}` : ''}`,
    });
    return {
      project,
      pdp: failed,
      longImageUrls: have,
      status: 'failed',
      chatMessage: toApiChatMessage(chatMessage),
      progress: { done: have.length, total: 2 },
    };
  }

  const urls = [...have, url];
  const selected = urls[0];
  const baseContent =
    pdpRow.content ||
    serializePdpContent(
      structured ||
        buildPdpStructured({
          brandName: project.brandName,
          track: project.track,
          country: project.country,
          designTitle: design.title,
          designDirection: design.direction,
          designSummary: design.summary,
        })
    );
  const content = embedPdpLongImages(baseContent, urls, selected);
  const done = urls.length >= 2;
  const [pdp] = await db()
    .update(pitchDeliverable)
    .set({
      status: done ? 'ready' : 'generating',
      summary: done
        ? `叙事已确认 · 已生成 ${urls.length} 张详情长图，请在右侧选择`
        : `正在生成详情长图（${urls.length}/2）…`,
      content,
      fileUrl: selected,
    })
    .where(eq(pitchDeliverable.id, pdpRow.id))
    .returning();

  let chatMessage: ReturnType<typeof toApiChatMessage> | undefined;
  if (done) {
    chatMessage = await ensureLongImagesChatMessage(
      userId,
      projectId,
      project,
      pdp,
      urls
    );
  }

  return {
    project,
    pdp,
    longImageUrls: urls,
    status: done ? 'ready' : 'generating',
    chatMessage,
    progress: { done: urls.length, total: 2 },
  };
}


async function ensureLongImagesChatMessage(
  userId: string,
  projectId: string,
  project: PitchProject,
  pdp: PitchDeliverable,
  urls: string[]
): Promise<ReturnType<typeof toApiChatMessage> | undefined> {
  if (!urls.length) return undefined;
  const recent = await db()
    .select()
    .from(pitchChatMessage)
    .where(eq(pitchChatMessage.projectId, projectId))
    .orderBy(desc(pitchChatMessage.createdAt))
    .limit(8);
  const already = recent.find(
    (m: PitchChatMessage) =>
      m.role === 'assistant' &&
      m.content.includes('详情长图方案') &&
      urls.some((u) => m.content.includes(u.slice(0, 40)))
  );
  if (already) return toApiChatMessage(already);

  const structured =
    parsePdpStructured(pdp.content) ||
    buildPdpStructured({
      brandName: project.brandName,
      track: project.track,
      country: project.country,
      designTitle: pdp.title || '详情长图',
      designDirection: '',
      designSummary: pdp.summary || '',
    });
  try {
    const row = await insertChatMessageTrusted({
      userId,
      projectId,
      role: 'assistant',
      content: formatPdpChatMessage({
        structured,
        narrative: '已按左侧确认的叙事生成两张详情长图。',
        longImageUrls: urls,
        longImageUrl: urls[0],
      }),
    });
    return toApiChatMessage(row);
  } catch (e) {
    console.error('[ensureLongImagesChatMessage] insert failed', e);
    // Fallback: shorter message without embedded JSON
    try {
      const row = await insertChatMessageTrusted({
        userId,
        projectId,
        role: 'assistant',
        content: [
          '已按确认的叙事生成两张详情长图。请到右侧对比点选。',
          '',
          ...urls.map((u, i) => `![详情长图方案 ${i + 1}](${u})`),
        ].join('\n'),
      });
      return toApiChatMessage(row);
    } catch (e2) {
      console.error('[ensureLongImagesChatMessage] fallback failed', e2);
      return undefined;
    }
  }
}

/** Pick one of the two long images on the right before final PDP confirm. */
export async function selectPdpLongImage(
  userId: string,
  projectId: string,
  selectedUrl: string
): Promise<{ project: PitchProject; pdp: PitchDeliverable }> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) throw new Error('请先锁定设计视觉');
  if (!selectedUrl?.trim()) throw new Error('请选择一张长图');

  const rows = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, project.lockedDesignId),
        eq(pitchDeliverable.kind, 'pdp')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);
  if (!rows.length) throw new Error('详情长图尚未生成');

  const parsed = parsePdpLongImages(rows[0].content);
  const urls = parsed?.urls?.length
    ? parsed.urls
    : [rows[0].fileUrl].filter(Boolean);
  if (urls.length && !urls.includes(selectedUrl) && selectedUrl !== rows[0].fileUrl) {
    // allow selecting either listed URL
    urls.push(selectedUrl);
  }

  const content = embedPdpLongImages(rows[0].content, urls, selectedUrl);
  const [pdp] = await db()
    .update(pitchDeliverable)
    .set({
      content,
      fileUrl: selectedUrl,
      summary: `已选择长图方案 · 可确认进入产品提案`,
    })
    .where(eq(pitchDeliverable.id, rows[0].id))
    .returning();

  return { project, pdp };
}

/** Confirm PDP long-image → advance to 产品提案 (flow A). */
export async function confirmPdp(
  userId: string,
  projectId: string
): Promise<{
  project: PitchProject;
  deliverables: PitchDeliverable[];
  pdp: PitchDeliverable;
  chatMessage?: ReturnType<typeof toApiChatMessage>;
}> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) {
    throw new Error('请先锁定设计视觉');
  }

  let pdpRows = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, project.lockedDesignId),
        eq(pitchDeliverable.kind, 'pdp')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);

  if (!pdpRows.length) {
    pdpRows = await ensurePdpDeliverable(
      userId,
      projectId,
      project.lockedDesignId,
      { force: true, generateImage: true, status: 'ready' }
    );
  }

  if (pdpRows[0]?.status === 'narrative') {
    throw new Error('请先在左侧确认长图叙事并生成长图，再确认进入产品提案');
  }

  // Mark PDP confirmed without wiping other deliverables
  const [finalPdp] = await db()
    .update(pitchDeliverable)
    .set({
      status: 'ready',
      summary: pdpRows[0].summary?.includes('已选择')
        ? pdpRows[0].summary
        : `已确认叙事长图 · 可进入产品提案`,
    })
    .where(eq(pitchDeliverable.id, pdpRows[0].id))
    .returning();

  // Ensure outline pack exists (concepts/proposal/video/outreach) without force-wipe
  await ensureDeliverables(userId, projectId, project.lockedDesignId);
  await refreshProposalOutlineFromBrief(
    userId,
    projectId,
    project.lockedDesignId
  );

  const updated = await updateProject(userId, projectId, { stage: 'proposal' });
  if (!updated) throw new Error('Project not found');

  const deliverables = await listDeliverables(userId, projectId);
  const chatMessage =
    (await ensureProposalChatMessage(userId, projectId, { force: true })) ||
    undefined;
  return {
    project: updated,
    deliverables,
    pdp: finalPdp || pdpRows[0],
    chatMessage,
  };
}


/**
 * Rebuild proposal outline markdown from brief + locked design when still thin/legacy
 * and no PDF has been stored yet. Keeps user-edited thick outlines.
 */
async function refreshProposalOutlineFromBrief(
  userId: string,
  projectId: string,
  designId: string
): Promise<void> {
  const brief = await getOrCreateBrief(userId, projectId);
  const project = await getProjectOrThrow(userId, projectId);
  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, designId))
    .limit(1);
  if (!design) return;

  const rows = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, designId),
        eq(pitchDeliverable.kind, 'proposal')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);
  if (!rows.length) return;
  const row = rows[0];
  const hasPdf = /<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/i.test(
    row.content || ''
  );
  const body = (row.content || '')
    .replace(/<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/gi, '')
    .trim();
  if (hasPdf && !isLegacyThinProposalOutline(body)) return;
  if (!isLegacyThinProposalOutline(body) && body.length > 400) return;

  const materialsNote = await buildFactoryMaterialsNoteFromAssets(
    userId,
    projectId
  );
  const deliveryExtra: ProposalDeliveryFacts = {};
  if (materialsNote) deliveryExtra.factoryMaterialsNote = materialsNote;
  const content = buildProposalContent({
    brandName: project.brandName || brief.brandName,
    track: project.track || brief.track,
    country: project.country || brief.country,
    designTitle: design.title,
    designDirection: design.direction,
    designSummary: design.summary,
    goals: brief.goals,
    audience: brief.audience,
    opportunity: brief.opportunity,
    constraints: brief.constraints,
    delivery: deliveryExtra,
  });
  const nextContent = hasPdf
    ? content +
      '\n\n' +
      (row.content || '').match(
        /<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/i
      )?.[0]
    : content;
  await db()
    .update(pitchDeliverable)
    .set({
      content: nextContent || content,
      summary: `品牌世界 · 概念 · 工厂交付（${project.track || brief.track || '赛道'}）`,
      title: `${project.brandName || brief.brandName || 'Brand'} 产品提案`,
    })
    .where(eq(pitchDeliverable.id, row.id));
}

/**
 * Insert or refresh left-chat product-proposal Markdown preview (呈品 · 提案).
 * Idempotent: one message per project; force updates content after pack regen.
 */
export async function ensureProposalChatMessage(
  userId: string,
  projectId: string,
  opts?: { force?: boolean }
): Promise<ReturnType<typeof toApiChatMessage> | null> {
  const project = await getProject(userId, projectId);
  if (!project?.lockedDesignId) return null;
  if (
    project.stage !== 'proposal' &&
    project.stage !== 'video' &&
    project.stage !== 'assets' &&
    project.stage !== 'followup'
  ) {
    return null;
  }

  // Ensure proposal outline row exists
  let proposalRows = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, project.lockedDesignId),
        eq(pitchDeliverable.kind, 'proposal')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);
  if (!proposalRows.length) {
    await ensureDeliverables(userId, projectId, project.lockedDesignId);
    proposalRows = await db()
      .select()
      .from(pitchDeliverable)
      .where(
        and(
          eq(pitchDeliverable.projectId, projectId),
          eq(pitchDeliverable.designId, project.lockedDesignId),
          eq(pitchDeliverable.kind, 'proposal')
        )
      )
      .orderBy(desc(pitchDeliverable.createdAt))
      .limit(1);
  }
  if (opts?.force) {
    await refreshProposalOutlineFromBrief(
      userId,
      projectId,
      project.lockedDesignId
    );
    proposalRows = await db()
      .select()
      .from(pitchDeliverable)
      .where(
        and(
          eq(pitchDeliverable.projectId, projectId),
          eq(pitchDeliverable.designId, project.lockedDesignId),
          eq(pitchDeliverable.kind, 'proposal')
        )
      )
      .orderBy(desc(pitchDeliverable.createdAt))
      .limit(1);
  }

  const proposal = proposalRows[0];
  if (!proposal?.content?.trim()) return null;

  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, project.lockedDesignId))
    .limit(1);
  const heroUrl = (design?.imageUrl || '').trim();
  const heroTitle = design?.title || '锁定概念主视觉';

  const outlineBody = (proposal.content || '')
    .replace(/<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/gi, '')
    .trim();

  const bodyParts = [
    `我是「${PROPOSAL_MARKER}」。`,
    '',
    '叙事长图已确认。以下为 **产品提案画册大纲**（品牌世界 · 概念 · 工厂交付），可用左侧对话修改。',
    '定稿后点消息下方的 **「确认并生成 PDF」**（可反复改完再生成）。价格 / MOQ / 交期等缺失请写「待共创确认」。',
    '',
  ];
  if (heroUrl) {
    bodyParts.push(`![${heroTitle}](${heroUrl})`, '');
  }
  bodyParts.push(outlineBody);
  const content = bodyParts.join('\n');

  const messages = await listChatMessages(userId, projectId);
  const existing = messages.filter(
    (m) =>
      m.role === 'assistant' &&
      typeof m.content === 'string' &&
      m.content.includes(PROPOSAL_MARKER)
  );

  try {
    if (existing.length) {
      const primary = existing[0];
      const stale =
        opts?.force ||
        !primary.content.includes(proposal.content.trim().slice(0, 60));
      if (!stale) {
        return toApiChatMessage(primary);
      }
      const [updated] = await db()
        .update(pitchChatMessage)
        .set({ content })
        .where(eq(pitchChatMessage.id, primary.id))
        .returning();
      for (const extra of existing.slice(1)) {
        await db()
          .delete(pitchChatMessage)
          .where(eq(pitchChatMessage.id, extra.id));
      }
      return toApiChatMessage(updated || primary);
    }

    const row = await insertChatMessageTrusted({
      userId,
      projectId,
      role: 'assistant',
      content,
    });
    return toApiChatMessage(row);
  } catch (e) {
    console.error('[ensureProposalChatMessage] failed', e);
    return null;
  }
}

/**
 * Right-pane "不满意？改大纲后重新生成": force-refresh proposal outline in left chat,
 * roll stage back to proposal if already past it, nudge user to edit then confirm.
 * Does NOT generate PDF.
 */
export async function beginProposalRevise(
  userId: string,
  projectId: string
): Promise<{
  project: PitchProject;
  proposalChatMessage: ReturnType<typeof toApiChatMessage> | null;
  chatMessage: ReturnType<typeof toApiChatMessage>;
}> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) throw new Error('请先锁定设计视觉');

  let next = project;
  if (
    project.stage === 'video' ||
    project.stage === 'assets' ||
    project.stage === 'followup'
  ) {
    const updated = await updateProject(userId, projectId, { stage: 'proposal' });
    if (updated) next = updated;
  } else if (project.stage !== 'proposal') {
    throw new Error('请先确认叙事长图进入产品提案');
  }

  const proposalChatMessage =
    (await ensureProposalChatMessage(userId, projectId, { force: true })) ||
    null;

  const chatMessage = await insertChatMessageTrusted({
    userId,
    projectId,
    role: 'assistant',
    content: [
      `我是「${PROPOSAL_MARKER}」。`,
      '',
      '可以继续改 **产品提案大纲**。改满意后点下方 **「确认并生成 PDF」** 会覆盖上一版画册；**不会自动生成**。',
      '',
      '> 右侧「打开 / 下载」仍可看当前 PDF；新 PDF 要等你点确认后才覆盖。',
    ].join('\n'),
  });

  return {
    project: next,
    proposalChatMessage,
    chatMessage: toApiChatMessage(chatMessage),
  };
}

/** Public API path for the proposal PDF (auth-gated stream). */
export function proposalPdfApiPath(projectId: string) {
  return `/api/pitchpro/projects/${projectId}/proposal-pdf`;
}

/**
 * Confirm left-chat proposal outline → generate real PDF, store on deliverable.fileUrl.
 * Re-runnable: user can revise outline in chat then confirm again.
 */
export async function confirmProposalPdf(
  userId: string,
  projectId: string
): Promise<{
  project: PitchProject;
  proposal: PitchDeliverable;
  chatMessage: ReturnType<typeof toApiChatMessage>;
  fileUrl: string;
  videoChatMessage?: ReturnType<typeof toApiChatMessage>;
}> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) throw new Error('请先锁定设计视觉');
  if (
    project.stage !== 'proposal' &&
    project.stage !== 'video' &&
    project.stage !== 'assets' &&
    project.stage !== 'followup'
  ) {
    throw new Error('请先确认叙事长图进入产品提案');
  }

  let proposalRows = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, project.lockedDesignId),
        eq(pitchDeliverable.kind, 'proposal')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);

  if (!proposalRows.length) {
    await ensureDeliverables(userId, projectId, project.lockedDesignId);
    proposalRows = await db()
      .select()
      .from(pitchDeliverable)
      .where(
        and(
          eq(pitchDeliverable.projectId, projectId),
          eq(pitchDeliverable.designId, project.lockedDesignId),
          eq(pitchDeliverable.kind, 'proposal')
        )
      )
      .orderBy(desc(pitchDeliverable.createdAt))
      .limit(1);
  }
  if (!proposalRows.length) throw new Error('产品提案交付物不存在');

  const recent = await db()
    .select()
    .from(pitchChatMessage)
    .where(eq(pitchChatMessage.projectId, projectId))
    .orderBy(desc(pitchChatMessage.createdAt))
    .limit(20);

  const latestOutline =
    recent.find(
      (m: PitchChatMessage) =>
        m.role === 'assistant' &&
        m.content.includes(PROPOSAL_MARKER) &&
        !m.content.includes('PDF_READY_MARKER')
    )?.content || '';

  let outlineMd = (proposalRows[0].content || '')
    .replace(/<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/g, '')
    .trim();
  if (latestOutline) {
    let cleaned = latestOutline
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/g, '')
      .trim();
    const hash = cleaned.indexOf('# ');
    if (hash >= 0) cleaned = cleaned.slice(hash).trim();
    if (cleaned) outlineMd = cleaned;
  }
  if (!outlineMd.trim()) throw new Error('提案大纲为空');

  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, project.lockedDesignId))
    .limit(1);

  // Collect visuals for illustrated B2B booklet: locked concept + PDP long images
  const pdpForPdf = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, project.lockedDesignId),
        eq(pitchDeliverable.kind, 'pdp')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);
  const longParsed = parsePdpLongImages(pdpForPdf[0]?.content || '');
  const longUrls = (longParsed?.urls || []).filter((u) => /^https?:\/\//i.test(u));
  const selectedLong =
    (longParsed?.selected && /^https?:\/\//i.test(longParsed.selected)
      ? longParsed.selected
      : '') ||
    (pdpForPdf[0]?.fileUrl && /^https?:\/\//i.test(pdpForPdf[0].fileUrl)
      ? pdpForPdf[0].fileUrl
      : '') ||
    longUrls[0] ||
    '';
  const orderedLong = [
    ...(selectedLong ? [selectedLong] : []),
    ...longUrls.filter((u) => u !== selectedLong),
  ];

  const langName = resolveOnImageLanguage(project.country).languageName;
  const isZh = langName.startsWith('Chinese');
  const pdfImages: {
    url: string;
    label?: string;
    role?: 'hero' | 'long';
  }[] = [];
  if (design?.imageUrl && /^https?:\/\//i.test(design.imageUrl)) {
    pdfImages.push({
      url: design.imageUrl,
      label: isZh ? '锁定概念图' : 'Locked concept visual',
      role: 'hero',
    });
  }
  orderedLong.forEach((url, i) => {
    pdfImages.push({
      url,
      label: isZh
        ? i === 0
          ? '叙事长图（已选）'
          : `叙事长图（备选 ${i + 1}）`
        : i === 0
          ? 'Lifestyle narrative long image (selected)'
          : `Lifestyle narrative long image (variant ${i + 1})`,
      role: 'long',
    });
  });

  const { buildProposalPdf } = await import('./proposal-pdf');
  const pdf = await buildProposalPdf({
    brandName: project.brandName,
    country: project.country,
    markdown: outlineMd,
    heroImageUrl: design?.imageUrl || '',
    images: pdfImages,
  });

  const storagePath = await persistEnterpriseFile({
    userId,
    id: proposalRows[0].id,
    fileName: pdf.fileName,
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf.bytes),
  });

  const fileUrl = proposalPdfApiPath(projectId);
  const contentWithStorage =
    outlineMd.trim() +
    `\n\n<<<PROPOSAL_PDF_STORAGE\n${storagePath}\nPROPOSAL_PDF_STORAGE>>>`;

  const [proposal] = await db()
    .update(pitchDeliverable)
    .set({
      content: contentWithStorage,
      fileUrl,
      summary: `PDF · ${pdf.fileName}`,
      status: 'ready',
      title: `${project.brandName || 'Brand'} Product Proposal`,
    })
    .where(eq(pitchDeliverable.id, proposalRows[0].id))
    .returning();

  const chatMessage = await insertChatMessageTrusted({
    userId,
    projectId,
    role: 'assistant',
    content: [
      'PDF_READY_MARKER',
      '',
      `我是「${PROPOSAL_MARKER}」。已按确认大纲生成 **带图画册 PDF**（概念图 + 叙事长图穿插 · 品牌世界 / 概念 / 工厂交付）。`,
      '',
      '请点击下方按钮打开或下载 PDF。',
      '',
      '> 若要改大纲：在左侧继续对话修改，再点一次「确认并生成 PDF」即可覆盖生成。',
      '> PDF 就绪后进入 **场景视频** 对齐短视频大纲。',
    ].join('\n'),
  });

  // Flow A: after PDF on proposal step, advance to 场景视频
  let nextProject = project;
  let videoChatMessage: ReturnType<typeof toApiChatMessage> | undefined;
  if (project.stage === 'proposal') {
    const advanced = await updateProject(userId, projectId, { stage: 'video' });
    if (advanced) nextProject = advanced;
    videoChatMessage =
      (await ensureVideoChatMessage(userId, projectId, { force: true })) ||
      undefined;
  }

  return {
    project: nextProject,
    proposal,
    chatMessage: toApiChatMessage(chatMessage),
    fileUrl,
    videoChatMessage,
  };
}

/** Read stored proposal PDF bytes for the auth-gated download route. */
export async function readProposalPdfBytes(
  userId: string,
  projectId: string
): Promise<{ bytes: Uint8Array; fileName: string; contentType: string }> {
  await getProjectOrThrow(userId, projectId);
  const rows = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.kind, 'proposal')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error('产品提案不存在');
  const m = (row.content || '').match(
    /<<<PROPOSAL_PDF_STORAGE\s*([\s\S]*?)\s*PROPOSAL_PDF_STORAGE>>>/i
  );
  const storagePath = (m?.[1] || '').trim();
  if (!storagePath) throw new Error('尚未生成 PDF，请先点「确认并生成 PDF」');

  const fileName =
    (row.summary || '').replace(/^PDF ·\s*/, '').trim() ||
    'product-proposal.pdf';

  if (storagePath.startsWith('r2:')) {
    const key = storagePath.slice(3);
    const { getR2Bucket } = await import('@/core/storage/r2-binding');
    const bucket = getR2Bucket();
    if (!bucket) throw new Error('R2 不可用');
    const obj = await bucket.get(key);
    if (!obj?.body) throw new Error('PDF 文件不存在');
    const ab = await new Response(obj.body as any).arrayBuffer();
    return {
      bytes: new Uint8Array(ab),
      fileName,
      contentType: 'application/pdf',
    };
  }

  const { readFile } = await import('fs/promises');
  const full = path.join(localUploadRoot(), storagePath);
  const buf = await readFile(full);
  return {
    bytes: new Uint8Array(buf),
    fileName,
    contentType: 'application/pdf',
  };
}


export async function ensureDeliverables(
  userId: string,
  projectId: string,
  designId: string,
  opts?: { force?: boolean }
): Promise<PitchDeliverable[]> {
  const project = await getProjectOrThrow(userId, projectId);
  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(
      and(
        eq(pitchDesignConcept.id, designId),
        eq(pitchDesignConcept.projectId, projectId)
      )
    )
    .limit(1);
  if (!design) throw new Error('设计概念不存在');

  const existing = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, designId)
      )
    );

  if (existing.length > 0 && !opts?.force) return existing;

  if (opts?.force && existing.length) {
    for (const d of existing) {
      await db()
        .delete(pitchDeliverable)
        .where(eq(pitchDeliverable.id, d.id));
    }
  }

  const brief = await getOrCreateBrief(userId, projectId);
  const factoryMaterialsNote = await buildFactoryMaterialsNoteFromAssets(
    userId,
    projectId
  );
  const pack = buildDeliverablePack({
    brandName: project.brandName,
    track: project.track,
    country: project.country,
    designTitle: design.title,
    designDirection: design.direction,
    designSummary: design.summary,
    goals: brief.goals,
    audience: brief.audience,
    opportunity: brief.opportunity,
    constraints: brief.constraints,
    factoryMaterialsNote: factoryMaterialsNote || undefined,
  });

  const version =
    (existing.reduce((m: number, d: { version: number }) => Math.max(m, d.version), 0) || 0) + 1;
  const rows: PitchDeliverable[] = [];
  for (const item of pack) {
    const [row] = await db()
      .insert(pitchDeliverable)
      .values({
        id: getUuid(),
        projectId,
        userId,
        designId,
        kind: item.kind,
        title: item.title,
        summary: item.summary,
        content: item.content,
        fileUrl:
          item.kind === 'concepts' && design.imageUrl
            ? design.imageUrl
            : item.fileUrl,
        version,
        status: 'ready',
      })
      .returning();
    rows.push(row);
  }
  return rows;
}

/** Explicit: leave 产品提案 → 场景视频 (after PDF ready; does not regen PDF). */
export async function advanceToVideo(
  userId: string,
  projectId: string
): Promise<{
  project: PitchProject;
  videoChatMessage?: ReturnType<typeof toApiChatMessage>;
}> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) {
    throw new Error('请先锁定设计视觉');
  }
  if (
    project.stage !== 'proposal' &&
    project.stage !== 'video' &&
    project.stage !== 'assets' &&
    project.stage !== 'followup'
  ) {
    throw new Error('请先生成产品提案 PDF');
  }

  // Prefer having a PDF before leaving proposal, but allow if already on video+
  if (project.stage === 'proposal') {
    const proposalRows = await db()
      .select()
      .from(pitchDeliverable)
      .where(
        and(
          eq(pitchDeliverable.projectId, projectId),
          eq(pitchDeliverable.designId, project.lockedDesignId),
          eq(pitchDeliverable.kind, 'proposal')
        )
      )
      .orderBy(desc(pitchDeliverable.createdAt))
      .limit(1);
    const fileUrl = proposalRows[0]?.fileUrl || '';
    const hasPdf =
      !!fileUrl &&
      (fileUrl.startsWith('/') || /^https?:\/\//i.test(fileUrl));
    if (!hasPdf) {
      throw new Error('请先点「确认并生成 PDF」再进入场景视频');
    }
  }

  let next = project;
  if (project.stage === 'proposal') {
    const updated = await updateProject(userId, projectId, { stage: 'video' });
    if (!updated) throw new Error('Project not found');
    next = updated;
  }

  const videoChatMessage =
    (await ensureVideoChatMessage(userId, projectId, { force: true })) ||
    undefined;

  return { project: next, videoChatMessage };
}

/** Explicit: leave 场景视频 → 出素材 (pack only). */
export async function advanceToAssets(
  userId: string,
  projectId: string
): Promise<PitchProject> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) {
    throw new Error('请先锁定设计视觉');
  }
  if (
    project.stage !== 'video' &&
    project.stage !== 'proposal' &&
    project.stage !== 'assets'
  ) {
    throw new Error('请先完成场景视频，或从产品提案后进入出素材');
  }
  await ensureDeliverables(userId, projectId, project.lockedDesignId);
  const updated = await updateProject(userId, projectId, { stage: 'assets' });
  if (!updated) throw new Error('Project not found');
  return updated;
}

export async function advanceToFollowup(
  userId: string,
  projectId: string
): Promise<PitchProject> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) {
    throw new Error('请先锁定设计视觉');
  }
  const dels = await listDeliverables(userId, projectId);
  if (!dels.length) {
    throw new Error('请先生成素材包');
  }
  const updated = await updateProject(userId, projectId, { stage: 'followup' });
  if (!updated) throw new Error('Project not found');
  return updated;
}


// ─── GHL sync (做跟进) ───────────────────────────────────────────────────────

export function getFollowupMeta() {
  return {
    mode: getGhlMode(),
    configured: getGhlMode() === 'live',
  };
}

export async function previewGhlSync(
  userId: string,
  projectId: string,
  input?: {
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    note?: string;
  }
): Promise<GhlSyncPreview> {
  const project = await getProjectOrThrow(userId, projectId);
  const dels = await listDeliverables(userId, projectId);
  const brief = await getOrCreateBrief(userId, projectId);
  let designTitle = '';
  let designDirection = '';
  if (project.lockedDesignId) {
    const [design] = await db()
      .select()
      .from(pitchDesignConcept)
      .where(eq(pitchDesignConcept.id, project.lockedDesignId))
      .limit(1);
    designTitle = design?.title || '';
    designDirection = design?.direction || '';
  }
  const outreachRow = dels.find((d) => d.kind === 'outreach');
  const built = buildOutreachEmail({
    brandName: project.brandName,
    country: project.country,
    track: project.track,
    designTitle: designTitle || project.brandName,
    designDirection: designDirection || brief.designDirection || '',
    goals: brief.goals,
    audience: brief.audience,
  });
  // Prefer existing outreach markdown if it looks like a full letter; else market-language builder
  const existingMd = (outreachRow?.content || '').trim();
  const outreachEmail =
    existingMd.length > 80
      ? {
          subject: (() => {
            const m = existingMd.match(/^(?:主题|Subject)\s*[:：]\s*(.+)$/im);
            return (m?.[1] || built.subject).trim();
          })(),
          body: existingMd
            .replace(/^(?:主题|Subject)\s*[:：]\s*.+$\n*/im, '')
            .trim() || built.body,
          languageName: built.languageName,
          markdown: existingMd,
        }
      : built;

  // Keep outreach deliverable fresh when empty/stub
  if (outreachRow && existingMd.length < 40) {
    await db()
      .update(pitchDeliverable)
      .set({
        content: built.markdown,
        title: '开发信（市场语种）',
        summary: `可复制 · ${built.languageName}`,
      })
      .where(eq(pitchDeliverable.id, outreachRow.id));
  }

  return buildGhlPreview({
    brandName: project.brandName,
    country: project.country,
    track: project.track,
    contactName: input?.contactName,
    contactEmail: input?.contactEmail,
    contactPhone: input?.contactPhone,
    note: input?.note || outreachEmail.markdown,
    attachmentTitles: dels.map((d) => d.title),
    outreachEmail,
  });
}

export async function listGhlSyncs(
  userId: string,
  projectId: string
): Promise<PitchGhlSync[]> {
  await getProjectOrThrow(userId, projectId);
  return db()
    .select()
    .from(pitchGhlSync)
    .where(eq(pitchGhlSync.projectId, projectId))
    .orderBy(desc(pitchGhlSync.createdAt));
}

export async function runGhlSync(
  userId: string,
  projectId: string,
  input?: {
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    note?: string;
  }
): Promise<{ sync: PitchGhlSync; preview: GhlSyncPreview }> {
  const project = await getProjectOrThrow(userId, projectId);
  if (project.stage !== 'followup' && project.stage !== 'assets') {
    // allow from assets or followup; auto-advance if still assets
  }
  if (project.stage === 'assets') {
    await updateProject(userId, projectId, { stage: 'followup' });
  }

  const preview = await previewGhlSync(userId, projectId, input);
  const result = await pushGhlSync(preview);

  const [row] = await db()
    .insert(pitchGhlSync)
    .values({
      id: getUuid(),
      projectId,
      userId,
      mode: result.mode,
      status: result.ok ? 'synced' : 'failed',
      contactName: preview.contact.name,
      contactEmail: preview.contact.email,
      contactPhone: preview.contact.phone,
      note: preview.note,
      payload: JSON.stringify({ preview, result: result.raw }),
      externalContactId: result.externalContactId,
      externalOpportunityId: result.externalOpportunityId,
      errorMessage: result.errorMessage || '',
      syncedAt: result.ok ? new Date() : null,
    })
    .returning();

  if (result.ok) {
    await updateProject(userId, projectId, { stage: 'followup' });
  }

  return { sync: row, preview };
}

/** Build a single markdown pack for download. */
export async function buildExportMarkdown(
  userId: string,
  projectId: string
): Promise<{ fileName: string; markdown: string }> {
  const project = await getProjectOrThrow(userId, projectId);
  const brief = await getOrCreateBrief(userId, projectId);
  const designs = await listDesignConcepts(userId, projectId);
  const locked = designs.find((d) => d.locked);
  const dels = await listDeliverables(userId, projectId);

  const lines: string[] = [
    `# 呈品导出包 — ${project.brandName}`,
    '',
    `- 国家：${project.country || '未定'}`,
    `- 赛道：${project.track || '未定'}`,
    `- 阶段：${STAGE_LABEL[project.stage] || project.stage}`,
    `- 导出时间：${new Date().toISOString()}`,
    '',
    '## 简报',
    '',
    `- 目标：${brief.goals || '—'}`,
    `- 受众：${brief.audience || '—'}`,
    `- 机会：${brief.opportunity || '—'}`,
    `- 设计方向：${brief.designDirection || '—'}`,
    `- 约束：${brief.constraints || '—'}`,
    `- 状态：${brief.status}`,
    '',
  ];

  if (locked) {
    lines.push(
      '## 锁定视觉',
      '',
      `- 标题：${locked.title}`,
      `- 方向：${locked.direction}`,
      `- 说明：${locked.summary}`,
      `- 图：${locked.imageUrl || '—'}`,
      ''
    );
  }

  lines.push('## 同源素材', '');
  if (!dels.length) {
    lines.push('_暂无素材_', '');
  }
  for (const d of dels) {
    lines.push(
      `### ${d.title}（${d.kind} · v${d.version}）`,
      '',
      d.summary,
      '',
      '```',
      d.content,
      '```',
      '',
      d.fileUrl ? `文件占位：${d.fileUrl}` : '',
      ''
    );
  }

  lines.push(
    '---',
    '_本文件由呈品工作台导出。产品提案 PDF、叙事长图与视频 URL 见各交付物 fileUrl。_'
  );

  const safe = project.brandName.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40);
  return {
    fileName: `pitchpro-${safe || 'export'}.md`,
    markdown: lines.filter((l) => l !== undefined).join('\n'),
  };
}

async function fetchUrlBytes(
  url: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    if (!url || (!/^https?:\/\//i.test(url) && !url.startsWith('/'))) return null;
    const abs =
      url.startsWith('/') && typeof process.env.NEXT_PUBLIC_APP_URL === 'string'
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}${url}`
        : url;
    // Relative API paths need cookies — skip; callers pass absolute CDN / R2 public URLs.
    if (abs.startsWith('/')) return null;
    const res = await fetch(abs);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return {
      bytes: new Uint8Array(ab),
      contentType: res.headers.get('content-type') || 'application/octet-stream',
    };
  } catch {
    return null;
  }
}

function extFromUrlOrType(url: string, contentType: string, fallback: string) {
  const pathPart = url.split('?')[0] || '';
  const m = pathPart.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (m) return m[1].toLowerCase();
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('mp4')) return 'mp4';
  return fallback;
}

/** One-click ZIP pack: proposal PDF, concepts, long images, video, outreach, manifest. */
export async function buildExportZip(
  userId: string,
  projectId: string
): Promise<{ fileName: string; bytes: Uint8Array }> {
  const { zipSync, strToU8 } = await import('fflate');
  const project = await getProjectOrThrow(userId, projectId);
  const brief = await getOrCreateBrief(userId, projectId);
  const designs = await listDesignConcepts(userId, projectId);
  const locked = designs.find((d) => d.locked) || designs[0];
  const dels = await listDeliverables(userId, projectId);
  const { fileName: mdName, markdown } = await buildExportMarkdown(
    userId,
    projectId
  );

  const files: Record<string, Uint8Array> = {};
  const manifest: {
    brand: string;
    country: string;
    track: string;
    stage: string;
    exportedAt: string;
    included: string[];
    missing: string[];
  } = {
    brand: project.brandName || '',
    country: project.country || '',
    track: project.track || '',
    stage: project.stage,
    exportedAt: new Date().toISOString(),
    included: [],
    missing: [],
  };

  files[`01-manifest/${mdName}`] = strToU8(markdown);

  // Proposal PDF
  try {
    const pdf = await readProposalPdfBytes(userId, projectId);
    const name = pdf.fileName.endsWith('.pdf')
      ? pdf.fileName
      : `${pdf.fileName}.pdf`;
    files[`02-proposal/${name}`] = pdf.bytes;
    manifest.included.push(`proposal:${name}`);
  } catch {
    manifest.missing.push('proposal-pdf');
  }

  // Concept images (locked + all active with URLs)
  let conceptIdx = 0;
  for (const d of designs) {
    const url = (d.imageUrl || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const got = await fetchUrlBytes(url);
    if (!got) {
      manifest.missing.push(`concept:${d.title || d.id}`);
      continue;
    }
    conceptIdx += 1;
    const ext = extFromUrlOrType(url, got.contentType, 'jpg');
    const tag = d.locked ? 'locked' : `v${d.version || 1}`;
    const fname = `${String(conceptIdx).padStart(2, '0')}-${tag}.${ext}`;
    files[`03-concepts/${fname}`] = got.bytes;
    manifest.included.push(`concept:${fname}`);
  }
  if (!conceptIdx) manifest.missing.push('concept-images');

  // Long images from PDP deliverable
  const pdp = dels.find((d) => d.kind === 'pdp');
  const longParsed = parsePdpLongImages(pdp?.content || '');
  const longUrls = [
    ...(longParsed?.selected ? [longParsed.selected] : []),
    ...((longParsed?.urls || []).filter((u) => u !== longParsed?.selected) ||
      []),
  ].filter((u) => /^https?:\/\//i.test(u));
  if (
    !longUrls.length &&
    pdp?.fileUrl &&
    /^https?:\/\//i.test(pdp.fileUrl)
  ) {
    longUrls.push(pdp.fileUrl);
  }
  let longIdx = 0;
  for (const url of longUrls) {
    const got = await fetchUrlBytes(url);
    if (!got) {
      manifest.missing.push(`long-image:${url.slice(0, 48)}`);
      continue;
    }
    longIdx += 1;
    const ext = extFromUrlOrType(url, got.contentType, 'jpg');
    const fname = `${String(longIdx).padStart(2, '0')}-narrative.${ext}`;
    files[`04-long-images/${fname}`] = got.bytes;
    manifest.included.push(`long:${fname}`);
  }
  if (!longIdx) manifest.missing.push('long-images');

  // Video
  try {
    const video = await readVideoBytes(userId, projectId);
    const vname = video.fileName.endsWith('.mp4')
      ? video.fileName
      : `${video.fileName}.mp4`;
    files[`05-video/${vname}`] = video.bytes;
    manifest.included.push(`video:${vname}`);
  } catch {
    manifest.missing.push('video');
  }

  // Outreach markdown
  const outreach = dels.find((d) => d.kind === 'outreach');
  if (outreach?.content?.trim()) {
    files['06-outreach/outreach.md'] = strToU8(outreach.content);
    manifest.included.push('outreach.md');
  } else {
    manifest.missing.push('outreach');
  }

  // Brief delivery snapshot
  const delivery = parseDeliveryFacts(brief.constraints);
  files['01-manifest/delivery-facts.json'] = strToU8(
    JSON.stringify(
      {
        brandName: brief.brandName,
        country: brief.country,
        track: brief.track,
        goals: brief.goals,
        delivery,
        lockedDesign: locked
          ? {
              id: locked.id,
              title: locked.title,
              direction: locked.direction,
              imageUrl: locked.imageUrl,
            }
          : null,
      },
      null,
      2
    )
  );
  files['01-manifest/MANIFEST.json'] = strToU8(
    JSON.stringify(manifest, null, 2)
  );

  const zipped = zipSync(files, { level: 6 });
  const safe = (project.brandName || 'export')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
    .slice(0, 40);
  return {
    fileName: `pitchpro-${safe || 'export'}-pack.zip`,
    bytes: zipped,
  };
}


// ─── Video (lk888) ───────────────────────────────────────────────────────────

const VIDEO_JOB_RE =
  /<<<VIDEO_JOB\s*([\s\S]*?)\s*VIDEO_JOB>>>/i;
const VIDEO_STORAGE_RE =
  /<<<VIDEO_STORAGE\s*([\s\S]*?)\s*VIDEO_STORAGE>>>/i;

export type VideoJobMeta = {
  taskId: string;
  status: string;
  model?: string;
  prompt?: string;
  ratio?: string;
  duration?: number;
  error?: string;
  updatedAt?: string;
  /** lk888 result CDN URL when known */
  resultUrl?: string;
  /** true after primary failed and we already retried fallback */
  fallbackAttempted?: boolean;
  usedFallback?: boolean;
};

function stripVideoMarkers(content: string) {
  return (content || '')
    .replace(VIDEO_JOB_RE, '')
    .replace(VIDEO_STORAGE_RE, '')
    .trim();
}

export function parseVideoJob(content: string | null | undefined): VideoJobMeta | null {
  if (!content) return null;
  const m = content.match(VIDEO_JOB_RE);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]) as VideoJobMeta;
    if (!data?.taskId) return null;
    return data;
  } catch {
    return null;
  }
}

function parseVideoStoragePath(content: string | null | undefined): string {
  if (!content) return '';
  const m = content.match(VIDEO_STORAGE_RE);
  return (m?.[1] || '').trim();
}

function embedVideoMarkers(
  outline: string,
  job: VideoJobMeta | null,
  storagePath?: string
) {
  let out = stripVideoMarkers(outline || '').trim();
  if (job) {
    out += `\n\n<<<VIDEO_JOB\n${JSON.stringify(job)}\nVIDEO_JOB>>>`;
  }
  if (storagePath) {
    out += `\n\n<<<VIDEO_STORAGE\n${storagePath}\nVIDEO_STORAGE>>>`;
  }
  return out;
}

export function videoApiPath(projectId: string) {
  return `/api/pitchpro/projects/${projectId}/video`;
}

function stripProposalStorageMarkers(content: string) {
  return (content || '')
    .replace(/<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/gi, '')
    .trim();
}

async function getLatestProposalRow(
  projectId: string,
  designId: string
): Promise<PitchDeliverable | null> {
  const rows = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, designId),
        eq(pitchDeliverable.kind, 'proposal')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);
  return rows[0] || null;
}

/** Tiny brand-tone excerpt for optional video grounding (NOT full proposal script). */
function proposalHintFromContent(content: string, max = 180): string {
  const cleaned = stripProposalStorageMarkers(content)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\[VISUAL:[^\]]+\]\]/g, '')
    .replace(/^>\s.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!cleaned) return '';
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  const prefer = lines.filter((l) =>
    /品牌调性|Brand tone|向往|lifestyle|Audience|目标人群|品牌世界|调性/.test(l)
  );
  const pick = (prefer.length ? prefer : lines).join(' · ');
  return pick.slice(0, max);
}

function buildVideoOutlineMd(input: {
  brandName: string;
  country: string;
  track: string;
  designTitle: string;
  designDirection: string;
  designSummary: string;
  narrativeHint?: string;
  proposalHint?: string;
}): string {
  const lang = resolveOnImageLanguage(input.country);
  const culture = resolveMarketCulture(input.country);
  const brand = input.brandName || 'Brand';
  const track = input.track || 'category';
  const design = input.designTitle || 'locked concept';
  const direction = (input.designDirection || '').trim() || 'brand-aligned lifestyle';
  const summary = (input.designSummary || '').trim();
  const narrative = (input.narrativeHint || '').trim().slice(0, 700);
  const proposal = (input.proposalHint || '').trim().slice(0, 180);
  const materialCue = summary
    ? summary.slice(0, 160)
    : `${track} product with matte shell, soft tactile finish`;
  const sampleLines = culture.sampleOnScreenLines.join(' · ');
  const chinaBan = culture.forbidChinaAesthetics
    ? 'FORBIDDEN default CN mainland interiors / CN packaging typography / Chinese characters on props.'
    : '';

  // Language policy (documented):
  // - Chinese market → full Chinese outline
  // - English market → full English outline
  // - Other languages → English structure tags + culturally local scenes;
  //   旁白/画面字 sample lines + shot actions must state market language explicitly.
  if (lang.languageName.startsWith('Chinese')) {
    return [
      `# 场景视频提示词 — ${brand}`,
      '',
      `- 市场：${input.country || '—'} · 语种：${lang.languageName} · 人文：${culture.regionKey}`,
      `- 赛道：${track}`,
      `- 概念：${design}`,
      `- 方向：${direction}`,
      '',
      '【核心主题】',
      `生活方式品牌短片 | ${track} 使用仪式 | 目标市场 B2B / 品牌决策人 | 超写实商业实拍质感 | 杜绝游戏 CG`,
      '',
      '【人物与设定】',
      `人物：成年使用者，自然妆发，着装：${culture.wardrobeCue}；袖口或领口可见细微布料褶皱。`,
      `产品道具：${design} — ${materialCue}；至少两处微小现实瑕疵：①注塑合模线极浅可见 ②外壳边缘极浅细微划痕。禁止第三方商标原名，只描述视觉特征。`,
      `场景：必须来自品牌生活世界／叙事确认（去哪玩、社交形式、向往目的地）；禁止国家默认咖啡／厨房／客厅／办公室模板。光线：${culture.lightCue}（按场景调整）。着装：${culture.wardrobeCue}。动态自然光，拒绝静态背景板。`,
      '',
      '【氛围与画质】',
      '产品特写：阿莱 Alexa Mini + Cooke S7i 85mm f2.0；环境/仪式：阿莱 Alexa Mini + Cooke S7i 32mm f2.8。',
      `品牌色调跟随概念方向（${direction.slice(0, 80)}），${culture.lightCue}，干净商务/生活光影，低饱和不炫技。`,
      '',
      '【运镜规则】',
      '镜头方式：多镜头分镜剪辑（约 10 秒横屏 16:9 · 720p）',
      '角度：景别在中景↔特写间切换；平视机位，极其缓慢平稳推进或横移',
      '呼吸感：商务轻量化手持，全程极微弱呼吸式镜头浮动，无剧烈抖动、无晃动炫技',
      '',
      '【分镜】',
      `0-2s：在品牌生活世界开场（优先叙事／设计方向中的具体地点与活动；禁止国家默认居家咖啡厨房办公室），产品自然出现。`,
      `2-4s：手部／使用或社交互动 — 贴合品牌人群真实活动与产品角色（禁止国家默认仪式模板）。`,
      '4-6s：产品材质与细节特写（合模线/浅划痕可见），强化真实可信。',
      `6-8s：英雄产品收束 + 轻品牌结尾；画面字/旁白仅用简体中文（例：${sampleLines}），信息克制。`,
      '',
      '【声音】',
      '安静现代室内环境底噪；轻柔极简商务/生活 BGM；关键音效：织物摩擦、轻触产品外壳、远处极轻脚步；无夸张人声、无嘈杂电影音效。',
      '',
      '## 负面提示词',
      '- logo 扭曲变形、标识错乱、品牌色偏移',
      '- 乱码文字、水印、错误字幕、错乱图表数字',
      '- 产品外形畸变、零件错位、中途换样',
      '- 畸形手部、多余手指、扭曲五官',
      '- 游戏 CG、3D 塑料质感、过度特效',
      '- 镜头剧烈抖动、画面频闪、帧率卡顿',
      '',
      '## 一致性锁定',
      `- 产品外观：严格跟随参考图与「${design}」描述，全片不漂移`,
      `- 品牌色 / 材质：全片统一，禁止镜头间色彩跳变`,
      '- 摄影机套件：Alexa Mini + Cooke S7i，仅调景别机位',
      `- 语种/人文：画面字与旁白 = ${lang.languageName}；场景贴合 ${culture.regionKey}`,
      '',
      '## 验证建议',
      '当前默认 GK-video-3.5 · ~10s · 16:9 · 720p 做方向验证（图生视频）；失败自动回退 MiniMax H3。确认产品/品牌色无畸变后再考虑加长或升清。商业镜头常需 3–5 次重跑。',
      '',
      narrative ? `## 叙事参考（长图）\n${narrative}` : '',
      // 提案脚本不再作为视频主物料；如有极短品牌调性提示可选
      proposal ? `## 品牌调性提示（可选，非提案脚本）\n${proposal}` : '',
      '',
      '> 可改完整 5 段式提示词；对齐后点下方「确认并生成视频」。可改完再生成覆盖。',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const isEnglish = lang.languageName === 'English';
  // English: full English outline. Other langs: English structure tags + market-language on-screen/VO.
  return [
    `# Scene video prompt — ${brand}`,
    '',
    `- Market: ${input.country || '—'} · On-screen / VO language: ${lang.languageName} · Culture: ${culture.regionKey}`,
    `- Track: ${track}`,
    `- Concept: ${design}`,
    `- Direction: ${direction}`,
    lang.forbidChinese
      ? '- STRICT: no Chinese characters on screen, in voiceover, or in shot-board on-screen copy lines.'
      : '',
    chinaBan ? `- ${chinaBan}` : '',
    !isEnglish
      ? `- Language policy: structure tags in English; ALL on-screen text, implied VO, and spoken lines MUST be ${lang.languageName} (samples below).`
      : '',
    '',
    '【Core theme】',
    `Lifestyle brand short | ${track} use ritual | target-market B2B / brand decision makers | hyper-real commercial capture | no game CG`,
    '',
    '【Characters & setup】',
    `Talent: adult user, natural look; wardrobe: ${culture.wardrobeCue}; at least one fabric wrinkle at cuff or collar.`,
    `Product props: ${design} — ${materialCue}; ≥2 tiny real-world flaws: (1) faint mold parting line (2) hairline edge micro-scratch. No third-party trademark names — visual features only.`,
    `Scene: must come from brand lifestyle world / confirmed narrative (where they play, socialize, aspire to go). FORBID nation-default coffee/kitchen/living-room/office templates. Light: ${culture.lightCue} (adapt to scene). Wardrobe: ${culture.wardrobeCue}. Dynamic natural light; no static backdrop plate.`,
    '',
    '【Mood & image quality】',
    'Product close-up: Arri Alexa Mini + Cooke S7i 85mm f2.0; ritual / environment: Arri Alexa Mini + Cooke S7i 32mm f2.8.',
    `Brand palette follows concept direction (${direction.slice(0, 80)}); ${culture.lightCue}; clean commercial lifestyle grade; restrained, not flashy.`,
    '',
    '【Camera rules】',
    'Method: multi-shot edit (~10s landscape 16:9 · 720p)',
    'Angle: medium ↔ close-up; eye-level; extremely slow steady push or lateral drift',
    'Breathing: light commercial handheld micro-float only; no shaky-cam, no violent shake',
    '',
    '【Shot board】',
    `0-2s: lifestyle cold open in the brand lifestyle world (prefer concrete place/activity from narrative / design direction; FORBID nation-default home coffee/kitchen/office); product appears naturally.`,
    `2-4s: hands / use or social interaction — match brand audience activities & product role (FORBID nation-default ritual templates).`,
    '4-6s: material detail close-up (mold line / micro-scratch readable) for real-product trust.',
    `6-8s: hero product hold + soft brand close; on-screen copy / VO ONLY in ${lang.languageName} (examples: ${sampleLines}); keep info lean.`,
    '',
    `【On-screen / VO — must be ${lang.languageName}】`,
    culture.sampleOnScreenLines.map((l) => `- "${l}"`).join('\n'),
    '',
    '【Sound】',
    'Quiet modern interior room tone matching the market home; soft minimal commercial / lifestyle BGM; key SFX: fabric rustle, light fingertip on shell, distant soft footstep; no exaggerated VO, no noisy cinematic FX.',
    '',
    '## Negative prompt',
    '- warped logo, broken mark, brand-color drift',
    '- garbled text, watermarks, wrong subtitles, scrambled charts/numbers',
    lang.forbidChinese
      ? '- ANY Chinese characters / 汉字 on frames, packaging mock text, stickers, or titles'
      : '',
    culture.forbidChinaAesthetics
      ? '- CN-default aesthetics (lanterns, Chinese-screen props, mainland e-comm packaging look) when market is not China'
      : '',
    '- product morph, part misalignment, mid-shot product swap',
    '- bad hands, extra fingers, warped faces',
    '- game CG, plastic 3D, over-FX',
    '- violent camera shake, flicker, stutter',
    '',
    '## Consistency lock',
    `- Product look: lock to refs + 「${design}」; no drift across shots`,
    '- Brand color / materials: uniform; no inter-shot color jumps',
    '- Camera kit: Alexa Mini + Cooke S7i; change framing only',
    `- Language / culture: on-screen + VO = ${lang.languageName}; scenes = ${culture.regionKey} local lifestyle`,
    '',
    '## Validation tip',
    'Default GK-video-3.5 · ~10s · 16:9 · 720p for direction check (image-to-video); auto-fallback MiniMax H3. Only upgrade length/clarity after product & brand color look correct. Expect 3–5 reruns for commercial product shots.',
    '',
    narrative ? `## Narrative reference (long image)\n${narrative}` : '',
    proposal ? `## Brand-tone hint (optional; not proposal script)\n${proposal}` : '',
    '',
    '> Edit the full 5-part prompt, then tap **Confirm & generate video**. You can revise and regenerate.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildWuyeVideoPrompt(input: {
  brandName: string;
  country: string;
  track: string;
  designTitle: string;
  designDirection: string;
  designSummary: string;
  outlineMd: string;
  refCount: number;
  proposalHint?: string;
}): string {
  const lang = resolveOnImageLanguage(input.country);
  const culture = resolveMarketCulture(input.country);
  const refs =
    input.refCount > 0
      ? Array.from({ length: input.refCount }, (_, i) => `@图${i + 1}`).join(
          '、'
        )
      : '';
  const refLine = refs
    ? `Use reference image(s) ${refs} as product appearance / lifestyle look consistency anchors.`
    : 'No reference images; invent a premium lifestyle look consistent with the brief.';
  const proposalLine = (input.proposalHint || '').trim()
    ? `Brand tone / lifestyle hint (optional, NOT proposal script): ${input.proposalHint!.trim().slice(0, 180)}`
    : '';

  // Flatten engineer brief for model; keep under practical limits.
  const outlineSlice = input.outlineMd
    .replace(/^>\s.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2400);

  const sampleLines = culture.sampleOnScreenLines.join(' / ');

  return [
    `Create an ~10-second landscape (16:9 · 720p) lifestyle brand commercial short for ${input.brandName} (target-market B2B / brand decision makers). NOT cinematic drama; NOT a meta "system uploading PDF" demo.`,
    `Category/track: ${input.track || 'lifestyle'}. Market: ${input.country || 'global'} (${culture.regionKey}).`,
    `Locked concept: ${input.designTitle}. Direction: ${input.designDirection}.`,
    input.designSummary ? `Concept note: ${input.designSummary.slice(0, 280)}` : '',
    proposalLine,
    refLine,
    `CULTURE / PEOPLE LOCK (${culture.regionKey}): wardrobe ${culture.wardrobeCue}; light climate ${culture.lightCue}. Scene MUST come from brand lifestyle world / narrative — FORBID nation-default coffee/kitchen/living-room/home-office templates.`,
    culture.forbidChinaAesthetics
      ? 'STRICT CULTURE: do NOT use Chinese mainland interior defaults, CN e-comm packaging look, red lanterns, Chinese screens, or Chinese characters on any prop.'
      : '',
    `LANGUAGE LOCK: Every on-screen word, title, packaging mock text, sticker, and any implied voiceover / spoken line MUST be ${lang.languageName} only (market: ${lang.localeHint}). Example lines: ${sampleLines}.`,
    lang.forbidChinese
      ? 'STRICT FORBID: no Chinese characters / 汉字 / 中文 anywhere in frames, titles, subtitles, packaging text, or VO. If the outline contains Chinese, TRANSLATE meaning into the market language — never paint Chinese on screen.'
      : `On-screen text may be ${lang.languageName}.`,
    'Camera kit lock: product close-ups Arri Alexa Mini + Cooke S7i 85mm f2.0; ritual/environment Arri Alexa Mini + Cooke S7i 32mm f2.8. Soft breathing micro-float only; no shaky-cam.',
    'Product must show ≥2 tiny real-world imperfections (faint mold line, hairline micro-scratch) to avoid plastic CG. Concrete nouns only (materials, colors, equipment).',
    'Sound: quiet modern interior matching the market home + soft minimal BGM + light tactile SFX; no noisy cinematic FX.',
    'Consistency lock: same product look, brand colors, lighting grade, camera kit, market language, and local culture across shots.',
    'Negatives: logo warp, garbled text, product morph, bad hands, game CG / plastic 3D, violent shake, watermarks, UI chrome, webpage screenshots, wrong-script text, off-market culture props.',
    'Follow this engineer 5-part shot brief:',
    outlineSlice,
  ]
    .filter(Boolean)
    .join('\n');
}


function isPublicHttpsUrl(u: string) {
  return /^https:\/\//i.test((u || '').trim());
}

export type VideoRefPrecheck = {
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

const VIDEO_COST_TIP_ZH =
  '提示：图生视频常需重跑 3–5 次才得到可用成片，属常态。默认约 10 秒 · 横屏 16:9 · 720p；主线 GK-video-3.5（MC-GK1.5官转），失败回退 MiniMax H3（RQ2）。';

/** Collect public HTTPS refs for I2V (concept + selected long). */
export function buildVideoRefPrecheck(input: {
  conceptImageUrl?: string | null;
  longImageUrl?: string | null;
  extraLongUrls?: string[];
}): VideoRefPrecheck {
  const conceptUrl = (input.conceptImageUrl || '').trim();
  const longUrl = (input.longImageUrl || '').trim();
  const httpsRefs: string[] = [];
  const hasConceptHttps = isPublicHttpsUrl(conceptUrl);
  const hasLongHttps = isPublicHttpsUrl(longUrl);
  if (hasConceptHttps) httpsRefs.push(conceptUrl);
  if (hasLongHttps && !httpsRefs.includes(longUrl)) httpsRefs.push(longUrl);
  for (const u of input.extraLongUrls || []) {
    const t = (u || '').trim();
    if (isPublicHttpsUrl(t) && !httpsRefs.includes(t) && httpsRefs.length < 8) {
      httpsRefs.push(t);
    }
  }
  const okForGk = httpsRefs.length > 0;
  const willFallbackWithoutImage = !okForGk;
  const missing: string[] = [];
  if (!hasConceptHttps) missing.push('锁定概念图缺公网 HTTPS');
  if (!hasLongHttps) missing.push('叙事长图缺公网 HTTPS');
  const warnZh = willFallbackWithoutImage
    ? `参考图预检未通过：${missing.join('；') || '无可用 HTTPS 图'}。主线 GK-video-3.5（MC-GK1.5官转）为图生视频，缺图将直接回退 MiniMax H3（RQ2 · 文生／弱参考）。`
    : !hasConceptHttps || !hasLongHttps
      ? `参考图部分可用（${httpsRefs.length} 张 HTTPS）。${missing.join('；')}。仍可提交主线，但建议补齐概念图与长图公网地址。`
      : '';
  return {
    conceptUrl,
    longUrl,
    httpsRefs,
    hasConceptHttps,
    hasLongHttps,
    okForGk,
    willFallbackWithoutImage,
    tipZh: VIDEO_COST_TIP_ZH,
    warnZh,
  };
}

async function collectVideoRefPrecheckForProject(
  projectId: string,
  designId: string,
  designImageUrl?: string | null
): Promise<VideoRefPrecheck> {
  const pdp = await getLatestPdpRow(projectId, designId);
  const longParsed = parsePdpLongImages(pdp?.content || '');
  const selectedLong =
    (longParsed?.selected && isPublicHttpsUrl(longParsed.selected)
      ? longParsed.selected
      : '') ||
    (pdp?.fileUrl && isPublicHttpsUrl(pdp.fileUrl) ? pdp.fileUrl : '') ||
    (longParsed?.selected || pdp?.fileUrl || '');
  return buildVideoRefPrecheck({
    conceptImageUrl: designImageUrl || '',
    longImageUrl: selectedLong,
    extraLongUrls: longParsed?.urls || [],
  });
}

export async function getVideoRefPrecheck(
  userId: string,
  projectId: string
): Promise<VideoRefPrecheck | null> {
  const project = await getProject(userId, projectId);
  if (!project?.lockedDesignId) return null;
  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, project.lockedDesignId))
    .limit(1);
  return collectVideoRefPrecheckForProject(
    projectId,
    project.lockedDesignId,
    design?.imageUrl
  );
}

async function getLatestVideoRow(
  projectId: string,
  designId: string
): Promise<PitchDeliverable | null> {
  const rows = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.designId, designId),
        eq(pitchDeliverable.kind, 'video')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);
  return rows[0] || null;
}

/**
 * Insert / refresh left-chat video brief (呈品 · 视频).
 * Idempotent; force updates after pack regen.
 */
export async function ensureVideoChatMessage(
  userId: string,
  projectId: string,
  opts?: { force?: boolean }
): Promise<ReturnType<typeof toApiChatMessage> | null> {
  const project = await getProject(userId, projectId);
  if (!project?.lockedDesignId) return null;
  if (
    project.stage !== 'video' &&
    project.stage !== 'assets' &&
    project.stage !== 'followup'
  ) {
    return null;
  }

  let video = await getLatestVideoRow(projectId, project.lockedDesignId);
  if (!video) {
    await ensureDeliverables(userId, projectId, project.lockedDesignId);
    video = await getLatestVideoRow(projectId, project.lockedDesignId);
  }
  if (!video) return null;

  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, project.lockedDesignId))
    .limit(1);

  const pdp = await getLatestPdpRow(projectId, project.lockedDesignId);
  const narrativeHint = stripVideoMarkers(
    (pdp?.content || '').replace(/<<<PDP_LONG_IMAGES[\s\S]*?PDP_LONG_IMAGES>>>/gi, '')
      .replace(/<<<PDP_JSON[\s\S]*?PDP_JSON>>>/gi, '')
  ).slice(0, 700);

  // Video grounds on brief + design + long image; proposal script is NOT required.
  // Keep only a tiny optional brand-tone hint from brief-like fields inside proposal if present.
  const proposalRow = await getLatestProposalRow(projectId, project.lockedDesignId);
  const proposalHint = proposalHintFromContent(proposalRow?.content || '', 180);

  const outlineFromDel = stripVideoMarkers(video.content || '');
  const outlineLooksLegacy =
    outlineFromDel.trim().length > 40 &&
    !outlineFromDel.includes('【核心主题】') &&
    !outlineFromDel.includes('【Core theme】') &&
    !outlineFromDel.includes('【人物与设定】') &&
    !outlineFromDel.includes('【Characters & setup】');
  const outline =
    outlineFromDel.trim().length > 40 && !outlineLooksLegacy
      ? outlineFromDel
      : buildVideoOutlineMd({
          brandName: project.brandName,
          country: project.country,
          track: project.track,
          designTitle: design?.title || '锁定概念',
          designDirection: design?.direction || '',
          designSummary: design?.summary || '',
          narrativeHint,
          proposalHint,
        });

  // Persist outline onto deliverable if placeholder / empty / legacy (pre-engineer) brief
  if (
    !outlineFromDel.trim() ||
    outlineFromDel.includes('（无真实渲染') ||
    outlineLooksLegacy
  ) {
    await db()
      .update(pitchDeliverable)
      .set({
        content: embedVideoMarkers(outline, parseVideoJob(video.content), parseVideoStoragePath(video.content)),
        title: '生活方式短视频（横版）',
        summary: video.fileUrl
          ? video.summary
          : '10s · 16:9 · 720p · 左聊确认后生成',
        status: video.fileUrl ? video.status : video.status === 'generating' ? 'generating' : 'draft',
      })
      .where(eq(pitchDeliverable.id, video.id));
  }

  const heroUrl = (design?.imageUrl || '').trim();
  const precheck = await collectVideoRefPrecheckForProject(
    projectId,
    project.lockedDesignId,
    design?.imageUrl
  );
  const bodyParts = [
    `我是「${VIDEO_MARKER}」。`,
    '',
    '当前为 **场景视频** 步（默认 10s · 16:9 · 720p · 主线 GK-video-3.5（MC-GK1.5官转），失败回退 MiniMax H3（RQ2））。',
    '下面是 **5 段式视频提示词**（核心主题 / 人物与设定 / 氛围与画质 / 运镜规则 / 分镜+声音），已结合聊方案调性、锁定概念与叙事长图；**不依赖产品提案脚本**。可用左侧对话改写具体名词与分镜。',
    '对齐后点 **「确认并生成视频」**。可改完再生成覆盖。',
    '',
    `**参考图预检**：概念图 ${precheck.hasConceptHttps ? '✓ HTTPS' : '✗ 缺公网 HTTPS'} · 叙事长图 ${precheck.hasLongHttps ? '✓ HTTPS' : '✗ 缺公网 HTTPS'} · 可用 ${precheck.httpsRefs.length} 张`,
    precheck.warnZh || '参考图齐备，可提交主线 GK-video-3.5（MC-GK1.5官转）图生视频。',
    '',
    precheck.tipZh,
    '',
  ];
  if (heroUrl) {
    bodyParts.push(`![${design?.title || 'concept'}](${heroUrl})`, '');
  }
  bodyParts.push(outline.trim());
  const content = bodyParts.join('\n');

  const messages = await listChatMessages(userId, projectId);
  const existing = messages.filter(
    (m) =>
      m.role === 'assistant' &&
      typeof m.content === 'string' &&
      m.content.includes(VIDEO_MARKER) &&
      !m.content.includes('VIDEO_READY_MARKER') &&
      !m.content.includes('VIDEO_GENERATING_MARKER')
  );

  try {
    if (existing.length) {
      const primary = existing[0];
      const stale =
        opts?.force ||
        !primary.content.includes(outline.trim().slice(0, 40));
      if (!stale) return toApiChatMessage(primary);
      const [updated] = await db()
        .update(pitchChatMessage)
        .set({ content })
        .where(eq(pitchChatMessage.id, primary.id))
        .returning();
      for (const extra of existing.slice(1)) {
        await db()
          .delete(pitchChatMessage)
          .where(eq(pitchChatMessage.id, extra.id));
      }
      return toApiChatMessage(updated || primary);
    }

    const row = await insertChatMessageTrusted({
      userId,
      projectId,
      role: 'assistant',
      content,
    });
    return toApiChatMessage(row);
  } catch (e) {
    console.error('[ensureVideoChatMessage] failed', e);
    return null;
  }
}

/**
 * Confirm left-chat video brief → submit lk888 media job (async).
 * Client should poll via pollVideoJob until ready/failed.
 */
export async function confirmVideo(
  userId: string,
  projectId: string
): Promise<{
  project: PitchProject;
  video: PitchDeliverable;
  chatMessage: ReturnType<typeof toApiChatMessage>;
  status: 'generating' | 'ready' | 'failed';
  taskId: string;
  fileUrl?: string;
}> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) throw new Error('请先锁定设计视觉');
  if (
    project.stage !== 'video' &&
    project.stage !== 'assets' &&
    project.stage !== 'followup'
  ) {
    throw new Error('请先完成产品提案，进入场景视频');
  }

  let video = await getLatestVideoRow(projectId, project.lockedDesignId);
  if (!video) {
    await ensureDeliverables(userId, projectId, project.lockedDesignId);
    video = await getLatestVideoRow(projectId, project.lockedDesignId);
  }
  if (!video) throw new Error('视频交付物不存在');

  const [design] = await db()
    .select()
    .from(pitchDesignConcept)
    .where(eq(pitchDesignConcept.id, project.lockedDesignId))
    .limit(1);
  if (!design) throw new Error('锁定设计不存在');

  // Prefer latest video outline from chat
  const recent = await db()
    .select()
    .from(pitchChatMessage)
    .where(eq(pitchChatMessage.projectId, projectId))
    .orderBy(desc(pitchChatMessage.createdAt))
    .limit(24);
  const latestOutlineMsg = recent.find(
    (m: PitchChatMessage) =>
      m.role === 'assistant' &&
      m.content.includes(VIDEO_MARKER) &&
      !m.content.includes('VIDEO_READY_MARKER') &&
      !m.content.includes('VIDEO_GENERATING_MARKER')
  );
  let outlineMd = stripVideoMarkers(video.content || '');
  if (latestOutlineMsg?.content) {
    let cleaned = latestOutlineMsg.content
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .trim();
    const hash = cleaned.indexOf('# ');
    const coreZh = cleaned.indexOf('【核心主题】');
    const coreEn = cleaned.indexOf('【Core theme】');
    const cutCandidates = [hash, coreZh, coreEn].filter((i) => i >= 0);
    if (cutCandidates.length) {
      cleaned = cleaned.slice(Math.min(...cutCandidates)).trim();
    }
    if (cleaned.length > 40) outlineMd = cleaned;
  }
  const pdp = await getLatestPdpRow(projectId, project.lockedDesignId);
  // Video grounds on brief + design + long image; proposal script is NOT required.
  // Keep only a tiny optional brand-tone hint from brief-like fields inside proposal if present.
  const proposalRow = await getLatestProposalRow(projectId, project.lockedDesignId);
  const proposalHint = proposalHintFromContent(proposalRow?.content || '', 180);
  const narrativeHint = stripVideoMarkers(
    (pdp?.content || '')
      .replace(/<<<PDP_LONG_IMAGES[\s\S]*?PDP_LONG_IMAGES>>>/gi, '')
      .replace(/<<<PDP_JSON[\s\S]*?PDP_JSON>>>/gi, '')
  ).slice(0, 700);

  const outlineLooksLegacy =
    !!outlineMd.trim() &&
    !outlineMd.includes('【核心主题】') &&
    !outlineMd.includes('【Core theme】') &&
    !outlineMd.includes('【人物与设定】') &&
    !outlineMd.includes('【Characters & setup】');

  if (!outlineMd.trim() || outlineLooksLegacy) {
    outlineMd = buildVideoOutlineMd({
      brandName: project.brandName,
      country: project.country,
      track: project.track,
      designTitle: design.title,
      designDirection: design.direction,
      designSummary: design.summary,
      narrativeHint,
      proposalHint,
    });
  }

  const longParsed = parsePdpLongImages(pdp?.content || '');
  const precheck = buildVideoRefPrecheck({
    conceptImageUrl: design.imageUrl,
    longImageUrl:
      (longParsed?.selected && isPublicHttpsUrl(longParsed.selected)
        ? longParsed.selected
        : '') ||
      (pdp?.fileUrl && isPublicHttpsUrl(pdp.fileUrl) ? pdp.fileUrl : '') ||
      longParsed?.selected ||
      pdp?.fileUrl ||
      '',
    extraLongUrls: longParsed?.urls || [],
  });
  const refUrls = precheck.httpsRefs.slice();

  const cfg = await resolveLk888VideoConfig();
  const prompt = buildWuyeVideoPrompt({
    brandName: project.brandName,
    country: project.country,
    track: project.track,
    designTitle: design.title,
    designDirection: design.direction,
    designSummary: design.summary,
    outlineMd,
    refCount: refUrls.length,
    proposalHint,
  });

  let submitted: {
    taskId: string;
    model: string;
    usedFallback: boolean;
    raw: unknown;
  };
  try {
    submitted = await submitLk888VideoWithFallback({
      prompt,
      referenceImages: refUrls,
      duration: cfg.duration,
      ratio: cfg.ratio,
      model: cfg.model,
      fallbackModel: cfg.fallbackModel,
    });
  } catch (submitErr: any) {
    const errMsg =
      submitErr?.message ||
      (typeof submitErr === 'string' ? submitErr : '视频任务提交失败');
    const failParts = [
      'VIDEO_FAILED_MARKER',
      '',
      `我是「${VIDEO_MARKER}」。视频生成失败：${errMsg}`,
      '',
      precheck.warnZh || '',
      precheck.tipZh,
      '',
      '请检查参考图是否为公网 HTTPS，或改大纲后点下方 **「重新生成视频」** 再试。',
    ].filter(Boolean);
    const chatMessage = await insertChatMessageTrusted({
      userId,
      projectId,
      role: 'assistant',
      content: failParts.join('\n'),
    });
    const content = embedVideoMarkers(
      outlineMd,
      {
        taskId: '',
        status: 'failed',
        error: errMsg,
        updatedAt: new Date().toISOString(),
      },
      undefined
    );
    const [updatedVideo] = await db()
      .update(pitchDeliverable)
      .set({
        content,
        fileUrl: '',
        status: 'failed',
        summary: `失败 · ${errMsg.slice(0, 120)}`,
      })
      .where(eq(pitchDeliverable.id, video.id))
      .returning();
    return {
      project,
      video: updatedVideo,
      chatMessage: toApiChatMessage(chatMessage),
      status: 'failed' as const,
      taskId: '',
    };
  }

  const job: VideoJobMeta = {
    taskId: submitted.taskId,
    status: 'queued',
    model: submitted.model,
    prompt: prompt.slice(0, 500),
    ratio: cfg.ratio,
    duration: cfg.duration,
    updatedAt: new Date().toISOString(),
    usedFallback: submitted.usedFallback,
    fallbackAttempted: submitted.usedFallback,
  };

  const content = embedVideoMarkers(outlineMd, job, undefined);
  const [updatedVideo] = await db()
    .update(pitchDeliverable)
    .set({
      content,
      fileUrl: '',
      status: 'generating',
      summary: `生成中 · ${submitted.model} · ${cfg.duration}s · ${cfg.ratio}${submitted.usedFallback ? ' · fallback' : ''}`,
      title: '生活方式短视频（横版）',
    })
    .where(eq(pitchDeliverable.id, video.id))
    .returning();

  const chatMessage = await insertChatMessageTrusted({
    userId,
    projectId,
    role: 'assistant',
    content: [
      'VIDEO_GENERATING_MARKER',
      '',
      `我是「${VIDEO_MARKER}」。已提交视频任务（${submitted.model} · ${cfg.duration}s · ${cfg.ratio}${submitted.usedFallback ? ' · 已回退备用模型' : ''}；参考图 ${refUrls.length} 张 HTTPS）。`,
      '',
      precheck.willFallbackWithoutImage
        ? '因缺公网 HTTPS 参考图，已走备用 MiniMax H3（RQ2）路径。'
        : '',
      precheck.tipZh,
      '',
      '正在生成中，请稍候…完成后左侧会出现打开/下载按钮，右侧「视频」Tab 可预览。',
      '',
      `> task: \`${submitted.taskId}\``,
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return {
    project,
    video: updatedVideo,
    chatMessage: toApiChatMessage(chatMessage),
    status: 'generating',
    taskId: submitted.taskId,
  };
}

/**
 * Poll lk888 task; when completed, download result_url + persist to R2 and mark ready.
 * Safe to call repeatedly from the client every 5–10s.
 * If primary fails and fallback not yet tried, re-submit once with MiniMax H3.
 */
export async function pollVideoJob(
  userId: string,
  projectId: string
): Promise<{
  project: PitchProject;
  video: PitchDeliverable;
  status: 'generating' | 'ready' | 'failed';
  taskId: string;
  progress?: number;
  chatMessage?: ReturnType<typeof toApiChatMessage>;
  fileUrl?: string;
}> {
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.lockedDesignId) throw new Error('请先锁定设计视觉');

  const video = await getLatestVideoRow(projectId, project.lockedDesignId);
  if (!video) throw new Error('视频交付物不存在');

  const existingStorage = parseVideoStoragePath(video.content);
  if (video.fileUrl && existingStorage && video.status === 'ready') {
    let nextProject = project;
    if (project.stage === 'video') {
      const advanced = await updateProject(userId, projectId, { stage: 'assets' });
      if (advanced) nextProject = advanced;
    }
    return {
      project: nextProject,
      video,
      status: 'ready',
      taskId: parseVideoJob(video.content)?.taskId || '',
      fileUrl: video.fileUrl,
    };
  }

  const job = parseVideoJob(video.content);
  if (!job?.taskId) {
    throw new Error('尚未提交视频任务，请先点「确认并生成视频」');
  }

  const task = await getLk888VideoTask(job.taskId);
  const statusLower = (task.status || '').toLowerCase();

  if (isLk888VideoReady(task.status)) {
    const resultUrlHint =
      (task as { resultUrl?: string }).resultUrl || job.resultUrl;
    let bytes: Uint8Array;
    let contentType: string;
    try {
      const downloaded = await downloadLk888VideoContent(
        job.taskId,
        resultUrlHint
      );
      bytes = downloaded.bytes;
      contentType = downloaded.contentType;
    } catch (dlErr: any) {
      // Provider already success; download/R2 may fail (timeout / CDN). Keep
      // taskId + generating so client resume poll can retry without re-submit.
      const dlMsg =
        dlErr?.message ||
        (typeof dlErr === 'string' ? dlErr : '下载成片失败');
      const waitJob: VideoJobMeta = {
        ...job,
        status: 'completed_pending_download',
        updatedAt: new Date().toISOString(),
        error: `成片已就绪，正在落库：${String(dlMsg).slice(0, 160)}`,
        resultUrl: resultUrlHint || job.resultUrl,
      };
      const outlineWait = stripVideoMarkers(video.content || '');
      const [updatedWait] = await db()
        .update(pitchDeliverable)
        .set({
          content: embedVideoMarkers(
            outlineWait,
            waitJob,
            existingStorage || undefined
          ),
          status: 'generating',
          summary: `成片就绪 · 落库中 · ${String(dlMsg).slice(0, 80)}`,
        })
        .where(eq(pitchDeliverable.id, video.id))
        .returning();
      return {
        project,
        video: updatedWait,
        status: 'generating' as const,
        taskId: job.taskId,
        progress: 100,
      };
    }
    const ext = contentType.includes('webm')
      ? 'webm'
      : contentType.includes('quicktime')
        ? 'mov'
        : 'mp4';
    const fileName = `${(project.brandName || 'brand')
      .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
      .slice(0, 40)}-lifestyle-video.${ext}`;
    const storagePath = await persistEnterpriseFile({
      userId,
      id: video.id,
      fileName,
      mimeType: contentType || 'video/mp4',
      buffer: Buffer.from(bytes),
    });
    const fileUrl = videoApiPath(projectId);
    const readyJob: VideoJobMeta = {
      ...job,
      status: 'completed',
      updatedAt: new Date().toISOString(),
      error: undefined,
      resultUrl: resultUrlHint || job.resultUrl,
    };
    const outline = stripVideoMarkers(video.content || '');
    const [updated] = await db()
      .update(pitchDeliverable)
      .set({
        content: embedVideoMarkers(outline, readyJob, storagePath),
        fileUrl,
        status: 'ready',
        summary: `就绪 · ${job.model || 'video'} · ${job.duration || 8}s · ${job.ratio || '16:9'}`,
      })
      .where(eq(pitchDeliverable.id, video.id))
      .returning();

    const chatMessage = await insertChatMessageTrusted({
      userId,
      projectId,
      role: 'assistant',
      content: [
        'VIDEO_READY_MARKER',
        '',
        `我是「${VIDEO_MARKER}」。短视频已生成完成。`,
        '',
        '请点击下方按钮打开或下载；右侧「视频」Tab 也可预览。',
        '',
        '> 若要改大纲：在左侧继续对话修改，再点一次「确认并生成视频」即可重新生成。',
      ].join('\n'),
    });

    let nextProject = project;
    if (project.stage === 'video') {
      const advanced = await updateProject(userId, projectId, { stage: 'assets' });
      if (advanced) nextProject = advanced;
    }

    return {
      project: nextProject,
      video: updated,
      status: 'ready',
      taskId: job.taskId,
      fileUrl,
      chatMessage: toApiChatMessage(chatMessage),
    };
  }

  if (isLk888VideoTerminal(task.status) && !isLk888VideoReady(task.status)) {
    const errMsg =
      typeof task.error === 'string'
        ? task.error
        : task.error?.message || `视频生成失败（${task.status}）`;

    // One-shot fallback: primary GK poll failed → re-submit MiniMax H3 once
    const cfg = await resolveLk888VideoConfig();
    const primary = (job.model || cfg.model || '').toLowerCase();
    const fallback = (cfg.fallbackModel || 'minimax-h3').toLowerCase();
    const canFallback =
      !job.fallbackAttempted &&
      fallback &&
      primary !== fallback &&
      !primary.includes('minimax');

    if (canFallback) {
      try {
        const outlineForRetry = stripVideoMarkers(video.content || '');
        const refs: string[] = [];
        // Best-effort: reuse design + long image URLs from project like confirm
        const [designRow] = await db()
          .select()
          .from(pitchDesignConcept)
          .where(eq(pitchDesignConcept.id, project.lockedDesignId!))
          .limit(1);
        if (designRow?.imageUrl && /^https?:\/\//i.test(designRow.imageUrl)) {
          refs.push(designRow.imageUrl);
        }
        const pdpRow = await getLatestPdpRow(projectId, project.lockedDesignId!);
        const longParsed = parsePdpLongImages(pdpRow?.content || '');
        const selectedLong =
          (longParsed?.selected && /^https?:\/\//i.test(longParsed.selected)
            ? longParsed.selected
            : '') ||
          (pdpRow?.fileUrl && /^https?:\/\//i.test(pdpRow.fileUrl)
            ? pdpRow.fileUrl
            : '') ||
          '';
        if (selectedLong && !refs.includes(selectedLong)) refs.push(selectedLong);
        for (const u of longParsed?.urls || []) {
          if (/^https?:\/\//i.test(u) && !refs.includes(u) && refs.length < 8) {
            refs.push(u);
          }
        }
        const prompt = buildWuyeVideoPrompt({
          brandName: project.brandName,
          country: project.country,
          track: project.track,
          designTitle: designRow?.title || '',
          designDirection: designRow?.direction || '',
          designSummary: designRow?.summary || '',
          outlineMd: outlineForRetry,
          refCount: refs.length,
        });
        const retried = await submitLk888VideoWithFallback({
          prompt,
          referenceImages: refs,
          duration: job.duration || cfg.duration,
          ratio: (job.ratio as '9:16' | '16:9') || cfg.ratio,
          model: cfg.fallbackModel,
          fallbackModel: cfg.fallbackModel,
        });
        const retryJob: VideoJobMeta = {
          ...job,
          taskId: retried.taskId,
          status: 'queued',
          model: retried.model,
          error: undefined,
          updatedAt: new Date().toISOString(),
          fallbackAttempted: true,
          usedFallback: true,
        };
        const [updatedRetry] = await db()
          .update(pitchDeliverable)
          .set({
            content: embedVideoMarkers(
              outlineForRetry,
              retryJob,
              existingStorage || undefined
            ),
            fileUrl: '',
            status: 'generating',
            summary: `生成中 · 已回退 ${retried.model}（主线失败：${errMsg.slice(0, 80)}）`,
          })
          .where(eq(pitchDeliverable.id, video.id))
          .returning();
        const chatRetry = await insertChatMessageTrusted({
          userId,
          projectId,
          role: 'assistant',
          content: [
            'VIDEO_GENERATING_MARKER',
            '',
            `我是「${VIDEO_MARKER}」。主线模型失败，已自动改用备用 ${retried.model} 重试。`,
            '',
            `> 主线错误：${errMsg}`,
            `> task: \`${retried.taskId}\``,
          ].join('\n'),
        });
        return {
          project,
          video: updatedRetry,
          status: 'generating' as const,
          taskId: retried.taskId,
          chatMessage: toApiChatMessage(chatRetry),
        };
      } catch (fallbackErr: any) {
        // fall through to failed with combined message
        const fb =
          fallbackErr?.message ||
          (typeof fallbackErr === 'string' ? fallbackErr : '备用模型提交失败');
        const combined = `${errMsg}；备用重试失败：${fb}`;
        const failedJob: VideoJobMeta = {
          ...job,
          status: 'failed',
          error: combined,
          updatedAt: new Date().toISOString(),
          fallbackAttempted: true,
        };
        const outline = stripVideoMarkers(video.content || '');
        const [updated] = await db()
          .update(pitchDeliverable)
          .set({
            content: embedVideoMarkers(
              outline,
              failedJob,
              existingStorage || undefined
            ),
            status: 'failed',
            summary: `失败 · ${combined.slice(0, 120)}`,
          })
          .where(eq(pitchDeliverable.id, video.id))
          .returning();
        const chatMessage = await insertChatMessageTrusted({
          userId,
          projectId,
          role: 'assistant',
          content: [
            'VIDEO_FAILED_MARKER',
            '',
            `我是「${VIDEO_MARKER}」。视频生成失败：${combined}`,
            '',
            VIDEO_COST_TIP_ZH,
            '',
            '请改大纲后点下方 **「重新生成视频」**，或顶部「确认并生成视频」再试（常需 3–5 次）。',
          ].join('\n'),
        });
        return {
          project,
          video: updated,
          status: 'failed' as const,
          taskId: job.taskId,
          chatMessage: toApiChatMessage(chatMessage),
        };
      }
    }

    const failedJob: VideoJobMeta = {
      ...job,
      status: statusLower || 'failed',
      error: errMsg,
      updatedAt: new Date().toISOString(),
    };
    const outline = stripVideoMarkers(video.content || '');
    const [updated] = await db()
      .update(pitchDeliverable)
      .set({
        content: embedVideoMarkers(outline, failedJob, existingStorage || undefined),
        status: 'failed',
        summary: `失败 · ${errMsg.slice(0, 120)}`,
      })
      .where(eq(pitchDeliverable.id, video.id))
      .returning();

    const chatMessage = await insertChatMessageTrusted({
      userId,
      projectId,
      role: 'assistant',
      content: [
            'VIDEO_FAILED_MARKER',
            '',
            `我是「${VIDEO_MARKER}」。视频生成失败：${errMsg}`,
            '',
            VIDEO_COST_TIP_ZH,
            '',
            '请改大纲后点下方 **「重新生成视频」**，或顶部「确认并生成视频」再试（常需 3–5 次）。',
          ].join('\n'),
    });

    return {
      project,
      video: updated,
      status: 'failed',
      taskId: job.taskId,
      chatMessage: toApiChatMessage(chatMessage),
    };
  }

  // Still in progress
  const progressJob: VideoJobMeta = {
    ...job,
    status: statusLower || job.status,
    updatedAt: new Date().toISOString(),
  };
  const outline = stripVideoMarkers(video.content || '');
  const [updated] = await db()
    .update(pitchDeliverable)
    .set({
      content: embedVideoMarkers(outline, progressJob, existingStorage || undefined),
      status: 'generating',
      summary: `生成中${typeof task.progress === 'number' ? ` · ${task.progress}%` : ''} · ${job.model || ''}`,
    })
    .where(eq(pitchDeliverable.id, video.id))
    .returning();

  return {
    project,
    video: updated,
    status: 'generating',
    taskId: job.taskId,
    progress: task.progress,
  };
}

/** Auth-gated video bytes for preview/download. */
export async function readVideoBytes(
  userId: string,
  projectId: string
): Promise<{ bytes: Uint8Array; fileName: string; contentType: string }> {
  await getProjectOrThrow(userId, projectId);
  const rows = await db()
    .select()
    .from(pitchDeliverable)
    .where(
      and(
        eq(pitchDeliverable.projectId, projectId),
        eq(pitchDeliverable.kind, 'video')
      )
    )
    .orderBy(desc(pitchDeliverable.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error('视频不存在');
  const storagePath = parseVideoStoragePath(row.content);
  if (!storagePath) throw new Error('尚未生成视频，请先点「确认并生成视频」');

  const fileName =
    (row.summary || '').includes('·')
      ? `${(await getProjectOrThrow(userId, projectId)).brandName || 'brand'}-lifestyle-video.mp4`
      : 'lifestyle-video.mp4';

  if (storagePath.startsWith('r2:')) {
    const key = storagePath.slice(3);
    const { getR2Bucket } = await import('@/core/storage/r2-binding');
    const bucket = getR2Bucket();
    if (!bucket) throw new Error('R2 不可用');
    const obj = await bucket.get(key);
    if (!obj?.body) throw new Error('视频文件不存在');
    const ab = await new Response(obj.body as any).arrayBuffer();
    const ct =
      (obj as any).httpMetadata?.contentType ||
      'video/mp4';
    return { bytes: new Uint8Array(ab), fileName, contentType: ct };
  }

  const { readFile } = await import('fs/promises');
  const full = path.join(localUploadRoot(), storagePath);
  const buf = await readFile(full);
  return {
    bytes: new Uint8Array(buf),
    fileName,
    contentType: 'video/mp4',
  };
}


/** One-click demo project with brief confirmed + designs + locked + deliverables. */
export async function seedDemoProject(userId: string): Promise<PitchProject> {
  const project = await createProject({
    userId,
    brandName: 'Aura Home',
    country: '美国',
    track: '生活方式香氛',
    note: '示范项目 · 一键种子',
    pinned: true,
  });

  await updateBrief(userId, project.id, {
    brandName: 'Aura Home',
    country: '美国',
    track: '生活方式香氛',
    goals: '共创一条居家香氛周边线，匹配品牌温暖极简调性，可柔性打样',
    audience: '25–40 岁都市白领，重视仪式感与可持续',
    opportunity: '订阅制周边与礼品套装',
    designDirection: '温暖极简 · 居家仪式感',
    constraints: [
      'priceBand: FOB USD 4.8–6.2 / unit（演示）',
      'suggestedRetail: 建议零售 USD 18–28 / unit（中端居家香氛 · 约 3–4.5× 出厂，演示）',
      'moq: 2000 pcs（演示）',
      'leadTime: 大货 35–45 天（演示）',
      'sampleTimeline: 7–10 天打样',
      '禁用荧光色；结构/配方待工厂确认',
    ].join('\n'),
  });

  // updateBrief resets stage to brief — confirm next
  await confirmBrief(userId, project.id);

  const designs = await ensureDesignConcepts(userId, project.id);
  const pick = designs[0];
  if (pick) {
    await lockDesignConcept(userId, project.id, pick.id);
    // Confirm PDP so demo lands on 出素材 with full pack
    await confirmPdp(userId, project.id);
  }

  const fresh = await getProject(userId, project.id);
  return fresh || project;
}

