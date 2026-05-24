export interface CSVHeader {
  key: string;
  label: string;
  transform?: (val: any, record: any) => any;
}

export function exportToCSV(data: any[], headers: CSVHeader[], filename: string) {
  // Generate CSV headers row
  const headerRow = headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');
  
  // Generate CSV data rows
  const dataRows = data.map(record => {
    return headers.map(h => {
      // Access deep properties if key contains dots (e.g. "userId.name")
      let value = record;
      const keys = h.key.split('.');
      for (const k of keys) {
        value = value?.[k];
      }
      
      // If there's a transform function, use it
      if (h.transform) {
        value = h.transform(value, record);
      }
      
      // Format value as string and escape double quotes
      let stringVal = '';
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          stringVal = value.join(', ');
        } else if (typeof value === 'object') {
          stringVal = JSON.stringify(value);
        } else {
          stringVal = String(value);
        }
      }
      
      return `"${stringVal.replace(/"/g, '""')}"`;
    }).join(',');
  });
  
  const csvContent = [headerRow, ...dataRows].join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
