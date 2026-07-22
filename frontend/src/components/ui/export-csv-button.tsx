'use client';

import React from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ExportCsvButton({
  onClick,
  disabled = false,
  label = 'Export CSV',
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}): React.JSX.Element {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled} aria-label={`${label} for the current filtered list`}>
      <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

/** Right-aligned export row below filters / toolbar, above the list. */
export function ListExportRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="mt-3 flex justify-end">{children}</div>;
}
