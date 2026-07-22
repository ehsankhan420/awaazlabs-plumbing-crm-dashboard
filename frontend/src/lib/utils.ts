import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind classes override earlier ones.
 *
 * The previous implementation was `classes.filter(Boolean).join(' ')`, which does not
 * resolve Tailwind conflicts: a caller passing `className="p-2"` to a primitive whose
 * base is `p-6` produced `"p-6 p-2"`, and the winner depended on stylesheet order rather
 * than call order. Every `className` override across the app silently lost.
 * See discovery_report.md defect D4.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
