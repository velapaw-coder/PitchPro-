'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/core/i18n/navigation';
import { Badge } from '@/components/ui/badge';

import {
  pitchApi,
  type ApiBrandCard,
  type ApiBrief,
  type ApiDesignConcept,
  type ApiProject,
} from './api-client';
import { BrandShelfDialog } from './brand-shelf-dialog';
import {
  emitDesignsGenerating,
  emitLongImagesGenerating,
  emitProjectsChanged,
  emitVideoGenerating,
} from './events';
import { EnterpriseLibraryDialog } from './enterprise-library-dialog';
import { getMockSession, STAGE_FROM_STEP, STEP_ORDER, stepFromStage } from './mock-sessions';
import type { WorkbenchStepId } from './types';
import {
  buildPdpNarrativeIntro,
  formatNarrativeChatMessage,
} from '@/modules/pitchpro/pdp-copy';
import { WorkbenchChatPane } from './workbench-chat-pane';
import { WorkbenchResultsPane } from './workbench-results-pane';
import { WorkbenchSteps } from './workbench-steps';

function reachedFromStage(stage: string): WorkbenchStepId {
  // Furthest unlocked step for top-bar navigation (flow A).
  if (stage === 'followup') return 'followup';
  if (stage === 'assets') return 'assets';
  if (stage === 'video') return 'video';
  if (stage === 'proposal') return 'proposal';
  if (stage === 'pdp') return 'pdp';
  if (stage === 'design') return 'design';
  return 'brief';
}


function formatDesignsChatMessage(items: ApiDesignConcept[], source: 'load' | 'regen') {
  const maxVersion = items.reduce((m, c) => Math.max(m, c.version || 0), 0);
  // On regen, only announce the newly appended batch to avoid re-flooding chat with old images
  const batch =
    source === 'regen'
      ? items.filter((c) => (c.version || 0) === maxVersion)
      : items;
  const head =
    source === 'regen'
      ? `已追加第 ${maxVersion} 批 ${batch.length} 个概念方向（Seedream），旧图仍保留在右侧。请锁定其一：`
      : batch.length > 4
        ? `当前共 ${batch.length} 个概念方向。图也在聊天里，请到右侧点「锁定视觉」选一张：`
        : '已生成 4 个概念方向（Seedream）。图也在聊天里，请到右侧点「锁定视觉」选一张：';
  const blocks = batch.map((c, i) => {
    const img = c.imageUrl ? `\n![${c.title}§${c.id}](${c.imageUrl})` : '';
    return `${i + 1}. **${c.title}**（${c.direction} · 第 ${c.version} 批）\n${c.summary || ''}${img}`;
  });
  return `${head}\n\n${blocks.join('\n\n')}`;
}

