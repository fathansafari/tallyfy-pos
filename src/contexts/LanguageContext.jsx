import React, { createContext, useState, useEffect, useContext } from 'react';

const enDictionary = {
  // Main Layout & Sidebar
  "Menu Utama": "Main Menu",
  "Dashboard": "Dashboard",
  "Kasir / POS": "Cashier / POS",
  "Manajemen Produk": "Product Management",
  "Laporan": "Reports",
  "Riwayat Sistem": "System History",
  "Sistem": "System",
  "Manajemen Staf": "Staff Management",
  "Pengaturan Shift": "Shift Settings",
  "Pengaturan & Backup": "Settings & Backup",
  "REFRESH APP": "REFRESH APP",
  "KELUAR": "LOGOUT",
  "TUTUP SHIFT & KELUAR": "END SHIFT & LOGOUT",
  "Laci:": "Drawer:",

  // Dashboard
  "Ringkasan Hari Ini": "Today's Summary",
  "Penjualan": "Sales",
  "Transaksi": "Transactions",
  "Keuntungan (Kotor)": "Gross Profit",
  "Produk Terjual": "Products Sold",
  "Transaksi Terbaru": "Recent Transactions",
  "Belum ada transaksi hari ini.": "No transactions today.",
  "No. Transaksi": "Transaction No.",
  "Waktu": "Time",
  "Kasir": "Cashier",
  "Total": "Total",
  "Status": "Status",

  // Settings
  "PENGATURAN TOKO": "STORE SETTINGS",
  "BAHASA (LANGUAGE)": "LANGUAGE",
  "Pilih Bahasa": "Select Language",
  "Nama Toko": "Store Name",
  "Alamat": "Address",
  "Slogan / Tagline": "Slogan / Tagline",
  "Nama Pemilik": "Owner Name",
  "Simpan Pengaturan": "Save Settings",

  // POS
  "Semua Kategori": "All Categories",
  "Cari produk...": "Search products...",
  "Item Kosong": "Empty Item",
  "Order": "Order",
  "Subtotal": "Subtotal",
  "Pajak": "Tax",
  "Total Pembayaran": "Total Payment",
  "Bayar": "Pay",
  "Tunai": "Cash",

  // Buttons & General
  "Simpan": "Save",
  "Batal": "Cancel",
  "Hapus": "Delete",
  "Edit": "Edit",
  "Tambah": "Add",
  "Tutup": "Close",
  "Sukses": "Success",
  "Gagal": "Failed",
  
  // Settings kasir
  "Profil Kasir": "Cashier Profile",
  "Nama Lengkap": "Full Name"
};

export const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('app_lang') || 'id';
  });

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
  }, [lang]);

  const t = (key) => {
    if (lang === 'en') {
      return enDictionary[key] || key;
    }
    return key; // Default is ID
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
