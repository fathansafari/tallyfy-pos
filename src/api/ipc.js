/**
 * api/ipc.js — Web Firebase Edition
 * 
 * File ini menggantikan semua panggilan IPC Electron (window.api)
 * dengan operasi langsung ke Cloud Firestore.
 * Nama semua fungsi dipertahankan agar komponen UI tidak perlu diubah.
 * 
 * Koleksi Firestore yang digunakan:
 *   - users
 *   - products
 *   - categories
 *   - transactions  (dan subkoleksi: transaction_items)
 *   - shifts
 *   - stock_history
 *   - settings
 *   - expenses
 *   - audit_logs
 */

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, Timestamp, runTransaction, increment,
  serverTimestamp, writeBatch, setDoc, onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase'
import bcrypt from 'bcryptjs'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
let memoryStoreCode = null;

export const setIpcStoreCode = (code) => {
  memoryStoreCode = code;
}

const getStoreCode = () => {
  const code = memoryStoreCode;
  if (!code) {
    console.error('[Multi-Tenancy] memoryStoreCode tidak ditemukan. Harap Login.')
    return 'demo-store' // Fallback aman untuk development/error
  }
  return code
}

const col = (name) => collection(db, 'stores', getStoreCode(), name)
const docRef = (name, id) => doc(db, 'stores', getStoreCode(), name, id)

/** Konversi Firestore Timestamp ke ISO string atau Date object */
const toDate = (ts) => ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null)

/** Konversi date string ke Firestore Timestamp (untuk filter range) */
const toTsStart = (d) => Timestamp.fromDate(new Date(d.includes('T') ? d : d + 'T00:00:00'))
const toTsEnd = (d) => Timestamp.fromDate(new Date(d.includes('T') ? d : d + 'T23:59:59'))

// ─────────────────────────────────────────────
// AUTHENTICATION & MULTI-TENANCY
// ─────────────────────────────────────────────
import { auth } from '../firebase'
import { signInWithPopup, GoogleAuthProvider, signInAnonymously } from 'firebase/auth'

