'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Lock, RefreshCw, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import {
  pitchApi,
  type ApiDesignConcept,
  type ApiProject,
} from './api-client';
import {
  DESIGNS_GENERATING,
  emitDesignsGenerating,
  emitProjectsChanged,
} from './events';

export function DesignPanel({
  project,
  onProjectChange,
  onAdvanceToPdp,
  onDesignsReady,
}: {
  project: ApiProject;
  onProjectChange: (p: ApiProject) => void;
  onAdvanceToPdp: () => void;
  onDesignsReady?: (items: ApiDesignConcept[], source: 'load' | 'regen') => void;
}) {
  const [items, setItems] = useState<ApiDesignConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [regen, setRegen] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const announcedRef = useRef<string | null>(null);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const list = await pitchApi.listDesigns(project.id);
      setItems(list);
      const sig = list.map((c) => c.id).join(',');
      if (list.length > 0 && announcedRef.current !== sig) {
        announcedRef.current = sig;
        onDesignsReady?.(list, 'load');
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
  }, [project.id]);

  useEffect(() => {
    const onGen = (ev: Event) => {
      const generating = !!(ev as CustomEvent).detail?.generating;
      setRegen(generating);
      if (generating) {
        setMsg('正在追加一批新概念（旧图保留）…（约 1–2 分钟）');
      }
    };
    window.addEventListener(DESIGNS_GENERATING, onGen);
    return () => window.removeEventListener(DESIGNS_GENERATING, onGen);
  }, []);

  async function onRegenerate() {
    setRegen(true);
    setErr('');
    setMsg('正在追加一批新概念（旧图保留）…（约 1–2 分钟）');
    emitDesignsGenerating(true);
    try {
      const list = await pitchApi.regenerateDesigns(project.id);
      setItems(list);
      announcedRef.current = list.map((c) => c.id).join(',');
      onDesignsReady?.(list, 'regen');
      const newest = list.reduce((m, c) => Math.max(m, c.version || 0), 0);
      setMsg(
        `已追加第 ${newest} 批 4 个概念（共 ${list.length} 张，旧图保留），请在下方锁定其一`
      );
    } catch (e: any) {
      setErr(e.message || '重生失败');
      setMsg('');
    } finally {
      emitDesignsGenerating(false);
      setRegen(false);
    }
  }

  async function onLock(id: string) {
    setBusyId(id);
    setErr('');
    try {
      const res = await pitchApi.lockDesign(project.id, id);
      setItems((prev) =>
        prev.map((c) => ({ ...c, locked: c.id === id }))
      );
      onProjectChange(res.project);
      emitProjectsChanged();
      setMsg(`已锁定「${res.design.title}」，进入叙事长图 · 左侧叙事师开始讲生活方式故事`);
      if (res.chatMessage) {
        const msg = {
          ...res.chatMessage,
          attachments: Array.isArray(res.chatMessage.attachments)
            ? res.chatMessage.attachments
            : [],
        };
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', { detail: msg })
        );
      }
      window.dispatchEvent(new CustomEvent('pitchpro:pdp-updated'));
      onAdvanceToPdp();
    } catch (e: any) {
      setErr(e.message || '锁定失败');
    } finally {
      setBusyId(null);
    }
  }

  const locked = items.find((c) => c.locked);

  return (
    <div className="space-y-3">
      <Card size="sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">概念设计 · 锁定其一</CardTitle>
            <Button
              size="xs"
              variant="outline"
              className="gap-1"
              onClick={onRegenerate}
              disabled={regen || !!locked}
              title={
                locked
                  ? '已锁定，请到叙事长图继续'
                  : '追加一批新概念（旧图保留）'
              }
            >
              {regen ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              重生方向
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            左侧聊天也会展示概念图。点「锁定视觉」选一张即可；不满意可「重生方向」——会保留已有图再追加一批新的 4
            套，任意批次都可锁定。
          </p>
          {(loading || regen) && (
            <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Loader2 className="size-3 animate-spin" />
              {regen
                ? '正在追加一批新概念（旧图保留）…（约 1–2 分钟）'
                : '生成概念中…'}
            </p>
          )}
          {err && <p className="text-destructive text-xs">{err}</p>}
          {msg && !err && (
            <p className="text-muted-foreground text-xs">{msg}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((c) => {
          let palette: string[] = [];
          try {
            palette = JSON.parse(c.palette || '[]');
          } catch {
            palette = [];
          }
          return (
            <div
              key={c.id}
              className={cn(
                'bg-background overflow-hidden rounded-xl border',
                c.locked && 'ring-primary ring-2'
              )}
            >
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt={c.title}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="bg-muted flex aspect-square items-center justify-center">
                  <Sparkles className="text-muted-foreground size-8" />
                </div>
              )}
              <div className="space-y-2 p-2.5">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{c.title}</div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-[11px]">
                      <span>
                        {c.direction} · v{c.version}
                      </span>
                      {c.version > 0 && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px]">
                          第 {c.version} 批
                        </Badge>
                      )}
                    </div>
                  </div>
                  {c.locked && (
                    <Badge className="shrink-0 gap-0.5 text-[10px]">
                      <Lock className="size-2.5" />
                      已锁定
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground line-clamp-3 text-[11px] leading-relaxed">
                  {c.summary}
                </p>
                {palette.length > 0 && (
                  <div className="flex gap-1">
                    {palette.map((color) => (
                      <span
                        key={color}
                        className="border-border size-4 rounded-full border"
                        style={{ background: color }}
                        title={color}
                      />
                    ))}
                  </div>
                )}
                <Button
                  size="xs"
                  className="w-full gap-1"
                  disabled={!!busyId || c.locked}
                  onClick={() => onLock(c.id)}
                >
                  {busyId === c.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  {c.locked ? '当前锁定' : '锁定视觉，进叙事长图'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
