import React, { useState, useEffect, useContext } from 'react';
import { getSettings, updateSettings, getProducts, updateProduct, getStockHistory, getAuditLogs } from '../api/ipc';
import { ToastContext } from '../contexts/ToastContext';
import { AuthContext } from '../contexts/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import { emitSale } from '../utils/eventBus';
import { parseSQLiteDate, formatDateTimeAMPM } from '../utils/dateHelper';


export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState('bulk');
  const [bulkHistory, setBulkHistory] = useState([]);
  const [stockHistory, setStockHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, entry: null });
  
  const { addToast } = useContext(ToastContext);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    loadData();
    const onRefresh = () => loadData();
    window.addEventListener('data:refresh', onRefresh);
    return () => window.removeEventListener('data:refresh', onRefresh);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { getAllUsers } = await import('../api/ipc');
      const [prods, allUsers] = await Promise.all([getProducts(), getAllUsers()]);
      setProducts(prods);
      setUsers(allUsers);

      const settings = await getSettings();
      if (settings.bulk_update_history) {
        setBulkHistory(JSON.parse(settings.bulk_update_history));
      } else {
        setBulkHistory([]);
      }

      const stHistory = await getStockHistory();
      setStockHistory(stHistory);

      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString(); // Last 1 month
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const audits = await getAuditLogs(start, end, 100);
      setAuditLogs(audits);
      
    } catch (e) {
      addToast('Gagal memuat riwayat', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevertBulk = async (historyEntry) => {
    try {
      let count = 0;
      for (const change of historyEntry.changes) {
        const p = products.find(x => x.id === change.productId);
        if (p) {
          await updateProduct(p.id, p.name, change.oldPrice, p.stock, p.category, p.hpp, p.status, p.variants);
          count++;
        }
      }
      
      const newHistory = bulkHistory.filter(h => h.id !== historyEntry.id);
      setBulkHistory(newHistory);
      await updateSettings({ bulk_update_history: JSON.stringify(newHistory) });
      
      addToast(`${count} harga produk dikembalikan`, 'success');
      setConfirmModal({ isOpen: false, entry: null });
      loadData();
      emitSale();
    } catch (err) {
      addToast('Gagal membatalkan update', 'error');
    }
  };

  const renderBulkHistory = () => (
    <div className="recent-table-wrap">
      {bulkHistory.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Tidak ada riwayat bulk update</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Deskripsi Pembaruan</th>
              <th>Jlh. Produk</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {bulkHistory.map((h, i) => (
              <tr key={h.id}>
                <td style={{ fontSize: '13px' }}>{h.timestamp}</td>
                <td style={{ fontWeight: 600 }}>{h.description}</td>
                <td>{h.changes.length} Item</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmModal({ isOpen: true, entry: h })}>Batalkan Update</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderStockHistory = () => (
    <div className="recent-table-wrap">
      {stockHistory.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Tidak ada riwayat pergerakan stok</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Produk</th>
              <th>Tipe</th>
              <th>Jumlah</th>
              <th>Keterangan</th>
              <th>Pengguna</th>
            </tr>
          </thead>
          <tbody>
            {stockHistory.map((s, i) => {
              const pTarget = products.find(p => p.id === s.productId);
              const uTarget = users.find(u => u.id === s.createdBy);
              const isTypeIn = s.type?.toLowerCase() === 'in';
              let tstamp = new Date();
              if (s.createdAt) tstamp = new Date(s.createdAt);

              return (
              <tr key={s.id}>
                <td style={{ fontSize: '13px' }}>{formatDateTimeAMPM(tstamp)}</td>
                <td style={{ fontWeight: 600 }}>{pTarget?.name || `Produk ID ${s.productId}`}</td>
                <td>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: '11px', 
                    fontWeight: 'bold',
                    background: isTypeIn ? '#E6F4EA' : '#FCE8E6',
                    color: isTypeIn ? '#137333' : '#C5221F',
                    border: '1px solid currentColor'
                  }}>
                    {s.type?.toUpperCase()}
                  </span>
                </td>
                <td style={{ fontWeight: 'bold' }}>{isTypeIn ? '+' : '-'}{s.quantity}</td>
                <td>{s.reason || '-'}</td>
                <td style={{ fontSize: '12px' }}>{uTarget?.fullname || uTarget?.username || (s.createdBy?.length > 15 ? 'Admin (Pemilik)' : s.createdBy) || 'Sistem'}</td>
              </tr>
            )})}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderAuditLogs = () => (
    <div className="recent-table-wrap">
      {auditLogs.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Tidak ada log aktivitas penting</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Pengguna</th>
              <th>Aksi / Kejadian</th>
              <th>Detail / Target</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((a, i) => {
              const uTarget = users.find(u => u.id === a.userId);
              let tstamp = new Date();
              if (a.createdAt) tstamp = new Date(a.createdAt);
              
              const isDummyUser = String(a.userId) === '1';
              const isUUID = String(a.userId).length > 20;
              const displayUser = uTarget?.fullname || uTarget?.username || (isDummyUser ? 'Admin' : (isUUID ? 'Pengguna Terhapus' : a.userId)) || 'Sistem';
              
              const formatAction = (act) => {
                const map = {
                  'create_transaction': '🧾 Transaksi Baru',
                  'delete_transaction': '🗑 Hapus Transaksi',
                  'void_transaction':   '❌ Void Transaksi',
                  'create_product':     '➕ Tambah Produk',
                  'edit_product':       '✏️ Edit Produk',
                  'delete_product':     '🗑 Hapus Produk',
                  'update_stock':       '📦 Update Stok',
                  'bulk_update':        '🔄 Update Massal',
                  'create_user':        '👤 Tambah Pengguna',
                  'edit_user':          '✏️ Edit Pengguna',
                  'delete_user':        '🗑 Hapus Pengguna',
                  'seed_dummy':         '🌱 Generate Data',
                  'Sistem':             '⚙️ Sistem',
                };
                return map[act] || act;
              };

              return (
              <tr key={a.id}>
                <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{formatDateTimeAMPM(tstamp)}</td>
                <td style={{ fontWeight: 600 }}>{displayUser}</td>
                <td><span style={{ padding: '4px 8px', background: '#eee', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{formatAction(a.action)}</span></td>
                <td style={{ fontSize: '12px' }}>{a.reason || a.details || '-'}</td>
              </tr>
            )})}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="content-area active" id="area-history" style={{ padding: 'clamp(12px, 3vw, 24px)' }}>
      <div style={{ borderBottom: 'var(--border-base)', paddingBottom: '16px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Riwayat &amp; Log Sistem</h1>
        <div style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>Pantau pergerakan harga massal, sirkulasi stok, dan log aktivitas pengguna.</div>
      </div>
      
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid var(--black)', marginTop: '16px', overflowX: 'auto', whiteSpace: 'nowrap' }} className="cat-filter">
        <button 
          className={`btn btn-ghost ${activeTab === 'bulk' ? 'active-tab' : ''}`} 
          onClick={() => setActiveTab('bulk')} 
          style={{ borderBottom: activeTab === 'bulk' ? '3px solid var(--black)' : 'none', borderRadius: '0' }}
        >
          Bulk Update Harga
        </button>
        <button 
          className={`btn btn-ghost ${activeTab === 'stock' ? 'active-tab' : ''}`} 
          onClick={() => setActiveTab('stock')} 
          style={{ borderBottom: activeTab === 'stock' ? '3px solid var(--black)' : 'none', borderRadius: '0' }}
        >
          Pergerakan Stok
        </button>
        {user?.role === 'admin' && (
          <button 
            className={`btn btn-ghost ${activeTab === 'audit' ? 'active-tab' : ''}`} 
            onClick={() => setActiveTab('audit')} 
            style={{ borderBottom: activeTab === 'audit' ? '3px solid var(--black)' : 'none', borderRadius: '0' }}
          >
            Audit Log
          </button>
        )}
      </div>

      <div className="laporan-body" style={{ marginTop: '24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Memuat riwayat...</div>
        ) : (
          activeTab === 'bulk' ? renderBulkHistory() : 
          activeTab === 'stock' ? renderStockHistory() : renderAuditLogs()
        )}
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title="Batalkan Bulk Update"
        message={`Yakin ingin membatalkan "${confirmModal.entry?.description}"? Harga produk akan dikembalikan.`}
        onConfirm={() => handleRevertBulk(confirmModal.entry)}
        onCancel={() => setConfirmModal({ isOpen: false, entry: null })}
      />
    </div>
  );
}
