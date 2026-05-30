import React, { createContext, useState, useCallback, useEffect, useRef } from 'react';

export const ToastContext = createContext({});

let toastCounter = 0;

export function ToastProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [currentToast, setCurrentToast] = useState(null);
  const isAnimating = useRef(false);

  const addToast = useCallback((message, type = 'info') => {
    toastCounter++;
    setQueue(prev => [...prev, { id: toastCounter, message, type, isRemoving: false }]);
  }, []);

  useEffect(() => {
    if (!currentToast && queue.length > 0 && !isAnimating.current) {
      const nextToast = queue[0];
      setCurrentToast(nextToast);
      setQueue(prev => prev.slice(1));
      isAnimating.current = true;

      // Tampilkan selama 3 detik
      setTimeout(() => {
        setCurrentToast(prev => prev ? { ...prev, isRemoving: true } : null);
        
        // Hapus dari DOM setelah animasi slide-out selesai (150ms)
        setTimeout(() => {
          setCurrentToast(null);
          isAnimating.current = false;
        }, 150);
      }, 3000);
    }
  }, [queue, currentToast]);

  const icons = {
    success: '✓',
    error: '✗',
    info: 'i',
    warning: '!'
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast Container - Hanya menampilkan 1 toast secara bergantian */}
      <div className="toast-container" id="toast-container">
        {currentToast && (
          <div 
            key={currentToast.id}
            className={`toast toast-${currentToast.type} ${currentToast.isRemoving ? 'removing' : ''}`}
          >
            <div className="toast-icon">{icons[currentToast.type] || 'i'}</div>
            <span>{currentToast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
