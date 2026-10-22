// Shared types used by both the browser (IndexedDB) and the API routes.

export type SourceKind =
  | "pdf"
  | "docx"
  | "text"
  | "markdown"
  | "url"
  | "youtube"
  | "image"
  | "paste"
  | "note";

export interface SourceGuide {
  summary: string;
  topics: string[];
  questions: string[];
}

export interface Source {
  id: string;
  notebookId: string;
  title: string;
  kind: SourceKind;
  content: string;
  url?: string;
  size?: number;
  selected: boolean;
  createdAt: number;
  guide?: SourceGuide;
  guideStatus?: "pending" | "ready" | "error";
}

export interface Notebook {
  id: string;
  title: string;
  emoji: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  overview?: SourceGuide & { sourceKey: string };
}

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Citation {
  n: number;
  sourceId: string;
  sourceTitle: string;
  text: string;
}

export interface ChatSegment {
  text: string;
  citations: Citation[];
}

export interface ChatMessage {
  id: string;
  notebookId: string;
  role: "user" | "assistant";
  segments: ChatSegment[];
  createdAt: number;
  error?: string;
}

export type StudioType =
  | "audio"
  | "mindmap"
  | "study_guide"
  | "briefing"
  | "faq"
  | "timeline"
  | "flashcards"
  | "quiz"
  | "slides"
  | "table"
  | "blog"
  | "custom";

export interface StudioOptions {
  language: string;
  focus: string;
  /** short | standard | long, or easy | medium | hard for quizzes */
  level: string;
  count: number;
  customPrompt: string;
}

export interface StudioItem {
  id: string;
  notebookId: string;
  type: StudioType;
  title: string;
  status: "pending" | "ready" | "error";
  error?: string;
  // Shape depends on `type`; see StudioData in studio.ts
  data?: unknown;
  options: StudioOptions;
  sourceCount: number;
  createdAt: number;
}

/** What the browser sends to the API for each selected source. */
export interface SourcePayload {
  id: string;
  title: string;
  content: string;
}
