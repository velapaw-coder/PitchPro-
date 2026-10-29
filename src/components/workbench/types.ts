export type WorkbenchStepId =
  | 'brief'
  | 'design'
  | 'pdp'
  | 'proposal'
  | 'video'
  | 'assets'
  | 'followup';

export type WorkbenchStageLabel =
  | '聊方案'
  | '选设计'
  | '叙事长图'
  | '产品提案'
  | '场景视频'
  | '出素材'
  | '做跟进';

export interface WorkbenchSession {
  id: string;
  brand: string;
  country: string;
  /** 目标品牌市场赛道（不是工厂 SKU） */
  track: string;
  stage: WorkbenchStageLabel;
  stepId: WorkbenchStepId;
  pinned?: boolean;
  note?: string;
  updatedAt: string;
}

export type SidebarViewMode = 'recent' | 'country' | 'track';
