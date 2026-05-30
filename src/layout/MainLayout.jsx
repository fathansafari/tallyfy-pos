import React, { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { ToastContext } from '../contexts/ToastContext';
import AIBosWidget from '../components/AIBosWidget';

/* ── SVG ICONS ── */
const IconDashboard = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const IconPOS = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);
const IconProduct = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const IconReport = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IconHistory = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="12 8 12 12 14 14"/><circle cx="12" cy="12" r="10"/>
  </svg>
);
const IconUsers = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconSettings = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
  </svg>
);
const IconClock = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconHelp = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconMore = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
  </svg>
);
const IconLogout = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconMenuHamburger = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

export default function MainLayout({ children, activePage, onPageChange }) {
  const { user, storeCode, logout } = useContext(AuthContext);
  const { addToast } = useContext(ToastContext);
  const [time, setTime] = useState(new Date());

  const [activeShift, setActiveShift] = useState(null);
  const [isShiftChecking, setIsShiftChecking] = useState(true);
  const [drawerBalance, setDrawerBalance] = useState(0);

  const [showStartShift, setShowStartShift] = useState(false);
  const [startBalance, setStartBalance] = useState('');
  const [showEndShift, setShowEndShift] = useState(false);
  const [endBalance, setEndBalance] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [isShiftExpired, setIsShiftExpired] = useState(false);
  const [storeName, setStoreName] = useState('');

  // Mobile: "Lainnya" slide-up menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Desktop: sidebar toggle (NO hamburger on mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile && !isSidebarOpen) setIsSidebarOpen(true); // reopen sidebar when going back to desktop
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  useEffect(() => {
    import('../api/ipc').then(({ getSettings }) => {
      getSettings().then(settings => {
        if (settings.shift_templates) setShiftTemplates(JSON.parse(settings.shift_templates));
        if (settings.store_name) setStoreName(settings.store_name);
      }).catch(console.error);
    });
  }, []);

  // Shift timeout & validation
  useEffect(() => {
    if (!user || user.role === 'admin' || !activeShift || !user.shiftId || shiftTemplates.length === 0) return;
    const template = shiftTemplates.find(s => s.id === user.shiftId);
    if (!template || !template.endTime || !template.startTime) return;
    
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = template.startTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const [endH, endM] = template.endTime.split(':').map(Number);
    const endMins = endH * 60 + endM;

    let isExpired = false;
    
    if (startMins < endMins) {
      // Shift normal, misal: 12:00 (720) s/d 18:00 (1080)
      if (nowMins >= endMins || nowMins < startMins) isExpired = true;
    } else {
      // Shift malam/lewat tengah malam, misal: 18:00 (1080) s/d 02:00 (120)
      if (nowMins >= endMins && nowMins < startMins) isExpired = true;
    }

    if (isExpired && !isShiftExpired) {
      setIsShiftExpired(true);
      setShowEndShift(true);
      addToast('Waktu shift Anda telah habis. Silakan tutup shift.', 'warning');
    }
  }, [time, user, activeShift, shiftTemplates, isShiftExpired, addToast]);

  const updateDrawerBalance = (totalAmount) => setDrawerBalance(prev => prev + totalAmount);
  useEffect(() => {
    window.updateDrawerBalance = updateDrawerBalance;
    return () => { delete window.updateDrawerBalance; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) checkActiveShift();
  }, [user]);

  const handlePageChange = useCallback((page) => {
    onPageChange(page);
    setIsMobileMenuOpen(false);
  }, [onPageChange]);

  const checkActiveShift = async () => {
    if (user?.role === 'admin') { setIsShiftChecking(false); return; }
    try {
      const { getActiveShift, getShiftCashSales } = await import('../api/ipc');
      const shift = await getActiveShift(user.id);
      if (shift) {
        setActiveShift(shift);
        window.activeShiftId = shift.id;
        const baseBalance = shift.startBalance || shift.start_balance || 0;
        const shiftSales = await getShiftCashSales(shift.id);
        setDrawerBalance(baseBalance + shiftSales);
      } else {
        setShowStartShift(true);
      }
    } catch (e) {
      console.log('Error checking shift');
    } finally {
      setIsShiftChecking(false);
    }
  };

  const handleStartShift = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const bal = parseInt(parseNum(startBalance)) || 0;
    try {
      const { startShift } = await import('../api/ipc');
      const shift = await startShift(user, bal);
      setActiveShift(shift);
      window.activeShiftId = shift.id;
      setDrawerBalance(bal);
      setShowStartShift(false);
      addToast('Shift dimulai!', 'success');
    } catch (e) {
      addToast('Gagal memulai shift', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndShiftAndLogout = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const bal = parseInt(parseNum(endBalance)) || 0;
    try {
      const { endShift } = await import('../api/ipc');
      await endShift(activeShift.id, bal);
      addToast('Shift ditutup, Anda telah keluar.', 'info');
      setShowEndShift(false);
      setIsShiftExpired(false);
      window.activeShiftId = null;
      logout();
    } catch (e) {
      addToast('Gagal menutup shift', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const attemptLogout = () => {
    setIsMobileMenuOpen(false);
    if (user?.role === 'admin') { logout(); return; }
    if (activeShift) setShowEndShift(true);
    else logout();
  };

  // Expose global actions for Dashboard
  useEffect(() => {
    window.attemptLogout = attemptLogout;
    window.navigateToPage = handlePageChange;
    window.openStartShiftModal = () => setShowStartShift(true);
  });

  const getShiftName = () => {
    const h = time.getHours();
    if (h < 12) return 'Pagi';
    if (h < 17) return 'Siang';
    return 'Malam';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    if (name.toLowerCase() === 'admin') return 'AD';
    if (name.toLowerCase() === 'kasir') return 'KS';
    return name.substring(0, 2).toUpperCase();
  };

  const parseNum = (val) => String(val).replace(/\D/g, '');
  const formatInput = (val) => val ? parseInt(parseNum(val)).toLocaleString('id-ID') : '';
  const isAdmin = user?.role === 'admin';

  if (isShiftChecking) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--black)', color: 'var(--accent-yellow)', fontFamily: 'var(--font-body)', fontSize: '14px', gap: '10px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent-yellow)"/>
        </svg>
        Memuat...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Navigation definitions
  const mainNavItems = [
    { key: 'dashboard', label: 'Dashboard', Icon: IconDashboard },
    { key: 'pos',       label: 'Kasir / POS', Icon: IconPOS },
    { key: 'products',  label: 'Produk', Icon: IconProduct },
    { key: 'reports',   label: 'Laporan', Icon: IconReport },
    { key: 'history',   label: 'Riwayat', Icon: IconHistory },
  ];
  const systemNavItems = [
    ...(isAdmin ? [
      { key: 'users',          label: 'Manajemen Staf', Icon: IconUsers },
      { key: 'shift_settings', label: 'Pengaturan Shift', Icon: IconClock },
    ] : []),
    { key: 'settings', label: 'Pengaturan', Icon: IconSettings },
    { key: 'help',     label: 'Bantuan', Icon: IconHelp },
  ];

  // Bottom nav: 4 main + "More"
  const bottomNavPrimary = [
    { key: 'dashboard', label: 'Beranda', Icon: IconDashboard },
    { key: 'pos',       label: 'Kasir', Icon: IconPOS },
    { key: 'products',  label: 'Produk', Icon: IconProduct },
    { key: 'reports',   label: 'Laporan', Icon: IconReport },
  ];

  // All secondary items for "Lainnya" menu
  const moreNavItems = [
    { key: 'history', label: 'Riwayat Sistem', Icon: IconHistory },
    ...systemNavItems,
  ];

  return (
    <div id="page-app">
      {/* ══════════════════════════════════════
          TOPBAR
      ══════════════════════════════════════ */}
      <div className="topbar">
        {/* Brand */}
        <div className="topbar-brand">
          <img src="/logo.png" alt="Tallyfy" width="42" height="42" style={{ height: '42px', width: '42px', objectFit: 'contain', flexShrink: 0 }} />
          <div className="topbar-brand-text">
            Tally<span style={{ color: 'var(--accent-yellow)' }}>fy</span>
            <span style={{ color: 'var(--accent-red)', fontSize: '120%', lineHeight: '0.5' }}>.</span>
          </div>
        </div>

        {/* Sidebar toggle — DESKTOP ONLY (hidden on mobile via CSS) */}
        <button
          className="topbar-toggle-btn"
          onClick={() => setIsSidebarOpen(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', color: '#666', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          title="Toggle Sidebar"
        >
          <IconMenuHamburger />
        </button>

        {/* Store badge */}
        {storeName && <div className="topbar-store">{storeName}</div>}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* RIGHT GROUP */}
        <div className="topbar-right">
          {/* Drawer balance (kasir only) */}
          {!isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', flexShrink: 0, minWidth: 0, marginRight: '12px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              <span className="topbar-drawer-label" style={{ color: '#666', whiteSpace: 'nowrap' }}>Laci:</span>
              <span className="topbar-drawer-amount" style={{ color: 'var(--accent-green)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px', fontSize: '11px' }}>
                Rp {drawerBalance.toLocaleString('id-ID')}
              </span>
            </div>
          )}

          {/* Shift info */}
          {!isAdmin && (
            <div className="topbar-shift" style={{ marginRight: '12px' }}>Shift: <span>{getShiftName()}</span></div>
          )}

          {/* User badge */}
          <div className="topbar-user">
            <div className="topbar-avatar">{getInitials(user?.fullname)}</div>
            <span id="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px', fontSize: '12px' }}>
              {user?.fullname || 'Admin'}
            </span>
          </div>

          {/* Clock */}
          <div className="topbar-clock">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </div>

          {/* Logout/End shift */}
          <button
            className="btn btn-ghost btn-sm topbar-logout-btn"
            style={{ color: '#aaa', borderColor: '#333', padding: '4px 8px', fontSize: '11px' }}
            onClick={attemptLogout}
          >
            {isAdmin ? 'Keluar' : 'Tutup Shift'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════
          APP BODY
      ══════════════════════════════════════ */}
      <div className="app-body">
        {/* ── SIDEBAR (desktop only, hidden on mobile) ── */}
        <nav
          className="sidebar"
          style={!isMobile && isSidebarOpen
            ? { width: 'var(--sidebar-w)' }
            : isMobile
              ? { width: 0, minWidth: 0, border: 'none', overflow: 'hidden' }
              : { width: 0, minWidth: 0, border: 'none', overflow: 'hidden' }
          }
        >
          <div className="sidebar-section">
            <div className="sidebar-label">Menu Utama</div>
            {mainNavItems.map(({ key, label, Icon }) => (
              <div
                key={key}
                className={`nav-item ${activePage === key ? 'active' : ''}`}
                onClick={() => handlePageChange(key)}
              >
                <Icon size={18} />
                <span className="nav-label">{label}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Sistem</div>
            {systemNavItems.map(({ key, label, Icon }) => (
              <div
                key={key}
                className={`nav-item ${activePage === key ? 'active' : ''}`}
                onClick={() => handlePageChange(key)}
              >
                <Icon size={18} />
                <span className="nav-label">{label}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-bottom">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '6px', height: '6px', background: 'var(--accent-green)', borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ fontSize: '9px', color: '#555', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Sistem Online</div>
              </div>
              <div style={{ fontSize: '10px', color: '#333', fontFamily: 'var(--font-display)', fontWeight: 700 }}>TALLYFY POS v1.0</div>
            </div>
          </div>
        </nav>

        {/* ── MAIN CONTENT ── */}
        <div className="main-content">
          {children}
        </div>
      </div>

      {/* ══════════════════════════════════════
          MOBILE BOTTOM NAVIGATION
      ══════════════════════════════════════ */}
      <nav className="bottom-nav" role="navigation" aria-label="Menu utama">
        {bottomNavPrimary.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`bottom-nav-item ${activePage === key ? 'active' : ''}`}
            onClick={() => handlePageChange(key)}
            aria-label={label}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}

        {/* "Lainnya" opens a slide-up panel */}
        <button
          className={`bottom-nav-item ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={() => setIsMobileMenuOpen(v => !v)}
          aria-label="Menu lainnya"
        >
          <IconMore size={20} />
          <span>Lainnya</span>
        </button>
      </nav>

      {/* ── MOBILE SLIDE-UP "Lainnya" MENU ── */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 'var(--bottom-nav-h)',
              left: 0, right: 0,
              background: 'var(--black)',
              border: '3px solid var(--accent-yellow)',
              borderBottom: 'none',
              animation: 'aiSlideUp 150ms ease-out',
            }}
          >
            <div style={{ padding: '6px 14px 4px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#444', fontFamily: 'var(--font-body)' }}>
              Halaman Lainnya
            </div>

            {moreNavItems.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => handlePageChange(key)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '13px 18px',
                  background: activePage === key ? 'var(--accent-yellow)' : 'transparent',
                  color: activePage === key ? 'var(--black)' : '#bbb',
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: '13px',
                  fontWeight: activePage === key ? 700 : 400,
                  textAlign: 'left', borderBottom: '1px solid #1a1a1a',
                }}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}

            <button
              onClick={attemptLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '13px 18px', background: 'transparent',
                color: 'var(--accent-red)', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 700,
                textAlign: 'left', borderTop: '1px solid #222',
              }}
            >
              <IconLogout size={18} />
              {isAdmin ? 'Keluar' : 'Tutup Shift & Keluar'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          START SHIFT MODAL
      ══════════════════════════════════════ */}
      {showStartShift && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Buka Shift Kasir</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                Halo {user?.fullname}, masukkan nominal kas awal (uang kembalian) di laci Anda sebelum memulai transaksi.
              </p>
              <div className="form-group">
                <label>KAS AWAL LACI (Rp)</label>
                <input
                  type="text"
                  value={formatInput(startBalance)}
                  onChange={(e) => setStartBalance(parseNum(e.target.value))}
                  placeholder="Contoh: 150.000"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={logout} disabled={isProcessing}>Batal & Keluar</button>
              <button className="btn btn-primary" onClick={handleStartShift} disabled={isProcessing}>
                {isProcessing ? 'Memproses...' : 'Buka Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          END SHIFT MODAL
      ══════════════════════════════════════ */}
      {showEndShift && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Tutup Shift {isShiftExpired && <span style={{ color: 'var(--accent-red)', fontSize: '11px', fontWeight: 400 }}>(Waktu Habis)</span>}</h3>
              {!isShiftExpired && (
                <button className="btn btn-icon" onClick={() => setShowEndShift(false)} aria-label="Tutup End Shift">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--surface-1)', padding: '12px', border: 'var(--border-thin)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#666' }}>
                  <span>Saldo Awal:</span>
                  <span>Rp {(activeShift?.startBalance || activeShift?.start_balance || 0).toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#666' }}>
                  <span>Pemasukan Tunai:</span>
                  <span>Rp {Math.max(0, drawerBalance - (activeShift?.startBalance || activeShift?.start_balance || 0)).toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px', borderTop: '1px dashed var(--surface-3)', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Ekspektasi Laci:</span>
                  <span style={{ color: 'var(--accent-green)' }}>Rp {drawerBalance.toLocaleString('id-ID')}</span>
                </div>
              </div>
              <div className="form-group">
                <label>UANG FISIK AKTUAL DI LACI (Rp)</label>
                <input
                  type="text"
                  value={formatInput(endBalance)}
                  onChange={(e) => setEndBalance(parseNum(e.target.value))}
                  placeholder="Jumlah uang tunai real"
                  autoFocus
                />
              </div>
              {endBalance !== '' && (
                <div style={{
                  padding: '9px 12px', fontWeight: 700, fontSize: '13px', textAlign: 'center',
                  background: (parseInt(parseNum(endBalance)) - drawerBalance) < 0 ? '#ffebee' : '#e8f5e9',
                  border: `1px solid ${(parseInt(parseNum(endBalance)) - drawerBalance) < 0 ? '#ffcdd2' : '#c8e6c9'}`,
                  color: (parseInt(parseNum(endBalance)) - drawerBalance) < 0 ? '#c62828' : '#2e7d32',
                }}>
                  Selisih: {((parseInt(parseNum(endBalance)) || 0) - drawerBalance) < 0 ? '-' : '+'}Rp {Math.abs((parseInt(parseNum(endBalance)) || 0) - drawerBalance).toLocaleString('id-ID')}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleEndShiftAndLogout} disabled={isProcessing}>
                {isProcessing ? 'Memproses...' : 'Konfirmasi & Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Bos Widget (admin only) */}
      <AIBosWidget />
    </div>
  );
}