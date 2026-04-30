'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Open = {
  id: string;
  checkoutHash: string;
  checkedOutAt: Date;
  note: string | null;
};

export function CheckoutPanel({
  jdId, currentHash, openCheckout,
}: {
  jdId: string;
  currentHash: string;
  openCheckout: Open | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{ tampered?: boolean; checkoutHash?: string; currentHash?: string } | null>(null);

  async function checkout() {
    setBusy(true); setError(null); setResult(null);
    const res = await fetch(`/api/admin/jds/${jdId}/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note || undefined }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error || 'Failed'); return; }
    setNote(''); router.refresh();
  }

  async function checkin(abandon = false) {
    setBusy(true); setError(null); setResult(null);
    const res = await fetch(`/api/admin/jds/${jdId}/checkin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abandon }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Failed'); return; }
    setResult(data);
    router.refresh();
  }

  // Helper: does the live hash already differ from the open checkout hash?
  const driftedDuringCheckout = openCheckout && openCheckout.checkoutHash !== currentHash;

  return (
    <div className="admin-card" style={{ borderColor: openCheckout ? 'var(--warn)' : 'var(--hair)' }}>
      <h2>Tamper-detection (checkout / check-in)</h2>

      {error && (
        <div style={{ background: 'var(--err-bg)', color: 'var(--danger)', padding: 8, borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{
          background: result.tampered ? 'var(--err-bg)' : 'var(--ok-bg)',
          color: result.tampered ? 'var(--danger)' : 'var(--success)',
          padding: 12, borderRadius: 8, marginBottom: 12,
        }}>
          {result.tampered ? (
            <>
              <strong>⚠ Tamper detected.</strong> The JD content has changed between checkout and check-in.
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 6 }}>
                checkout: {result.checkoutHash}
                <br />current:  {result.currentHash}
              </div>
            </>
          ) : (
            <strong>✓ Hash match. JD has not been altered.</strong>
          )}
        </div>
      )}

      {openCheckout ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.12em' }}>Open checkout</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Since: {new Date(openCheckout.checkedOutAt).toISOString().replace('T', ' ').slice(0, 19)}
              </div>
              {openCheckout.note && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Note: {openCheckout.note}</div>}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.12em' }}>Checkout hash</div>
              <div className="admin-hash" style={{ wordBreak: 'break-all', marginTop: 4 }}>{openCheckout.checkoutHash}</div>
              {driftedDuringCheckout && (
                <div className="admin-pill err" style={{ marginTop: 6 }}>⚠ Live content has drifted</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-btn action" disabled={busy} onClick={() => checkin(false)}>
              {busy ? 'Verifying…' : 'Check-in & verify hash'}
            </button>
            <button className="admin-btn" disabled={busy} onClick={() => checkin(true)}>
              Abandon checkout
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>
            Snapshot the JD's current hash now. Later, when you check it back in, the panel will tell you whether anything changed in between.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.12em' }}>Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. sent to legal review"
                style={{ padding: '6px 10px', border: '1px solid var(--hair-strong)', borderRadius: 6, fontSize: 13 }} />
            </label>
            <button className="admin-btn primary" disabled={busy} onClick={checkout}>
              {busy ? 'Checking out…' : 'Checkout (snapshot hash)'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
