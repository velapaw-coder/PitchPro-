/**
 * Whether a product proposal may enter 场景视频.
 *
 * Completion is an exported PDF (workflow stage EXPORT_PDF, a stored file, or
 * the PROPOSAL_PDF_STORAGE marker) plus a locked design, and the project must
 * already be on 产品提案 or later. Recommended gaps such as sample lead time
 * are notices only. Visual review / export-check stages without an exported
 * file stay blocked. File URLs may be an API path, https, r2:, or a
 * `/media?path=` key with or without a leading slash.
 */

export const PROPOSAL_WORKFLOW_STAGES = [
  'DRAFT',
  'VISUAL_REVIEW',
  'CONTENT_REVIEW',
  'PDF_READY',
  'EXPORT_PDF',
] as const;

export type ProposalWorkflowStage = (typeof PROPOSAL_WORKFLOW_STAGES)[number];

export type ProposalWorkflowSnapshot = {
  stage?: string;
  missingData?: string[];
  approvedVisualCount?: number;
  pageSummary?: string;
};

export type ProposalVideoEntryInput = {
  lockedDesign: boolean;
  projectStage?: string | null;
  fileUrl?: string | null;
  content?: string | null;
  /** API `proposalWorkflow.state`. Overrides the marker embedded in content. */
  workflow?: ProposalWorkflowSnapshot | null;
};

export type ProposalVideoEntryDecision = {
  allow: boolean;
  /** Top step may open 场景视频 while project.stage is still 产品提案. */
  unlockStep: boolean;
  blockers: string[];
  notices: string[];
  summary: string;
  workflowStage: ProposalWorkflowStage | null;
  hasPdfArtifact: boolean;
};

const PROJECT_STEPS = [
  'brief',
  'design',
  'pdp',
  'proposal',
  'video',
  'assets',
  'followup',
] as const;

export type ProjectStepId = (typeof PROJECT_STEPS)[number];

const STAGE_LABEL: Record<ProposalWorkflowStage, string> = {
  DRAFT: '草案大纲',
  VISUAL_REVIEW: '视觉确认',
  CONTENT_REVIEW: '文案修订',
  PDF_READY: '导出检查',
  EXPORT_PDF: '已导出',
};

const STATE_RE = /<<<PROPOSAL_STATE\s*([\s\S]*?)\s*PROPOSAL_STATE>>>/i;
const STORAGE_RE = /<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/i;

export function readProposalWorkflow(
  content?: string | null
): ProposalWorkflowSnapshot | null {
  const match = (content || '').match(STATE_RE);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    const stage = typeof parsed.stage === 'string' ? parsed.stage : undefined;
    const missingData = Array.isArray(parsed.missingData)
      ? parsed.missingData.map((item) => String(item)).filter(Boolean)
      : undefined;
    let approvedVisualCount: number | undefined;
    if (typeof parsed.approvedVisualCount === 'number') {
      approvedVisualCount = parsed.approvedVisualCount;
    } else if (Array.isArray(parsed.visualTasks)) {
      approvedVisualCount = parsed.visualTasks.filter((task) => {
        if (!task || typeof task !== 'object') return false;
        const row = task as { status?: unknown; assetUrl?: unknown };
        return (
          String(row.status || '') === 'approved' &&
          String(row.assetUrl || '').trim().length > 0
        );
      }).length;
    }
    const pageSummary =
      typeof parsed.pageSummary === 'string' ? parsed.pageSummary : undefined;
    return { stage, missingData, approvedVisualCount, pageSummary };
  } catch {
    return null;
  }
}

export function hasProposalPdfArtifact(
  fileUrl?: string | null,
  content?: string | null
): boolean {
  const url = (fileUrl || '').trim();
  if (url && url !== '#' && !/^about:blank$/i.test(url)) {
    if (url.startsWith('/') || /^https?:\/\//i.test(url)) return true;
    if (/^r2:/i.test(url)) return true;
    if (/^media\?path=/i.test(url) || /\/media\?path=/i.test(url)) return true;
    if (/\.pdf(?:$|\?)/i.test(url)) return true;
    if (/^[A-Za-z0-9_./:@+-]{6,}$/.test(url) && url.includes('/')) return true;
  }
  return STORAGE_RE.test(content || '');
}

export function normalizeProjectStep(stage?: string | null): ProjectStepId {
  const raw = (stage || '').trim();
  if ((PROJECT_STEPS as readonly string[]).includes(raw)) {
    return raw as ProjectStepId;
  }
  if (raw === '叙事长图' || raw === '详情页') return 'pdp';
  if (raw === '产品提案') return 'proposal';
  if (raw === '场景视频') return 'video';
  if (raw === '出素材') return 'assets';
  if (raw === '选设计') return 'design';
  if (raw === '做跟进') return 'followup';
  if (raw === '聊方案') return 'brief';
  return 'brief';
}

function asWorkflowStage(stage?: string): ProposalWorkflowStage | null {
  if (!stage) return null;
  return (PROPOSAL_WORKFLOW_STAGES as readonly string[]).includes(stage)
    ? (stage as ProposalWorkflowStage)
    : null;
}

function missingNotices(missing?: string[]): string[] {
  return (missing || [])
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `待补充（不会自动编造，不阻止进入场景视频）：${item}`);
}