export async function seedDemoData() {
  try {
    const storeCode = 'DEMO-TALLYFY';
    
    // Hapus data dummy lama (Products, Transactions, dll) agar tidak dobel
    const oldProducts = await getDocs(collection(db, 'stores', storeCode, 'products'));
    const oldTrx = await getDocs(collection(db, 'stores', storeCode, 'transactions'));
    const delBatch = writeBatch(db);
    oldProducts.docs.forEach(d => delBatch.delete(d.ref));
    oldTrx.docs.forEach(d => delBatch.delete(d.ref));
    await delBatch.commit();

    const batch = writeBatch(db);
    
    // Settings
    const settingsRef = doc(db, 'stores', storeCode, 'settings', 'global');
    batch.set(settingsRef, {
      store_name: "Toko Dummy Penjurian",
      store_address: "Jalan Merdeka No. 1, Jakarta",
      store_phone: "081234567890",
      printer_name: "POS-58",
      receipt_width: "58",
      shift_templates: JSON.stringify([{id:"PAGI", name:"Shift Pagi", startTime:"08:00", endTime:"16:00"}]),
      require_shift: "false",
      bulk_update_history: "[]",
      lastUpdatedAt: new Date().toISOString()
    });

    // Users
    const adminRef = doc(db, 'stores', storeCode, 'users', 'admin');
    batch.set(adminRef, { username: 'admin', fullname: 'Administrator', role: 'admin', password: '123' });
    const kasirRef = doc(db, 'stores', storeCode, 'users', 'kasir');
    batch.set(kasirRef, { username: 'kasir', fullname: 'Kasir Utama', role: 'kasir', password: '123' });

    // Categories
    batch.set(doc(collection(db, 'stores', storeCode, 'categories')), { name: 'Makanan' });
    batch.set(doc(collection(db, 'stores', storeCode, 'categories')), { name: 'Minuman' });
    batch.set(doc(collection(db, 'stores', storeCode, 'categories')), { name: 'Snack' });

    // Products
    const pt = [
      { name: "Nasi Goreng Spesial", category: "Makanan", price: 25000, hpp: 15000, stock: 50, status: "Aktif", variants: "[]", createdAt: serverTimestamp() },
      { name: "Mie Goreng Ayam", category: "Makanan", price: 22000, hpp: 12000, stock: 50, status: "Aktif", variants: "[]", createdAt: serverTimestamp() },
      { name: "Es Teh Manis", category: "Minuman", price: 5000, hpp: 2000, stock: 100, status: "Aktif", variants: "[]", createdAt: serverTimestamp() },
      { name: "Jus Alpukat", category: "Minuman", price: 15000, hpp: 8000, stock: 30, status: "Aktif", variants: "[]", createdAt: serverTimestamp() },
      { name: "Kopi Hitam", category: "Minuman", price: 10000, hpp: 4000, stock: 50, status: "Aktif", variants: "[]", createdAt: serverTimestamp() },
      { name: "Kentang Goreng", category: "Snack", price: 15000, hpp: 8000, stock: 40, status: "Aktif", variants: "[]", createdAt: serverTimestamp() },
      { name: "Roti Bakar Coklat", category: "Snack", price: 18000, hpp: 10000, stock: 30, status: "Aktif", variants: "[]", createdAt: serverTimestamp() },
      { name: "Keripik Singkong", category: "Snack", price: 10000, hpp: 5000, stock: 60, status: "Aktif", variants: "[]", createdAt: serverTimestamp() }
    ];
    pt.forEach(p => {
      batch.set(doc(collection(db, 'stores', storeCode, 'products')), p);
    });

    // Transactions (Yesterday & Today)
    const yesterday = new Date(Date.now() - 86400000);
    const txRef1 = doc(collection(db, 'stores', storeCode, 'transactions'));
    batch.set(txRef1, {
      invoiceNo: "TRX-DUMMY1",
      totalAmount: 30000,
      cashAmount: 50000,
      changeAmount: 20000,
      paymentMethod: "Tunai",
      status: 'completed',
      items: [
          {name: "Nasi Goreng Spesial", qty: 1, quantity: 1, price: 25000, subtotal: 25000},
          {name: "Es Teh Manis", qty: 1, quantity: 1, price: 5000, subtotal: 5000}
      ],
      userId: "kasir",
      createdAt: Timestamp.fromDate(yesterday)
    });

    const txRef2 = doc(collection(db, 'stores', storeCode, 'transactions'));
    batch.set(txRef2, {
      invoiceNo: "TRX-DUMMY2",
      totalAmount: 18000,
      cashAmount: 20000,
      changeAmount: 2000,
      paymentMethod: "QRIS",
      status: 'completed',
      items: [
          {name: "Roti Bakar Coklat", qty: 1, quantity: 1, price: 18000, subtotal: 18000}
      ],
      userId: "kasir",
      createdAt: serverTimestamp()
    });

    // Stock History
    const shRef1 = doc(collection(db, 'stores', storeCode, 'stock_history'));
    batch.set(shRef1, {
      productId: "dummy-product-1",
      productName: "Nasi Goreng Spesial", // Mock name since productId is dummy
      type: "in",
      quantity: 50,
      reason: "Stok Awal Dummy",
      createdBy: "admin",
      createdAt: serverTimestamp()
    });

    const shRef2 = doc(collection(db, 'stores', storeCode, 'stock_history'));
    batch.set(shRef2, {
      productId: "dummy-product-2",
      productName: "Mie Goreng Ayam",
      type: "out",
      quantity: 2,
      reason: "Penjualan TRX-DUMMY1",
      createdBy: "kasir",
      createdAt: serverTimestamp()
    });

    // Audit Logs
    const alRef1 = doc(collection(db, 'stores', storeCode, 'audit_logs'));
    batch.set(alRef1, {
      action: "login",
      targetId: "kasir",
      userId: "kasir",
      details: "Kasir login ke sistem",
      createdAt: Timestamp.fromDate(yesterday)
    });
    
    const alRef2 = doc(collection(db, 'stores', storeCode, 'audit_logs'));
    batch.set(alRef2, {
      action: "create_transaction",
      targetId: "TRX-DUMMY2",
      userId: "kasir",
      details: "Transaksi TRX-DUMMY2 · 1 item · Total Rp 18.000",
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return { success: true };
  } catch (err) {
    console.error('Seed error:', err);
    return { success: false, message: err.message };
  }
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider()
  try {
    const result = await signInWithPopup(auth, provider)
    const user = result.user
    
    // Store Code didapat dari 8 karakter pertama UID Google (Sangat unik)
    const storeCode = user.uid.substring(0, 8).toUpperCase()
    
    // Simpan data pemilik toko
    await setDoc(doc(db, 'stores', storeCode, 'profile', 'info'), {
      ownerName: user.displayName,
      ownerEmail: user.email,
      uid: user.uid,
      createdAt: serverTimestamp()
    }, { merge: true })

    return { success: true, storeCode, user }
  } catch (error) {
    // Map Firebase auth error codes to friendly messages
    const authErrorMap = {
      'auth/popup-closed-by-user':    null, // User cancelled — silent, no toast needed
      'auth/popup-blocked':           'Popup Google diblokir browser. Izinkan popup untuk situs ini.',
      'auth/cancelled-popup-request': null, // Race condition — silent
      'auth/network-request-failed':  'Tidak ada koneksi internet. Periksa jaringan Anda.',
      'auth/too-many-requests':       'Terlalu banyak percobaan login. Coba lagi beberapa menit.',
      'auth/user-disabled':           'Akun Google ini telah dinonaktifkan.',
      'auth/account-exists-with-different-credential': 'Email ini sudah terdaftar dengan metode login lain.',
    }
    const code = error?.code || ''
    const friendlyMessage = authErrorMap[code]

    // Only log unexpected errors (not user-initiated cancellations)
    if (friendlyMessage !== null && !(code in authErrorMap)) {
      console.warn('[Auth] Google Login Error:', code)
    }

    return {
      success: false,
      message: friendlyMessage ?? 'Login Google gagal. Silakan coba lagi.',
      cancelled: friendlyMessage === null // flag for silent handling
    }
  }
}

export async function verifyStoreCashier(storeCode, username, pin) {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch(err => {
        console.warn('Anonymous login failed:', err);
      });
    }

    // === AKSES KHUSUS EVENT ===
    if (storeCode.toUpperCase() === 'DEMO-TALLYFY') {
      if (pin !== '12345678') {
        return { success: false, message: 'PIN Salah' };
      }
      const userLower = username.toLowerCase().trim();
      if (userLower === 'admin') {
        return { 
          success: true, 
          user: { id: 'admin', username: 'admin', fullname: 'Administrator', role: 'admin' }, 
          storeCode: 'DEMO-TALLYFY' 
        };
      }
      if (userLower === 'kasir') {
        return { 
          success: true, 
          user: { id: 'kasir', username: 'kasir', fullname: 'Kasir Utama', role: 'kasir' }, 
          storeCode: 'DEMO-TALLYFY' 
        };
      }
      return { success: false, message: 'Username tidak dikenali. Gunakan admin atau kasir.' };
    }
    // ==========================

    // Kita bypass getStoreCode() helper karena pada tahap ini belum ada storeCode di localStorage
    const q = query(collection(db, 'stores', storeCode, 'users'), where('username', '==', username.trim()))
    const snap = await getDocs(q)
    if (snap.empty) return { success: false, message: 'Username tidak ditemukan di toko ini' }

    const docSnap = snap.docs[0]
    const userData = { id: docSnap.id, ...docSnap.data() }

    const isMatch = userData.password.startsWith('$2')
      ? await bcrypt.compare(pin, userData.password)
      : userData.password === pin

    if (!isMatch) return { success: false, message: 'PIN Salah' }

    // --- CEK SHIFT JIKA ROLE ADALAH KASIR ---
    if (userData.role === 'kasir' && userData.shiftId) {
      try {
        const settingsSnap = await getDoc(doc(db, 'stores', storeCode, 'settings', 'global'));
        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data();
          if (settingsData.shift_templates) {
            const templates = JSON.parse(settingsData.shift_templates);
            const shift = templates.find(s => s.id === userData.shiftId);
            if (shift && shift.startTime && shift.endTime) {
              const now = new Date();
              const hh = String(now.getHours()).padStart(2, '0');
              const mm = String(now.getMinutes()).padStart(2, '0');
              const currentTime = `${hh}:${mm}`;

              let isValid = false;
              if (shift.startTime <= shift.endTime) {
                isValid = currentTime >= shift.startTime && currentTime <= shift.endTime;
              } else {
                isValid = currentTime >= shift.startTime || currentTime <= shift.endTime;
              }

              if (!isValid) {
                return { success: false, message: `Akses ditolak. Jadwal shift Anda: ${shift.startTime} - ${shift.endTime}` };
              }
            }
          }
        }
      } catch (e) {
        console.error('[Auth] Error checking shift:', e);
      }
    }
    // ----------------------------------------

    const { password: _pw, ...safeUser } = userData
    return { success: true, user: safeUser, storeCode }
  } catch (error) {
    console.error('[Auth] verifyStoreCashier:', error)
    return { success: false, message: error.message }
  }
}

