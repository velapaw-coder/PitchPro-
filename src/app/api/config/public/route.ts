import { respData } from '@/lib/resp';
import { getAllConfigs, filterPublicConfigs } from '@/modules/config/service';

// Soft-cacheable: public widget IDs only. Browser + shared caches may keep briefly.
export const revalidate = 60;

const publicCache = {
  headers: {
    'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  },
};

const publicKeys = [
  'app_name',
  'app_description',
  'app_logo',
  'email_auth_enabled',
  'google_auth_enabled',
  'google_one_tap_enabled',
  'google_client_id',
  'github_auth_enabled',
  'invite_code_required',
  'select_payment_enabled',
  'default_payment_provider',
  'stripe_enabled',
  'creem_enabled',
  'paypal_enabled',
  'alipay_enabled',
  'wechat_enabled',
  'google_analytics_id',
  'plausible_domain',
  'plausible_src',
  // Widget IDs are public by design (embedded in page scripts).
  'crisp_enabled',
  'crisp_website_id',
  'tawk_enabled',
  'tawk_property_id',
  'tawk_widget_id',
];

function isEmailSendingConfigured(configs: Record<string, string>): boolean {
  const provider = configs.email_provider || 'resend';
  if (provider === 'cloudflare') {
    return (
      !!configs.cloudflare_email_api_token &&
      !!configs.cloudflare_email_account_id &&
      !!configs.cloudflare_email_sender_email
    );
  }
  return !!configs.resend_api_key && !!configs.resend_email_from;
}

export async function GET() {
  const configs = await getAllConfigs();
  const result = filterPublicConfigs(configs, publicKeys);
  const emailConfigured = isEmailSendingConfigured(configs);
  result.password_reset_enabled =
    configs.email_auth_enabled !== 'false' && emailConfigured
      ? 'true'
      : 'false';
  result.email_verification_enabled =
    configs.email_verification_enabled === 'true' && emailConfigured
      ? 'true'
      : 'false';
  result.registration_open = 'false';
  return respData(result, publicCache);
}
