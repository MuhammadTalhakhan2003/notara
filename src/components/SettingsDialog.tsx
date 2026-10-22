"use client";

import { useEffect, useState } from "react";
import { prefs } from "@/lib/client";
import { LANGUAGES } from "@/lib/studio";
import { Button, Field, Modal, inputCls, toast } from "./ui";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [key, setKey] = useState("");
  const [language, setLanguage] = useState("English");

  useEffect(() => {
    if (!open) return;
    setKey(prefs.get("apiKey"));
    setLanguage(prefs.get("language", "English"));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="space-y-5 p-5">
        <Field label="Default output language" hint="Chat answers and Studio outputs use this language unless you change it.">
          <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field
          label="Your own AI key (optional)"
          hint="Paste a Claude key (sk-ant-…) or a free Groq key (gsk_…). Leave empty to use the server's key. It is stored only in this browser."
        >
          <input
            className={inputCls}
            type="password"
            autoComplete="off"
            placeholder="sk-ant-… or gsk_…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </Field>
        <p className="rounded-2xl bg-accent-soft/60 p-3.5 text-xs leading-relaxed text-muted">
          Your notebooks, sources and notes are saved in this browser (IndexedDB). Nothing is stored on a server.
          Use <b>Export → Backup</b> in a notebook to move it to another device.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              prefs.set("apiKey", key.trim());
              prefs.set("language", language === "English" ? "" : language);
              toast("Settings saved");
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
