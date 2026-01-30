declare module 'moment-hijri' {
  import moment from 'moment';
  
  interface MomentHijri extends moment.Moment {
    format(format: string): string;
    iMonth(): number;
    iDate(): number;
    iYear(): number;
    startOf(unit: moment.unitOfTime.StartOf | 'iMonth' | 'iYear' | 'iDate'): MomentHijri;
    endOf(unit: moment.unitOfTime.StartOf | 'iMonth' | 'iYear' | 'iDate'): MomentHijri;
    clone(): MomentHijri;
  }

  function momentHijri(date?: string | Date | moment.Moment): MomentHijri;
  
  namespace momentHijri {
    function locale(locale: string): void;
  }

  export = momentHijri;
}
