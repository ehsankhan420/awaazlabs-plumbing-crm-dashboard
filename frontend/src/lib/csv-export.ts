import { downloadCsv } from '@/app/(dashboard)/reports/csv';
import { recordClientExport } from '@/lib/audit-live';
import { canExport, type Session } from '@/mock/data-access';

/**
 * §16.1 audited CSV download. Returns an error message on failure, null on success.
 * The audit write goes to the real `audit_events` table (`recordClientExport`) — not the
 * client-only mock store — and happens before the file downloads, same ordering the backend
 * uses for `generate_report`.
 */
export async function runCsvExport(
  session: Session,
  table: string,
  rowCount: number,
  filters: Readonly<Record<string, string>>,
  filename: string,
  csv: string,
): Promise<string | null> {
  if (!canExport(session)) {
    return 'Export not permitted for this role.';
  }
  try {
    await recordClientExport(table, rowCount, filters);
    downloadCsv(filename, csv);
    return null;
  } catch {
    return 'Export failed.';
  }
}

export function filtersToParams(filters: Readonly<Record<string, string | undefined | boolean>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') continue;
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}
