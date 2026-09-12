import { getTranslations } from 'next-intl/server';
import { QaidaClient } from '@/components/qaida/QaidaClient';

export async function generateMetadata() {
  const t = await getTranslations('qaida');
  return { title: t('title') };
}

/** صفحة الطالب — مسار الموارد، كما في بقية وحدات المنصّة */
export default async function QaidaPage() {
  const t = await getTranslations('qaida');
  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <header className="mb-6">
        <h1 className="font-display text-2xl">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <QaidaClient />
    </div>
  );
}
