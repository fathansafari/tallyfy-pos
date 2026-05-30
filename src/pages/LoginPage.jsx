import React, { useState, useContext } from 'react';
import { verifyStoreCashier, loginWithGoogle } from '../api/ipc';
import { AuthContext } from '../contexts/AuthContext';
import { ToastContext } from '../contexts/ToastContext';

export default function LoginPage() {
  const { login } = useContext(AuthContext);
  const { addToast } = useContext(ToastContext);

  const [activeTab, setActiveTab] = useState('kasir'); // 'kasir' | 'owner'

  const [storeCode, setStoreCode] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleKasirLogin = async (e) => {
    e.preventDefault();
    if (!storeCode || !username || !pin) {
      addToast('Kode Toko, Username, dan PIN harus diisi', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyStoreCashier(storeCode, username, pin);
      if (res.success) {
        addToast(`Selamat datang, ${res.user.fullname}!`, 'success');
        // Gunakan role asli dari Firestore (res.user.role)
        login(res.user, res.storeCode);
      } else {
        addToast(res.message || 'Login gagal', 'error');
      }
    } catch (err) {
      addToast('Terjadi kesalahan sistem saat login', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOwnerLogin = async () => {
    setIsLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res.success) {
        addToast(`Selamat datang, ${res.user.displayName}! 👋`, 'success');
        login({
          id: res.user.uid,
          fullname: res.user.displayName,
          username: res.user.email,
          role: 'admin'
        }, res.storeCode);
      } else if (!res.cancelled) {
        // Only show error if it's NOT a user-cancelled action
        addToast(res.message || 'Login Google gagal. Silakan coba lagi.', 'error');
      }
      // If res.cancelled === true: user closed popup intentionally — do nothing
    } catch (err) {
      addToast('Terjadi kesalahan saat menghubungkan ke Google.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="page-login" className="page active">
      <div className="login-logo">
        <img src="/logo.png" alt="Tallyfy Logo" width="120" height="120" style={{ width: 'clamp(80px, 20vw, 120px)', display: 'block', margin: '0 auto 12px' }} />
        <h1 className="login-logo h1">
          Tally<span style={{ color: 'var(--accent-yellow)' }}>fy</span><span style={{ color: 'var(--accent-red)', fontSize: '120%', lineHeight: '0.5' }}>.</span>
        </h1>
        <p>Sistem Kasir Pintar (SaaS)</p>
      </div>

      <div className="login-card">
        <div style={{ display: 'flex', borderBottom: 'var(--border-thin)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('kasir')}
            style={{
              flex: 1,
              padding: '20px',
              border: 'none',
              background: activeTab === 'kasir' ? 'var(--primary)' : 'var(--surface-1)',
              color: activeTab === 'kasir' ? 'var(--bg-dark)' : 'var(--text-light)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
              borderRight: 'var(--border-thin)',
              outline: 'none',
              fontSize: '15px'
            }}
          >
            Login Staf
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('owner')}
            style={{
              flex: 1,
              padding: '20px',
              border: 'none',
              background: activeTab === 'owner' ? 'var(--primary)' : 'var(--surface-1)',
              color: activeTab === 'owner' ? 'var(--bg-dark)' : 'var(--text-light)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
              outline: 'none',
              fontSize: '15px'
            }}
          >
            Login Owner
          </button>
        </div>

        <div style={{ padding: 'clamp(20px, 5vw, 40px)' }}>
          {activeTab === 'kasir' ? (
            <form onSubmit={handleKasirLogin} autoComplete="off">
              <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Masuk sebagai Staf (Kasir / Admin)</h2>
              <div className="form-group">
                <label>KODE TOKO</label>
                <input
                  type="text"
                  placeholder="Contoh: TLY-1234"
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }}
                  autoComplete="off"
                  data-lpignore="true"
                />
              </div>
              <div className="form-group">
                <label>USERNAME KASIR</label>
                <input
                  type="text"
                  placeholder="kasir1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  data-lpignore="true"
                />
              </div>
              <div className="form-group">
                <label>PIN / PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPin ? "text" : "password"}
                    placeholder="••••••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    autoComplete="new-password"
                    data-lpignore="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
                  >
                    {showPin ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" disabled={isLoading}>
                {isLoading ? 'MEMPROSES...' : 'MASUK KE KASIR'}
              </button>
            </form>
          ) : (
            <div>
              <h2 style={{ textAlign: 'center', marginBottom: '16px' }}>Pemilik Toko (Admin)</h2>
              <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '24px', lineHeight: '1.6', textAlign: 'center' }}>
                Login menggunakan akun Google Anda untuk mengakses Dasbor Laporan, Manajemen Produk, dan membuat akun staf kasir.
              </p>
              <button
                onClick={handleOwnerLogin}
                disabled={isLoading}
                className="btn btn-lg"
                style={{
                  width: '100%',
                  background: 'var(--surface-1)',
                  color: 'var(--text-light)',
                  border: 'var(--border-thin)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" width="20" height="20" style={{ width: '20px' }} />
                {isLoading ? 'Menghubungkan...' : 'Lanjutkan dengan Google'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="login-footer">
        © 2026 Tallyfy Cloud POS
      </div>
    </div>
  );
}