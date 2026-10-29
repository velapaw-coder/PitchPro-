'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, RefreshCw, Send, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  pitchApi,
  type ApiGhlHistoryItem,
  type ApiGhlOutreachEmail,
  type ApiProject,
} from './api-client';
import { emitProjectsChanged } from './events';

export function FollowupPanel({
  project,
  onProjectChange,
}: {
  project: ApiProject;
  onProjectChange: (p: ApiProject) => void;
}) {
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [configured, setConfigured] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [outreach, setOutreach] = useState<ApiGhlOutreachEmail | null>(null);
  const [history, setHistory] = useState<ApiGhlHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState<'subject' | 'body' | 'all' | ''>('');

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const data = await pitchApi.getGhl(project.id);
      setMode(data.meta.mode === 'live' ? 'live' : 'mock');
      setConfigured(!!data.meta.configured && data.meta.mode === 'live');
      setName(data.preview.contact.name);
      setEmail(data.preview.contact.email);
      setPhone(data.preview.contact.phone);
      setNote(data.preview.note);
      setAttachments(data.preview.attachmentTitles || []);
      setOutreach(data.preview.outreachEmail || null);
      setHistory(data.history || []);
    } catch (e: any) {
      setErr(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function copyText(kind: 'subject' | 'body' | 'all', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(''), 2000);
      setMsg(
        kind === 'subject'
          ? '已复制主题'
          : kind === 'body'
            ? '已复制正文'
            : '已复制完整开发信'
      );
    } catch {
      setErr('复制失败，请手动选中文本');
    }
  }

  async function onSync() {
    setSyncing(true);
    setErr('');
    setMsg('');
    try {
      const res = await pitchApi.syncGhl(project.id, {
        contactName: name,
        contactEmail: email,
        contactPhone: phone,
        note,
      });
      if (res.sync.status === 'synced') {
        if (res.sync.mode === 'live') {
          setMsg(`已同步到 GHL（Live）。联系人 ${res.sync.externalContactId}`);
        } else {
          setMsg(
            `已写入本地「预览 / Mock」记录（未调用真实 GHL）。可继续复制上方开发信外发。ID ${res.sync.externalContactId}`
          );
        }
        const fresh = await pitchApi.getProject(project.id);
        onProjectChange(fresh.project);
        emitProjectsChanged();
      } else {
        setErr(res.sync.errorMessage || '同步失败');
      }
      await load();
    } catch (e: any) {
      setErr(e.message || '同步失败');
    } finally {
      setSyncing(false);
    }
  }

  const isLive = configured && mode === 'live';

  return (
    <div className="space-y-3">
      <Card size="sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">做跟进 · 开发信 + GHL</CardTitle>
            <Badge variant={isLive ? 'default' : 'secondary'}>
              {isLive ? 'Live · 真实 GHL' : '预览 / Mock'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-3">
          {!isLive && (
            <div className="bg-muted/60 flex gap-2 rounded-lg p-2 text-[11px] leading-relaxed">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                未配置 GHL 密钥时显示「预览 / Mock」：不会假装 Live。请先复制下方开发信发给品牌；点同步仅写入本地记录。配置{' '}
                <code>GHL_API_KEY</code> / <code>GHL_LOCATION_ID</code> 后变为 Live 真同步。
              </span>
            </div>
          )}
          {loading ? (
            <p className="text-muted-foreground text-xs">加载预览…</p>
          ) : (
            <>
              {outreach && (
                <div className="space-y-2 rounded-lg border px-2.5 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium">
                      开发信（{outreach.languageName || '市场语种'}）· 可复制
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="gap-1"
                        onClick={() =>
                          void copyText('subject', outreach.subject)
                        }
                      >
                        {copied === 'subject' ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        主题
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="gap-1"
                        onClick={() => void copyText('body', outreach.body)}
                      >
                        {copied === 'body' ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        正文
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="gap-1"
                        onClick={() =>
                          void copyText('all', outreach.markdown)
                        }
                      >
                        {copied === 'all' ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        全文
                      </Button>
                    </div>
                  </div>
                  <p className="text-[11px] font-medium">
                    主题：{outreach.subject}
                  </p>
                  <pre className="bg-muted/50 max-h-48 overflow-auto rounded-md p-2 text-[10px] leading-relaxed whitespace-pre-wrap">
                    {outreach.body}
                  </pre>
                </div>
              )}

              <Field label="联系人姓名" value={name} onChange={setName} />
              <Field label="邮箱" value={email} onChange={setEmail} />
              <Field label="电话（可选）" value={phone} onChange={setPhone} />
              <div className="space-y-1">
                <Label className="text-xs">同步备注（默认同开发信）</Label>
                <textarea
                  className="border-input min-h-20 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              {attachments.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 text-[11px]">
                    将附带的素材标题
                  </p>
                  <ul className="space-y-0.5 text-xs">
                    {attachments.map((a) => (
                      <li key={a}>· {a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {err && <p className="text-destructive text-xs">{err}</p>}
          {msg && !err && (
            <p className="text-muted-foreground text-xs">{msg}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={syncing || loading}
              onClick={onSync}
            >
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {isLive ? '确认同步到 GHL' : '写入本地预览记录'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className="size-3.5" />
              刷新预览
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle className="text-sm">同步记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-3">
          {history.length === 0 && (
            <p className="text-muted-foreground text-xs">暂无同步记录</p>
          )}
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border px-2.5 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {h.contactName || h.contactEmail}
                </span>
                <Badge
                  variant={h.status === 'synced' ? 'default' : 'destructive'}
                  className="text-[10px]"
                >
                  {h.mode === 'live' ? 'Live' : '预览/Mock'}/{h.status}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 line-clamp-2">{h.note}</p>
              {h.externalContactId && (
                <p className="text-muted-foreground mt-1 text-[10px]">
                  contact={h.externalContactId}
                  {h.externalOpportunityId
                    ? ` · opp=${h.externalOpportunityId}`
                    : ''}
                </p>
              )}
              {h.errorMessage && (
                <p className="text-destructive mt-1">{h.errorMessage}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
