import React, { useState, useEffect, useContext } from 'react';
import { listenUsers, createUser, deleteUser, updateUser, getSettings } from '../api/ipc';
import { AuthContext } from '../contexts/AuthContext';
import { ToastContext } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { useFormCache } from '../hooks/useFormCache';

const ROLE_LABEL = { admin: 'Administrator', kasir: 'Kasir' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmState, setConfirmState] = useState({ isOpen: false, user: null });
  const [showPassword, setShowPassword] = useState(false);

  // Gunakan cache untuk form tambah pengguna, tapi abaikan field password
  const { values: formData, handleChange, setValues: setFormData, clearCache } = useFormCache('draft_add_user', {
    fullname: '',
    username: '',
    role: 'kasir',
    shiftId: ''
  });
  const [password, setPassword] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [shifts, setShifts] = useState([]);

  const { user: currentUser } = useContext(AuthContext);
  const { addToast } = useContext(ToastContext);

  useEffect(() => {
    let unsubscribeUsers;
    const init = async () => {
      setIsLoading(true);
      try {
        const settings = await getSettings();
        if (settings.shift_templates) {
          setShifts(JSON.parse(settings.shift_templates));
        }
      } catch (err) {
        console.error(err);
      }
      
      unsubscribeUsers = listenUsers((data) => {
        setUsers(data);
        setIsLoading(false);
      });
    };
    init();

    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, []);

  const handleOpenAdd = async () => {
    try {
      const settings = await getSettings();
      if (settings.shift_templates) setShifts(JSON.parse(settings.shift_templates));
    } catch (e) { }
    setEditingUserId(null);
    setFormData({ fullname: '', username: '', role: 'kasir', shiftId: '' });
    setPassword('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (u) => {
    try {
      const settings = await getSettings();
      if (settings.shift_templates) setShifts(JSON.parse(settings.shift_templates));
    } catch (e) { }
    setEditingUserId(u.id);
    setFormData({ fullname: u.fullname, username: u.username, role: u.role, shiftId: u.shiftId || '' });
    setPassword('');
    setIsModalOpen(true);
  };

  const formatAMPM = (timeStr) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${mStr} ${ampm}`;
  };

  const handleSaveUser = async () => {
    if (!formData.fullname || !formData.username) {
      addToast('Semua field harus diisi!', 'error');
      return;
    }
    if (!editingUserId && password.length < 8) {
      addToast('PIN / Password minimal 8 karakter!', 'error');
      return;
    }
    if (editingUserId && password && password.length < 8) {
      addToast('Jika diisi, PIN / Password minimal 8 karakter!', 'error');
      return;
    }

    try {
      if (editingUserId) {
        await updateUser(editingUserId, formData.username, password || null, formData.fullname, formData.role, formData.shiftId);
        addToast('Pengguna berhasil diperbarui!', 'success');
      } else {
        await createUser(formData.username, password, formData.fullname, formData.role, formData.shiftId);
        addToast('Pengguna berhasil ditambahkan!', 'success');
      }
      setIsModalOpen(false);
      clearCache();
      setPassword('');
    } catch (err) {
      addToast('Gagal menyimpan pengguna (Username mungkin sudah dipakai)', 'error');
    }
  };

  const handleDeleteClick = (u) => {
    if (u.id === currentUser?.id) {
      addToast('Tidak bisa menghapus akun yang sedang digunakan!', 'error');
      return;
    }
    setConfirmState({ isOpen: true, user: u });
  };

  const handleConfirmDelete = async () => {
    const u = confirmState.user;
    setConfirmState({ isOpen: false, user: null });
    try {
      await deleteUser(u.id);
      addToast(`Pengguna "${u.fullname}" berhasil dihapus`, 'success');
    } catch (err) {
      addToast(err.message || 'Gagal menghapus pengguna', 'error');
    }
  };

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const renderUserTableRows = React.useMemo(() => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#aaa' }}>
            Memuat data...
          </td>
        </tr>
      );
    }
    if (users.length === 0) {
      return (
        <tr>
          <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#aaa' }}>
            Tidak ada pengguna.
          </td>
        </tr>
      );
    }
    return users.map(u => {
      const d = u.createdAt?.toDate ? u.createdAt.toDate() : (u.createdAt ? new Date(u.createdAt) : new Date());
      const isCurrentUser = u.id === currentUser?.id;
      return (
        <tr key={u.id}>
          <td style={{ fontWeight: 700, color: '#aaa', textAlign: 'center' }}>{users.indexOf(u) + 1}</td>
          <td>
            <strong>{u.fullname}</strong>
            {isCurrentUser && (
              <span style={{ marginLeft: '6px', fontSize: '10px', background: 'var(--accent-yellow)', padding: '1px 6px', fontWeight: 700 }}>ANDA</span>
            )}
          </td>
          <td style={{ fontFamily: 'var(--font-body)', color: '#555' }}>{u.username}</td>
          <td>
            <span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-aktif'}`}>
              {ROLE_LABEL[u.role] || u.role}
            </span>
          </td>
          <td>
            {u.shiftId ? <span className="badge badge-outline">{shifts.find(s => s.id === u.shiftId)?.name || 'Shift ' + u.shiftId}</span> : <span style={{ color: '#aaa', fontSize: '11px' }}>-</span>}
          </td>
          <td style={{ fontSize: '12px', color: '#888' }}>
            {d.toLocaleDateString('id-ID')} {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </td>
          <td>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenEdit(u)}
              >
                Edit
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteClick(u)}
                disabled={isCurrentUser}
                title={isCurrentUser ? 'Tidak bisa hapus akun aktif' : 'Hapus pengguna'}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Hapus
              </button>
            </div>
          </td>
        </tr>
      );
    });
  }, [users, isLoading, currentUser]);

  return (
    <div className="content-area active" id="area-users">
      <div className="produk-header">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(16px,3vw,22px)', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Manajemen Staf</h1>
          <div style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>Kelola akun kasir, administrator, dan pengaturan shift pengguna.</div>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>+ Tambah Pengguna</button>
      </div>

      <div className="produk-body">
        <div className="produk-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '48px' }}>No.</th>
                <th>Nama Lengkap</th>
                <th>Username</th>
                <th>Peran</th>
                <th>Jadwal Shift</th>
                <th>Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {renderUserTableRows}
            </tbody>
          </table>
        </div>

        {/* Info Box */}
        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--surface-1)', border: 'var(--border-thin)', fontSize: '12px', color: '#555', lineHeight: '1.8' }}>
          <strong>Catatan:</strong> Admin terakhir tidak dapat dihapus. Akun yang sedang aktif (login) juga tidak dapat dihapus.
        </div>
      </div>

      {/* Modal Tambah User */}
      {isModalOpen && (
        <div className="modal-overlay open">
          <div className="modal">
            <div className="modal-header">
              <h3>Tambah Pengguna Baru</h3>
              <button className="btn btn-icon" onClick={() => setIsModalOpen(false)} aria-label="Tutup Modal User">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>NAMA LENGKAP</label>
                <input type="text" name="fullname" value={formData.fullname} onChange={handleChange} placeholder="Misal: Budi Santoso" autoFocus />
              </div>
              <div className="form-group">
                <label>USERNAME</label>
                <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Misal: budi123" autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label>PIN / PASSWORD {editingUserId ? '(Kosongkan jika tidak diubah)' : '(Min. 8 karakter)'}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={editingUserId ? "Kosongkan jika tidak diubah" : "Minimal 8 karakter"}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>PERAN (ROLE)</label>
                  <select name="role" value={formData.role} onChange={handleChange}>
                    <option value="kasir">Kasir</option>
                    <option value="admin">Admin / Manager</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>JADWAL SHIFT</label>
                  <select name="shiftId" value={formData.shiftId} onChange={handleChange}>
                    <option value="">Tidak ada</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({formatAMPM(s.startTime)} - {formatAMPM(s.endTime)})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSaveUser}>{editingUserId ? 'Simpan Perubahan' : 'Simpan Pengguna'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title="Hapus Pengguna?"
        message={
          <span>
            Aksi ini akan menghapus pengguna <strong>"{confirmState.user?.fullname}"</strong> (@{confirmState.user?.username}) secara permanen.<br /><br />
            Data transaksi yang sudah dibuat oleh pengguna ini tidak akan ikut terhapus.
          </span>
        }
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState({ isOpen: false, user: null })}
      />
    </div>
  );
}