// ─────────────────────────────────────────────
// USER OPERATIONS (CRUD untuk dalam toko)
// ─────────────────────────────────────────────

/**
 * Verifikasi user login menggunakan username & password.
 * Password di-hash menggunakan bcryptjs.
 * @returns {object|null} user data or null
 */
export async function verifyUser(username, password) {
  try {
    const q = query(col('users'), where('username', '==', username.trim()))
    const snap = await getDocs(q)
    if (snap.empty) return null

    const docSnap = snap.docs[0]
    const userData = { id: docSnap.id, ...docSnap.data() }

    // Support plain-text (lama) dan bcrypt hash (baru)
    const isMatch = userData.password.startsWith('$2')
      ? await bcrypt.compare(password, userData.password)
      : userData.password === password

    if (!isMatch) return null

    // Kembalikan tanpa field password
    const { password: _pw, ...safeUser } = userData
    return safeUser
  } catch (err) {
    console.error('[Firestore] verifyUser:', err)
    return null
  }
}

export async function getAllUsers() {
  try {
    const snap = await getDocs(query(col('users'))) // Hapus orderBy createdAt karena serverTimestamp pending tidak akan muncul di local cache
    const docs = snap.docs.map(d => {
      const { password: _pw, ...rest } = d.data()
      return { id: d.id, ...rest }
    })
    // Sort manual di client
    return docs.sort((a, b) => {
      const timeA = a.createdAt?.seconds || Date.now()
      const timeB = b.createdAt?.seconds || Date.now()
      return timeA - timeB
    })
  } catch (err) {
    console.error('[Firestore] getAllUsers:', err)
    return []
  }
}

export function listenUsers(callback) {
  const q = query(col('users'));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map(d => {
      const { password: _pw, ...rest } = d.data();
      return { id: d.id, ...rest };
    });
    docs.sort((a, b) => {
      const timeA = a.createdAt?.seconds || Date.now();
      const timeB = b.createdAt?.seconds || Date.now();
      return timeA - timeB;
    });
    callback(docs);
  }, (err) => {
    console.error('[Firestore] listenUsers error:', err);
    callback([]);
  });
}

export async function createUser(username, password, fullname, role, shiftId = null) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const ref = await addDoc(col('users'), {
      username: username.trim(),
      password: hashedPassword,
      fullname,
      role,
      shiftId,
      createdAt: serverTimestamp()
    })
    // Audit log
    await addDoc(col('audit_logs'), { action: 'create_user', targetId: ref.id, userId: 'admin', details: `Pengguna "${fullname}" (@${username}) ditambahkan sebagai ${role}`, createdAt: serverTimestamp() }).catch(() => {})
    return { id: ref.id, username, fullname, role, shiftId }
  } catch (err) {
    console.error('[Firestore] createUser:', err)
    throw err
  }
}

export async function updateUser(id, username, password, fullname, role, shiftId = null) {
  try {
    const updateData = {
      username: username.trim(),
      fullname,
      role,
      shiftId
    }
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }
    
    await updateDoc(docRef('users', id), updateData)
    // Audit log
    await addDoc(col('audit_logs'), { action: 'edit_user', targetId: id, userId: 'admin', details: `Data pengguna "${fullname}" (@${username}) diperbarui`, createdAt: serverTimestamp() }).catch(() => {})
    return { success: true }
  } catch (err) {
    console.error('[Firestore] updateUser:', err)
    throw err
  }
}

export async function deleteUser(id) {
  try {
    const batch = writeBatch(db)
    
    // 1. Delete user doc
    batch.delete(docRef('users', id))

    // 2. Delete all audit_logs for this user
    const qLogs = query(col('audit_logs'), where('userId', '==', id))
    const snapLogs = await getDocs(qLogs)
    snapLogs.docs.forEach(d => batch.delete(d.ref))
    
    // We intentionally DO NOT delete transactions or shifts, to preserve financial history.
    await batch.commit()
    return { success: true }
  } catch (err) {
    console.error('[Firestore] deleteUser:', err)
    throw err
  }
}

// ─────────────────────────────────────────────
// PRODUCT OPERATIONS
// ─────────────────────────────────────────────

export async function getProducts() {
  try {
    const snap = await getDocs(query(col('products'), orderBy('name', 'asc')))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error('[Firestore] getProducts:', err)
    return []
  }
}

export function subscribeProducts(callback) {
  try {
    const q = query(col('products'), orderBy('name', 'asc'));
    return onSnapshot(q, (snap) => {
      const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(products);
    }, (error) => {
      console.error('[Firestore] subscribeProducts error:', error);
      callback([]); // Fallback
    });
  } catch (err) {
    console.error('[Firestore] subscribeProducts init error:', err);
    return () => {};
  }
}

