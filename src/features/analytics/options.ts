import type { EChartsOption } from 'echarts';
import { SEVERITY_GROUPS, type Filters, type MatchedCrash, type SchoolCount } from '../../domain/types';
import { severityGroup, seriesByHour, seriesByYear } from '../../domain/selectors';

const grid = { top: 24, left: 42, right: 18, bottom: 34 };
const yAxis = { type: 'value' as const, minInterval: 1, axisLine: { show: false }, axisLabel: { color: '#81786d', fontSize: 11 }, splitLine: { lineStyle: { color: '#eeeae3', type: 'dashed' as const } } };
const xAxis = { type: 'category' as const, axisLine: { lineStyle: { color: '#e3ded6' } }, axisTick: { show: false }, axisLabel: { color: '#81786d', fontSize: 11 } };
export function yearOption(matches: MatchedCrash[], filters: Filters): EChartsOption {
  const series = seriesByYear(matches, filters.startYear, filters.endYear);
  return { grid, xAxis: { ...xAxis, data: series.map(r => String(r.year) + (r.year === 2026 ? '*' : '')) }, yAxis,
    series: [{ type: 'bar', name: 'Unique crashes', data: series.map(r => ({ value: r.count, itemStyle: { color: r.year === 2026 ? '#c8c0b4' : '#806345', borderRadius: [4, 4, 0, 0] } })), barMaxWidth: 35 }],
  };
}
export function hourOption(matches: MatchedCrash[]): EChartsOption {
  const series = seriesByHour(matches);
  return { grid, xAxis: { ...xAxis, data: series.map(r => `${String(r.hour).padStart(2, '0')}:00`), axisLabel: { fontSize: 11, interval: 3 } }, yAxis,
    series: [{ type: 'bar', name: 'Unique crashes', data: series.map(r => ({ value: r.count, itemStyle: { color: r.hour >= 7 && r.hour <= 8 || r.hour >= 15 && r.hour <= 16 ? '#b38b30' : '#a49176', borderRadius: [3, 3, 0, 0] } })), barMaxWidth: 18 }],
  };
}
export function severityOption(matches: MatchedCrash[]): EChartsOption {
  return { tooltip: { trigger: 'item', renderMode: 'richText' }, legend: { orient: 'vertical', right: 12, top: 'center', itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11, color: '#70675d' } },
    series: [{ type: 'pie', radius: ['48%', '71%'], center: ['29%', '50%'], label: { show: false }, emphasis: { label: { show: false }, scaleSize: 5 }, itemStyle: { borderColor: '#ffffff', borderWidth: 3 },
      data: SEVERITY_GROUPS.map(s => ({ name: s.label, value: matches.filter(m => severityGroup(m.crash.severity) === s.id).length, itemStyle: { color: s.color } })) }],
    title: { text: matches.length.toLocaleString(), subtext: 'unique crashes', left: '28%', top: '40%', textAlign: 'center', textStyle: { color: '#493321', fontSize: 28, fontWeight: 600 }, subtextStyle: { color: '#81786d', fontSize: 11 } },
  };
}
export function weekdayHourOption(matches: MatchedCrash[]): EChartsOption {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  matches.forEach(({ crash }) => matrix[days.indexOf(crash.weekday)][crash.hour]++);
  const max = Math.max(1, ...matrix.flat());
  return { grid: { top: 15, right: 15, left: 42, bottom: 55 }, tooltip: { trigger: 'item', renderMode: 'richText' },
    xAxis: { ...xAxis, data: Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`), splitArea: { show: true }, axisLabel: { interval: 3, fontSize: 11 } },
    yAxis: { type: 'category', data: days, inverse: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { fontSize: 11 } },
    visualMap: { min: 0, max, orient: 'horizontal', bottom: 0, left: 'center', calculable: false, itemHeight: 110, itemWidth: 8, text: ['More', 'Fewer'], textStyle: { fontSize: 11 }, inRange: { color: ['#f6f1e5', '#e1cfaa', '#b08d4e', '#654521'] } },
    series: [{ type: 'heatmap', name: 'Unique crashes', data: matrix.flatMap((hours, day) => hours.map((count, hour) => [hour, day, count])), itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 2 }, emphasis: { itemStyle: { borderColor: '#493321', borderWidth: 1 } } }],
  };
}
export function schoolOption(rows: SchoolCount[]): EChartsOption {
  const sorted = [...rows].filter(r => r.school.hasLinkedRecords).sort((a, b) => b.crashes - a.crashes).slice(0, 10).reverse();
  return { grid: { top: 8, left: 160, right: 35, bottom: 28 }, xAxis: { ...yAxis, type: 'value' }, yAxis: { type: 'category', data: sorted.map(r => r.school.name.replace(' Elementary', '').replace(' School', '')), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { fontSize: 11, width: 145, overflow: 'truncate' } },
    series: [{ type: 'bar', name: 'Unique nearby crashes', data: sorted.map(r => r.crashes), barMaxWidth: 13, itemStyle: { color: '#96774f', borderRadius: [0, 3, 3, 0] }, label: { show: true, position: 'right', fontSize: 11, color: '#716250' } }],
  };
}
