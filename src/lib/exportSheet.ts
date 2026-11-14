// ===== UTIL EKSPOR TABEL KE EXCEL (tanpa dependensi tambahan) =====
// Membuat file .xls berbasis HTML table yang bisa dibuka Excel / Google Sheets.
// Hanya berjalan di web (Vercel); di native akan menampilkan info.
import { Alert, Platform } from "react-native";

export type ExportColumn = { header: string; key: string };
export type ExportRow = Record<string, string | number | null | undefined>;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Unduh tabel sebagai file Excel (.xls).
 * @param filename nama file tanpa ekstensi
 * @param title judul yang tampil di baris pertama file
 * @param columns daftar kolom (header + key)
 * @param rows data baris
 */
export function exportExcel(
  filename: string,
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[]
) {
  if (Platform.OS !== "web") {
    Alert.alert(
      "Ekspor Excel",
      "Ekspor Excel tersedia di versi web aplikasi. Buka aplikasi melalui browser untuk mengunduh laporan."
    );
    return;
  }

  const g = globalThis as any;
  if (typeof g.document === "undefined" || typeof g.Blob === "undefined") {
    Alert.alert("Ekspor Excel", "Browser tidak mendukung unduhan file.");
    return;
  }

  const head = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => `<td>${escapeHtml(row[c.key])}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const html =
    `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" />` +
    `<style>table{border-collapse:collapse}th,td{border:1px solid #999;padding:4px 8px;font-family:Arial;font-size:11pt}` +
    `th{background:#F2EFE6;font-weight:bold}h2{font-family:Arial}</style></head><body>` +
    `<h2>${escapeHtml(title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` +
    `</body></html>`;

  const blob = new g.Blob(["\ufeff", html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = g.URL.createObjectURL(blob);
  const link = g.document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  g.document.body.appendChild(link);
  link.click();
  g.document.body.removeChild(link);
  g.setTimeout(() => g.URL.revokeObjectURL(url), 1500);
}