export async function getProductById(id) {
  try {
    const snap = await getDoc(docRef('products', id))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (err) {
    console.error('[Firestore] getProductById:', err)
    return null
  }
}

export async function createProduct(name, price, stock, createdBy, category = 'Semua', hpp = 0, status = 'Aktif', variants = '[]') {
  try {
    const ref = await addDoc(col('products'), {
      name, price: Number(price), stock: Number(stock),
      category, hpp: Number(hpp), status,
      variants: typeof variants === 'string' ? variants : JSON.stringify(variants),
      createdBy, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    })
    // Audit log
    await addDoc(col('audit_logs'), { action: 'create_product', targetId: ref.id, userId: createdBy, details: `Produk "${name}" ditambahkan`, createdAt: serverTimestamp() }).catch(() => {})
    return { id: ref.id, name, price, stock, category, hpp, status }
  } catch (err) {
    console.error('[Firestore] createProduct:', err)
    throw err
  }
}

export async function updateProduct(id, name, price, stock, category = 'Semua', hpp = 0, status = 'Aktif', variants = '[]', userId = 'system') {
  try {
    await updateDoc(docRef('products', id), {
      name, price: Number(price), stock: Number(stock),
      category, hpp: Number(hpp), status,
      variants: typeof variants === 'string' ? variants : JSON.stringify(variants),
      updatedAt: serverTimestamp()
    })
    // Audit log
    await addDoc(col('audit_logs'), { action: 'edit_product', targetId: id, userId: userId, details: `Produk "${name}" diubah`, createdAt: serverTimestamp() }).catch(() => {})
    return { success: true, id }
  } catch (err) {
    console.error('[Firestore] updateProduct:', err)
    throw err
  }
}

export async function deleteProduct(id, userId = 'system') {
  try {
    const batch = writeBatch(db)
    
    // 0. Get product name for audit log
    let productName = id;
    try { const ps = await getDoc(docRef('products', id)); productName = ps.data()?.name || id; } catch(e) {}

    // 1. Delete product doc
    batch.delete(docRef('products', id))

    // 2. Delete all stock history for this product
    const qHistory = query(col('stock_history'), where('productId', '==', String(id)))
    const snapHistory = await getDocs(qHistory)
    snapHistory.docs.forEach(d => batch.delete(d.ref))

    // 3. Audit log
    const auditRef = doc(col('audit_logs'));
    batch.set(auditRef, { action: 'delete_product', targetId: id, userId: userId, details: `Produk "${productName}" dihapus`, createdAt: serverTimestamp() });

    await batch.commit()

    // 4. Clean up bulk_update_history in settings
    try {
      const cfg = await getSettings();
      if (cfg && cfg.bulk_update_history) {
        let history = JSON.parse(cfg.bulk_update_history);
        let changed = false;
        
        history = history.map(entry => {
          if (!entry.changes) return entry;
          const initialLen = entry.changes.length;
          entry.changes = entry.changes.filter(c => c.productId !== id);
          if (entry.changes.length !== initialLen) changed = true;
          return entry;
        }).filter(entry => entry.changes && entry.changes.length > 0);

        if (changed) {
          await updateSettings({ bulk_update_history: JSON.stringify(history) });
        }
      }
    } catch (e) {
      console.error('[Cleanup] Failed to clean bulk update history:', e);
    }

    return { success: true }
  } catch (err) {
    console.error('[Firestore] deleteProduct:', err)
    throw err
  }
}

export async function updateProductStock(id, quantity) {
  try {
    await updateDoc(docRef('products', id), {
      stock: increment(quantity),
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (err) {
    console.error('[Firestore] updateProductStock:', err)
    throw err
  }
}

// ─────────────────────────────────────────────
// TRANSACTION OPERATIONS
// ─────────────────────────────────────────────

/**
 * Buat transaksi baru + kurangi stok semua item secara atomik (runTransaction).
 * Args: (items, paymentMethod, totalAmount, cashAmount, changeAmount, userId, shiftId, discount, note, extraOptions)
 */
export async function createTransaction(...args) {
  const [items, paymentMethod, totalAmount, cashAmount, changeAmount, userId, shiftId, discount = 0, note = '', extraOptions = {}] = args
  try {
    const newTxRef = doc(col('transactions'));
    const invoiceNo = `TRX-${newTxRef.id.substring(0, 6).toUpperCase()}`;
    
    const txRef = await runTransaction(db, async (firestoreTx) => {
      // 1. ALL READS: Ambil data produk untuk semua item terlebih dahulu
      const validItems = items.filter(i => i && (i.productId || i.originalId || i.id));
      const productSnaps = [];
      for (const item of validItems) {
        const prodId = item.productId || item.originalId || item.id;
        const productRef = docRef('products', String(prodId));
        productSnaps.push({ item, snap: await firestoreTx.get(productRef), productRef });
      }

      // 2. ALL WRITES: Kurangi stok dan catat history (abaikan jika tidak valid/cukup)
      for (const { item, snap, productRef } of productSnaps) {
        if (snap.exists()) {
          const currentStock = snap.data().stock;
          const qty = item.qty || item.quantity || 1;
          if (currentStock >= qty) {
            firestoreTx.update(productRef, { stock: currentStock - qty, updatedAt: serverTimestamp() });
            
            // Catat history
            const stockHistoryRef = doc(col('stock_history'));
            firestoreTx.set(stockHistoryRef, {
              productId: String(productRef.id),
              type: 'out',
              quantity: qty,
              reason: `Penjualan ${invoiceNo}`,
              createdBy: userId,
              createdAt: serverTimestamp()
            });
          }
        }
      }

      // Buat dokumen transaksi
      firestoreTx.set(newTxRef, {
        invoiceNo,
        items: validItems.map(i => {
          const qty = i.qty || i.quantity || 1;
          return {
            productId: i.productId || i.originalId || i.id,
            name: i.name,
            price: i.price,
            quantity: qty,
            hpp: i.hpp || 0,
            subtotal: i.price * qty,
            variant: i.variant || null
          };
        }),
        paymentMethod,
        totalAmount: Number(totalAmount),
        cashAmount: Number(cashAmount || 0),
        changeAmount: Number(changeAmount || 0),
        discount: Number(discount),
        note,
        userId,
        shiftId: shiftId || null,
        status: 'completed',
        createdAt: serverTimestamp(),
        ...extraOptions
      })

      // Audit log transaksi baru
      const auditRef = doc(col('audit_logs'));
      firestoreTx.set(auditRef, {
        action: 'create_transaction',
        targetId: invoiceNo,
        userId,
        details: `Transaksi ${invoiceNo} · ${validItems.length} item · Total Rp ${Number(totalAmount).toLocaleString('id-ID')}`,
        createdAt: serverTimestamp()
      });

      return newTxRef
    })

    return { id: txRef.id, invoiceNo, success: true }
  } catch (err) {
    console.error('[Firestore] createTransaction:', err)
    throw err
  }
}

/** addTransactionItem tidak lagi diperlukan (sudah inline di createTransaction), dummy untuk kompatibilitas */
export async function addTransactionItem(...args) {
  return { success: true }
}

export async function getTransactions(startDate, endDate) {
  try {
    const q = query(
      col('transactions'),
      where('createdAt', '>=', toTsStart(startDate)),
      where('createdAt', '<=', toTsEnd(endDate)),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => {
      const data = d.data()
      // Map camelCase (Firestore) to snake_case (UI expectation)
      return { 
        id: d.id, 
        ...data,
        total_amount: data.totalAmount || data.total_amount || 0,
        payment_method: data.paymentMethod || data.payment_method || 'Tunai',
        created_at: toDate(data.createdAt)?.toISOString() || data.created_at,
        createdAt: toDate(data.createdAt)?.toISOString() || data.createdAt,
        user_id: data.userId || data.user_id,
        shift_id: data.shiftId || data.shift_id,
        subtotal: data.cartSubtotal || data.subtotal || data.totalAmount || 0,
        total_hpp: data.items ? data.items.reduce((s, i) => s + ((i.hpp || 0) * (i.quantity || 1)), 0) : 0,
        discount: data.discount || 0
      }
    })
  } catch (err) {
    console.error('[Firestore] getTransactions:', err)
    return []
  }
}

export async function getTransactionDetail(transactionId) {
  try {
    const snap = await getDoc(docRef('transactions', transactionId))
    if (!snap.exists()) return []
    const data = snap.data()
    return data.items || []
  } catch (err) {
    console.error('[Firestore] getTransactionDetail:', err)
    return []
  }
}

export async function getDailySalesReport(date) {
  try {
    const transactions = await getTransactions(date, date)
    const completed = transactions.filter(t => t.status !== 'voided')
    const totalRevenue = completed.reduce((s, t) => s + t.totalAmount, 0)
    const totalHpp = completed.reduce((s, t) =>
      s + (t.items || []).reduce((ss, i) => ss + (i.hpp || 0) * i.quantity, 0), 0)
    return {
      date,
      transactionCount: completed.length,
      totalRevenue,
      totalHpp,
      profit: totalRevenue - totalHpp
    }
  } catch (err) {
    console.error('[Firestore] getDailySalesReport:', err)
    return null
  }
}

export async function getShiftCashSales(shiftId) {
  try {
    const q = query(
      col('transactions'),
      where('shiftId', '==', shiftId),
      where('paymentMethod', '==', 'Tunai'),
      where('status', '==', 'completed')
    )
    const snap = await getDocs(q)
    return snap.docs.reduce((sum, doc) => sum + (doc.data().totalAmount || 0), 0)
  } catch (err) {
    console.error('[Firestore] getShiftCashSales:', err)
    return 0
  }
}

export async function getProductSalesReport(startDate, endDate) {
  try {
    const transactions = await getTransactions(startDate, endDate)
    const completed = transactions.filter(t => t.status !== 'voided')
    const productMap = {}
    completed.forEach(t => {
      (t.items || []).forEach(item => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = {
            id: item.productId,
            productId: item.productId,
            name: item.name,
            total_sold: 0,
            total_revenue: 0,
            totalHpp: 0
          }
        }
        productMap[item.productId].total_sold += item.quantity
        productMap[item.productId].total_revenue += item.subtotal || (item.price * item.quantity)
        productMap[item.productId].totalHpp += (item.hpp || 0) * item.quantity
      })
    })
    return Object.values(productMap).sort((a, b) => b.total_revenue - a.total_revenue)
  } catch (err) {
    console.error('[Firestore] getProductSalesReport:', err)
    throw err
  }
}

export async function deleteTransaction(transactionId, userId, reason) {
  try {
    const txRef = docRef('transactions', transactionId);
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) throw new Error('Transaksi tidak ditemukan');

    const txData = txSnap.data();

    await runTransaction(db, async (firestoreTx) => {
      // 1. ALL READS: Read all products first
      const productSnaps = [];
      for (const item of (txData.items || [])) {
        const pid = item.productId || item.originalId || item.id;
        if (!pid) continue;
        const productRef = docRef('products', String(pid));
        try {
          const productSnap = await firestoreTx.get(productRef);
          productSnaps.push({ snap: productSnap, productRef, item });
        } catch (e) {
          console.warn('[deleteTransaction] Gagal membaca produk, skip:', pid);
        }
      }

      // 2. ALL WRITES: Update stock
      for (const { snap, productRef, item } of productSnaps) {
        if (snap.exists()) {
          firestoreTx.update(productRef, {
            stock: increment(item.quantity || 1),
            updatedAt: serverTimestamp()
          });
        }
      }
      
      // Completely delete the transaction document
      firestoreTx.delete(txRef);
      
      // Audit log
      const auditRef = doc(col('audit_logs'));
      firestoreTx.set(auditRef, {
        action: 'delete_transaction',
        targetId: transactionId,
        userId,
        reason,
        createdAt: serverTimestamp()
      });
    });

    return { success: true };
  } catch (err) {
    console.error('[Firestore] deleteTransaction:', err);
    throw err;
  }
}

export async function voidTransaction(transactionId, userId, reason) {
  try {
    const txRef = docRef('transactions', transactionId)
    const txSnap = await getDoc(txRef)
    if (!txSnap.exists()) throw new Error('Transaksi tidak ditemukan')

    const txData = txSnap.data()

    await runTransaction(db, async (firestoreTx) => {
      // 1. ALL READS: Ambil data produk
      const productSnaps = [];
      for (const item of (txData.items || [])) {
        const pid = item.productId || item.originalId || item.id
        if (!pid) continue
        const productRef = docRef('products', String(pid))
        try {
          const productSnap = await firestoreTx.get(productRef)
          productSnaps.push({ snap: productSnap, productRef, item });
        } catch (e) {
          console.warn('[voidTransaction] Gagal read, skip stok:', pid)
        }
      }

      // 2. ALL WRITES: Update stok
      for (const { snap, productRef, item } of productSnaps) {
        if (snap.exists()) {
          firestoreTx.update(productRef, {
            stock: increment(item.quantity || 1),
            updatedAt: serverTimestamp()
          })
        }
      }
      // Update status transaksi
      firestoreTx.update(txRef, {
        status: 'voided',
        voidReason: reason,
        voidedBy: userId,
        voidedAt: serverTimestamp()
      })
      // Catat audit log
      const auditRef = doc(col('audit_logs'))
      firestoreTx.set(auditRef, {
        action: 'void_transaction',
        targetId: transactionId,
        userId,
        reason,
        createdAt: serverTimestamp()
      })
    })

    return { success: true }
  } catch (err) {
    console.error('[Firestore] voidTransaction:', err)
    throw err
  }
}

// ─────────────────────────────────────────────
// SETTINGS OPERATIONS
// ─────────────────────────────────────────────

export async function getSettings() {
  try {
    const snap = await getDoc(docRef('settings', 'global'))
    return snap.exists() ? snap.data() : {}
  } catch (err) {
    console.error('[Firestore] getSettings:', err)
    return {}
  }
}

export async function updateSettings(settingsObj) {
  try {
    await setDoc(docRef('settings', 'global'), settingsObj, { merge: true })
    return { success: true }
  } catch (err) {
    console.error('[Firestore] updateSettings:', err)
    throw err
  }
}

export function subscribeSettings(callback) {
  const ref = docRef('settings', 'global')
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : {})
  }, (err) => {
    console.error('[Firestore] subscribeSettings:', err)
  })
}

