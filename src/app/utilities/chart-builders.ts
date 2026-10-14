import { ApexOptions } from 'ng-apexcharts';
import { formatInr, formatPct } from './format';

type Series = { name: string; data: number[] }[];

export function areaChart(categories: string[], series: Series, extra: ApexOptions = {}): ApexOptions {
  return {
    chart: { type: 'area' },
    series,
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false } },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.02, stops: [0, 95, 100] } },
    ...extra,
  };
}

export function lineChart(categories: string[], series: Series, extra: ApexOptions = {}): ApexOptions {
  return {
    chart: { type: 'line' },
    series,
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false } },
    markers: { size: 0, hover: { size: 5 } },
    ...extra,
  };
}

export function barChart(categories: string[], series: Series, extra: ApexOptions = {}): ApexOptions {
  return {
    chart: { type: 'bar' },
    series,
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false }, labels: { trim: true, hideOverlappingLabels: true } },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', borderRadiusApplication: 'end' } },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    ...extra,
  };
}

export function horizontalBarChart(categories: string[], series: Series, extra: ApexOptions = {}): ApexOptions {
  return barChart(categories, series, {
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%', borderRadiusApplication: 'end' } },
    xaxis: { categories, labels: { formatter: (v: string) => formatInr(Number(v)) } },
    yaxis: { labels: { formatter: (v: number | string) => String(v) } },
    ...extra,
  });
}

export function donutChart(labels: string[], values: number[], colors?: string[], extra: ApexOptions = {}): ApexOptions {
  const total = values.reduce((a, b) => a + b, 0);
  return {
    chart: { type: 'donut' },
    series: values.map((v) => Math.round(v)),
    labels,
    ...(colors ? { colors } : {}),
    stroke: { width: 0 },
    legend: { position: 'bottom' },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            value: { formatter: (v: string) => formatInr(Number(v)) },
            total: { show: true, label: 'Total', formatter: () => formatInr(total) },
          },
        },
      },
    },
    ...extra,
  };
}

export function radialChart(labels: string[], values: number[], extra: ApexOptions = {}): ApexOptions {
  return {
    chart: { type: 'radialBar' },
    series: values.map((v) => Math.round(Math.max(0, Math.min(100, v)) * 10) / 10),
    labels,
    plotOptions: {
      radialBar: {
        hollow: { size: values.length > 1 ? '30%' : '62%' },
        track: { background: 'rgba(138,148,178,0.15)' },
        dataLabels: {
          name: { fontSize: '13px' },
          value: { fontSize: '22px', fontWeight: 700, formatter: (v: number) => formatPct(v) },
          ...(values.length > 1
            ? { total: { show: true, label: 'Average', formatter: () => formatPct(values.reduce((a, b) => a + b, 0) / values.length) } }
            : {}),
        },
      },
    },
    stroke: { lineCap: 'round' },
    legend: { show: values.length > 1, position: 'bottom' },
    fill: values.length === 1 ? { type: 'gradient', gradient: { shade: 'dark', type: 'horizontal', gradientToColors: ['#00C48C'], stops: [0, 100] } } : {},
    ...extra,
  };
}

export const percentAxis: ApexOptions = {
  yaxis: { labels: { formatter: (v: number) => formatPct(v, 0) } },
  tooltip: { y: { formatter: (v: number) => formatPct(v) } },
};
