import type { WorkbenchSession } from './types';

/** Placeholder sessions for UI shell — replace with API later. */
export const MOCK_SESSIONS: WorkbenchSession[] = [
  {
    id: 'demo-aura-home',
    brand: 'Aura Home',
    country: '美国',
    track: '生活方式香氛',
    stage: '聊方案',
    stepId: 'brief',
    pinned: true,
    note: '示范 · 按赛道轻搜点选',
    updatedAt: '2026-10-24T01:00:00+08:00',
  },
  {
    id: 'demo-nordic-glow',
    brand: 'Nordic Glow',
    country: '北欧',
    track: '护肤',
    stage: '选设计',
    stepId: 'design',
    note: '已确认简报',
    updatedAt: '2026-10-23T18:30:00+08:00',
  },
  {
    id: 'demo-petjoy-pdp',
    brand: 'PetJoy Co.',
    country: '美国',
    track: '宠物用品',
    stage: '叙事长图',
    stepId: 'pdp',
    note: '已锁定视觉，打磨叙事长图',
    updatedAt: '2026-10-22T15:00:00+08:00',
  },
  {
    id: 'demo-petjoy',
    brand: 'PetJoy Co.',
    country: '美国',
    track: '宠物用品',
    stage: '出素材',
    stepId: 'assets',
    updatedAt: '2026-10-22T11:00:00+08:00',
  },
  {
    id: 'demo-brewlab',
    brand: 'BrewLab',
    country: '英国',
    track: '咖啡器具',
    stage: '做跟进',
    stepId: 'followup',
    updatedAt: '2026-10-20T09:15:00+08:00',
  },
  {
    id: 'demo-lumen-kids',
    brand: 'Lumen Kids',
    country: '德国',
    track: '儿童家居',
    stage: '聊方案',
    stepId: 'brief',
    updatedAt: '2026-10-19T16:40:00+08:00',
  },
];

export function getMockSession(id: string): WorkbenchSession | undefined {
  return MOCK_SESSIONS.find((s) => s.id === id);
}

/** Flow A: 聊方案 → 选设计 → 叙事长图 → 产品提案 → 场景视频 → 出素材 → 跟进 */
export const STEP_ORDER = [
  { id: 'brief' as const, label: '聊方案' },
  { id: 'design' as const, label: '选设计' },
  { id: 'pdp' as const, label: '叙事长图' },
  { id: 'proposal' as const, label: '产品提案' },
  { id: 'video' as const, label: '场景视频' },
  { id: 'assets' as const, label: '出素材' },
  { id: 'followup' as const, label: '做跟进' },
];

export const STAGE_FROM_STEP: Record<string, string> = {
  brief: '聊方案',
  design: '选设计',
  pdp: '叙事长图',
  proposal: '产品提案',
  video: '场景视频',
  assets: '出素材',
  followup: '做跟进',
};

const STEP_IDS = new Set(STEP_ORDER.map((s) => s.id));

export function stepFromStage(stage: string): import('./types').WorkbenchStepId {
  if (STEP_IDS.has(stage as import('./types').WorkbenchStepId)) {
    return stage as import('./types').WorkbenchStepId;
  }
  // Chinese labels from older rows / sidebar display
  if (stage === '叙事长图' || stage === '详情页') return 'pdp';
  if (stage === '产品提案') return 'proposal';
  if (stage === '场景视频') return 'video';
  if (stage === '出素材') return 'assets';
  if (stage === '选设计') return 'design';
  if (stage === '做跟进') return 'followup';
  if (stage === '聊方案') return 'brief';
  return 'brief';
}
