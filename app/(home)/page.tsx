import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-2xl font-bold mb-4">TrueCalc</h1>
      <p className="mb-2">
        A spreadsheet formula engine with Google Sheets conformance, for Rust,
        JavaScript/WASM, MCP, and (soon) a hosted API.
      </p>
      <p>
        Start with{' '}
        <Link href="/docs/learn" className="font-medium underline">
          Learn
        </Link>
        , look things up in{' '}
        <Link href="/docs/reference" className="font-medium underline">
          Reference
        </Link>
        , or integrate via the{' '}
        <Link href="/docs/api" className="font-medium underline">
          API
        </Link>{' '}
        docs.
      </p>
    </div>
  );
}