// ─────────────────────────────────────────────
// SHIFT OPERATIONS
// ─────────────────────────────────────────────

export async function getActiveShift(userId) {
  try {
    const q = query(col('shifts'), where('userId', '==', userId), where('status', '==', 'active'))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
  } catch (err) {
    console.error('[Firestore] getActiveShift:', err)
    return null
  }
}

export async function startShift(user, startBalance) {
  try {
    const ref = await addDoc(col('shifts'), {
      userId: user.id,
      fullname: user.fullname || user.name || '',
      username: user.username || '',
      startBalance: Number(startBalance),
      status: 'active',
      startedAt: serverTimestamp()
    })
    return { id: ref.id, success: true }
  } catch (err) {
    console.error('[Firestore] startShift:', err)
    throw err
  }
}

export async function endShift(shiftId, endBalance) {
  try {
    await updateDoc(docRef('shifts', shiftId), {
      endBalance: Number(endBalance),
      status: 'closed',
      endedAt: serverTimestamp()
    })
    return { success: true }
  } catch (err) {
    console.error('[Firestore] endShift:', err)
    throw err
  }
}

export async function getAllShifts(startDate, endDate) {
  try {
    const q = query(
      col('shifts'),
      where('startedAt', '>=', toTsStart(startDate)),
      where('startedAt', '<=', toTsEnd(endDate)),
      orderBy('startedAt', 'desc')
    )
    const [snap, userSnap] = await Promise.all([
      getDocs(q),
      getDocs(col('users'))
    ])
    const userMap = {}
    userSnap.docs.forEach(d => { userMap[d.id] = d.data() })
    return snap.docs.map(d => {
      const data = d.data()
      const userInfo = userMap[data.userId] || {}
      let fName = userInfo.fullname || data.fullname;
      if (!fName) {
        if (data.userId === 'kasir-event-id' || data.userId === 'kasir') fName = 'Kasir Utama';
        else if (data.userId === 'admin-event-id' || data.userId === 'admin') fName = 'Administrator';
        else fName = 'Admin';
      }
      
      return { 
        id: d.id, 
        ...data,
        fullname: fName,
        username: data.username || userInfo.username || '-',
        start_time: data.startedAt ? toDate(data.startedAt)?.toISOString() : null,
        end_time: data.endedAt ? toDate(data.endedAt)?.toISOString() : null,
        start_balance: data.startBalance || 0,
        end_balance: data.endBalance != null ? data.endBalance : null,
        user_id: data.userId,
        status: data.status === 'active' ? 'Aktif' : (data.status === 'closed' ? 'Selesai' : data.status)
      }
    })
  } catch (err) {
    console.error('[Firestore] getAllShifts:', err)
    return []
  }
}

