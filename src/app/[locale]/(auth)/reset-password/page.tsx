'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { resetPassword } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
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

export default function ResetPasswordPage() {
  const t = useTranslations('common');
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const linkError = params.get('error');
    setToken(linkError ? null : tokenParam);
    setTokenChecked(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!token) {
      setError(t('sign.reset_password_missing_token'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('sign.password_mismatch'));
      return;
    }
    setLoading(true);
    try {
      const result = await resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message || 'Reset failed');
      } else {
        setSuccess(true);
        setTimeout(() => router.push('/sign-in'), 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Reset failed');
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
              {t('sign.reset_password_title')}
            </CardTitle>
            {!success && tokenChecked && token && (
              <CardDescription>
                {t('sign.reset_password_description')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!tokenChecked ? null : !token ? (
              <FieldGroup>
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-center text-sm">
                  {t('sign.reset_password_invalid_token')}
                </div>
                <Field>
                  <Link
                    href="/forgot-password"
                    className="text-center text-sm underline underline-offset-4"
                  >
                    {t('sign.forgot_password_title')}
                  </Link>
                </Field>
              </FieldGroup>
            ) : success ? (
              <FieldGroup>
                <p className="text-center text-sm">
                  {t('sign.reset_password_success')}
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
                    <FieldLabel htmlFor="password">
                      {t('sign.new_password_title')}
                    </FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder={t('sign.new_password_placeholder')}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirmPassword">
                      {t('sign.confirm_password_title')}
                    </FieldLabel>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder={t('sign.confirm_new_password_placeholder')}
                    />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={loading}>
                      {loading ? '...' : t('sign.reset_password_submit')}
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
