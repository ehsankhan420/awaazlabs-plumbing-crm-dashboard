'use client';

import React from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  RECEPTIONIST_REPORT_SECTION_DEFINITIONS,
  RECEPTIONIST_REPORT_SECTIONS,
  isRawReportSection,
  type ReceptionistReportSection,
} from './report-contract';

export function ReportSectionPicker({
  selectedSections,
  hideRawSections,
  isOpen,
  onOpenChange,
  onToggle,
  onSelectAll,
  onClear,
}: {
  readonly selectedSections: readonly ReceptionistReportSection[];
  readonly hideRawSections: boolean;
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onToggle: (section: ReceptionistReportSection) => void;
  readonly onSelectAll: () => void;
  readonly onClear: () => void;
}): React.JSX.Element {
  const selected = new Set(selectedSections);
  const count = selectedSections.length;

  return (
    <section className="overflow-hidden rounded-md border border-border bg-background">
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Report fields</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {count === 0
                ? 'No fields selected'
                : `${count} selected`}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">
            {count === 0
              ? 'Choose fields'
              : `${count}/${RECEPTIONIST_REPORT_SECTION_DEFINITIONS.length}`}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </span>
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 border-t border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Choose the fields included in this Receptionist CSV.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onSelectAll}>
                  Select all
                </Button>
                <Button variant="outline" size="sm" onClick={onClear}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {RECEPTIONIST_REPORT_SECTION_DEFINITIONS.map((section) => {
                const rawDisabled = hideRawSections && isRawReportSection(section.key);
                const checked = selected.has(section.key) && !rawDisabled;
                return (
                  <label
                    key={section.key}
                    className={cn(
                      'flex min-h-[64px] cursor-pointer items-start gap-2.5 rounded-md border border-border p-2.5 text-sm transition-colors',
                      checked ? 'bg-muted/40 text-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted/20',
                      rawDisabled && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                      checked={checked}
                      disabled={rawDisabled}
                      onChange={() => onToggle(section.key)}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">{section.label}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        {section.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {count === 0 ? (
              <p className="text-sm text-destructive" role="alert">
                Select at least one report section.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function enabledReceptionistSections(hideRawSections: boolean): readonly ReceptionistReportSection[] {
  return RECEPTIONIST_REPORT_SECTIONS.filter((section) => !(hideRawSections && isRawReportSection(section)));
}
