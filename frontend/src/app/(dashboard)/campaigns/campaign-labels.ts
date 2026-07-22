/**
 * Display labels for the §14.2 campaign TYPE dimension.
 *
 * `CAMPAIGN_TYPES` lives in the (frozen) schema, but — unlike the status enums — it ships no
 * label map. These are presentation strings for a schema enum, derived as a total
 * `Record<CampaignType, string>` so a new type cannot be added without a label. This is NOT a
 * redeclaration of a status model (campaign *type* is not a status).
 */

import type { CampaignType } from '@/mock/schema';

export const CAMPAIGN_TYPE_LABELS: Readonly<Record<CampaignType, string>> = {
  reengagement: 'Reengagement',
  seasonal_maintenance: 'Seasonal maintenance',
  follow_up: 'Follow-up',
};
