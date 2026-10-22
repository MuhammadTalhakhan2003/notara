import type Anthropic from "@anthropic-ai/sdk";
import { FALLBACK_BETA, MODEL, UserFacingError, errorResponse, getProvider } from "@/lib/server/anthropic";
import { GROQ_MODEL } from "@/lib/server/groq";
import { isPlus } from "@/lib/server/plus";

export const runtime = "nodejs";
export const maxDuration = 180;

interface Result {
  url: string;
  title: string;
  reason: string;
  recommended: boolean;
}

const ask = (topic: string) =>
  `Find 6-10 high-quality, readable web pages (articles, guides, reputable references, research summaries; avoid paywalls, PDFs and video pages) that would make excellent research sources about:\n\n${topic.trim()}\n\nSearch the web, then list your picks, one per line, as "URL — title — one-line reason".`;

/** Pulls "URL — title — reason" lines out of the model's answer. */
function parsePicks(text: string) {
  const picks = new Map<string, { title: string; reason: string }>();
  for (const line of text.replace(/【[^】]*】/g, "").split("\n")) {
    const m = line.match(/(https?:\/\/[^\s)\]>]+)/);
    if (!m) continue;
    const url = m[1].replace(/[.,;]+$/, "");
    const rest = line.slice(line.indexOf(m[1]) + m[1].length).replace(/\*\*/g, "").replace(/^[\s|—–:)\]-]+/, "");
    const quoted = rest.match(/^[“"](.+?)[”"]\s*[—–|:-]*\s*(.*)$/);
    const parts = quoted ? [quoted[1], quoted[2]] : rest.split(/\s+[—–|]\s+|\s+-{1,2}\s+/);
    picks.set(url, { title: (parts[0] ?? "").trim(), reason: parts.slice(1).join(" — ").replace(/^[\s—–|-]+/, "").trim() });
  }
  return picks;
}

// "Discover sources": the model searches the web for good sources on a topic; the user picks which to import.
export async function POST(req: Request) {
  try {
    const { topic } = (await req.json()) as { topic: string };
    if (!isPlus(req)) throw new UserFacingError("Web Discover is a Notara Plus feature. Upgrade to search the web for sources.", 402);
    if (!topic?.trim()) throw new UserFacingError("Describe what you want to research.");
    const provider = getProvider(req);
    let results: Result[];

    if (provider.kind === "groq") {
      const res = await provider.client.chat.completions.create(
        {
          model: GROQ_MODEL,
          max_completion_tokens: 2000,
          reasoning_effort: "low",
          tools: [{ type: "browser_search" }],
          messages: [{ role: "user", content: ask(topic) }],
        },
        { signal: req.signal },
      );
      const picks = parsePicks(res.choices[0]?.message?.content ?? "");
      results = [...picks].map(([url, p]) => ({ url, title: p.title || new URL(url).hostname, reason: p.reason, recommended: true }));
    } else {
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: ask(topic) }];
      const seen = new Map<string, { url: string; title: string }>();
      let text = "";
      // Server tools can pause a long turn; resume a couple of times if needed.
      for (let i = 0; i < 3; i++) {
        const response = await provider.client.beta.messages.create(
          {
            model: MODEL,
            max_tokens: 8000,
            betas: [FALLBACK_BETA],
            fallbacks: "default",
            output_config: { effort: "low" },
            tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
            messages,
          },
          { signal: req.signal },
        );
        for (const block of response.content) {
          if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
            for (const r of block.content) {
              if (r.type === "web_search_result" && !seen.has(r.url)) seen.set(r.url, { url: r.url, title: r.title });
            }
          } else if (block.type === "text") {
            text += block.text;
          }
        }
        if (response.stop_reason !== "pause_turn") break;
        messages.push({ role: "assistant", content: response.content });
      }
      // Prefer the pages Claude recommended, then the rest of what it saw.
      const picks = parsePicks(text);
      const all = [...seen.values()];
      const chosen = all.filter((r) => picks.has(r.url));
      results = [...chosen, ...all.filter((r) => !chosen.includes(r))].map((r) => ({
        ...r,
        reason: picks.get(r.url)?.reason ?? "",
        recommended: chosen.includes(r),
      }));
    }

    results = results.filter((r) => /^https?:\/\//.test(r.url)).slice(0, 12);
    if (!results.length) throw new UserFacingError("No web results came back. Try wording the topic differently.", 404);
    return Response.json({ results });
  } catch (err) {
    return errorResponse(err);
  }
}
