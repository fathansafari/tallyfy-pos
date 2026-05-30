import React, { useState } from 'react';
import Button from './Button';
import Input from './Input';

export default function PaymentModal({ 
  isOpen, 
  total, 
  onConfirm, 
  onCancel 
}) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');

  const formatPrice = (price) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const change = amountPaid ? parseInt(amountPaid) - total : 0;
  const isValidPayment = amountPaid && parseInt(amountPaid) >= total;

  const handleConfirm = () => {
    if (isValidPayment) {
      onConfirm({
        paymentMethod,
        amountPaid: parseInt(amountPaid),
        change,
        notes,
        timestamp: new Date().toISOString()
      });
      setAmountPaid('');
      setNotes('');
      setPaymentMethod('cash');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onCancel}></div>
      <div className="modal-content" style={{ minWidth: '500px' }}>
        <div className="modal-header">Konfirmasi Pembayaran</div>
        
        <div className="modal-body" style={{ fontSize: '14px' }}>
          {/* Total Amount */}
          <div style={{
            backgroundColor: '#F5F2EA',
            border: '2px solid #0A0A0A',
            padding: '16px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            <div style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '12px',
              fontWeight: 600,
              color: '#CFCCC2',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Total Pembayaran
            </div>
            <div style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '32px',
              fontWeight: 700,
              color: '#2DC653'
            }}>
              {formatPrice(total)}
            </div>
          </div>

          {/* Payment Method */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: '8px',
              color: '#0A0A0A'
            }}>
              Metode Pembayaran
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['cash', 'debit', 'transfer'].map((method) => (
                <label key={method} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={paymentMethod === method}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ textTransform: 'capitalize', fontWeight: paymentMethod === method ? 700 : 400 }}>
                    {method === 'cash' ? 'Tunai' : method === 'debit' ? 'Debit/Kartu' : 'Transfer'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Amount Paid */}
          <Input
            label="Nominal Pembayaran"
            type="number"
            placeholder="Masukkan jumlah yang dibayarkan"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            style={{ marginBottom: '16px' }}
          />

          {/* Change Amount */}
          {amountPaid && (
            <div style={{
              backgroundColor: amountPaid >= total ? '#2DC653' : '#E63946',
              color: '#FFFFFF',
              padding: '12px',
              borderLeft: '4px solid #0A0A0A',
              marginBottom: '16px',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '14px',
              fontWeight: 600
            }}>
              <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>KEMBALIAN</div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>
                {formatPrice(change > 0 ? change : 0)}
              </div>
            </div>
          )}

          {/* Notes */}
          <Input
            label="Catatan (Opsional)"
            placeholder="Tambahkan catatan untuk transaksi..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onCancel}>
            Batal
          </Button>
          <Button 
            variant="primary" 
            disabled={!isValidPayment}
            onClick={handleConfirm}
          >
            Selesaikan Pembayaran
          </Button>
        </div>
      </div>
    </>
  );
}
