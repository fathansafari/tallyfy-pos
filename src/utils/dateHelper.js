export const getLocalISODate = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

export const getFirstDayOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  return getLocalISODate(date);
};

export const parseSQLiteDate = (dateStr) => {
  if (!dateStr) return new Date();
  return new Date(dateStr);
};

export const formatDateTimeAMPM = (dateObj) => {
  if (!dateObj) return '';
  return `${dateObj.toLocaleDateString('id-ID')} ${dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
};

export const formatAMPM = (timeStr) => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${mStr} ${ampm}`;
};
