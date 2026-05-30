import React, { useState, useEffect, useContext } from 'react';
import { listenTransactions, listenShifts, getProducts, getAllUsers } from '../api/ipc';
import { AuthContext } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  // ── Dashboard state ──
  const [stats, setStats] = useState({
    omzet: 0, trxCount: 0, profit: 0, productCount: 0, omzetYesterday: 0
  });
  const [myStats, setMyStats] = useState({ count: 0, omzet: 0, omzetCash: 0 });
  const [recentTrx, setRecentTrx] = useState([]);
  const [myRecentTrx, setMyRecentTrx] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyChart, setWeeklyChart] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [cashierPerformance, setCashierPerformance] = useState([]);
  const [activeShifts, setActiveShifts] = useState([]);

  useEffect(() => {
    let unsubTrx = () => {};
    let unsubShifts = () => {};

    const initDashboard = async () => {
      setIsLoading(true);
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        const chartStart = new Date(todayStart);
        chartStart.setDate(chartStart.getDate() - 6);

        const shiftStart = new Date(todayStart);
        shiftStart.setDate(shiftStart.getDate() - 2);

        const products = await getProducts();
        const users = await getAllUsers();
        
        const activeProducts = products.filter(p => p.status === 'Aktif').length;

        const userMap = {};
        users.forEach(u => userMap[u.id] = u.fullname);

        unsubShifts = listenShifts(shiftStart.toISOString(), endDate.toISOString(), (shifts) => {
          const runningShifts = shifts.filter(s => s.status === 'Aktif' || s.status === 'active');
          setActiveShifts(runningShifts);
        });

        unsubTrx = listenTransactions(chartStart.toISOString(), endDate.toISOString(), async (allTransactions) => {
          // ONE-TIME CLEANUP (User requested to delete transaction TRX-WBQB5N)
          const toDelete = allTransactions.filter(t => 
            (typeof t.id === 'string' && t.id.toLowerCase().includes('wbqb5n')) ||
            (typeof t.invoiceNo === 'string' && t.invoiceNo.toLowerCase().includes('wbqb5n'))
          );
          if (toDelete.length > 0) {
            const { deleteDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const storeCode = localStorage.getItem('storeCode');
            if (storeCode) {
              for (const t of toDelete) {
                try {
                  await deleteDoc(doc(db, 'stores', storeCode, 'transactions', t.id));
                } catch(e) {}
              }
            }
            allTransactions = allTransactions.filter(t => !toDelete.includes(t));
          }

          const todayIso = todayStart.toISOString();
          const yesterdayIso = yesterdayStart.toISOString();
          
          const transactions = allTransactions.filter(t => t.created_at >= todayIso);
          const yesterdayTransactions = allTransactions.filter(t => t.created_at >= yesterdayIso && t.created_at < todayIso);

          const omzet = transactions.reduce((acc, trx) => acc + (trx.total_amount || 0), 0);
          const omzetYesterday = yesterdayTransactions.reduce((acc, trx) => acc + (trx.total_amount || 0), 0);
          const profit = transactions.reduce((acc, trx) => acc + ((trx.subtotal - trx.discount) - (trx.total_hpp || 0)), 0);

          setStats({ omzet, omzetYesterday, trxCount: transactions.length, profit, productCount: activeProducts });

          // Enrich transactions with cashier name
          const enrichedTransactions = transactions.map(trx => {
            let mappedName = trx.user_fullname || userMap[trx.user_id];
            if (!mappedName) {
              if (trx.user_id === 'kasir-event-id' || trx.user_id === 'kasir') mappedName = 'Kasir Utama';
              else if (trx.user_id === 'admin-event-id' || trx.user_id === 'admin') mappedName = 'Administrator';
              else mappedName = (trx.user_id && trx.user_id.length > 15 ? 'Admin (Pemilik)' : trx.user_id) || 'Admin';
            }
            return {
              ...trx,
              cName: mappedName
            };
          });

          setRecentTrx(enrichedTransactions.slice(0, 6));

          // Cashier Performance & Top Products & Personal Stats
          const productMap = {};
          const cashierMap = {};
          let myTrxCount = 0;
          let myOmzet = 0;
          let myOmzetCash = 0;
          const currentUserId = user?.id || user?.uid;

          enrichedTransactions.forEach(trx => {
            if (trx.status !== 'voided') {
              // Admin Cashier Performance
              const cName = trx.cName;
              if (!cashierMap[cName]) {
                cashierMap[cName] = { name: cName, trxCount: 0, omzet: 0 };
              }
              cashierMap[cName].trxCount += 1;
              cashierMap[cName].omzet += (trx.total_amount || 0);

              // Personal Cashier Stats
              if (currentUserId && trx.user_id === currentUserId) {
                myTrxCount += 1;
                myOmzet += (trx.total_amount || 0);
                const payMethod = String(trx.payment_method || trx.paymentMethod || '').toLowerCase();
                if (payMethod === 'tunai' || payMethod === 'cash') {
                  myOmzetCash += (trx.total_amount || 0);
                }
              }

              // Product logic
              (trx.items || []).forEach(item => {
                const pid = item.productId || item.id;
                if (!productMap[pid]) {
                  productMap[pid] = { id: pid, name: item.name, category: item.category || 'Umum', qty: 0 };
                }
                productMap[pid].qty += (item.quantity || 1);
              });
            }
          });

          setMyStats({ count: myTrxCount, omzet: myOmzet, omzetCash: myOmzetCash });
          setCashierPerformance(Object.values(cashierMap).sort((a,b) => b.omzet - a.omzet));
          setTopProducts(Object.values(productMap).sort((a,b) => b.qty - a.qty).slice(0, 5));
          setMyRecentTrx(enrichedTransactions.filter(t => currentUserId && t.user_id === currentUserId).slice(0, 6));

          // 7-day chart processing
          const days = [];
          for (let i = 6; i >= 0; i--) {
            const dayStartChart = new Date();
            dayStartChart.setDate(dayStartChart.getDate() - i);
            dayStartChart.setHours(0, 0, 0, 0);
            const dayEndChart = new Date();
            dayEndChart.setDate(dayEndChart.getDate() - i);
            dayEndChart.setHours(23, 59, 59, 999);
            
            const label = dayStartChart.toLocaleDateString('id-ID', { weekday: 'short' });
            const dayTrxs = allTransactions.filter(t => t.created_at >= dayStartChart.toISOString() && t.created_at <= dayEndChart.toISOString());
            const val = dayTrxs.filter(t => t.status !== 'voided').reduce((s, t) => s + (t.total_amount || 0), 0);
            days.push({ label, val });
          }
          setWeeklyChart(days);
          setIsLoading(false);
        });

      } catch (error) {
        console.error('Error loading realtime dashboard:', error);
        setIsLoading(false);
      }
    };

    if (user) {
      initDashboard();
    }

    return () => {
      unsubTrx();
      unsubShifts();
    };
  }, [user]);

  const rp = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

  const omzetDiffPct = stats.omzetYesterday === 0 
    ? (stats.omzet > 0 ? 100 : 0) 
    : Math.round(((stats.omzet - stats.omzetYesterday) / stats.omzetYesterday) * 100);

  const currentUserId = user?.id || user?.uid;
  const myShift = activeShifts.find(s => s.user_id === currentUserId);

  // ── CASHIER VIEW ──
  if (!isAdmin) {
    if (isLoading) {
      return <div className="content-area active"><div style={{ padding: '40px', textAlign: 'center' }}>Memuat...</div></div>;
    }

    if (!myShift) {
      return (
        <div className="content-area active animate-fade-in" id="area-dashboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔒</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 800, marginBottom: '8px' }}>Anda Belum Buka Shift</h2>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '32px' }}>Silakan buka shift Anda untuk mencatat modal awal dan mulai mengakses mesin kasir POS.</p>
            <button 
              className="btn btn-primary btn-lg" 
              style={{ width: '100%', fontSize: '16px', padding: '16px', borderRadius: '4px' }}
              onClick={() => {
                if (window.openStartShiftModal) window.openStartShiftModal();
              }}
            >
              BUKA SHIFT SEKARANG
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="content-area active animate-fade-in" id="area-dashboard">
        <div className="dash-header">
          <h1>Dashboard Kasir</h1>
          <div style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div className="dash-body">
          
          {/* WELCOME BANNER */}
          <div style={{ background: 'var(--accent-yellow)', border: 'var(--border-thick)', boxShadow: 'var(--shadow-md)', padding: '24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 800, marginBottom: '6px' }}>Selamat Bekerja, {myShift.fullname || myShift.username || user?.fullname || 'Kasir'}!</h2>
              <div style={{ fontSize: '13px', color: 'var(--black)', fontWeight: 600 }}>Shift Mulai: {new Date(myShift.start_time || myShift.startedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => { if (window.attemptLogout) window.attemptLogout(); }} style={{ padding: '12px 20px', fontWeight: 700 }}>
                TUTUP SHIFT
              </button>
              <button className="btn btn-primary" onClick={() => { if (window.navigateToPage) window.navigateToPage('pos'); }} style={{ padding: '12px 20px', background: 'var(--black)', color: 'var(--accent-yellow)', border: '2px solid var(--black)', fontWeight: 800 }}>
                BUKA POS 🛒
              </button>
            </div>
          </div>

          {/* MY STATS */}
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="stat-card animate-slide-up delay-50">
              <div className="stat-card-label">Total Transaksi Saya</div>
              <div className="stat-card-value blue">{myStats.count}</div>
              <div className="stat-card-sub">hari ini</div>
            </div>
            <div className="stat-card animate-slide-up delay-100">
              <div className="stat-card-label">Pemasukan Laci (Estimasi Tunai)</div>
              <div className="stat-card-value green">{rp((myShift.starting_cash || 0) + myStats.omzetCash)}</div>
              <div className="stat-card-sub" style={{ fontSize: '11px', opacity: 0.8 }}>
                Modal: {rp(myShift.starting_cash || 0)} + Tunai: {rp(myStats.omzetCash)}
              </div>
            </div>
            <div className="stat-card animate-slide-up delay-150">
              <div className="stat-card-label">Total Pemasukan Shift Saya</div>
              <div className="stat-card-value yellow">{rp(myStats.omzet)}</div>
              <div className="stat-card-sub">semua metode bayar</div>
            </div>
          </div>

          <div style={{ marginTop: '20px' }} className="animate-slide-up delay-200">
            <div className="dash-section-title">Riwayat Transaksi Pribadi</div>
            <div className="recent-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>No. Transaksi</th>
                    <th>Tanggal</th>
                    <th>Waktu</th>
                    <th>Kasir</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th style={{ textAlign: 'right' }}>Diskon</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myRecentTrx.length > 0 ? myRecentTrx.map((trx) => (
                    <tr key={trx.id}>
                      <td data-label="No. Transaksi" style={{ fontWeight: 700 }}>{'TRX-' + String(trx.id).substring(0, 6).toUpperCase()}</td>
                      <td data-label="Tanggal">{new Date(trx.created_at || trx.createdAt).toLocaleDateString('id-ID')}</td>
                      <td data-label="Waktu">{new Date(trx.created_at || trx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td data-label="Kasir">{trx.cName}</td>
                      <td data-label="Subtotal" className="num">{rp(trx.subtotal || 0)}</td>
                      <td data-label="Diskon" className="num">{rp(trx.discount || 0)}</td>
                      <td data-label="Total" className="num" style={{ fontWeight: 700 }}>{rp(trx.total_amount || trx.totalAmount)}</td>
                      <td data-label="Status" style={{ textAlign: 'center' }}>
                        <span className={`badge ${trx.status === 'voided' ? 'badge-diskon' : 'badge-aktif'}`}>
                          {trx.status === 'voided' ? 'Void' : 'Lunas'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '16px', color: '#888' }}>
                        {isLoading ? "Memuat transaksi..." : "Belum ada transaksi hari ini."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

            </div>
          </div>

        </div>
      </div>
    );
  }

  // ── ADMIN VIEW ──
  return (
    <div className="content-area active animate-fade-in" id="area-dashboard">
      <div className="dash-header">
        <h1>Ringkasan Hari Ini</h1>
        <div style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
      <div className="dash-body">
        
        {/* STAT GRID */}
        <div className="stat-grid">
          <div className="stat-card animate-slide-up delay-50">
            <div className="stat-card-label">Omzet Penjualan</div>
            <div className="stat-card-value green">{rp(stats.omzet)}</div>
            <div className="stat-card-sub" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className={`badge ${omzetDiffPct >= 0 ? 'badge-aktif' : 'badge-diskon'}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                {omzetDiffPct >= 0 ? '↑' : '↓'} {Math.abs(omzetDiffPct)}%
              </span>
              vs kemarin
            </div>
          </div>
          <div className="stat-card animate-slide-up delay-100">
            <div className="stat-card-label">Total Transaksi</div>
            <div className="stat-card-value blue">{stats.trxCount}</div>
            <div className="stat-card-sub">hari ini</div>
          </div>
          <div className="stat-card animate-slide-up delay-150">
            <div className="stat-card-label">Estimasi Profit (Kotor)</div>
            <div className="stat-card-value yellow">{rp(stats.profit)}</div>
            <div className="stat-card-sub">berdasarkan HPP terjual</div>
          </div>
          <div className="stat-card animate-slide-up delay-200">
            <div className="stat-card-label">Shift Aktif</div>
            <div className="stat-card-value">{activeShifts.length}</div>
            <div className="stat-card-sub">sedang berjalan</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '10px' }}>
          
          {/* CASHIER PERFORMANCE */}
          <div className="animate-slide-up delay-250">
            <div className="dash-section-title">Performa Kasir (Hari Ini)</div>
            <div className="recent-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kasir</th>
                    <th style={{ textAlign: 'center' }}>Trx</th>
                    <th style={{ textAlign: 'right' }}>Omzet</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierPerformance.length > 0 ? cashierPerformance.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ textAlign: 'center' }}>{c.trxCount}</td>
                      <td className="num">{rp(c.omzet)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: '#888' }}>{isLoading ? 'Memuat...' : 'Belum ada data'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ACTIVE SHIFTS WIDGET */}
          <div className="animate-slide-up delay-300">
            <div className="dash-section-title">Status Shift Aktif</div>
            <div className="recent-table-wrap" style={{ background: 'var(--surface-1)' }}>
              {activeShifts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {activeShifts.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: 'var(--border-thin)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 0 2px var(--black)' }}></div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px' }}>{s.fullname || s.username}</div>
                          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Mulai: {new Date(s.start_time || s.startedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                      <div className="badge badge-aktif">Online</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                  {isLoading ? 'Memuat...' : 'Tidak ada shift yang berjalan'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* WEEKLY CHART */}
        <div style={{ marginTop: '10px' }} className="animate-slide-up delay-250">
          <div className="dash-section-title">Omzet 7 Hari Terakhir</div>
            <div style={{ background: '#fff', border: 'var(--border-base)', padding: '16px 20px', boxShadow: 'var(--shadow-md)' }}>
              {(() => {
                const data = weeklyChart.length > 0 ? weeklyChart : [
                  { label: 'Sen', val: 0 }, { label: 'Sel', val: 0 }, { label: 'Rab', val: 0 },
                  { label: 'Kam', val: 0 }, { label: 'Jum', val: 0 }, { label: 'Sab', val: 0 }, { label: 'Min', val: 0 }
                ];
                const maxVal = Math.max(...data.map(d => d.val), 1);
                const W = 560, H = 180, PL = 58, PR = 12, PT = 16, PB = 36;
                const chartW = W - PL - PR;
                const chartH = H - PT - PB;
                const barW = Math.floor(chartW / data.length * 0.55);
                const gap = chartW / data.length;
                const gridLines = [0, 0.25, 0.5, 0.75, 1];

                const fmtY = (v) => {
                  if (v === 0) return '0';
                  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}jt`;
                  if (v >= 1000) return `${Math.round(v / 1000)}rb`;
                  return `${v}`;
                };

                return (
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    {gridLines.map((pct, gi) => {
                      const y = PT + chartH * (1 - pct);
                      return (
                        <g key={gi}>
                          <line x1={PL} x2={PL + chartW} y1={y} y2={y} stroke="#eee" strokeWidth="1" strokeDasharray={pct === 0 ? 'none' : '4 3'} />
                          <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#aaa" fontFamily="var(--font-body)">{fmtY(maxVal * pct)}</text>
                        </g>
                      );
                    })}
                    {data.map((d, i) => {
                      const barH = Math.max(2, (d.val / maxVal) * chartH);
                      const x = PL + i * gap + (gap - barW) / 2;
                      const y = PT + chartH - barH;
                      const isToday = i === data.length - 1;
                      return (
                        <g key={i}>
                          <rect x={x} y={y} width={barW} height={barH}
                            fill={isToday ? '#FFD600' : '#111'}
                            rx="2" style={{ transition: 'all 0.3s ease-out' }}
                          >
                            <title>{d.label}: Rp {d.val.toLocaleString('id-ID')}</title>
                          </rect>
                          {d.val > 0 && (
                            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fill={isToday ? '#b8a000' : '#555'} fontWeight="700" fontFamily="var(--font-body)">
                              {fmtY(d.val)}
                            </text>
                          )}
                          <text x={x + barW / 2} y={PT + chartH + 18} textAnchor="middle" fontSize="12" fill={isToday ? '#111' : '#888'} fontWeight={isToday ? '700' : '600'} fontFamily="var(--font-body)">
                            {d.label}
                          </text>
                        </g>
                      );
                    })}
                    <line x1={PL} x2={PL + chartW} y1={PT + chartH} y2={PT + chartH} stroke="#111" strokeWidth="2" />
                  </svg>
                );
              })()}
            </div>
          </div>

        <div style={{ marginTop: '10px' }} className="animate-slide-up delay-300">
          <div className="dash-section-title">Transaksi Terbaru</div>
          <div className="recent-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No. Transaksi</th>
                  <th>Waktu</th>
                  <th>Kasir</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTrx.length > 0 ? recentTrx.map((trx) => (
                  <tr key={trx.id}>
                    <td data-label="No. Transaksi" style={{ fontWeight: 700 }}>{'TRX-' + String(trx.id).substring(0, 6).toUpperCase()}</td>
                    <td data-label="Waktu">{new Date(trx.created_at || trx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td data-label="Kasir">{trx.cName}</td>
                    <td data-label="Total" className="num">{rp(trx.total_amount || trx.totalAmount)}</td>
                    <td data-label="Status">
                      <span className={`badge ${trx.status === 'voided' ? 'badge-diskon' : 'badge-aktif'}`}>
                        {trx.status === 'voided' ? 'Void' : 'Lunas'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: '#888' }}>
                      {isLoading ? "Memuat transaksi..." : "Belum ada transaksi hari ini."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
