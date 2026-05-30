/**
 * src/utils/bluetoothPrinter.js
 * 
 * Modul cetak bluetooth via Web Bluetooth API (berjalan langsung di browser Android Chrome / Desktop).
 * Mendukung printer thermal standar ESC/POS (58mm/80mm).
 */

// Karakteristik Bluetooth umum untuk modul serial di Printer Thermal
const PRINTER_UUIDS = {
  services: [
    '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard Serial Port Service (kebanyakan printer)
    '000018f0-0000-1000-8000-00805f9b34fb', // Portable printer service
    '49535343-fe7d-41aa-83b2-3d594b6d5196', // ISSC BLE Service
    '0000ffe5-0000-1000-8000-00805f9b34fb'  // Alternatif lain
  ],
  characteristics: [
    '0000ffe1-0000-1000-8000-00805f9b34fb', // FFE1 (paling umum)
    '00002af1-0000-1000-8000-00805f9b34fb',
    '49535343-1e4d-4bd9-ba61-23c647249616',
    '0000ffe6-0000-1000-8000-00805f9b34fb'
  ]
};

// Global cache printer koneksi aktif agar tidak perlu pairing ulang setiap cetak
let activeDevice = null;
let activeCharacteristic = null;

/**
 * Melakukan scan dan mengembalikan koneksi printer bluetooth
 */
export async function connectBluetoothPrinter() {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth tidak didukung di browser ini. Gunakan Google Chrome di Android atau Desktop!');
  }

  // Jika sudah terhubung, test koneksi (bisa dilompati atau gunakan yang ada)
  if (activeDevice && activeDevice.gatt.connected && activeCharacteristic) {
    return { device: activeDevice, characteristic: activeCharacteristic };
  }

  try {
    console.log('Memulai pencarian printer bluetooth...');
    
    // Scan all devices if possible or specific to raw serial profiles
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_UUIDS.services
    });

    console.log('Menghubungkan ke device:', device.name);
    const server = await device.gatt.connect();

    // Loop services untuk mencari kecocokan printer
    let characteristic = null;
    for (const serviceId of PRINTER_UUIDS.services) {
      try {
        const service = await server.getPrimaryService(serviceId);
        console.log('Mendapatkan Service:', serviceId);
        
        for (const charId of PRINTER_UUIDS.characteristics) {
          try {
            characteristic = await service.getCharacteristic(charId);
            console.log('Mendapatkan Karaktristik Cocok:', charId);
            break;
          } catch (e) {
            // Lanjutkan mencari characteristic lain
          }
        }
        if (characteristic) break;
      } catch (e) {
        // Lanjutkan ke service UUID berikutnya
      }
    }

    // Jika service spesifik tidak terdeteksi, coba ambil service primer pertama & cari write characteristic
    if (!characteristic) {
      try {
        console.log('Mencari service primer secara dinamis...');
        const services = await server.getPrimaryServices();
        for (const s of services) {
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              characteristic = c;
              console.log('Karakteristik write dinamis ditemukan:', c.uuid);
              break;
            }
          }
          if (characteristic) break;
        }
      } catch (err) {
        console.warn('Gagal mencari service dinamis:', err);
      }
    }

    if (!characteristic) {
      throw new Error('Printer terhubung tapi tidak ditemukan jalur/karakteristik untuk mencetak data!');
    }

    activeDevice = device;
    activeCharacteristic = characteristic;

    // Tambahkan listener untuk disconnect
    device.addEventListener('gattserverdisconnected', () => {
      console.log('Printer terputus');
      activeDevice = null;
      activeCharacteristic = null;
    });

    return { device, characteristic };
  } catch (error) {
    console.error('Koneksi bluetooth failed:', error);
    throw error;
  }
}

/**
 * Mengirim teks struk (text) ke printer Bluetooth dengan perintah ESC/POS dasar
 */
export async function printTextViaBluetooth(textLine, paperWidth = '58') {
  try {
    const { characteristic } = await connectBluetoothPrinter();

    // Buat encoder dengan UTF-8 ke Uint8Array
    const encoder = new TextEncoder();
    
    // Perintah ESC/POS dasar:
    // 1. Initialize printer: ESC @ [0x1B, 0x40]
    // 2. Set font size normal: GS ! 0 [0x1D, 0x21, 0x00]
    const initCmd = new Uint8Array([0x1B, 0x40, 0x1D, 0x21, 0x00]);
    await writeInChunks(characteristic, initCmd);

    // Normalize dan konversi text. Karena Bluetooth printer umumnya menggunakan codepage DOS 437 / ISO-8859-1,
    // kita bersihkan karakter emoji/unik agar tidak merusak printer termal.
    let cleanText = textLine
      .replace(/🍽/g, '[POS]')
      .replace(/✓/g, '[OK]')
      .replace(/★/g, '*')
      .replace(/🍳/g, '[KITCHEN]')
      .replace(/📝/g, '[NOTE]')
      .replace(/📋/g, '[COPY]')
      .replace(/🖨️/g, '[PRINTER]');

    const textCmd = encoder.encode(cleanText + '\n\n\n\n'); // Tambah margin bawah (4 lines) agar mudah disobek
    await writeInChunks(characteristic, textCmd);

    // Perintah potong kertas jika ada: GS V 66 0 [0x1D, 0x56, 0x42, 0x00]
    const cutCmd = new Uint8Array([0x1D, 0x56, 0x42, 0x00]);
    try {
      await writeInChunks(characteristic, cutCmd);
    } catch (e) {
      console.log('Printer tidak support autocut, skip.');
    }

    return true;
  } catch (err) {
    console.error('Gagal cetak lewat bluetooth:', err);
    throw err;
  }
}

/**
 * Menulis data biner ke BLE Characteristic dalam chunk ukuran MTU (biasanya 20 bytes)
 * dengan delay beberapa milidetik agar printer tidak buffer-overflow atau ngadat.
 */
async function writeInChunks(characteristic, dataArray, chunkSize = 20) {
  for (let i = 0; i < dataArray.length; i += chunkSize) {
    const chunk = dataArray.slice(i, i + chunkSize);
    try {
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
    } catch (err) {
      // Retry sekali jika error transien
      await new Promise(r => setTimeout(r, 50));
      await characteristic.writeValue(chunk);
    }
    // Istirahatkan sejenak agar printer memproses data (delay 15-20ms sangat efektif mencegah teks terputus)
    await new Promise(r => setTimeout(r, 20));
  }
}

/**
 * Memutus koneksi printer aktif
 */
export async function disconnectBluetoothPrinter() {
  if (activeDevice && activeDevice.gatt.connected) {
    activeDevice.gatt.disconnect();
  }
  activeDevice = null;
  activeCharacteristic = null;
}
