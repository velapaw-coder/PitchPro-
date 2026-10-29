'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bookmark,
  Building2,
  FolderOpen,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Pencil,
  Search,
  Settings,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link, usePathname, useRouter } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

import { pitchApi, type ApiProject } from './api-client';
import { BrandShelfDialog } from './brand-shelf-dialog';
import { EnterpriseLibraryDialog } from './enterprise-library-dialog';
import { emitProjectsChanged, PROJECTS_CHANGED } from './events';
import { STAGE_FROM_STEP, stepFromStage } from './mock-sessions';
import type { SidebarViewMode, WorkbenchSession } from './types';

function projectToSession(p: ApiProject): WorkbenchSession {
  const stepId = stepFromStage(p.stage);
  return {
    id: p.id,
    brand: p.brandName,
    country: p.country || '未定',
    track: p.track || '未定赛道',
    stage: (STAGE_FROM_STEP[stepId] as WorkbenchSession['stage']) || '聊方案',
    stepId,
    pinned: p.pinned,
    note: p.note,
    updatedAt:
      typeof p.updatedAt === 'string'
        ? p.updatedAt
        : new Date(p.updatedAt).toISOString(),
  };
}

function matchesQuery(s: WorkbenchSession, q: string) {
  if (!q) return true;
  const hay = `${s.brand} ${s.country} ${s.track} ${s.note ?? ''}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function groupSessions(
  sessions: WorkbenchSession[],
  mode: SidebarViewMode
): { key: string; items: WorkbenchSession[] }[] {
  if (mode === 'recent') {
    const pinned = sessions.filter((s) => s.pinned);
    const rest = sessions
      .filter((s) => !s.pinned)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const groups: { key: string; items: WorkbenchSession[] }[] = [];
    if (pinned.length) groups.push({ key: '__pinned__', items: pinned });
    if (rest.length) groups.push({ key: '__recent__', items: rest });
    return groups;
  }

  const map = new Map<string, WorkbenchSession[]>();
  for (const s of sessions) {
    const key = mode === 'country' ? s.country : s.track;
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'zh'))
    .map(([key, items]) => ({
      key,
      items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }));
}

export function WorkbenchSidebar() {
  const t = useTranslations('workbench');
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<SidebarViewMode>('recent');
  const [sessions, setSessions] = useState<WorkbenchSession[]>([]);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const refresh = useCallback(async () => {
    try {
      const items = await pitchApi.listProjects();
      setSessions(items.map(projectToSession));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(PROJECTS_CHANGED, onChange);
    window.addEventListener('focus', onChange);
    return () => {
      window.removeEventListener(PROJECTS_CHANGED, onChange);
      window.removeEventListener('focus', onChange);
    };
  }, [refresh, pathname]);

  const filtered = useMemo(
    () => sessions.filter((s) => matchesQuery(s, query)),
    [sessions, query]
  );
  const groups = useMemo(() => groupSessions(filtered, view), [filtered, view]);

  const activeId = pathname.startsWith('/workbench/')
    ? pathname.slice('/workbench/'.length).split('/')[0]
    : null;

  async function handleNew() {
    setCreating(true);
    try {
      const p = await pitchApi.createProject({ brandName: '新项目' });
      emitProjectsChanged();
      router.push(`/workbench/${p.id}`);
    } catch {
      router.push(`/workbench/new-${Date.now().toString(36)}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleSeedDemo() {
    setSeeding(true);
    try {
      const p = await pitchApi.seedDemo();
      emitProjectsChanged();
      router.push(`/workbench/${p.id}`);
    } catch (e: any) {
      alert(e?.message || '示范种子失败');
    } finally {
      setSeeding(false);
    }
  }

  async function togglePin(s: WorkbenchSession) {
    await pitchApi.updateProject(s.id, { pinned: !s.pinned });
    emitProjectsChanged();
    await refresh();
  }

  async function commitRename(id: string) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    await pitchApi.updateProject(id, { brandName: name });
    emitProjectsChanged();
    await refresh();
  }

  async function archive(id: string) {
    if (!confirm('归档后项目将从列表隐藏，确定？')) return;
    await pitchApi.archiveProject(id);
    emitProjectsChanged();
    await refresh();
    if (activeId === id) router.push('/workbench');
  }

  async function remove(id: string) {
    if (!confirm('删除项目不可恢复（含对话与简报），确定？')) return;
    await pitchApi.deleteProject(id);
    emitProjectsChanged();
    await refresh();
    if (activeId === id) router.push('/workbench');
  }

  const viewOptions: { id: SidebarViewMode; label: string }[] = [
    { id: 'recent', label: t('view_recent') },
    { id: 'country', label: t('view_country') },
    { id: 'track', label: t('view_track') },
  ];

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex h-full w-64 shrink-0 flex-col border-r">
      <div className="flex flex-col gap-2 p-3">
        <Button
          className="w-full justify-start gap-2"
          onClick={handleNew}
          disabled={creating || seeding}
        >
          <Plus className="size-4" />
          {creating ? '创建中…' : t('new_session')}
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleSeedDemo}
          disabled={creating || seeding}
        >
          <Wand2 className="size-4" />
          {seeding ? '生成中…' : '一键示范项目'}
        </Button>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="bg-background h-8 pl-8"
          />
        </div>
        <div className="bg-muted flex rounded-lg p-0.5">
          {viewOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setView(opt.id)}
              className={cn(
                'flex-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors',
                view === opt.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {groups.length === 0 ? (
          <div className="text-muted-foreground space-y-2 px-2 py-6 text-center text-xs">
            <p>{t('no_match')}</p>
            <Button
              size="xs"
              variant="secondary"
              className="gap-1"
              disabled={seeding}
              onClick={handleSeedDemo}
            >
              <Wand2 className="size-3" />
              空列表？一键示范
            </Button>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="mb-3">
              {group.key !== '__recent__' && (
                <div className="text-muted-foreground flex items-center gap-1 px-2 py-1 text-[11px] font-medium tracking-wide uppercase">
                  {group.key === '__pinned__' ? (
                    <>
                      <Pin className="size-3" />
                      {t('pinned')}
                    </>
                  ) : (
                    group.key
                  )}
                </div>
              )}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((s) => {
                  const active = activeId === s.id;
                  return (
                    <li key={s.id} className="group/item relative">
                      {renamingId === s.id ? (
                        <div className="px-1 py-1">
                          <Input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(s.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(s.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className="h-8"
                          />
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'hover:bg-sidebar-accent flex items-start gap-1 rounded-lg pr-1 transition-colors',
                            active &&
                              'bg-sidebar-accent text-sidebar-accent-foreground'
                          )}
                        >
                          <Link
                            href={`/workbench/${s.id}`}
                            className="min-w-0 flex-1 px-2.5 py-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="truncate text-sm font-medium">
                                {s.brand}
                              </span>
                              {s.pinned && (
                                <Pin className="text-muted-foreground mt-0.5 size-3 shrink-0" />
                              )}
                            </div>
                            <div className="text-muted-foreground mt-0.5 truncate text-xs">
                              {s.country} · {s.track}
                            </div>
                            <div className="mt-1">
                              <Badge
                                variant="secondary"
                                className="h-4 text-[10px]"
                              >
                                {s.stage}
                              </Badge>
                            </div>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="text-muted-foreground hover:bg-background/60 mt-1.5 rounded-md p-1 opacity-0 group-hover/item:opacity-100 data-[popup-open]:opacity-100"
                              onClick={(e) => e.preventDefault()}
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-36">
                              <DropdownMenuItem
                                onClick={() => togglePin(s)}
                              >
                                {s.pinned ? (
                                  <PinOff className="size-4" />
                                ) : (
                                  <Pin className="size-4" />
                                )}
                                {s.pinned ? '取消置顶' : '置顶'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setRenamingId(s.id);
                                  setRenameValue(s.brand);
                                }}
                              >
                                <Pencil className="size-4" />
                                重命名
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => archive(s.id)}>
                                <Archive className="size-4" />
                                归档
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => remove(s.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="size-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <Separator />
      <div className="flex flex-col gap-0.5 p-2">
        <button
          type="button"
          onClick={() => setLibOpen(true)}
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm"
        >
          <FolderOpen className="size-4" />
          {t('enterprise_library')}
        </button>
        <button
          type="button"
          onClick={() => setShelfOpen(true)}
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm"
        >
          <Bookmark className="size-4" />
          {t('my_brands')}
        </button>
        <Link
          href="/settings"
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm"
        >
          <Settings className="size-4" />
          {t('settings')}
        </Link>
        <div className="text-muted-foreground flex items-center gap-2 px-2.5 py-1.5 text-xs">
          <Building2 className="size-3.5" />
          <span>呈品工作台</span>
        </div>
      </div>

      <EnterpriseLibraryDialog open={libOpen} onOpenChange={setLibOpen} />
      <BrandShelfDialog
        open={shelfOpen}
        onOpenChange={setShelfOpen}
        onPick={async (brand) => {
          const p = await pitchApi.createProject({
            brandName: brand.name,
            country: brand.country,
            track: brand.track,
            brandId: brand.id,
          });
          emitProjectsChanged();
          router.push(`/workbench/${p.id}`);
        }}
      />
    </aside>
  );
}
