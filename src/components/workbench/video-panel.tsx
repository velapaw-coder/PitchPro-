'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Download, Loader2, Video } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import {
  pitchApi,
  type ApiBrief,
  type ApiDeliverable,
  type ApiDesignConcept,
  type ApiProject,
  type ApiVideoRefPrecheck,
} from './api-client';
import { emitProjectsChanged } from './events';

function stripProposalStorage(content: string) {
  return (content || '')
    .replace(/<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/gi, '')
    .trim();
}

function stripVideoMarkers(content: string) {
  return (content || '')
    .replace(/<<<VIDEO_JOB[\s\S]*?VIDEO_JOB>>>/gi, '')
    .replace(/<<<VIDEO_STORAGE[\s\S]*?VIDEO_STORAGE>>>/gi, '')
    .replace(/VIDEO_READY_MARKER|VIDEO_GENERATING_MARKER|VIDEO_FAILED_MARKER/g, '')
    .trim();
}


/** Right pane for 场景视频: prior-material prep + preview + enter assets. */
export function VideoPanel({
  project,
  onProjectChange,
  onAdvanceToAssets,
}: {
  project: ApiProject;
  onProjectChange: (p: ApiProject) => void;
  onAdvanceToAssets: () => void;
}) {
  const [item, setItem] = useState<ApiDeliverable | null>(null);
  const [proposal, setProposal] = useState<ApiDeliverable | null>(null);
  const [brief, setBrief] = useState<ApiBrief | null>(null);
  const [design, setDesign] = useState<ApiDesignConcept | null>(null);
  const [longImageUrl, setLongImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [precheck, setPrecheck] = useState<ApiVideoRefPrecheck | null>(null);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const [delRes, projRes, designs, pdpRes] = await Promise.all([
        pitchApi.listDeliverables(project.id),
        pitchApi.getProject(project.id),
        pitchApi.listDesigns(project.id),
        pitchApi.getPdp(project.id).catch(() => null),
      ]);
      const video = delRes.items.find((d) => d.kind === 'video') || null;
      const prop = delRes.items.find((d) => d.kind === 'proposal') || null;
      setItem(video);
      setProposal(prop);
      setBrief(projRes.brief || null);
      setPrecheck(delRes.videoPrecheck || null);
      const lockedId = project.lockedDesignId || projRes.project.lockedDesignId;
      const locked =
        designs.find((d) => d.id === lockedId) ||
        designs.find((d) => d.locked) ||
        null;
      setDesign(locked);
      const longUrl =
        pdpRes?.selectedLongImageUrl ||
        pdpRes?.longImageUrls?.[0] ||
        '';
      setLongImageUrl(longUrl);
      if (delRes.videoChatMessage?.id) {
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', {
            detail: delRes.videoChatMessage,
          })
        );
      }
    } catch (e: any) {
      setErr(e.message || '加载视频失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const onAssets = () => void load();
    window.addEventListener('pitchpro:assets-changed', onAssets);
    return () =>
      window.removeEventListener('pitchpro:assets-changed', onAssets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.lockedDesignId]);

  // Resume poll when provider already finished but confirm-loop stopped / page refreshed.
  // Without this, right pane stays "生成中" forever even when lk888 admin shows success.
  useEffect(() => {
    if (item?.status !== 'generating') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await pitchApi.pollVideo(project.id);
        if (cancelled) return;
        if (res.project) {
          onProjectChange(res.project);
          emitProjectsChanged();
        }
        if (res.chatMessage) {
          window.dispatchEvent(
            new CustomEvent('pitchpro:chat-message', {
              detail: res.chatMessage,
            })
          );
        }
        window.dispatchEvent(new CustomEvent('pitchpro:assets-changed'));
        if (res.status === 'ready') {
          setItem(res.video || null);
          setMsg('短视频已就绪，可预览 / 下载');
          return;
        }
        if (res.status === 'failed') {
          setItem(res.video || null);
          setErr(res.video?.summary || '视频生成失败');
          return;
        }
        if (res.video) setItem(res.video);
      } catch (e: any) {
        // Transient poll/download errors — keep trying while generating
        if (!cancelled) {
          setErr(e?.message || '轮询视频状态失败，将自动重试');
        }
      }
      if (!cancelled) {
        timer = setTimeout(() => void tick(), 8000);
      }
    };

    timer = setTimeout(() => void tick(), 1500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, item?.status, item?.id]);

  useEffect(() => {
    let revoked: string | null = null;
    const url = item?.fileUrl;
    if (!url || !(url.startsWith('/') || /^https?:\/\//i.test(url))) {
      setObjectUrl(null);
      return;
    }
    void (async () => {
      try {
        const fetchUrl =
          typeof window !== 'undefined'
            ? `${window.location.origin}/api/pitchpro/projects/${project.id}/video`
            : url;
        const res = await fetch(fetchUrl, { credentials: 'include' });
        if (!res.ok) return;
        const blob = await res.blob();
        const obj = URL.createObjectURL(blob);
        revoked = obj;
        setObjectUrl(obj);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [item?.fileUrl, project.id]);

  const hasFile =
    !!item?.fileUrl &&
    (item.fileUrl.startsWith('/') || /^https?:\/\//i.test(item.fileUrl));

  const briefLine = useMemo(() => {
    if (!brief && !project.brandName) return '暂无聊方案摘要';
    const bits = [
      project.brandName || brief?.brandName,
      [brief?.country || project.country, brief?.track || project.track]
        .filter(Boolean)
        .join(' · '),
      brief?.audience?.trim(),
      brief?.goals?.trim(),
    ].filter(Boolean);
    return bits.join(' ｜ ').slice(0, 280);
  }, [brief, project]);

  const brandToneLine = useMemo(() => {
    const bits = [
      brief?.audience?.trim(),
      brief?.designDirection?.trim() || brief?.opportunity?.trim(),
      brief?.goals?.trim(),
    ].filter(Boolean);
    if (bits.length) return bits.join(' ｜ ').slice(0, 280);
    // Fallback: tiny extract from proposal only if brief empty — not full script
    const raw = stripProposalStorage(proposal?.content || '');
    const prefer = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /品牌调性|向往|Audience|lifestyle|目标人群/.test(l));
    return (
      prefer.join(' · ').slice(0, 220) ||
      '左侧对齐时会带上方案调性；视频不依赖提案脚本。'
    );
  }, [brief, proposal]);

  const scriptPreview = useMemo(() => {
    const raw = stripVideoMarkers(item?.content || '');
    return raw.slice(0, 900) || '左侧将展示 5 段式视频提示词；对齐后点「确认并生成视频」。';
  }, [item]);

  async function enterAssets() {
    setAdvancing(true);
    setErr('');
    try {
      const res = await pitchApi.advanceAssets(project.id);
      onProjectChange(res.project);
      emitProjectsChanged();
      setMsg('已进入出素材（整包下载）');
      onAdvanceToAssets();
    } catch (e: any) {
      setErr(e.message || '进入出素材失败');
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card size="sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">场景视频 · 物料齐套</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {item?.status || (loading ? '…' : '待生成')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            视频主物料：聊方案调性 + 锁定设计 + 叙事长图（≤15s
            生活方式介绍）。提案脚本不是生成依据。左侧对齐后点「确认并生成视频」（主线
            GK-video-3.5 · MC-GK1.5官转 · 10s · 16:9 · 720p，失败回退 MiniMax H3 · RQ2）。
          </p>
          {precheck && (
            <div
              className={`rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed ${
                precheck.willFallbackWithoutImage
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                  : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              <p className="font-medium">
                参考图预检：概念{' '}
                {precheck.hasConceptHttps ? '✓ HTTPS' : '✗ 缺公网 HTTPS'} · 长图{' '}
                {precheck.hasLongHttps ? '✓ HTTPS' : '✗ 缺公网 HTTPS'} · 可用{' '}
                {precheck.httpsRefs.length} 张
              </p>
              {precheck.warnZh ? (
                <p className="mt-1 flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  <span>{precheck.warnZh}</span>
                </p>
              ) : (
                <p className="mt-1">参考图齐备，可提交主线 GK-video-3.5（MC-GK1.5官转）图生视频。</p>
              )}
              <p className="mt-1.5">{precheck.tipZh}</p>
            </div>
          )}
          {item?.status === 'failed' && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed">
              上次生成失败
              {item.summary ? `：${item.summary}` : ''}。请回到左侧改大纲后点「重新生成视频」。
            </div>
          )}
          {err && <p className="text-destructive text-xs">{err}</p>}
          {msg && !err && (
            <p className="text-muted-foreground text-xs">{msg}</p>
          )}
          {loading && (
            <p className="text-muted-foreground text-xs">加载中…</p>
          )}

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium">聊方案摘要</p>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {briefLine}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-[11px] font-medium">锁定设计</p>
              {design?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={design.imageUrl}
                  alt={design.title || '锁定概念'}
                  className="aspect-[4/5] w-full rounded-lg border object-cover"
                />
              ) : (
                <div className="bg-muted text-muted-foreground flex aspect-[4/5] items-center justify-center rounded-lg border text-[10px]">
                  暂无概念图
                </div>
              )}
              <p className="text-muted-foreground truncate text-[10px]">
                {design?.title || '未锁定'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium">叙事长图</p>
              {longImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={longImageUrl}
                  alt="叙事长图"
                  className="aspect-[4/5] w-full rounded-lg border object-cover object-top"
                />
              ) : (
                <div className="bg-muted text-muted-foreground flex aspect-[4/5] items-center justify-center rounded-lg border text-[10px]">
                  暂无长图
                </div>
              )}
              <p className="text-muted-foreground truncate text-[10px]">
                已确认叙事长图
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium">品牌调性 / 向往生活</p>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {brandToneLine}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium">5 段式视频脚本</p>
            <pre className="bg-muted/50 max-h-40 overflow-auto rounded-lg p-2.5 text-[10px] leading-relaxed whitespace-pre-wrap">
              {scriptPreview}
            </pre>
            <p className="text-muted-foreground text-[10px] leading-relaxed">
              完整可改大纲在左侧「呈品 · 视频」；对齐后点「确认并生成视频」。
            </p>
          </div>

          {item?.status === 'generating' && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <Loader2 className="size-3 animate-spin" />
              视频生成中…
            </p>
          )}
          {hasFile && (
            <div className="space-y-2">
              <video
                controls
                className="max-h-80 w-full rounded-lg border bg-black"
                src={objectUrl || undefined}
              />
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="gap-1"
                onClick={() => {
                  void (async () => {
                    try {
                      await pitchApi.openVideo(project.id, { download: true });
                      setMsg('已开始下载短视频');
                    } catch (e: any) {
                      setErr(e?.message || '下载失败');
                    }
                  })();
                }}
              >
                <Download className="size-3" />
                打开 / 下载短视频
              </Button>
            </div>
          )}
          {!hasFile && item?.status !== 'generating' && (
            <p className="text-muted-foreground flex items-start gap-1.5 text-[11px]">
              <Video className="mt-0.5 size-3 shrink-0" />
              暂无成片。请在左侧点「确认并生成视频」。
            </p>
          )}
        </CardContent>
      </Card>

      <Button
        size="sm"
        className="w-full gap-1.5"
        disabled={advancing}
        onClick={() => void enterAssets()}
      >
        {advancing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ArrowRight className="size-3.5" />
        )}
        进入出素材（整包）
      </Button>
    </div>
  );
}
