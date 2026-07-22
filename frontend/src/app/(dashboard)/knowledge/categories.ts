/**
 * §15.1 display labels for the eight knowledge categories.
 *
 * `KNOWLEDGE_CATEGORIES` (the canonical set) lives in `src/mock/schema.ts`; this map only
 * supplies human-readable headings for them. It is `Record<KnowledgeCategory, string>`, so
 * it is exhaustive by construction — a new category cannot be added to the schema without a
 * label here, and a label cannot name a category that does not exist.
 */

import type { KnowledgeCategory } from '@/mock/schema';

export const KNOWLEDGE_CATEGORY_LABELS: Readonly<Record<KnowledgeCategory, string>> = {
  services_and_repairs: 'Services & repairs',
  pricing_and_fees: 'Pricing & fees',
  plumbers_and_coverage: 'Plumbers & coverage',
  hours_and_holidays: 'Business hours & holidays',
  service_areas: 'Service areas',
  faq: 'FAQ answers',
  intake_rules: 'Intake rules',
  escalation_routing: 'Escalation routing map',
};
