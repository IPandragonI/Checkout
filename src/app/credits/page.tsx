"use client";

import { ExternalLink, Heart } from "lucide-react";
import Image from "next/image";
import { GitHubIcon } from "@/components/ui/BrandIcons";
import { PageShell } from "@/components/ui/PageShell";
import { Dict, useT } from "@/lib/i18n";

const CREATOR = { name: "IPandragonI", url: "https://github.com/IPandragonI" };
const REPOSITORY = "https://github.com/IPandragonI/Checkout";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
const COMMIT = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "local";
const BUILT_AT = process.env.NEXT_PUBLIC_BUILD_TIME;

const TECH: { name: string; url: string; role: keyof Dict["tech"] }[] = [
  { name: "Next.js", url: "https://nextjs.org", role: "next" },
  { name: "React", url: "https://react.dev", role: "react" },
  { name: "Supabase", url: "https://supabase.com", role: "supabase" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com", role: "tailwind" },
  { name: "daisyUI", url: "https://daisyui.com", role: "daisyui" },
  { name: "Zustand", url: "https://github.com/pmndrs/zustand", role: "zustand" },
  { name: "Lucide", url: "https://lucide.dev", role: "lucide" },
  { name: "Vercel", url: "https://vercel.com", role: "vercel" },
];

export default function CreditsPage() {
  const t = useT();
  // UTC so the server-rendered and hydrated text always match.
  const builtOn = BUILT_AT
    ? new Date(BUILT_AT).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "–";

  return (
    <PageShell title={t.credits} back="/settings">
      <div className="panel flex flex-col items-center gap-2 p-5 text-center">
        <Image src="/brand/logo-256.png" alt="" width={96} height={96} className="size-24 -rotate-6 drop-shadow-lg" />
        <h2 className="font-display text-4xl tracking-wide">Checkout</h2>
        <dl className="grid w-full grid-cols-3 gap-2 text-sm">
          <Info label={t.version} value={`v${VERSION}`} />
          <Info label={t.build} value={COMMIT} mono />
          <Info label={t.builtOn} value={builtOn} />
        </dl>
      </div>

      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-xl tracking-wide">{t.createdBy}</h2>
        <a href={CREATOR.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-primary font-display text-xl text-primary-content">
            {CREATOR.name.charAt(0)}
          </span>
          <span className="font-semibold">{CREATOR.name}</span>
          <ExternalLink className="ml-auto size-4 text-base-content/40" />
        </a>
        <a href={REPOSITORY} target="_blank" rel="noopener noreferrer" className="btn btn-github btn-sm w-full gap-2">
          <GitHubIcon className="size-4" /> {t.sourceCode}
        </a>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl tracking-wide">{t.builtWith}</h2>
        <ul className="grid grid-cols-2 gap-2">
          {TECH.map((tech) => (
            <li key={tech.name}>
              <a
                href={tech.url}
                target="_blank"
                rel="noopener noreferrer"
                className="tile flex h-full flex-col px-3 py-2 transition-transform active:translate-y-0.5"
              >
                <span className="font-semibold">{tech.name}</span>
                <span className="text-xs text-base-content/60">{t.tech[tech.role]}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-center justify-center gap-1.5 pb-4 text-center text-sm text-base-content/60">
        <Heart className="size-4 fill-secondary text-secondary" /> {t.madeFor}
      </p>
    </PageShell>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-field bg-base-200 px-2 py-1.5">
      <dt className="text-xs text-base-content/60">{label}</dt>
      <dd className={`font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
