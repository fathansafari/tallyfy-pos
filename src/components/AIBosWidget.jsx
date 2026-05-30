import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { getTransactions, getProducts, getSettings } from '../api/ipc';
import { createAIBosChat, sendChatMessage } from '../api/gemini';
const logoImg = '/logo.png';

const rp = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const nowTime = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const QUICK = [
  'Produk paling laku hari ini?',
  'Stok mana yang hampir habis?',
  'Ringkas omzet hari ini',
];

export default function AIBosWidget() {
  const { user } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showList, setShowList] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [unread, setUnread] = useState(false);
  const chatRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // ── DRAG STATE ──
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origRight: 24, origBottom: 88 });
  const [panelPos, setPanelPos] = useState({ right: 24, bottom: 88 });
  const [triggerPos, setTriggerPos] = useState({ right: 24, bottom: 24 });
  const isDragging = useRef(false);

  const startDrag = useCallback((e) => {
    // Only drag from header (not buttons inside header)
    if (e.target.tagName === 'BUTTON' && !e.target.closest('.drag-handle')) return;
    
    if (e.type !== 'touchstart') {
      e.preventDefault();
    }

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      origRight: panelPos.right,
      origBottom: panelPos.bottom,
    };
    isDragging.current = true;

    const onMove = (ev) => {
      if (!isDragging.current) return;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const dx = cx - dragRef.current.startX;
      const dy = cy - dragRef.current.startY;

      const newRight = Math.max(0, Math.min(window.innerWidth - (isMobile ? 46 : 52), dragRef.current.origRight - dx));
      const newBottom = Math.max(0, Math.min(window.innerHeight - (isMobile ? 46 : 52), dragRef.current.origBottom - dy));

      setPanelPos({ right: newRight, bottom: newBottom });
      // Move trigger button too
      setTriggerPos({ right: newRight, bottom: newBottom });
    };

    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onUp);
  }, [panelPos]);

  // Load sessions per user dari localStorage
  useEffect(() => {
    if (user?.id) {
      try {
        const saved = localStorage.getItem(`tallyfy_ai_sessions_${user.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setSessions(parsed);
          if (parsed.length > 0) setActiveId(parsed[0].id);
        }
        const savedCtx = localStorage.getItem(`tallyfy_ai_ctx_${user.id}`);
        if (savedCtx) setCtx(JSON.parse(savedCtx));
      } catch (e) {}
    }
  }, [user?.id]);

  // Hanya admin
  if (!user || user.role !== 'admin') return null;

  const activeSession = sessions.find(s => s.id === activeId);
  const msgs = activeSession ? activeSession.msgs : [];

  useEffect(() => {
    if (open) {
      setUnread(false);
      initWidget();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy, showList]);

  useEffect(() => {
    if (!ctx || !activeId) return;
    const s = sessions.find(x => x.id === activeId);
    if (!s) return;

    const historyForGroq = s.msgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.text }));

    let historyForGemini = s.msgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));

    while (historyForGemini.length > 0 && historyForGemini[0].role === 'model') {
      historyForGemini.shift();
    }

    chatRef.current = {
      gemini: createAIBosChat(ctx, historyForGemini)
    };
  }, [activeId, ctx]);

  const addMsg = (role, text) => {
    setSessions(prev => {
      if (!activeId) return prev;
      const targetIdx = prev.findIndex(s => s.id === activeId);
      if (targetIdx === -1) return prev;

      const target = prev[targetIdx];
      const newMsgs = [...target.msgs, { role, text, time: nowTime() }];

      let newTopic = target.topic;
      if (role === 'user' && target.msgs.filter(m => m.role === 'user').length === 0) {
        newTopic = text.length > 25 ? text.substring(0, 25) + '...' : text;
      }

      const updated = [...prev];
      updated[targetIdx] = { ...target, msgs: newMsgs, topic: newTopic };

      if (user?.id) localStorage.setItem(`tallyfy_ai_sessions_${user.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const createNewSession = (currentCtx = ctx) => {
    const newId = Date.now().toString();
    const greeting = currentCtx
      ? `Halo ${currentCtx.userName}! Saya Tallyfy AI — asisten bisnis toko kamu.\n\nOmzet hari ini ${rp(currentCtx.omzet)} dari ${currentCtx.trxCount} transaksi. Tanya apa saja!`
      : 'Halo! Ada yang bisa saya bantu?';

    const newS = {
      id: newId,
      topic: 'Percakapan Baru',
      msgs: [{ role: 'assistant', text: greeting, time: nowTime() }]
    };

    setSessions(p => {
      const updated = [newS, ...p];
      if (user?.id) localStorage.setItem(`tallyfy_ai_sessions_${user.id}`, JSON.stringify(updated));
      return updated;
    });
    setActiveId(newId);
    setShowList(false);
  };

  const deleteSession = (e, id) => {
    e.stopPropagation();
    setSessions(p => {
      const updated = p.filter(s => s.id !== id);
      if (user?.id) localStorage.setItem(`tallyfy_ai_sessions_${user.id}`, JSON.stringify(updated));
      if (activeId === id) {
        if (updated.length > 0) setActiveId(updated[0].id);
        else setActiveId(null);
      }
      return updated;
    });
  };

  const initWidget = async () => {
    setFetching(true);
    try {
      const dateStart = new Date();
      dateStart.setDate(dateStart.getDate() - 7);
      dateStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [allTrxs, products, cfg] = await Promise.all([
        getTransactions(dateStart.toISOString(), todayEnd.toISOString()),
        getProducts(),
        getSettings(),
      ]);

      const historyData = {};
      const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });

      let todayTrxs = [];
      allTrxs.forEach(t => {
        const tDate = t.createdAt || t.created_at;
        if (!tDate) return;
        const d = new Date(tDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
        if (!historyData[d]) historyData[d] = { date: d, count: 0, omzet: 0, top: {} };
        historyData[d].count += 1;
        historyData[d].omzet += (t.total_amount || 0);

        (t.items || []).forEach(item => {
          const k = item.name || 'Produk';
          if (!historyData[d].top[k]) historyData[d].top[k] = { name: k, qty: 0 };
          historyData[d].top[k].qty += item.quantity || 1;
        });

        if (d === todayStr) todayTrxs.push(t);
      });

      Object.keys(historyData).forEach(d => {
        const sorted = Object.values(historyData[d].top).sort((a, b) => b.qty - a.qty).slice(0, 3);
        historyData[d].topProducts = sorted.length ? sorted.map(p => `${p.name} (${p.qty})`).join(', ') : '-';
        delete historyData[d].top;
      });

      const omzet = historyData[todayStr]?.omzet || 0;
      const trxCount = historyData[todayStr]?.count || 0;
      const lowStockLimit = parseInt(cfg?.low_stock_alert) || 5;
      const lowStock = products.filter(p => p.status === 'Aktif' && p.stock <= lowStockLimit);

      const prodMap = {};
      todayTrxs.forEach(t => (t.items || []).forEach(item => {
        const k = item.name || 'Produk';
        if (!prodMap[k]) prodMap[k] = { name: k, qty: 0, revenue: 0 };
        prodMap[k].qty += item.quantity || 1;
        prodMap[k].revenue += item.subtotal || 0;
      }));
      const topProducts = Object.values(prodMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

      const context = {
        storeName: cfg?.store_name || 'Toko Saya',
        storeLogo: cfg?.store_logo || null,
        tanggal: todayStr,
        omzet,
        trxCount,
        avgTrx: trxCount > 0 ? omzet / trxCount : 0,
        lowStock,
        topProducts,
        userName: user.fullname || user.username || 'Admin',
        historyData,
      };

      setCtx(context);
      if (user?.id) localStorage.setItem(`tallyfy_ai_ctx_${user.id}`, JSON.stringify(context));

      setSessions(prev => {
        if (prev.length === 0) {
          const newId = Date.now().toString();
          const greeting = `Halo ${context.userName}! Saya Tallyfy AI — asisten bisnis toko kamu.\n\nOmzet hari ini ${rp(context.omzet)} dari ${context.trxCount} transaksi. Tanya apa saja!`;
          const newS = { id: newId, topic: 'Percakapan Baru', msgs: [{ role: 'assistant', text: greeting, time: nowTime() }] };
          if (user?.id) localStorage.setItem(`tallyfy_ai_sessions_${user.id}`, JSON.stringify([newS]));
          setActiveId(newId);
          return [newS];
        }
        return prev;
      });

    } catch (e) {
      if (sessions.length === 0) {
        createNewSession(null);
      }
    } finally {
      setFetching(false);
    }
  };

  const send = async (text = input) => {
    if (!text.trim() || busy) return;
    const msg = text;
    setInput('');
    setBusy(true);

    addMsg('user', msg);

    try {
      if (!chatRef.current) {
        if (ctx) {
          chatRef.current = {
            gemini: createAIBosChat(ctx, [])
          };
        } else {
          addMsg('assistant', 'Sedang memuat data toko... Coba lagi dalam beberapa detik.');
          setBusy(false);
          return;
        }
      }

      let reply = '';
      try {
        reply = await sendChatMessage(chatRef.current.gemini, msg, null);
      } catch (geminiError) {
        console.warn('Gemini gagal', geminiError);
        throw geminiError;
      }

      addMsg('assistant', reply);

    } catch (e) {
      const code = e?.message || '';
      if (code === 'SERVER_BUSY') {
        addMsg('assistant', 'Sesi analisis sedang sibuk. Silakan coba lagi dalam beberapa menit.');
      } else if (code === 'CIRCUIT_OPEN') {
        if (e.fallback) {
          addMsg('assistant', e.fallback);
        } else if (ctx) {
          const tops = ctx.topProducts?.slice(0, 3).map((p, i) => `${i + 1}. ${p.name}`).join(', ') || '-';
          addMsg('assistant', `Layanan AI sedang dalam mode pemulihan (${Math.ceil(e.waitSec / 60)} mnt lagi).\n\nRingkasan Data Toko:\n• Omzet: ${rp(ctx.omzet)}\n• Transaksi: ${ctx.trxCount}\n• Produk terlaris: ${tops}`);
        } else {
          addMsg('assistant', 'Layanan AI sedang dalam mode pemulihan. Mohon tunggu sebentar.');
        }
      } else if (code === 'QUOTA') {
        addMsg('assistant', 'Kapasitas analisis harian telah tercapai. Coba lagi besok atau hubungi administrator.');
      } else if (code === 'INVALID_KEY' || code === 'GROQ_KEY_MISSING') {
        addMsg('assistant', 'Terjadi masalah pada konfigurasi sistem. Hubungi administrator.');
      } else {
        addMsg('assistant', 'Koneksi ke layanan AI terputus. Periksa koneksi internet lalu coba lagi.');
      }
    } finally {
      setBusy(false);
    }
  };

  // Responsive panel size
  const isMobile = window.innerWidth <= 600;
  const panelW = isMobile ? Math.min(window.innerWidth - 16, 300) : 356;
  const panelH = isMobile ? Math.min(window.innerHeight * 0.65, 380) : 520;

  // Clamp positions within viewport for panel
  const clampedRight = Math.max(8, Math.min(window.innerWidth - panelW - 8, panelPos.right));
  const clampedBottom = Math.max(8, Math.min(window.innerHeight - panelH - 8, panelPos.bottom + (isMobile ? 50 : 64)));

  // Determine if it was a click or a drag
  const handleTriggerClick = (e) => {
    // If we moved the cursor more than 3px, treat as drag
    if (isDragging.current) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpen(o => !o);
  };

  return (
    <>
      {/* ── TRIGGER BUTTON ── */}
      <button
        className="drag-handle"
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{
          position: 'fixed',
          bottom: triggerPos.bottom,
          right: triggerPos.right,
          zIndex: 9000,
          width: isMobile ? '46px' : '52px',
          height: isMobile ? '46px' : '52px',
          background: open ? '#111' : 'var(--accent-yellow)',
          border: '2px solid #0A0A0A',
          boxShadow: '4px 4px 0 #0A0A0A',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: open ? '18px' : '22px',
          color: open ? 'var(--accent-yellow)' : '#0A0A0A',
          transition: 'background 80ms ease-out, color 80ms ease-out',
          flexShrink: 0,
        }}
        onClick={handleTriggerClick}
        title="Tallyfy AI (Drag to move)"
      >
        {open ? '✕' : <img src={logoImg} alt="AI" width="38" height="38" style={{ width: isMobile ? '32px' : '38px', height: isMobile ? '32px' : '38px', objectFit: 'contain' }} />}
        {unread && !open && (
          <span style={{
            position: 'absolute', top: '-6px', right: '-6px',
            width: '16px', height: '16px', background: 'var(--accent-red)',
            border: '2px solid #0A0A0A', borderRadius: '50%',
            fontSize: '9px', fontWeight: 700, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>1</span>
        )}
      </button>

      {/* ── CHAT PANEL (DRAGGABLE) ── */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: clampedBottom,
            right: clampedRight,
            zIndex: 8999,
            width: panelW,
            height: panelH,
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: 'calc(100vh - 80px)',
            background: 'var(--surface-0)',
            border: '2px solid #0A0A0A',
            boxShadow: '8px 8px 0 #0A0A0A',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-body)',
            animation: 'aiSlideUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            transformOrigin: 'bottom right',
          }}
        >
          {/* ── HEADER (drag handle) ── */}
          <div
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            style={{
              background: '#0A0A0A',
              borderBottom: '3px solid var(--accent-yellow)',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            {/* Session list toggle / drag handle indicator */}
            <button
              onClick={() => setShowList(!showList)}
              style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
              title="Daftar Sesi"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: '#F5F2EA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Tallyfy AI</div>
              <div style={{ fontSize: '10px', color: '#555', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {showList ? 'Riwayat Sesi' : (ctx?.storeName || '...')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              {!showList && (
                <button
                  onClick={() => createNewSession(ctx)}
                  style={{ background: 'transparent', border: '1px solid #2a2a2a', color: 'var(--accent-yellow)', width: '26px', height: '26px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                  title="Percakapan Baru"
                >+</button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#888', width: '26px', height: '26px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
          </div>

          {showList ? (
            /* Session List */
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface-0)' }}>
              <div style={{ padding: '10px 14px', borderBottom: '2px solid #0A0A0A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13px' }}>Riwayat Percakapan</strong>
                <button
                  onClick={() => createNewSession(ctx)}
                  style={{ background: 'var(--accent-yellow)', border: '1.5px solid #0A0A0A', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '2px 2px 0 #0A0A0A' }}
                >+ Sesi Baru</button>
              </div>
              {sessions.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '12px' }}>Belum ada sesi obrolan.</div>
              ) : (
                sessions.map(s => (
                  <div
                    key={s.id}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--surface-2)',
                      background: s.id === activeId ? 'var(--surface-1)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                    onClick={() => { setActiveId(s.id); setShowList(false); }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0A0A0A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.topic}</div>
                      <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>{s.msgs.length} pesan</div>
                    </div>
                    <button
                      onClick={(e) => deleteSession(e, s.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: '4px', fontSize: '14px', flexShrink: 0 }}
                      title="Hapus sesi"
                    >🗑</button>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Chat View */
            <>
              {/* Context bar */}
              {ctx && (
                <div style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '5px 12px', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, overflowX: 'auto' }}>
                  <span style={{ fontSize: '10px', color: '#444', whiteSpace: 'nowrap' }}>Omzet <strong style={{ color: 'var(--accent-yellow)' }}>{rp(ctx.omzet)}</strong></span>
                  <span style={{ width: '1px', height: '12px', background: '#2a2a2a', flexShrink: 0 }} />
                  <span style={{ fontSize: '10px', color: '#444', whiteSpace: 'nowrap' }}>Trx <strong style={{ color: 'var(--accent-yellow)' }}>{ctx.trxCount}</strong></span>
                  {ctx.lowStock?.length > 0 && (
                    <>
                      <span style={{ width: '1px', height: '12px', background: '#2a2a2a', flexShrink: 0 }} />
                      <span style={{ fontSize: '10px', color: 'var(--accent-red)', fontWeight: 600, whiteSpace: 'nowrap' }}>⚠ {ctx.lowStock.length} stok kritis</span>
                    </>
                  )}
                </div>
              )}

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                {fetching && <div style={{ textAlign: 'center', color: '#888', fontSize: '12px', padding: '24px' }}>Memuat data toko...</div>}

                {msgs.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      background: m.role === 'user' ? 'var(--accent-yellow)' : '#fff',
                      border: '1.5px solid #0A0A0A', boxShadow: '2px 2px 0 #0A0A0A',
                      padding: '8px 11px', maxWidth: '85%', fontSize: '12px', lineHeight: '1.65',
                      color: '#0A0A0A', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>{m.text}</div>
                    <div style={{ fontSize: '10px', color: 'var(--surface-3)', marginTop: '2px', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>{m.time}</div>
                  </div>
                ))}

                {busy && (
                  <div style={{ display: 'flex', gap: '5px', padding: '10px 14px', background: 'var(--surface-1)', border: '1.5px solid #0A0A0A', alignSelf: 'flex-start', boxShadow: '2px 2px 0 #0A0A0A' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: '7px', height: '7px', background: 'var(--surface-3)', borderRadius: '50%', animation: `aiBounce 1s ${i * 0.2}s ease-in-out infinite` }} />
                    ))}
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Quick replies */}
              {msgs.length <= 1 && !busy && !fetching && (
                <div style={{ padding: '6px 10px', display: 'flex', gap: '5px', flexWrap: 'wrap', flexShrink: 0, borderTop: '1px solid var(--surface-2)' }}>
                  {QUICK.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => send(q)}
                      disabled={busy || fetching}
                      style={{ background: 'var(--surface-1)', border: '1.5px solid #0A0A0A', padding: '3px 9px', fontSize: '11px', fontFamily: 'var(--font-body)', cursor: 'pointer', color: '#0A0A0A', fontWeight: 500 }}
                    >{q}</button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{ padding: '8px 10px', borderTop: '2px solid #0A0A0A', display: 'flex', gap: '6px', background: 'var(--surface-1)', flexShrink: 0 }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Tanya soal penjualan, stok, omzet..."
                  disabled={busy || fetching || !activeId}
                  style={{ flex: 1, border: '1.5px solid #0A0A0A', background: 'var(--surface-0)', padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: '12px', color: '#0A0A0A', outline: 'none', height: '38px', minWidth: 0 }}
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || busy || fetching || !activeId}
                  style={{ background: input.trim() && !busy ? 'var(--accent-yellow)' : 'var(--surface-2)', border: '2px solid #0A0A0A', boxShadow: input.trim() && !busy ? '3px 3px 0 #0A0A0A' : 'none', cursor: input.trim() && !busy ? 'pointer' : 'not-allowed', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0, transition: 'all 80ms' }}
                >➤</button>
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{ background: '#0A0A0A', padding: '3px 12px', borderTop: '1px solid #1a1a1a', fontSize: '9px', color: '#333', textAlign: 'center', fontFamily: 'var(--font-body)', flexShrink: 0 }}>
            Powered by <span style={{ color: '#f55036', fontWeight: 'bold' }}>Groq Llama 3</span>
          </div>
        </div>
      )}
    </>
  );
}
