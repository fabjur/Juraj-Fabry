import Chart from 'chart.js/auto';

// Ensure standard date formats are handled natively without external dependencies
const FORMATS = {
  datetime: 'dd.MM.yyyy HH:mm:ss',
  millisecond: 'HH:mm:ss.SSS',
  second: 'HH:mm:ss',
  minute: 'HH:mm',
  hour: 'HH:mm',
  day: 'dd.MM',
  week: 'dd.MM',
  month: 'MM.yyyy',
  quarter: 'QQ yyyy',
  year: 'yyyy'
};

const pad2 = (n: number) => n.toString().padStart(2, '0');

if ((Chart as any)._adapters && (Chart as any)._adapters._date) {
  (Chart as any)._adapters._date.override({
    formats: () => FORMATS,
    parse: (value: any) => {
      if (value === null || typeof value === 'undefined') return null;
      if (value instanceof Date) return isNaN(value.getTime()) ? null : value.getTime();
      if (typeof value === 'number') return isNaN(value) ? null : value;
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.getTime();
    },
    format: (time: any, format: string) => {
      const d = new Date(time);
      if (isNaN(d.getTime())) return '';
      if (format === 'dd.MM.yyyy') return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
      if (format === 'dd.MM' || format === 'day' || format === 'week') return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
      if (format === 'MM.yyyy' || format === 'month') return `${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
      if (format === 'MMM yyyy') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getFullYear()}`;
      }
      return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    },
    add: (time: any, amount: number, unit: string) => {
      const d = new Date(time);
      switch (unit) {
        case 'millisecond': d.setMilliseconds(d.getMilliseconds() + amount); break;
        case 'second': d.setSeconds(d.getSeconds() + amount); break;
        case 'minute': d.setMinutes(d.getMinutes() + amount); break;
        case 'hour': d.setHours(d.getHours() + amount); break;
        case 'day': d.setDate(d.getDate() + amount); break;
        case 'week': d.setDate(d.getDate() + amount * 7); break;
        case 'month': d.setMonth(d.getMonth() + amount); break;
        case 'quarter': d.setMonth(d.getMonth() + amount * 3); break;
        case 'year': d.setFullYear(d.getFullYear() + amount); break;
      }
      return d.getTime();
    },
    diff: (max: any, min: any, unit: string) => {
      const diffMs = max - min;
      switch (unit) {
        case 'millisecond': return diffMs;
        case 'second': return diffMs / 1000;
        case 'minute': return diffMs / 60000;
        case 'hour': return diffMs / 3600000;
        case 'day': return diffMs / 86400000;
        case 'week': return diffMs / 604800000;
        case 'month': {
          const d1 = new Date(max);
          const d2 = new Date(min);
          return (d1.getFullYear() - d2.getFullYear()) * 12 + (d1.getMonth() - d2.getMonth());
        }
        case 'quarter': {
          const d1 = new Date(max);
          const d2 = new Date(min);
          return ((d1.getFullYear() - d2.getFullYear()) * 12 + (d1.getMonth() - d2.getMonth())) / 3;
        }
        case 'year': return (new Date(max).getFullYear() - new Date(min).getFullYear());
        default: return diffMs;
      }
    },
    startOf: (time: any, unit: string) => {
      const d = new Date(time);
      switch (unit) {
        case 'second': d.setMilliseconds(0); break;
        case 'minute': d.setSeconds(0, 0); break;
        case 'hour': d.setMinutes(0, 0, 0); break;
        case 'day': d.setHours(0, 0, 0, 0); break;
        case 'week': {
          d.setHours(0, 0, 0, 0);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          d.setDate(diff);
          break;
        }
        case 'month': d.setDate(1); d.setHours(0, 0, 0, 0); break;
        case 'quarter': {
          const qMonth = Math.floor(d.getMonth() / 3) * 3;
          d.setMonth(qMonth, 1);
          d.setHours(0, 0, 0, 0);
          break;
        }
        case 'year': d.setMonth(0, 1); d.setHours(0, 0, 0, 0); break;
      }
      return d.getTime();
    },
    endOf: (time: any, unit: string) => {
      const d = new Date(time);
      switch (unit) {
        case 'second': d.setMilliseconds(999); break;
        case 'minute': d.setSeconds(59, 999); break;
        case 'hour': d.setMinutes(59, 59, 999); break;
        case 'day': d.setHours(23, 59, 59, 999); break;
        case 'week': {
          d.setHours(23, 59, 59, 999);
          const day = d.getDay();
          const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
          d.setDate(diff);
          break;
        }
        case 'month': {
          d.setMonth(d.getMonth() + 1, 0);
          d.setHours(23, 59, 59, 999);
          break;
        }
        case 'quarter': {
          const qMonth = Math.floor(d.getMonth() / 3) * 3 + 3;
          d.setMonth(qMonth, 0);
          d.setHours(23, 59, 59, 999);
          break;
        }
        case 'year': {
          d.setMonth(11, 31);
          d.setHours(23, 59, 59, 999);
          break;
        }
      }
      return d.getTime();
    }
  });
}

// Expose globally so components relying on window.Chart continue to work seamlessly
if (typeof window !== 'undefined') {
  (window as any).Chart = Chart;
}

export { Chart };
export default Chart;