export function WorkbenchSessionView({ sessionId }: { sessionId: string }) {
  const t = useTranslations('workbench');
  const router = useRouter();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [brief, setBrief] = useState<ApiBrief | null>(null);
  const [stepId, setStepId] = useState<WorkbenchStepId>('brief');
  const [searchCards, setSearchCards] = useState<ApiBrandCard[]>([]);
  const [searchNotice, setSearchNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [libOpen, setLibOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [assetsTick, setAssetsTick] = useState(0);
  const [designTick, setDesignTick] = useState(0);
  const [deliverTick, setDeliverTick] = useState(0);
  const [pdpTick, setPdpTick] = useState(0);
  const designAnnounceRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (sessionId.startsWith('new-')) {
        const created = await pitchApi.createProject({ brandName: '新项目' });
        emitProjectsChanged();
        router.replace(`/workbench/${created.id}`);
        return;
      }

      const data = await pitchApi.getProject(sessionId);
      setProject(data.project);
      setBrief(data.brief);
      const stageStep = stepFromStage(data.project.stage);
      setStepId(stageStep);
    } catch (e: any) {
      try {
        const mock = getMockSession(sessionId);
        const created = await pitchApi.createProject({
          brandName: mock?.brand || '新项目',
          country: mock?.country || '',
          track: mock?.track || '',
          note: mock?.note || '',
          pinned: mock?.pinned,
        });
        if (mock && mock.stepId !== 'brief') {
          await pitchApi.updateProject(created.id, { stage: mock.stepId });
        }
        emitProjectsChanged();
        router.replace(`/workbench/${created.id}`);
      } catch (e2: any) {
        setError(e2.message || e.message || '加载失败');
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearchFromChat = useCallback(
    async (country: string, track: string, query?: string) => {
      try {
        const res = await pitchApi.searchBrands({ country, track, query });
        setSearchCards(res.items);
        setSearchNotice(res.notice);
        setStepId('brief');
      } catch (e: any) {
        setError(e.message);
      }
    },
    []
  );


  const pushDesignsToChat = useCallback(
    async (
      projectId: string,
      items: ApiDesignConcept[],
      source: 'load' | 'regen'
    ) => {
      if (!items.length) return;
      const sig = `${projectId}:${items.map((c) => c.id).join(',')}`;
      if (source === 'load' && designAnnounceRef.current === sig) return;
      designAnnounceRef.current = sig;
      try {
        const row = await pitchApi.appendMessage(projectId, {
          role: 'assistant',
          content: formatDesignsChatMessage(items, source),
        });
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', { detail: row })
        );
      } catch {
        /* ignore announce failure */
      }
    },
    []
  );

  const handleUrlBrand = useCallback(async (url: string) => {
    try {
      const res = await pitchApi.searchBrands({ url });
      setSearchCards(res.items);
      setSearchNotice(res.notice);
      setStepId('brief');
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  function onStepChange(next: WorkbenchStepId) {
    if (!project) return;
    const max = reachedFromStage(project.stage);
    const order = STEP_ORDER.map((s) => s.id);
    const nextIdx = order.indexOf(next);
    const maxIdx = order.indexOf(max);
    if (nextIdx < 0 || maxIdx < 0 || nextIdx > maxIdx) return;
    setStepId(next);
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {t('loading')}
      </div>
    );
  }

  if (error || !project || !brief) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-destructive text-sm">{error || '项目不存在'}</p>
      </div>
    );
  }

  const reachedStep = reachedFromStage(project.stage);

  const resultsProps = {
    project,
    brief,
    stepId,
    designTick,
    deliverTick,
    pdpTick,
    searchCards,
    searchNotice,
    assetsTick,
    onBriefChange: setBrief,
    onProjectChange: (p: ApiProject) => {
      setProject(p);
      emitProjectsChanged();
      if (p.stage === 'brief') setStepId('brief');
    },
    onSearchCardsChange: setSearchCards,
    onAdvanceToDesign: () => {
      setStepId('design');
      emitProjectsChanged();
    },
    onAdvanceToPdp: () => {
      setStepId('pdp');
      setPdpTick((n) => n + 1);
      emitProjectsChanged();
    },
    onAdvanceToProposal: () => {
      setStepId('proposal');
      setDeliverTick((n) => n + 1);
      emitProjectsChanged();
    },
    onAdvanceToVideo: () => {
      setStepId('video');
      setDeliverTick((n) => n + 1);
      emitProjectsChanged();
    },
    onAdvanceToAssets: () => {
      setStepId('assets');
      setDeliverTick((n) => n + 1);
      emitProjectsChanged();
    },
    onAdvanceToFollowup: () => {
      setStepId('followup');
      emitProjectsChanged();
    },
    onOpenLibrary: () => setLibOpen(true),
    onOpenShelf: () => setShelfOpen(true),
    onDesignsReady: (items: ApiDesignConcept[], source: 'load' | 'regen') => {
      void pushDesignsToChat(project.id, items, source);
    },
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold md:text-base">
              {project.brandName}
            </h1>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {STAGE_FROM_STEP[stepFromStage(project.stage)] || project.stage}
            </Badge>
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {t('session_meta', {
              brand: project.brandName,
              country: project.country || '未定国家',
              track: project.track || '未定赛道',
            })}
          </p>
        </div>
        <WorkbenchSteps
          activeStep={stepId}
          onStepChange={onStepChange}
          reachedStep={reachedStep}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <WorkbenchChatPane
          project={project}
          brief={brief}
          stepId={stepId}
          onRequestSearch={handleSearchFromChat}
          onRequestUrlBrand={handleUrlBrand}
          onOpenLibrary={() => setLibOpen(true)}
          onOpenShelf={() => setShelfOpen(true)}
          onBriefChange={setBrief}
          onProjectChange={(p) => {
            setProject(p);
            emitProjectsChanged();
            if (p.stage === 'brief') setStepId('brief');
          }}
          onRefineDesign={async (designId, instruction, mode) => {
            try {
              const res = await pitchApi.refineDesign(project.id, designId, {
                instruction,
                mode,
              });
              setDesignTick((n) => n + 1);
              window.dispatchEvent(
                new CustomEvent('pitchpro:chat-message', {
                  detail: res.chatMessage,
                })
              );
            } catch (e: any) {
              setError(e.message || '改图失败');
              throw e;
            }
          }}
          onRegenerateDesigns={async () => {
            emitDesignsGenerating(true);
            try {
              const items = await pitchApi.regenerateDesigns(project.id);
              // Announce new batch first so remounted DesignPanel load() dedupes via designAnnounceRef
              await pushDesignsToChat(project.id, items, 'regen');
              setStepId('design');
              setDesignTick((n) => n + 1);
            } catch (e: any) {
              setError(e.message);
              throw e;
            } finally {
              emitDesignsGenerating(false);
            }
          }}
          onRegenerateDeliverables={async () => {
            try {
              const res = await pitchApi.regenerateDeliverables(
                project.id,
                project.lockedDesignId || undefined
              );
              if (res.proposalChatMessage?.id) {
                window.dispatchEvent(
                  new CustomEvent('pitchpro:chat-message', {
                    detail: res.proposalChatMessage,
                  })
                );
              }
              setDeliverTick((n) => n + 1);
              setStepId('assets');
            } catch (e: any) {
              setError(e.message);
            }
          }}
          onConfirmProposalPdf={async () => {
            try {
              setError('');
              const res = await pitchApi.confirmProposalPdf(project.id);
              if (res.project) {
                setProject(res.project);
                emitProjectsChanged();
              }
              setDeliverTick((n) => n + 1);
              // Flow A: PDF ready → 场景视频
              setStepId(
                res.project?.stage === 'video' || res.videoChatMessage
                  ? 'video'
                  : 'proposal'
              );
              if (res.chatMessage) {
                window.dispatchEvent(
                  new CustomEvent('pitchpro:chat-message', {
                    detail: res.chatMessage,
                  })
                );
              }
              if (res.videoChatMessage?.id) {
                window.dispatchEvent(
                  new CustomEvent('pitchpro:chat-message', {
                    detail: res.videoChatMessage,
                  })
                );
              }
              window.dispatchEvent(new CustomEvent('pitchpro:assets-changed'));
            } catch (e: any) {
              setError(e.message || '生成产品提案 PDF 失败');
              throw e;
            }
          }}
          onConfirmVideo={async () => {
            emitVideoGenerating(true);
            try {
              setError('');
              const res = await pitchApi.confirmVideo(project.id);
              if (res.project) {
                setProject(res.project);
                emitProjectsChanged();
              }
              setDeliverTick((n) => n + 1);
              setStepId('video');
              if (res.chatMessage) {
                window.dispatchEvent(
                  new CustomEvent('pitchpro:chat-message', {
                    detail: res.chatMessage,
                  })
                );
              }
              window.dispatchEvent(new CustomEvent('pitchpro:assets-changed'));

              if (res.status === 'ready') {
                if (res.project?.stage === 'assets') setStepId('assets');
                return;
              }
              if (res.status === 'failed') {
                throw new Error(
                  res.video?.summary ||
                    '视频生成失败，请改大纲后点「重新生成视频」'
                );
              }

              // Client poll every ~8s. Provider jobs often finish after 6–12 min;
              // right-pane VideoPanel also resumes poll if this loop ends early.
              for (let i = 0; i < 90; i++) {
                await new Promise((r) => setTimeout(r, 8000));
                let tick: Awaited<ReturnType<typeof pitchApi.pollVideo>>;
                try {
                  tick = await pitchApi.pollVideo(project.id);
                } catch (pollErr: any) {
                  // Keep looping on transient Worker/download errors
                  if (i >= 89) {
                    throw new Error(
                      pollErr?.message ||
                        '视频轮询失败，请留在场景视频步等待自动同步，或再点确认'
                    );
                  }
                  continue;
                }
                if (tick.project) {
                  setProject(tick.project);
                  emitProjectsChanged();
                }
                setDeliverTick((n) => n + 1);
                window.dispatchEvent(new CustomEvent('pitchpro:assets-changed'));
                if (tick.chatMessage) {
                  window.dispatchEvent(
                    new CustomEvent('pitchpro:chat-message', {
                      detail: tick.chatMessage,
                    })
                  );
                }
                if (tick.status === 'ready') {
                  setStepId(
                    tick.project?.stage === 'assets' ? 'assets' : 'video'
                  );
                  return;
                }
                if (tick.status === 'failed') {
                  throw new Error(
                    tick.video?.summary || '视频生成失败，请修改大纲后重试'
                  );
                }
              }
              // Soft timeout: do not fail hard — panel resume poll will finish pull-to-R2
              setError(
                '视频仍在供应商侧生成或落库中；请留在「场景视频」步，右侧会自动同步预览/下载'
              );
              return;
            } catch (e: any) {
              setError(e.message || '生成视频失败');
              throw e;
            } finally {
              emitVideoGenerating(false);
            }
          }}
          onConfirmNarrative={async () => {
            emitLongImagesGenerating(true);
            try {
              setError('');
              const res = await pitchApi.confirmNarrative(project.id);
              setProject(res.project);
              emitProjectsChanged();
              setPdpTick((n) => n + 1);
              setStepId('pdp');
              if (res.chatMessage) {
                window.dispatchEvent(
                  new CustomEvent('pitchpro:chat-message', {
                    detail: res.chatMessage,
                  })
                );
              }
              window.dispatchEvent(new CustomEvent('pitchpro:pdp-updated'));

              // Client-driven ticks: each request generates one Seedream long image
              const status = res.status || res.pdp?.status;
              if (status === 'ready' && (res.longImageUrls?.length || 0) >= 2) {
                return;
              }
              for (let i = 0; i < 4; i++) {
                const tick = await pitchApi.advanceLongImages(project.id);
                if (tick.project) setProject(tick.project);
                setPdpTick((n) => n + 1);
                window.dispatchEvent(new CustomEvent('pitchpro:pdp-updated'));
                if (tick.chatMessage) {
                  window.dispatchEvent(
                    new CustomEvent('pitchpro:chat-message', {
                      detail: tick.chatMessage,
                    })
                  );
                }
                if (tick.status === 'ready') {
                  return;
                }
                if (tick.status === 'failed') {
                  throw new Error(
                    tick.pdp?.summary || '详情长图生成失败，请重试'
                  );
                }
              }
              throw new Error('长图生成未完成，请再点一次「确认这版叙事」');
            } catch (e: any) {
              setError(e.message || '确认叙事失败（长图生成）');
              throw e;
            } finally {
              emitLongImagesGenerating(false);
            }
          }}
          onRegeneratePdp={async () => {
            try {
              const res = await pitchApi.regeneratePdp(project.id);
              setPdpTick((n) => n + 1);
              setStepId('pdp');
              const narrative = buildPdpNarrativeIntro({
                brandName: project.brandName,
                track: project.track,
                country: project.country,
                designTitle: res.pdp?.title || '锁定视觉',
                designDirection: brief.designDirection || '',
                designSummary: res.pdp?.summary || '',
                audience: brief.audience,
                goals: brief.goals,
              });
              const body = formatNarrativeChatMessage({
                brandName: project.brandName,
                designTitle: res.pdp?.title || '锁定视觉',
                narrative:
                  '已按锁定视觉重讲生活方式叙事（暂不展开货架模块）。\n\n' +
                  narrative,
                heroUrl: res.pdp?.fileUrl || '',
              });
              const row = await pitchApi.appendMessage(project.id, {
                role: 'assistant',
                content: body,
              });
              window.dispatchEvent(
                new CustomEvent('pitchpro:chat-message', { detail: row })
              );
              window.dispatchEvent(new CustomEvent('pitchpro:pdp-updated'));
            } catch (e: any) {
              setError(e.message);
            }
          }}
        />
        <div className="hidden min-h-0 md:flex md:h-full">
          <WorkbenchResultsPane {...resultsProps} />
        </div>
        <div className="border-t md:hidden">
          <div className="h-[28rem]">
            <WorkbenchResultsPane {...resultsProps} />
          </div>
        </div>
      </div>

      <EnterpriseLibraryDialog
        open={libOpen}
        onOpenChange={(v) => {
          setLibOpen(v);
          if (!v) setAssetsTick((n) => n + 1);
        }}
      />
      <BrandShelfDialog
        open={shelfOpen}
        onOpenChange={setShelfOpen}
        onPick={async (brand) => {
          const res = await pitchApi.attachBrand(project.id, brand, false);
          setProject(res.project);
          setBrief(res.brief);
          setStepId('brief');
          emitProjectsChanged();
        }}
      />
    </div>
  );
}
