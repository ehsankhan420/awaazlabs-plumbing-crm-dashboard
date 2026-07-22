'use client';

import React, { useState } from 'react';

import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { GenerateReport } from './generate-report';
import { ScheduledReports } from './scheduled-reports';

export function ReportsClient(): React.JSX.Element {
  const [tab, setTab] = useState('generate');

  return (
    <div>
      <PageHeader
        title="Reports and Exports"
        description="Generate audited CSV reports on demand or prepare recurring scheduled reports for email delivery."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList label="Reports sections" className="mb-4">
          <TabsTrigger value="generate">Generate report</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled reports</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <GenerateReport />
        </TabsContent>
        <TabsContent value="scheduled">
          <ScheduledReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}
