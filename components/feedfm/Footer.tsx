export function Footer() {
  return (
    <footer className="mx-auto w-[min(100%,80rem)] max-w-[100vw] px-5 pb-8 sm:px-8">
      <div className="border-t-2 border-border pt-5">
        <div className="flex flex-col justify-between gap-3 font-pixel uppercase sm:flex-row sm:items-end">
          <div>
            <p className="text-lg font-black text-pixel-cream">FeedFM</p>
            <p className="mt-1 text-xs text-amber">AI radio for the internet</p>
          </div>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-right">
            Shared broadcasts are public and unlisted. Anyone with the link can listen.
          </p>
        </div>
      </div>
    </footer>
  );
}
