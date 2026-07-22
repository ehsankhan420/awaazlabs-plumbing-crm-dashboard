'use client';

import { useEffect, useRef, useState } from 'react';

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  return index;
}

/**
 * Reveals `target` with a smooth typewriter effect. When disabled, returns the full string.
 * Speed adapts when the target outruns the visible text (e.g. after a live poll).
 * Live transcript corrections snap forward instead of wiping and retyping.
 */
export function useTypewriterText(
  target: string,
  enabled: boolean,
  baseCharsPerSecond = 42,
): string {
  const [visible, setVisible] = useState(enabled ? '' : target);
  const visibleRef = useRef(enabled ? '' : target);
  const targetRef = useRef(target);
  const enabledRef = useRef(enabled);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    targetRef.current = target;
    enabledRef.current = enabled;

    if (!enabled) {
      visibleRef.current = target;
      setVisible(target);
      return;
    }

    const current = visibleRef.current;
    if (target === current) return;

    if (target.startsWith(current)) {
      return;
    }

    const shared = commonPrefixLength(current, target);
    if (shared > 0) {
      const next = target.slice(0, shared);
      visibleRef.current = next;
      setVisible(next);
      return;
    }

    visibleRef.current = target;
    setVisible(target);
  }, [target, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const frame = (now: number) => {
      const currentTarget = targetRef.current;
      const currentVisible = visibleRef.current;

      if (!enabledRef.current) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      if (currentVisible.length < currentTarget.length) {
        if (lastFrameRef.current === null) lastFrameRef.current = now;
        const elapsedMs = Math.max(now - lastFrameRef.current, 16);
        lastFrameRef.current = now;

        const backlog = currentTarget.length - currentVisible.length;
        const charsPerSecond = Math.min(160, baseCharsPerSecond + backlog * 3);
        const charsToAdd = Math.max(1, Math.round((elapsedMs / 1000) * charsPerSecond));

        const next = currentTarget.slice(0, Math.min(currentVisible.length + charsToAdd, currentTarget.length));
        visibleRef.current = next;
        setVisible(next);
      } else {
        lastFrameRef.current = null;
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = null;
    };
  }, [enabled, baseCharsPerSecond]);

  return enabled ? visible : target;
}

/** Shrinks `fullText` down to empty with a backspace-style effect. */
export function useTypewriterErase(
  fullText: string,
  enabled: boolean,
  baseCharsPerSecond = 96,
): string {
  const [visible, setVisible] = useState(fullText);
  const visibleRef = useRef(fullText);
  const fullRef = useRef(fullText);
  const enabledRef = useRef(enabled);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const frozenTextRef = useRef(fullText);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      fullRef.current = fullText;
      visibleRef.current = fullText;
      setVisible(fullText);
      return;
    }

    if (frozenTextRef.current !== fullText) {
      frozenTextRef.current = fullText;
      fullRef.current = fullText;
      visibleRef.current = fullText;
      setVisible(fullText);
    }
  }, [fullText, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const frame = (now: number) => {
      const currentFull = fullRef.current;
      const currentVisible = visibleRef.current;

      if (!enabledRef.current) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      if (currentVisible.length > 0) {
        if (lastFrameRef.current === null) lastFrameRef.current = now;
        const elapsedMs = Math.max(now - lastFrameRef.current, 16);
        lastFrameRef.current = now;

        const backlog = currentVisible.length;
        const charsPerSecond = Math.min(220, baseCharsPerSecond + backlog * 4);
        const charsToRemove = Math.max(1, Math.round((elapsedMs / 1000) * charsPerSecond));

        const next = currentFull.slice(0, Math.max(currentVisible.length - charsToRemove, 0));
        visibleRef.current = next;
        setVisible(next);
      } else {
        lastFrameRef.current = null;
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = null;
    };
  }, [enabled, baseCharsPerSecond]);

  return visible;
}
