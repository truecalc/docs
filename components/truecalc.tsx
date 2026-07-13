const PLAYGROUND_ORIGIN = 'https://try.truecalc.app';

/**
 * Embeds the live TrueCalc playground as an iframe, seeded with the given
 * cells so readers can try a feature inline.
 *
 * `seed` uses the playground's seed syntax, e.g. `A1=10;A2==A1+1`
 * (a bare value is a literal; a leading `=` after the cell's `=` is a formula).
 */
export function TrueCalc({
  mode = 'standalone',
  seed,
  title = 'TrueCalc interactive playground',
}: {
  mode?: string;
  seed?: string;
  title?: string;
}) {
  const src = seed
    ? `${PLAYGROUND_ORIGIN}/?seed=${encodeURIComponent(seed)}`
    : `${PLAYGROUND_ORIGIN}/`;

  return (
    <div className="not-prose my-4" data-mode={mode}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="clipboard-read; clipboard-write"
        className="w-full rounded-lg border"
        style={{ height: 360 }}
      />
    </div>
  );
}
