import { lookup } from "node:dns/promises";
import net from "node:net";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { YoutubeTranscript } from "youtube-transcript";
import { UserFacingError, errorResponse } from "@/lib/server/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Notara/1.0";

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (host === "youtube.com" || host === "music.youtube.com") {
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const m = url.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
    if (m) return m[2];
  }
  return null;
}

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
}

// Blocks requests to localhost / internal networks so the importer can't be used to probe the server's network.
async function assertPublic(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new UserFacingError("Only http and https links are supported.");
  const addrs = await lookup(url.hostname, { all: true }).catch(() => {
    throw new UserFacingError("That website could not be found.");
  });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new UserFacingError("That address is not allowed.");
}

async function safeFetch(start: URL) {
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
      signal: AbortSignal.timeout(20_000),
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url);
      continue;
    }
    return { res, url };
  }
  throw new UserFacingError("Too many redirects.");
}

async function youtube(id: string, url: URL) {
  let title = `YouTube video ${id}`;
  try {
    const meta = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (meta.ok) title = ((await meta.json()) as { title?: string }).title ?? title;
  } catch {}
  let parts;
  try {
    parts = await YoutubeTranscript.fetchTranscript(id);
  } catch {
    throw new UserFacingError("This video has no captions Notara can read. Try a video with subtitles, or paste the transcript as text.", 422);
  }
  const decode = (s: string) => s.replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;quot;|&quot;/g, '"').replace(/&amp;/g, "&");
  // Group captions into ~1 minute paragraphs with timestamps so citations are readable.
  const paras: string[] = [];
  let bucket: string[] = [];
  let bucketStart = 0;
  // The library reports ms for some caption tracks and seconds for others; caption durations tell them apart.
  const durations = parts.map((p) => p.duration).sort((a, b) => a - b);
  const inMs = (durations[Math.floor(durations.length / 2)] ?? 0) > 50;
  for (const p of parts) {
    const t = inMs ? p.offset / 1000 : p.offset;
    if (!bucket.length) bucketStart = t;
    bucket.push(decode(p.text));
    if (t - bucketStart > 60) {
      paras.push(`[${fmtTime(bucketStart)}] ${bucket.join(" ")}`);
      bucket = [];
    }
  }
  if (bucket.length) paras.push(`[${fmtTime(bucketStart)}] ${bucket.join(" ")}`);
  return { title, content: paras.join("\n\n"), kind: "youtube" as const };
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${Math.floor(m / 60) ? Math.floor(m / 60) + ":" : ""}${String(m % 60).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export async function POST(req: Request) {
  try {
    const { url: raw } = (await req.json()) as { url: string };
    let url: URL;
    try {
      url = new URL(raw.trim().match(/^https?:\/\//i) ? raw.trim() : `https://${raw.trim()}`);
    } catch {
      throw new UserFacingError("That doesn't look like a valid link.");
    }

    const yt = youtubeId(url);
    if (yt) return Response.json({ ...(await youtube(yt, url)), url: url.toString() });

    const { res, url: finalUrl } = await safeFetch(url);
    if (!res.ok) throw new UserFacingError(`The website responded with an error (${res.status}).`, 422);
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("application/pdf"))
      throw new UserFacingError("This link is a PDF. Download it and upload the file instead.", 422);

    const body = await res.text();
    if (type.startsWith("text/plain") || type.includes("markdown")) {
      return Response.json({ title: finalUrl.pathname.split("/").pop() || finalUrl.hostname, content: body.slice(0, 2_000_000), kind: "url", url: finalUrl.toString() });
    }

    const { document } = parseHTML(body);
    const article = new Readability(document as unknown as Document).parse();
    const content = (article?.textContent ?? document.body?.textContent ?? "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (content.length < 80) throw new UserFacingError("Couldn't find readable text on that page (it may need JavaScript or a login). Try copying the text and using Paste instead.", 422);

    return Response.json({
      title: article?.title?.trim() || document.title?.trim() || finalUrl.hostname,
      content,
      kind: "url",
      url: finalUrl.toString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
