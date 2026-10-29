'use client';

import { useEffect, useState } from 'react';
import { MessageSquarePlus, Sparkles, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/core/i18n/navigation';
import { Button } from '@/components/ui/button';

import { pitchApi, type ApiProject } from './api-client';
import { emitProjectsChanged } from './events';
import { STAGE_FROM_STEP, stepFromStage } from './mock-sessions';

export function WorkbenchEmptyState() {
  const t = useTranslations('workbench');
  const router = useRouter();
  const [recent, setRecent] = useState<ApiProject[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pitchApi
      .listProjects()
      .then((items) => setRecent(items.slice(0, 5)))
      .catch(() => {});
  }, []);

  async function handleNew() {
    setBusy(true);
    try {
      const p = await pitchApi.createProject({ brandName: '新项目' });
      emitProjectsChanged();
      router.push(`/workbench/${p.id}`);
    } catch {
      router.push(`/workbench/new-${Date.now().toString(36)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSeed() {
    setBusy(true);
    try {
      const p = await pitchApi.seedDemo();
      emitProjectsChanged();
      router.push(`/workbench/${p.id}`);
    } catch (e: any) {
      alert(e?.message || '示范种子失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
        <Sparkles className="size-7" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {t('empty_title')}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t('empty_desc')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="lg" className="gap-2" onClick={handleNew} disabled={busy}>
          <MessageSquarePlus className="size-4" />
          {busy ? '创建中…' : t('empty_cta')}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2"
          onClick={handleSeed}
          disabled={busy}
        >
          <Wand2 className="size-4" />
          一键示范项目
        </Button>
      </div>
      <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
        「一键示范」会生成 Aura Home 项目：已确认简报、锁定视觉并附带同源素材包，可直接体验导出与做跟进。
      </p>

      {recent.length > 0 && (
        <div className="mt-4 w-full max-w-sm text-left">
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            最近项目
          </p>
          <ul className="space-y-1">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/workbench/${s.id}`}
                  className="hover:bg-muted flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors"
                >
                  <span className="font-medium">{s.brandName}</span>
                  <span className="text-muted-foreground text-xs">
                    {STAGE_FROM_STEP[stepFromStage(s.stage)] || s.stage}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
