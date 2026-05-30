import React from 'react';

// ── Shared receipt dimensions ─────────────────────────────────────────────────
export function getPxWidth(receiptWidth) {
  if (receiptWidth === '58')  return 220;
  if (receiptWidth === '114') return 400;
  return 300; // '80' default
}

// ── Shared inner text style: always wrap, never overflow ──────────────────────
const TEXT_SAFE = { wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' };

// ── Sub-components ────────────────────────────────────────────────────────────
function Perf({ dark }) {
  return (
    <div style={{
      height: 10,
      background: dark
        ? 'radial-gradient(circle at 6px 50%, #e8e8e8 6px, transparent 6px)'
        : 'radial-gradient(circle at 6px 50%, #f5f2ea 6px, transparent 6px)',
      backgroundSize: '12px 100%',
      backgroundRepeat: 'repeat-x',
      borderBottom: '1px dashed #ccc',
    }} />
  );
}

function Dash() {
  return <div style={{ borderTop: '1px dashed #bbb', margin: '6px 0' }} />;
}

function CutLine({ thick }) {
  return (
    <div style={{ position: 'relative', borderTop: thick ? '2px dashed #bbb' : '1px dashed #bbb', marginTop: 4 }}>
      <span style={{
        position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
        background: '#fff', padding: '0 8px', fontSize: 14, color: '#aaa',
      }}>✂</span>
    </div>
  );
}

function Barcode({ id }) {
  const bars = [1,2,1,3,1,1,2,1,3,1,2,1,1,2,1,3,1,2,1,1,2];
  return (
    <div style={{ overflow: 'hidden' }}>
      <div style={{ display: 'inline-flex', gap: 1, height: 26, alignItems: 'flex-end', justifyContent: 'center' }}>
        {bars.map((w, i) => (
          <div key={i} style={{ width: w * 2, height: i % 3 === 0 ? 26 : i % 3 === 1 ? 20 : 14, background: '#111' }} />
        ))}
      </div>
      <div style={{ fontSize: 8, color: '#aaa', letterSpacing: 1, marginTop: 2, ...TEXT_SAFE }}>{id}</div>
    </div>
  );
}

function MRow({ label, value, red }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
      <span style={{ color: '#555', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 'bold', color: red ? '#c0392b' : undefined, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// Paper info badge shown below both previews
function PaperBadge({ paperWidth }) {
  const label = paperWidth === '58'
    ? '58mm × ∞ (thermal kecil)'
    : paperWidth === '114'
    ? '114mm × ∞ (thermal lebar)'
    : '80mm × ∞ (thermal standar)';
  return (
    <div style={{
      marginTop: 6, padding: '5px 8px',
      background: '#f8f9fa', border: '1px solid #e0e0e0',
      fontSize: 10, color: '#555', textAlign: 'center',
    }}>
      <strong>Kertas:</strong> {label}
    </div>
  );
}

// ── Sample data used when no real data passed ─────────────────────────────────
const SAMPLE_ITEMS = [
  { name: 'Ayam Geprek Spesial', qty: 1, price: 30000, variant: 'Ekstra Pedas', notes: '' },
  { name: 'Es Teh Manis', qty: 2, price: 5000, variant: '', notes: '' },
];
const SAMPLE_TOTALS = {
  subtotal: 40000, discount: 0, service: 0, tax: 0, total: 40000, paid: 50000, change: 10000,
};
const SAMPLE_ORDER = {
  orderType: 'Dine In', tableNumber: '3', pax: 2,
  customerName: '-', cashierName: 'Kasir',
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER RECEIPT PREVIEW
// Default export — used in: SettingsPage, KasirSettingsPage, POSPage panel
// ─────────────────────────────────────────────────────────────────────────────
export default function ReceiptPreview({
  storeSettings = {},
  items,
  totals,
  paymentMethod = 'Tunai',
  orderInfo,
  trxId = 'INV-PREVIEW',
  hideBadge = false,
  id = 'customer-receipt-preview-capture',
}) {
  const rp = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
  const now = new Date();
  const fmtDate = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtTime = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const paperWidth = storeSettings?.receipt_width || '80';
  const pxWidth    = getPxWidth(paperWidth);

  const displayItems  = items    || SAMPLE_ITEMS;
  const displayTotals = totals   || SAMPLE_TOTALS;
  const displayOrder  = orderInfo || SAMPLE_ORDER;
  const { subtotal, discount: disc, service, tax, total, paid, change } = displayTotals;

  const box = {
    width: pxWidth,
    minWidth: pxWidth,
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 11,
    color: '#111',
    background: '#fff',
    border: '2px solid #0A0A0A',
    boxShadow: '3px 3px 0 #0A0A0A',
    boxSizing: 'border-box',
    overflow: 'hidden',          // ← prevent content from escaping
    transition: 'width 0.3s ease',
  };

  return (
    <div>
      <div id={id} style={box}>
        <Perf />
        <div style={{ padding: '4px 14px 12px', overflow: 'hidden' }}>

          {/* ── Store Header ── */}
          <div style={{ textAlign: 'center', marginBottom: 6, overflow: 'hidden' }}>
            {storeSettings?.store_logo ? (
              <div style={{ marginBottom: 6 }}>
                <img
                  src={storeSettings.store_logo}
                  alt="logo"
                  width="100"
                  height="56"
                  style={{ maxWidth: '100%', maxHeight: 56, objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '2px solid #111', margin: '0 auto 6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>🍽</div>
            )}
            <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 1, ...TEXT_SAFE }}>
              {storeSettings?.store_name || 'NAMA TOKO'}
            </div>
            {storeSettings?.store_tagline && (
              <div style={{ fontSize: 9, color: '#444', marginBottom: 1, ...TEXT_SAFE }}>
                {storeSettings.store_tagline}
              </div>
            )}
            {storeSettings?.store_address && (
              <div style={{ fontSize: 9, color: '#777', lineHeight: 1.3, ...TEXT_SAFE }}>
                {storeSettings.store_address}
              </div>
            )}
            {storeSettings?.store_phone && (
              <div style={{ fontSize: 9, color: '#777', ...TEXT_SAFE }}>
                Telp: {storeSettings.store_phone}
              </div>
            )}
            {storeSettings?.store_email && (
              <div style={{ fontSize: 9, color: '#777', ...TEXT_SAFE }}>
                {storeSettings.store_email}
              </div>
            )}
          </div>

          {/* ── Order type banner ── */}
          <div style={{
            textAlign: 'center', fontWeight: 'bold', fontSize: 10,
            padding: '3px 0', borderTop: '1px dashed #bbb', borderBottom: '1px dashed #bbb',
            margin: '5px 0', ...TEXT_SAFE,
          }}>
            {displayOrder.orderType || 'Dine In'}
            {displayOrder.tableNumber ? ` / Meja ${displayOrder.tableNumber}` : ''}
            {' / Pax '}{displayOrder.pax || 1}
          </div>

          {/* ── Meta grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 4px', fontSize: 9, marginBottom: 5 }}>
            <div>
              <div style={{ color: '#777' }}>Tanggal</div>
              <div style={{ fontWeight: 'bold', ...TEXT_SAFE }}>{fmtDate(now)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#777' }}>Kasir</div>
              <div style={{ fontWeight: 'bold', ...TEXT_SAFE }}>{displayOrder.cashierName || 'Kasir'}</div>
            </div>
            <div>
              <div style={{ color: '#777' }}>Jam</div>
              <div style={{ fontWeight: 'bold', ...TEXT_SAFE }}>{fmtTime(now)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#777' }}>No. Transaksi</div>
              <div style={{ fontWeight: 'bold', fontSize: 8, ...TEXT_SAFE }}>{trxId}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: '#777' }}>Pelanggan</div>
              <div style={{ fontWeight: 'bold', ...TEXT_SAFE }}>{displayOrder.customerName || '-'}</div>
              {displayOrder.customerPhone && (
                <div style={{ fontSize: 8, color: '#555', ...TEXT_SAFE }}>📞 {displayOrder.customerPhone}</div>
              )}
            </div>
          </div>

          <Dash />

          {/* ── Items ── */}
          <div style={{ marginBottom: 5 }}>
            {displayItems.map((item, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, fontSize: 10, fontWeight: 'bold' }}>
                  <span style={{ ...TEXT_SAFE }}>{item.name} x{item.qty}</span>
                  <span style={{ flexShrink: 0 }}>{rp(item.price * item.qty)}</span>
                </div>
                {item.variant && <div style={{ fontSize: 8, color: '#555', marginLeft: 2, ...TEXT_SAFE }}>{item.variant}</div>}
                {item.notes   && <div style={{ fontSize: 8, color: '#555', marginLeft: 2, ...TEXT_SAFE }}>Catatan: {item.notes}</div>}
              </div>
            ))}
          </div>

          <Dash />

          {/* ── Payment details ── */}
          <div style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Rincian Pembayaran
          </div>
          <div style={{ fontSize: 9, display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
            <MRow label="Subtotal"     value={rp(subtotal)} />
            {disc    > 0 && <MRow label="Diskon"        value={`-${rp(disc)}`} red />}
            {service > 0 && <MRow label="Biaya Layanan" value={rp(service)} />}
            {tax     > 0 && <MRow label="Pajak PB1"     value={rp(tax)} />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 11, borderTop: '1px dashed #bbb', paddingTop: 4, marginBottom: 6 }}>
            <span>Total</span><span>{rp(total)}</span>
          </div>

          <Dash />

          {/* ── Payment method ── */}
          <div style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Metode Pembayaran
          </div>
          <div style={{ fontSize: 9, display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
            <MRow label={paymentMethod} value={rp(paid)} />
            {!paymentMethod.toLowerCase().includes('qris') && (
              <MRow label="Kembalian" value={rp(Math.max(0, change))} />
            )}
          </div>

          <Dash />

          {/* ── Footer ── */}
          <div style={{ textAlign: 'center', fontSize: 9 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 2 }}>LUNAS</div>
            <div style={{ color: '#555', marginBottom: 4 }}>
              {fmtDate(now)} - {fmtTime(now)}
            </div>
            <div style={{ color: '#555', marginBottom: 6, ...TEXT_SAFE }}>
              {storeSettings?.receipt_footer || 'Terima kasih atas kunjungan Anda!'}
            </div>
            {(storeSettings?.store_instagram || storeSettings?.store_facebook || storeSettings?.store_tiktok) && (
              <div style={{ borderTop: '1px dashed #ddd', paddingTop: 5, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {storeSettings?.store_instagram && (
                  <div style={{ color: '#555', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', ...TEXT_SAFE }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                    {storeSettings.store_instagram}
                  </div>
                )}
                {storeSettings?.store_facebook && (
                  <div style={{ color: '#555', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', ...TEXT_SAFE }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                    {storeSettings.store_facebook}
                  </div>
                )}
                {storeSettings?.store_tiktok && (
                  <div style={{ color: '#555', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', ...TEXT_SAFE }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                    {storeSettings.store_tiktok}
                  </div>
                )}
              </div>
            )}
            <Barcode id={trxId} />
          </div>

        </div>
        <CutLine />
      </div>

      {!hideBadge && <PaperBadge paperWidth={paperWidth} />}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// KITCHEN RECEIPT PREVIEW
// Named export — used in POSPage right panel only
// ─────────────────────────────────────────────────────────────────────────────
export function KitchenReceiptPreview({
  storeSettings = {},
  items,
  orderInfo,
  trxId = 'INV-PREVIEW',
  hideBadge = false,
  id = 'kitchen-receipt-preview-capture',
}) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  const paperWidth = storeSettings?.receipt_width || '80';
  const pxWidth    = getPxWidth(paperWidth);

  const displayItems = items    || SAMPLE_ITEMS;
  const displayOrder = orderInfo || SAMPLE_ORDER;

  const totalQty = displayItems.reduce((s, i) => s + (i.qty || 1), 0);
  const allNotes = displayItems.filter(i => i.notes).map(i => i.notes).join(' · ');

  const box = {
    width: pxWidth,
    minWidth: pxWidth,
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 11,
    color: '#111',
    background: '#fff',
    border: '3px solid #111',
    boxShadow: '3px 3px 0 #111',
    boxSizing: 'border-box',
    overflow: 'hidden',
    transition: 'width 0.3s ease',
  };

  return (
    <div>
      <div id={id} style={box}>
        <Perf dark />
        <div style={{ padding: '6px 14px 12px', overflow: 'hidden' }}>

          {/* Title */}
          <div style={{
            textAlign: 'center', fontWeight: 'bold', fontSize: 16,
            letterSpacing: 2, padding: '8px 0 6px',
            borderBottom: '2px solid #111', marginBottom: 8,
          }}>
            PESANAN
          </div>

          {/* Info rows */}
          <div style={{ fontSize: paperWidth === '58' ? 9 : 11, lineHeight: 1.5, marginBottom: 4 }}>
            {[
              { label: 'Pelanggan', val: `${displayOrder.customerName || '-'}` },
              { label: 'Meja',      val: `${displayOrder.tableNumber || '-'} / Pax ${displayOrder.pax || 1}` },
              { label: 'Waktu',     val: `${dateStr} ${timeStr}` },
              { label: 'Kasir',     val: displayOrder.cashierName || 'Kasir' },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px dashed #f5f2ea', padding: '1.5px 0', gap: 6 }}>
                <span style={{ fontWeight: 'bold', color: '#666', flexShrink: 0 }}>{label}</span>
                <span style={{ fontWeight: 'bold', textAlign: 'right', ...TEXT_SAFE }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Order type badge */}
          <div style={{
            background: '#111', color: '#fff',
            textAlign: 'center', fontWeight: 'bold', fontSize: paperWidth === '58' ? 10 : 11,
            padding: '4px 0', letterSpacing: 1, margin: '6px 0',
          }}>
            ★ {(displayOrder.orderType || 'DINE IN').toUpperCase()} ★
          </div>

          <Dash />

          {/* Items — large font for kitchen readability */}
          <div style={{ marginBottom: 6 }}>
            {displayItems.map((item, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 'bold', fontSize: paperWidth === '58' ? 11 : 13, ...TEXT_SAFE }}>
                  {item.qty} x {item.name}
                </div>
                {item.variant && (
                  <div style={{ fontSize: paperWidth === '58' ? 8 : 10, paddingLeft: 12, color: '#333', ...TEXT_SAFE }}>→ {item.variant}</div>
                )}
                {item.notes && (
                  <div style={{ fontSize: paperWidth === '58' ? 8 : 10, paddingLeft: 12, fontStyle: 'italic', color: '#444', ...TEXT_SAFE }}>
                    ★ {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Dash />

          {/* Total qty */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: paperWidth === '58' ? 11 : 12, marginBottom: 6 }}>
            <span>Total QTY</span>
            <span>{totalQty}</span>
          </div>

          <Dash />

          {/* Notes box */}
          {allNotes ? (
            <div style={{
              border: '2px solid #111', padding: '6px 10px',
              textAlign: 'center', fontWeight: 'bold', fontSize: 11, marginTop: 4, ...TEXT_SAFE,
            }}>
              📝 {allNotes}
            </div>
          ) : (
            <div style={{ textAlign: 'center', fontSize: 9, color: '#aaa', marginTop: 4, fontStyle: 'italic' }}>
              Tidak ada catatan khusus
            </div>
          )}

        </div>
        <CutLine thick />
      </div>

      {!hideBadge && <PaperBadge paperWidth={paperWidth} />}
    </div>
  );
}
