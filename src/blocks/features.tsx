import {
  Bookmark,
  FolderOpen,
  ImageIcon,
  Mail,
  MessageSquareText,
  Palette,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function Features() {
  const t = await getTranslations('landing');

  const features: { key: string; icon: LucideIcon }[] = [
    { key: 'brief', icon: MessageSquareText },
    { key: 'design', icon: Palette },
    { key: 'assets', icon: ImageIcon },
    { key: 'followup', icon: Mail },
    { key: 'brands', icon: Bookmark },
    { key: 'knowledge', icon: FolderOpen },
  ];

  return (
    <section id="features" className="px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="mb-20 text-center">
          <h2 className="font-serif text-4xl font-normal tracking-tight sm:text-5xl">
            {t('features.title')}
          </h2>
          <p className="text-muted-foreground mx-auto mt-5 max-w-lg">
            {t('features.description')}
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="group border-border bg-card hover:border-foreground/20 relative flex flex-col gap-4 rounded-2xl border p-6 transition-all hover:shadow-sm"
            >
              <div className="bg-muted text-foreground/80 group-hover:bg-foreground group-hover:text-background inline-flex size-10 items-center justify-center rounded-xl transition-colors">
                <Icon className="size-5" strokeWidth={1.75} />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">{t(`features.${key}.title`)}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(`features.${key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
