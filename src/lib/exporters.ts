"use client";

import { blocksToHtml, parseInline, parseMarkdown, plainInline, type Block } from "./markdown";
import type {
  AudioData,
  FlashcardsData,
  MindMapData,
  QuizData,
  ReportData,
  SlidesData,
  TableData,
} from "./studio";
import { toolMeta } from "./studio";
import type { ChatMessage, Note, Source, StudioItem } from "./types";

export type ExportFormat = "pdf" | "docx" | "md" | "txt" | "pptx" | "csv" | "json" | "png" | "svg" | "html";

export const safeName = (s: string) =>
  (s || "notara").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "notara";

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const downloadText = (filename: string, text: string, type = "text/plain") =>
  downloadBlob(filename, new Blob([text], { type: `${type};charset=utf-8` }));

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (rows: string[][]) => "﻿" + rows.map((r) => r.map((c) => csvCell(c ?? "")).join(",")).join("\r\n");

// ---------------------------------------------------------------------------
// Everything becomes Markdown first; PDF/DOCX/TXT are rendered from that.

export function studioToMarkdown(item: StudioItem): string {
  const meta = toolMeta(item.type);
  const header = `# ${item.title}\n\n_${meta.label} · created with Notara_\n\n`;
  switch (meta.kind) {
    case "report": {
      const d = item.data as ReportData;
      return d.markdown.trim().startsWith("#") ? d.markdown : header + d.markdown;
    }
    case "mindmap": {
      const d = item.data as MindMapData;
      const kids = (id: string | null) => d.nodes.filter((n) => n.parent === id);
      const lines: string[] = [];
      const walk = (id: string | null, depth: number) =>
        kids(id).forEach((n) => {
          lines.push(`${"  ".repeat(depth)}- **${n.label}**${n.detail ? ` — ${n.detail}` : ""}`);
          walk(n.id, depth + 1);
        });
      walk(null, 0);
      return header + lines.join("\n");
    }
    case "flashcards": {
      const d = item.data as FlashcardsData;
      return header + d.cards.map((c, i) => `### ${i + 1}. ${c.front}\n\n${c.back}`).join("\n\n");
    }
    case "quiz": {
      const d = item.data as QuizData;
      const qs = d.questions
        .map((q, i) => `### ${i + 1}. ${q.question}\n\n${q.options.map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`).join("\n\n")}`)
        .join("\n\n");
      const key = d.questions
        .map((q, i) => `${i + 1}. **${String.fromCharCode(65 + q.answerIndex)}** — ${q.explanation}`)
        .join("\n");
      return `${header}${qs}\n\n---\n\n## Answer key\n\n${key}`;
    }
    case "audio": {
      const d = item.data as AudioData;
      return header + d.lines.map((l) => `**${d.hosts[l.speaker]?.name ?? `Host ${l.speaker + 1}`}:** ${l.text}`).join("\n\n");
    }
    case "slides": {
      const d = item.data as SlidesData;
      return (
        header +
        d.slides
          .map((s, i) => `## ${i + 1}. ${s.title}\n\n${s.bullets.map((b) => `- ${b}`).join("\n")}\n\n> Speaker notes: ${s.notes}`)
          .join("\n\n")
      );
    }
    case "table": {
      const d = item.data as TableData;
      const row = (r: string[]) => `| ${r.map((c) => (c ?? "").replace(/\|/g, "/")).join(" | ")} |`;
      return `${header}${row(d.columns)}\n| ${d.columns.map(() => "---").join(" | ")} |\n${d.rows.map(row).join("\n")}`;
    }
  }
}

export function chatToMarkdown(title: string, messages: ChatMessage[]): string {
  const parts = messages.map((m) => {
    if (m.role === "user") return `### 🙋 ${m.segments.map((s) => s.text).join("")}`;
    const cites: string[] = [];
    const body = m.segments
      .map((s) => s.text + s.citations.map((c) => {
        cites.push(`[${c.n}] ${c.sourceTitle}: "${c.text.trim().slice(0, 240)}"`);
        return ` [${c.n}]`;
      }).join(""))
      .join("");
    return `${body}${cites.length ? `\n\n**Sources**\n\n${cites.map((c) => `- ${c}`).join("\n")}` : ""}`;
  });
  return `# ${title} — chat\n\n${parts.join("\n\n---\n\n")}`;
}

export const noteToMarkdown = (n: Note) => (n.content.trim().startsWith("# ") ? n.content : `# ${n.title}\n\n${n.content}`);

