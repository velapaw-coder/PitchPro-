'use client';

import { use } from 'react';

import { WorkbenchSessionView } from '@/components/workbench';

export default function WorkbenchSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  return <WorkbenchSessionView sessionId={sessionId} />;
}
