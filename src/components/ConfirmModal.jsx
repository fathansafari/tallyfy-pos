import React from 'react';

/**
 * Custom styled confirmation modal — pengganti window.confirm() bawaan browser
 */
export default function ConfirmModal({ isOpen, title, message, confirmLabel = 'Ya, Hapus', cancelLabel = 'Batal', onConfirm, onCancel, danger = true }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--surface-0)', border: 'var(--border-base)',
        boxShadow: '8px 8px 0 #0A0A0A', padding: '0', width: '380px',
        fontFamily: 'var(--font-body)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', background: danger ? 'var(--accent-red)' : 'var(--black)',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>{title || 'Konfirmasi'}</span>
        </div>
        {/* Body */}
        <div style={{ padding: '20px', fontSize: '13px', lineHeight: '1.6', color: '#333' }}>
          {message}
        </div>
        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: 'var(--border-thin)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px', border: 'var(--border-base)', background: 'var(--surface-0)',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 20px', border: 'var(--border-base)',
              background: danger ? 'var(--accent-red)' : 'var(--black)',
              color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700,
              fontSize: '12px', cursor: 'pointer', boxShadow: '3px 3px 0 #0A0A0A',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
