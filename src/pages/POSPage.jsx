import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import { listenProducts, subscribeSettings, createTransaction, addTransactionItem, listenCategories } from '../api/ipc';
import { AuthContext } from '../contexts/AuthContext';
import { ToastContext } from '../contexts/ToastContext';
import ReceiptPreview, { KitchenReceiptPreview } from '../components/ReceiptPreview';
import { connectBluetoothPrinter, printTextViaBluetooth } from '../utils/bluetoothPrinter';

import { emitSale } from '../utils/eventBus';

const IconMessage = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
);
const IconPrinter = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
);
const IconCopy = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
);
const IconFileText = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
);
const IconEye = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconInfo = ({ size = 20, style }) => (
  <svg width={size} height={size} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
);

export default function POSPage({ isAdmin }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['Semua']);
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cart, setCart] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [successMobileTab, setSuccessMobileTab] = useState('actions'); // 'actions' | 'preview'

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [discountInput, setDiscountInput] = useState('');
  const [discountType, setDiscountType] = useState('rp');

  // ─── Order info ────────────────────────────────────────────
  const [orderType, setOrderType] = useState('Dine In');
  const [tableNumber, setTableNumber] = useState('');
  const [pax, setPax] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // ─── Hold Order (Simpan Sementara) ─────────────────────────
  const [heldOrders, setHeldOrders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('heldOrders') || '[]'); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('heldOrders', JSON.stringify(heldOrders)); }, [heldOrders]);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdName, setHoldName] = useState('');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const [stockAlertModal, setStockAlertModal] = useState({ isOpen: false, productName: '' });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [variantModalState, setVariantModalState] = useState({ isOpen: false, product: null, parsedVariants: [] });
  const [payAmount, setPayAmount] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [lastTrxId, setLastTrxId] = useState('');
  const [lastPayMethod, setLastPayMethod] = useState('Tunai');
  const [lastCart, setLastCart] = useState([]);
  const [lastTotals, setLastTotals] = useState({ subtotal: 0, discount: 0, service: 0, tax: 0, total: 0, paid: 0, change: 0 });
  const [lastOrderInfo, setLastOrderInfo] = useState({});

  const { user } = useContext(AuthContext);
  const { addToast } = useContext(ToastContext);

  // ─ Guard: prevent double-submission (ref avoids re-render lag)
  const isProcessingRef = useRef(false);

  const [storeSettings, setStoreSettings] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [mobileTab, setMobileTab] = useState('catalog'); // 'catalog' | 'cart'
  const [successTab, setSuccessTab] = useState('customer'); // 'customer' | 'kitchen'


  useEffect(() => {
    const unsubscribeSettings = subscribeSettings((data) => {
      setStoreSettings(data);
    });

    const unsubscribeProducts = listenProducts((data) => {
      setProducts(data);
    });

    const unsubscribeCats = listenCategories((catsData) => {
      if (Array.isArray(catsData)) {
         setCategories(['Semua', ...catsData.filter(c => c && c.name).map(c => c.name)]);
      }
    });

    return () => {
      unsubscribeSettings();
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeCats) unsubscribeCats();
    };
  }, []);

  const rp = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchCat = activeCategory === 'Semua' || p.category === activeCategory;
    const matchQ = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return p.status === 'Aktif' && matchCat && matchQ;
  });

  // Cart operations
  const addToCart = (product) => {
    if (storeSettings?.require_shift !== 'false' && !window.activeShiftId && user?.role !== 'admin') {
      addToast('Anda harus membuka shift terlebih dahulu!', 'error');
      return;
    }

    if (storeSettings?.auto_deduct_stock !== 'false') {
      const currentQty = cart.filter(i => i.id === product.id).reduce((sum, i) => sum + i.qty, 0);
      if (currentQty >= product.stock) {
        setStockAlertModal({ isOpen: true, productName: product.name });
        return;
      }
    }

    let parsedVariants = [];
    try {
      if (product.variants) parsedVariants = JSON.parse(product.variants);
    } catch(e) {}
    
    if (parsedVariants && parsedVariants.length > 0) {
      setVariantModalState({ isOpen: true, product, parsedVariants });
      return;
    }
    
    doAddToCart(product, null, 0);
  };

  const doAddToCart = (product, variantName, priceOffset) => {
    setCart(prev => {
      // Find existing item with same id AND same variant
      const existing = prev.find(item => item.id === product.id && (item.variant || '') === (variantName || ''));
      if (existing) {
        return prev.map(item => (item.id === product.id && (item.variant || '') === (variantName || '')) ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, price: product.price + (priceOffset || 0), variant: variantName || '', qty: 1, originalId: product.id }];
    });
    
    // Jump animation
    const payBtn = document.getElementById('pay-btn');
    if (payBtn) {
      payBtn.style.transform = 'scale(1.04)';
      setTimeout(() => payBtn.style.transform = '', 150);
    }
  };

  const changeQty = (id, delta, variant = '') => {
    if (delta > 0 && storeSettings?.auto_deduct_stock !== 'false') {
      const product = products.find(p => p.id === id);
      if (product) {
        const currentQty = cart.filter(i => i.id === id).reduce((sum, i) => sum + i.qty, 0);
        if (currentQty + delta > product.stock) {
          setStockAlertModal({ isOpen: true, productName: product.name });
          return;
        }
      }
    }

    setCart(prev => prev.map(item => {
      if (item.id === id && (item.variant || '') === variant) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id, variant = '') => {
    setCart(prev => prev.filter(item => !(item.id === id && (item.variant || '') === variant)));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountInput('');
    setDiscountType('rp');
  };

  const handleHoldOrder = () => {
    if (!holdName) return;
    const newHold = {
      id: Date.now(),
      name: holdName,
      time: new Date().toISOString(),
      cart: [...cart],
      discountInput,
      discountType,
      orderInfo: { orderType, tableNumber, pax, customerName, customerPhone }
    };
    setHeldOrders(prev => [...prev, newHold]);
    clearCart();
    setCustomerName(''); setCustomerPhone(''); setTableNumber(''); setPax(1);
    setIsHoldModalOpen(false);
    setHoldName('');
    addToast('Pesanan disimpan: ' + holdName, 'info');
  };

  const handleRestoreOrder = (heldOrder) => {
    if (cart.length > 0 && !window.confirm('Keranjang saat ini tidak kosong! Yakin ingin menimpa keranjang saat ini dengan pesanan yang dipulihkan?')) {
      return;
    }
    setCart(heldOrder.cart);
    setDiscountInput(heldOrder.discountInput);
    setDiscountType(heldOrder.discountType);
    setOrderType(heldOrder.orderInfo.orderType || 'Dine In');
    setTableNumber(heldOrder.orderInfo.tableNumber || '');
    setPax(heldOrder.orderInfo.pax || 1);
    setCustomerName(heldOrder.orderInfo.customerName || '');
    setCustomerPhone(heldOrder.orderInfo.customerPhone || '');
    
    setHeldOrders(prev => prev.filter(h => h.id !== heldOrder.id));
    setIsRestoreModalOpen(false);
    addToast('Pesanan dipulihkan', 'success');
  };

  // Cart Totals (with service charge & tax)
  const cartSubtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const discountVal  = parseInt(discountInput) || 0;
  const discount     = discountType === 'pct' ? Math.round(cartSubtotal * (discountVal / 100)) : discountVal;
  const serviceRate  = parseFloat(storeSettings?.service_rate || 0);
  const taxRate      = storeSettings?.enable_tax === 'false' ? 0 : parseFloat(storeSettings?.tax_rate || 0);
  const serviceCharge = Math.round((cartSubtotal - discount) * (serviceRate / 100));
  const taxAmount     = Math.round((cartSubtotal - discount + serviceCharge) * (taxRate / 100));
  const cartTotal    = Math.max(0, cartSubtotal - discount + serviceCharge + taxAmount);
  const totalItems   = cart.reduce((acc, item) => acc + item.qty, 0);

  // Per-item note/variant editor
  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const updateItemNote = (idx, field, val) => {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  // Payment Numpad — support keyboard
  const handleNumpad = useCallback((v) => {
    if (v === 'del') {
      setPayAmount(prev => prev.slice(0, -1));
    } else {
      setPayAmount(prev => (prev === '0' ? '' : prev) + v);
    }
  }, []);

  // Keyboard event for numpad modal
  useEffect(() => {
    if (!isPaymentModalOpen || paymentSuccess) return;
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') handleNumpad(e.key);
      else if (e.key === 'Backspace') handleNumpad('del');
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (isProcessingRef.current) return; // block double Enter
        const paid = parseInt(payAmount) || 0;
        if (paid >= cartTotal) handleConfirmPayment();
      }
      else if (e.key === 'Escape') setIsPaymentModalOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPaymentModalOpen, paymentSuccess, payAmount, cartTotal]);

  const handleSetAmount = (amount) => setPayAmount(String(amount));
  const fmtNum = (n) => Math.round(n || 0).toLocaleString('id-ID');

  const parseNum = (val) => String(val).replace(/\D/g, '');
  const formatInput = (val) => val ? parseInt(parseNum(val)).toLocaleString('id-ID') : '';

  // ─── Receipt HTML Builders ────────────────────────────────
  const rpFmt = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
  const fmtDate = (d) => d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  const dash = () => `<div style="border-top:1px dashed #bbb;margin:6px 0"></div>`;

  const buildCustomerReceipt = (trxId, items, totals, method, orderInfo, cfg) => {
    const now = new Date();
    const paperWidth = cfg?.receipt_width || '80';
    const mmWidth = paperWidth === '58' ? '58mm' : paperWidth === '114' ? '114mm' : '80mm';
    const fontSize = paperWidth === '58' ? '10px' : '11px';
    const storeName  = cfg?.store_name  || 'WARUNG POS';
    const storeAddr  = cfg?.store_address || '';
    const storeSub   = cfg?.store_tagline || '';
    const storeLogo  = cfg?.store_logo ? `<div style="margin-bottom:8px"><img src="${cfg.store_logo}" width="80" height="60" style="max-width:80px;max-height:60px;object-fit:contain" /></div>` : `<div style="width:48px;height:48px;border-radius:50%;border:2px solid #111;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:20px">🍽</div>`;
    const storePhone = cfg?.store_phone || '';
    const storeEmail = cfg?.store_email || '';
    const storeInstagram = cfg?.store_instagram || '';
    const storeFacebook = cfg?.store_facebook || '';
    const storeTikTok = cfg?.store_tiktok || '';
    const trxNo = trxId.startsWith('INV-') || trxId.startsWith('TRX-') ? trxId : `TRX-${String(trxId).substring(0, 6).toUpperCase()}`;
    const svcRate = parseFloat(cfg?.service_rate || 0);
    const taxRateVal = parseFloat(cfg?.tax_rate || 0);

    const itemsHtml = items.map(item => `
      <div style="margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:bold">
          <span>${item.name} x${item.qty}</span>
          <span>${rpFmt(item.price * item.qty)}</span>
        </div>
        ${item.variant ? `<div style="font-size:10px;color:#555;margin-left:2px">${item.variant}</div>` : ''}
        ${item.notes   ? `<div style="font-size:10px;color:#555;margin-left:2px">Notes: ${item.notes}</div>` : ''}
      </div>`).join('');

    const bars = [1,2,1,3,1,1,2,1,3,1,2,1,1,2,1,3,1,2,1,1,2];
    const barcodeHtml = `<div style="display:inline-flex;gap:1px;height:28px;align-items:flex-end;justify-content:center">
      ${bars.map((w,i)=>`<div style="width:${w*2}px;height:${i%3===0?28:i%3===1?22:16}px;background:#111"></div>`).join('')}
    </div><div style="font-size:9px;color:#aaa;letter-spacing:2px;margin-top:3px">${trxNo}</div>`;

    return `<div style="font-family:'Courier New',monospace;font-size:${fontSize};color:#111;width:${mmWidth};max-width:${mmWidth};background:#fff;padding:4px 18px 16px;border:2px solid #0A0A0A;box-sizing:border-box;">
      <!-- perforated top -->
      <div style="height:10px;background:radial-gradient(circle at 6px 50%,#f5f2ea 6px,transparent 6px);background-size:12px 100%;background-repeat:repeat-x;border-bottom:1px dashed #ccc;margin:0 -18px"></div>

      <!-- Store header -->
      <div style="text-align:center;margin:8px 0">
        ${storeLogo}
        <div style="font-size:16px;font-weight:bold;letter-spacing:3px;margin-bottom:2px">${storeName}</div>
        ${storeSub  ? `<div style="font-size:11px;color:#444;margin-bottom:2px">${storeSub}</div>` : ''}
        ${storeAddr ? `<div style="font-size:10px;color:#777;line-height:1.5">${storeAddr}</div>` : ''}
        ${storePhone ? `<div style="font-size:10px;color:#777">Telp: ${storePhone}</div>` : ''}
        ${storeEmail ? `<div style="font-size:10px;color:#777">${storeEmail}</div>` : ''}
      </div>

      <!-- Order type banner -->
      <div style="text-align:center;font-weight:bold;font-size:13px;padding:6px 0;border-top:1px dashed #bbb;border-bottom:1px dashed #bbb;margin:8px 0;letter-spacing:0.5px">
        ${orderInfo.orderType || 'Dine In'}${orderInfo.tableNumber ? ` / Meja ${orderInfo.tableNumber}` : ''} / Pax ${orderInfo.pax || 1}
      </div>

      <!-- Meta grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:11px;margin-bottom:8px">
        <div><div style="font-size:10px;color:#777">Tanggal</div><div style="font-weight:bold">${fmtDate(now)}</div></div>
        <div style="text-align:right"><div style="font-size:10px;color:#777">Kasir</div><div style="font-weight:bold">${orderInfo.cashierName || 'Kasir'}</div></div>
        <div><div style="font-size:10px;color:#777">Jam</div><div style="font-weight:bold">${now.toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})}</div></div>
        <div style="text-align:right"><div style="font-size:10px;color:#777">No. Transaksi</div><div style="font-weight:bold;font-size:10px">${trxNo}</div></div>
        <div style="grid-column:1/-1"><div style="font-size:10px;color:#777">Pelanggan</div><div style="font-weight:bold">${orderInfo.customerName || '-'}${orderInfo.customerPhone ? `<br/>${orderInfo.customerPhone}` : ''}</div></div>
      </div>

      ${dash()}

      <!-- Items -->
      <div style="margin-bottom:8px">${itemsHtml}</div>

      ${dash()}

      <!-- Payment Details -->
      <div style="font-weight:bold;font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Rincian Pembayaran</div>
      <div style="font-size:11px;display:flex;flex-direction:column;gap:2px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between"><span style="color:#555">Subtotal</span><span style="font-weight:bold">${rpFmt(totals.subtotal)}</span></div>
        ${totals.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span style="color:#555">Diskon</span><span style="font-weight:bold;color:#c0392b">-${rpFmt(totals.discount)}</span></div>` : ''}
        ${svcRate > 0 ? `<div style="display:flex;justify-content:space-between"><span style="color:#555">Biaya Layanan</span><span style="font-weight:bold">${svcRate}% / ${rpFmt(totals.service)}</span></div>` : ''}
        ${(cfg?.enable_tax !== 'false' && taxRateVal > 0) ? `<div style="display:flex;justify-content:space-between"><span style="color:#555">Pajak PB1</span><span style="font-weight:bold">${taxRateVal}% / ${rpFmt(totals.tax)}</span></div>` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border-top:1px dashed #bbb;padding-top:6px;margin-bottom:10px">
        <span>Total</span><span>${rpFmt(totals.total)}</span>
      </div>

      ${dash()}

      <!-- Payment Method -->
      <div style="font-weight:bold;font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Metode Pembayaran</div>
      <div style="font-size:11px;display:flex;flex-direction:column;gap:2px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between"><span style="color:#555">${method}</span><span style="font-weight:bold">${rpFmt(totals.paid)}</span></div>
        ${method.toLowerCase().includes('qris') ? '' : `<div style="display:flex;justify-content:space-between"><span style="color:#555">Kembalian</span><span style="font-weight:bold">${rpFmt(Math.max(0, totals.change))}</span></div>`}
      </div>

      ${dash()}

      <!-- Footer -->
      <div style="text-align:center;font-size:11px">
        <div style="font-weight:bold;margin-bottom:2px">LUNAS</div>
        <div style="color:#555;margin-bottom:8px">${fmtDate(now)} - ${now.toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})}</div>
        <div style="color:#555;margin-bottom:${storeInstagram||storeFacebook||storeTikTok ? '8px' : '12px'}">${cfg?.receipt_footer || 'Terima kasih atas kunjungan Anda!'}</div>
        ${(storeInstagram||storeFacebook||storeTikTok) ? `<div style="border-top:1px dashed #ddd;padding-top:6px;margin-bottom:10px;font-size:10px;display:flex;flex-direction:column;gap:4px">${storeInstagram ? `<div style="color:#555;display:flex;align-items:center;gap:4px;justify-content:center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>${storeInstagram}</div>` : ''}${storeFacebook ? `<div style="color:#555;display:flex;align-items:center;gap:4px;justify-content:center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>${storeFacebook}</div>` : ''}${storeTikTok ? `<div style="color:#555;display:flex;align-items:center;gap:4px;justify-content:center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>${storeTikTok}</div>` : ''}</div>` : ''}
        <div style="overflow:hidden">${barcodeHtml}</div>
      </div>

      <!-- cut line -->
      <div style="position:relative;border-top:1px dashed #bbb;margin-top:8px">
        <span style="position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:#fff;padding:0 8px;font-size:14px;color:#aaa">✂</span>
      </div>
    </div>`;
  };

  const buildKitchenTicket = (trxId, items, method, orderInfo, cfg) => {
    const now = new Date();
    const paperWidth = cfg?.receipt_width || '80';
    const mmWidth = paperWidth === '58' ? '58mm' : paperWidth === '114' ? '114mm' : '80mm';
    const fontSize = paperWidth === '58' ? '10px' : '11px';
    const timeStr = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const trxNo = trxId.startsWith('INV-') || trxId.startsWith('TRX-') ? trxId : `TRX-${String(trxId).substring(0, 6).toUpperCase()}`;
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    const allNotes = items.filter(i => i.notes).map(i => i.notes).join(' · ');

    const itemsHtml = items.map(item => `
      <div style="margin-bottom:10px">
        <div style="font-weight:bold;font-size:15px">${item.qty} x ${item.name}</div>
        ${item.variant ? `<div style="font-size:12px;padding-left:20px;color:#333">→ ${item.variant}</div>` : ''}
        ${item.notes   ? `<div style="font-size:12px;padding-left:20px;font-style:italic;color:#444">★ ${item.notes}</div>` : ''}
      </div>`).join('');

    return `<div style="font-family:'Courier New',monospace;font-size:${fontSize};color:#111;width:${mmWidth};max-width:${mmWidth};background:#fff;padding:8px 20px 16px;border:3px solid #111">
      <!-- perforated top dark -->
      <div style="height:10px;background:radial-gradient(circle at 6px 50%,#e8e8e8 6px,transparent 6px);background-size:12px 100%;background-repeat:repeat-x;border-bottom:1px dashed #ccc;margin:0 -20px"></div>

      <div style="text-align:center;font-weight:bold;font-size:20px;letter-spacing:3px;padding:12px 0 10px;border-bottom:2px solid #111;margin-bottom:10px">PESANAN</div>

      <div style="font-size:13px;line-height:1.9;margin-bottom:4px">
        <div style="display:flex;gap:4px"><span style="min-width:100px;font-weight:bold">Pelanggan</span><span>: ${orderInfo?.customerName || '-'} ${orderInfo?.customerPhone ? `(${orderInfo?.customerPhone})` : ''}</span></div>
        <div style="display:flex;gap:4px"><span style="min-width:100px;font-weight:bold">Meja</span><span>: ${orderInfo?.tableNumber || '-'} / Pax ${orderInfo?.pax || 1}</span></div>
        <div style="display:flex;gap:4px"><span style="min-width:100px;font-weight:bold">Waktu</span><span>: ${timeStr}</span></div>
        <div style="display:flex;gap:4px"><span style="min-width:100px;font-weight:bold">Kasir</span><span>: ${orderInfo?.cashierName || 'Kasir'}</span></div>
      </div>

      <div style="background:#111;color:#fff;text-align:center;font-weight:bold;font-size:13px;padding:5px 0;letter-spacing:2px;margin:8px 0">
        ★ ${(orderInfo?.orderType || 'DINE IN').toUpperCase()} ★
      </div>

      <div style="border-top:1px dashed #bbb;margin:6px 0"></div>
      <div style="margin-bottom:8px">${itemsHtml}</div>
      <div style="border-top:1px dashed #bbb;margin:6px 0"></div>

      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-bottom:8px">
        <span>Total QTY</span><span>: ${totalQty}</span>
      </div>

      <div style="border-top:1px dashed #bbb;margin:6px 0"></div>
      ${allNotes
        ? `<div style="border:2px solid #111;padding:8px 12px;text-align:center;font-weight:bold;font-size:13px;margin-top:4px">📝 ${allNotes}</div>`
        : `<div style="text-align:center;font-size:11px;color:#aaa;margin-top:4px;font-style:italic">Tidak ada catatan khusus</div>`}

      <div style="position:relative;border-top:2px dashed #bbb;margin-top:10px">
        <span style="position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:#fff;padding:0 8px;font-size:14px;color:#aaa">✂</span>
      </div>
    </div>`;
  };

  const processTransaction = async (method) => {
    // ─ Hard guard: ignore if already in-flight ─
    if (isProcessingRef.current) {
      console.warn('processTransaction already running, ignoring duplicate call');
      return;
    }
    isProcessingRef.current = true;
    try {
      const paid = parseInt(payAmount) || cartTotal;
      const change = Math.max(0, paid - cartTotal);
      
      const extraOptions = {
        customerName,
        customerPhone,
        tableNumber,
        pax,
        orderType,
        serviceCharge,
        taxAmount,
        cartSubtotal
      };

      const transactionNote = cart.filter(item => item.notes).map(item => `${item.name}: ${item.notes}`).join(' | ') || '';

      const trxResult = await createTransaction(
        cart,
        method,
        cartTotal,
        paid,
        change,
        user?.id || 1,
        window.activeShiftId || null,
        discount,
        transactionNote,
        extraOptions
      );
      
      const newTrxId = trxResult.id;
      setLastTrxId(`TRX-${String(newTrxId).substring(0, 6).toUpperCase()}`);
      setLastPayMethod(method);
      setLastCart([...cart]);
      setLastOrderInfo({ customerName, customerPhone, tableNumber, pax, orderType });
      setLastTotals({ subtotal: cartSubtotal, discount, service: serviceCharge, tax: taxAmount, total: cartTotal, paid, change: Math.max(0, paid - cartTotal) });
      setPaymentSuccess(true);

      // ── Notify all other pages (Dashboard, Products) ──────────────
      emitSale({ trxId: newTrxId, total: cartTotal, itemCount: cart.length });
      // Update drawer balance in topbar (only cash portion goes to drawer)
      if (method.includes('Tunai') || method === 'Tunai') {
        const cashPortion = method.startsWith('Split') ? paid : Math.min(paid, cartTotal);
        if (window.updateDrawerBalance) window.updateDrawerBalance(cashPortion);
      }
      // Auto-print customer receipt + kitchen ticket (bersamaan)
      setTimeout(async () => {
        try {
          const { getSettings, printReceipt } = await import('../api/ipc');
          const cfg = await getSettings();
          
          if (cfg?.auto_print === 'false') {
            return;
          }
          
          const oInfo = { customerName, customerPhone, tableNumber, pax, orderType, cashierName: user?.name || user?.username || 'Kasir' };

          // 1️⃣ Struk pelanggan — full design
          const customerHtml = buildCustomerReceipt(newTrxId, cart, { subtotal: cartSubtotal, discount, service: serviceCharge, tax: taxAmount, total: cartTotal, paid: parseInt(payAmount) || cartTotal, change: Math.max(0, (parseInt(payAmount) || cartTotal) - cartTotal) }, method, oInfo, cfg);
          await printReceipt({ html: customerHtml, printerName: cfg?.printer_name || '', paperWidth: cfg?.receipt_width || '80' });

          // 2️⃣ Tiket dapur — bersamaan ke kitchen printer
          const kitchenHtml = buildKitchenTicket(newTrxId, cart, method, oInfo, cfg);
          const kitchenPrinter = cfg?.kitchen_printer_name || cfg?.printer_name || '';
          if (cfg?.print_kitchen_ticket !== 'false') {
            await printReceipt({ html: kitchenHtml, printerName: kitchenPrinter, paperWidth: cfg?.receipt_width || '80' });
          }
        } catch(e) {
          console.warn('Auto-print failed:', e);
        }
      }, 700);
    } catch (err) {
      addToast('Gagal memproses pembayaran', 'error');
      console.error('Transaction error:', err);
    } finally {
      // Always release the guard so next transaction can proceed
      isProcessingRef.current = false;
    }
  };

  const handleConfirmPayment = async () => {
    const paid = parseInt(payAmount) || 0;
    if (paid < cartTotal) {
      addToast('Pembayaran tunai kurang!', 'error');
      return;
    }
    await processTransaction('Tunai');
  };

  const handleConfirmQRIS = async () => {
    const paid = parseInt(payAmount) || 0;
    if (paid > 0 && paid < cartTotal) {
      // Split payment
      setPayAmount(String(cartTotal)); // Lunas otomatis untuk display struk
      await processTransaction(`Split (Tunai ${rp(paid)} + QRIS)`);
    } else {
      setPayAmount(String(cartTotal)); // Lunas otomatis
      await processTransaction('QRIS');
    }
  };

  const finishPayment = () => {
    clearCart();
    setIsPaymentModalOpen(false);
    isProcessingRef.current = false; // unlock for next transaction
    setTimeout(() => {
      setPaymentSuccess(false);
      setPayAmount('');
    }, 300);
    addToast('Transaksi selesai!', 'success');
  };

  const buildTextReceipt = (isKitchen) => {
    const now = new Date();
    const storeName = storeSettings?.store_name || 'WARUNG POS';
    const storeAddr = storeSettings?.store_address || '';
    const storePhone = storeSettings?.store_phone || '';
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });

    if (isKitchen) {
      let text = `=========================\n`;
      text += `        TICKET DAPUR     \n`;
      text += `=========================\n`;
      text += `No. Trx  : ${lastTrxId}\n`;
      text += `Waktu    : ${dateStr} ${timeStr}\n`;
      text += `Pelanggan: ${lastOrderInfo?.customerName || '-'}\n`;
      text += `Tipe     : ${lastOrderInfo?.orderType || 'Dine In'}${lastOrderInfo?.tableNumber ? ` (Meja ${lastOrderInfo.tableNumber})` : ''}\n`;
      text += `-------------------------\n`;
      lastCart.forEach(item => {
        text += `- ${item.qty}x ${item.name}\n`;
        if (item.variant) text += `  Variant: ${item.variant}\n`;
        if (item.notes) text += `  Catatan: ${item.notes}\n`;
      });
      text += `-------------------------\n`;
      text += `Total Qty: ${lastCart.reduce((acc, i) => acc + i.qty, 0)}\n`;
      text += `=========================\n`;
      return text;
    } else {
      let text = `=========================\n`;
      text += `      ${storeName.toUpperCase()}      \n`;
      if (storeAddr) text += `  ${storeAddr}\n`;
      if (storePhone) text += `  Telp: ${storePhone}\n`;
      text += `=========================\n`;
      text += `No. Trx  : ${lastTrxId}\n`;
      text += `Tanggal  : ${dateStr}\n`;
      text += `Waktu    : ${timeStr}\n`;
      text += `Kasir    : ${user?.fullname || user?.username || 'Kasir'}\n`;
      text += `Pelanggan: ${lastOrderInfo?.customerName || '-'}\n`;
      text += `-------------------------\n`;
      lastCart.forEach(item => {
        text += `${item.name} x${item.qty}\n`;
        if (item.variant) text += `  [${item.variant}]\n`;
        text += `  @ ${rp(item.price)} = ${rp(item.price * item.qty)}\n`;
      });
      text += `-------------------------\n`;
      text += `Subtotal  : ${rp(lastTotals.subtotal)}\n`;
      if (lastTotals.discount > 0) text += `Diskon    : -${rp(lastTotals.discount)}\n`;
      if (lastTotals.service > 0) text += `Layanan   : ${rp(lastTotals.service)}\n`;
      if (lastTotals.tax > 0) text += `Pajak PB1 : ${rp(lastTotals.tax)}\n`;
      text += `-------------------------\n`;
      text += `Total     : ${rp(lastTotals.total)}\n`;
      text += `Bayar     : ${rp(lastTotals.paid)} (${lastPayMethod})\n`;
      text += `Kembalian : ${rp(lastTotals.change)}\n`;
      text += `=========================\n`;
      text += ` ${storeSettings?.receipt_footer || 'Terima kasih atas kunjungan Anda!'}\n`;
      text += `=========================\n`;
      return text;
    }
  };

  const copyReceiptToClipboard = (isKitchen) => {
    try {
      const text = buildTextReceipt(isKitchen);
      navigator.clipboard.writeText(text);
      addToast(`Struk ${isKitchen ? 'Dapur' : 'Pelanggan'} berhasil disalin ke clipboard!`, 'success');
    } catch(err) {
      addToast('Gagal menyalin struk', 'error');
    }
  };

  const printViaBluetooth = async (isKitchen = false) => {
    try {
      if (window.self !== window.top) {
        addToast("Keamanan browser memblokir Bluetooth di dalam iFrame. Buka aplikasi di Tab Baru (ikon di kanan atas) untuk cetak Bluetooth!", 'error');
        return;
      }
      const text = buildTextReceipt(isKitchen);
      await printTextViaBluetooth(text, storeSettings?.receipt_width || '58');
      addToast('Cetak thermal bluetooth berhasil terkirim!', 'success');
    } catch (err) {
      console.error(err);
      let errMsg = err.message || '';
      if (!navigator.bluetooth) {
        errMsg = "Perangkat/Browser Anda tidak mendukung Web Bluetooth (gunakan Google Chrome di Android atau PC).";
      } else if (err.name === 'NotAllowedError' || err.message.includes('gesture')) {
        errMsg = "Pencarian printer dibatalkan atau izin Bluetooth ditolak.";
      }
      addToast('Gagal cetak bluetooth: ' + errMsg, 'error');
    }
  };

  const paidAmount = parseInt(payAmount) || 0;
  const change = paidAmount - cartTotal;

  return (
    <div className="content-area active" id="area-pos" style={{ flexDirection: 'column', padding: 0 }}>
      
      {/* MOBILE TABS (Hidden on Desktop) */}
      <div className="pos-mobile-tabs">
        <button className={mobileTab === 'catalog' && !showPreview ? 'active' : ''} onClick={() => { setMobileTab('catalog'); setShowPreview(false); }}>
          Katalog
        </button>
        <button className={mobileTab === 'cart' && !showPreview ? 'active' : ''} onClick={() => { setMobileTab('cart'); setShowPreview(false); }}>
          Keranjang {totalItems > 0 && `(${totalItems})`}
        </button>
        <button className={showPreview ? 'active' : ''} onClick={() => setShowPreview(true)}>
          Preview
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
        {/* LEFT: CATALOG + CART */}
        <div className={`pos-layout mobile-${mobileTab}-active ${showPreview ? 'mobile-hide' : ''}`} style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          {/* CATALOG */}
          <div className="pos-catalog">
          <div className="pos-catalog-header">
            <div className="pos-search">
              <span className="pos-search-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input 
                type="text" 
                placeholder="Cari produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>
              <span>{filteredProducts.length}</span> produk
            </div>
          </div>
          <div className="cat-filter">
            {categories.map(c => (
              <span 
                key={c} 
                className={`cat-pill ${c === activeCategory ? 'active' : ''}`}
                onClick={() => setActiveCategory(c)}
              >
                {c}
              </span>
            ))}
          </div>
          <div className="product-grid">
            {filteredProducts.length > 0 ? filteredProducts.map(p => (
              <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
                <div className="product-card-name">{p.name}</div>
                <div className="product-card-price">{rp(p.price)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: '4px' }}>
                  <div className="product-card-cat" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.category || 'Umum'}</div>
                  <div style={{
                    fontSize: '10px', fontWeight: 700, padding: '1px 5px',
                    background: p.stock <= 0 ? '#fdecea' : p.stock <= 5 ? '#fff8e1' : '#e8f5e9',
                    color: p.stock <= 0 ? '#c62828' : p.stock <= 5 ? '#f57f17' : '#2e7d32',
                    border: `1px solid ${p.stock <= 0 ? '#ef9a9a' : p.stock <= 5 ? '#ffe082' : '#a5d6a7'}`,
                    whiteSpace: 'nowrap', flexShrink: 0
                  }}>
                    {p.stock <= 0 ? 'Habis' : `Stok: ${p.stock}`}
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px', color: '#aaa', border: '2px dashed var(--surface-3)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <p style={{ fontSize: '13px' }}>Produk tidak ditemukan</p>
              </div>
            )}
          </div>
        </div>

        {/* CART */}
        <div className="pos-cart">
          <div className="pos-cart-left">
          {/* Order info bar */}
          <div style={{ padding: '8px 12px', borderBottom: 'var(--border-thin)', background: 'var(--surface-1)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select value={orderType} onChange={e => setOrderType(e.target.value)}
                style={{ flex: 1, padding: '5px 6px', border: 'var(--border-base)', background: 'var(--surface-0)', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 700 }}>
                <option>Dine In</option>
                <option>Take Away</option>
                <option>Grab</option>
                <option>GoFood</option>
                <option>ShopeeFood</option>
              </select>
              <input type="text" placeholder="Meja" value={tableNumber} onChange={e => setTableNumber(e.target.value)}
                style={{ width: '52px', padding: '5px 6px', border: 'var(--border-base)', background: 'var(--surface-0)', fontFamily: 'var(--font-body)', fontSize: '11px', textAlign: 'center' }} />
              <input type="number" placeholder="Pax" value={pax} min={1} onChange={e => setPax(+e.target.value)}
                style={{ width: '44px', padding: '5px 6px', border: 'var(--border-base)', background: 'var(--surface-0)', fontFamily: 'var(--font-body)', fontSize: '11px', textAlign: 'center' }} />
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Nama Pelanggan (Opsional)" value={customerName} onChange={e => setCustomerName(e.target.value)}
                style={{ flex: 1, minWidth: '120px', padding: '6px 8px', border: 'var(--border-base)', background: 'var(--surface-0)', fontFamily: 'var(--font-body)', fontSize: '11px' }} />
            </div>
          </div>

          <div className="cart-header">
            <h2>Keranjang</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="cart-count">{totalItems} item</span>
              <button 
                className={`btn btn-sm ${heldOrders.length > 0 ? 'btn-primary' : 'btn-ghost'}`} 
                style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }}
                onClick={() => setIsRestoreModalOpen(true)}
              >
                {heldOrders.length > 0 ? `Tersimpan (${heldOrders.length})` : 'Tersimpan (0)'}
              </button>
            </div>
          </div>
          <div className="cart-items">
            {cart.length > 0 ? cart.map(item => (
                <div className="cart-item" key={item.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px', padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="cart-item-name" style={{ flex: 1 }}>
                      {item.name}<br/>
                      <span className="cart-item-cat">{item.category || 'Umum'}</span>
                    </div>
                    <div className="cart-item-qty">
                      <button className="qty-btn" onClick={() => changeQty(item.id, -1, item.variant || '')}>−</button>
                      <span className="qty-num">{item.qty}</span>
                      <button className="qty-btn" onClick={() => changeQty(item.id, 1, item.variant || '')}>+</button>
                    </div>
                    <div className="cart-item-price">{rp(item.price * item.qty)}</div>
                    <button className="cart-item-del" onClick={() => removeFromCart(item.id, item.variant || '')} aria-label="Hapus Item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  {/* Variant / notes inline */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input type="text" placeholder="Catatan (No onion...)" value={item.notes || ''}
                      onChange={e => updateItemNote(cart.indexOf(item), 'notes', e.target.value)}
                      style={{ flex: 1, padding: '3px 6px', border: '1px solid var(--surface-3)', background: 'var(--surface-2)', fontFamily: 'var(--font-body)', fontSize: '10px' }} />
                  </div>
                </div>
            )) : (
              <div className="cart-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <p>Belum ada produk<br/>dipilih</p>
              </div>
            )}
          </div>
          </div>
          <div className="cart-footer pos-cart-right">
            <div className="cart-line"><span>Subtotal</span><span>{rp(cartSubtotal)}</span></div>
            <div className="discount-input-row" style={{ display: 'flex', gap: '4px' }}>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}
                style={{ padding: '8px', border: 'var(--border-thin)', backgroundColor: 'var(--surface-0)', width: '60px' }}>
                <option value="rp">Rp</option>
                <option value="pct">%</option>
              </select>
              <input type="text" placeholder={`Diskon (${discountType === 'rp' ? 'Rp' : '%'})`}
                value={discountType === 'rp' ? formatInput(discountInput) : discountInput} 
                onChange={(e) => setDiscountInput(discountType === 'rp' ? parseNum(e.target.value) : e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-ghost btn-sm" onClick={() => setDiscountInput('')}>Reset</button>
            </div>
            {discount > 0 && <div className="cart-line discount"><span>Diskon</span><span>- {rp(discount)}</span></div>}
            {serviceCharge > 0 && <div className="cart-line" style={{ fontSize: '11px', color: '#666' }}><span>Service ({serviceRate}%)</span><span>{rp(serviceCharge)}</span></div>}
            {taxAmount > 0 && <div className="cart-line" style={{ fontSize: '11px', color: '#666' }}><span>Pajak ({taxRate}%)</span><span>{rp(taxAmount)}</span></div>}
            <div className="cart-line total"><span>Total Pembayaran</span><span>{rp(cartTotal)}</span></div>
            
            <button 
              className="btn btn-primary btn-lg" 
              style={{ width: '100%', padding: '16px', fontSize: '18px', fontWeight: 800, marginTop: '8px' }}
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={cart.length === 0 || (storeSettings?.require_shift !== 'false' && !window.activeShiftId && !isAdmin) || isAdmin}
            >
              {isAdmin ? 'AKSES KASIR DIBATASI' : (storeSettings?.require_shift !== 'false' && !window.activeShiftId) ? 'BUKA SHIFT DULU' : 'BAYAR'}
            </button>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ flex: 1, justifyContent: 'center' }} 
                onClick={() => setIsHoldModalOpen(true)}
                disabled={cart.length === 0}
              >
                Simpan Pesanan
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ flex: 1, justifyContent: 'center', color: 'var(--accent-red)' }} 
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                Kosongkan
              </button>
            </div>
            
            <button 
              className="btn btn-ghost btn-sm mobile-only-btn" 
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px', border: '1px dashed var(--surface-3)', color: '#666' }}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Sembunyikan Preview Struk' : 'Tampilkan Preview Struk'}
            </button>
          </div>
        </div>
        </div>

      {/* RIGHT: RECEIPT PREVIEW PANEL */}
      <div className={`pos-receipt-panel ${showPreview ? 'mobile-show' : ''}`} style={{
        width: '260px', flexShrink: 0, borderLeft: 'var(--border-base)',
        display: 'flex', flexDirection: 'column', background: 'var(--surface-1)',
        overflowY: 'auto',
      }}>
        <div className="pos-receipt-panel-header" style={{ padding: '8px 12px', borderBottom: 'var(--border-thin)', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--black)', color: 'var(--accent-yellow)' }}>
          Preview Struk
        </div>

        {/* Summary live */}
        <div className="pos-receipt-panel-summary" style={{ padding: '8px 12px', borderBottom: 'var(--border-thin)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#666' }}>Subtotal</span><span>{rp(cartSubtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#666' }}>Diskon</span><span style={{ color: 'var(--accent-red)' }}>- {rp(discount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, borderTop: 'var(--border-thin)', paddingTop: '6px', marginTop: '2px' }}>
            <span>TOTAL</span><span style={{ color: 'var(--accent-green)' }}>{rp(cartTotal)}</span>
          </div>
        </div>

        {/* Preview Struk Pelanggan + Dapur */}
        <div style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>

          {/* STRUK PELANGGAN */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, width: '100%', justifyContent: 'center' }}>
              <span style={{ background: '#0A0A0A', color: '#FFD60A', padding: '2px 10px', fontSize: 10 }}>STRUK PELANGGAN</span>
            </div>
            <div style={{ transform: 'scale(1)' }}>
              <ReceiptPreview
              hideBadge
              storeSettings={storeSettings}
              items={cart.length > 0 ? cart : lastCart}
              totals={cart.length > 0
                ? { subtotal: cartSubtotal, discount, service: serviceCharge, tax: taxAmount, total: cartTotal, paid: paidAmount || cartTotal, change: Math.max(0, paidAmount - cartTotal) }
                : (lastTotals || { subtotal: 0, discount: 0, service: 0, tax: 0, total: 0, paid: 0, change: 0 })}
              paymentMethod={lastPayMethod || 'Tunai'}
              orderInfo={{ ...(cart.length > 0 ? { orderType, tableNumber, pax, customerName } : lastOrderInfo), cashierName: user?.fullname || 'Kasir' }}
              trxId={lastTrxId || 'INV-PREVIEW'}
            />
            </div>
          </div>

          {/* STRUK DAPUR */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, width: '100%', justifyContent: 'center' }}>
              <span style={{ background: '#E63946', color: '#fff', padding: '2px 10px', fontSize: 10 }}>STRUK DAPUR</span>
            </div>
            <div style={{ transform: 'scale(1)' }}>
              <KitchenReceiptPreview
                hideBadge
                storeSettings={storeSettings}
                items={cart.length > 0 ? cart : lastCart}
                orderInfo={{ ...(cart.length > 0 ? { orderType, tableNumber, pax, customerName } : lastOrderInfo), cashierName: user?.fullname || 'Kasir' }}
                trxId={lastTrxId || 'INV-PREVIEW'}
              />
            </div>
          </div>

        </div>
      </div>
      </div>

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="modal-overlay open" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal" style={{
            width: paymentSuccess ? '740px' : '440px',
            maxWidth: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div className="modal-header">
              <h3>{paymentSuccess ? 'Transaksi Selesai' : 'Proses Pembayaran'}</h3>
              {paymentSuccess ? (
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={finishPayment}
                  style={{ fontSize: '12px', padding: '6px 12px', background: 'var(--accent-green)', color: '#fff', border: '2px solid #000', boxShadow: '2px 2px 0 #000', fontWeight: 'bold' }}
                >
                  ✓ SELESAI
                </button>
              ) : (
                <button className="btn btn-icon" onClick={() => setIsPaymentModalOpen(false)} aria-label="Tutup Payment Modal">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: paymentSuccess ? '16px' : '20px' }}>
              {paymentSuccess ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                }}>
                  {/* Segmented control on Mobile only */}
                  {isMobile && (
                    <div style={{
                      display: 'flex',
                      background: 'var(--surface-100, #f0ede4)',
                      border: '2px solid #111',
                      borderRadius: '4px',
                      padding: '3px',
                      marginBottom: '16px',
                      gap: '4px'
                    }}>
                      <button 
                        className="btn btn-ghost" 
                        style={{
                          flex: 1,
                          padding: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          borderRadius: '2px',
                          background: successMobileTab === 'actions' ? '#111' : 'transparent',
                          color: successMobileTab === 'actions' ? '#fff' : '#111',
                          border: 'none',
                          boxShadow: 'none'
                        }}
                        onClick={() => setSuccessMobileTab('actions')}
                      >
                        ⚙️ Menu & Berbagi
                      </button>
                      <button 
                        className="btn btn-ghost" 
                        style={{
                          flex: 1,
                          padding: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          borderRadius: '2px',
                          background: successMobileTab === 'preview' ? '#111' : 'transparent',
                          color: successMobileTab === 'preview' ? '#fff' : '#111',
                          border: 'none',
                          boxShadow: 'none'
                        }}
                        onClick={() => setSuccessMobileTab('preview')}
                      >
                        👁️ Preview Struk
                      </button>
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: '20px',
                    justifyContent: 'center',
                    alignItems: 'stretch',
                    width: '100%'
                  }}>
                    {/* LEFT COLUMN: ACTIONS AND STATUS */}
                    {(!isMobile || successMobileTab === 'actions') && (
                      <div style={{
                        flex: '1 1 300px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        textAlign: 'center',
                        gap: '12px',
                        maxWidth: '100%'
                      }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: 'var(--accent-green)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          border: '2px solid #000',
                          boxShadow: '2px 2px 0 #000',
                          marginBottom: '2px'
                        }}>✓</div>
                        <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Pembayaran Berhasil!</h2>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background: '#111',
                          color: 'var(--accent-yellow)',
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: '2px solid #111',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>{lastTrxId}</div>

                        {/* HELPFUL BANNER FOR IFRAME CONSTRAINTS ON MOBILE */}
                        {(window.self !== window.top) && (
                          <div style={{
                            background: '#FFFBEB',
                            border: '2px solid #D97706',
                            borderRadius: '4px',
                            padding: '8px 10px',
                            fontSize: '11px',
                            color: '#92400E',
                            textAlign: 'left',
                            marginTop: '2px',
                            lineHeight: 1.4,
                            boxShadow: '2px 2px 0 #111',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}>
                            <IconInfo size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} /> <strong>TIPS PRINTER & WA:</strong> Klik tombol <strong>"Buka di Tab Baru" (Open in New Tab)</strong> di pojok kanan atas agar fitur Cetak Bluetooth berjalan 100% lancar tanpa diblokir browser!
                          </div>
                        )}

                        <div style={{
                          width: '100%',
                          background: 'var(--surface-50, #fcfbf7)',
                          border: '2px solid #111',
                          boxShadow: '4px 4px 0 #111',
                          padding: '10px 12px',
                          borderRadius: '4px',
                          textAlign: 'left',
                          marginTop: '2px',
                          boxSizing: 'border-box'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '11px' }}>
                            <span style={{ color: '#555', fontWeight: 500 }}>Metode</span>
                            <strong style={{ color: '#000' }}>{lastPayMethod}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '11px' }}>
                            <span style={{ color: '#555', fontWeight: 500 }}>Total Tagihan</span>
                            <strong style={{ color: '#000' }}>{rp(lastTotals.total)}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '11px' }}>
                            <span style={{ color: '#555', fontWeight: 500 }}>Uang Diterima</span>
                            <strong style={{ color: '#000' }}>{rp(lastTotals.paid)}</strong>
                          </div>
                          <div style={{ height: '0', borderTop: '1px dashed #bbb', margin: '6px 0' }}></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
                            <span style={{ color: '#111' }}>Kembalian</span>
                            <span style={{ color: 'var(--accent-green)' }}>{rp(lastTotals.change)}</span>
                          </div>
                        </div>

                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                          
                          {/* DYNAMIC WHATSAPP INPUT ON-THE-FLY & SHARE TEXT STRUK */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#555' }}>Nomor WhatsApp Pelanggan</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input 
                                type="tel" 
                                placeholder="Contoh: 08123456789"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                style={{
                                  flex: 1,
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  border: '2px solid #111',
                                  borderRadius: '4px',
                                  background: '#fff',
                                  boxShadow: '2px 2px 0 #111',
                                  height: '34px',
                                  boxSizing: 'border-box'
                                }}
                              />
                              <a 
                                href={`https://wa.me/${customerPhone ? customerPhone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(buildTextReceipt(successTab === 'kitchen'))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  padding: '0 12px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: '#25D366',
                                  color: '#fff',
                                  border: '2px solid #1c9e42',
                                  textDecoration: 'none',
                                  height: '34px',
                                  boxShadow: '2px 2px 0 #111',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <IconMessage size={14} /> Kirim WA
                              </a>
                            </div>
                          </div>

                          {/* 2. BLUETOOTH PRINT ACTION (CRISP ESC/POS PRINT) */}
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              padding: '10px 12px',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              backgroundColor: '#E8F4FD',
                              color: '#0D3C61',
                              border: '2px solid #1D4ED8',
                              width: '100%',
                              boxShadow: '3px 3px 0 #111',
                              cursor: 'pointer'
                            }}
                            onClick={() => printViaBluetooth(successTab === 'kitchen')}
                          >
                            <IconPrinter size={16} /> CETAK THERMAL BLUETOOTH
                          </button>

                          {/* 3. COPY BUTTONS GRID FOR QUICK SHARING PASTE */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%' }}>
                            <button 
                              className="btn btn-ghost" 
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '2px solid #111', background: '#fff', fontWeight: 700, fontSize: '11px', height: '36px', padding: '0 4px', boxShadow: '2px 2px 0 #111' }}
                              onClick={() => copyReceiptToClipboard(false)}
                            >
                              <IconCopy size={14} /> Salin Struk Pelanggan
                            </button>
                            <button 
                              className="btn btn-ghost" 
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '2px solid #111', background: '#fff', fontWeight: 700, fontSize: '11px', height: '36px', padding: '0 4px', boxShadow: '2px 2px 0 #111' }}
                              onClick={() => copyReceiptToClipboard(true)}
                            >
                              <IconCopy size={14} /> Salin Struk Dapur
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RIGHT COLUMN: COOL DETAILED THERMAL LIVE PREVIEW */}
                    {(!isMobile || successMobileTab === 'preview') && (
                      <div style={{
                        flex: '1 1 320px',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: '280px',
                        justifyContent: 'flex-start'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IconEye size={16} /> Preview Struk ({storeSettings?.receipt_width || '80'}mm)
                          </h3>
                        </div>

                        {/* Receipt Type Toggles */}
                        <div style={{
                          display: 'flex',
                          background: 'var(--surface-100, #f0ede4)',
                          border: '2px solid #111',
                          borderRadius: '4px',
                          padding: '2px',
                          marginBottom: '10px',
                          gap: '2px'
                        }}>
                          <button 
                            className="btn btn-ghost" 
                            style={{
                              flex: 1,
                              padding: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '2px',
                              background: successTab === 'customer' ? '#111' : 'transparent',
                              color: successTab === 'customer' ? '#fff' : '#111',
                              border: 'none',
                              boxShadow: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                            onClick={() => setSuccessTab('customer')}
                          >
                            <IconFileText size={14} /> Pelanggan
                          </button>
                          <button 
                            className="btn btn-ghost" 
                            style={{
                              flex: 1,
                              padding: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '2px',
                              background: successTab === 'kitchen' ? '#111' : 'transparent',
                              color: successTab === 'kitchen' ? '#fff' : '#111',
                              border: 'none',
                              boxShadow: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                            onClick={() => setSuccessTab('kitchen')}
                          >
                            <IconPrinter size={14} /> Dapur
                          </button>
                        </div>

                        {/* Interactive Roll Paper Backdrop */}
                        <div style={{
                          flex: '1 1 auto',
                          maxHeight: '340px',
                          overflowY: 'auto',
                          background: '#eee',
                          border: '2px solid #111',
                          boxShadow: '3px 3px 0 #111',
                          borderRadius: '4px',
                          padding: '12px 6px',
                          display: 'flex',
                          justifyContent: 'center',
                          backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)',
                          backgroundSize: '100% 4px'
                        }}>
                          <div style={{
                            width: '100%',
                            maxWidth: storeSettings?.receipt_width === '58' ? '240px' : '300px',
                            background: '#fff',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            padding: '12px 14px',
                            borderRadius: '1px',
                            position: 'relative',
                            boxSizing: 'border-box'
                          }}>
                            {successTab === 'customer' ? (
                              <CustomerReceiptPrint
                                id="customer-receipt-preview-visible"
                                trxId={lastTrxId}
                                cashier={user?.fullname || user?.username || 'Kasir'}
                                items={lastCart}
                                totals={lastTotals}
                                paymentMethod={lastPayMethod}
                                orderInfo={lastOrderInfo}
                                storeSettings={storeSettings}
                              />
                            ) : (
                              <KitchenReceiptPrint
                                id="kitchen-receipt-preview-visible"
                                trxId={lastTrxId}
                                cashier={user?.fullname || user?.username || 'Kasir'}
                                items={lastCart}
                                orderInfo={lastOrderInfo}
                                storeSettings={storeSettings}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span>TOTAL TAGIHAN</span>
                      <span style={{ fontWeight: 700, fontSize: '20px', fontVariantNumeric: 'tabular-nums' }}>{rp(cartTotal)}</span>
                    </div>
                    
                    {storeSettings?.qris_image ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>SCAN QRIS UNTUK MEMBAYAR</div>
                        <img src={storeSettings.qris_image} alt="QRIS" width="150" height="150" style={{ width: '150px', height: '150px', objectFit: 'contain', border: '2px solid #000' }} />
                      </div>
                    ) : null}
  
                    <div className="payment-display" style={{ letterSpacing: '2px' }}>
                      {payAmount ? `Rp ${parseInt(parseNum(payAmount) || 0).toLocaleString('id-ID')}` : 'Rp 0'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', textAlign: 'center', marginBottom: '4px' }}>
                      Ketik atau klik angka · Enter untuk payar tunai · Esc untuk batal
                    </div>
                    <div className="payment-numpad">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <button key={n} className="numpad-btn" onClick={() => handleNumpad(String(n))}>{n}</button>
                      ))}
                      <button className="numpad-btn" onClick={() => handleNumpad('000')} style={{ fontSize: '14px' }}>000</button>
                      <button className="numpad-btn" onClick={() => handleNumpad('0')}>0</button>
                      <button className="numpad-btn" onClick={() => handleNumpad('del')} style={{ fontSize: '14px', color: 'var(--accent-red)' }}>⌫</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleSetAmount(cartTotal)} style={{ justifyContent: 'center' }}>Pas</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleSetAmount(50000)} style={{ justifyContent: 'center' }}>50rb</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleSetAmount(100000)} style={{ justifyContent: 'center' }}>100rb</button>
                    </div>
                    <div className={`payment-change ${change < 0 ? 'negative' : ''}`}>
                      <span>KEMBALIAN</span>
                      <span>{rp(Math.abs(change))}</span>
                    </div>
                  </>
              )}
            </div>
            <div className="modal-footer">
              {paymentSuccess ? (
                <button className="btn btn-primary btn-lg" onClick={finishPayment} style={{ flex: 1 }}>Selesai & Struk Baru</button>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => setIsPaymentModalOpen(false)}>Batal</button>
                  <button 
                    className="btn btn-secondary btn-lg" 
                    style={{ flex: 1, padding: '14px 0', border: '2px dashed #000' }} 
                    onClick={handleConfirmQRIS}
                  >
                    {paidAmount > 0 && paidAmount < cartTotal ? 'SISA VIA QRIS' : 'BAYAR QRIS'}
                  </button>
                  <button 
                    className="btn btn-primary btn-lg" 
                    style={{ flex: 1, padding: '14px 0' }} 
                    onClick={handleConfirmPayment}
                    disabled={paidAmount > 0 && paidAmount < cartTotal}
                  >
                    BAYAR TUNAI
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HOLD ORDER MODAL */}
      {isHoldModalOpen && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ width: '360px' }}>
            <div className="modal-header">
              <h3>Simpan Pesanan</h3>
              <button className="btn btn-icon" onClick={() => setIsHoldModalOpen(false)} aria-label="Tutup Hold Modal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>NAMA PENANDA / MEJA</label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Misal: Bapak Budi / Meja 4" 
                  value={holdName}
                  onChange={(e) => setHoldName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleHoldOrder()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsHoldModalOpen(false)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleHoldOrder} disabled={!holdName}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE ORDER MODAL */}
      {isRestoreModalOpen && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ width: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3>Pesanan Tersimpan</h3>
              <button className="btn btn-icon" onClick={() => setIsRestoreModalOpen(false)} aria-label="Tutup Restore Modal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: '16px' }}>
              {heldOrders.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', padding: '32px 0' }}>Tidak ada pesanan tersimpan</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {heldOrders.map((h, i) => (
                    <div key={h.id} style={{ border: '2px solid var(--black)', padding: '12px', background: 'var(--surface-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>{h.name}</div>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                          {new Date(h.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {h.cart.reduce((sum, item) => sum + item.qty, 0)} items · {rp(h.cart.reduce((sum, item) => sum + (item.price * item.qty), 0))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setHeldOrders(prev => prev.filter(x => x.id !== h.id))} style={{ color: 'var(--accent-red)' }}>Hapus</button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleRestoreOrder(h)}>Buka</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STOCK ALERT MODAL */}
      {stockAlertModal.isOpen && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ width: '320px', textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ color: 'var(--accent-red)', marginBottom: '16px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Stok Habis!</h3>
            <p style={{ color: '#666', fontSize: '13px', marginBottom: '24px' }}>
              Maaf, stok untuk <b>{stockAlertModal.productName}</b> tidak mencukupi untuk ditambahkan.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setStockAlertModal({ isOpen: false, productName: '' })}>
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* STRUK CETAK — visible tapi off-screen untuk print */}
      <div id="print-receipt-area" style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
        {/* We can leave this empty since print is done via HTML strings in IPC now */}
      </div>

      {/* STYLE PRINT GLOBAL */}
      <style>{`
        @media print {
          @page { margin: 0; size: ${storeSettings.receipt_width || '80'}mm auto; }
          body > * { display: none !important; }
          #print-receipt-area {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: ${storeSettings.receipt_width || '80'}mm !important;
            z-index: 9999 !important;
          }
        }
      `}</style>

      {/* Variant Modal */}
      {variantModalState.isOpen && variantModalState.product && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3>Pilih Varian: {variantModalState.product.name}</h3>
              <button className="btn btn-icon" onClick={() => setVariantModalState({ isOpen: false, product: null, parsedVariants: [] })} aria-label="Tutup Variant Modal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
              <button 
                className="btn" 
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface-1)', border: '2px solid var(--black)', color: 'var(--black)' }}
                onClick={() => {
                  doAddToCart(variantModalState.product, '', 0);
                  setVariantModalState({ isOpen: false, product: null, parsedVariants: [] });
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Original (Tanpa Varian)</span>
                <span style={{ fontWeight: 'bold' }}>{rp(variantModalState.product.price)}</span>
              </button>
              {variantModalState.parsedVariants.map((v, i) => (
                <button 
                  key={i} 
                  className="btn btn-primary" 
                  style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--black)', color: 'var(--accent-yellow)', border: '2px solid var(--black)' }}
                  onClick={() => {
                    doAddToCart(variantModalState.product, v.name, v.priceOffset);
                    setVariantModalState({ isOpen: false, product: null, parsedVariants: [] });
                  }}
                >
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
                  <span style={{ fontWeight: 'bold' }}>{rp(variantModalState.product.price + (v.priceOffset || 0))}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}



    </div>
  );
}

// ─── NEW SUB-COMPONENTS ──────────────────────────────────────────
function MRow({ label, value, red }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#555" }}>{label}</span>
      <span style={{ fontWeight: "bold", color: red ? "#c0392b" : "#111" }}>{value}</span>
    </div>
  );
}

function KRow({ label, value, is58 }) {
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "flex-start",
      gap: is58 ? 4 : 8,
      fontSize: is58 ? "10px" : "12px",
      borderBottom: "1px dashed #f0edf0",
      padding: "2px 0",
      lineHeight: 1.3
    }}>
      <span style={{ fontWeight: "bold", color: "#666", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: "bold", textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function Dash() {
  return <div style={{ borderTop: "1px dashed #bbb", margin: "8px 0" }} />;
}

function Perf({ dark }) {
  return (
    <div style={{
      height: 10,
      backgroundImage: `radial-gradient(circle at 6px 50%, ${dark ? "#e8e8e8" : "#f5f2ea"} 6px, transparent 6px)`,
      backgroundSize: "12px 100%",
      backgroundRepeat: "repeat-x",
      borderBottom: "1px dashed #ccc",
    }} />
  );
}

function CutLine({ kitchen }) {
  return (
    <div style={{ position: "relative", borderTop: `${kitchen ? "2px" : "1px"} dashed #bbb`, marginTop: 4 }}>
      <span style={{
        position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
        background: "#fff", padding: "0 8px", fontSize: 14, color: "#aaa",
      }}>✂</span>
    </div>
  );
}

function Barcode({ id }) {
  const bars = [1,2,1,3,1,1,2,1,3,1,2,1,1,2,1,3,1,2,1,1,2];
  return (
    <div>
      <div style={{ display: "inline-flex", gap: 1, height: 28, alignItems: "flex-end", justifyContent: "center" }}>
        {bars.map((w, i) => (
          <div key={i} style={{ width: w * 2, height: i % 3 === 0 ? 28 : i % 3 === 1 ? 22 : 16, background: "#111" }} />
        ))}
      </div>
      <div style={{ fontSize: 9, color: "#aaa", letterSpacing: 2, marginTop: 3 }}>{id}</div>
    </div>
  );
}

const S = {
  receipt: {
    background: "#fff",
    width: "100%",
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 12,
    color: "#111",
    border: "2px solid #0A0A0A",
    boxShadow: "4px 4px 0 #0A0A0A",
    flexShrink: 0,
    boxSizing: "border-box",
  },
  inner: { padding: "4px 18px 16px" },
  storeName: { fontSize: 16, fontWeight: "bold", letterSpacing: 3, marginBottom: 2 },
  storeSub:  { fontSize: 11, color: "#444", marginBottom: 2 },
  storeMeta: { fontSize: 10, color: "#777", lineHeight: 1.5 },
  metaLabel: { fontSize: 10, color: "#777" },
  metaBold:  { fontWeight: "bold", fontSize: 11 },
};

// ── KOMPONEN STRUK BARU (Preview) ──
function CustomerReceiptPrint({ trxId, cashier, items, totals, paymentMethod, orderInfo, storeSettings, id = "customer-receipt-preview-capture" }) {
  const { subtotal, discount: disc, service, tax, total, paid, change } = totals;
  const rp = (n) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, " ");
  };
  const now = new Date();
  
  const paperWidth = storeSettings?.receipt_width || '80';
  const is58 = paperWidth === '58';
  const is114 = paperWidth === '114';

  const baseFontSize = is58 ? 10 : is114 ? 14 : 11;
  const headingFontSize = is58 ? 13 : is114 ? 18 : 15;
  const subFontSize = is58 ? 9 : is114 ? 12 : 10;
  
  const dynReceiptStyle = {
    ...S.receipt,
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: baseFontSize,
    lineHeight: 1.3,
  };

  const dynInnerStyle = {
    padding: is58 ? "4px 10px 12px" : is114 ? "8px 24px 20px" : "6px 16px 16px"
  };

  const storeNameStyle = {
    fontSize: is58 ? 13 : is114 ? 20 : 16,
    fontWeight: "bold",
    letterSpacing: is58 ? "1px" : "2px",
    marginBottom: 2
  };

  const storeSubStyle = {
    fontSize: is58 ? 9 : is114 ? 13 : 11,
    color: "#444",
    marginBottom: 2
  };

  const storeMetaStyle = {
    fontSize: is58 ? 8 : is114 ? 11 : 9,
    color: "#666",
    lineHeight: 1.3
  };

  return (
    <div id={id} style={dynReceiptStyle}>
      <Perf />
      <div style={dynInnerStyle}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          {storeSettings?.store_logo ? (
            <div style={{ marginBottom: '8px' }}>
              <img src={storeSettings.store_logo} alt="logo" width="80" height="65" style={{ maxWidth: is58 ? '60px' : is114 ? '110px' : '80px', maxHeight: is58 ? '45px' : is114 ? '85px' : '65px', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{
              width: is58 ? 36 : 48, height: is58 ? 36 : 48, borderRadius: "50%",
              border: "2px solid #111", margin: "0 auto 8px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: is58 ? 16 : 20,
            }}>🍽</div>
          )}
          {storeSettings?.store_name && <div style={storeNameStyle}>{storeSettings?.store_name || "WARUNG POS"}</div>}
          {!storeSettings?.store_name && <div style={storeNameStyle}>WARUNG POS</div>}
          {storeSettings?.store_tagline && <div style={storeSubStyle}>{storeSettings.store_tagline}</div>}
          {storeSettings?.store_address && <div style={storeMetaStyle}>{storeSettings.store_address}</div>}
          {storeSettings?.store_phone && <div style={storeMetaStyle}>Telp: {storeSettings.store_phone}</div>}
          {storeSettings?.store_email && <div style={storeMetaStyle}>Email: {storeSettings.store_email}</div>}
        </div>

        <div style={{
          textAlign: "center", fontWeight: "bold", fontSize: is58 ? 11 : 13,
          padding: "6px 0", borderTop: "1px dashed #bbb", borderBottom: "1px dashed #bbb",
          margin: "8px 0", letterSpacing: 0.5,
        }}>
          {orderInfo?.orderType || 'Dine In'}{orderInfo?.tableNumber ? ` / Meja ${orderInfo.tableNumber}` : ''} / Pax {orderInfo?.pax || 1}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", fontSize: subFontSize, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: is58 ? 8 : 10, color: "#777" }}>Tanggal</div>
            <div style={{ fontWeight: "bold", fontSize: subFontSize }}>{formatDate(now)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: is58 ? 8 : 10, color: "#777" }}>Kasir</div>
            <div style={{ fontWeight: "bold", fontSize: subFontSize }}>{cashier}</div>
          </div>
          <div>
            <div style={{ fontSize: is58 ? 8 : 10, color: "#777" }}>No. Transaksi</div>
            <div style={{ fontWeight: "bold", fontSize: subFontSize }}>{trxId}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: is58 ? 8 : 10, color: "#777" }}>Pelanggan</div>
            <div style={{ fontWeight: "bold", fontSize: subFontSize }}>{orderInfo?.customerName || '-'}{orderInfo?.customerPhone ? <><br/>{orderInfo.customerPhone}</> : ''}</div>
          </div>
        </div>

        <Dash />

        <div style={{ marginBottom: 8 }}>
          {items.map((item, i) => (
            <div key={i} style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: baseFontSize, fontWeight: "bold" }}>
                <span>{item.name} x{item.qty}</span>
                <span>{rp(item.price * item.qty)}</span>
              </div>
              {item.variant && (
                <div style={{ fontSize: is58 ? 8 : 10, color: "#555", marginLeft: 2 }}>{item.variant}</div>
              )}
              {item.notes && (
                <div style={{ fontSize: is58 ? 8 : 10, color: "#555", marginLeft: 2 }}>Catatan: {item.notes}</div>
              )}
            </div>
          ))}
        </div>

        <Dash />

        <div style={{ fontWeight: "bold", fontSize: is58 ? 10 : 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Rincian Pembayaran
        </div>
        <div style={{ fontSize: baseFontSize, display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
          <MRow label="Subtotal"             value={rp(subtotal)} />
          {disc > 0 && <MRow label="Diskon"             value={`-${rp(disc)}`} red />}
          {service > 0 && <MRow label="Biaya Layanan" value={`${storeSettings?.service_rate || 0}% / ${rp(service)}`} />}
          {(storeSettings?.enable_tax !== 'false' && tax > 0) && <MRow label="Pajak PB1" value={`${storeSettings?.tax_rate || 0}% / ${rp(tax)}`} />}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: is58 ? 12 : 13, borderTop: "1px dashed #bbb", paddingTop: 6, marginBottom: 10 }}>
          <span>Total</span>
          <span>{rp(total)}</span>
        </div>

        <Dash />

        <div style={{ fontWeight: "bold", fontSize: is58 ? 10 : 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Metode Pembayaran
        </div>
        <div style={{ fontSize: baseFontSize, display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 }}>
          <MRow label={paymentMethod} value={rp(paid)} />
          {!paymentMethod.toLowerCase().includes('qris') && <MRow label="Kembalian"           value={rp(Math.max(0, change))} />}
        </div>

        <Dash />

        <div style={{ textAlign: "center", fontSize: subFontSize }}>
          <div style={{ fontWeight: "bold", marginBottom: 2 }}>LUNAS</div>
          <div style={{ color: "#555", marginBottom: 8 }}>
            {formatDate(now)} - {now.toLocaleTimeString("id-ID", {hour:"2-digit", minute:"2-digit"})}
          </div>
          <div style={{ color: "#555", marginBottom: 12 }}>{storeSettings?.receipt_footer || 'Terima kasih atas kunjungan Anda!'}</div>
          <Barcode id={trxId} />
        </div>
      </div>
      <CutLine />
    </div>
  );
}

function KitchenReceiptPrint({ trxId, cashier, items, orderInfo, storeSettings, id = "kitchen-receipt-preview-capture" }) {
  const paperWidth = storeSettings?.receipt_width || '80';
  const is58 = paperWidth === '58';
  const is114 = paperWidth === '114';

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const allNotes = items
    .filter(i => i.notes)
    .map(i => i.notes)
    .join(" · ");
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, " ");

  const baseFontSize = is58 ? 10 : is114 ? 14 : 12;
  const titleFontSize = is58 ? 15 : is114 ? 24 : 18;
  const itemFontSize = is58 ? 11 : is114 ? 18 : 14;
  const subFontSize = is58 ? 9 : is114 ? 13 : 11;

  const dynReceiptStyle = {
    ...S.receipt,
    fontFamily: "'Courier New', Courier, monospace",
    border: is58 ? "2px solid #111" : "3px solid #111",
    fontSize: baseFontSize,
    boxShadow: is58 ? "3px 3px 0 #111" : "4px 4px 0 #111",
    lineHeight: 1.3
  };

  const dynInnerStyle = {
    ...S.inner,
    padding: is58 ? "4px 10px 10px" : is114 ? "8px 24px 20px" : "6px 16px 16px"
  };

  return (
    <div id={id} style={dynReceiptStyle}>
      <Perf dark />
      <div style={dynInnerStyle}>

        {/* Title */}
        <div style={{ 
          textAlign: "center", 
          fontWeight: "bold", 
          fontSize: titleFontSize, 
          letterSpacing: is58 ? 1 : 3, 
          padding: is58 ? "6px 0 4px" : "12px 0 10px", 
          borderBottom: "2px solid #111", 
          marginBottom: is58 ? 6 : 10 
        }}>
          TICKET DAPUR
        </div>

        {/* Info using responsive KRow */}
        <div style={{ fontSize: baseFontSize, lineHeight: is58 ? 1.3 : 1.7, marginBottom: 6 }}>
          <KRow label="Pelanggan" value={`${orderInfo?.customerName || '-'}`} is58={is58} />
          {orderInfo?.customerPhone && <KRow label="No. Telp" value={orderInfo.customerPhone} is58={is58} />}
          <KRow label="Tipe/Meja" value={`${orderInfo?.orderType || 'Dine In'}${orderInfo?.tableNumber ? ` / Meja ${orderInfo.tableNumber}` : ''}`} is58={is58} />
          <KRow label="Waktu" value={`${dateStr} ${timeStr}`} is58={is58} />
          <KRow label="Kasir" value={cashier} is58={is58} />
        </div>

        {/* Order type badge */}
        <div style={{
          background: "#111", color: "#fff",
          textAlign: "center", fontWeight: "bold", fontSize: is58 ? 11 : 13,
          padding: is58 ? "3px 0" : "5px 0", letterSpacing: is58 ? 1 : 2,
          margin: is58 ? "6px 0" : "8px 0",
        }}>
          ★ {(orderInfo?.orderType || 'DINE IN').toUpperCase()} ★
        </div>

        <Dash />

        {/* Items — LARGE for kitchen readability */}
        <div style={{ marginBottom: 8 }}>
          {items.map((item, i) => (
            <div key={i} style={{ marginBottom: is58 ? 6 : 10 }}>
              <div style={{ fontWeight: "bold", fontSize: itemFontSize }}>
                {item.qty} x {item.name}
              </div>
              {item.variant && (
                <div style={{ fontSize: subFontSize, paddingLeft: is58 ? 10 : 16, color: "#333" }}>→ {item.variant}</div>
              )}
              {item.notes && (
                <div style={{
                  fontSize: subFontSize, paddingLeft: is58 ? 10 : 16,
                  fontStyle: "italic", color: "#444",
                }}>★ {item.notes}</div>
              )}
            </div>
          ))}
        </div>

        <Dash />

        {/* Total QTY */}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: is58 ? 12 : 14, marginBottom: 8 }}>
          <span>Total QTY</span>
          <span>{totalQty}</span>
        </div>

        <Dash />

        {/* Global notes box */}
        {allNotes && (
          <div style={{
            border: is58 ? "1px solid #111" : "2px solid #111", padding: is58 ? "5px 8px" : "8px 12px",
            textAlign: "center", fontWeight: "bold", fontSize: is58 ? 11 : 13,
            marginTop: 4,
          }}>
            📝 {allNotes}
          </div>
        )}

        {/* No notes fallback */}
        {!allNotes && (
          <div style={{ textAlign: "center", fontSize: is58 ? 9 : 11, color: "#aaa", marginTop: 4, fontStyle: "italic" }}>
            Tidak ada catatan khusus
          </div>
        )}
      </div>
      <CutLine kitchen />
    </div>
  );
}