function blocked(
  blockers: string[],
  notices: string[],
  extra: Partial<ProposalVideoEntryDecision> = {}
): ProposalVideoEntryDecision {
  return {
    allow: false,
    unlockStep: false,
    blockers,
    notices,
    summary: blockers.join(' '),
    workflowStage: extra.workflowStage ?? null,
    hasPdfArtifact: extra.hasPdfArtifact ?? false,
  };
}

export function evaluateProposalVideoEntry(
  input: ProposalVideoEntryInput
): ProposalVideoEntryDecision {
  const embedded = readProposalWorkflow(input.content);
  const workflowStage = asWorkflowStage(
    input.workflow?.stage || embedded?.stage
  );
  const missingData = input.workflow?.missingData ?? embedded?.missingData;
  const approved =
    input.workflow?.approvedVisualCount ?? embedded?.approvedVisualCount;
  const hasPdfArtifact = hasProposalPdfArtifact(input.fileUrl, input.content);
  const notices = missingNotices(missingData);
  const step = normalizeProjectStep(input.projectStage);
  const rank = PROJECT_STEPS.indexOf(step);
  const proposalRank = PROJECT_STEPS.indexOf('proposal');
  const videoRank = PROJECT_STEPS.indexOf('video');

  if (rank < proposalRank) {
    return blocked(
      [
        '请先完成叙事长图并进入产品提案。导出 PDF 之后才能进入场景视频，不能从前面的步骤直接跳过。',
      ],
      notices,
      { workflowStage, hasPdfArtifact }
    );
  }

  if (!input.lockedDesign) {
    const blockers = ['请先锁定设计视觉后再进入场景视频。'];
    if (workflowStage === 'EXPORT_PDF' || hasPdfArtifact) {
      blockers.push(
        '已导出的 PDF 仍保留在服务器，但未锁定设计时不能下载或进入场景视频。'
      );
    }
    return blocked(blockers, notices, { workflowStage, hasPdfArtifact });
  }

  if (rank >= videoRank) {
    return {
      allow: true,
      unlockStep: true,
      blockers: [],
      notices,
      summary: '已进入场景视频',
      workflowStage,
      hasPdfArtifact,
    };
  }

  const exported = workflowStage === 'EXPORT_PDF' || hasPdfArtifact;
  if (exported) {
    const extra = [...notices];
    if (workflowStage && workflowStage !== 'EXPORT_PDF' && hasPdfArtifact) {
      extra.unshift(
        '已有导出的 PDF，可以进入场景视频。正在重走视觉确认时，新的 PDF 仍须至少批准 2 张图并重新导出后才会覆盖，未批准的图不会进 PDF。'
      );
    }
    return {
      allow: true,
      unlockStep: true,
      blockers: [],
      notices: extra,
      summary: '可以进入场景视频',
      workflowStage,
      hasPdfArtifact,
    };
  }

  const blockers: string[] = [];
  if (workflowStage === 'PDF_READY') {
    blockers.push(
      '当前停在「导出检查」。请在左侧点「确定生成 PDF」完成导出后，才能进入场景视频。'
    );
  } else if (workflowStage === 'CONTENT_REVIEW') {
    blockers.push(
      '当前停在「文案修订」。完成文案修订并导出 PDF 后，才能进入场景视频。'
    );
  } else if (workflowStage === 'VISUAL_REVIEW' || workflowStage === 'DRAFT') {
    const label = STAGE_LABEL[workflowStage];
    const approvedText =
      typeof approved === 'number' ? `已批准 ${approved} 张。` : '';
    blockers.push(
      `当前停在「${label}」。右侧至少批准 2 张图（未批准不进 PDF）并导出 PDF 后，才能进入场景视频。${approvedText}`.trim()
    );
  } else {
    blockers.push(
      '尚未生成 PDF。请在左侧点「确认并生成 PDF」。完成导出前不能进入场景视频。'
    );
  }
  return blocked(blockers, notices, { workflowStage, hasPdfArtifact });
}

/** Furthest top-bar step. Unlock stops at 场景视频 and never opens 出素材. */
export function bumpReachedStep(
  projectStage: string | null | undefined,
  unlockVideo: boolean
): ProjectStepId {
  const base = normalizeProjectStep(projectStage);
  if (!unlockVideo) return base;
  const order = PROJECT_STEPS;
  const baseIdx = order.indexOf(base);
  const videoIdx = order.indexOf('video');
  if (baseIdx < videoIdx) return 'video';
  return base;
}
