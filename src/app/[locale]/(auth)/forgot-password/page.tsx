'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { requestPasswordReset } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const t = useTranslations('common');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [configs, setConfigs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/config/public', { cache: 'no-store' })
      .then((r) => r.json())
      .then((res) => {
        if (res.code === 0) setConfigs(res.data);
      })
      .catch(() => {});
  }, []);

  const configsLoaded = Object.keys(configs).length > 0;
  const passwordResetEnabled = configs.password_reset_enabled === 'true';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const origin = window.location.origin;
      const localePrefix = locale && locale !== 'en' ? `/${locale}` : '';
      const redirectTo = `${origin}${localePrefix}/reset-password`;
      const result = await requestPasswordReset({ email, redirectTo });
      if (result.error) {
        setError(result.error.message || 'Request failed');
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <BrandLogo href="/" className="self-center" height={36} />
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {sent
                ? t('sign.reset_link_sent_title')
                : t('sign.forgot_password_title')}
            </CardTitle>
            {!sent && (
              <CardDescription>
                {t('sign.forgot_password_description')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {configsLoaded && !passwordResetEnabled ? (
              <FieldGroup>
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm font-medium">
                    {t('sign.password_reset_unavailable_title')}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t('sign.password_reset_unavailable_description')}
                  </p>
                </div>
                <Field>
                  <Link
                    href="/sign-in"
                    className="text-center text-sm underline underline-offset-4"
                  >
                    {t('sign.back_to_sign_in')}
                  </Link>
                </Field>
              </FieldGroup>
            ) : sent ? (
              <FieldGroup>
                <p className="text-muted-foreground text-center text-sm">
                  {t('sign.reset_link_sent_description', { email })}
                </p>
                <Field>
                  <Link
                    href="/sign-in"
                    className="text-center text-sm underline underline-offset-4"
                  >
                    {t('sign.back_to_sign_in')}
                  </Link>
                </Field>
              </FieldGroup>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  {error && (
                    <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                      {error}
                    </div>
                  )}
                  <Field>
                    <FieldLabel htmlFor="email">
                      {t('sign.email_title')}
                    </FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder={t('sign.email_placeholder')}
                    />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={loading}>
                      {loading ? '...' : t('sign.send_reset_link')}
                    </Button>
                    <FieldDescription className="text-center">
                      <Link
                        href="/sign-in"
                        className="underline underline-offset-4"
                      >
                        {t('sign.back_to_sign_in')}
                      </Link>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
