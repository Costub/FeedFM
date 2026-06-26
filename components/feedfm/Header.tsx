import { Radio } from "lucide-react";
import Link from "next/link";

import { AuthControl } from "@/components/feedfm/AuthControl";

export function Header({ authDisabled = false }: { authDisabled?: boolean }) {
  return (
    <header className="mx-auto flex w-[min(100%,80rem)] max-w-[100vw] items-center justify-between gap-4 px-5 py-6 sm:px-8">
      <Link className="flex items-center gap-3" href="/" aria-label="FeedFM home">
        <span className="pixel-border-sm flex size-11 items-center justify-center bg-amber text-console-black">
          <Radio aria-hidden="true" />
        </span>
        <span className="flex flex-col">
          <span className="font-pixel text-2xl font-bold uppercase leading-none text-pixel-cream">
            FeedFM
          </span>
          <span className="font-pixel text-xs uppercase text-amber">
            Tune into the internet
          </span>
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 font-pixel text-xs uppercase text-signal-green lg:flex">
          <span className="size-2 animate-blink bg-signal-green shadow-[0_0_14px_rgba(119,255,121,0.8)]" />
          live signal ready
        </div>
        <AuthControl authDisabled={authDisabled} />
      </div>
    </header>
  );
}
