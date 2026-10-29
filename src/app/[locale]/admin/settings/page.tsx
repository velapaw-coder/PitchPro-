'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, FlaskConical, Minus, Plus, Save } from 'lucide-react';
import { useMessages, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  getSettingGroups,
  getSettings,
  getSettingTabs,
  type Setting,
} from '@/modules/config/settings';
import { getTestSpec } from '@/modules/config/settings-test-specs';
import { cn } from '@/lib/utils';
import { SettingsTestDialog } from '@/components/admin/settings-test-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function AdminSettingsPage() {
  const t = useTranslations('admin');
  const messages = useMessages() as Record<string, any>;
  const placeholders: Record<string, string> =
    messages?.admin?.settings?.placeholders || {};
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [testingGroup, setTestingGroup] = useState<string | null>(null);
  const [customRows, setCustomRows] = useState<
    { key: string; value: string }[]
  >([]);

  function toggleCollapse(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const tabs = getSettingTabs();
  const groups = getSettingGroups();
  const settings = getSettings();

  async function loadConfigs() {
    const [cfg, custom] = await Promise.all([
      fetch('/api/admin/config', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/admin/config/custom', { cache: 'no-store' }).then((r) =>
        r.json()
      ),
    ]);
    if (cfg.code === 0) setConfigs(cfg.data);
    if (custom.code === 0) setCustomRows(custom.data);
  }

  useEffect(() => {
    loadConfigs()
      .then(() => setLoaded(true))
      .catch(() => setLoaded(true));
  }, []);

  function handleChange(name: string, value: string) {
    setConfigs((prev) => ({ ...prev, [name]: value }));
  }

  function addCustomRow() {
    setCustomRows((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeCustomRow(index: number) {
    setCustomRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCustomRow(
    index: number,
    field: 'key' | 'value',
    value: string
  ) {
    setCustomRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const isCustom = activeTab === 'custom';
      const url = isCustom ? '/api/admin/config/custom' : '/api/admin/config';

      let payload: unknown;
      if (isCustom) {
        payload = {
          configs: customRows
            .map((r) => ({ key: r.key.trim(), value: r.value }))
            .filter((r) => r.key),
        };
      } else {
        const tabSettings = settings.filter((s) => s.tab === activeTab);
        const toSave: Record<string, string> = {};
        for (const s of tabSettings) {
          if (configs[s.name] !== undefined) {
            toSave[s.name] = configs[s.name];
          }
        }
        payload = toSave;
      }

      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.code === 0) {
        await loadConfigs();
        toast.success(t('settings.save_success'));
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error(t('settings.save_error'));
    } finally {
      setSaving(false);
    }
  }

  const tabGroups = groups.filter((g) => g.tab === activeTab);
  const tabSettings = settings.filter((s) => s.tab === activeTab);

  return (
    <div className="space-y-6 p-6 md:max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
          <p className="text-muted-foreground">{t('settings.description')}</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="size-4" />
          {saving ? t('settings.saving') : t('settings.save')}
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === tab.name
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {t(`settings.tabs.${tab.name}`)}
          </button>
        ))}
      </div>

      {/* Groups */}
      {!loaded ? (
        <div className="text-muted-foreground">{t('loading')}</div>
      ) : activeTab === 'custom' ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.custom.title')}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t('settings.custom.description')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {customRows.length === 0 && (
              <p className="text-muted-foreground text-sm">
                {t('settings.custom.empty')}
              </p>
            )}
            {customRows.map((row, i) => (
              <div key={i} className="flex items-start gap-2">
                <Input
                  value={row.key}
                  onChange={(e) => updateCustomRow(i, 'key', e.target.value)}
                  placeholder={t('settings.custom.key_placeholder')}
                  className="w-1/3 shrink-0 font-mono"
                />
                <textarea
                  value={row.value}
                  onChange={(e) => updateCustomRow(i, 'value', e.target.value)}
                  placeholder={t('settings.custom.value_placeholder')}
                  rows={1}
                  className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 max-h-48 min-h-8 flex-1 resize-y rounded-lg border bg-transparent px-2.5 py-1 text-base leading-6 transition-colors outline-none focus-visible:ring-3 md:text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeCustomRow(i)}
                  aria-label={t('settings.custom.remove')}
                >
                  <Minus className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={addCustomRow}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              {t('settings.custom.add')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        tabGroups.map((group) => {
          const groupSettings = tabSettings.filter(
            (s) => s.group === group.name
          );
          if (groupSettings.length === 0) return null;

          const testSpec = getTestSpec(group.name);
          return (
            <Card key={group.name}>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleCollapse(group.name)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {t(`settings.groups.${group.name}.title`)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {testSpec && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTestingGroup(group.name);
                        }}
                      >
                        <FlaskConical className="size-3.5" />
                        {t('settings.test.button')}
                      </Button>
                    )}
                    <ChevronDown
                      className={`text-muted-foreground size-5 transition-transform ${
                        collapsed.has(group.name) ? '-rotate-90' : ''
                      }`}
                    />
                  </div>
                </div>
              </CardHeader>
              {!collapsed.has(group.name) && (
                <CardContent className="space-y-4">
                  {groupSettings.map((setting) => (
                    <SettingField
                      key={setting.name}
                      setting={setting}
                      label={t(`settings.fields.${setting.name}`)}
                      placeholder={
                        placeholders[setting.name] ?? setting.placeholder
                      }
                      value={
                        configs[setting.name] ?? setting.defaultValue ?? ''
                      }
                      onChange={(v) => handleChange(setting.name, v)}
                    />
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })
      )}

      {testingGroup && getTestSpec(testingGroup) && (
        <SettingsTestDialog
          open={!!testingGroup}
          onOpenChange={(open) => !open && setTestingGroup(null)}
          group={testingGroup}
          spec={getTestSpec(testingGroup)!}
          groupTitle={t(`settings.groups.${testingGroup}.title`)}
          configOverrides={Object.fromEntries(
            settings
              .filter(
                (s) => s.group === testingGroup && configs[s.name] !== undefined
              )
              .map((s) => [s.name, configs[s.name]])
          )}
        />
      )}
    </div>
  );
}

function SettingField({
  setting,
  label,
  placeholder,
  value,
  onChange,
}: {
  setting: Setting;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (setting.type === 'switch') {
    return (
      <div className="space-y-2">
        <Label htmlFor={setting.name}>{label}</Label>
        <div>
          <Switch
            id={setting.name}
            checked={value === 'true'}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
        </div>
      </div>
    );
  }

  if (setting.type === 'select' && setting.options) {
    return (
      <div className="space-y-2">
        <Label htmlFor={setting.name}>{label}</Label>
        <Select value={value} onValueChange={(v) => onChange(v || '')}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {setting.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (setting.type === 'textarea') {
    return (
      <div className="space-y-2">
        <Label htmlFor={setting.name}>{label}</Label>
        <textarea
          id={setting.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={setting.name}>{label}</Label>
      <Input
        id={setting.name}
        type={
          setting.type === 'password'
            ? 'password'
            : setting.type === 'number'
              ? 'number'
              : 'text'
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
