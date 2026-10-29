'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ImageUploader, ImageUploaderValue } from '@/components/image-uploader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SettingsForm({
  name: initialName,
  email,
  image: initialImage,
}: {
  name: string;
  email: string;
  image: string;
}) {
  const t = useTranslations();
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image }),
      }).then((r) => r.json());

      if (res.code === 0) {
        toast.success(t('settings.profile.saved'));
      } else {
        toast.error(res.message || t('settings.profile.save_failed'));
      }
    } catch {
      toast.error(t('settings.profile.save_failed'));
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarChange(items: ImageUploaderValue[]) {
    const uploaded = items.find(
      (item) => item.status === 'uploaded' && item.url
    );
    setImage(uploaded?.url || '');
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('settings.profile.title')}</h1>
        <p className="text-muted-foreground">
          {t('settings.profile.description')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.profile.profile')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pb-2">
          <div className="space-y-2">
            <Label>{t('settings.profile.avatar')}</Label>
            <ImageUploader
              defaultPreviews={image ? [image] : []}
              onChange={handleAvatarChange}
              maxSizeMB={2}
              emptyHint={t('settings.profile.avatar_hint')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{t('settings.profile.name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('settings.profile.email')}</Label>
            <Input id="email" value={email} disabled className="opacity-60" />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving}>
            {saving ? t('settings.profile.saving') : t('settings.profile.save')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
