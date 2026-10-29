'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Post {
  id: string;
  slug: string;
  type: string;
  title: string;
  description: string | null;
  image: string | null;
  categories: string | null;
  authorName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CategoryOption {
  id: string;
  title: string;
  slug: string;
}

const PAGE_SIZE = 10;
const TABS = ['all', 'published', 'draft'] as const;
type Tab = (typeof TABS)[number];

const emptyForm = {
  slug: '',
  title: '',
  description: '',
  content: '',
  categories: '',
  authorName: '',
  status: 'draft',
};

export default function PostsPage() {
  const t = useTranslations('admin');
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetch('/api/admin/categories?all=true')
      .then((r) => r.json())
      .then((res) => {
        if (res.code === 0) setCategoryOptions(res.data);
      });
  }, []);

  const fetchPosts = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      if (tab !== 'all') params.set('status', tab);
      if (debouncedSearch) params.set('search', debouncedSearch);
      fetch(`/api/admin/posts?${params}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.code === 0) {
            setPosts(res.data.items);
            setTotal(res.data.total);
          }
        });
    },
    [tab, debouncedSearch]
  );

  useEffect(() => {
    setPage(1);
    fetchPosts(1);
  }, [tab, debouncedSearch, fetchPosts]);
  useEffect(() => {
    fetchPosts(page);
  }, [page, fetchPosts]);

  async function handleCreate() {
    if (!form.slug.trim() || !form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.success(t('posts.created'));
        setCreateOpen(false);
        setForm(emptyForm);
        fetchPosts(page);
      } else toast.error(data.message);
    } catch {
      toast.error('Failed');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(p: Post) {
    setEditForm({
      slug: p.slug,
      title: p.title,
      description: p.description || '',
      content: '',
      categories: p.categories || '',
      authorName: p.authorName || '',
      status: p.status,
    });
    setEditingPost(p);
  }

  async function handleEdit() {
    if (!editingPost || !editForm.slug.trim() || !editForm.title.trim()) return;
    setSaving(true);
    try {
      const body: any = { id: editingPost.id, ...editForm };
      if (!body.content) delete body.content; // don't overwrite content if empty
      const res = await fetch('/api/admin/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.success(t('posts.updated'));
        setEditingPost(null);
        fetchPosts(page);
      } else toast.error(data.message);
    } catch {
      toast.error('Failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingPost) return;
    try {
      const res = await fetch(`/api/admin/posts?id=${deletingPost.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.success(t('posts.deleted'));
        setDeletingPost(null);
        fetchPosts(page);
      } else toast.error(data.message);
    } catch {
      toast.error('Failed');
    }
  }

  const statusVariant = (s: string) => {
    if (s === 'published') return 'default' as const;
    if (s === 'draft') return 'secondary' as const;
    return 'outline' as const;
  };

  const columns: Column<Post>[] = [
    {
      header: t('posts.title_col'),
      cell: (p) => <span className="font-medium">{p.title}</span>,
    },
    {
      header: t('posts.slug_col'),
      cell: (p) => <span className="font-mono text-xs">{p.slug}</span>,
    },
    { header: t('posts.author_col'), cell: (p) => p.authorName || '—' },
    {
      header: t('posts.status_col'),
      cell: (p) => <Badge variant={statusVariant(p.status)}>{p.status}</Badge>,
    },
    {
      header: t('posts.created_at'),
      cell: (p) => (
        <span className="text-muted-foreground text-sm">
          {new Date(p.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: t('posts.actions_col'),
      className: 'w-[80px]',
      cell: (p) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => openEdit(p)}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setDeletingPost(p)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ),
    },
  ];

  function renderForm(
    values: typeof emptyForm,
    onChange: (v: typeof emptyForm) => void
  ) {
    return (
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>{t('posts.slug_field')}</Label>
          <Input
            value={values.slug}
            onChange={(e) => onChange({ ...values, slug: e.target.value })}
            placeholder={t('posts.slug_placeholder')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('posts.title_field')}</Label>
          <Input
            value={values.title}
            onChange={(e) => onChange({ ...values, title: e.target.value })}
            placeholder={t('posts.title_placeholder')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('posts.description_field')}</Label>
          <Input
            value={values.description}
            onChange={(e) =>
              onChange({ ...values, description: e.target.value })
            }
            placeholder={t('posts.description_placeholder')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('posts.author_field')}</Label>
          <Input
            value={values.authorName}
            onChange={(e) =>
              onChange({ ...values, authorName: e.target.value })
            }
            placeholder={t('posts.author_placeholder')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('posts.category_field')}</Label>
          <Select
            value={values.categories}
            onValueChange={(v) => onChange({ ...values, categories: v || '' })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('posts.category_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('posts.status_field')}</Label>
          <Select
            value={values.status}
            onValueChange={(v) => onChange({ ...values, status: v || 'draft' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t('posts.status_draft')}</SelectItem>
              <SelectItem value="published">
                {t('posts.status_published')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('posts.title')}</h1>
          <p className="text-muted-foreground">{t('posts.description')}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors">
            <Plus className="size-4" />
            {t('posts.create')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('posts.create_title')}</DialogTitle>
              <DialogDescription>
                {t('posts.create_description')}
              </DialogDescription>
            </DialogHeader>
            {renderForm(form, setForm)}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {t('posts.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {t('posts.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {t(`posts.tab_${tb}`)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={posts}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(p) => p.id}
            emptyText={t('posts.no_data')}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => fetchPosts(page)}
          />
        </CardContent>
      </Card>

      <Dialog
        open={!!editingPost}
        onOpenChange={(v) => !v && setEditingPost(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('posts.edit_title')}</DialogTitle>
            <DialogDescription>{t('posts.edit_description')}</DialogDescription>
          </DialogHeader>
          {renderForm(editForm, setEditForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPost(null)}>
              {t('posts.cancel')}
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {t('posts.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingPost}
        onOpenChange={(v) => !v && setDeletingPost(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('posts.delete_title')}</DialogTitle>
            <DialogDescription>{t('posts.delete_confirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPost(null)}>
              {t('posts.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('posts.confirm_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
