import React, { useState, useEffect, useContext } from 'react';
import { getSettings, updateSettings } from '../api/ipc';
import { ToastContext } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';



export default function ShiftSettingsPage() {
  const [shifts, setShifts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  
  const [formData, setFormData] = useState({ name: '', startTime: '', endTime: '' });
  const { addToast } = useContext(ToastContext);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    setIsLoading(true);
    try {
      const settings = await getSettings();
      if (settings && settings.shift_templates) {
        try {
          const parsed = JSON.parse(settings.shift_templates);
          setShifts(Array.isArray(parsed) ? parsed : []);
        } catch (parseErr) {
          console.error('[ShiftSettings] JSON parse error:', parseErr);
          setShifts([]);
        }
      } else {
        setShifts([]);
      }
    } catch (e) {
      console.error('[ShiftSettings] loadShifts error:', e);
      addToast('Gagal memuat pengaturan shift', 'error');
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingShift(null);
    setFormData({ name: '', startTime: '07:00', endTime: '15:00' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (shift) => {
    setEditingShift(shift);
    setFormData({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.startTime || !formData.endTime) {
      addToast('Semua kolom harus diisi', 'error');
      return;
    }
    try {
      let updatedShifts = [...shifts];
      if (editingShift) {
        updatedShifts = updatedShifts.map(s => s.id === editingShift.id ? { ...s, ...formData } : s);
      } else {
        updatedShifts.push({ id: Date.now().toString(), ...formData });
      }
      await updateSettings({ shift_templates: JSON.stringify(updatedShifts) });
      setShifts(updatedShifts);
      setIsModalOpen(false);
      addToast('Shift berhasil disimpan', 'success');
    } catch (e) {
      console.error('[ShiftSettings] handleSave error:', e);
      addToast('Gagal menyimpan shift', 'error');
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmDelete({ isOpen: true, id });
  };

  const handleConfirmDelete = async () => {
    const { id } = confirmDelete;
    if (!id) return;
    setConfirmDelete({ isOpen: false, id: null });
    try {
      const updatedShifts = shifts.filter(s => s.id !== id);
      await updateSettings({ shift_templates: JSON.stringify(updatedShifts) });
      setShifts(updatedShifts);
      addToast('Shift berhasil dihapus', 'success');
    } catch (e) {
      addToast('Gagal menghapus shift', 'error');
    }
  };

  return (
    <div className="content-area active animate-fade-in" id="area-shift-settings" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--surface-0)' }}>
      {/* Header */}
      <div className="produk-header" style={{ padding: '24px 32px 20px', display: 'flex', alignItems: 'flex-start', gap: '16px', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Pengaturan Shift</h1>
          <div style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>Atur jadwal shift kerja yang dapat di-assign ke setiap kasir.</div>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>+ Tambah Shift</button>
      </div>

      {/* Body */}
      <div className="produk-body" style={{ padding: '24px 32px', flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Memuat data...</div>
        ) : (
          <div className="recent-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama Shift</th>
                  <th>Jam Mulai</th>
                  <th>Jam Selesai</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {shifts.length > 0 ? shifts.map(s => (
                  <tr key={s.id}>
                    <td data-label="Nama Shift" style={{ fontWeight: 700 }}>{s.name}</td>
                    <td data-label="Jam Mulai">
                      <span className="badge badge-info">{s.startTime}</span>
                    </td>
                    <td data-label="Jam Selesai">
                      <span className="badge badge-aktif">{s.endTime}</span>
                    </td>
                    <td data-label="Aksi" style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(s)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(s.id)}>
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
                      <div style={{ fontSize: '14px', marginBottom: '8px' }}>Belum ada jadwal shift yang dibuat</div>
                      <div style={{ fontSize: '12px' }}>Klik "+ Tambah Shift" untuk membuat jadwal shift baru</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay open">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingShift ? 'Edit Shift' : 'Tambah Shift'}</h3>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nama Shift</label>
                <input type="text" placeholder="Misal: Shift Pagi" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Jam Mulai</label>
                  <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Jam Selesai</label>
                  <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} style={{ width: '100%' }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Hapus Shift"
        message="Yakin ingin menghapus jadwal shift ini?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null })}
      />
    </div>
  );
}
