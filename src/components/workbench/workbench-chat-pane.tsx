'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Paperclip,
  Search,
  Send,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import {
  pitchApi,
  type ApiBrief,
  type ApiChatAttachment,
  type ApiChatMessage,
  type ApiProject,
} from './api-client';
import {
  DESIGNS_GENERATING,
  FOCUS_PROPOSAL_CHAT,
  LONG_IMAGES_GENERATING,
  VIDEO_GENERATING,
  emitAssetsChanged,
  emitDesignsGenerating,
  emitLongImagesGenerating,
  emitVideoGenerating,
} from './events';
import type { WorkbenchStepId } from './types';
import { ConceptImageToolbar } from './concept-image-toolbar';
import { ImageLightbox } from './image-lightbox';

type Msg = ApiChatMessage;

export function WorkbenchChatPane({
  project,
  brief,
  stepId,
  onRequestSearch,
  onRequestUrlBrand,
  onOpenLibrary,
  onOpenShelf,
  onRegenerateDesigns,
  onRegenerateDeliverables,
  onRegeneratePdp,
  onConfirmNarrative,
  onConfirmProposalPdf,
  onConfirmVideo,
  onBriefChange,
  onProjectChange,
  onRefineDesign,
}: {
  project: ApiProject;
  brief: ApiBrief;
  stepId: WorkbenchStepId;
  onRequestSearch: (country: string, track: string, query?: string) => void;
  onRequestUrlBrand: (url: string) => void;
  onOpenLibrary: () => void;
  onOpenShelf: () => void;
  onRegenerateDesigns?: () => void;
  onRegenerateDeliverables?: () => void;
  onRegeneratePdp?: () => void;
  /** Confirm lifestyle narrative → formal PDP appears on the right. */
  onConfirmNarrative?: () => Promise<void> | void;
  /** Confirm product-proposal outline → generate PDF. */
  onConfirmProposalPdf?: () => Promise<void> | void;
  /** Confirm video brief → generate lifestyle video. */
  onConfirmVideo?: () => Promise<void> | void;
  onBriefChange?: (b: ApiBrief) => void;
  onProjectChange?: (p: ApiProject) => void;
  /** Per-image edit / regen for a concept (designId from markdown §id). */
  onRefineDesign?: (
    designId: string,
    instruction: string,
    mode: 'edit' | 'regen' | 'remove-bg'
  ) => Promise<void>;
}) {
  const t = useTranslations('workbench');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [refineBusyId, setRefineBusyId] = useState<string | null>(null);
  const [generatingLong, setGeneratingLong] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [proposalConfirmPulse, setProposalConfirmPulse] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [regeneratingDesigns, setRegeneratingDesigns] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const items = await pitchApi.listMessages(project.id);
      if (items.length === 0 && seededRef.current !== project.id) {
        seededRef.current = project.id;
        const welcome = buildWelcome(project, brief, stepId);
        const saved: Msg[] = [];
        for (const m of welcome) {
          const row = await pitchApi.appendMessage(project.id, {
            role: m.role as 'assistant',
            content: m.content,
          });
          saved.push(row);
        }
        setMessages(saved);
      } else {
        setMessages(items);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]); // intentionally not brief/step — avoid wipe

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const handleRefineDesign = useCallback(
    async (
      designId: string,
      instruction: string,
      mode: 'edit' | 'regen' | 'remove-bg'
    ) => {
      if (!onRefineDesign || refineBusyId) return;
      setRefineBusyId(designId);
      try {
        await onRefineDesign(designId, instruction, mode);
      } finally {
        setRefineBusyId(null);
      }
    },
    [onRefineDesign, refineBusyId]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending, streamingText, generatingLong, regeneratingDesigns]);

  // Allow parent to push assistant messages (e.g. concept images)
  useEffect(() => {
    const onExternal = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as Msg | undefined;
      if (!detail?.id) return;
      const normalized: Msg = {
        ...detail,
        attachments: Array.isArray(detail.attachments)
          ? detail.attachments
          : typeof (detail as any).attachments === 'string'
            ? (() => {
                try {
                  const v = JSON.parse((detail as any).attachments || '[]');
                  return Array.isArray(v) ? v : [];
                } catch {
                  return [];
                }
              })()
            : [],
      };
      setMessages((m) => {
        const idx = m.findIndex((x) => x.id === normalized.id);
        if (idx >= 0) {
          const next = [...m];
          next[idx] = normalized;
          return next;
        }
        return [...m, normalized];
      });
    };
    window.addEventListener('pitchpro:chat-message', onExternal);
    return () => window.removeEventListener('pitchpro:chat-message', onExternal);
  }, []);

  useEffect(() => {
    const onLong = (ev: Event) => {
      const generating = !!(ev as CustomEvent).detail?.generating;
      setGeneratingLong(generating);
    };
    const onDesigns = (ev: Event) => {
      const generating = !!(ev as CustomEvent).detail?.generating;
      setRegeneratingDesigns(generating);
    };
    window.addEventListener(LONG_IMAGES_GENERATING, onLong);
    window.addEventListener(DESIGNS_GENERATING, onDesigns);
    return () => {
      window.removeEventListener(LONG_IMAGES_GENERATING, onLong);
      window.removeEventListener(DESIGNS_GENERATING, onDesigns);
    };
  }, []);
  useEffect(() => {
    const onFocus = () => {
      setProposalConfirmPulse(true);
      const run = () => {
        const el = document.getElementById('pitchpro-proposal-confirm-cta');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
      // wait a tick for new chat message to render
      window.setTimeout(run, 80);
      window.setTimeout(run, 320);
      window.setTimeout(() => setProposalConfirmPulse(false), 2600);
    };
    window.addEventListener(FOCUS_PROPOSAL_CHAT, onFocus);
    return () => window.removeEventListener(FOCUS_PROPOSAL_CHAT, onFocus);
  }, []);


  async function persist(
    role: 'user' | 'assistant',
    content: string,
    attachments?: ApiChatAttachment[]
  ) {
    const row = await pitchApi.appendMessage(project.id, {
      role,
      content,
      attachments,
    });
    setMessages((m) => [...m, row]);
    return row;
  }

  async function pushUser(content: string, attachments?: ApiChatAttachment[]) {
    if (sending) return;
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticUser: Msg = {
      id: optimisticId,
      role: 'user',
      content,
      attachments: attachments || [],
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimisticUser]);
    setSending(true);
    setStreamingText('');

    try {
      const result = await pitchApi.chat(
        project.id,
        { content, attachments },
        {
          onUser: (user) => {
            setMessages((m) =>
              m.map((x) => (x.id === optimisticId ? user : x))
            );
          },
          onDelta: (text) => {
            setStreamingText((prev) => stripBriefMarkers(prev + text));
          },
        }
      );
      setStreamingText('');
      setMessages((m) => {
        const withoutOptimistic = m.filter((x) => x.id !== optimisticId);
        const ids = new Set(withoutOptimistic.map((x) => x.id));
        const next = [...withoutOptimistic];
        if (!ids.has(result.user.id)) next.push(result.user);
        else {
          // Replace any temp user with canonical
          const idx = next.findIndex((x) => x.id === result.user.id);
          if (idx >= 0) next[idx] = result.user;
        }
        if (!ids.has(result.assistant.id)) next.push(result.assistant);
        return next;
      });
      if (result.brief && onBriefChange) {
        onBriefChange(result.brief);
      }
      if (result.project && onProjectChange) {
        onProjectChange(result.project);
      }
      if (stepId === 'pdp') {
        window.dispatchEvent(new CustomEvent('pitchpro:pdp-updated'));
        if (
          looksLikeConfirmNarrativeIntent(content) &&
          onConfirmNarrative &&
          !generatingLong
        ) {
          setGeneratingLong(true);
          emitLongImagesGenerating(true);
          try {
            await onConfirmNarrative();
          } catch {
            setGeneratingLong(false);
            emitLongImagesGenerating(false);
          }
        }
      }
    } catch (e: any) {
      setStreamingText('');
      // Fall back: replace optimistic with persisted user + local stub
      setMessages((m) => m.filter((x) => x.id !== optimisticId));
      try {
        await persist('user', content, attachments);
        const reply = stubReply(content, project, brief, stepId);
        await persist(
          'assistant',
          `（实时对话暂不可用：${e?.message || '错误'}）\n${reply.text}`
        );
      } catch {
        setMessages((m) => [
          ...m,
          optimisticUser,
          {
            id: `local-err-${Date.now()}`,
            role: 'assistant',
            content: `发送失败：${e?.message || '未知错误'}。请再试一次。`,
            attachments: [],
          },
        ]);
      }
    } finally {
      setSending(false);
      setStreamingText('');
    }
    // Side effects: URL brand parse / search chips still work from user text
    const side = stubReply(content, project, brief, stepId);
    if (side.url) onRequestUrlBrand(side.url);
    else if (side.search && /找品牌|推荐品牌|轻搜|搜索/.test(content)) {
      onRequestSearch(
        side.search.country,
        side.search.track,
        side.search.query
      );
    }
  }

  function onSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    void pushUser(text);
  }

  async function onAttach(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await pitchApi.uploadAssetFile(file, {
        projectId: project.id,
        title: file.name,
      });
      emitAssetsChanged();
      const att: ApiChatAttachment = {
        assetId: asset.id,
        fileName: asset.fileName,
        title: asset.title,
        mimeType: asset.mimeType,
        size: asset.size,
      };
      await pushUser(`上传了附件「${asset.title}」`, [att]);
    } catch (e: any) {
      await persist('assistant', `附件上传失败：${e.message || '未知错误'}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /** Clipboard paste: screenshot / copied image → same upload path as 📎 */
  function onPasteChat(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (uploading || sending || generatingLong || regeneratingDesigns) return;
    const cd = e.clipboardData;
    if (!cd) return;

    const images: File[] = [];
    const seen = new Set<File>();

    // Prefer FileList (common for OS screenshot paste)
    if (cd.files && cd.files.length > 0) {
      for (let i = 0; i < cd.files.length; i++) {
        const f = cd.files[i];
        if (f && f.type.startsWith('image/') && !seen.has(f)) {
          seen.add(f);
          images.push(f);
        }
      }
    }

    // Also scan items (browser "Copy image")
    if (cd.items && cd.items.length > 0) {
      for (let i = 0; i < cd.items.length; i++) {
        const item = cd.items[i];
        if (!item || item.kind !== 'file' || !item.type.startsWith('image/')) {
          continue;
        }
        const f = item.getAsFile();
        if (f && !seen.has(f)) {
          seen.add(f);
          images.push(f);
        }
      }
    }

    if (images.length === 0) return; // plain text / mixed non-image → default paste

    e.preventDefault();
    void (async () => {
      for (const raw of images) {
        const named =
          raw.name && raw.name !== 'image.png' && raw.name !== 'blob'
            ? raw
            : new File(
                [raw],
                `paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${
                  (raw.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
                }`,
                { type: raw.type || 'image/png' }
              );
        await onAttach(named);
      }
    })();
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
        {stepId === 'brief' && (
          <>
            <Chip
              icon={Search}
              label="按赛道找品牌"
              onClick={() => {
                const country = brief.country || project.country || '美国';
                const track = brief.track || project.track || '生活方式香氛';
                void pushUser(`请按「${country} · ${track}」帮我轻搜索推荐品牌`);
                onRequestSearch(country, track);
              }}
            />
            <Chip icon={FolderOpen} label="企业资料库" onClick={onOpenLibrary} />
            <Chip icon={Bookmark} label="我的品牌" onClick={onOpenShelf} />
          </>
        )}
        {stepId === 'design' && (
          <Chip
            icon={Search}
            label={regeneratingDesigns ? '概念生成中…' : '追加概念方向'}
            disabled={regeneratingDesigns || generatingLong || sending}
            busy={regeneratingDesigns}
            onClick={() => {
              void (async () => {
                if (regeneratingDesigns) return;
                setRegeneratingDesigns(true);
                emitDesignsGenerating(true);
                try {
                  await persist('user', '请追加一批新概念方向（旧图保留）');
                } catch {
                  /* still kick regen */
                }
                try {
                  await onRegenerateDesigns?.();
                } catch {
                  setRegeneratingDesigns(false);
                  emitDesignsGenerating(false);
                }
              })();
            }}
          />
        )}
        {stepId === 'pdp' && (
          <>
            <Chip
              icon={FileText}
              label={generatingLong ? '长图生成中…' : '确认这版叙事'}
              disabled={generatingLong || regeneratingDesigns || sending}
              busy={generatingLong}
              onClick={() => {
                void (async () => {
                  if (generatingLong || !onConfirmNarrative) return;
                  // Optimistic: show progress immediately (Seedream is slow)
                  setGeneratingLong(true);
                  emitLongImagesGenerating(true);
                  try {
                    await persist(
                      'user',
                      '确认这版长图叙事，请按此生成两张详情长图到右侧对比。'
                    );
                  } catch {
                    /* still start generation */
                  }
                  try {
                    await onConfirmNarrative();
                  } catch {
                    /* parent surfaces error; ensure UI clears */
                    setGeneratingLong(false);
                    emitLongImagesGenerating(false);
                  }
                })();
              }}
            />
            <Chip
              icon={FileText}
              label="更贴品牌调性"
              onClick={() =>
                void pushUser(
                  '请把叙事写得更贴合品牌调性与审美，强调「就是我们家的东西」。'
                )
              }
            />
            <Chip
              icon={FileText}
              label="换生活场景"
              onClick={() =>
                void pushUser(
                  '请换一套更贴近目标客群向往生活方式的使用场景，重讲故事。'
                )
              }
            />
            <Chip
              icon={FileText}
              label="语气更有温度"
              onClick={() =>
                void pushUser(
                  '请把长图叙事语气调得更有温度、更有仪式感，仍描述长图分段，不要做成货架模块清单。'
                )
              }
            />
          </>
        )}
        {stepId === 'assets' && (
          <Chip
            icon={Search}
            label="重生素材包"
            onClick={() => {
              void pushUser('请按锁定视觉重新生成同源素材');
              onRegenerateDeliverables?.();
            }}
          />
        )}
        {(stepId === 'proposal' || stepId === 'followup') && onConfirmProposalPdf && (
          <Chip
            icon={FileText}
            label={generatingPdf ? 'PDF 生成中…' : '确认并生成 PDF'}
            disabled={generatingPdf || sending}
            busy={generatingPdf}
            onClick={() => {
              void (async () => {
                if (generatingPdf || !onConfirmProposalPdf) return;
                setGeneratingPdf(true);
                try {
                  await persist('user', '确认这版产品提案大纲，请生成 PDF。');
                } catch {
                  /* still */
                }
                try {
                  await onConfirmProposalPdf();
                } catch {
                  /* parent */
                } finally {
                  setGeneratingPdf(false);
                }
              })();
            }}
          />
        )}
        {(stepId === 'video' || stepId === 'followup') && onConfirmVideo && (
          <Chip
            icon={FileText}
            label={generatingVideo ? '视频生成中…' : '确认并生成视频'}
            disabled={generatingVideo || sending}
            busy={generatingVideo}
            onClick={() => {
              void (async () => {
                if (generatingVideo || !onConfirmVideo) return;
                setGeneratingVideo(true);
                emitVideoGenerating(true);
                try {
                  await persist('user', '确认这版视频大纲，请生成短视频。');
                } catch {
                  /* still */
                }
                try {
                  await onConfirmVideo();
                } catch {
                  /* parent */
                } finally {
                  setGeneratingVideo(false);
                  emitVideoGenerating(false);
                }
              })();
            }}
          />
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
        {loading && (
          <p className="text-muted-foreground text-center text-xs">加载对话…</p>
        )}
        {messages.map((m, msgIdx) => {
          const isLastNarrative =
            stepId === 'pdp' &&
            m.role === 'assistant' &&
            isNarrativeAssistantMessage(m.content) &&
            !/正在生成 \*\*两张\*\*|已按确认的叙事生成|已按左侧确认的叙事生成|详情长图方案/.test(
              m.content
            ) &&
            // only under the latest narrative-ish assistant message
            !messages.slice(msgIdx + 1).some(
              (x) =>
                x.role === 'assistant' &&
                isNarrativeAssistantMessage(x.content) &&
                !/正在生成 \*\*两张\*\*|已按确认的叙事生成|已按左侧确认的叙事生成|详情长图方案/.test(
                  x.content
                )
            );
          const isLastProposal =
            (stepId === 'proposal' || stepId === 'followup') &&
            m.role === 'assistant' &&
            isProposalAssistantMessage(m.content) &&
            !m.content.includes('PDF_READY_MARKER') &&
            !messages.slice(msgIdx + 1).some(
              (x) =>
                x.role === 'assistant' &&
                isProposalAssistantMessage(x.content) &&
                !x.content.includes('PDF_READY_MARKER')
            );
          const isPdfReadyMsg =
            m.role === 'assistant' &&
            (m.content.includes('PDF_READY_MARKER') ||
              /\/api\/pitchpro\/projects\/[^/]+\/proposal-pdf/.test(
                m.content
              ) ||
              (isProposalAssistantMessage(m.content) &&
                /已按确认大纲生成/.test(m.content)));
          const isLastVideo =
            (stepId === 'video' || stepId === 'followup') &&
            m.role === 'assistant' &&
            isVideoAssistantMessage(m.content) &&
            !m.content.includes('VIDEO_READY_MARKER') &&
            !m.content.includes('VIDEO_GENERATING_MARKER') &&
            !m.content.includes('VIDEO_FAILED_MARKER') &&
            !messages.slice(msgIdx + 1).some(
              (x) =>
                x.role === 'assistant' &&
                isVideoAssistantMessage(x.content) &&
                !x.content.includes('VIDEO_READY_MARKER') &&
                !x.content.includes('VIDEO_GENERATING_MARKER') &&
                !x.content.includes('VIDEO_FAILED_MARKER')
            );
          const isVideoReadyMsg =
            m.role === 'assistant' &&
            (m.content.includes('VIDEO_READY_MARKER') ||
              (isVideoAssistantMessage(m.content) &&
                /短视频已生成完成/.test(m.content)));
          const isVideoFailedMsg =
            m.role === 'assistant' &&
            (m.content.includes('VIDEO_FAILED_MARKER') ||
              (isVideoAssistantMessage(m.content) &&
                /视频生成失败/.test(m.content)));
          return (
          <div
            key={m.id}
            className={cn(
              'flex',
              m.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              <MessageBody content={m.content} isUser={m.role === 'user'} onRefineDesign={handleRefineDesign} refineBusyId={refineBusyId} />
              {(() => {
                const atts = Array.isArray(m.attachments)
                  ? m.attachments
                  : typeof m.attachments === 'string'
                    ? (() => {
                        try {
                          const v = JSON.parse(m.attachments || '[]');
                          return Array.isArray(v) ? v : [];
                        } catch {
                          return [];
                        }
                      })()
                    : [];
                if (!atts.length) return null;
                return (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {atts.map((a: any) => (
                    <span
                      key={a.assetId || a.fileName || String(a)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]',
                        m.role === 'user'
                          ? 'bg-primary-foreground/15'
                          : 'bg-background border'
                      )}
                    >
                      <FileText className="size-3" />
                      {a.title || a.fileName}
                    </span>
                  ))}
                </div>
                );
              })()}
              {isLastNarrative && onConfirmNarrative && (
                <div className="mt-3 border-t border-foreground/10 pt-3">
                  <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
                    叙事对齐后点这里，系统会按锁定产品图生成两张详情长图。
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-1.5 sm:w-auto"
                    disabled={generatingLong || regeneratingDesigns || sending}
                    onClick={() => {
                      void (async () => {
                        if (generatingLong || !onConfirmNarrative) return;
                        setGeneratingLong(true);
                        emitLongImagesGenerating(true);
                        try {
                          await persist(
                            'user',
                            '确认这版长图叙事，请按此生成两张详情长图到右侧对比。'
                          );
                        } catch {
                          /* still start */
                        }
                        try {
                          await onConfirmNarrative();
                        } catch {
                          setGeneratingLong(false);
                          emitLongImagesGenerating(false);
                        }
                      })();
                    }}
                  >
                    {generatingLong ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        长图生成中…
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        确认这版叙事
                      </>
                    )}
                  </Button>
                </div>
              )}
              {isLastProposal && onConfirmProposalPdf && (
                <div
                  id="pitchpro-proposal-confirm-cta"
                  className={cn(
                    'mt-3 border-t border-foreground/10 pt-3 transition-shadow',
                    proposalConfirmPulse &&
                      'ring-primary/40 rounded-xl ring-2 ring-offset-2 ring-offset-background'
                  )}
                >
                  <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
                    大纲对齐后点这里生成产品提案 PDF；可改完再点，会覆盖上一版。
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-1.5 sm:w-auto"
                    disabled={generatingPdf || sending}
                    onClick={() => {
                      void (async () => {
                        if (generatingPdf || !onConfirmProposalPdf) return;
                        setGeneratingPdf(true);
                        try {
                          await persist(
                            'user',
                            '确认这版产品提案大纲，请生成 PDF。'
                          );
                        } catch {
                          /* still start */
                        }
                        try {
                          await onConfirmProposalPdf();
                        } catch {
                          /* parent surfaces */
                        } finally {
                          setGeneratingPdf(false);
                        }
                      })();
                    }}
                  >
                    {generatingPdf ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        PDF 生成中…
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        确认并生成 PDF
                      </>
                    )}
                  </Button>
                </div>
              )}
              {isPdfReadyMsg && (
                <div className="mt-3 space-y-2 border-t border-foreground/10 pt-3">
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    带图画册 PDF 已生成；点下方按钮在新标签打开或下载（需登录态）。
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-1.5 sm:w-auto"
                    onClick={() => {
                      void (async () => {
                        try {
                          await pitchApi.openProposalPdf(project.id);
                        } catch (e: any) {
                          window.alert(e?.message || '打开 PDF 失败');
                        }
                      })();
                    }}
                  >
                    <Download className="size-3.5" />
                    打开 / 下载产品提案 PDF
                  </Button>
                  {(stepId === 'proposal' || stepId === 'followup') &&
                    onConfirmProposalPdf && (
                      <div
                        id={
                          !messages.some(
                            (x, i) =>
                              i > msgIdx &&
                              x.role === 'assistant' &&
                              isProposalAssistantMessage(x.content) &&
                              !x.content.includes('PDF_READY_MARKER')
                          )
                            ? 'pitchpro-proposal-confirm-cta'
                            : undefined
                        }
                        className={cn(
                          'pt-1 transition-shadow',
                          proposalConfirmPulse &&
                            'ring-primary/40 rounded-xl ring-2 ring-offset-2 ring-offset-background'
                        )}
                      >
                        <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
                          不满意可继续对话改大纲，再点这里覆盖生成新 PDF。
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="w-full gap-1.5 sm:w-auto"
                          disabled={generatingPdf || sending}
                          onClick={() => {
                            void (async () => {
                              if (generatingPdf || !onConfirmProposalPdf) return;
                              setGeneratingPdf(true);
                              try {
                                await persist(
                                  'user',
                                  '确认这版产品提案大纲，请生成 PDF。'
                                );
                              } catch {
                                /* still */
                              }
                              try {
                                await onConfirmProposalPdf();
                              } catch {
                                /* parent */
                              } finally {
                                setGeneratingPdf(false);
                              }
                            })();
                          }}
                        >
                          {generatingPdf ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              PDF 生成中…
                            </>
                          ) : (
                            <>
                              <Check className="size-3.5" />
                              确认并生成 PDF
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                </div>
              )}
              {isLastVideo && onConfirmVideo && (
                <div className="mt-3 border-t border-foreground/10 pt-3">
                  <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
                    视频大纲对齐后点这里生成短视频；可改完再点，会重新提交任务。
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-1.5 sm:w-auto"
                    disabled={generatingVideo || sending}
                    onClick={() => {
                      void (async () => {
                        if (generatingVideo || !onConfirmVideo) return;
                        setGeneratingVideo(true);
                        emitVideoGenerating(true);
                        try {
                          await persist(
                            'user',
                            '确认这版视频大纲，请生成短视频。'
                          );
                        } catch {
                          /* still start */
                        }
                        try {
                          await onConfirmVideo();
                        } catch {
                          /* parent surfaces */
                        } finally {
                          setGeneratingVideo(false);
                          emitVideoGenerating(false);
                        }
                      })();
                    }}
                  >
                    {generatingVideo ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        视频生成中…
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        确认并生成视频
                      </>
                    )}
                  </Button>
                </div>
              )}
              {isVideoReadyMsg && (
                <div className="mt-3 border-t border-foreground/10 pt-3">
                  <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
                    短视频已生成；可在下方直接预览播放，或打开／下载（需登录态）。
                  </p>
                  <ChatReadyVideoPreview projectId={project.id} />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full gap-1.5 sm:w-auto"
                    onClick={() => {
                      void (async () => {
                        try {
                          await pitchApi.openVideo(project.id, {
                            download: true,
                          });
                        } catch (e: any) {
                          window.alert(e?.message || '打开视频失败');
                        }
                      })();
                    }}
                  >
                    <Download className="size-3.5" />
                    打开 / 下载短视频
                  </Button>
                </div>
              )}
              {isVideoFailedMsg && onConfirmVideo && (
                <div className="mt-3 border-t border-destructive/20 pt-3">
                  <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
                    生成失败属常态（常需 3–5 次）。可改大纲后点下方重试；默认约 10s · 16:9 · 720p，主线 GK-video-3.5（MC-GK1.5官转）/ 备用 MiniMax H3（RQ2）。
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 sm:w-auto"
                    disabled={generatingVideo || sending}
                    onClick={() => {
                      void (async () => {
                        if (generatingVideo || !onConfirmVideo) return;
                        setGeneratingVideo(true);
                        emitVideoGenerating(true);
                        try {
                          await persist(
                            'user',
                            '请按当前大纲重新生成短视频。'
                          );
                        } catch {
                          /* still */
                        }
                        try {
                          await onConfirmVideo();
                        } catch {
                          /* parent */
                        } finally {
                          setGeneratingVideo(false);
                          emitVideoGenerating(false);
                        }
                      })();
                    }}
                  >
                    {generatingVideo ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        重新生成中…
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        重新生成视频
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
          );
        })}
        {(generatingLong || generatingPdf || generatingVideo || regeneratingDesigns || (sending && !streamingText)) && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground inline-flex max-w-[90%] items-start gap-2 rounded-2xl px-3.5 py-2.5 text-sm">
              <span className="mt-1.5 flex gap-1 shrink-0" aria-hidden>
                <span className="bg-foreground/40 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                <span className="bg-foreground/40 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                <span className="bg-foreground/40 size-1.5 animate-bounce rounded-full" />
              </span>
              <span className="leading-relaxed">
                {generatingLong
                  ? '正在按叙事生成两张详情长图…（约 1–2 分钟，请稍候）'
                  : generatingPdf
                    ? '正在生成产品提案 PDF…'
                    : generatingVideo
                      ? '正在生成生活方式短视频…（约 1–3 分钟，请稍候）'
                      : regeneratingDesigns
                        ? '正在追加一批新概念（旧图保留）…（约 1–2 分钟，请稍候）'
                        : '正在思考…'}
              </span>
            </div>
          </div>
        )}
        {sending && streamingText && (
          <div className="flex justify-start">
            <div className="bg-muted text-foreground max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm">
              <MessageBody content={streamingText} isUser={false} onRefineDesign={handleRefineDesign} refineBusyId={refineBusyId} />
              <span className="bg-foreground/50 ml-0.5 inline-block h-3.5 w-1.5 animate-pulse align-middle" />
            </div>
          </div>
        )}
        <p className="text-muted-foreground text-center text-xs">
          {t('chat_stub_hint')}
        </p>
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 md:p-4">
        <p className="text-muted-foreground mb-1.5 px-0.5 text-[11px]">
          📎 上传附件，或直接 Ctrl/⌘+V 粘贴图片
        </p>
        <div className="bg-background focus-within:ring-ring/40 flex items-end gap-2 rounded-xl border p-2 shadow-sm focus-within:ring-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => onAttach(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            disabled={uploading || sending || generatingLong || regeneratingDesigns}
            title="上传附件到当前项目"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Paperclip className="size-4" />
            )}
          </Button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={onPasteChat}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={2}
            placeholder={t('chat_placeholder')}
            className="placeholder:text-muted-foreground max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none"
          />
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={onSend}
            disabled={!draft.trim() || sending || uploading || generatingLong || regeneratingDesigns}
          >
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            {t('chat_send')}
          </Button>
        </div>
      </div>
    </div>
  );
}


function stripBriefMarkers(text: string): string {
  // Hide complete brief/PDP blocks while streaming; also hide trailing partial openers
  let out = text.replace(/<<<BRIEF[\s\S]*?BRIEF>>>/gi, '');
  out = out.replace(/<<<PDP_JSON[\s\S]*?PDP_JSON>>>/gi, '');
  // Proposal PDF ready: never show internal marker or raw markdown link (chat is not MD)
  out = out.replace(/PDF_READY_MARKER\s*/g, '');
  out = out.replace(/VIDEO_READY_MARKER\s*/g, '');
  out = out.replace(/VIDEO_GENERATING_MARKER\s*/g, '');
  out = out.replace(/VIDEO_FAILED_MARKER\s*/g, '');
  out = out.replace(
    /\[打开\s*\/\s*下载产品提案 PDF\]\([^)]*\)\s*/g,
    ''
  );
  let open = out.search(/<<<BRIEF/i);
  if (open >= 0) out = out.slice(0, open);
  open = out.search(/<<<PDP_JSON/i);
  if (open >= 0) out = out.slice(0, open);
  return out;
}


function parseConceptAlt(raw: string): { title: string; designId: string | null } {
  const idx = raw.indexOf('§');
  if (idx < 0) return { title: raw || 'concept', designId: null };
  return {
    title: raw.slice(0, idx) || 'concept',
    designId: raw.slice(idx + 1).trim() || null,
  };
}

function MessageBody({
  content,
  isUser,
  onRefineDesign,
  refineBusyId,
}: {
  content: string;
  isUser: boolean;
  onRefineDesign?: (
    designId: string,
    instruction: string,
    mode: 'edit' | 'regen' | 'remove-bg'
  ) => Promise<void>;
  refineBusyId?: string | null;
}) {
  const [lightbox, setLightbox] = useState<{
    src: string;
    alt: string;
    designId: string | null;
  } | null>(null);
  const clean = stripBriefMarkers(content);
  // Split markdown images ![alt](url) so concepts show full-size inline in chat
  const parts = clean.split(/(!\[[^\]]*\]\([^)]+\))/g);
  const hasImage = parts.some((p) => /^!\[[^\]]*\]\([^)]+\)$/.test(p));
  return (
    <div className={cn('space-y-3 whitespace-pre-wrap', hasImage && 'w-full')}>
      {parts.map((part, i) => {
        const m = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (m) {
          const src = m[2];
          const { title, designId } = parseConceptAlt(m[1] || '');
          const busy = !!(designId && refineBusyId === designId);
          const canRefine = !!(designId && onRefineDesign);
          return (
            <div
              key={i}
              className={cn(
                'group relative mt-1 w-full overflow-hidden rounded-xl',
                isUser ? 'ring-1 ring-primary-foreground/20' : 'border bg-background'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={title}
                className={cn(
                  'h-auto max-h-[32rem] w-full cursor-zoom-in object-contain',
                  busy && 'opacity-60'
                )}
                onClick={() => setLightbox({ src, alt: title, designId })}
              />
              {/* ChatGPT-style dark floating toolbar */}
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <ConceptImageToolbar
                  busy={busy}
                  canRefine={canRefine}
                  onZoom={() => setLightbox({ src, alt: title, designId })}
                  onEdit={() => setLightbox({ src, alt: title, designId })}
                  onRemoveBg={() => {
                    if (!designId || !onRefineDesign) return;
                    void onRefineDesign(designId, '', 'remove-bg');
                  }}
                  onRegen={() => {
                    if (!designId || !onRefineDesign) return;
                    void onRefineDesign(designId, '', 'regen');
                  }}
                />
              </div>
              {busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                    <Loader2 className="size-3.5 animate-spin" />
                    正在改这张…
                  </span>
                </div>
              )}
            </div>
          );
        }
        if (!part) return null;
        return <span key={i}>{part}</span>;
      })}
      <ImageLightbox
        open={!!lightbox}
        src={lightbox?.src || null}
        alt={lightbox?.alt}
        designId={lightbox?.designId}
        busy={!!(lightbox?.designId && refineBusyId === lightbox.designId)}
        onClose={() => setLightbox(null)}
        onRefine={
          onRefineDesign
            ? async (id, instruction, mode) => {
                await onRefineDesign(id, instruction, mode);
              }
            : undefined
        }
      />
    </div>
  );
}


function isProposalAssistantMessage(content: string) {
  return (
    content.includes('呈品 · 提案') ||
    content.includes('产品提案大纲') ||
    content.includes('确认并生成 PDF')
  );
}

function isVideoAssistantMessage(content: string) {
  return (
    content.includes('呈品 · 视频') ||
    content.includes('视频大纲') ||
    content.includes('确认并生成视频') ||
    content.includes('Video brief')
  );
}

function ChatReadyVideoPreview({ projectId }: { projectId: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    setErr('');
    void (async () => {
      try {
        const url = pitchApi.videoUrl(projectId);
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
          throw new Error(`加载视频失败 (${res.status})`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        const obj = URL.createObjectURL(blob);
        revoked = obj;
        setObjectUrl(obj);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || '加载视频失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [projectId]);

  if (loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Loader2 className="size-3.5 animate-spin" />
        加载预览…
      </p>
    );
  }
  if (err || !objectUrl) {
    return (
      <p className="text-destructive text-[11px]">
        {err || '暂无法预览，请用下方按钮打开／下载。'}
      </p>
    );
  }
  return (
    <video
      controls
      playsInline
      preload="metadata"
      className="max-h-64 w-full max-w-md rounded-lg border bg-black"
      src={objectUrl}
    />
  );
}


function isNarrativeAssistantMessage(content: string) {
  return (
    content.includes('呈品 · 叙事师') ||
    content.includes('详情长图') ||
    content.includes('长图叙事') ||
    content.includes('确认这版叙事')
  );
}

function looksLikeConfirmNarrativeIntent(text: string) {
  const s = text.trim();
  if (!s) return false;
  return (
    /确认这版/.test(s) ||
    /确认叙事/.test(s) ||
    /生成长图/.test(s) ||
    /开始生成/.test(s) ||
    /按这[一]?版.*(生成|做|出图|出)/.test(s) ||
    /就按.*(这|该).*(生成|出图|做)/.test(s)
  );
}

function Chip({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  busy = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:bg-muted/80'
      )}
    >
      {busy ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Icon className="size-3" />
      )}
      {label}
    </button>
  );
}

function buildWelcome(
  project: ApiProject,
  brief: ApiBrief,
  stepId: WorkbenchStepId
): { role: 'assistant'; content: string }[] {
  const msgs = [
    {
      role: 'assistant' as const,
      content:
        '你好，我是呈品共创顾问。\n左侧这里用对话共创方案；右侧成果区只负责确认与点选。\n你可以：\n1. 告诉我国家 + 赛道，或点「按赛道找品牌」\n2. 粘贴品牌官网 / IG / FB\n3. 用 📎 上传企业资料，或在输入框粘贴图片\n4. 聊清楚目标后，在右侧点「确认简报」\n\n（对话与生图已接火山；消息按项目持久化）',
    },
  ];
  if (stepId === 'brief') {
    msgs.push({
      role: 'assistant',
      content: `当前项目：${project.brandName || '新项目'}（${project.country || '未定国家'} · ${project.track || '未定赛道'}）。\n简报状态：${brief.status === 'confirmed' ? '已确认' : '草稿——继续聊，我会把要点同步到右侧供你确认'}。`,
    });
  }
  return msgs;
}

function stubReply(
  text: string,
  project: ApiProject,
  brief: ApiBrief,
  stepId: WorkbenchStepId
): {
  text: string;
  search?: { country: string; track: string; query: string };
  url?: string;
} {
  const urlMatch = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  if (urlMatch) {
    return {
      text: `已识别链接 ${urlMatch[0]}。候选品牌卡片已发到右侧，点选即可。`,
      url: urlMatch[0],
    };
  }

  const wantsSearch =
    /找品牌|推荐品牌|轻搜|搜索|香氛|护肤|宠物|咖啡|赛道/.test(text);

  if (wantsSearch || stepId === 'brief') {
    const country =
      extractCountry(text) || brief.country || project.country || '美国';
    const track =
      extractTrack(text) || brief.track || project.track || '生活方式香氛';
    if (wantsSearch) {
      return {
        text: `好的，我按「${country} · ${track}」做公开网页轻搜索，候选已发到右侧供你点选。`,
        search: { country, track, query: text },
      };
    }
  }

  if (/简报|确认|目标/.test(text)) {
    return {
      text: '我已把对话里的要点同步到右侧简报摘要。请在成果区核对后点「确认简报」；若要改个别字段，可展开「微调」。',
    };
  }

  return {
    text: `已收到。继续描述国家/赛道/共创目标，或粘贴品牌链接 / 上传附件。\n项目：${project.brandName}`,
  };
}

function extractCountry(text: string) {
  for (const c of ['美国', '英国', '德国', '北欧', '日本', '澳洲', '加拿大', '法国']) {
    if (text.includes(c)) return c;
  }
  return '';
}

function extractTrack(text: string) {
  for (const c of [
    '生活方式香氛',
    '香氛',
    '护肤',
    '宠物用品',
    '咖啡器具',
    '儿童家居',
  ]) {
    if (text.includes(c)) return c === '香氛' ? '生活方式香氛' : c;
  }
  return '';
}
