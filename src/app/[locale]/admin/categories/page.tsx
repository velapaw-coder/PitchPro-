'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

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

interface Category {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
}

const PAGE_SIZE = 10;
const emptyForm = { slug: '', title: '', description: '' };

export default function CategoriesPage() {
  const t = useTranslations('admin');
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchCategories = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      fetch(`/api/admin/categories?${params}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.code === 0) {
            setCategories(res.data.items);
            setTotal(res.data.total);
          }
        });
    },
    [debouncedSearch]
  );

  useEffect(() => {
    fetchCategories(page);
  }, [page, fetchCategories]);

  async function handleCreate() {
    if (!form.slug.trim() || !form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.success(t('categories.created'));
        setCreateOpen(false);
        setForm(emptyForm);
        fetchCategories(page);
      } else toast.error(data.message);
    } catch {
      toast.error('Failed');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(c: Category) {
    setEditForm({
      slug: c.slug,
      title: c.title,
      description: c.description || '',
    });
    setEditingCat(c);
  }

  async function handleEdit() {
    if (!editingCat || !editForm.slug.trim() || !editForm.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCat.id, ...editForm }),
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.success(t('categories.updated'));
        setEditingCat(null);
        fetchCategories(page);
      } else toast.error(data.message);
    } catch {
      toast.error('Failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingCat) return;
    try {
      const res = await fetch(`/api/admin/categories?id=${deletingCat.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.success(t('categories.deleted'));
        setDeletingCat(null);
        fetchCategories(page);
      } else toast.error(data.message);
    } catch {
      toast.error('Failed');
    }
  }

  const columns: Column<Category>[] = [
    {
      header: t('categories.slug_col'),
      cell: (c) => <span className="font-mono text-sm">{c.slug}</span>,
    },
    {
      header: t('categories.title_col'),
      cell: (c) => <span className="font-medium">{c.title}</span>,
    },
    {
      header: t('categories.description_col'),
      cell: (c) => (
        <span className="text-muted-foreground block max-w-[200px] truncate text-sm">
          {c.description || '—'}
        </span>
      ),
    },
    {
      header: t('categories.status_col'),
      cell: (c) => (
        <Badge variant={c.status === 'published' ? 'default' : 'secondary'}>
          {c.status}
        </Badge>
      ),
    },
    {
      header: t('categories.created_at'),
      cell: (c) => (
        <span className="text-muted-foreground text-sm">
          {new Date(c.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: t('categories.actions_col'),
      className: 'w-[80px]',
      cell: (c) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => openEdit(c)}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setDeletingCat(c)}
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
          <Label>{t('categories.slug_field')}</Label>
          <Input
            value={values.slug}
            onChange={(e) => onChange({ ...values, slug: e.target.value })}
            placeholder={t('categories.slug_placeholder')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('categories.title_field')}</Label>
          <Input
            value={values.title}
            onChange={(e) => onChange({ ...values, title: e.target.value })}
            placeholder={t('categories.title_placeholder')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('categories.description_field')}</Label>
          <Input
            value={values.description}
            onChange={(e) =>
              onChange({ ...values, description: e.target.value })
            }
            placeholder={t('categories.description_placeholder')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('categories.title')}</h1>
          <p className="text-muted-foreground">{t('categories.description')}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors">
            <Plus className="size-4" />
            {t('categories.create')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('categories.create_title')}</DialogTitle>
              <DialogDescription>
                {t('categories.create_description')}
              </DialogDescription>
            </DialogHeader>
            {renderForm(form, setForm)}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {t('categories.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {t('categories.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={categories}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(c) => c.id}
            emptyText={t('categories.no_data')}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => fetchCategories(page)}
          />
        </CardContent>
      </Card>

      <Dialog
        open={!!editingCat}
        onOpenChange={(v) => !v && setEditingCat(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('categories.edit_title')}</DialogTitle>
            <DialogDescription>
              {t('categories.edit_description')}
            </DialogDescription>
          </DialogHeader>
          {renderForm(editForm, setEditForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCat(null)}>
              {t('categories.cancel')}
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {t('categories.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingCat}
        onOpenChange={(v) => !v && setDeletingCat(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('categories.delete_title')}</DialogTitle>
            <DialogDescription>
              {t('categories.delete_confirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingCat(null)}>
              {t('categories.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('categories.confirm_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
