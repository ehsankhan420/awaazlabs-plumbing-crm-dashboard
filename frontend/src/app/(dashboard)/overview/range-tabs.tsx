'use client';

/**
 * 7D/30D range toggle, built on the `Tabs` primitive (§4.1 / §4.5 "7D/30D toggle").
 * Controlled: it drives a parent `days` state so the chart renders once below it rather
 * than being duplicated across two tab panels.
 */

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type RangeDays = 7 | 30;

export function RangeTabs({
  value,
  onChange,
  label,
}: {
  value: RangeDays;
  onChange: (days: RangeDays) => void;
  label: string;
}): React.JSX.Element {
  return (
    <Tabs value={String(value)} onValueChange={(v) => onChange(v === '30' ? 30 : 7)}>
      <TabsList label={label} className="w-auto">
        <TabsTrigger value="7">7D</TabsTrigger>
        <TabsTrigger value="30">30D</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