// ─────────────────────────────────────────────
// STOCK OPERATIONS
// ─────────────────────────────────────────────

export async function getStockHistory(productId = null) {
  try {
    let q;
    if (productId) {
      q = query(col('stock_history'), where('productId', '==', productId), orderBy('createdAt', 'desc'), limit(100));
    } else {
      q = query(col('stock_history'), orderBy('createdAt', 'desc'), limit(100));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: toDate(data.createdAt)?.toISOString() || data.createdAt
      };
    });
  } catch (err) {
    console.error('[Firestore] getStockHistory:', err);
    throw err;
  }
}

export async function logStock(productId, type, quantity, reason, createdBy) {
  try {
    const ref = await addDoc(col('stock_history'), {
      productId, type, quantity: Number(quantity),
      reason, createdBy, createdAt: serverTimestamp()
    })
    await updateDoc(docRef('products', productId), {
      stock: increment(type === 'in' ? Number(quantity) : -Number(quantity)),
      updatedAt: serverTimestamp()
    })
    // Audit log
    const sign = type === 'in' ? '+' : '-';
    await addDoc(col('audit_logs'), { action: 'update_stock', targetId: productId, userId: createdBy, details: `Stok ${sign}${quantity} · ${reason}`, createdAt: serverTimestamp() }).catch(() => {})
    return { id: ref.id, success: true }
  } catch (err) {
    console.error('[Firestore] logStock:', err)
    throw err
  }
}

// ─────────────────────────────────────────────
// CATEGORY OPERATIONS
// ─────────────────────────────────────────────

export const getCategories = async () => {
  try {
    const snap = await getDocs(query(col('categories'), orderBy('name', 'asc')))
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    
    // Filter duplicates manually just in case
    const unique = []
    const seen = new Set()
    for (const d of docs) {
      if (!seen.has(d.name)) {
        seen.add(d.name)
        unique.push(d)
      }
    }
    return unique
  } catch (err) {
    console.error('[Firestore] getCategories:', err)
    return []
  }
}

export const listenCategories = (callback) => {
  const q = query(col('categories'), orderBy('name', 'asc'));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const unique = [];
    const seen = new Set();
    for (const d of docs) {
      if (!seen.has(d.name)) {
        seen.add(d.name);
        unique.push(d);
      }
    }
    callback(unique);
  }, (err) => {
    console.error('[Firestore] listenCategories error:', err);
  });
}

