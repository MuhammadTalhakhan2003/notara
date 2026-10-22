"use client";

import { api } from "./client";
import type { SourceKind } from "./types";

export interface ParsedFile {
  title: string;
  kind: SourceKind;
  content: string;
}

export const ACCEPT =
  ".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm,.rtf,.xml,.srt,.vtt,.png,.jpg,.jpeg,.webp,.gif";

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");

async function parsePdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else if (!item.str.endsWith(" ")) line += " ";
    }
    if (line.trim()) lines.push(line);
    pages.push(`--- Page ${i} ---\n${lines.join("\n").replace(/ {2,}/g, " ").trim()}`);
  }
  await doc.cleanup?.();
  return pages.join("\n\n");
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

/** Downscales large photos before sending them to Claude for transcription. */
async function imageToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.88);
  return { data: url.split(",")[1], mediaType: "image/jpeg" };
}

const htmlToText = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
  return (doc.body?.innerText ?? doc.body?.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
};

export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const title = stripExt(name);

  if (ext === "pdf" || file.type === "application/pdf") {
    const content = await parsePdf(file);
    if (content.replace(/--- Page \d+ ---/g, "").trim().length < 20)
      throw new Error(`"${name}" looks like a scanned PDF with no text layer. Upload the pages as images instead and Notara will read them.`);
    return { title, kind: "pdf", content };
  }
  if (ext === "docx") return { title, kind: "docx", content: await parseDocx(file) };
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || file.type.startsWith("image/")) {
    const { text } = await api<{ text: string }>("/api/ocr", await imageToBase64(file));
    return { title, kind: "image", content: text };
  }
  const raw = await file.text();
  if (ext === "html" || ext === "htm") return { title, kind: "text", content: htmlToText(raw) };
  if (ext === "md" || ext === "markdown") return { title, kind: "markdown", content: raw };
  return { title, kind: "text", content: raw };
}
