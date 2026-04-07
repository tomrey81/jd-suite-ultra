import Link from 'next/link';

export default function JDNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="font-display text-4xl font-bold text-text-muted">404</div>
      <p className="text-sm text-text-secondary">This job description was not found or you don&apos;t have access to it.</p>
      <Link
        href="/"
        className="rounded-md bg-brand-gold px-4 py-2 text-sm font-medium text-white"
      >
        Back to Workspace
      </Link>
    </div>
  );
}