export const createCategory = async (name) => {
  try {
    const ref = await addDoc(col('categories'), { name, createdAt: serverTimestamp() })
    return { id: ref.id, name }
  } catch (err) {
    console.error('[Firestore] createCategory:', err)
    throw err
  }
}

export const deleteCategory = async (id) => {
  try {
    await deleteDoc(docRef('categories', id))
    return { success: true }
  } catch (err) {
    console.error('[Firestore] deleteCategory:', err)
    throw err
  }
}

// ─────────────────────────────────────────────
// EXPENSE OPERATIONS
// ─────────────────────────────────────────────

export const createExpense = async (amount, description, category, userId) => {
  try {
    const ref = await addDoc(col('expenses'), {
      amount: Number(amount), description, category,
      userId, createdAt: serverTimestamp()
    })
    return { id: ref.id, success: true }
  } catch (err) {
    console.error('[Firestore] createExpense:', err)
    throw err
  }
}

export const getExpenses = async (startDate, endDate) => {
  try {
    const q = query(
      col('expenses'),
      where('createdAt', '>=', toTsStart(startDate)),
      where('createdAt', '<=', toTsEnd(endDate)),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error('[Firestore] getExpenses:', err)
    return []
  }
}

export const deleteExpense = async (id, userId) => {
  try {
    await deleteDoc(docRef('expenses', id))
    return { success: true }
  } catch (err) {
    console.error('[Firestore] deleteExpense:', err)
    throw err
  }
}

// ─────────────────────────────────────────────
// AUDIT LOG OPERATIONS
// ─────────────────────────────────────────────

export const getAuditLogs = async (startDate, endDate, limitCount = 200) => {
  try {
    // Simple query: no date range filter to avoid composite index requirement
    // Just get latest N records ordered by createdAt
    const q = query(
      col('audit_logs'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        ...data,
        createdAt: toDate(data.createdAt)?.toISOString() || data.createdAt
      }
    })
  } catch (err) {
    console.error('[Firestore] getAuditLogs:', err)
    return []
  }
}

// ─────────────────────────────────────────────
// REAL-TIME LISTENERS (Added for Live Dashboard & POS)
// ─────────────────────────────────────────────

export function listenProducts(callback) {
  const q = query(col('products'), orderBy('name', 'asc'));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(data);
  }, (err) => {
    console.error('[Firestore] listenProducts error:', err);
  });
}

export function listenTransactions(startDate, endDate, callback) {
  const q = query(
    col('transactions'),
    where('createdAt', '>=', toTsStart(startDate)),
    where('createdAt', '<=', toTsEnd(endDate)),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => {
      const dt = d.data();
      return { 
        id: d.id, 
        ...dt,
        total_amount: dt.totalAmount || dt.total_amount || 0,
        payment_method: dt.paymentMethod || dt.payment_method || 'Tunai',
        created_at: toDate(dt.createdAt)?.toISOString() || dt.created_at,
        createdAt: toDate(dt.createdAt)?.toISOString() || dt.createdAt,
        user_id: dt.userId || dt.user_id,
        shift_id: dt.shiftId || dt.shift_id,
        subtotal: dt.cartSubtotal || dt.subtotal || dt.totalAmount || 0,
        total_hpp: dt.items ? dt.items.reduce((s, i) => s + ((i.hpp || 0) * (i.quantity || 1)), 0) : 0,
        discount: dt.discount || 0
      };
    });
    callback(data);
  }, (err) => {
    console.error('[Firestore] listenTransactions error:', err);
  });
}

export function listenShifts(startDate, endDate, callback) {
  const q = query(
    col('shifts'),
    where('startedAt', '>=', toTsStart(startDate)),
    where('startedAt', '<=', toTsEnd(endDate)),
    orderBy('startedAt', 'desc')
  );
  
  let userMap = {};
  getDocs(col('users')).then(userSnap => {
    userSnap.docs.forEach(d => { userMap[d.id] = d.data() });
  }).catch(e => console.error(e));

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => {
      const dt = d.data();
      const userInfo = userMap[dt.userId] || {};
      let fName = dt.fullname || userInfo.fullname;
      if (!fName) {
        if (dt.userId === 'kasir-event-id' || dt.userId === 'kasir') fName = 'Kasir Utama';
        else if (dt.userId === 'admin-event-id' || dt.userId === 'admin') fName = 'Administrator';
        else fName = '-';
      }

      return { 
        id: d.id, 
        ...dt,
        fullname: fName,
        username: dt.username || userInfo.username || '-',
        start_time: dt.startedAt ? toDate(dt.startedAt)?.toISOString() : null,
        end_time: dt.endedAt ? toDate(dt.endedAt)?.toISOString() : null,
        start_balance: dt.startBalance || 0,
        end_balance: dt.endBalance != null ? dt.endBalance : null,
        user_id: dt.userId,
        status: dt.status === 'active' ? 'Aktif' : (dt.status === 'closed' ? 'Selesai' : dt.status)
      };
    });
    callback(data);
  }, (err) => {
    console.error('[Firestore] listenShifts error:', err);
  });
}

/** Helper internal: catat audit log tanpa blocking (fire-and-forget) */
export const createAuditLog = async (userId, action, details) => {
  try {
    await addDoc(col('audit_logs'), {
      userId, action, details,
      createdAt: serverTimestamp()
    })
  } catch (err) {
    console.warn('[Firestore] createAuditLog failed (non-critical):', err)
  }
}

// ─────────────────────────────────────────────
// PRINTER OPERATIONS (Web: gunakan window.print())
// ─────────────────────────────────────────────

export const getPrinters = async () => {
  // Browser tidak bisa enumerasi printer; kembalikan array kosong
  return []
}

