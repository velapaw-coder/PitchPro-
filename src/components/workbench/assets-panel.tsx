'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  Mail,
  RefreshCw,
  Video,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import {
  pitchApi,
  type ApiDeliverable,
  type ApiProject,
} from './api-client';
import { emitProjectsChanged } from './events';

function stripProposalStorage(content: string) {
  return (content || '')
    .replace(/<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/gi, '')
    .trim();
}

/** Parse <<<PDP_LONG_IMAGES>>> from deliverable content (client-side mirror of pdp-copy). */
function parseLongImagesFromContent(content: string | null | undefined): {
  urls: string[];
  selected: string;
} | null {
  if (!content) return null;
  const m = content.match(
    /<<<PDP_LONG_IMAGES\s*([\s\S]*?)\s*PDP_LONG_IMAGES>>>/
  );
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]) as { urls?: string[]; selected?: string };
    if (!data || !Array.isArray(data.urls)) return null;
    return {
      urls: data.urls.filter((u) => typeof u === 'string' && !!u),
      selected: data.selected || data.urls[0] || '',
    };
  } catch {
    return null;
  }
}

function stripPdpMarkers(content: string) {
  return (content || '')
    .replace(/<<<PDP_LONG_IMAGES[\s\S]*?PDP_LONG_IMAGES>>>/gi, '')
    .replace(/<<<PDP_JSON[\s\S]*?PDP_JSON>>>/gi, '')
    .trim();
}

const TABS = [
  { id: 'concepts', icon: ImageIcon, label: '概念图' },
  { id: 'proposal', icon: FileText, label: '产品提案' },
  { id: 'pdp', icon: LayoutTemplate, label: '叙事长图' },
  { id: 'video', icon: Video, label: '视频' },
  { id: 'outreach', icon: Mail, label: '开发信' },
] as const;

