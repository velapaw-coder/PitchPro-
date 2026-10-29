'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/core/i18n/navigation';
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Loader2,
  Search,
  Unlock,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  isDeliveryFactSatisfied,
  parseDeliveryFacts,
} from '@/modules/pitchpro/pdp-copy';

import {
  pitchApi,
  type ApiAsset,
  type ApiBrandCard,
  type ApiBrief,
  type ApiProject,
} from './api-client';
import { BrandCard } from './brand-card';
import { emitProjectsChanged } from './events';

const DELIVERY_KEYS = ['priceBand', 'moq', 'leadTime'] as const;
const DEFERRED = new Set(['本次暂无', '暂无', '暂缓', '本次暂缓', 'deferred', 'n/a-deferred']);

function parseDeliveryFromConstraints(constraints?: string) {
  const out: Record<string, string> = {};
  if (!constraints?.trim()) return out;
  for (const line of constraints.split('\n')) {
    const m = line.match(/^\s*([a-zA-Z]+)\s*[:：]\s*(.+?)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim();
    if (!(DELIVERY_KEYS as readonly string[]).includes(key as any)) continue;
    if (!val || val === '...' || val === '…') continue;
    out[key] = val;
  }
  return out;
}

function deliverySatisfied(v?: string) {
  if (!v?.trim()) return false;
  const lower = v.trim().toLowerCase();
  if (DEFERRED.has(v.trim()) || DEFERRED.has(lower)) return true;
  if (['tbd', 'n/a', '待补充', '未定', '待共创确认'].includes(lower) || ['待补充', '未定', '待共创确认'].includes(v.trim())) {
    return false;
  }
  return true;
}

export function BriefPanel({
  project,
  brief,
  searchCards,
  searchNotice,
  assetsTick = 0,
  onBriefChange,
  onProjectChange,
  onSearchCardsChange,
  onAdvanceToDesign,
  onOpenLibrary,
  onOpenShelf,
}: {
  project: ApiProject;
  brief: ApiBrief;
  searchCards: ApiBrandCard[];
  searchNotice?: string;
  assetsTick?: number;
  onBriefChange: (b: ApiBrief) => void;
  onProjectChange: (p: ApiProject) => void;
  onSearchCardsChange: (cards: ApiBrandCard[]) => void;
  onAdvanceToDesign: () => void;
  onOpenLibrary: () => void;
  onOpenShelf: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(brief);
  const [assets, setAssets] = useState<ApiAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [countryQ, setCountryQ] = useState(brief.country || '美国');
  const [trackQ, setTrackQ] = useState(brief.track || '生活方式香氛');
  /** Soft acks for soft checklist rows (tone / audience / lifestyle / packaging) */
  const [checklistAck, setChecklistAck] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setForm(brief);
    if (brief.country) setCountryQ(brief.country);
    if (brief.track) setTrackQ(brief.track);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.id, brief.status, brief.brandName, brief.goals, brief.country, brief.track, brief.audience, brief.opportunity, brief.designDirection, brief.constraints]);

  useEffect(() => {
    setChecklistAck({});
  }, [project.id]);

  useEffect(() => {
    pitchApi.listAssets().then(setAssets).catch(() => {});
  }, [project.id, assetsTick]);

  useEffect(() => {
    const onAssets = () => {
      pitchApi.listAssets().then(setAssets).catch(() => {});
    };
    window.addEventListener('pitchpro:assets-changed', onAssets);
    return () => window.removeEventListener('pitchpro:assets-changed', onAssets);
  }, []);

  function patchForm(p: Partial<ApiBrief>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function saveDraft() {
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const saved = await pitchApi.saveBrief(project.id, {
        country: form.country,
        track: form.track,
        brandName: form.brandName,
        goals: form.goals,
        constraints: form.constraints,
        audience: form.audience,
        opportunity: form.opportunity,
        designDirection: form.designDirection,
      });
      onBriefChange(saved);
      setMsg('简报已保存为草稿');
    } catch (e: any) {
      setErr(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function confirm() {
    setConfirming(true);
    setErr('');
    setMsg('');
    try {
      // Prefer latest chat-synced brief; fall back to form (微调)
      const payload = {
        country: form.country || brief.country,
        track: form.track || brief.track,
        brandName: form.brandName || brief.brandName,
        goals: form.goals || brief.goals,
        constraints: form.constraints || brief.constraints,
        audience: form.audience || brief.audience,
        opportunity: form.opportunity || brief.opportunity,
        designDirection: form.designDirection || brief.designDirection,
      };
      const result = await pitchApi.confirmBrief(project.id, payload);
      onBriefChange(result.brief);
      onProjectChange(result.project);
      emitProjectsChanged();
      setMsg('简报已确认，进入选设计');
      onAdvanceToDesign();
    } catch (e: any) {
      setErr(e.message || '确认失败');
    } finally {
      setConfirming(false);
    }
  }

  async function reopen() {
    setReopening(true);
    setErr('');
    setMsg('');
    try {
      const result = await pitchApi.reopenBrief(project.id);
      onBriefChange(result.brief);
      onProjectChange(result.project);
      setForm(result.brief);
      emitProjectsChanged();
      if (result.chatMessage) {
        window.dispatchEvent(
          new CustomEvent('pitchpro:chat-message', { detail: result.chatMessage })
        );
      }
      setMsg(
        '已解开简报确认。可改品牌调性／设计方向／人群；改完再确认。调性变了建议重生概念图、重锁视觉并重做叙事（旧图保留）。'
      );
    } catch (e: any) {
      setErr(e.message || '修正简报失败');
    } finally {
      setReopening(false);
    }
  }

  async function runSearch() {
    setSearching(true);
    setErr('');
    try {
      const res = await pitchApi.searchBrands({
        country: countryQ,
        track: trackQ,
        query: `${countryQ} ${trackQ}`,
      });
      onSearchCardsChange(res.items);
      setMsg(res.notice);
    } catch (e: any) {
      setErr(e.message || '搜索失败');
    } finally {
      setSearching(false);
    }
  }

  async function selectBrand(card: ApiBrandCard, saveToShelf: boolean) {
    setErr('');
    try {
      if (saveToShelf) {
        await pitchApi.saveShelf(card);
      }
      const res = await pitchApi.attachBrand(project.id, card, saveToShelf);
      onProjectChange(res.project);
      onBriefChange(res.brief);
      setForm((f) => ({
        ...f,
        brandName: card.name,
        country: card.country || f.country,
        track: card.track || f.track,
      }));
      setMsg(
        saveToShelf
          ? `已选择 ${card.name}，并写入私库`
          : `已选择 ${card.name} 作为本项目品牌`
      );
    } catch (e: any) {
      setErr(e.message || '操作失败');
    }
  }

  const confirmed = form.status === 'confirmed' || brief.status === 'confirmed';
  const display = {
    brandName: form.brandName || brief.brandName,
    country: form.country || brief.country,
    track: form.track || brief.track,
    goals: form.goals || brief.goals,
    audience: form.audience || brief.audience,
    opportunity: form.opportunity || brief.opportunity,
    designDirection: form.designDirection || brief.designDirection,
    constraints: form.constraints || brief.constraints,
  };
  const deliveryFacts = parseDeliveryFromConstraints(display.constraints);
  const deliveryRows: { key: string; label: string }[] = [
    { key: 'priceBand', label: '出厂价 / 价格带' },
    { key: 'moq', label: 'MOQ' },
    { key: 'leadTime', label: '大货交期' },
  ];
  const deliveryMissing = deliveryRows.filter(
    (r) => !deliverySatisfied(deliveryFacts[r.key])
  );
  const deliveryGateReady = deliveryMissing.length === 0;

  const deliveryAll = useMemo(
    () => parseDeliveryFacts(display.constraints),
    [display.constraints]
  );

  const orderChecklist = useMemo(() => {
    const toneOk =
      isDeliveryFactSatisfied(deliveryAll.brandTone) ||
      !!(display.designDirection || '').trim();
    const audienceOk = !!(display.audience || '').trim();
    const lifestyleOk =
      isDeliveryFactSatisfied(deliveryAll.lifestyleAspiration) ||
      !!(display.goals || '').trim();
    const deliveryOk =
      isDeliveryFactSatisfied(deliveryAll.priceBand) &&
      isDeliveryFactSatisfied(deliveryAll.moq) &&
      isDeliveryFactSatisfied(deliveryAll.leadTime);
    const packagingOk = isDeliveryFactSatisfied(deliveryAll.packaging);
    const retailOk = isDeliveryFactSatisfied(deliveryAll.suggestedRetail);
    return [
      {
        id: 'tone',
        label: '品牌调性',
        hint: '品牌气质、视觉语言、成为什么样的人',
        filled: toneOk,
        hard: false,
        detail: deliveryAll.brandTone || display.designDirection || '',
      },
      {
        id: 'audience',
        label: '目标人群',
        hint: '谁买、谁拍板、日常场景里的主角',
        filled: audienceOk,
        hard: false,
        detail: display.audience || '',
      },
      {
        id: 'lifestyle',
        label: '向往生活方式',
        hint: '品牌世界里的生活仪式与场景',
        filled: lifestyleOk,
        hard: false,
        detail:
          deliveryAll.lifestyleAspiration || display.goals || '',
      },
      {
        id: 'delivery',
        label: '出厂价 / MOQ / 交期',
        hint: '硬门禁：工厂出货价带、起订与交期（或「本次暂无」）',
        filled: deliveryOk,
        hard: true,
        detail: [
          deliveryAll.priceBand && `出厂 ${deliveryAll.priceBand}`,
          deliveryAll.moq && `MOQ ${deliveryAll.moq}`,
          deliveryAll.leadTime && `交期 ${deliveryAll.leadTime}`,
        ]
          .filter(Boolean)
          .join(' · '),
      },
      {
        id: 'suggestedRetail',
        label: '建议零售价',
        hint: '软项：按品牌定位给品牌看「大概能卖多少」；可「本次暂无」',
        filled: retailOk,
        hard: false,
        detail: deliveryAll.suggestedRetail || '',
      },
      {
        id: 'packaging',
        label: '包装 / 包材',
        hint: '外盒、内托、标签语言与品牌货架匹配',
        filled: packagingOk,
        hard: false,
        detail: deliveryAll.packaging || '',
      },
    ] as const;
  }, [
    deliveryAll,
    display.audience,
    display.designDirection,
    display.goals,
  ]);

  const checklistFilledCount = orderChecklist.filter((r) => r.filled).length;
  const softMissing = orderChecklist.filter((r) => !r.hard && !r.filled);
  const hardMissing = orderChecklist.filter((r) => r.hard && !r.filled);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        左侧聊天共创方案；这里只点选品牌、确认简报。字段由对话自动提炼，不必在右侧填表。
      </p>

      <Card size="sm" className="border-primary/20">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <ClipboardList className="size-3.5" />
              拿订单检查清单
            </CardTitle>
            <Badge
              variant={
                checklistFilledCount === orderChecklist.length
                  ? 'default'
                  : 'outline'
              }
              className="text-[10px]"
            >
              {checklistFilledCount}/{orderChecklist.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-3">
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            破工厂向导：按步把品牌调性、人群、向往生活、交付数字、包装聊透，后面厚提案才站得住。左侧可直接回答缺项。
          </p>
          <ul className="space-y-2">
            {orderChecklist.map((row) => {
              const ack = !!checklistAck[row.id];
              const done = row.filled || (!row.hard && ack);
              return (
                <li
                  key={row.id}
                  className={`rounded-md border px-2.5 py-2 text-xs ${
                    done
                      ? 'border-primary/30 bg-primary/5'
                      : row.hard
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {done ? (
                      <CheckCircle2 className="text-primary mt-0.5 size-3.5 shrink-0" />
                    ) : (
                      <Circle className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{row.label}</span>
                        {row.hard ? (
                          <Badge variant="outline" className="text-[9px]">
                            硬门禁
                          </Badge>
                        ) : null}
                        {row.filled ? (
                          <Badge className="text-[9px]">已从对话提炼</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">
                            待补
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        {row.hint}
                      </p>
                      {row.detail ? (
                        <p className="line-clamp-2 text-[11px] leading-relaxed">
                          {row.detail}
                        </p>
                      ) : null}
                      {!row.hard && !row.filled ? (
                        <label className="mt-1 flex cursor-pointer items-center gap-2 text-[11px]">
                          <Checkbox
                            checked={ack}
                            onCheckedChange={(v) =>
                              setChecklistAck((prev) => ({
                                ...prev,
                                [row.id]: v === true,
                              }))
                            }
                          />
                          <span>本项暂先确认（仍建议在左侧补一句）</span>
                        </label>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {hardMissing.length > 0 ? (
            <p className="text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
              硬门禁未齐：{hardMissing.map((r) => r.label).join('、')}
              。确认简报前必须在左侧聊清或写「本次暂无」。
            </p>
          ) : softMissing.length > 0 ? (
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              建议补：{softMissing.map((r) => r.label).join('、')}
              ，提案「品牌世界／包装」会更厚。
            </p>
          ) : (
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              清单已齐，可以确认简报进入选设计。
            </p>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">企业资料（上下文）</CardTitle>
            <Button size="xs" variant="outline" onClick={onOpenLibrary}>
              管理资料库
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-3">
          {assets.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              暂无资料。可在左侧上传，或点管理资料库补充工厂能力。
            </p>
          ) : (
            assets.slice(0, 4).map((a) => (
              <div key={a.id} className="rounded-md border px-2 py-1.5 text-xs">
                <div className="font-medium">{a.title}</div>
                <div className="text-muted-foreground line-clamp-1">
                  {a.textPreview}
                </div>
              </div>
            ))
          )}
          <Button size="xs" variant="ghost" onClick={onOpenShelf}>
            打开我的品牌私库
          </Button>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle className="text-sm">品牌候选（点选）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-3">
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            在左侧说「找美国香氛品牌」或粘贴官网；候选会出现在这里，点选即可。
          </p>
          <Accordion>
            <AccordionItem value="search-refine">
              <AccordionTrigger className="py-1.5 text-xs">
                手动轻搜（可选）
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pb-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">国家 / 市场</Label>
                    <Input
                      value={countryQ}
                      onChange={(e) => setCountryQ(e.target.value)}
                      placeholder="如：美国"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">赛道</Label>
                    <Input
                      value={trackQ}
                      onChange={(e) => setTrackQ(e.target.value)}
                      placeholder="如：生活方式香氛"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={runSearch}
                  disabled={searching}
                >
                  {searching ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Search className="size-3.5" />
                  )}
                  按赛道找品牌
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          {searchNotice || msg ? (
            <p className="text-muted-foreground text-[11px]">
              {searchNotice || msg}
            </p>
          ) : null}
          <div className="space-y-2">
            {searchCards.length === 0 ? (
              <p className="text-muted-foreground text-[11px]">
                暂无候选。先在左侧聊天发起轻搜。
              </p>
            ) : (
              searchCards.map((c) => (
                <BrandCard
                  key={c.id}
                  brand={c}
                  selectLabel="选用此品牌"
                  onSelect={() => selectBrand(c, true)}
                  onSaveShelf={async () => {
                    try {
                      await pitchApi.saveShelf(c);
                      setMsg(`已保存 ${c.name} 到私库`);
                    } catch (e: any) {
                      setErr(e.message);
                    }
                  }}
                  onOpenNew={async () => {
                    try {
                      const p = await pitchApi.createProject({
                        brandName: c.name,
                        country: c.country,
                        track: c.track,
                      });
                      await pitchApi.attachBrand(p.id, c, true);
                      emitProjectsChanged();
                      router.push(`/workbench/${p.id}`);
                    } catch (e: any) {
                      setErr(e.message);
                    }
                  }}
                  onDismiss={() =>
                    onSearchCardsChange(searchCards.filter((x) => x.id !== c.id))
                  }
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">设计简报（确认）</CardTitle>
            {confirmed ? (
              <Badge className="gap-1">
                <CheckCircle2 className="size-3" />
                已确认
              </Badge>
            ) : (
              <Badge variant="outline">待确认</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-3">
          <dl className="space-y-2 text-xs">
            <SummaryRow label="目标品牌" value={display.brandName} />
            <SummaryRow
              label="市场 · 赛道"
              value={[display.country, display.track].filter(Boolean).join(' · ')}
            />
            <SummaryRow label="共创目标" value={display.goals} />
            <SummaryRow label="目标受众" value={display.audience} />
            <SummaryRow label="机会点" value={display.opportunity} />
            <SummaryRow label="设计方向" value={display.designDirection} />
            <SummaryRow label="约束" value={display.constraints} />
            {deliveryRows.map((r) => (
              <SummaryRow
                key={r.key}
                label={r.label}
                value={
                  deliverySatisfied(deliveryFacts[r.key])
                    ? deliveryFacts[r.key]
                    : '（缺）请在左侧聊清或写「本次暂无」'
                }
              />
            ))}
          </dl>

          {!confirmed && !deliveryGateReady && (
            <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
              硬门禁：确认简报前需齐备价格带 / MOQ / 交期（或各项明确「本次暂无」）。缺：
              {deliveryMissing.map((r) => r.label).join('、')}。
            </p>
          )}

          {err && <p className="text-destructive text-xs">{err}</p>}
          {msg && !err && (
            <p className="text-muted-foreground text-xs">{msg}</p>
          )}

          {confirmed ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs leading-relaxed">
                简报已确认。若品牌调性／设计方向搞错了，点下方解开后可改，再重新确认进入选设计。
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1"
                onClick={reopen}
                disabled={saving || confirming || reopening}
              >
                {reopening ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Unlock className="size-3.5" />
                )}
                修正简报（改品牌调性）
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full gap-1"
              onClick={confirm}
              disabled={saving || confirming || reopening}
            >
              {confirming ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              确认简报，进入选设计
            </Button>
          )}

          <Accordion>
            <AccordionItem value="brief-tweak">
              <AccordionTrigger className="py-1.5 text-xs">
                <span className="inline-flex items-center gap-1">
                  <ChevronDown className="size-3 opacity-60" />
                  微调字段（可选）
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2.5 pb-2">
                <Field
                  label="目标品牌"
                  value={form.brandName}
                  onChange={(v) => patchForm({ brandName: v })}
                  placeholder="从左侧点选或对话提炼"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="国家 / 市场"
                    value={form.country}
                    onChange={(v) => patchForm({ country: v })}
                  />
                  <Field
                    label="赛道"
                    value={form.track}
                    onChange={(v) => patchForm({ track: v })}
                  />
                </div>
                <Field
                  label="共创目标"
                  value={form.goals}
                  onChange={(v) => patchForm({ goals: v })}
                  multiline
                />
                <Field
                  label="目标受众"
                  value={form.audience}
                  onChange={(v) => patchForm({ audience: v })}
                  multiline
                />
                <Field
                  label="机会点"
                  value={form.opportunity}
                  onChange={(v) => patchForm({ opportunity: v })}
                  multiline
                />
                <Field
                  label="设计方向"
                  value={form.designDirection}
                  onChange={(v) => patchForm({ designDirection: v })}
                  multiline
                />
                <Field
                  label="约束"
                  value={form.constraints}
                  onChange={(v) => patchForm({ constraints: v })}
                  multiline
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveDraft}
                  disabled={saving || confirming || reopening || confirmed}
                >
                  {saving ? '保存中…' : '保存草稿'}
                </Button>
                {confirmed && (
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    字段已锁定。请先点上方「修正简报」再改调性／方向。
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md border px-2.5 py-1.5">
      <dt className="text-muted-foreground text-[10px] tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">
        {value?.trim() ? value : '（对话中待补充）'}
      </dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {multiline ? (
        <textarea
          className="border-input placeholder:text-muted-foreground min-h-16 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none"
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
