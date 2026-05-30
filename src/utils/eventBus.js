const listeners = new Set();
export const emitSale = () => {
  listeners.forEach((listener) => listener());
  // Juga mengirim event custom agar page yang listen data:refresh (seperti History) bisa auto-update
  window.dispatchEvent(new CustomEvent('data:refresh'));
};
export const subscribeSaleToggle = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

