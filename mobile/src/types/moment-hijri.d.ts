declare module 'moment-hijri' {
  import moment from 'moment';

  interface MomentHijri extends moment.Moment {
    iMonth(): number;
    iDate(): number;
    iYear(): number;
    clone(): MomentHijri;
  }

  function momentHijri(date?: string | Date | moment.Moment, format?: string): MomentHijri;

  export = momentHijri;
}
