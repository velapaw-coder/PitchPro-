'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Folder,
  Folders,
  Headphones,
  Infinity as InfinityIcon,
  Mail,
  Puzzle,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import {
  PaymentProviderModal,
  type PaymentProvider,
} from '@/components/payment-provider-modal';
import {
  PricingTable,
  type PricingGroup,
  type PricingPlan,
} from '@/components/pricing-table';

const ALL_PROVIDERS: PaymentProvider[] = [
  'stripe',
  'creem',
  'paypal',
  'alipay',
  'wechat',
];

export function Pricing({ title }: { title?: string } = {}) {
  const t = useTranslations('landing');
  const router = useRouter();
  const { data: session } = useSession();

  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PricingPlan | null>(null);
  const [loadingProvider, setLoadingProvider] =
    useState<PaymentProvider | null>(null);

  useEffect(() => {
    fetch('/api/config/public', { cache: 'no-store' })
      .then((r) => r.json())
      .then((res) => {
        if (res.code === 0) setConfigs(res.data || {});
      })
      .catch(() => {});
  }, []);

  const enabledProviders = useMemo<PaymentProvider[]>(
    () => ALL_PROVIDERS.filter((p) => configs[`${p}_enabled`] === 'true'),
    [configs]
  );

  const starterFeatures = [
    { icon: Folder, label: t('pricing.feature_1_project') },
    { icon: Sparkles, label: t('pricing.feature_5k_credits') },
    { icon: Mail, label: t('pricing.feature_email_support') },
  ];
  const proFeatures = [
    { icon: Folders, label: t('pricing.feature_unlimited_projects') },
    { icon: Sparkles, label: t('pricing.feature_50k_credits') },
    { icon: Zap, label: t('pricing.feature_priority_support') },
    { icon: Terminal, label: t('pricing.feature_api_access') },
  ];
  const enterpriseFeatures = [
    { icon: Check, label: t('pricing.feature_everything_pro') },
    { icon: InfinityIcon, label: t('pricing.feature_unlimited_credits') },
    { icon: Headphones, label: t('pricing.feature_dedicated_support') },
    { icon: Puzzle, label: t('pricing.feature_custom_integrations') },
  ];

  const groups: PricingGroup[] = [
    {
      key: 'monthly',
      label: t('pricing.monthly'),
      plans: [
        {
          id: 'starter-monthly',
          name: t('pricing.starter'),
          description: t('pricing.starter_desc'),
          price: '$9',
          interval: 'mo',
          features: starterFeatures,
          productId: 'starter_monthly',
          priceInCents: 900,
          currency: 'usd',
          credits: 5000,
          plan: { name: 'Starter', interval: 'month', intervalCount: 1 },
        },
        {
          id: 'pro-monthly',
          name: t('pricing.pro'),
          description: t('pricing.pro_desc'),
          price: '$29',
          interval: 'mo',
          featured: true,
          badge: t('pricing.popular'),
          features: proFeatures,
          productId: 'pro_monthly',
          priceInCents: 2900,
          currency: 'usd',
          credits: 50000,
          plan: { name: 'Pro', interval: 'month', intervalCount: 1 },
        },
        {
          id: 'enterprise-monthly',
          name: t('pricing.enterprise'),
          description: t('pricing.enterprise_desc'),
          price: '$99',
          interval: 'mo',
          features: enterpriseFeatures,
          productId: 'enterprise_monthly',
          priceInCents: 9900,
          currency: 'usd',
          credits: 500000,
          plan: { name: 'Enterprise', interval: 'month', intervalCount: 1 },
        },
      ],
    },
    {
      key: 'yearly',
      label: t('pricing.yearly'),
      plans: [
        {
          id: 'starter-yearly',
          name: t('pricing.starter'),
          description: t('pricing.starter_desc'),
          price: '$86',
          originalPrice: '$108',
          interval: 'yr',
          features: starterFeatures,
          productId: 'starter_yearly',
          priceInCents: 8600,
          currency: 'usd',
          credits: 60000,
          plan: { name: 'Starter', interval: 'year', intervalCount: 1 },
        },
        {
          id: 'pro-yearly',
          name: t('pricing.pro'),
          description: t('pricing.pro_desc'),
          price: '$278',
          originalPrice: '$348',
          interval: 'yr',
          featured: true,
          badge: t('pricing.popular'),
          features: proFeatures,
          productId: 'pro_yearly',
          priceInCents: 27800,
          currency: 'usd',
          credits: 600000,
          plan: { name: 'Pro', interval: 'year', intervalCount: 1 },
        },
        {
          id: 'enterprise-yearly',
          name: t('pricing.enterprise'),
          description: t('pricing.enterprise_desc'),
          price: '$950',
          originalPrice: '$1,188',
          interval: 'yr',
          features: enterpriseFeatures,
          productId: 'enterprise_yearly',
          priceInCents: 95000,
          currency: 'usd',
          credits: 6000000,
          plan: { name: 'Enterprise', interval: 'year', intervalCount: 1 },
        },
      ],
    },
    {
      key: 'lifetime',
      label: t('pricing.lifetime'),
      plans: [
        {
          id: 'starter-lifetime',
          name: t('pricing.starter'),
          description: t('pricing.starter_desc'),
          price: '$149',
          features: starterFeatures,
          productId: 'starter_lifetime',
          priceInCents: 14900,
          currency: 'usd',
          credits: 100000,
          buttonText: t('pricing.buy_lifetime'),
        },
        {
          id: 'pro-lifetime',
          name: t('pricing.pro'),
          description: t('pricing.pro_desc'),
          price: '$499',
          features: proFeatures,
          featured: true,
          badge: t('pricing.best_value'),
          productId: 'pro_lifetime',
          priceInCents: 49900,
          currency: 'usd',
          credits: 1000000,
          buttonText: t('pricing.buy_lifetime'),
        },
        {
          id: 'enterprise-lifetime',
          name: t('pricing.enterprise'),
          description: t('pricing.enterprise_desc'),
          price: '$1,999',
          features: enterpriseFeatures,
          productId: 'enterprise_lifetime',
          priceInCents: 199900,
          currency: 'usd',
          credits: 10000000,
          buttonText: t('pricing.buy_lifetime'),
        },
      ],
    },
  ];

  async function startCheckout(plan: PricingPlan, provider: PaymentProvider) {
    setLoadingProvider(provider);
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: plan.productId,
          product_name: plan.productName || plan.name,
          plan_name: plan.plan?.name || plan.name,
          price: plan.priceInCents,
          currency: plan.currency || 'usd',
          type: plan.plan ? 'subscription' : 'one-time',
          description: plan.name,
          plan: plan.plan,
          credits: plan.credits,
          credits_valid_days: plan.creditsValidDays,
          payment_provider: provider,
        }),
      });
      const data = await res.json();
      if (data.code !== 0 || !data.data?.checkout_url) {
        throw new Error(data.message || 'Checkout failed');
      }
      window.location.href = data.data.checkout_url;
    } catch (err: any) {
      toast.error(err?.message || 'Checkout failed');
      setLoadingProvider(null);
    }
  }

  async function handleCheckout(plan: PricingPlan) {
    if (!session?.user) {
      const redirect = encodeURIComponent(
        typeof window !== 'undefined' ? window.location.pathname : '/pricing'
      );
      router.push(`/sign-in?redirect=${redirect}`);
      return;
    }

    const selectEnabled = configs.select_payment_enabled === 'true';
    const defaultProvider = (configs.default_payment_provider ||
      enabledProviders[0] ||
      'stripe') as PaymentProvider;

    if (selectEnabled && enabledProviders.length > 1) {
      setPendingPlan(plan);
      setModalOpen(true);
      return;
    }

    await startCheckout(plan, defaultProvider);
  }

  function handleProviderSelect(provider: PaymentProvider) {
    if (!pendingPlan) return;
    startCheckout(pendingPlan, provider);
  }

  return (
    <section
      id="pricing"
      className="border-border border-t px-4 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-20 text-center">
          <h2 className="font-serif text-4xl font-normal tracking-tight sm:text-5xl">
            {title ?? t('pricing.title')}
          </h2>
          <p className="text-muted-foreground mt-5">
            {t('pricing.description')}
          </p>
        </div>
        <PricingTable groups={groups} onCheckout={handleCheckout} />
      </div>

      <PaymentProviderModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setPendingPlan(null);
            setLoadingProvider(null);
          }
        }}
        providers={enabledProviders.length ? enabledProviders : ['stripe']}
        loadingProvider={loadingProvider}
        onSelect={handleProviderSelect}
        planName={pendingPlan?.name}
        price={pendingPlan?.price}
      />
    </section>
  );
}
