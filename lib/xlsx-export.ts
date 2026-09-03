import * as XLSX from "xlsx";

/** Builds a single-sheet .xlsx file from plain rows (object keys become the header row). */
export function buildXlsxBuffer(sheetName: string, rows: Record<string, unknown>[]): Buffer {
  return buildXlsxWorkbook([{ name: sheetName, rows }]);
}

/** Builds a multi-sheet .xlsx file — one sheet per {name, rows} entry, in order. */
export function buildXlsxWorkbook(sheets: { name: string; rows: Record<string, unknown>[] }[]): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31)); // Excel sheet-name length cap
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function xlsxFilename(projectName: string, reportName: string): string {
  return `${reportName}_${projectName.replace(/[^a-z0-9]+/gi, "_")}.xlsx`;
}
