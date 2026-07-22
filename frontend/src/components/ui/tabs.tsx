'use client';

import React, { useCallback, useId, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';

type TabsValue = string;

/**
 * Hand-rolled tabs. Repairs defect D5:
 *   - `aria-selected` on a `role="button"` was invalid ARIA. Now the trigger carries
 *     `role="tab"` inside a `role="tablist"`, the panel carries `role="tabpanel"`.
 *   - Roving tabindex: the active tab is `tabIndex=0`, the rest `-1`.
 *   - Arrow-key navigation (Left/Right/Home/End) with automatic activation.
 *   - `useMemo` now lists `setValue`, which is stabilized with `useCallback`.
 *
 * Visual classes are unchanged from the original.
 */

const TabsContext = React.createContext<{
  value: TabsValue;
  setValue: (v: TabsValue) => void;
  baseId: string;
} | null>(null);

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: TabsValue;
  value?: TabsValue;
  onValueChange?: (v: TabsValue) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState<TabsValue>(defaultValue ?? '');
  const current = value ?? internal;
  const baseId = useId();

  const setValue = useCallback(
    (v: TabsValue) => {
      if (value === undefined) setInternal(v);
      onValueChange?.(v);
    },
    [value, onValueChange],
  );

  const ctx = useMemo(() => ({ value: current, setValue, baseId }), [current, setValue, baseId]);

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

function useTabsContext(component: string) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error(`${component} must be used within Tabs`);
  return ctx;
}

const tabId = (baseId: string, value: TabsValue) => `${baseId}-tab-${value}`;
const panelId = (baseId: string, value: TabsValue) => `${baseId}-panel-${value}`;

export function TabsList({
  className,
  children,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  /** Accessible name for the tablist. */
  label?: string;
}) {
  const ctx = useTabsContext('TabsList');

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;

    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
    );
    if (tabs.length === 0) return;

    const activeEl = document.activeElement as HTMLElement | null;
    const currentIndex = tabs.findIndex((t) => t === activeEl);

    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = tabs.length - 1;

    if (nextIndex < 0) return;

    e.preventDefault();
    const target = tabs[nextIndex];
    target.focus();
    const value = target.getAttribute('data-value');
    if (value !== null) ctx.setValue(value);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex w-full flex-wrap items-center gap-2', className)}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  className,
  children,
  disabled,
}: {
  value: TabsValue;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const ctx = useTabsContext('TabsTrigger');
  const active = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      id={tabId(ctx.baseId, value)}
      data-value={value}
      aria-selected={active}
      aria-controls={panelId(ctx.baseId, value)}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      onClick={() => ctx.setValue(value)}
      className={cn(
        'rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
        active ? 'bg-muted/60 border-border' : 'bg-transparent hover:bg-muted/40',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: TabsValue;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useTabsContext('TabsContent');
  if (ctx.value !== value) return null;

  return (
    <div
      role="tabpanel"
      id={panelId(ctx.baseId, value)}
      aria-labelledby={tabId(ctx.baseId, value)}
      tabIndex={0}
      className={cn(className)}
    >
      {children}
    </div>
  );
}
