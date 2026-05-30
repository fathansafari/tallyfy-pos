import React, { useContext, useState, useEffect, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { ToastContext } from '../contexts/ToastContext';
import ReceiptPreview from '../components/ReceiptPreview';


/* ── ICONS ── */
const Ico = ({ d, d2 }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={d} />{d2 && <path d={d2} />}</svg>;
const IconStore = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
const IconPrinter = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>;
const IconMoney = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
const IconTag = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>;

const TABS = [
  { key: 'toko', label: 'Profil Toko', icon: <IconStore /> },
  { key: 'printer', label: 'Printer & Struk', icon: <IconPrinter /> },
  { key: 'transaksi', label: 'Transaksi', icon: <IconMoney /> },
  { key: 'produk', label: 'Produk & Stok', icon: <IconTag /> },
];

/* ─── INPUT FIELD (controlled, no focus loss) ─── */
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px', color: '#444' }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: '11px', color: '#888', marginTop: '5px', lineHeight: '1.5' }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '2px solid #222',
  background: '#fff', fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
};
const selectStyle = { ...inputStyle, cursor: 'pointer' };

/* ─── SECTION TITLE ─── */
const STitle = ({ children }) => (
  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#888', marginBottom: '14px', marginTop: '20px', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
    {children}
  </div>
);

/* ─── SAVE BUTTON ─── */
const SaveBtn = ({ saving, onClick }) => {
  return (
    <button onClick={onClick} disabled={saving}
      style={{ marginTop: '20px', padding: '10px 28px', background: '#111', color: '#FFD600', border: '2px solid #111', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '13px', cursor: saving ? 'wait' : 'pointer', boxShadow: '3px 3px 0 #FFD600' }}>
      {saving ? "Menyimpan..." : "Simpan Pengaturan"}
    </button>
  );
};

/* ═══════════════════════════════════════════════════ */
export default function SettingsPage() {
  const { storeCode } = useContext(AuthContext);
  const { addToast } = useContext(ToastContext);
  const [activeTab, setActiveTab] = useState('toko');
  const [isSaving, setIsSaving] = useState(false);

  /* All settings as a flat object — loaded ONCE, then edited locally */
  const [s, setS] = useState({
    store_name: '', store_tagline: '', store_address: '', store_phone: '', store_email: '',
    store_logo: '',
    store_instagram: '', store_facebook: '', store_tiktok: '',
    printer_name: '', kitchen_printer_name: '', receipt_width: '80',
    receipt_footer: '', receipt_policy: '', print_kitchen_ticket: 'true', auto_print: 'true',
    default_tax: '0', service_rate: '0', tax_rate: '0', enable_tax: 'true',
    default_category: 'Umum', default_margin: '30', auto_deduct_stock: 'true',
    qris_image: '', currency_symbol: 'Rp', require_shift: 'true', low_stock_alert: '5'
  });

  useEffect(() => {
    loadSettings();
  }, [activeTab]);

  /* Keyboard shortcut: Ctrl+S saves */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [s]);

  const loadSettings = async () => {
    try {
      const { getSettings } = await import('../api/ipc');
      const data = await getSettings();
      if (data) setS(prev => ({ ...prev, ...data }));
    } catch (err) { console.log('No settings'); }
  };


  /* updater that never re-mounts children */
  const set = useCallback((key) => (e) => {
    const val = e.target ? e.target.value : e;
    setS(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { updateSettings } = await import('../api/ipc');
      await updateSettings(s);
      addToast("Pengaturan disimpan!", 'success');
      // Beri tahu POSPage dan halaman lain bahwa settings berubah — sertakan data baru
      window.dispatchEvent(new CustomEvent('settings:updated', { detail: s }));
    } catch { addToast("Gagal menyimpan", 'error'); }
    finally { setIsSaving(false); }
  };

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setS(prev => ({ ...prev, store_logo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleQris = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { addToast("Ukuran QRIS maksimal 500KB", 'warning'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setS(prev => ({ ...prev, qris_image: ev.target.result }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="content-area active" id="area-settings" style={{ flexDirection: 'column', padding: 0 }}>
      {/* Header */}
      <div style={{ padding: 'clamp(10px,2vw,14px) clamp(12px,3vw,20px)', borderBottom: 'var(--border-base)', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface-1)', flexShrink: 0, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(16px,3vw,22px)', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Pengaturan &amp; Backup</h1>
        <span style={{ fontSize: '11px', color: '#888' }}>Ctrl+S untuk simpan cepat</span>
      </div>

      <div className="settings-layout">
        {/* ── Tab Sidebar ── */}
        <div className="settings-sidebar">
          {TABS.map(t_item => (
            <button key={t_item.key} onClick={() => setActiveTab(t_item.key)} style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '10px 14px', border: 'none',
              borderLeft: activeTab === t_item.key ? '3px solid var(--accent-yellow)' : '3px solid transparent',
              background: activeTab === t_item.key ? 'var(--surface-0)' : 'transparent',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '11px',
              color: activeTab === t_item.key ? 'var(--black)' : '#666', cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ opacity: activeTab === t_item.key ? 1 : 0.5, flexShrink: 0 }}>{t_item.icon}</span>
              {t_item.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div className="settings-content">
          {/* Form Area */}
          <div className="settings-form">

            {/* ═══ PROFIL TOKO ═══ */}
            {activeTab === 'toko' && (
              <div>
              <STitle>PENGATURAN TOKO</STitle>

              {/* Kode Toko */}
              <div style={{ marginBottom: '20px', padding: '14px 16px', background: '#fffde7', border: '2px solid #FFD600', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#777', marginBottom: '6px' }}>Kode Toko (Bagikan ke Kasir untuk Login)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <code style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '3px', color: '#111', flex: 1 }}>{storeCode}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(storeCode); addToast("Kode toko disalin!", 'success'); }}
                    style={{ padding: '6px 14px', background: '#111', color: '#FFD600', border: '2px solid #111', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                  >
                    Salin
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: '#888', marginTop: '6px', lineHeight: '1.5' }}>Kasir perlu memasukkan kode ini di halaman login untuk bisa masuk ke toko Anda.</p>
              </div>

              {/* Logo Upload */}
              <Field label="Logo Toko (tampil di struk)">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '72px', height: '72px', border: '2px dashed #ccc', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fafafa'
                  }}>
                    {s.store_logo
                      ? <img src={s.store_logo} alt="logo" width="100" height="100" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: '10px', color: '#aaa', textAlign: 'center' }}>Belum ada logo</span>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" onChange={handleLogo} style={{ fontSize: '12px', width: '100%' }} />
                    {s.store_logo && (
                      <button onClick={() => setS(p => ({ ...p, store_logo: '' }))}
                        style={{ marginTop: '6px', fontSize: '11px', background: 'none', border: '1px solid #ccc', cursor: 'pointer', padding: '3px 8px' }}>
                        Hapus Logo
                      </button>
                    )}
                    <p style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>PNG/JPG, maks 200KB. Logo akan muncul di struk cetak.</p>
                  </div>
                </div>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Nama Toko *">
                  <input style={inputStyle} value={s.store_name} onChange={set('store_name')} placeholder="Warung Makan Jaya" />
                </Field>
                <Field label="Tagline / Slogan">
                  <input style={inputStyle} value={s.store_tagline} onChange={set('store_tagline')} placeholder="Enak & Terjangkau" />
                </Field>
              </div>
              <Field label="Alamat Lengkap">
                <input style={inputStyle} value={s.store_address} onChange={set('store_address')} placeholder="Jl. Contoh No. 1, Kota" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Telepon">
                  <input style={inputStyle} value={s.store_phone} onChange={set('store_phone')} placeholder="0812-xxxx-xxxx" />
                </Field>
                <Field label="Email (opsional)">
                  <input style={inputStyle} value={s.store_email} onChange={set('store_email')} placeholder="toko@email.com" />
                </Field>
              </div>

              <STitle>MEDIA SOSIAL TOKO (Tampil di Footer Struk)</STitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0 16px' }}>
                <Field label="Instagram">
                  <input style={inputStyle} value={s.store_instagram} onChange={set('store_instagram')} placeholder="@namatoko" />
                </Field>
                <Field label="Facebook">
                  <input style={inputStyle} value={s.store_facebook} onChange={set('store_facebook')} placeholder="facebook.com/namatoko" />
                </Field>
                <Field label="TikTok">
                  <input style={inputStyle} value={s.store_tiktok} onChange={set('store_tiktok')} placeholder="@namatoko" />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <SaveBtn saving={isSaving} onClick={handleSave} />
              </div>
            </div>
          )}

          {/* ═══ PRINTER & STRUK ═══ */}
          {activeTab === 'printer' && (
            <div>
              <STitle>Konfigurasi Printer</STitle>
              <div style={{ fontSize: '13px', color: '#155724', background: '#d4edda', padding: '12px', borderRadius: '4px', border: '1px solid #c3e6cb', marginBottom: '24px', lineHeight: '1.6' }}>
                <strong>Cetak Struk Web Aktif</strong><br />
                Aplikasi akan otomatis memanggil dialog cetak bawaan browser. <strong>TIPS:</strong> Jadikan printer thermal Anda sebagai \"Default Printer\" di pengaturan Windows agar proses cetak langsung otomatis tanpa perlu memilih printer lagi.<br /><br />
                <strong>Cara settingnya:</strong><br />
                1. Buka Windows - Devices and Printers.<br />
                2. Klik kanan pada nama Printer Thermal kamu - Pilih Printing Preferences (Preferensi Pencetakan).<br />
                3. Pada tab Paper/Layout, ubah Paper Size menjadi 58mm x 210mm atau 80mm x 297mm.<br />
                <em>Catatan: Setelan inilah yang memastikan saat dialog print browser muncul, ukuran kertasnya sudah otomatis panjang ke bawah.</em>
              </div>

              <STitle>Ukuran & Layout Struk</STitle>
              <Field label="Lebar Kertas">
                <select style={selectStyle} value={s.receipt_width} onChange={set('receipt_width')}>
                  <option value="58">58 mm (Thermal kecil)</option>
                  <option value="80">80 mm (Thermal standar)</option>
                  <option value="114">114 mm (Thermal lebar)</option>
                </select>
              </Field>

              <STitle>Teks Struk</STitle>
              <Field label="Pesan Footer">
                <input style={inputStyle} value={s.receipt_footer} onChange={set('receipt_footer')} placeholder="Terima kasih atas kunjungan Anda!" />
              </Field>

              <STitle>Printer Dapur (Kitchen)</STitle>
              <Field label="Cetak Tiket Dapur Otomatis">
                <select style={selectStyle} value={s.print_kitchen_ticket} onChange={set('print_kitchen_ticket')}>
                  <option value="true">Ya – Panggil dialog print kedua untuk tiket dapur</option>
                  <option value="false">Tidak – Hanya cetak struk pelanggan</option>
                </select>
              </Field>

              <STitle>Cetak Otomatis</STitle>
              <Field label="Panggil Dialog Printer Otomatis Setelah Bayar" hint="Pilih 'Tidak' jika Anda menggunakan HP/Tablet yang tidak memiliki driver printer Windows/Dialog desktop bawaan, agar transaksi selesai dengan mulus tanpa pop-up terhenti. Anda tetap dapat mencetak secara manual dan membagikan struk lewat WhatsApp.">
                <select style={selectStyle} value={s.auto_print || 'true'} onChange={set('auto_print')}>
                  <option value="true">Ya – Otomatis Cetak (Disarankan untuk PC/Laptop)</option>
                  <option value="false">Tidak – Cetak Manual saja (Disarankan untuk HP/Tablet)</option>
                </select>
              </Field>
              <SaveBtn saving={isSaving} onClick={handleSave} />
            </div>
          )}

          {/* ═══ TRANSAKSI ═══ */}
          {activeTab === 'transaksi' && (
            <div>
              <STitle>Pajak & Biaya Layanan</STitle>
              <Field label="Aktifkan PB1 / Pajak?">
                <select style={selectStyle} value={s.enable_tax} onChange={set('enable_tax')}>
                  <option value="true">Ya – Hitung Pajak</option>
                  <option value="false">Tidak – Abaikan Pajak</option>
                </select>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0 16px' }}>
                <Field label="Simbol Mata Uang">
                  <input style={inputStyle} value={s.currency_symbol} onChange={set('currency_symbol')} placeholder="Rp" />
                </Field>
                <Field label="Service Charge (%)" hint="Biaya layanan otomatis dihitung">
                  <input style={inputStyle} type="number" min="0" max="100" value={s.service_rate} onChange={set('service_rate')} placeholder="0" />
                </Field>
                <Field label="PB1 / Pajak (%)" hint="Pajak dihitung setelah service">
                  <input style={inputStyle} type="number" min="0" max="100" value={s.tax_rate} onChange={set('tax_rate')} placeholder="0" disabled={s.enable_tax === 'false'} />
                </Field>
              </div>

              <STitle>Aturan Shift</STitle>
              <Field label="Wajib buka shift sebelum transaksi?">
                <select style={selectStyle} value={s.require_shift} onChange={set('require_shift')}>
                  <option value="true">Ya – Wajib (Direkomendasikan)</option>
                  <option value="false">Tidak – Boleh langsung transaksi</option>
                </select>
              </Field>

              <STitle>Alert Stok</STitle>
              <Field label="Batas stok menipis (unit)" hint="Produk dengan stok ≤ angka ini akan muncul sebagai peringatan di Dashboard.">
                <input style={inputStyle} type="number" min="1" value={s.low_stock_alert} onChange={set('low_stock_alert')} />
              </Field>

              <STitle>Pembayaran Digital</STitle>
              <Field label="Upload QRIS Statis Toko (Maks 500KB)">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '100px', height: '100px', border: '2px dashed #ccc', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fafafa'
                  }}>
                    {s.qris_image
                      ? <img src={s.qris_image} alt="qris" width="100" height="100" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: '10px', color: '#aaa', textAlign: 'center' }}>Belum ada QRIS</span>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" onChange={handleQris} style={{ fontSize: '12px', width: '100%' }} />
                    {s.qris_image && (
                      <button onClick={() => setS(p => ({ ...p, qris_image: '' }))}
                        style={{ marginTop: '6px', fontSize: '11px', background: 'none', border: '1px solid #ccc', cursor: 'pointer', padding: '3px 8px' }}>
                        Hapus QRIS
                      </button>
                    )}
                    <p style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>Gambar ini akan ditampilkan saat metode bayar QRIS dipilih.</p>
                  </div>
                </div>
              </Field>

              <SaveBtn saving={isSaving} onClick={handleSave} />
            </div>
          )}

          {/* ═══ PRODUK & STOK ═══ */}
          {activeTab === 'produk' && (
            <div>
              <STitle>Default Produk</STitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Kategori Default">
                  <input style={inputStyle} value={s.default_category} onChange={set('default_category')} placeholder="Umum" />
                </Field>
                <Field label="Target Margin (%)">
                  <input style={inputStyle} type="number" min="0" max="100" value={s.default_margin} onChange={set('default_margin')} />
                </Field>
              </div>
              <Field label="Potong stok otomatis saat transaksi?" hint="Jika aktif, stok berkurang otomatis setiap item terjual.">
                <select style={selectStyle} value={s.auto_deduct_stock} onChange={set('auto_deduct_stock')}>
                  <option value="true">Aktif (Direkomendasikan)</option>
                  <option value="false">Nonaktif – Kelola manual</option>
                </select>
              </Field>
              <SaveBtn saving={isSaving} onClick={handleSave} />
            </div>
          )}

          {/* Tab Jaringan Dihapus (Kini menggunakan Cloud Firestore) */}

          </div> {/* End Form Area */}

          {/* Live Preview Area (Only for Toko and Printer tabs) */}
          {(activeTab === 'toko' || activeTab === 'printer') && (
            <div className="settings-preview">
              <div style={{ position: 'sticky', top: 0 }}>
                <STitle>Live Preview Struk</STitle>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px', textAlign: 'center' }}>
                  Pilih lebar kertas untuk melihat perubahan
                </div>
                <ReceiptPreview key={s.receipt_width} storeSettings={s} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
