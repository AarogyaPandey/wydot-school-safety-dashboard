import { useEffect, useId, useRef } from 'react';
import { init, use as useECharts } from 'echarts/core';
import { BarChart, LineChart, PieChart, HeatmapChart } from 'echarts/charts';
import { AriaComponent, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { Download, Expand, Info, X } from 'lucide-react';
import { useState } from 'react';
import { downloadBlob } from '../exports/aggregates';
import { DismissibleDetails } from '../../components/DismissibleDetails';

useECharts([BarChart, LineChart, PieChart, HeatmapChart, AriaComponent, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, TitleComponent, CanvasRenderer]);

async function chartPng(chart: ReturnType<typeof init>, title: string, context: string, countNote: string) {
  const image = new Image(); image.src = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
  await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1100, image.width);
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image export is unavailable in this browser.');
  ctx.font = '17px Segoe UI, Arial, sans-serif';
  const words = context.split(' '), contextLines: string[] = []; let line = '';
  for (const word of words) { if (ctx.measureText(`${line}${word} `).width > canvas.width - 64) { contextLines.push(line); line = ''; } line += `${word} `; }
  if (line) contextLines.push(line);
  const headerHeight = 88 + contextLines.length * 24;
  const chartHeight = Math.round(image.height * canvas.width / image.width);
  canvas.height = chartHeight + headerHeight + 60;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#493321'; ctx.font = '600 30px Segoe UI, Arial, sans-serif'; ctx.fillText(title, 32, 48);
  ctx.fillStyle = '#70675d'; ctx.font = '17px Segoe UI, Arial, sans-serif';
  contextLines.forEach((text, i) => ctx.fillText(text, 32, 80 + i * 24));
  ctx.drawImage(image, 0, headerHeight, canvas.width, chartHeight);
  ctx.fillStyle = '#70675d'; ctx.font = '15px Segoe UI, Arial, sans-serif'; ctx.fillText(countNote, 32, canvas.height - 24);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The chart image could not be created.');
  downloadBlob(blob, `cheyenne-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-research.png`);
}
export default function ChartCard({ title, note, option, context, available = true, wide = false, countNote: customCountNote, emptyText = 'Chart unavailable until source data is available.' }: { title: string; note: string; option: EChartsOption; context: string; available?: boolean; wide?: boolean; countNote?: string; emptyText?: string }) {
  const ref = useRef<HTMLDivElement>(null), chart = useRef<ReturnType<typeof init> | null>(null);
  const card = useRef<HTMLElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [expanded, setExpanded] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!ref.current || !available) return;
    const instance = init(ref.current, undefined, { renderer: 'canvas' }); chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize()); observer.observe(ref.current);
    return () => { observer.disconnect(); instance.dispose(); chart.current = null; };
  }, [available]);
  useEffect(() => { chart.current?.setOption({ animationDuration: 350, textStyle: { fontFamily: 'Segoe UI, Arial, sans-serif', color: '#70675d' }, tooltip: { trigger: 'axis', renderMode: 'richText', backgroundColor: '#ffffff', borderColor: '#e3ded6', textStyle: { color: '#493321', fontSize: 12 } }, aria: { enabled: true, label: { description: `${title}. ${note}` } }, ...option }, { notMerge: true }); }, [option, title, note, available]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; closeButton.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); setExpanded(false); }
      if (event.key === 'Tab') {
        const controls = Array.from(card.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, [tabindex="0"]') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const outside = (event: PointerEvent) => { if (!card.current?.contains(event.target as Node)) setExpanded(false); };
    document.addEventListener('keydown', keyboard); document.addEventListener('pointerdown', outside);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keyboard); document.removeEventListener('pointerdown', outside);
      // React can reuse the former expand-button node for another action.
      const expandButton = card.current?.querySelector<HTMLElement>('button[title="Expand chart"]');
      if (expandButton) expandButton.focus({ preventScroll: true });
      else if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [expanded]);
  const countNote = customCountNote || (title === 'Crashes by school'
    ? 'Counts may overlap between schools. Nearby crashes do not establish school involvement.'
    : 'Counts describe nearby roads; they do not establish school involvement.');

  return <>{expanded && <div className="chart-backdrop" aria-hidden="true" onPointerDown={() => setExpanded(false)} />}<article ref={card} role={expanded ? 'dialog' : undefined} aria-modal={expanded ? true : undefined} aria-labelledby={titleId} className={`chart-card${wide ? ' wide' : ''}${expanded ? ' expanded-chart' : ''}`}><div className="chart-heading"><h2 id={titleId}>{title}</h2><div className="chart-actions"><DismissibleDetails className="chart-help"><summary aria-label={`About ${title}`}><Info size={14} /></summary><p>{note}</p></DismissibleDetails>{!expanded && <button className="icon-button" disabled={!available} onClick={() => setExpanded(true)} aria-label={`Expand ${title}`} title="Expand chart"><Expand size={14} /></button>}<button className="icon-button" disabled={!available} onClick={() => { if (chart.current) void chartPng(chart.current, title, context, countNote).catch(e => setError(e instanceof Error ? e.message : 'Export failed.')); }} aria-label={`Export ${title} as PNG`}><Download size={14} /></button>{expanded && <button ref={closeButton} className="icon-button chart-close" onClick={() => setExpanded(false)} aria-label={`Close expanded ${title}`} title="Close chart"><X size={18} /></button>}</div></div><div className="chart-content" ref={ref} role="img" aria-label={`${title}. ${note}`}>{!available && <div className="chart-empty">{emptyText}</div>}</div>{error && <p className="inline-error" role="alert">{error}</p>}</article></>;
}
