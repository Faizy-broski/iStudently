import Storage from 'expo-sqlite/kv-store';
import momentHijri from 'moment-hijri';

// Umm al-Qura dates via moment-hijri, same as the web's CalendarGrid. The admin's global offset
// (days added to every Hijri date) is kept on this device, like the web keeps it per browser.

export const HIJRI_MONTHS_EN = ["Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah'];
export const HIJRI_MONTHS_AR = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الثانية', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];

export const hijriMonthNames = (locale: string) => (locale === 'ar' ? HIJRI_MONTHS_AR : HIJRI_MONTHS_EN);

const OFFSET_KEY = 'studently_global_hijri_offset';

export function getHijriOffset() {
  try {
    return parseInt(Storage.getItemSync(OFFSET_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function setHijriOffset(days: number) {
  try {
    Storage.setItemSync(OFFSET_KEY, String(days));
  } catch {
    // storage unavailable
  }
}

/** Hijri { year, month (0-11), day } of a Gregorian date, with the offset applied. */
export function toHijri(date: Date, offset = 0) {
  const h = momentHijri(date);
  if (offset) h.add(offset, 'days');
  return { year: h.iYear(), month: h.iMonth(), day: h.iDate() };
}

/** Gregorian date of a Hijri day (month 0-11), before any offset. */
export function fromHijri(year: number, month: number, day: number) {
  return momentHijri(`${year}-${month + 1}-${day}`, 'iYYYY-iM-iD').toDate();
}
