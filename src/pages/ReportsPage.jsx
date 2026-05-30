import React, { useState, useEffect, useContext, useCallback } from 'react';
import { getTransactions, getProductSalesReport } from '../api/ipc';
import { ToastContext } from '../contexts/ToastContext';
import { AuthContext } from '../contexts/AuthContext';

import ConfirmModal from '../components/ConfirmModal';
import { getLocalISODate, getFirstDayOfMonth, parseSQLiteDate, formatDateTimeAMPM, formatAMPM } from '../utils/dateHelper';

export default function ReportsPage({ kasirMode = false }) {
  const [transactions, setTransactions] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [shiftsData, setShiftsData] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [activeTab, setActiveTab] = useState('trx');
  const [stats, setStats] = useState({ omzet: 0, trxCount: 0, avg: 0, profit: 0, totalExpenses: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [voidModal, setVoidModal] = useState({ isOpen: false, trxId: null, reason: '' });
  const [expenseModal, setExpenseModal] = useState({ isOpen: false, desc: '', amount: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, expenseId: null });

  // Default: awal bulan → hari ini (always fresh)
  const getToday = getLocalISODate;
  const getFirstDay = getFirstDayOfMonth;
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());

  const { addToast } = useContext(ToastContext);
  const { user: currentUser } = useContext(AuthContext);

  useEffect(() => {
    loadReport();
    // Auto-refresh when POS completes a sale
    const onSale = () => loadReport();
    window.addEventListener('data:refresh', onSale);
    
    // Auto-poll every 30 seconds for LAN synchronization
    const poll = setInterval(() => loadReport(), 30_000);

    return () => {
      window.removeEventListener('data:refresh', onSale);
      clearInterval(poll);
    };
  }, [startDate, endDate]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      // Add time components to include full days
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const startStr = start.toISOString();
      const endStr = end.toISOString();

      const { getProductSalesReport, getAllShifts, getExpenses, getAllUsers, getProducts } = await import('../api/ipc');
      
      let [data, pData, sData, eData, uData, prodList] = await Promise.all([
        getTransactions(startStr, endStr),
        getProductSalesReport(startStr, endStr),
        getAllShifts(startStr, endStr),
        getExpenses(startStr, endStr),
        getAllUsers(),
        getProducts()
      ]);

      // ONE-TIME CLEANUP (User requested to delete transaction TRX-WBQB5NVOID)
      const toDelete = data.filter(t => 
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
        data = data.filter(t => !toDelete.includes(t));
      }

      setTransactions(data);
      setProductSales(pData);
      setShiftsData(sData);
      setExpenses(eData || []);
      setUsers(uData || []);
      setProductsList(prodList || []);

      const totalExpenses = (eData || []).reduce((acc, ex) => acc + (ex.amount || 0), 0);
      const validTrx = data.filter(t => t.status?.toLowerCase() !== 'voided');
      const omzet = validTrx.reduce((acc, trx) => acc + (trx.total_amount || 0), 0);
      const actualGrossProfit = validTrx.reduce((acc, trx) => acc + ((trx.subtotal - trx.discount) - (trx.total_hpp || 0)), 0);
      const profit = actualGrossProfit - totalExpenses; // Net profit

      setStats({
        omzet,
        trxCount: validTrx.length,
        avg: validTrx.length > 0 ? Math.round(omzet / validTrx.length) : 0,
        profit,
        totalExpenses
      });
    } catch (error) {
      addToast('Gagal memuat laporan', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const rp = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

  const parseDate = parseSQLiteDate;

  // ─── Export Excel (.xlsx) via SheetJS ───────────────────────
  const exportExcel = async () => {
    addToast('Membuat file Excel Analisis...', 'info');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // ─ Helper: style header row & columns ────────────────────────
      const applyHeaderStyle = (ws, headerRow, cols) => {
        const headerStyle = {
          font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
          fill: { fgColor: { rgb: '0F172A' }, patternType: 'solid' }, // Dark slate navy
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            bottom: { style: 'medium', color: { rgb: '0D9488' } } // Teal highlight line
          }
        };
        const numStyle = {
          font: { name: 'Arial', sz: 10 },
          numFmt: '#,##0',
          alignment: { horizontal: 'right', vertical: 'center' }
        };
        const pctStyle = {
          font: { name: 'Arial', sz: 10 },
          numFmt: '0.00%',
          alignment: { horizontal: 'right', vertical: 'center' }
        };
        const redStyle = {
          font: { name: 'Arial', sz: 10, color: { rgb: 'CC0000' } },
          numFmt: '#,##0',
          alignment: { horizontal: 'right', vertical: 'center' }
        };
        const defStyle = {
          font: { name: 'Arial', sz: 10 },
          alignment: { vertical: 'center' }
        };
        const centerStyle = {
          font: { name: 'Arial', sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' }
        };

        // Style header
        cols.forEach((col, i) => {
          const addr = XLSX.utils.encode_cell({ r: headerRow, c: i });
          if (!ws[addr]) return;
          ws[addr].s = headerStyle;
        });

        // Style data rows
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = headerRow + 1; R <= range.e.r; R++) {
          cols.forEach((col, C) => {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[addr]) return;
            const cell = ws[addr];
            
            // Format number cells correctly using SheetJS native .z formatting
            if (col.money) {
              cell.z = '#,##0';
              if (col.red) cell.s = redStyle;
              else cell.s = numStyle;
            } else if (col.percent) {
              cell.z = '0.00%';
              cell.s = pctStyle;
            } else if (col.align === 'center') {
              cell.s = centerStyle;
            } else if (col.align === 'right') {
              cell.s = numStyle;
            } else {
              cell.s = defStyle;
            }
          });
        }
      };

      // ─── Calculations for Summary ──────────────────────────────
      const productMap = new Map(productsList.map(p => [p.id, p]));
      const validTransactions = transactions.filter(t => t.status?.toLowerCase() !== 'voided');
      const voidedTransactions = transactions.filter(t => t.status?.toLowerCase() === 'voided');
      
      const totalGrossSales = validTransactions.reduce((acc, t) => acc + (t.subtotal || 0), 0);
      const totalDiscount = validTransactions.reduce((acc, t) => acc + (t.discount || 0), 0);
      const totalNetSales = validTransactions.reduce((acc, t) => acc + (t.total_amount || 0), 0);
      const totalHpp = validTransactions.reduce((acc, t) => acc + (t.total_hpp || 0), 0);
      const totalGrossProfit = totalNetSales - totalHpp;
      const gpmRatio = totalNetSales > 0 ? (totalGrossProfit / totalNetSales) : 0;
      const totalExpenses = stats.totalExpenses;
      const totalNetProfit = totalGrossProfit - totalExpenses;
      const npmRatio = totalNetSales > 0 ? (totalNetProfit / totalNetSales) : 0;

      let totalQtySold = 0;
      const payMap = {};
      const catSales = {};
      const expCategories = {};

      validTransactions.forEach(t => {
        const trxSub = t.subtotal || t.total_amount || 1;
        
        // Payment method breakdown
        const m = t.payment_method || 'Tunai';
        if (!payMap[m]) payMap[m] = { count: 0, total: 0 };
        payMap[m].count += 1;
        payMap[m].total += t.total_amount || 0;
        
        // Item & category breakdown
        (t.items || []).forEach(item => {
          const qty = item.quantity || item.qty || 1;
          totalQtySold += qty;
          
          const prodId = item.productId || item.id;
          const pInfo = productMap.get(prodId) || {};
          const catName = pInfo.category || 'Lain-lain';
          if (!catSales[catName]) catSales[catName] = { qty: 0, sales: 0, hpp: 0, profit: 0 };
          
          const itemSub = item.subtotal || (item.price * qty);
          const propDiscount = t.discount ? (itemSub / trxSub) * t.discount : 0;
          const itemNet = itemSub - propDiscount;
          const itemHppTotal = (item.hpp || pInfo.hpp || 0) * qty;
          
          catSales[catName].qty += qty;
          catSales[catName].sales += itemNet;
          catSales[catName].hpp += itemHppTotal;
          catSales[catName].profit += (itemNet - itemHppTotal);
        });
      });

      // Expense breakdown
      expenses.forEach(ex => {
        const cat = ex.category || 'Operasional';
        if (!expCategories[cat]) expCategories[cat] = { count: 0, total: 0 };
        expCategories[cat].count += 1;
        expCategories[cat].total += ex.amount || 0;
      });

      const payBreakdown = Object.entries(payMap).map(([method, data]) => [
        method,
        data.count,
        data.total,
        totalNetSales > 0 ? (data.total / totalNetSales) : 0
      ]);

      const expBreakdown = Object.entries(expCategories).map(([cat, data]) => [
        cat,
        data.count,
        data.total,
        totalExpenses > 0 ? (data.total / totalExpenses) : 0
      ]);

      const catBreakdown = Object.entries(catSales).map(([cat, data]) => [
        cat,
        data.qty,
        data.sales,
        data.profit,
        data.sales > 0 ? (data.profit / data.sales) : 0
      ]);

      // ─── Sheet 1: Ringkasan Finansial ──────────────────────────
      const financialCols = [
        { header: 'Metrik', align: 'left' },
        { header: 'Nilai', money: true, align: 'right' },
        { header: 'Keterangan', align: 'left' }
      ];
      const financialRows = [
        ['Penjualan Kotor (Gross Sales)', totalGrossSales, 'Total nilai penjualan sebelum diskon'],
        ['Total Diskon Penjualan', totalDiscount, 'Total potongan harga/diskon transaksi'],
        ['Penjualan Bersih (Net Sales)', totalNetSales, 'Total pendapatan bersih (Gross - Diskon)'],
        ['Harga Pokok Penjualan (HPP / COGS)', totalHpp, 'Total biaya modal barang terjual'],
        ['Laba Kotor (Gross Profit)', totalGrossProfit, 'Penjualan Bersih - HPP'],
        ['Rasio Laba Kotor (GPM %)', gpmRatio, 'Margin Laba Kotor terhadap Penjualan Bersih'],
        ['Total Pengeluaran Operasional', totalExpenses, 'Total biaya operasional kasir & operasional toko'],
        ['Estimasi Laba Bersih (Net Profit)', totalNetProfit, 'Laba Kotor - Pengeluaran'],
        ['Rasio Laba Bersih (NPM %)', npmRatio, 'Margin Laba Bersih terhadap Penjualan Bersih'],
        ['Jumlah Transaksi Berhasil', validTransactions.length, 'Transaksi selesai (tidak termasuk void)'],
        ['Rata-rata Nilai Transaksi', stats.avg, 'Nilai rata-rata belanja per struk'],
        ['Jumlah Transaksi Dibatalkan (Void)', voidedTransactions.length, 'Transaksi yang dibatalkan / dihapus'],
        ['Total Produk Terjual', totalQtySold, 'Jumlah item terjual'],
        ['Rata-rata Item per Transaksi', validTransactions.length > 0 ? (totalQtySold / validTransactions.length) : 0, 'Jumlah item per struk belanja']
      ];
      
      const wsFinancial = XLSX.utils.aoa_to_sheet([financialCols.map(c => c.header), ...financialRows]);
      wsFinancial['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 50 }];
      applyHeaderStyle(wsFinancial, 0, financialCols);
      // Format manual untuk yang bukan nominal (persen & float)
      const r_gpm = XLSX.utils.encode_cell({ r: 6, c: 1 }); if (wsFinancial[r_gpm]) wsFinancial[r_gpm].z = '0.00%';
      const r_npm = XLSX.utils.encode_cell({ r: 9, c: 1 }); if (wsFinancial[r_npm]) wsFinancial[r_npm].z = '0.00%';
      const r_avg = XLSX.utils.encode_cell({ r: 14, c: 1 }); if (wsFinancial[r_avg]) wsFinancial[r_avg].z = '0.0';
      XLSX.utils.book_append_sheet(wb, wsFinancial, 'Ringkasan Finansial');

      // ─── Sheet 2: Metode Pembayaran ──────────────────────────
      const payCols = [
        { header: 'Metode Pembayaran', align: 'left' },
        { header: 'Transaksi', align: 'right' },
        { header: 'Total Nominal (IDR)', money: true, align: 'right' },
        { header: 'Persentase Omzet', percent: true, align: 'right' }
      ];
      const wsPay = XLSX.utils.aoa_to_sheet([payCols.map(c => c.header), ...(payBreakdown.length > 0 ? payBreakdown : [['Belum ada data', 0, 0, 0]])]);
      wsPay['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 20 }];
      applyHeaderStyle(wsPay, 0, payCols);
      XLSX.utils.book_append_sheet(wb, wsPay, 'Metode Pembayaran');

      // ─── Sheet 3: Kategori Produk ──────────────────────────
      const catCols = [
        { header: 'Kategori Produk', align: 'left' },
        { header: 'Qty Terjual', align: 'right' },
        { header: 'Penjualan Bersih (IDR)', money: true, align: 'right' },
        { header: 'Profit Kotor (IDR)', money: true, align: 'right' },
        { header: 'Margin (%)', percent: true, align: 'right' }
      ];
      const wsCat = XLSX.utils.aoa_to_sheet([catCols.map(c => c.header), ...(catBreakdown.length > 0 ? catBreakdown : [['Belum ada data', 0, 0, 0, 0]])]);
      wsCat['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }];
      applyHeaderStyle(wsCat, 0, catCols);
      XLSX.utils.book_append_sheet(wb, wsCat, 'Kategori Produk');

      // ─── Sheet 2: Detail Transaksi ──────────────────────────────
      const trxCols = [
        { header: 'No. Transaksi', align: 'center' },
        { header: 'Tanggal', align: 'center' },
        { header: 'Waktu', align: 'center' },
        { header: 'Kasir', align: 'left' },
        { header: 'Pelanggan', align: 'left' },
        { header: 'Tipe Order', align: 'center' },
        { header: 'Meja', align: 'center' },
        { header: 'Pax', align: 'center', type: 'integer' },
        { header: 'Subtotal (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Diskon (Rp)', money: true, red: true, type: 'money', align: 'right' },
        { header: 'Total Bayar (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Total HPP (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Profit Kotor (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Margin (%)', type: 'percent', align: 'right', percent: true },
        { header: 'Metode Bayar', align: 'center' },
        { header: 'Catatan', align: 'left' },
        { header: 'Status', align: 'center' },
        { header: 'Void Oleh', align: 'left' },
        { header: 'Alasan Void', align: 'left' },
      ];
      
      const trxRows = transactions.map(t => {
        const d = parseSQLiteDate(t.created_at);
        const uid = t.userId || t.user_id;
        const kasir = users.find(u => u.id === uid)?.fullname || uid || 'Admin';
        
        const sub = t.subtotal || 0;
        const disc = t.discount || 0;
        const net = t.total_amount || 0;
        const hpp = t.status?.toLowerCase() === 'voided' ? 0 : (t.total_hpp || 0);
        const profit = t.status?.toLowerCase() === 'voided' ? 0 : (net - hpp);
        const margin = net > 0 ? (profit / net) : 0;

        return [
          'TRX-' + String(t.id).substring(0, 6).toUpperCase(),
          d.toLocaleDateString('id-ID'),
          d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          kasir,
          t.customerName || t.customer_name || '-',
          t.orderType || t.order_type || 'Dine In',
          t.tableNo || t.table_no || t.tableNumber || '-',
          t.pax || 0,
          sub,
          disc,
          net,
          hpp,
          profit,
          margin,
          t.payment_method || 'Tunai',
          t.note || '-',
          t.status || 'Completed',
          t.voidedBy || '-',
          t.voidReason || '-',
        ];
      });

      const wsTrx = XLSX.utils.aoa_to_sheet([trxCols.map(c => c.header), ...trxRows]);
      wsTrx['!cols'] = [
        { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
        { wch: 8 }, { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 15 }, { wch: 14 },
        { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 25 }
      ];
      applyHeaderStyle(wsTrx, 0, trxCols);
      XLSX.utils.book_append_sheet(wb, wsTrx, 'Detail Transaksi');

      // ─── Sheet 3: Detail Item Terjual ───────────────────────────
      const itemCols = [
        { header: 'No. Transaksi', align: 'center' },
        { header: 'Tanggal', align: 'center' },
        { header: 'Waktu', align: 'center' },
        { header: 'Kasir', align: 'left' },
        { header: 'SKU / Kode', align: 'center' },
        { header: 'Nama Produk', align: 'left' },
        { header: 'Varian', align: 'left' },
        { header: 'Kategori', align: 'left' },
        { header: 'Qty Terjual', type: 'integer', align: 'center' },
        { header: 'Harga Satuan (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'HPP Satuan (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Subtotal Jual (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Diskon Proporsional (Rp)', money: true, red: true, type: 'money', align: 'right' },
        { header: 'Net Sales (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'HPP Total (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Profit Kotor (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Margin (%)', type: 'percent', align: 'right', percent: true },
        { header: 'Status', align: 'center' },
      ];

      const itemRows = [];
      transactions.forEach(t => {
        const d = parseSQLiteDate(t.created_at);
        const uid = t.userId || t.user_id;
        const kasir = users.find(u => u.id === uid)?.fullname || uid || 'Admin';
        const isVoided = t.status?.toLowerCase() === 'voided';
        
        const trxSub = t.subtotal || t.total_amount || 1;
        
        (t.items || []).forEach(item => {
          const prodId = item.productId || item.id;
          const pInfo = productMap.get(prodId) || {};
          const cat = pInfo.category || 'Lain-lain';
          const sku = pInfo.sku || pInfo.barcode || '-';
          
          const qty = item.quantity || item.qty || 1;
          const price = item.price || 0;
          const subtotalItem = price * qty;
          
          const propDiscount = isVoided ? 0 : (t.discount ? Math.round((subtotalItem / trxSub) * t.discount) : 0);
          const netSales = isVoided ? 0 : (subtotalItem - propDiscount);
          const itemHpp = item.hpp || pInfo.hpp || 0;
          const totalHppItem = isVoided ? 0 : (itemHpp * qty);
          const profitItem = isVoided ? 0 : (netSales - totalHppItem);
          const marginItem = netSales > 0 ? (profitItem / netSales) : 0;
          
          itemRows.push([
            'TRX-' + String(t.id).substring(0, 6).toUpperCase(),
            d.toLocaleDateString('id-ID'),
            d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            kasir,
            sku,
            item.name,
            item.variant || '-',
            cat,
            qty,
            price,
            itemHpp,
            isVoided ? 0 : subtotalItem,
            propDiscount,
            netSales,
            totalHppItem,
            profitItem,
            marginItem,
            t.status || 'Completed'
          ]);
        });
      });

      const wsItems = XLSX.utils.aoa_to_sheet([itemCols.map(c => c.header), ...itemRows]);
      wsItems['!cols'] = [
        { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 25 },
        { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 15 },
        { wch: 18 }, { wch: 15 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 12 }
      ];
      applyHeaderStyle(wsItems, 0, itemCols);
      XLSX.utils.book_append_sheet(wb, wsItems, 'Detail Item Terjual');

      // ─── Sheet 4: Laporan Pengeluaran ────────────────────────────
      const expCols = [
        { header: 'Tanggal & Waktu', align: 'center' },
        { header: 'Kategori', align: 'left' },
        { header: 'Keterangan', align: 'left' },
        { header: 'Kasir', align: 'left' },
        { header: 'Nominal (Rp)', money: true, type: 'money', align: 'right' },
      ];
      
      const expRows = expenses.map(ex => {
        const d = parseSQLiteDate(ex.created_at);
        return [
          `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
          ex.category || 'Operasional',
          ex.description || '-',
          ex.user_name || ex.user_id || '-',
          ex.amount || 0,
        ];
      });

      const wsExp = XLSX.utils.aoa_to_sheet([expCols.map(c => c.header), ...expRows]);
      wsExp['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 35 }, { wch: 18 }, { wch: 15 }];
      applyHeaderStyle(wsExp, 0, expCols);
      XLSX.utils.book_append_sheet(wb, wsExp, 'Laporan Pengeluaran');

      // ─── Sheet 5: Analisis Kinerja Produk ────────────────────────
      const prodCols = [
        { header: 'Peringkat', align: 'center' },
        { header: 'SKU / Kode', align: 'center' },
        { header: 'Nama Produk', align: 'left' },
        { header: 'Kategori', align: 'left' },
        { header: 'Total Terjual (Qty)', type: 'integer', align: 'center' },
        { header: 'Penjualan Bersih (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Total HPP (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Total Profit (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Margin Profit (%)', type: 'percent', align: 'right', percent: true },
      ];

      const prodAnalysis = {};
      validTransactions.forEach(t => {
        const trxSub = t.subtotal || t.total_amount || 1;
        (t.items || []).forEach(item => {
          const prodId = item.productId || item.id;
          if (!prodAnalysis[prodId]) {
            const pInfo = productMap.get(prodId) || {};
            prodAnalysis[prodId] = {
              sku: pInfo.sku || pInfo.barcode || '-',
              name: item.name,
              category: pInfo.category || 'Lain-lain',
              qty: 0,
              grossSales: 0,
              discount: 0,
              netSales: 0,
              hpp: 0,
            };
          }
          const qty = item.quantity || item.qty || 1;
          const sub = item.price * qty;
          const disc = t.discount ? (sub / trxSub) * t.discount : 0;
          const pInfo = productMap.get(prodId) || {};
          const itemHpp = item.hpp || pInfo.hpp || 0;
          
          prodAnalysis[prodId].qty += qty;
          prodAnalysis[prodId].grossSales += sub;
          prodAnalysis[prodId].discount += disc;
          prodAnalysis[prodId].netSales += (sub - disc);
          prodAnalysis[prodId].hpp += (itemHpp * qty);
        });
      });

      const sortedProds = Object.values(prodAnalysis)
        .sort((a, b) => b.netSales - a.netSales)
        .map((p, i) => {
          const profit = p.netSales - p.hpp;
          const margin = p.netSales > 0 ? (profit / p.netSales) : 0;
          return [
            `#${i + 1}`,
            p.sku,
            p.name,
            p.category,
            p.qty,
            Math.round(p.netSales),
            Math.round(p.hpp),
            Math.round(profit),
            margin
          ];
        });

      const wsProd = XLSX.utils.aoa_to_sheet([prodCols.map(c => c.header), ...sortedProds]);
      wsProd['!cols'] = [
        { wch: 10 }, { wch: 14 }, { wch: 28 }, { wch: 18 },
        { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
      ];
      applyHeaderStyle(wsProd, 0, prodCols);
      XLSX.utils.book_append_sheet(wb, wsProd, 'Kinerja Produk');

      // ─── Sheet 6: Log Shift Kasir ──────────────────────────────
      const shiftCols = [
        { header: 'Nama Kasir', align: 'left' },
        { header: 'Username', align: 'left' },
        { header: 'Waktu Mulai', align: 'center' },
        { header: 'Waktu Selesai', align: 'center' },
        { header: 'Status', align: 'center' },
        { header: 'Kas Awal (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Penjualan Tunai (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Kas Akhir Sistem (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Kas Akhir Aktual (Rp)', money: true, type: 'money', align: 'right' },
        { header: 'Selisih (Rp)', money: true, type: 'money', align: 'right' },
      ];

      const shiftRows = shiftsData.map(shift => {
        const startT = parseSQLiteDate(shift.start_time);
        const endT = shift.end_time ? parseSQLiteDate(shift.end_time) : null;
        
        // Calculate Cash Sales during this shift
        const shiftCashSales = transactions
          .filter(t => t.shift_id === shift.id && t.status?.toLowerCase() !== 'voided' && (t.payment_method?.toLowerCase() === 'tunai' || t.payment_method?.toLowerCase() === 'cash'))
          .reduce((sum, t) => sum + (t.total_amount || 0), 0);

        // Expected final cash in drawer = Start Balance + Cash Sales
        const expectedCash = shift.start_balance + shiftCashSales;
        const actualCash = shift.end_balance;
        const discrepancy = actualCash !== null ? (actualCash - expectedCash) : null;

        return [
          shift.fullname || 'Admin',
          shift.username || '-',
          startT.toLocaleString('id-ID'),
          endT ? endT.toLocaleString('id-ID') : 'Aktif',
          shift.status,
          shift.start_balance,
          shiftCashSales,
          expectedCash,
          actualCash !== null ? actualCash : '-',
          discrepancy !== null ? discrepancy : '-'
        ];
      });

      const wsShifts = XLSX.utils.aoa_to_sheet([shiftCols.map(c => c.header), ...shiftRows]);
      wsShifts['!cols'] = [
        { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 10 },
        { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 14 }
      ];
      applyHeaderStyle(wsShifts, 0, shiftCols);
      XLSX.utils.book_append_sheet(wb, wsShifts, 'Log Shift Kasir');

      // ─── Write & Download ─────────────────────────────────────
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tallyfy-laporan-analisis-${startDate}-to-${endDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Berhasil diekspor ke Excel (.xlsx) · 6 sheet lengkap', 'success');
    } catch (err) {
      console.error('[Export XLSX]', err);
      addToast('Gagal mengekspor data', 'error');
    }
  };

  // ─── Print helper ────────────────────────────────────────
  const printHtml = async (html, title = '') => {
    try {
      const { printReceipt, getSettings } = await import('../api/ipc');
      const cfg = await getSettings();
      await printReceipt({ html, printerName: cfg?.printer_name || '', paperWidth: cfg?.receipt_width || '80' });
      addToast(`${title} berhasil dicetak`, 'success');
    } catch (e) { addToast(`Gagal cetak ${title}`, 'error'); }
  };

  // ─── X-Report (ringkasan sementara) ─────────────────────
  const printXReport = () => {
    const now = new Date().toLocaleString('id-ID');
    const rows = transactions.map((t, i) => `
      <tr><td>${i+1}</td>
      <td>${new Date(t.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</td>
      <td>${t.payment_method||'Tunai'}</td>
      <td style="text-align:right">${rp(t.total_amount)}</td></tr>`).join('');
    const html = `<div style="font-family:monospace;font-size:11px;padding:8px">
      <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:8px">
        <b style="font-size:13px">X-REPORT</b><br><b>LAPORAN SEMENTARA</b><br>
        Periode: ${startDate} s/d ${endDate}<br>Dicetak: ${now}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead><tr><th>#</th><th>Waktu</th><th>Metode</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px">
        <div style="display:flex;justify-content:space-between"><span>Jumlah Transaksi:</span><b>${stats.trxCount}</b></div>
        <div style="display:flex;justify-content:space-between"><span>Total Omzet:</span><b>${rp(stats.omzet)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>Rata-rata:</span><b>${rp(stats.avg)}</b></div>
      </div>
      <div style="text-align:center;margin-top:10px;font-size:9px">*** BUKAN LAPORAN FINAL — JANGAN TUTUP MESIN ***</div>
    </div>`;
    printHtml(html, 'X-Report');
  };

  // ─── Z-Report (penutupan final) ──────────────────────────
  const printZReport = () => {
    const now = new Date().toLocaleString('id-ID');
    const byMethod = transactions.reduce((acc, t) => {
      const m = t.payment_method || 'Tunai';
      acc[m] = (acc[m] || 0) + (t.total_amount || 0);
      return acc;
    }, {});
    const methodRows = Object.entries(byMethod).map(([m, v]) =>
      `<div style="display:flex;justify-content:space-between"><span>${m}</span><b>${rp(v)}</b></div>`
    ).join('');
    const html = `<div style="font-family:monospace;font-size:11px;padding:8px">
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px">
        <b style="font-size:14px">Z-REPORT</b><br><b>LAPORAN PENUTUPAN FINAL</b><br>
        Periode: ${startDate} s/d ${endDate}<br>Dicetak: ${now}
      </div>
      <b style="font-size:10px;text-transform:uppercase">Ringkasan Penjualan</b>
      <div style="display:flex;justify-content:space-between"><span>Jumlah Transaksi:</span><b>${stats.trxCount}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Total Omzet:</span><b>${rp(stats.omzet)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Rata-rata/Transaksi:</span><b>${rp(stats.avg)}</b></div>
      <div style="border-top:1px dashed #000;margin:8px 0;padding-top:6px">
        <b style="font-size:10px;text-transform:uppercase">Breakdown Metode Bayar</b>
        ${methodRows}
      </div>
      <div style="border-top:2px solid #000;padding-top:8px;text-align:center;font-size:10px">
        Tanda Tangan Kasir &amp; Manajer<br><br><br>
        _____________ / _____________<br>
        <span style="font-size:9px">*** LAPORAN FINAL — SIMPAN UNTUK PEMBUKUAN ***</span>
      </div>
    </div>`;
    printHtml(html, 'Z-Report');
  };



  return (
    <div className="content-area active" id="area-laporan">
      <div className="laporan-header">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18px,3vw,22px)', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Laporan Penjualan</h1>
        <div style={{ color: '#666', fontSize: '11px', marginTop: '4px', marginBottom: '10px' }}>Analisis omzet, profit, dan performa produk.</div>
        <div className="date-range" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: 'var(--surface-0)', padding: '10px', borderRadius: '8px', border: 'var(--border-base)', marginTop: '4px' }}>
          <div className="date-range-inputs" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: '#555', letterSpacing: '0.5px' }}>DARI</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: 'var(--border-base)', background: '#fff', fontSize: '12px', fontFamily: 'var(--font-body)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: '#555', letterSpacing: '0.5px' }}>SAMPAI</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: 'var(--border-base)', background: '#fff', fontSize: '12px', fontFamily: 'var(--font-body)' }} />
            </div>
          </div>
          
          <div className="date-range-btns" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginLeft: 'auto' }}>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontWeight: 600 }} onClick={() => { setStartDate(getToday()); setEndDate(getToday()); }}>Hari Ini</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontWeight: 600 }} onClick={() => { setStartDate(getFirstDay()); setEndDate(getToday()); }}>Bulan Ini</button>
            <button className="btn btn-primary btn-sm" style={{ padding: '6px 12px', fontWeight: 600 }} onClick={exportExcel}>Ekspor Excel</button>
          </div>
        </div>
      </div>


      <div className="laporan-body">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-label">Total Omzet</div>
            <div className="stat-card-value green">{rp(stats.omzet)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Total Transaksi</div>
            <div className="stat-card-value blue">{stats.trxCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Rata-rata Transaksi</div>
            <div className="stat-card-value">{rp(stats.avg)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label" title="Margin Kotor - Pengeluaran">Profit Bersih</div>
            <div className="stat-card-value yellow">{rp(stats.profit)}</div>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '8px', borderBottom: '2px solid var(--black)', overflowX: 'auto', whiteSpace: 'nowrap' }} className="cat-filter">
          <button className={`btn btn-ghost ${activeTab === 'trx' ? 'active-tab' : ''}`} onClick={() => setActiveTab('trx')} style={{ flexShrink: 0, whiteSpace: 'nowrap', borderBottom: activeTab === 'trx' ? '3px solid var(--black)' : 'none', borderRadius: '0' }}>Transaksi</button>
          <button className={`btn btn-ghost ${activeTab === 'expenses' ? 'active-tab' : ''}`} onClick={() => setActiveTab('expenses')} style={{ flexShrink: 0, whiteSpace: 'nowrap', borderBottom: activeTab === 'expenses' ? '3px solid var(--black)' : 'none', borderRadius: '0' }}>Pengeluaran</button>
          <button className={`btn btn-ghost ${activeTab === 'products' ? 'active-tab' : ''}`} onClick={() => setActiveTab('products')} style={{ flexShrink: 0, whiteSpace: 'nowrap', borderBottom: activeTab === 'products' ? '3px solid var(--black)' : 'none', borderRadius: '0' }}>Produk Terlaris</button>
          {!kasirMode && (
            <button className={`btn btn-ghost ${activeTab === 'shifts' ? 'active-tab' : ''}`} onClick={() => setActiveTab('shifts')} style={{ flexShrink: 0, whiteSpace: 'nowrap', borderBottom: activeTab === 'shifts' ? '3px solid var(--black)' : 'none', borderRadius: '0' }}>Rekap Shift</button>
          )}
        </div>

        {activeTab === 'trx' && (
          <div style={{ marginTop: '24px' }}>
            <div className="dash-section-title">Detail Transaksi</div>
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
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length > 0 ? transactions.map((trx, index) => {
                    const d = parseDate(trx.created_at);
                    const isVoid = trx.status?.toLowerCase() === 'voided';
                    return (
                      <tr key={trx.id + '-' + index} style={{ opacity: isVoid ? 0.5 : 1 }}>
                        <td style={{ fontWeight: 700 }}>
                          {'TRX-' + String(trx.id).substring(0, 6).toUpperCase()}
                          {isVoid && <span style={{ marginLeft: '8px', color: 'red', fontSize: '10px', border: '1px solid red', padding: '2px 4px' }}>VOID</span>}
                        </td>
                        <td>{d.toLocaleDateString('id-ID')}</td>
                        <td>{d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{(() => { const uid = trx.userId || trx.user_id; const u = users.find(u => u.id === uid); return u?.fullname || u?.username || (uid?.length > 15 ? 'Admin (Pemilik)' : uid) || 'Admin'; })()}</td>
                        <td className="num">{rp(trx.subtotal || trx.total_amount)}</td>
                        <td className="num" style={{ color: 'var(--accent-red)' }}>
                          - {rp(trx.discount || 0)}
                        </td>
                        <td className="num" style={{ fontWeight: 700 }}>{rp(trx.total_amount)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {!isVoid && (
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => setVoidModal({ isOpen: true, trxId: trx.id, reason: '' })}
                            >
                              Hapus / Void Transaksi
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#aaa' }}>
                        {isLoading ? 'Memuat data...' : 'Belum ada transaksi di rentang tanggal ini'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div className="dash-section-title" style={{ margin: 0 }}>Daftar Pengeluaran</div>
              <button 
                onClick={() => setExpenseModal({ isOpen: true, desc: '', amount: '' })}
                className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                + Tambah Pengeluaran
              </button>
            </div>
            
            <div className="recent-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Keterangan</th>
                    <th>Kategori</th>
                    <th>Kasir</th>
                    <th style={{ textAlign: 'right' }}>Nominal</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length > 0 ? expenses.map((exp, index) => {
                    const d = parseDate(exp.created_at);
                    return (
                      <tr key={exp.id + '-' + index}>
                        <td>{d.toLocaleDateString('id-ID')} {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{exp.description}</td>
                        <td>{exp.category}</td>
                        <td>{exp.user_name || exp.user_id}</td>
                        <td className="num" style={{ fontWeight: 700, color: 'var(--accent-red)' }}>- {rp(exp.amount)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirmModal({ isOpen: true, expenseId: exp.id })}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#aaa' }}>
                        Belum ada pengeluaran di rentang tanggal ini
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div style={{ marginTop: '24px' }}>
            <div className="dash-section-title">Produk Terlaris</div>

            {/* Visualisasi Top 5 Produk */}
            {productSales.length > 0 && (
              <div style={{ background: '#fff', border: 'var(--border-base)', padding: '16px 20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px', color: '#555' }}>Top 5 Produk Terjual</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {productSales.slice(0, 5).map((p, i) => {
                    const maxSold = Math.max(...productSales.slice(0, 5).map(x => x.total_sold), 1);
                    const pct = Math.max(5, Math.round((p.total_sold / maxSold) * 100));
                    return (
                      <div key={p.id + '-' + i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '20px', fontSize: '12px', fontWeight: 700, color: '#888' }}>#{i + 1}</div>
                        <div style={{ width: '120px', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>{p.name}</div>
                        <div style={{ flex: 1, background: 'var(--surface-2)', height: '24px', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: i === 0 ? '#FFD600' : '#111', display: 'flex', alignItems: 'center', paddingLeft: '8px', fontSize: '10px', fontWeight: 700, color: i === 0 ? '#111' : '#fff', transition: 'width 0.5s ease' }}>
                            {p.total_sold} item
                          </div>
                        </div>
                        <div style={{ width: '90px', textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>
                          {rp(p.total_revenue)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="recent-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Peringkat</th>
                    <th>Nama Produk</th>
                    <th style={{ textAlign: 'center' }}>Total Terjual</th>
                    <th style={{ textAlign: 'right' }}>Pendapatan Kasar</th>
                  </tr>
                </thead>
                <tbody>
                  {productSales.length > 0 ? productSales.map((p, index) => (
                    <tr key={p.id + '-' + index}>
                      <td style={{ fontWeight: 700 }}>#{index + 1}</td>
                      <td><strong>{p.name}</strong></td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-info">{p.total_sold} item</span>
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>{rp(p.total_revenue)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '32px', color: '#aaa' }}>
                        {isLoading ? 'Memuat data...' : 'Belum ada data penjualan produk'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'shifts' && (
          <div style={{ marginTop: '24px' }}>
            <div className="dash-section-title">Rekap Shift Kasir</div>
            <div className="recent-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nama Kasir</th>
                    <th>Username</th>
                    <th>Mulai</th>
                    <th>Selesai</th>
                    <th style={{ textAlign: 'right' }}>Kas Awal</th>
                    <th style={{ textAlign: 'right' }}>Kas Akhir</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftsData.length > 0 ? shiftsData.map((shift, index) => {
                    const startT = parseDate(shift.start_time);
                    const endT = shift.end_time ? parseDate(shift.end_time) : null;
                    return (
                      <tr key={shift.id + '-' + index}>
                        <td style={{ fontWeight: 700 }}>{shift.fullname || 'Admin'}</td>
                        <td>{shift.username || '-'}</td>
                        <td>{formatDateTimeAMPM(startT)}</td>
                        <td>{endT ? endT.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="num">{rp(shift.start_balance)}</td>
                        <td className="num">{shift.end_balance !== null ? rp(shift.end_balance) : '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${shift.status === 'Aktif' ? 'badge-info' : 'badge-aktif'}`}>
                            {shift.status}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#aaa' }}>
                        {isLoading ? 'Memuat data...' : 'Belum ada data shift'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {/* --- MODALS --- */}

      {/* Void/Delete Modal */}
      <ConfirmModal
        isOpen={voidModal.isOpen}
        title="Hapus / Void Transaksi"
        message={
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 600 }}>Alasan Penghapusan:</div>
            <input 
              type="text" 
              autoFocus
              value={voidModal.reason}
              onChange={e => setVoidModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Contoh: Salah input pesanan..."
              style={{ width: '100%', padding: '10px', border: '2px solid #222', background: '#fff', outline: 'none' }}
            />
            <p style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>* Stok produk akan dikembalikan dan transaksi akan dibatalkan (void).</p>
          </div>
        }
        confirmLabel="Konfirmasi Hapus"
        onConfirm={async () => {
          if (!voidModal.reason) { addToast("Alasan wajib diisi", 'warning'); return; }
          try {
            const { voidTransaction } = await import('../api/ipc');
            const currentUserId = currentUser?.id || 1; // Fallback ke 1
            await voidTransaction(voidModal.trxId, currentUserId, voidModal.reason);
            addToast("Transaksi berhasil di-void", 'success');
            setVoidModal({ isOpen: false, trxId: null, reason: '' });
            loadReport();
          } catch (e) { addToast("Gagal membatalkan transaksi", 'error'); }
        }}
        onCancel={() => setVoidModal({ isOpen: false, trxId: null, reason: '' })}
      />

      {/* Expense Modal (Not a deletion confirmation, keeping custom HTML for Add Expense) */}
      {expenseModal.isOpen && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3>Tambah Pengeluaran</h3>
            </div>
            <div className="modal-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>KETERANGAN PENGELUARAN</label>
                <input 
                  type="text" 
                  autoFocus
                  value={expenseModal.desc}
                  onChange={e => setExpenseModal(prev => ({ ...prev, desc: e.target.value }))}
                  placeholder="Keterangan pengeluaran..."
                />
              </div>
              <div className="form-group">
                <label>NOMINAL (Rp)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '10px', fontWeight: 'bold' }}>Rp</span>
                  <input 
                    type="text" 
                    value={expenseModal.amount}
                    onChange={e => setExpenseModal(prev => ({ ...prev, amount: e.target.value.replace(/\D/g, '') }))}
                    placeholder="5.000"
                    style={{ paddingLeft: '40px', width: '100%' }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setExpenseModal({ isOpen: false, desc: '', amount: '' })}>Batal</button>
              <button 
                className="btn btn-primary" 
                onClick={async () => {
                  if (!expenseModal.desc || !expenseModal.amount) { addToast('Semua field wajib diisi', 'warning'); return; }
                  try {
                    const { createExpense } = await import('../api/ipc');
                    await createExpense(parseInt(expenseModal.amount), expenseModal.desc, 'Operasional', currentUser?.id || '1');
                    addToast('Pengeluaran ditambahkan', 'success');
                    setExpenseModal({ isOpen: false, desc: '', amount: '' });
                    loadReport();
                  } catch (e) { addToast('Gagal menambahkan pengeluaran', 'error'); }
                }}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Expense Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Hapus Pengeluaran?"
        message="Apakah Anda yakin ingin menghapus catatan pengeluaran ini?"
        confirmLabel="Ya, Hapus Pengeluaran"
        onConfirm={async () => {
          try {
            const { deleteExpense } = await import('../api/ipc');
            await deleteExpense(confirmModal.expenseId, 1);
            addToast('Berhasil dihapus', 'success');
            setConfirmModal({ isOpen: false, expenseId: null });
            loadReport();
          } catch (e) { addToast('Gagal menghapus pengeluaran', 'error'); }
        }}
        onCancel={() => setConfirmModal({ isOpen: false, expenseId: null })}
      />

    </div>
  );
}