export const markdownToText = (md: string) =>
  parseMarkdown(md)
    .map((b) => {
      if (b.type === "h") return `\n${plainInline(b.text).toUpperCase()}\n`;
      if (b.type === "li") return `${"  ".repeat(b.indent)}${b.ordered ? `${b.n}.` : "•"} ${plainInline(b.text)}`;
      if (b.type === "table") return b.rows.map((r) => r.map(plainInline).join("\t")).join("\n");
      if (b.type === "hr") return "----------";
      if (b.type === "quote") return `"${plainInline(b.text)}"`;
      if (b.type === "code") return b.text;
      return plainInline(b.text);
    })
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// ---------------------------------------------------------------------------
// PDF

// jsPDF's built-in fonts only cover Latin; other scripts go through the browser's print-to-PDF.
const needsSystemFonts = (s: string) => /[^\u0000-ɏ -⁯€←-⇿✓✔]/.test(s);

const PRINT_CSS = `body{font-family:Georgia,'Noto Naskh Arabic','Noto Sans',serif;max-width:760px;margin:40px auto;padding:0 24px;color:#1c1917;line-height:1.6}
h1{font-size:28px;border-bottom:3px solid #ff2d95;padding-bottom:8px}h2{font-size:21px;color:#007ba7;margin-top:28px}h3{font-size:17px}
blockquote{border-left:3px solid #8fd6ef;margin:12px 0;padding:4px 14px;color:#57534e;font-style:italic}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #d6d3d1;padding:6px 8px;text-align:start}th{background:#e3f3f9}
pre{background:#f5f5f4;padding:12px;border-radius:6px;white-space:pre-wrap}code{background:#f5f5f4;padding:1px 4px;border-radius:3px}
@media print{body{margin:0}}`;

function printHtml(title: string, html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  const rtl = /[؀-ۿ֐-׿]/.test(html);
  doc.open();
  doc.write(`<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 60_000);
  }, 300);
}

export async function markdownToPdf(filename: string, md: string) {
  if (needsSystemFonts(md)) {
    printHtml(filename, blocksToHtml(parseMarkdown(md)));
    return;
  }
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 56;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - M) {
      pdf.addPage();
      y = M;
    }
  };
  const write = (text: string, size: number, opts: { bold?: boolean; italic?: boolean; x?: number; color?: number[]; gap?: number } = {}) => {
    const x = opts.x ?? M;
    pdf.setFont("helvetica", opts.bold && opts.italic ? "bolditalic" : opts.bold ? "bold" : opts.italic ? "italic" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...((opts.color ?? [28, 25, 23]) as [number, number, number]));
    const lines = pdf.splitTextToSize(text, W - x - M) as string[];
    const lh = size * 1.45;
    for (const line of lines) {
      ensure(lh);
      pdf.text(line, x, y + size);
      y += lh;
    }
    y += opts.gap ?? size * 0.6;
  };

  const blocks: Block[] = parseMarkdown(md);
  for (const b of blocks) {
    if (b.type === "h") {
      const size = [0, 22, 17, 14, 12, 11, 11][b.level];
      y += b.level <= 2 ? 10 : 4;
      write(plainInline(b.text), size, { bold: true, color: b.level === 1 ? [10, 10, 10] : b.level === 2 ? [0, 123, 167] : [28, 25, 23] });
      if (b.level === 1) {
        pdf.setDrawColor(255, 45, 149);
        pdf.setLineWidth(2);
        pdf.line(M, y - 6, W - M, y - 6);
        y += 6;
      }
    } else if (b.type === "p") {
      const runs = parseInline(b.text);
      const allBold = runs.length === 1 && runs[0].bold;
      write(plainInline(b.text), 11, { bold: allBold });
    } else if (b.type === "li") {
      const x = M + 14 + b.indent * 16;
      const bullet = b.ordered ? `${b.n}.` : "•";
      ensure(16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text(bullet, x - 12, y + 11);
      write(plainInline(b.text), 11, { x: x + 2, gap: 3 });
    } else if (b.type === "quote") {
      write(plainInline(b.text), 11, { italic: true, x: M + 14, color: [87, 83, 78] });
    } else if (b.type === "code") {
      pdf.setFont("courier", "normal");
      write(b.text, 9.5, { x: M + 8 });
    } else if (b.type === "hr") {
      ensure(14);
      pdf.setDrawColor(214, 211, 209);
      pdf.setLineWidth(0.8);
      pdf.line(M, y + 4, W - M, y + 4);
      y += 16;
    } else if (b.type === "table") {
      for (const [i, row] of b.rows.entries()) write(row.map(plainInline).join("   |   "), 9.5, { bold: i === 0, gap: 4 });
      y += 6;
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Notara · ${i} / ${pages}`, W - M, H - 28, { align: "right" });
  }
  pdf.save(filename);
}

