'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ImageIcon,
  Loader2,
  Lock,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  parsePdpLongImages,
  parsePdpStructured,
} from '@/modules/pitchpro/pdp-copy';

import {
  pitchApi,
  type ApiDeliverable,
  type ApiDesignConcept,
  type ApiProject,
} from './api-client';
import {
  LONG_IMAGES_GENERATING,
  emitProjectsChanged,
} from './events';

/**
 * Right pane for PDP stage:
 * - narrative: waiting — left aligns long-image story
 * - ready: show TWO long images, pick one, confirm → assets
 */
export function PdpPanel({
  project,
  onProjectChange,
  onAdvanceToAssets,
}: {
  project: ApiProject;
  onProjectChange: (p: ApiProject) => void;
  onAdvanceToAssets: () => void;
}) {
  const [pdp, setPdp] = useState<ApiDeliverable | null>(null);
  const [locked, setLocked] = useState<ApiDesignConcept | null>(null);
  const [longUrls, setLongUrls] = useState<string[]>([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [generatingLong, setGeneratingLong] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  /** Light QA before confirm → proposal */
  const [qaProductOk, setQaProductOk] = useState(false);
  const [qaToneOk, setQaToneOk] = useState(false);
  const [qaLangOk, setQaLangOk] = useState(false);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      if (!project.lockedDesignId) {
        setErr('尚未锁定设计视觉，请先回到「选设计」');
        setPdp(null);
        setLocked(null);
        setLongUrls([]);
        return;
      }
      const designs = await pitchApi.listDesigns(project.id);
      setLocked(
        designs.find((d) => d.locked || d.id === project.lockedDesignId) || null
      );

      const res = await pitchApi.getPdp(project.id);
      setPdp(res.pdp);
      if (res.project) onProjectChange(res.project);
      if (res.narrativeChatMessage?.id) {
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', {
            detail: res.narrativeChatMessage,
          })
        );
      }
      if (res.pdp?.status === 'generating') {
        setGeneratingLong(true);
        window.dispatchEvent(
          new CustomEvent('pitchpro:long-images-generating', {
            detail: { generating: true },
          })
        );
      } else if (
        res.pdp?.status === 'ready' ||
        res.pdp?.status === 'failed'
      ) {
        setGeneratingLong(false);
      }

      const fromApi = res.longImageUrls?.filter(Boolean) || [];
      const fromContent = res.pdp
        ? parsePdpLongImages(res.pdp.content)?.urls || []
        : [];
      const urls =
        fromApi.length > 0
          ? fromApi
          : fromContent.length > 0
            ? fromContent
            : res.pdp?.fileUrl
              ? [res.pdp.fileUrl]
              : [];
      setLongUrls(urls);
      setSelectedUrl(
        res.selectedLongImageUrl ||
          parsePdpLongImages(res.pdp?.content)?.selected ||
          res.pdp?.fileUrl ||
          urls[0] ||
          ''
      );
    } catch (e: any) {
      setErr(e.message || '加载详情长图失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQaProductOk(false);
    setQaToneOk(false);
    setQaLangOk(false);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.lockedDesignId]);

  useEffect(() => {
    const onRefresh = () => {
      void load();
    };
    window.addEventListener('pitchpro:pdp-updated', onRefresh);
    return () => window.removeEventListener('pitchpro:pdp-updated', onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.lockedDesignId]);

  useEffect(() => {
    const onGen = (ev: Event) => {
      setGeneratingLong(!!(ev as CustomEvent).detail?.generating);
    };
    window.addEventListener(LONG_IMAGES_GENERATING, onGen);
    return () => window.removeEventListener(LONG_IMAGES_GENERATING, onGen);
  }, []);

  async function onSelect(url: string) {
    if (!url || url === selectedUrl) {
      setSelectedUrl(url);
      return;
    }
    setSelecting(true);
    setErr('');
    try {
      const res = await pitchApi.selectPdpLongImage(project.id, url);
      onProjectChange(res.project);
      setPdp(res.pdp);
      setSelectedUrl(url);
      const parsed = parsePdpLongImages(res.pdp.content);
      if (parsed?.urls?.length) setLongUrls(parsed.urls);
      setMsg('已选中这张长图');
    } catch (e: any) {
      setErr(e.message || '选择失败');
    } finally {
      setSelecting(false);
    }
  }

  async function onConfirm() {
    if (!selectedUrl && longUrls.length) {
      setErr('请先点选一张长图');
      return;
    }
    if (!qaProductOk || !qaToneOk || !qaLangOk) {
      setErr('请先勾选长图质量检查（产品外观 / 品牌调性 / 图上语种）后再进入产品提案');
      return;
    }
    setConfirming(true);
    setErr('');
    setMsg('');
    try {
      if (selectedUrl) {
        await pitchApi.selectPdpLongImage(project.id, selectedUrl);
      }
      const res = await pitchApi.confirmPdp(project.id);
      onProjectChange(res.project);
      emitProjectsChanged();
      setPdp(res.pdp);
      if (res.chatMessage?.id) {
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', {
            detail: res.chatMessage,
          })
        );
      }
      setMsg('叙事长图已确认，正在进入产品提案…');
      onAdvanceToAssets();
    } catch (e: any) {
      setErr(e.message || '确认失败');
    } finally {
      setConfirming(false);
    }
  }

  const structured = useMemo(
    () => parsePdpStructured(pdp?.content),
    [pdp?.content]
  );

  const phase =
    pdp?.status === 'ready' || pdp?.status === 'confirmed'
      ? 'ready'
      : 'narrative';
  // generatingLong overlays narrative UI with spinner

  const displayUrls =
    phase === 'ready'
      ? longUrls.length
        ? longUrls
        : pdp?.fileUrl
          ? [pdp.fileUrl]
          : []
      : [];

  return (
    <div className="space-y-3">
      <Card size="sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <ImageIcon className="size-3.5" />
              {generatingLong
                ? '详情长图 · 生成中'
                : phase === 'narrative'
                  ? '详情长图 · 等待叙事'
                  : '详情长图 · 对比确认'}
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {generatingLong
                ? '约 1–2 分钟'
                : phase === 'narrative'
                  ? '左对齐长图故事'
                  : '右选图确认'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-3">
          {generatingLong ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              已确认叙事，正在生成两张竖版详情长图，请稍候（约 1–2 分钟）…
            </p>
          ) : phase === 'narrative' ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              左侧「叙事师」先用文字讲清：这张竖版详情长图上会排什么（品牌世界 /
              客群场景 / 产品如何融入）。点「确认这版叙事」后，这里会出现{' '}
              <strong>两张</strong> Seedream 长图供对比。
            </p>
          ) : (
            <p className="text-muted-foreground text-xs leading-relaxed">
              叙事已确认，下方是两张详情长图（不是网页）。点选其一，再点「确认叙事长图，进入产品提案」。可点图放大。
            </p>
          )}
          {locked && (
            <div className="flex items-center gap-2 text-xs">
              <Badge className="gap-0.5 text-[10px]">
                <Lock className="size-2.5" />
                锁定视觉
              </Badge>
              <span className="truncate font-medium">{locked.title}</span>
            </div>
          )}
          {phase === 'narrative' && locked?.imageUrl ? (
            <div className="overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={locked.imageUrl}
                alt={locked.title}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          ) : null}
          {loading && (
            <p className="text-muted-foreground text-xs">加载详情状态…</p>
          )}
          {err && <p className="text-destructive text-xs">{err}</p>}
          {msg && !err && (
            <p className="text-muted-foreground text-xs">{msg}</p>
          )}
        </CardContent>
      </Card>

      {generatingLong && (
        <Card size="sm" className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 pt-4 text-xs leading-relaxed">
            <Loader2 className="text-primary mt-0.5 size-5 shrink-0 animate-spin" />
            <div className="space-y-1.5">
              <p className="text-foreground font-medium">
                正在按叙事生成两张详情长图…
              </p>
              <p className="text-muted-foreground">
                Seedream 出图通常约 <strong>1–2 分钟</strong>
                。左侧聊天也会显示进度，请稍候，不要重复点击。
              </p>
              <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
                <div className="bg-primary/70 h-full w-1/3 animate-pulse rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === 'narrative' && !loading && !generatingLong && (
        <Card size="sm" className="border-dashed">
          <CardContent className="flex items-start gap-2 pt-4 text-xs leading-relaxed">
            <Sparkles className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
            <div className="text-muted-foreground space-y-1">
              <p className="text-foreground font-medium">长图尚未生成</p>
              <p>
                先在左侧把长图叙事对齐，再点「确认这版叙事」。系统会按锁定产品 +
                叙事生成两张竖版长图。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === 'ready' && !loading && (
        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle className="text-sm">
              详情长图对比
              {structured?.headline ? (
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  {structured.headline}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            {displayUrls.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                暂无长图 URL，请回到左侧再点一次「确认这版叙事」。
              </p>
            ) : (
              <div
                className={
                  displayUrls.length > 1
                    ? 'grid grid-cols-2 gap-2'
                    : 'mx-auto max-w-[220px]'
                }
              >
                {displayUrls.map((url, i) => {
                  const selected = url === selectedUrl;
                  return (
                    <button
                      key={url + i}
                      type="button"
                      disabled={selecting}
                      onClick={() => void onSelect(url)}
                      className={`group relative overflow-hidden rounded-lg border text-left transition ${
                        selected
                          ? 'ring-primary border-primary ring-2'
                          : 'hover:border-foreground/40'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`详情长图方案 ${i + 1}`}
                        className="max-h-[420px] w-full object-cover object-top"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setLightbox(url);
                        }}
                      />
                      <div className="bg-background/90 absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 px-2 py-1.5 text-[10px]">
                        <span className="font-medium">方案 {i + 1}</span>
                        {selected ? (
                          <Badge className="gap-0.5 text-[9px]">
                            <Check className="size-2.5" />
                            已选
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">点击选用</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="bg-background/80 absolute top-1.5 right-1.5 rounded px-1.5 py-0.5 text-[10px] opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightbox(url);
                        }}
                      >
                        放大
                      </button>
                    </button>
                  );
                })}
              </div>
            )}
            {pdp && (
              <Badge variant="outline" className="text-[10px]">
                {pdp.status}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {phase === 'ready' && (
        <Card size="sm" className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="border-b py-2.5">
            <CardTitle className="text-sm">长图质量检查（进入提案前）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-3">
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              轻量勾选：确认产品外观、品牌调性、图上语种 OK
              后再进产品提案。未勾全会拦截确认。
            </p>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs">
              <Checkbox
                checked={qaProductOk}
                onCheckedChange={(v) => setQaProductOk(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">产品外观 OK</span>
                <span className="text-muted-foreground block text-[11px]">
                  产品形态、材质感、比例与锁定设计一致
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs">
              <Checkbox
                checked={qaToneOk}
                onCheckedChange={(v) => setQaToneOk(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">品牌调性 OK</span>
                <span className="text-muted-foreground block text-[11px]">
                  色调、场景、人群气质贴合品牌世界
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs">
              <Checkbox
                checked={qaLangOk}
                onCheckedChange={(v) => setQaLangOk(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">图上语种 OK</span>
                <span className="text-muted-foreground block text-[11px]">
                  可见文案符合目标市场语种（非中国市场勿留中文）
                </span>
              </span>
            </label>
            {(!qaProductOk || !qaToneOk || !qaLangOk) && (
              <p className="text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
                请勾选全部三项后再点确认。
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {phase === 'ready' && (
        <Button
          size="sm"
          className="w-full gap-1.5"
          disabled={
            confirming ||
            selecting ||
            !pdp ||
            (!selectedUrl && !pdp.fileUrl) ||
            !qaProductOk ||
            !qaToneOk ||
            !qaLangOk
          }
          onClick={onConfirm}
        >
          {confirming ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <Check className="size-3.5" />
              <ArrowRight className="size-3.5" />
            </>
          )}
          确认叙事长图，进入产品提案
        </Button>
      )}

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 sm:p-6"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal
          aria-label="详情长图放大"
        >
          {/* Full-res TOS URL; same aspect for both variants; scroll tall 1:3 strip */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="详情长图放大"
            className="my-auto h-auto w-auto max-w-[min(96vw,720px)] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
