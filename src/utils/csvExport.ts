/**
 * Utility to export data as CSV file
 */

function escapeCSVField(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function exportToCSV(
  data: Record<string, any>[],
  columns: { key: string; header: string }[],
  filename: string
) {
  if (data.length === 0) return;

  const header = columns.map(c => escapeCSVField(c.header)).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (Array.isArray(val)) return escapeCSVField(val.join('|'));
      if (typeof val === 'object' && val !== null) return escapeCSVField(JSON.stringify(val));
      return escapeCSVField(val);
    }).join(',')
  );

  const csvContent = '\ufeff' + [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
