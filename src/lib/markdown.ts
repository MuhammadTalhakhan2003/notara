// A small Markdown -> block model shared by the PDF, DOCX and print exporters.

export type Block =
  | { type: "h"; level: number; text: string }
  | { type: "p"; text: string }
  | { type: "li"; ordered: boolean; n: number; indent: number; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "table"; rows: string[][] }
  | { type: "hr" };

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i]);
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    let m;
    if ((m = trimmed.match(/^(#{1,6})\s+(.*)$/))) {
      flush();
      blocks.push({ type: "h", level: m[1].length, text: m[2] });
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flush();
      blocks.push({ type: "hr" });
    } else if ((m = line.match(/^(\s*)([-*+]|(\d+)[.)])\s+(.*)$/))) {
      flush();
      blocks.push({ type: "li", ordered: !!m[3], n: m[3] ? Number(m[3]) : 0, indent: Math.floor(m[1].replace(/\t/g, "  ").length / 2), text: m[4] });
    } else if (trimmed.startsWith(">")) {
      flush();
      blocks.push({ type: "quote", text: trimmed.replace(/^>\s?/, "") });
    } else if (trimmed.startsWith("|")) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      blocks.push({ type: "table", rows });
    } else {
      para.push(trimmed);
    }
  }
  flush();
  return blocks;
}

/** Splits inline Markdown into styled runs (bold, italic, code); links keep their text. */
export function parseInline(text: string): Run[] {
  const clean = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const runs: Run[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(clean))) {
    if (m.index > last) runs.push({ text: clean.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**") || tok.startsWith("__")) runs.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith("`")) runs.push({ text: tok.slice(1, -1), code: true });
    else runs.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }
  if (last < clean.length) runs.push({ text: clean.slice(last) });
  return runs;
}

export const plainInline = (text: string) => parseInline(text).map((r) => r.text).join("");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inlineHtml = (text: string) =>
  parseInline(text)
    .map((r) => {
      let t = esc(r.text);
      if (r.code) t = `<code>${t}</code>`;
      if (r.bold) t = `<strong>${t}</strong>`;
      if (r.italic) t = `<em>${t}</em>`;
      return t;
    })
    .join("");

export function blocksToHtml(blocks: Block[]): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const b of blocks) {
    if (b.type === "li") {
      const tag = b.ordered ? "ol" : "ul";
      if (list !== tag) {
        close();
        out.push(`<${tag}>`);
        list = tag;
      }
      out.push(`<li style="margin-left:${b.indent * 18}px">${inlineHtml(b.text)}</li>`);
      continue;
    }
    close();
    if (b.type === "h") out.push(`<h${b.level}>${inlineHtml(b.text)}</h${b.level}>`);
    else if (b.type === "p") out.push(`<p>${inlineHtml(b.text)}</p>`);
    else if (b.type === "quote") out.push(`<blockquote>${inlineHtml(b.text)}</blockquote>`);
    else if (b.type === "code") out.push(`<pre>${esc(b.text)}</pre>`);
    else if (b.type === "hr") out.push("<hr/>");
    else if (b.type === "table")
      out.push(
        `<table>${b.rows
          .map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${inlineHtml(c)}</th>` : `<td>${inlineHtml(c)}</td>`)).join("")}</tr>`)
          .join("")}</table>`,
      );
  }
  close();
  return out.join("\n");
}