export function AssetsPanel({
  project,
  onProjectChange,
  onAdvanceToFollowup,
}: {
  project: ApiProject;
  onProjectChange: (p: ApiProject) => void;
  onAdvanceToFollowup: () => void;
}) {
  const [items, setItems] = useState<ApiDeliverable[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('proposal');
  const [loading, setLoading] = useState(true);
  const [regen, setRegen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await pitchApi.listDeliverables(project.id);
      setItems(res.items);
      if (res.proposalChatMessage?.id) {
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', {
            detail: res.proposalChatMessage,
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
      if (!res.lockedDesignId) {
        setErr('尚未锁定设计视觉，请先回到「选设计」');
      }
    } catch (e: any) {
      setErr(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.lockedDesignId]);

  useEffect(() => {
    const video = items.find((d) => d.kind === 'video');
    let revoked: string | null = null;
    if (
      tab === 'video' &&
      video?.fileUrl &&
      (video.fileUrl.startsWith('/') || /^https?:\/\//i.test(video.fileUrl))
    ) {
      void (async () => {
        try {
          const url =
            typeof window !== 'undefined'
              ? `${window.location.origin}/api/pitchpro/projects/${project.id}/video`
              : video.fileUrl!;
          const res = await fetch(url, { credentials: 'include' });
          if (!res.ok) return;
          const blob = await res.blob();
          const obj = URL.createObjectURL(blob);
          revoked = obj;
          setVideoObjectUrl(obj);
        } catch {
          /* ignore */
        }
      })();
    } else {
      setVideoObjectUrl(null);
    }
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, items, project.id]);

  async function onRegenerate() {
    setRegen(true);
    setErr('');
    try {
      const res = await pitchApi.regenerateDeliverables(
        project.id,
        project.lockedDesignId || undefined
      );
      setItems(res.items);
      if (res.proposalChatMessage?.id) {
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', {
            detail: res.proposalChatMessage,
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
      setMsg('已按锁定视觉重新生成同源素材包');
    } catch (e: any) {
      setErr(e.message || '重生失败');
    } finally {
      setRegen(false);
    }
  }

  async function onFollowup() {
    setAdvancing(true);
    setErr('');
    try {
      const res = await pitchApi.advanceFollowup(project.id);
      onProjectChange(res.project);
      emitProjectsChanged();
      onAdvanceToFollowup();
      setMsg('已进入做跟进 · 可预览并同步 GHL（无密钥则 Mock）');
    } catch (e: any) {
      setErr(e.message || '推进失败');
    } finally {
      setAdvancing(false);
    }
  }

  const current = items.find((d) => d.kind === tab);

  const pdpLong = useMemo(() => {
    const pdp = items.find((d) => d.kind === 'pdp');
    if (!pdp) return { urls: [] as string[], selected: '' };
    const parsed = parseLongImagesFromContent(pdp.content);
    const urls =
      parsed?.urls?.length
        ? parsed.urls
        : pdp.fileUrl &&
            (/^https?:\/\//i.test(pdp.fileUrl) || pdp.fileUrl.startsWith('/'))
          ? [pdp.fileUrl]
          : [];
    const selected =
      parsed?.selected && urls.includes(parsed.selected)
        ? parsed.selected
        : pdp.fileUrl && urls.includes(pdp.fileUrl)
          ? pdp.fileUrl
          : urls[0] || '';
    return { urls, selected };
  }, [items]);

  async function onExportPack() {
    setErr('');
    setMsg('');
    try {
      const res = await fetch(pitchApi.exportZipUrl(project.id), {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { message?: string }).message || `整包导出失败 (${res.status})`
        );
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename="([^"]+)"/.exec(cd);
      const name =
        m?.[1] || `pitchpro-${project.brandName || 'export'}-pack.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg(`已下载整包 ZIP：${name}`);
    } catch (e: any) {
      setErr(e.message || '整包导出失败');
    }
  }

  async function onCopyCurrent() {
    if (!current?.content) return;
    try {
      const text =
        tab === 'proposal'
          ? stripProposalStorage(current.content)
          : tab === 'pdp'
            ? stripPdpMarkers(current.content)
            : current.content;
      await navigator.clipboard.writeText(text);
      setMsg('已复制当前 Tab 文案');
      setErr('');
    } catch {
      setErr('复制失败，请手动选择文本');
    }
  }

  return (
    <div className="space-y-3">
      <Card size="sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">同源素材包</CardTitle>
            <div className="flex gap-1">
              <Button
                size="xs"
                variant="outline"
                className="gap-1"
                disabled={regen || !project.lockedDesignId}
                onClick={onRegenerate}
              >
                {regen ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                重生素材
              </Button>
              <Button
                size="xs"
                variant="outline"
                className="gap-1"
                disabled={items.length === 0}
                onClick={() => void onExportPack()}
              >
                <Download className="size-3" />
                下载 ZIP 整包
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-3">
          <p className="text-muted-foreground text-xs">
            出素材只负责整包浏览与下载：一点「下载 ZIP 整包」打包提案 PDF、概念图、叙事长图、场景视频（若已生成）、开发信与清单。生成请回到对应步骤。
          </p>
          {loading && (
            <p className="text-muted-foreground text-xs">加载素材…</p>
          )}
          {err && <p className="text-destructive text-xs">{err}</p>}
          {msg && !err && (
            <p className="text-muted-foreground text-xs">{msg}</p>
          )}
          <div className="flex flex-wrap gap-1">
            {items.map((d) => (
              <Badge key={d.id} variant="secondary" className="text-[10px]">
                {d.kind === 'pdp' ? '叙事长图' : d.kind} · v{d.version}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1">
        {TABS.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.id;
          const has = items.some((d) => d.kind === tb.id);
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground border',
                !has && 'opacity-50'
              )}
            >
              <Icon className="size-3" />
              {tb.label}
            </button>
          );
        })}
      </div>

      {current ? (
        <Card size="sm">
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">
                  {tab === 'pdp'
                    ? current.title
                        .replace('电商详情页', '叙事长图')
                        .replace('详情页', '叙事长图') || '叙事长图'
                    : current.title}
                </CardTitle>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  {tab === 'pdp'
                    ? current.summary
                        .replace('电商详情页', '叙事长图')
                        .replace('详情页', '生活方式叙事长图') ||
                      '已确认的生活方式叙事长图（非电商网页）'
                    : current.summary}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {current.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {tab === 'pdp' ? (
              <div className="space-y-3">
                {pdpLong.urls.length === 0 ? (
                  <p className="text-muted-foreground text-[11px]">
                    暂无叙事长图。请回到「叙事长图」步确认并生成后再来。
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {pdpLong.urls.map((url, i) => {
                      const isSel = url === pdpLong.selected;
                      return (
                        <div
                          key={url}
                          className={cn(
                            'overflow-hidden rounded-lg border bg-muted/30',
                            isSel && 'ring-primary ring-2'
                          )}
                        >
                          <button
                            type="button"
                            className="block w-full"
                            onClick={() => setLightbox(url)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`叙事长图方案 ${i + 1}`}
                              className="mx-auto max-h-72 w-full object-contain"
                            />
                          </button>
                          <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                            <span className="text-[10px] font-medium">
                              {isSel ? '已选 · ' : ''}
                              方案 {i + 1}
                            </span>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary inline-flex items-center gap-0.5 text-[10px] hover:underline"
                            >
                              <ExternalLink className="size-2.5" />
                              打开
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {stripPdpMarkers(current.content) && (
                  <pre className="bg-muted/50 max-h-32 overflow-auto rounded-lg p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
                    {stripPdpMarkers(current.content)}
                  </pre>
                )}
              </div>
            ) : tab === 'concepts' &&
              current.fileUrl &&
              (/^https?:\/\//i.test(current.fileUrl) ||
                current.fileUrl.startsWith('/')) ? (
              <div className="space-y-2">
                <button
                  type="button"
                  className="block w-full overflow-hidden rounded-lg border"
                  onClick={() => setLightbox(current.fileUrl)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.fileUrl}
                    alt="锁定概念图"
                    className="mx-auto max-h-64 object-contain"
                  />
                </button>
                <pre className="bg-muted/50 max-h-40 overflow-auto rounded-lg p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
                  {current.content}
                </pre>
              </div>
            ) : (
              <pre className="bg-muted/50 max-h-64 overflow-auto rounded-lg p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
                {tab === 'proposal'
                  ? stripProposalStorage(current.content)
                  : current.content}
              </pre>
            )}
            {current.fileUrl &&
              tab === 'proposal' &&
              (/^https?:\/\//i.test(current.fileUrl) ||
                current.fileUrl.startsWith('/')) && (
                <div className="mt-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      void (async () => {
                        setErr('');
                        setMsg('');
                        try {
                          await pitchApi.openProposalPdf(project.id);
                          setMsg('已打开产品提案 PDF');
                        } catch (e: any) {
                          setErr(e?.message || '打开 PDF 失败');
                        }
                      })();
                    }}
                  >
                    <Download className="size-3" />
                    打开 / 下载产品提案 PDF（带图画册）
                  </Button>
                </div>
              )}
            {tab === 'proposal' &&
              !(
                current.fileUrl &&
                (/^https?:\/\//i.test(current.fileUrl) ||
                  current.fileUrl.startsWith('/'))
              ) && (
                <p className="text-muted-foreground mt-2 text-[11px]">
                  提案 PDF 请在「产品提案」步生成；此处可打开已生成的画册下载。
                </p>
              )}
            {tab === 'video' && (
              <div className="mt-2 space-y-2">
                {current.status === 'generating' && (
                  <p className="text-muted-foreground text-[11px]">
                    视频生成中…请在左侧等待，或稍后再打开本 Tab。
                  </p>
                )}
                {current.status === 'failed' && (
                  <p className="text-destructive text-[11px]">
                    生成失败。请回到「场景视频」步改大纲后重试。
                  </p>
                )}
                {current.fileUrl &&
                  (current.fileUrl.startsWith('/') ||
                    /^https?:\/\//i.test(current.fileUrl)) && (
                  <div className="space-y-2">
                    <video
                      controls
                      className="max-h-80 w-full rounded-lg border bg-black"
                      src={videoObjectUrl || current.fileUrl}
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        void (async () => {
                          setErr('');
                          setMsg('');
                          try {
                            await pitchApi.openVideo(project.id, {
                              download: true,
                            });
                            setMsg('已开始下载短视频');
                          } catch (e: any) {
                            setErr(e?.message || '下载视频失败');
                          }
                        })();
                      }}
                    >
                      <Download className="size-3" />
                      打开 / 下载短视频
                    </Button>
                  </div>
                )}
                {!(
                  current.fileUrl &&
                  (current.fileUrl.startsWith('/') ||
                    /^https?:\/\//i.test(current.fileUrl))
                ) &&
                  current.status !== 'generating' && (
                    <p className="text-muted-foreground text-[11px]">
                      暂无视频文件。请回到「场景视频」步生成。
                    </p>
                  )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="xs"
                variant="outline"
                className="gap-1"
                onClick={() => void onExportPack()}
              >
                <Download className="size-3" />
                导出素材包 (Markdown)
              </Button>
              <Button
                size="xs"
                variant="outline"
                className="gap-1"
                onClick={() => void onCopyCurrent()}
              >
                <Copy className="size-3" />
                复制当前文案
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        !loading && (
          <p className="text-muted-foreground text-xs">该 Tab 暂无素材</p>
        )
      )}

      <Button
        size="sm"
        className="w-full gap-1.5"
        disabled={advancing || items.length === 0}
        onClick={onFollowup}
      >
        {advancing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ArrowRight className="size-3.5" />
        )}
        素材审核通过，进入做跟进
      </Button>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-label="图片放大"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white"
            onClick={() => setLightbox(null)}
          >
            关闭
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="放大预览"
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
