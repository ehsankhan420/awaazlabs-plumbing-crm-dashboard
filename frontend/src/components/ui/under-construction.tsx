'use client';

import React from 'react';
import { Construction } from 'lucide-react';

import { useTranslations } from '@/i18n/locale-context';
import type { MessageKey } from '@/i18n/messages/en';
import { Card } from './card';
import { Badge } from './badge';

/**
 * Milestone-1 stub. This ships to a live Vercel deploy and a client may see it, so it must
 * read as intentional and roadmapped — not as a 404. It states the section, which spec
 * section it will implement, when it is planned, and what it will contain.
 *
 * The section title takes a `MessageKey` where one exists, so a Spanish-locale user does not
 * see "Escalamientos" in the nav and "Escalations" in the page heading. The `description`
 * stays English by design: §2.7 ships English page bodies, with Spanish as the second locale
 * target. `/agents/[slug]` has a dynamic title with no key, and passes `sectionText`.
 */
export function UnderConstruction({
  sectionKey,
  sectionText,
  specRef,
  description,
}: {
  sectionKey?: MessageKey;
  sectionText?: string;
  specRef: string;
  description: string;
}) {
  const t = useTranslations();
  const title = sectionKey ? t(sectionKey) : (sectionText ?? '');

  return (
    <Card className="mx-auto max-w-2xl">
      <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Badge variant="outline">{t('underConstruction.badge')}</Badge>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <dt className="font-medium text-foreground">{t('underConstruction.spec')}</dt>
            <dd>{specRef}</dd>
          </div>
          <div className="flex items-center justify-center gap-2">
            <dt className="font-medium text-foreground">{t('underConstruction.plannedFor')}</dt>
            <dd>{t('underConstruction.milestone2')}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