export const printReceipt = async ({ html, printerName, paperWidth }) => {
  return new Promise((resolve) => {
    // 1. Buat iframe tersembunyi untuk merender struk
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    // 2. Siapkan CSS Khusus Kertas Thermal (58mm atau 80mm)
    const mmWidth = paperWidth === '58' ? '58mm' : (paperWidth === '114' ? '114mm' : '80mm')
    
    // 3. Masukkan konten HTML struk ke dalam iframe
    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(`
      <html>
        <head>
          <title>Cetak Struk</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html {
              width: ${mmWidth};
              max-width: ${mmWidth};
            }
            body {
              width: ${mmWidth};
              max-width: ${mmWidth};
              font-family: 'Courier New', monospace;
              font-size: ${paperWidth === '58' ? '10px' : '11px'};
              color: #000;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @media print {
              @page {
                size: ${mmWidth} auto;
                margin: 0mm;
              }
              html, body {
                width: ${mmWidth};
                max-width: ${mmWidth};
                margin: 0;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `)
    doc.close()

    // 4. Tunggu sesaat agar iframe dan gambar selesai dirender
    iframe.onload = () => {
      setTimeout(() => {
        try {
          const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (!isMobileDevice) {
            iframe.contentWindow.focus()
            iframe.contentWindow.print()
          } else {
            console.log("Menghindari auto-print di perangkat mobile/tablet untuk mencegah crash/blokir.");
          }
        } catch (e) {
          console.error("Print gagal:", e)
        }
        
        // 5. Hapus iframe setelah dialog print muncul/ditutup
        setTimeout(() => {
          try {
            document.body.removeChild(iframe)
          } catch (e) {}
          resolve({ success: true })
        }, 1000)
      }, 500)
    }
  })
}

// ─────────────────────────────────────────────
// NETWORK OPERATIONS (Tidak berlaku di Web)
// ─────────────────────────────────────────────

export const scanServer = async () => ({ success: false, message: 'Tidak berlaku di Web App.' })
export const setNetworkMode = async () => ({ success: true })

// ─────────────────────────────────────────────
// SEED DUMMY DATA FOR EVALUATION
// ─────────────────────────────────────────────
export async function seedDummyData(userId) {
  try {
    const collectionsToClear = ['products', 'transactions', 'stock_history', 'audit_logs', 'shifts', 'users'];
    
    // Hapus semua data lama (Hati-hati: Batas 500 dokumen per batch, untuk dummy ini cukup)
    for (const c of collectionsToClear) {
      const q = query(col(c));
      const snapshot = await getDocs(q);
      const batchOp = writeBatch(db);
      snapshot.docs.forEach((d) => {
        batchOp.delete(d.ref);
      });
      await batchOp.commit();
    }

    const batch = writeBatch(db);

    // 1. Buat Dummy Shift
    const shiftRef = doc(col('shifts'));
    const shiftId = shiftRef.id;
    batch.set(shiftRef, {
      name: 'Shift Utama (Dummy)',
      startedAt: serverTimestamp(),
      startBalance: 100000,
      endBalance: 0,
      status: 'active',
      userId: userId
    });

    // 2. Buat Dummy Products
    const dummyProducts = [
      { name: 'Nasi Goreng Spesial', price: 25000, hpp: 15000, stock: 45, category: 'Makanan', type: 'food' },
      { name: 'Mie Goreng Seafood', price: 30000, hpp: 18000, stock: 30, category: 'Makanan', type: 'food' },
      { name: 'Ayam Bakar Madu', price: 28000, hpp: 16000, stock: 25, category: 'Makanan', type: 'food' },
      { name: 'Es Teh Manis', price: 5000, hpp: 2000, stock: 100, category: 'Minuman', type: 'drink' },
      { name: 'Kopi Susu Gula Aren', price: 18000, hpp: 8000, stock: 50, category: 'Minuman', type: 'drink' },
      { name: 'Jus Jeruk Segar', price: 15000, hpp: 7000, stock: 40, category: 'Minuman', type: 'drink' },
      { name: 'Kerupuk Udang', price: 5000, hpp: 2000, stock: 150, category: 'Snack', type: 'snack' },
      { name: 'Sate Ayam Madura', price: 22000, hpp: 12000, stock: 60, category: 'Makanan', type: 'food' },
      { name: 'Nasi Putih', price: 5000, hpp: 2000, stock: 200, category: 'Makanan', type: 'food' },
      { name: 'Es Jeruk Nipis', price: 12000, hpp: 4000, stock: 80, category: 'Minuman', type: 'drink' }
    ];

    const prodIds = [];
    for (const p of dummyProducts) {
      const pRef = doc(col('products'));
      prodIds.push(pRef.id);
      batch.set(pRef, {
        ...p,
        variants: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // 3. Buat Dummy Transactions (Bulan ini)
    const now = new Date();
    for (let i = 0; i < 15; i++) {
      const tRef = doc(col('transactions'));
      const randProd1 = Math.floor(Math.random() * 5);
      const randProd2 = Math.floor(Math.random() * 5) + 5;
      const qty1 = Math.floor(Math.random() * 3) + 1;
      const qty2 = Math.floor(Math.random() * 2) + 1;
      
      const sub1 = dummyProducts[randProd1].price * qty1;
      const sub2 = dummyProducts[randProd2].price * qty2;
      const total = sub1 + sub2;

      // Random date dalam 7 hari terakhir
      const pastDate = new Date();
      pastDate.setDate(now.getDate() - Math.floor(Math.random() * 7));
      
      batch.set(tRef, {
        invoiceNo: `INV-DUMMY-${1000 + i}`,
        items: [
          { productId: prodIds[randProd1], name: dummyProducts[randProd1].name, price: dummyProducts[randProd1].price, hpp: dummyProducts[randProd1].hpp, quantity: qty1, subtotal: sub1 },
          { productId: prodIds[randProd2], name: dummyProducts[randProd2].name, price: dummyProducts[randProd2].price, hpp: dummyProducts[randProd2].hpp, quantity: qty2, subtotal: sub2 }
        ],
        paymentMethod: Math.random() > 0.5 ? 'Tunai' : 'QRIS',
        totalAmount: total,
        cashAmount: total,
        changeAmount: 0,
        discount: 0,
        userId: userId,
        shiftId: shiftId,
        status: 'completed',
        createdAt: pastDate
      });
    }

    await batch.commit();

    // Log Audit
    await createAuditLog('Sistem', 'Seeding Data Dummy', 'Berhasil menyuntikkan data dummy untuk pengujian.');

    return { success: true };
  } catch (err) {
    console.error('Error seeding dummy data:', err);
    return { success: false, message: err.message };
  }
}

