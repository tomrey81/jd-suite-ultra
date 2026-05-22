/**
 * Server-side PDF text extraction for Vercel / Node serverless.
 *
 * Uses pdfjs-dist's legacy build, which is the Node-compatible entry point
 * that does NOT require browser globals like DOMMatrix, ImageData, or Path2D.
 *
 * The default `pdf-parse@2.x` package pulls in the modern pdfjs build which
 * crashes on Vercel with "DOMMatrix is not defined". This helper sidesteps
 * the issue by going to pdfjs directly via its Node entry.
 */

export async function extractPdfText(buf: Buffer): Promise<string> {
  // Legacy mjs entry is the Node-compatible build (no DOM globals required)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Disable the worker — pdfjs falls back to running in the main thread,
  // which is what we want on the server.
  (pdfjs as { GlobalWorkerOptions?: { workerSrc?: string } }).GlobalWorkerOptions ??= {};
  (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = '';

  const data = new Uint8Array(buf);
  const loadingTask = (pdfjs as {
    getDocument: (args: {
      data: Uint8Array;
      disableWorker?: boolean;
      isEvalSupported?: boolean;
      useSystemFonts?: boolean;
    }) => { promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
        cleanup: () => void;
      }>;
      destroy: () => Promise<void>;
    }> };
  }).getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });

  const pdf = await loadingTask.promise;
  const out: string[] = [];

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((it) => (typeof it.str === 'string' ? it.str : ''))
        .join(' ');
      out.push(pageText);
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return out.join('\n\n').replace(/[ \t]+\n/g, '\n').trim();
}
