"use client";

import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useT } from "@/lib/i18n";

export function PageShell({
  title,
  back = "/",
  children,
  actions,
}: {
  title: string;
  back?: string | null;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col pt-safe pb-safe">
      <header className="flex items-center gap-2 px-2 py-1">
        {back && (
          <Link href={back} className="btn btn-ghost btn-square btn-sm" aria-label={t.back}>
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <h1 className="flex-1 text-xl font-bold">{title}</h1>
        <Link href="/" aria-label="Checkout" className="shrink-0">
          <Image src="/brand/logo-256.png" alt="" width={32} height={32} className="size-8 rounded-[7px]" />
        </Link>
        {actions}
      </header>
      <main className="flex flex-1 flex-col gap-4 px-4 py-2">{children}</main>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="join w-full" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`btn join-item flex-1 ${value === o.value ? "btn-primary" : "btn-soft"}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
