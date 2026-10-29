import { NextResponse } from 'next/server';

import { handleWebhook } from '@/modules/payment/service';
import { respErr, respOk } from '@/lib/resp';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  try {
    const event = await handleWebhook({ req, provider });

    console.log(`Payment event [${provider}]: ${event.eventType}`);

    // Alipay expects plain text "success"
    if (provider === 'alipay') {
      return new NextResponse('success', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // WeChat expects JSON { code, message }
    if (provider === 'wechat') {
      return NextResponse.json({ code: 'SUCCESS', message: 'OK' });
    }

    return respOk();
  } catch (error: any) {
    console.error('webhook error:', error);

    if (provider === 'alipay') {
      return new NextResponse('fail', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return respErr(error.message || 'Webhook handling failed');
  }
}
