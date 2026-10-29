'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Download,
  FileText,
  Loader2,
  MessageSquareText,
  RefreshCw,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { isLegacyThinProposalOutline } from '@/modules/pitchpro/pdp-copy';

import { pitchApi, type ApiDeliverable, type ApiProject } from './api-client';
import { emitFocusProposalChat, emitProjectsChanged } from './events';

function stripProposalStorage(content: string) {
  return (content || '')
    .replace(/<<<PROPOSAL_PDF_STORAGE[\s\S]*?PROPOSAL_PDF_STORAGE>>>/gi, '')
    .trim();
}

/** Right pane for 产品提案: outline preview + PDF download + revise + enter video. */
export function ProposalPanel({
  project,
  onProjectChange,
  onAdvanceToVideo,
}: {
  project: ApiProject;
  onProjectChange?: (p: ApiProject) => void;
  onAdvanceToVideo?: () => void;
}) {
  const [item, setItem] = useState<ApiDeliverable | null>(null);
  const [loading, setLoading] = useState(true);
  const [revising, setRevising] = useState(false);
  const [entering, setEntering] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await pitchApi.listDeliverables(project.id);
      setItem(res.items.find((d) => d.kind === 'proposal') || null);
      if (res.proposalChatMessage?.id) {
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', {
            detail: res.proposalChatMessage,
          })
        );
      }
    } catch (e: any) {
      setErr(e.message || '加载提案失败');
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
  }, [project.id]);

  const hasPdf =
    !!item?.fileUrl &&
    (item.fileUrl.startsWith('/') || /^https?:\/\//i.test(item.fileUrl));

  const outlineBody = stripProposalStorage(item?.content || '');
  const isThinOutline = item
    ? isLegacyThinProposalOutline(outlineBody)
    : false;

  async function startRevise() {
    if (revising) return;
    setRevising(true);
    setErr('');
    setMsg('');
    try {
      const res = await pitchApi.beginProposalRevise(project.id);
      if (res.project) {
        onProjectChange?.(res.project);
        emitProjectsChanged();
      }
      if (res.proposalChatMessage?.id) {
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', {
            detail: res.proposalChatMessage,
          })
        );
      }
      if (res.chatMessage?.id) {
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', {
            detail: res.chatMessage,
          })
        );
      }
      emitFocusProposalChat();
      setMsg('已回到左侧大纲。请改完后再点「确认并生成 PDF」，不会自动生成。');
      window.dispatchEvent(new CustomEvent('pitchpro:assets-changed'));
    } catch (e: any) {
      setErr(e?.message || '打开大纲失败');
    } finally {
      setRevising(false);
    }
  }

  async function enterVideo() {
    if (entering) return;
    setEntering(true);
    setErr('');
    setMsg('');
    try {
      const res = await pitchApi.advanceToVideo(project.id);
      if (res.project) {
        onProjectChange?.(res.project);
        emitProjectsChanged();
      }
      if (res.videoChatMessage?.id) {
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', {
            detail: res.videoChatMessage,
          })
        );
      }
      setMsg('已进入场景视频');
      onAdvanceToVideo?.();
      window.dispatchEvent(new CustomEvent('pitchpro:assets-changed'));
    } catch (e: any) {
      setErr(e?.message || '进入场景视频失败');
    } finally {
      setEntering(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card size="sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">产品提案 · 画册 PDF</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {item?.status || (loading ? '…' : '待生成')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            左侧对齐「呈品 ·
            提案」画册大纲后点「确认并生成 PDF」。图文穿插：封面主张 +
            概念图、品牌世界 + 叙事长图、产品概念、为何契合、工厂交付（价格
            / MOQ / 交期等，缺省「待共创确认」）、下一步。PDF
            就绪后可进入场景视频。
          </p>
          {isThinOutline && (
            <div
              role="status"
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
            >
              <p className="font-medium">
                大纲已加厚，请改大纲后重新生成 PDF
              </p>
              <p className="mt-1 opacity-90">
                当前仍像旧版 Who／Why／How
                薄模板（或缺「品牌世界／工厂交付」）。请点下方「不满意？改大纲后重新生成」，在左侧对齐厚大纲后再出 PDF。
              </p>
            </div>
          )}
          {err && <p className="text-destructive text-xs">{err}</p>}
          {msg && !err && (
            <p className="text-muted-foreground text-xs">{msg}</p>
          )}
          {loading && (
            <p className="text-muted-foreground text-xs">加载中…</p>
          )}
          {item && (
            <pre className="bg-muted/50 max-h-56 overflow-auto rounded-lg p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
              {stripProposalStorage(item.content).replace(/\[\[VISUAL:[^\]]+\]\]/g, '').slice(0, 2800)}
            </pre>
          )}
          {hasPdf ? (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                className="w-full gap-1.5"
                disabled={entering || revising}
                onClick={() => void enterVideo()}
              >
                {entering ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    进入中…
                  </>
                ) : (
                  <>
                    <ArrowRight className="size-3.5" />
                    确认提案，进入场景视频
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full gap-1.5"
                onClick={() => {
                  void (async () => {
                    try {
                      await pitchApi.openProposalPdf(project.id);
                      setMsg('已打开产品提案 PDF');
                    } catch (e: any) {
                      setErr(e?.message || '打开 PDF 失败');
                    }
                  })();
                }}
              >
                <Download className="size-3.5" />
                打开 / 下载产品提案 PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full gap-1.5"
                disabled={revising || entering}
                onClick={() => void startRevise()}
              >
                {revising ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    正在打开大纲…
                  </>
                ) : (
                  <>
                    <MessageSquareText className="size-3.5" />
                    不满意？改大纲后重新生成
                  </>
                )}
              </Button>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                改大纲会回到左侧对话框；改满意后再点「确认并生成
                PDF」覆盖，不会自动生成。满意当前 PDF
                则点上方进入场景视频。
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground flex items-start gap-1.5 text-[11px]">
              <FileText className="mt-0.5 size-3 shrink-0" />
              尚未生成 PDF。请在左侧点「确认并生成 PDF」。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
