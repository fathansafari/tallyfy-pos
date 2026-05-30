import React, { useState, useEffect, useMemo, useContext } from 'react';
import { listenProducts, createProduct, updateProduct, deleteProduct, listenCategories, getCategories, createCategory, deleteCategory, updateProductStock, getSettings, updateSettings, getStockHistory } from '../api/ipc';
import { AuthContext } from '../contexts/AuthContext';
import { ToastContext } from '../contexts/ToastContext';

import ConfirmModal from '../components/ConfirmModal';
import { useFormCache } from '../hooks/useFormCache';
import { emitSale } from '../utils/eventBus';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [categories, setCategories] = useState(['Semua']);
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isStockHistoryOpen, setIsStockHistoryOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isStockAdjustOpen, setIsStockAdjustOpen] = useState(false);
  const [stockAdjustProduct, setStockAdjustProduct] = useState(null);
  const [stockAdjustAmount, setStockAdjustAmount] = useState('');
  const [confirmState, setConfirmState] = useState({ isOpen: false, product: null });
  const [confirmCat, setConfirmCat] = useState({ isOpen: false, category: null });
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedStockProduct, setSelectedStockProduct] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);

  // Form states
  const { values: formData = {}, handleChange, setValues: setFormData, clearCache } = useFormCache('draft_product', {
    name: '', cat: '', hpp: '', price: '', variants: []
  });
  const { values: catData = {}, setValues: setCatData, clearCache: clearCatCache } = useFormCache('draft_category', { name: '' });
  const newCatName = catData?.name || '';
  const setNewCatName = (val) => setCatData({ name: val });
  
  const [bulkData, setBulkData] = useState({
    cat: [], type: 'add', val: ''
  });

  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  const { addToast } = useContext(ToastContext);

  useEffect(() => {
    const unsubscribeProducts = listenProducts((data) => {
      setProducts(data);
      setIsLoading(false);
    });

    const unsubscribeCats = listenCategories((catsData) => {
      if (Array.isArray(catsData)) {
        setCategories(['Semua', ...catsData.filter(c => c && c.name).map(c => c.name)]);
      }
    });

    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeCats) unsubscribeCats();
    };
  }, []);

  useEffect(() => {
    if (activeCategory === 'Semua') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(p => (p.category || 'Semua').trim().toLowerCase() === activeCategory.trim().toLowerCase()));
    }
  }, [products, activeCategory]);



  const rp = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
  const parseNum = (val) => String(val).replace(/\D/g, '');
  const formatInput = (val) => val ? parseInt(parseNum(val)).toLocaleString('id-ID') : '';

  // Product Form Handling
  const handleOpenAdd = () => {
    setEditingProduct(null);
    clearCache();
    setFormData({ name: '', cat: '', hpp: '', price: '', variants: [] });
    setIsProductModalOpen(true);
  };

  const handleOpenEdit = (prod) => {
    let parsedVariants = [];
    try {
      if (prod.variants) parsedVariants = JSON.parse(prod.variants);
    } catch(e){}
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      cat: prod.category || '',
      hpp: prod.hpp || 0,
      price: prod.price || 0,
      variants: parsedVariants
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { name, cat, hpp, price, variants } = formData;
      if (!name || !price) {
        addToast('Isi semua field yang wajib', 'error');
        setIsSaving(false);
        return;
      }

      const hppNum = parseInt(hpp) || 0;
      const priceNum = parseInt(price) || 0;
      const finalCat = cat || 'Semua';
      const variantsStr = JSON.stringify(variants || []);

      if (editingProduct) {
        const userName = user?.fullname || user?.username || user?.id || 'Admin';
        await updateProduct(editingProduct.id, name, priceNum, editingProduct.stock || 0, finalCat, hppNum, editingProduct.status || 'Aktif', variantsStr, userName);
        addToast('Produk berhasil diperbarui', 'success');
      } else {
        await createProduct(name, priceNum, 0, user?.id || 1, finalCat, hppNum, 'Aktif', variantsStr);
        addToast('Produk berhasil ditambahkan', 'success');
      }
      setIsProductModalOpen(false);
      clearCache();
      emitSale(); // notify POS cards to refresh
    } catch (err) {
      addToast('Gagal menyimpan produk', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (prod) => {
    try {
      const newStatus = prod.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
      const variantsStr = typeof prod.variants === 'string' ? prod.variants : JSON.stringify(prod.variants || []);
      const userName = user?.fullname || user?.username || user?.id || 'Admin';
      await updateProduct(prod.id, prod.name, prod.price, prod.stock, prod.category, prod.hpp, newStatus, variantsStr, userName);
      addToast(`Produk di${newStatus === 'Aktif' ? 'aktifkan' : 'nonaktifkan'}`, 'info');
      emitSale();
    } catch (err) {
      addToast('Gagal mengubah status', 'error');
    }
  };

  const handleDeleteClick = (prod) => {
    setConfirmState({ isOpen: true, product: prod });
  };

  const handleConfirmDeleteProduct = async () => {
    const prod = confirmState.product;
    if (!prod) return;
    setConfirmState({ isOpen: false, product: null });
    try {
      const userName = user?.fullname || user?.username || user?.id || 'Admin';
      await deleteProduct(prod.id, userName);
      addToast('Produk berhasil dihapus', 'success');
      emitSale();
    } catch (err) {
      addToast('Gagal menghapus produk', 'error');
    }
  };

  const handleOpenStockAdjust = async (prod) => {
    setStockAdjustProduct(prod);
    setStockAdjustAmount('');
    setIsStockAdjustOpen(true);
  };

  const handleStockAdjust = async () => {
    const amount = parseInt(stockAdjustAmount);
    if (isNaN(amount) || amount === 0) {
      addToast('Masukkan jumlah stok yang valid (bisa negatif untuk pengurangan)', 'error');
      return;
    }
    try {
      const { logStock } = await import('../api/ipc');
      const type = amount > 0 ? 'in' : 'out';
      await logStock(stockAdjustProduct.id, type, Math.abs(amount), 'Penyesuaian Manual', user?.id || 1);
      
      const newStock = Math.max(0, (stockAdjustProduct.stock || 0) + amount);
      addToast(`Stok ${stockAdjustProduct.name} diupdate menjadi ${newStock}`, 'success');
      
      // Refresh local modal state
      setStockAdjustProduct({ ...stockAdjustProduct, stock: newStock });
      setStockAdjustAmount('');

      emitSale(); // notify POS cards instantly
    } catch (err) {
      addToast('Gagal update stok', 'error');
    }
  };

  const handleExportCSV = async () => {
    addToast('Mengekspor data produk...', 'info');
    try {
      const header = ['Nama Produk', 'Kategori', 'HPP', 'Harga Jual', 'Stok', 'Status'];
      const rows = filteredProducts.map(p => [
        p.name, p.category, p.hpp, p.price, p.stock, p.status
      ]);
      const csv = [header, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tallyfy-produk-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Produk berhasil diekspor', 'success');
    } catch {
      addToast('Gagal mengekspor', 'error');
    }
  };

  const handleBulkUpdate = async () => {
    const val = parseInt(bulkData.val) || 0;
    if (!val && bulkData.type !== 'pct' && bulkData.type !== 'set') {
      addToast('Masukkan nilai update yang valid', 'error');
      return;
    }

    try {
      let count = 0;
      const changes = [];
      for (const p of products) {
        if (bulkData.cat.length > 0 && !bulkData.cat.includes(p.category)) continue;
        
        let newPrice = p.price;
        if (bulkData.type === 'add') newPrice += val;
        else if (bulkData.type === 'sub') newPrice = Math.max(0, p.price - val);
        else if (bulkData.type === 'pct') newPrice = Math.round(p.price * (1 + val / 100));
        else if (bulkData.type === 'set') newPrice = val;

        if (newPrice !== p.price) {
          changes.push({ productId: p.id, oldPrice: p.price, newPrice });
          const variantsStr = typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants || []);
          const userName = user?.fullname || user?.username || user?.id || 'Admin';
          await updateProduct(p.id, p.name, newPrice, p.stock, p.category, p.hpp, p.status, variantsStr, userName);
          count++;
        }
      }

      if (changes.length > 0) {
        const d = new Date();
        const historyEntry = {
          id: Date.now().toString(),
          timestamp: d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          description: `Bulk Update - ${bulkData.cat.length > 0 ? bulkData.cat.join(', ') : 'Semua'} (${bulkData.type === 'pct' ? (val > 0 ? '+'+val : val) + '%' : (bulkData.type === 'add' ? '+Rp ' : bulkData.type === 'sub' ? '-Rp ' : 'Set Rp ') + formatInput(val)})`,
          changes
        };
        const settings = await getSettings();
        const currentHistory = settings.bulk_update_history ? JSON.parse(settings.bulk_update_history) : [];
        const newHistory = [historyEntry, ...currentHistory].slice(0, 50); // Keep max 50
        await updateSettings({ bulk_update_history: JSON.stringify(newHistory) });
      }

      addToast(`${count} harga produk diperbarui`, 'success');
      emitSale();
    } catch (err) {
      addToast('Gagal bulk update', 'error');
    }
  };

  // Margin Calculation
  const hppNum = parseInt(formData.hpp) || 0;
  const priceNum = parseInt(formData.price) || 0;
  let marginPct = 0;
  let profitVal = 0;
  if (hppNum && priceNum && priceNum > hppNum) {
    marginPct = Math.round(((priceNum - hppNum) / priceNum) * 100);
    profitVal = priceNum - hppNum;
  }

  const renderTableRows = React.useMemo(() => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#aaa' }}>
            Memuat data...
          </td>
        </tr>
      );
    }
    if (filteredProducts.length === 0) {
      return (
        <tr>
          <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#aaa' }}>
            Belum ada produk di kategori ini.
          </td>
        </tr>
      );
    }
    return filteredProducts.map(p => {
      const pMargin = p.hpp > 0 && p.price > p.hpp ? Math.round(((p.price - p.hpp) / p.price) * 100) : 0;
      return (
        <tr key={p.id}>
          <td data-label="Produk"><strong>{p.name}</strong></td>
          <td data-label="Kategori"><span className="badge badge-info">{p.category || 'Semua'}</span></td>
          <td data-label="HPP" className="num">{rp(p.hpp)}</td>
          <td data-label="Harga Jual" className="num">{rp(p.price)}</td>
          <td data-label="Margin" className="num" style={{ color: pMargin > 30 ? 'var(--accent-green)' : pMargin > 15 ? '#b89800' : 'var(--accent-red)' }}>
            {pMargin}%
          </td>
          <td data-label="Status">
            <span className={`badge ${p.status === 'Aktif' ? 'badge-aktif' : 'badge-nonaktif'}`}>
              {p.status || 'Aktif'}
            </span>
          </td>
          <td data-label="Aksi">
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'nowrap' }}>
              <button className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => handleOpenStockAdjust(p)}>Manajemen Stok</button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(p)}>Edit</button>
              {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(p)}>Hapus</button>}
              <button className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => handleToggleStatus(p)}>
                {p.status === 'Aktif' ? 'Off' : 'On'}
              </button>
            </div>
          </td>
        </tr>
      );
    });
  }, [filteredProducts, isLoading, isAdmin]);

  return (
    <div className="content-area active" id="area-produk">
      <div className="produk-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(16px,3vw,22px)', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Manajemen Produk</h1>
          <div style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>Kelola daftar menu, varian, dan harga produk toko Anda.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setIsCategoryModalOpen(true)}>Kelola Kategori</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setIsBulkModalOpen(true)}>Bulk Update Harga</button>
          <button className="btn btn-primary" onClick={handleOpenAdd}>+ Tambah Produk</button>
        </div>
      </div>
      <div className="produk-body">
        <div className="filter-row">
          {categories.map(c => (
            <span 
              key={c} 
              className={`filter-pill ${c === activeCategory ? 'active' : ''}`}
              onClick={() => setActiveCategory(c)}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="produk-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produk</th>
                <th>Kategori</th>
                <th style={{ textAlign: 'right' }}>HPP</th>
                <th style={{ textAlign: 'right' }}>Harga Jual</th>
                <th style={{ textAlign: 'right' }}>Margin</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {renderTableRows}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit Produk */}
      {isProductModalOpen && (
        <div className="modal-overlay open">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h3>
              <button className="btn btn-icon" onClick={() => setIsProductModalOpen(false)} aria-label="Tutup Product Modal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>NAMA PRODUK</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Misal: Ikan Asin Pakang Balado" />
              </div>
              <div className="modal-2col">
                <div className="form-group">
                  <label>KATEGORI</label>
                  <select name="cat" value={formData.cat} onChange={handleChange}>
                    <option value="">-- Pilih Kategori --</option>
                    {categories.filter(c => c !== 'Semua' && c !== 'Umum').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-2col">
                <div className="form-group">
                  <label>HPP (Harga Pokok)</label>
                  <input type="text" value={formatInput(formData.hpp)} onChange={(e) => setFormData({...formData, hpp: parseNum(e.target.value)})} placeholder="Misal: 25.000" />
                </div>
                <div className="form-group">
                  <label>HARGA JUAL</label>
                  <input type="text" value={formatInput(formData.price)} onChange={(e) => setFormData({...formData, price: parseNum(e.target.value)})} placeholder="Misal: 45.000" />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span>VARIAN (OPSIONAL)</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFormData(f => ({ ...f, variants: [...(f.variants || []), { name: '', priceOffset: 0 }] }))}>
                    + Tambah Varian
                  </button>
                </label>
                {(formData.variants || []).map((v, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" placeholder="Nama Varian (Misal: Pedas)" value={v.name} onChange={(e) => {
                      const newVars = [...formData.variants];
                      newVars[i].name = e.target.value;
                      setFormData({ ...formData, variants: newVars });
                    }} style={{ flex: 2, padding: '8px', border: 'var(--border-thin)' }} />
                    <input type="text" placeholder="+ Harga (Misal: 2.000)" value={v.priceOffset === 0 ? '' : formatInput(v.priceOffset)} onChange={(e) => {
                      const newVars = [...formData.variants];
                      newVars[i].priceOffset = parseInt(parseNum(e.target.value)) || 0;
                      setFormData({ ...formData, variants: newVars });
                    }} style={{ flex: 1, padding: '8px', border: 'var(--border-thin)' }} />
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => {
                      const newVars = formData.variants.filter((_, idx) => idx !== i);
                      setFormData({ ...formData, variants: newVars });
                    }} style={{ padding: '0 12px' }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface-2)', border: 'var(--border-thin)', padding: '10px 14px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                <span>Estimasi Margin</span>
                <span style={{ fontWeight: 700, color: marginPct > 30 ? 'var(--accent-green)' : marginPct > 15 ? '#b89800' : 'var(--accent-red)' }}>
                  {marginPct > 0 ? `${marginPct}% (${rp(profitVal)}/item)` : '—'}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsProductModalOpen(false)} disabled={isSaving}>Batal</button>
              <button className="btn btn-primary" onClick={handleSaveProduct} disabled={isSaving}>
                {isSaving ? 'Menyimpan...' : 'Simpan Produk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bulk Update */}
      {isBulkModalOpen && (
        <div className="modal-overlay open">
          <div className="modal">
            <div className="modal-header">
              <h3>Bulk Update Harga</h3>
              <button className="btn btn-icon" onClick={() => setIsBulkModalOpen(false)} aria-label="Tutup Bulk Modal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>FILTER KATEGORI</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <button 
                    className={`filter-pill ${bulkData.cat.length === 0 ? 'active' : ''}`}
                    onClick={() => setBulkData({...bulkData, cat: []})}
                  >
                    Semua Kategori
                  </button>
                  {categories.filter(c => c !== 'Semua').map(c => (
                    <button 
                      key={c}
                      className={`filter-pill ${bulkData.cat.includes(c) ? 'active' : ''}`}
                      onClick={() => {
                        let newCats = [...bulkData.cat];
                        if (newCats.includes(c)) newCats = newCats.filter(x => x !== c);
                        else newCats.push(c);
                        setBulkData({...bulkData, cat: newCats});
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-2col">
                <div className="form-group">
                  <label>JENIS UPDATE</label>
                  <select value={bulkData.type} onChange={(e) => setBulkData({...bulkData, type: e.target.value})}>
                    <option value="add">Tambah Rp</option>
                    <option value="sub">Kurangi Rp</option>
                    <option value="pct">Naikan %</option>
                    <option value="set">Set Harga</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>NILAI {bulkData.type === 'pct' ? '(%)' : '(Rp)'}</label>
                  <div style={{ position: 'relative' }}>
                    {bulkData.type !== 'pct' && <span style={{ position: 'absolute', left: '14px', top: '10px', fontWeight: 'bold' }}>Rp</span>}
                    <input 
                      type="text" 
                      value={bulkData.type === 'pct' ? bulkData.val : formatInput(bulkData.val)} 
                      onChange={(e) => setBulkData({...bulkData, val: parseNum(e.target.value)})} 
                      placeholder={bulkData.type === 'pct' ? "10" : "5.000"} 
                      style={{ paddingLeft: bulkData.type !== 'pct' ? '40px' : '14px', paddingRight: bulkData.type === 'pct' ? '30px' : '14px', width: '100%' }}
                    />
                    {bulkData.type === 'pct' && <span style={{ position: 'absolute', right: '14px', top: '10px', fontWeight: 'bold' }}>%</span>}
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--surface-2)', border: 'var(--border-thin)', padding: '12px', fontSize: '12px', color: '#666' }}>
                ⚠ Perubahan harga bersifat permanen dan langsung diterapkan ke semua produk yang sesuai filter.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsBulkModalOpen(false)}>Batal</button>
              <button className="btn btn-danger" onClick={handleBulkUpdate}>Terapkan Sekarang</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kelola Kategori */}
      {isCategoryModalOpen && (
        <div className="modal-overlay open">
          <div className="modal" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3>Kelola Kategori</h3>
              <button className="btn btn-icon" onClick={() => setIsCategoryModalOpen(false)} aria-label="Tutup Category Modal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <input 
                    type="text" 
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Kategori baru..." 
                  />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={async () => {
                    if(!newCatName) return;
                    try {
                      await createCategory(newCatName);
                      setNewCatName('');
                      addToast('Kategori ditambahkan', 'success');
                      emitSale();
                    } catch(e) {
                      addToast('Gagal menambah (Mungkin duplikat)', 'error');
                    }
                  }}
                >
                  Tambah
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {categories.filter(c => c !== 'Semua').map(c => (
                  <div key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-1)', border: 'var(--border-thin)' }}>
                    <span>{c}</span>
                    {c !== 'Umum' && (
                      <button 
                        className="btn btn-danger btn-sm" 
                        onClick={() => setConfirmCat({ isOpen: true, category: c })}
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Manajemen Stok (Sesuaikan Stok & Riwayat) */}
      {isStockAdjustOpen && stockAdjustProduct && (
        <div className="modal-overlay open">
          <div className="modal" style={{ width: '600px' }}>
            <div className="modal-header">
              <h3>Manajemen Stok</h3>
              <button className="btn btn-icon" onClick={() => setIsStockAdjustOpen(false)} aria-label="Tutup Stock Adjust Modal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, padding: '16px', background: 'var(--surface-1)', border: 'var(--border-thin)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Produk</div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{stockAdjustProduct.name}</div>
                  <div style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
                    Stok Tersedia: <strong style={{ fontSize: '18px', color: 'var(--black)' }}>{stockAdjustProduct.stock || 0}</strong>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700 }}>TAMBAH / KURANGI STOK</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={stockAdjustAmount}
                      onChange={e => setStockAdjustAmount(e.target.value)}
                      placeholder="Misal: 10"
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button className="btn btn-primary" onClick={handleStockAdjust} disabled={!stockAdjustAmount || isNaN(parseInt(stockAdjustAmount)) || parseInt(stockAdjustAmount) === 0}>
                      Terapkan
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                    Ketik angka positif (10) untuk menambah, angka negatif (-5) untuk mengurangi.
                  </p>
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsStockAdjustOpen(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Delete Product */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title="Hapus Produk Permanen?"
        message={
          <span>
            Produk <strong>"{confirmState.product?.name}"</strong> akan dihapus secara permanen dari database.<br /><br />
            Riwayat transaksi yang sudah terjadi <strong>tidak akan terhapus</strong>.
          </span>
        }
        confirmLabel="Ya, Hapus Produk"
        cancelLabel="Batal"
        onConfirm={handleConfirmDeleteProduct}
        onCancel={() => setConfirmState({ isOpen: false, product: null })}
      />

      {/* Confirm Delete Category */}
      <ConfirmModal
        isOpen={confirmCat.isOpen}
        title="Hapus Kategori"
        message={`Yakin ingin menghapus kategori "${confirmCat.category}"? Produk dengan kategori ini tidak akan terhapus.`}
        confirmLabel="Ya, Hapus Kategori"
        cancelLabel="Batal"
        onConfirm={async () => {
          const c = confirmCat.category;
          setConfirmCat({ isOpen: false, category: null });
          try {
            const catsDb = await getCategories();
            const catTarget = catsDb.find(x => x.name === c);
            if(catTarget) {
              await deleteCategory(catTarget.id);
              addToast('Kategori dihapus', 'success');
              emitSale();
            }
          } catch(e) {
            addToast('Gagal menghapus kategori', 'error');
          }
        }}
        onCancel={() => setConfirmCat({ isOpen: false, category: null })}
      />
    </div>
  );
}