// ---------------------------------------------------------------------------
// DOCX

export async function markdownToDocx(filename: string, md: string) {
  const d = await import("docx");
  const runs = (text: string, extra: { bold?: boolean; italics?: boolean } = {}) =>
    parseInline(text).map(
      (r) =>
        new d.TextRun({
          text: r.text,
          bold: r.bold || extra.bold,
          italics: r.italic || extra.italics,
          font: r.code ? "Consolas" : undefined,
        }),
    );
  const headings = [d.HeadingLevel.TITLE, d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3, d.HeadingLevel.HEADING_4, d.HeadingLevel.HEADING_5];

  const children: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [];
  for (const b of parseMarkdown(md)) {
    if (b.type === "h") children.push(new d.Paragraph({ heading: headings[Math.min(b.level - 1, 5)], children: runs(b.text) }));
    else if (b.type === "p") children.push(new d.Paragraph({ children: runs(b.text), spacing: { after: 160 } }));
    else if (b.type === "li")
      children.push(
        new d.Paragraph({
          children: runs(b.text),
          ...(b.ordered ? { numbering: { reference: "num", level: Math.min(b.indent, 3) } } : { bullet: { level: Math.min(b.indent, 3) } }),
        }),
      );
    else if (b.type === "quote") children.push(new d.Paragraph({ children: runs(b.text, { italics: true }), indent: { left: 480 } }));
    else if (b.type === "code") children.push(new d.Paragraph({ children: [new d.TextRun({ text: b.text, font: "Consolas", size: 19 })] }));
    else if (b.type === "hr") children.push(new d.Paragraph({ border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: "8FD6EF", space: 4 } } }));
    else if (b.type === "table" && b.rows.length) {
      const cols = Math.max(...b.rows.map((r) => r.length));
      children.push(
        new d.Table({
          width: { size: 100, type: d.WidthType.PERCENTAGE },
          rows: b.rows.map(
            (r, i) =>
              new d.TableRow({
                tableHeader: i === 0,
                children: Array.from({ length: cols }, (_, c) =>
                  new d.TableCell({
                    shading: i === 0 ? { fill: "E3F3F9", type: d.ShadingType.CLEAR, color: "auto" } : undefined,
                    children: [new d.Paragraph({ children: runs(r[c] ?? "", { bold: i === 0 }) })],
                  }),
                ),
              }),
          ),
        }),
      );
      children.push(new d.Paragraph({}));
    }
  }

  const doc = new d.Document({
    creator: "Notara",
    numbering: {
      config: [
        {
          reference: "num",
          levels: [0, 1, 2, 3].map((level) => ({
            level,
            format: d.LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: d.AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }],
  });
  downloadBlob(filename, await d.Packer.toBlob(doc));
}

// ---------------------------------------------------------------------------
// PowerPoint

export async function slidesToPptx(filename: string, data: SlidesData) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = data.title;
  const INK = "0A0A0A";
  const ACCENT = "007BA7";

  data.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    if (i === 0) {
      slide.background = { color: INK };
      slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 3.55, w: 1.4, h: 0.08, fill: { color: "FF2D95" } });
      slide.addText(s.title, { x: 0.8, y: 1.6, w: 11.5, h: 1.8, fontSize: 40, bold: true, color: "FFFFFF", fontFace: "Georgia", valign: "bottom" });
      slide.addText(s.bullets.join("  ·  "), { x: 0.8, y: 3.85, w: 11.5, h: 1.2, fontSize: 18, color: "8FD6EF", valign: "top" });
    } else {
      slide.background = { color: "FFFFFF" };
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: ACCENT } });
      slide.addText(s.title, { x: 0.7, y: 0.45, w: 12, h: 0.9, fontSize: 30, bold: true, color: INK, fontFace: "Georgia" });
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: { code: "25CF" }, paraSpaceAfter: 12 } })),
        { x: 0.8, y: 1.55, w: 11.6, h: 5.2, fontSize: 20, color: "292524", valign: "top" },
      );
      slide.addText(`${i + 1}`, { x: 12.3, y: 6.9, w: 0.7, h: 0.4, fontSize: 11, color: "A8A29E", align: "right" });
    }
    if (s.notes) slide.addNotes(s.notes);
  });
  await pptx.writeFile({ fileName: filename });
}

// ---------------------------------------------------------------------------
// One entry point for "download this in format X"

