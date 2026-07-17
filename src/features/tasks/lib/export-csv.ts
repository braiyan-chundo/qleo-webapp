/**
 * Exportación a CSV de la vista Lista (QL-16). Util **puro y testeable**: no toca el DOM
 * salvo `downloadCsv`, que dispara la descarga. Escapa correctamente comas, comillas y
 * saltos de línea, e incluye un BOM UTF-8 para que Excel abra los acentos sin romperlos.
 */

/** BOM UTF-8: fuerza a Excel a interpretar el archivo como UTF-8 (acentos correctos). */
const UTF8_BOM = '﻿';

/** Cabeceras del CSV, en el orden en que se serializan las filas. */
export const CSV_HEADERS = [
  'Título',
  'Estado',
  'Etiqueta',
  'Responsable',
  'Email responsable',
  'Fecha límite',
  'Bloqueada',
  'Descripción',
] as const;

/** Una fila del CSV ya resuelta a texto plano (nombres, no ids). */
export interface TaskCsvRow {
  title: string;
  status: string;
  /** (QL-146) Nombre de la etiqueta de la tarea (`labels[0]`), o vacío. */
  label: string;
  assignee: string;
  assigneeEmail: string;
  dueDate: string;
  locked: string;
  description: string;
}

/**
 * Escapa un campo para CSV (RFC 4180): si contiene coma, comilla o salto de línea, se
 * envuelve en comillas dobles y las comillas internas se duplican. En otro caso se deja tal
 * cual. `null`/`undefined` → cadena vacía.
 */
export function escapeCsvField(value: string | null | undefined): string {
  const text = value ?? '';
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Serializa una fila (array de campos) escapando cada celda y uniéndolas con comas. */
function toCsvLine(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(',');
}

/**
 * Construye el contenido CSV completo (con BOM y cabecera) a partir de las filas ya
 * resueltas a texto. Las líneas se separan con CRLF (compatibilidad con Excel).
 */
export function buildTasksCsv(rows: TaskCsvRow[]): string {
  const lines = [
    toCsvLine(CSV_HEADERS),
    ...rows.map((row) =>
      toCsvLine([
        row.title,
        row.status,
        row.label,
        row.assignee,
        row.assigneeEmail,
        row.dueDate,
        row.locked,
        row.description,
      ]),
    ),
  ];
  return UTF8_BOM + lines.join('\r\n');
}

/**
 * Genera el nombre de archivo `tareas-{codigo}-{YYYY-MM-DD}.csv`. Si no hay código de
 * proyecto usa `proyecto`; sanea el código a caracteres seguros para nombre de archivo.
 */
export function buildCsvFilename(projectCode: string | undefined, date = new Date()): string {
  const safeCode = (projectCode || 'proyecto')
    .trim()
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `tareas-${safeCode || 'proyecto'}-${year}-${month}-${day}.csv`;
}

/**
 * Dispara la descarga de un CSV en el navegador vía Blob `text/csv;charset=utf-8` + un
 * `<a download>` temporal. Único punto que toca el DOM; el resto del módulo es puro.
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
