'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { signOut, useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { defaultLocale } from '@/config/locale';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export default function RedeemInvitePage() {
  const t = useTranslations('common');
  const router = useRouter();
  const locale = useLocale();
  const { data: session, isPending } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Must be signed in; if no invite is actually needed, leave.
  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.push('/sign-in');
      return;
    }
    let cancelled = false;
    fetch('/api/user/info')
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (res.code === 0 && !res.data?.needsInvite) {
          router.push('/settings');
        } else {
          setChecking(false);
        }
      })
      .catch(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [isPending, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t('sign.invite_code_required'));
      return;
    }
    setLoading(true);
    try {
      const validate = await fetch('/api/invite-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      }).then((r) => r.json());
      if (validate.code !== 0) {
        setError(validate.message || t('sign.invite_code_invalid'));
        setLoading(false);
        return;
      }

      const redeem = await fetch('/api/invite-codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      }).then((r) => r.json());
      if (redeem.code !== 0) {
        setError(redeem.message || t('sign.invite_code_invalid'));
        setLoading(false);
        return;
      }

      // Hard navigation so the new plan/membership is reflected everywhere.
      const base = locale !== defaultLocale ? `/${locale}` : '';
      window.location.assign(`${base}/settings`);
    } catch (err: any) {
      setError(err?.message || t('sign.invite_code_invalid'));
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/sign-in');
  }

  if (isPending || checking) {
    return (
      <div className="bg-muted flex min-h-svh items-center justify-center">
        <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <BrandLogo href="/" className="self-center" height={36} />
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t('sign.redeem_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                {error && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                    {error}
                  </div>
                )}
                <p className="text-muted-foreground text-sm">
                  {t('sign.redeem_description')}
                </p>
                <Field>
                  <FieldLabel htmlFor="invite-code">
                    {t('sign.invite_code_title')}
                  </FieldLabel>
                  <Input
                    id="invite-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t('sign.invite_code_placeholder')}
                    required
                  />
                </Field>
                <Field>
                  <Button type="submit" disabled={loading}>
                    {loading ? '...' : t('sign.redeem_submit')}
                  </Button>
                  <FieldDescription className="text-center">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="underline underline-offset-4"
                    >
                      {t('sign.sign_out_title')}
                    </button>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
