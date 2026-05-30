<div align="center">
  <img width="auto" height="auto" style="object-fit: cover;" alt="Tallyfy POS Banner" src="src/tallyfy/Tallyfy POS - Google Chrome 30_05_2026 23_18_25.png" />
</div>

<h1 align="center">Tallyfy POS</h1>

<p align="center">
  <b>Sistem <i>Point of Sale</i> (POS) Cerdas Generasi Berikutnya.</b><br>
  Dibangun dengan arsitektur modern untuk skala bisnis tanpa batas, performa <i>real-time</i>, dan dukungan asisten AI terintegrasi.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Firebase-v12-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Powered%20by-Groq%20Llama%203-f55036?logo=groq&logoColor=white" alt="Groq AI" />
  <img src="https://img.shields.io/badge/Styling-TailwindCSS%20v4-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind" />
</p>

---

## 📑 Daftar Isi
- [🚀 Gambaran Umum](#-gambaran-umum)
- [✨ Fitur Utama](#-fitur-utama)
- [⚙️ Tech Stack & Arsitektur](#️-tech-stack--arsitektur)
- [💻 Panduan Instalasi](#-panduan-instalasi)
- [🤖 Konfigurasi AI (Groq)](#-konfigurasi-ai-groq)
- [📄 Lisensi](#-lisensi)

---

## 🚀 Gambaran Umum

**Tallyfy POS** adalah solusi kasir pintar yang dirancang untuk memodernisasi cara bisnis beroperasi. Berbeda dengan sistem kasir tradisional, Tallyfy POS tidak hanya sekadar mencatat penjualan; ia bertindak sebagai pusat komando operasional. Dengan memanfaatkan kecepatan *real-time database* dan kecerdasan analisis dari **LLM (Llama 3)**, Anda dapat mengambil keputusan bisnis yang akurat dalam hitungan detik.

## ✨ Fitur Utama

### 🛒 1. Manajemen Transaksi Kasir (*Core POS*)
- **Proses Checkout Instan:** Antarmuka responsif (UI/UX) yang difokuskan pada kecepatan input produk, meminimalkan waktu tunggu pelanggan.
- **Dukungan Keranjang Dinamis:** Perhitungan total belanja otomatis, pajak, diskon, dan kembalian yang akurat.

### 📦 2. Manajemen Inventaris *Real-Time* (Firebase)
- **Sinkronisasi Multi-Perangkat:** Perubahan stok produk akan langsung diperbarui di semua perangkat tanpa perlu me-*refresh* halaman.
- **Katalog Produk Cerdas:** Kemudahan mengelompokkan barang berdasarkan kategori dan *tag*.

### 🤖 3. AIBos Asisten Cerdas (Powered by Groq)
- **Analitik Bisnis Konversasional:** Tanyakan langsung kepada AI mengenai tren penjualan, produk paling laku, atau strategi harga menggunakan bahasa manusia sehari-hari.
- **Performa Ultra-Cepat:** Menghasilkan jawaban super presisi secara instan memanfaatkan API Groq (*Hardware AI* tercepat di dunia) dengan model komputasi canggih **Llama 3.3 70B**.

### 📊 4. Pelaporan & Ekspor Data
- **Ekspor Otomatis ke Excel:** Konversi data mentah transaksi menjadi file `.xlsx` yang terstruktur rapi untuk keperluan audit atau pelaporan internal.
- **Visualisasi Tren:** Ringkasan pendapatan dan performa barang secara visual.

### 🔒 5. Keamanan Tingkat Lanjut
- **Enkripsi Kredensial:** Otentikasi berlapis dengan `bcryptjs` untuk mengamankan data pengguna dan staf.
- **Manajemen Sesi:** Sesi login yang dikelola dengan aman oleh integrasi Firebase Auth.

---

## ⚙️ Tech Stack & Arsitektur

Kami memilih teknologi *cutting-edge* untuk memastikan stabilitas dan *Developer Experience* (DX) terbaik:

| Kategori | Teknologi Utama |
| :--- | :--- |
| **Frontend** | React 19, Tailwind CSS v4, Framer Motion, Lucide React |
| **Backend** | Node.js, Express.js |
| **Database & Auth** | Firebase (Firestore Real-time DB, Firebase Auth) |
| **Kecerdasan Buatan** | Groq SDK (Model: *llama-3.3-70b-versatile*) |
| **Build & Tooling** | Vite, tsx, esbuild, dotenv |

---

## 💻 Panduan Instalasi

Ikuti langkah-langkah di bawah ini untuk menjalankan aplikasi di lingkungan pengembangan lokal (*development environment*).

### Prasyarat:
- [Node.js](https://nodejs.org/en/) (Versi LTS terbaru sangat direkomendasikan)
- Git

### Langkah Instalasi:

1. **Clone Repositori:**
   ```bash
   git clone <url-repository-anda>
   cd tallyfy
   ```

2. **Instal Dependensi:**
   ```bash
   npm install
   ```

3. **Jalankan Aplikasi:**
   ```bash
   npm run dev
   ```
   > **Catatan:** Secara bawaan, *Backend Server* akan berjalan dan mengikat `0.0.0.0:3000`. Ini memungkinkan Anda mengakses aplikasi dari `http://localhost:3000` atau melalui jaringan WiFi lokal (mis. `http://192.168.1.5:3000`).

---

## 🤖 Konfigurasi AI (Groq)

Untuk mengaktifkan fitur Asisten Cerdas (*AIBos*), Anda membutuhkan API Key dari Groq Console.

1. Buka [Groq Console](https://console.groq.com/keys) dan buat API Key baru.
2. Buat file bernama `.env` di folder utama aplikasi (*root directory*).
3. Isi dengan kredensial berikut:

```env
GROQ_API_KEY="gsk_xxxxxxxxxxxxxxxxxxxxxx"
# (Opsional: Tambahkan kredensial Firebase lainnya di sini jika diperlukan)
```
*Tallyfy POS menggunakan Groq API agar analisis AI Anda berjalan jauh lebih responsif dibanding menggunakan provider konvensional.*

---

## 📄 Lisensi

Proyek Tallyfy POS ini dibuat dan dikelola secara privat. Seluruh kode dan aset dilindungi. Hak cipta © 2026 Tallyfy POS.
