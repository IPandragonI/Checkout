"use client";

import { ChevronRight, Database, Download, Gamepad2, Info, Moon, SlidersHorizontal, Sun, Target, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AccountStatusCard } from "@/components/ui/AccountPrompts";
import { ConfigFields } from "@/components/ui/ConfigFields";
import { PageShell, Segmented } from "@/components/ui/PageShell";
import { useAuth } from "@/lib/auth/store";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { onlineEnabled } from "@/lib/supabase";
import { BackupError, buildBackup, parseBackup } from "@/lib/store/backup";
import { useHistory, visibleMatches } from "@/lib/store/history";
import { InputMode, Lang, Theme, useSettings } from "@/lib/store/settings";

export default function SettingsPage() {
  const hydrated = useHydrated();
  const t = useT();
  return <PageShell title={t.settings}>{hydrated ? <SettingsForm /> : <span className="loading loading-dots mx-auto" />}</PageShell>;
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl tracking-wide">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        {hint && <p className="text-xs text-base-content/60">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="tile flex items-center justify-between gap-4 px-4 py-3">
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-base-content/60">{hint}</span>
      </span>
      <input type="checkbox" className="toggle toggle-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-base-content/70">{label}</div>
      {children}
    </div>
  );
}

function SettingsForm() {
  const s = useSettings();
  const t = useT();
  const userId = useAuth((a) => a.user?.id ?? null);
  const localCount = useHistory((h) => visibleMatches(h.matches, userId).length);
  const clear = useHistory((h) => h.clear);
  const allMatches = useHistory((h) => h.matches);
  const importMatches = useHistory((h) => h.importMatches);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const visible = useMemo(() => visibleMatches(allMatches, userId), [allMatches, userId]);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(buildBackup(visible))], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `checkout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { matches, invalid } = parseBackup(await file.text());
      const { added, skipped } = importMatches(matches);
      setImportMsg({ ok: true, text: t.importDone(added, skipped) + (invalid ? ` ${t.importPartial(invalid)}` : "") });
    } catch (e) {
      if (!(e instanceof BackupError)) console.error(e);
      setImportMsg({ ok: false, text: t.importInvalid });
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="space-y-7 pb-4">
      <Section icon={<SlidersHorizontal className="size-5" />} title={t.sectionPreferences}>
        <Field label={t.language}>
          <Segmented<Lang>
            label={t.language}
            value={s.lang}
            options={[
              { value: "fr", label: "Français" },
              { value: "en", label: "English" },
            ]}
            onChange={(lang) => s.set({ lang })}
          />
        </Field>
        <Field label={t.theme}>
          <div className="join w-full" role="radiogroup" aria-label={t.theme}>
            {(
              [
                ["light", t.light, <Sun key="sun" className="size-4" />],
                ["dark", t.dark, <Moon key="moon" className="size-4" />],
              ] as [Theme, string, React.ReactNode][]
            ).map(([value, label, icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={s.theme === value}
                className={`btn join-item flex-1 gap-2 ${s.theme === value ? "btn-primary" : "btn-soft"}`}
                onClick={() => s.set({ theme: value })}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </Field>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-base-content/70">{t.yourName}</span>
          <input
            className="input w-full"
            value={s.name}
            maxLength={24}
            placeholder={t.statsNamePlaceholder}
            onChange={(e) => s.set({ name: e.target.value })}
          />
        </label>
      </Section>

      <Section icon={<Target className="size-5" />} title={t.sectionGameDefaults} hint={t.sectionGameDefaultsHint}>
        <ConfigFields value={s.lastConfig} onChange={(lastConfig) => s.set({ lastConfig })} />
      </Section>

      <Section icon={<Gamepad2 className="size-5" />} title={t.sectionScoring}>
        <Field label={t.scoringInput}>
          <Segmented<InputMode>
            label={t.scoringInput}
            value={s.inputMode}
            options={[
              { value: "darts", label: t.dartByDart },
              { value: "total", label: t.quickTotal },
            ]}
            onChange={(inputMode) => s.set({ inputMode })}
          />
        </Field>
        <Toggle label={t.autoSubmit} hint={t.autoSubmitHint} checked={s.autoSubmit} onChange={(autoSubmit) => s.set({ autoSubmit })} />
        <Toggle label={t.caller} hint={t.callerHint} checked={s.caller} onChange={(caller) => s.set({ caller })} />
        <Toggle label={t.haptics} hint={t.hapticsHint} checked={s.haptics} onChange={(haptics) => s.set({ haptics })} />
      </Section>

      <Section icon={<Database className="size-5" />} title={t.sectionAccount}>
        {onlineEnabled && <AccountStatusCard />}
        <div className="tile flex flex-col items-start gap-1 px-4 py-3">
          <span className="text-sm">{t.localMatches(localCount)}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm -ml-3 text-error"
            disabled={localCount === 0}
            onClick={() => confirm(userId ? t.clearHistoryConfirmCloud : t.clearHistoryConfirm) && clear()}
          >
            <Trash2 className="size-4" /> {t.clearLocalHistory}
          </button>
        </div>
        <div className="tile space-y-2 px-4 py-3">
          <p className="font-medium">{t.backupTitle}</p>
          <p className="text-xs text-base-content/60">{t.backupHint}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-soft btn-sm" disabled={visible.length === 0} onClick={exportBackup}>
              <Download className="size-4" /> {t.exportBackup}
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> {t.importBackup}
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onImport(e.target.files?.[0])} />
          </div>
          {importMsg && (
            <p role="status" className={`text-sm ${importMsg.ok ? "text-success" : "text-error"}`}>
              {importMsg.text}
            </p>
          )}
        </div>
        <div className="panel space-y-1 p-4 text-sm text-base-content/70">
          <p className="font-medium text-base-content">{t.installTitle}</p>
          <p>{t.installHow}</p>
          <p>{t.installOffline}</p>
        </div>
        <Link href="/credits" className="tile flex items-center gap-3 px-4 py-3">
          <Info className="size-5 text-primary" />
          <span className="flex-1">
            <span className="font-medium">{t.credits}</span>
            <span className="block text-xs text-base-content/60">{t.creditsHint}</span>
          </span>
          <ChevronRight className="size-5 text-base-content/40" />
        </Link>
      </Section>
    </div>
  );
}