export async function exportMarkdown(baseName: string, md: string, format: ExportFormat) {
  const base = safeName(baseName);
  if (format === "md") downloadText(`${base}.md`, md, "text/markdown");
  else if (format === "txt") downloadText(`${base}.txt`, markdownToText(md));
  else if (format === "pdf") await markdownToPdf(`${base}.pdf`, md);
  else if (format === "docx") await markdownToDocx(`${base}.docx`, md);
  else if (format === "html")
    downloadText(
      `${base}.html`,
      `<!doctype html><html><head><meta charset="utf-8"><title>${base}</title><style>${PRINT_CSS}</style></head><body>${blocksToHtml(parseMarkdown(md))}</body></html>`,
      "text/html",
    );
}

export async function exportStudioItem(item: StudioItem, format: ExportFormat) {
  const base = safeName(item.title);
  const kind = toolMeta(item.type).kind;
  if (format === "json") return downloadText(`${base}.json`, JSON.stringify(item.data, null, 2), "application/json");
  if (format === "pptx" && kind === "slides") return slidesToPptx(`${base}.pptx`, item.data as SlidesData);
  if (format === "csv") {
    if (kind === "table") {
      const d = item.data as TableData;
      return downloadText(`${base}.csv`, toCsv([d.columns, ...d.rows]), "text/csv");
    }
    if (kind === "flashcards") {
      // Two columns, no header: imports straight into Anki or Quizlet.
      const d = item.data as FlashcardsData;
      return downloadText(`${base} (Anki).csv`, toCsv(d.cards.map((c) => [c.front, c.back])), "text/csv");
    }
    if (kind === "quiz") {
      const d = item.data as QuizData;
      return downloadText(
        `${base}.csv`,
        toCsv([["Question", "A", "B", "C", "D", "Answer", "Explanation"], ...d.questions.map((q) => [q.question, ...q.options.slice(0, 4), String.fromCharCode(65 + q.answerIndex), q.explanation])]),
        "text/csv",
      );
    }
  }
  return exportMarkdown(item.title, studioToMarkdown(item), format);
}

export function formatsFor(item: StudioItem): ExportFormat[] {
  const kind = toolMeta(item.type).kind;
  const extra: Record<string, ExportFormat[]> = {
    slides: ["pptx"],
    table: ["csv"],
    flashcards: ["csv"],
    quiz: ["csv"],
    mindmap: ["png", "svg"],
  };
  return [...(extra[kind] ?? []), "pdf", "docx", "md", "txt", "html", "json"];
}

export const FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf: "PDF document",
  docx: "Word (.docx)",
  md: "Markdown (.md)",
  txt: "Plain text (.txt)",
  pptx: "PowerPoint (.pptx)",
  csv: "Spreadsheet (.csv)",
  json: "Data (.json)",
  png: "Image (.png)",
  svg: "Vector (.svg)",
  html: "Web page (.html)",
};

// ---------------------------------------------------------------------------
// Whole-notebook ZIP

export async function exportNotebookZip(
  title: string,
  data: { sources: Source[]; notes: Note[]; messages: ChatMessage[]; studio: StudioItem[]; backup: unknown },
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();
  const unique = (name: string) => {
    let n = name;
    for (let i = 2; used.has(n.toLowerCase()); i++) n = name.replace(/(\.[^.]+)$/, ` (${i})$1`);
    used.add(n.toLowerCase());
    return n;
  };
  for (const s of data.sources) zip.file(unique(`sources/${safeName(s.title)}.txt`), (s.url ? `Source: ${s.url}\n\n` : "") + s.content);
  for (const n of data.notes) zip.file(unique(`notes/${safeName(n.title)}.md`), noteToMarkdown(n));
  for (const it of data.studio.filter((i) => i.status === "ready")) {
    zip.file(unique(`studio/${safeName(it.title)}.md`), studioToMarkdown(it));
    if (it.type === "table") {
      const d = it.data as TableData;
      zip.file(unique(`studio/${safeName(it.title)}.csv`), toCsv([d.columns, ...d.rows]));
    }
  }
  if (data.messages.length) zip.file("chat.md", chatToMarkdown(title, data.messages));
  zip.file("notara-backup.json", JSON.stringify(data.backup));
  zip.file(
    "README.txt",
    `${title}\nExported from Notara on ${new Date().toLocaleString()}\n\nsources/  the text of every source\nnotes/    your notes (Markdown)\nstudio/   generated study materials\nchat.md   the full chat with citations\nnotara-backup.json  re-import this file on the Notara home page to restore the notebook\n`,
  );
  downloadBlob(`${safeName(title)}.zip`, await zip.generateAsync({ type: "blob" }));
}
