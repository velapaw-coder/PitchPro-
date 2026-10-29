'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

import type {
  ApiBrandCard,
  ApiBrief,
  ApiDesignConcept,
  ApiProject,
} from './api-client';
import { AssetsPanel } from './assets-panel';
import { BriefPanel } from './brief-panel';
import { DesignPanel } from './design-panel';
import { FollowupPanel } from './followup-panel';
import { PdpPanel } from './pdp-panel';
import { ProposalPanel } from './proposal-panel';
import { VideoPanel } from './video-panel';
import type { WorkbenchStepId } from './types';

export function WorkbenchResultsPane({
  project,
  brief,
  stepId,
  searchCards,
  searchNotice,
  assetsTick = 0,
  designTick = 0,
  deliverTick = 0,
  pdpTick = 0,
  onBriefChange,
  onProjectChange,
  onSearchCardsChange,
  onAdvanceToDesign,
  onAdvanceToPdp,
  onAdvanceToProposal,
  onAdvanceToVideo,
  onAdvanceToAssets,
  onAdvanceToFollowup,
  onOpenLibrary,
  onOpenShelf,
  onDesignsReady,
}: {
  project: ApiProject;
  brief: ApiBrief;
  stepId: WorkbenchStepId;
  searchCards: ApiBrandCard[];
  searchNotice?: string;
  assetsTick?: number;
  designTick?: number;
  deliverTick?: number;
  pdpTick?: number;
  onBriefChange: (b: ApiBrief) => void;
  onProjectChange: (p: ApiProject) => void;
  onSearchCardsChange: (c: ApiBrandCard[]) => void;
  onAdvanceToDesign: () => void;
  onAdvanceToPdp: () => void;
  onAdvanceToProposal: () => void;
  onAdvanceToVideo: () => void;
  onAdvanceToAssets: () => void;
  onAdvanceToFollowup: () => void;
  onOpenLibrary: () => void;
  onOpenShelf: () => void;
  onDesignsReady?: (
    items: ApiDesignConcept[],
    source: 'load' | 'regen'
  ) => void;
}) {
  const t = useTranslations('workbench');

  const stepLabel =
    stepId === 'brief'
      ? t('step_brief')
      : stepId === 'design'
        ? t('step_design')
        : stepId === 'pdp'
          ? t('step_pdp')
          : stepId === 'proposal'
            ? t('step_proposal')
            : stepId === 'video'
              ? t('step_video')
              : stepId === 'assets'
                ? t('step_assets')
                : t('step_followup');

  return (
    <aside className="bg-muted/30 flex h-full w-full flex-col border-l md:w-[380px] lg:w-[440px]">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('results_title')}</h2>
          <Badge variant="outline">{stepLabel}</Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
          {t('results_hint')}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {stepId === 'brief' && (
          <BriefPanel
            project={project}
            brief={brief}
            searchCards={searchCards}
            searchNotice={searchNotice}
            assetsTick={assetsTick}
            onBriefChange={onBriefChange}
            onProjectChange={onProjectChange}
            onSearchCardsChange={onSearchCardsChange}
            onAdvanceToDesign={onAdvanceToDesign}
            onOpenLibrary={onOpenLibrary}
            onOpenShelf={onOpenShelf}
          />
        )}
        {stepId === 'design' && (
          <DesignPanel
            key={`design-${designTick}`}
            project={project}
            onProjectChange={onProjectChange}
            onAdvanceToPdp={onAdvanceToPdp}
            onDesignsReady={onDesignsReady}
          />
        )}
        {stepId === 'pdp' && (
          <PdpPanel
            key={`pdp-${pdpTick}`}
            project={project}
            onProjectChange={onProjectChange}
            onAdvanceToAssets={onAdvanceToProposal}
          />
        )}
        {stepId === 'proposal' && (
          <ProposalPanel
            key={`proposal-${deliverTick}`}
            project={project}
            onProjectChange={onProjectChange}
            onAdvanceToVideo={onAdvanceToVideo}
          />
        )}
        {stepId === 'video' && (
          <VideoPanel
            key={`video-${deliverTick}`}
            project={project}
            onProjectChange={onProjectChange}
            onAdvanceToAssets={onAdvanceToAssets}
          />
        )}
        {stepId === 'assets' && (
          <AssetsPanel
            key={`deliver-${deliverTick}`}
            project={project}
            onProjectChange={onProjectChange}
            onAdvanceToFollowup={onAdvanceToFollowup}
          />
        )}
        {stepId === 'followup' && (
          <FollowupPanel project={project} onProjectChange={onProjectChange} />
        )}
      </div>
    </aside>
  );
}
