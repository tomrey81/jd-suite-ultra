// Minimal layout for print/export pages — no sidebar, no header
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
