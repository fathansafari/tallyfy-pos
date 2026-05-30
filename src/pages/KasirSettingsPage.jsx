import React, { useContext, useState, useEffect } from 'react';
import { ToastContext } from '../contexts/ToastContext';
import ReceiptPreview from '../components/ReceiptPreview';

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '2px solid #222',
  background: '#fff', fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
};

/** Pengaturan terbatas untuk role kasir — hanya Printer & Struk */
export default function KasirSettingsPage() {
  const { addToast } = useContext(ToastContext);
  const [isSaving, setIsSaving] = useState(false);

  // State mencakup SEMUA field settings agar ReceiptPreview bisa render logo, nama toko, dll.
  const [s, setS] = useState({
    store_name: '', store_tagline: '', store_address: '',
    store_phone: '', store_email: '', store_logo: '',
    store_instagram: '', store_facebook: '', store_tiktok: '',
    receipt_width: '80', receipt_footer: '',
    printer_name: '', kitchen_printer_name: '', auto_print: 'true',
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { getSettings } = await import('../api/ipc');
      const data = await getSettings();
      if (data) setS(prev => ({ ...prev, ...data }));
    } catch {}
  };

  // Handler langsung — menghindari stale closure
  const handleChange = (key) => (e) => {
    const val = e.target.value;
    setS(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { updateSettings } = await import('../api/ipc');
      await updateSettings(s);
      addToast('Pengaturan disimpan!', 'success');
      // Kirim data terbaru langsung di payload event — POSPage tidak perlu fetch ulang
      window.dispatchEvent(new CustomEvent('settings:updated', { detail: s }));
    } catch { addToast('Gagal menyimpan', 'error'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="content-area active" id="area-settings-kasir" style={{ padding: 'clamp(12px,3vw,24px)', overflowY: 'auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(16px,3vw,22px)', fontWeight: 700, margin: 0, marginBottom: '4px', lineHeight: 1.2 }}>Pengaturan Sistem</h1>
      <div style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>Konfigurasi printer dan tampilan struk.</div>

      <div style={{ display: 'flex', gap: 'clamp(16px,3vw,32px)', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Form */}
        <div style={{ flex: 1, minWidth: '240px' }}>
          <h2 style={{ fontSize: '13px', marginBottom: '12px', borderBottom: '2px solid #222', paddingBottom: '6px', fontFamily: 'var(--font-body)', fontWeight: 700 }}>
            Ukuran &amp; Layout Struk
          </h2>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#444' }}>
              Lebar Kertas
            </label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={s.receipt_width}
              onChange={handleChange('receipt_width')}
            >
              <option value="58">58 mm (Thermal kecil)</option>
              <option value="80">80 mm (Thermal standar)</option>
              <option value="114">114 mm (Thermal lebar)</option>
            </select>
          </div>

          <h2 style={{ fontSize: '13px', marginBottom: '12px', borderBottom: '2px solid #222', paddingBottom: '6px', marginTop: '18px', fontFamily: 'var(--font-body)', fontWeight: 700 }}>
            Teks Struk
          </h2>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#444' }}>
              Pesan Footer
            </label>
            <input
              style={inputStyle}
              value={s.receipt_footer}
              onChange={handleChange('receipt_footer')}
              placeholder="Terima kasih Anda!"
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#444' }}>
              Cetak Otomatis Setelah Bayar
            </label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={s.auto_print || 'true'}
              onChange={handleChange('auto_print')}
            >
              <option value="true">Ya – Otomatis Cetak (PC/Laptop)</option>
              <option value="false">Tidak – Cetak Manual (Disarankan untuk HP/Tablet)</option>
            </select>
            <span style={{ display: 'block', marginTop: '4px', fontSize: '10px', color: '#777', lineHeight: '1.4' }}>
              Disarankan pilih 'Tidak' jika Anda mengakses lewat HP atau Tablet agar checkout berjalan instan tanpa popup printer.
            </span>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ padding: '9px 20px', background: '#111', color: '#FFD600', border: '2px solid #111', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '13px', cursor: isSaving ? 'wait' : 'pointer', boxShadow: '3px 3px 0 #FFD600' }}
          >
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>

        {/* Live Preview */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ position: 'sticky', top: '12px' }}>
            <h2 style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#888', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '5px', fontFamily: 'var(--font-body)' }}>
              Live Preview Struk
            </h2>
            <ReceiptPreview
              key={s.receipt_width}
              storeSettings={s}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
