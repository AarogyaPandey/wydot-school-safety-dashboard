import { Accessibility, Activity, CalendarDays, ShieldAlert } from 'lucide-react';
import { useDashboard } from '../app/DashboardContext';

export function Kpis({ compact = false }: { compact?: boolean }) {
  const { state, summary } = useDashboard();
  const ready = state.status === 'ready';
  const items = [
    { label: 'Unique crashes', value: summary.total, note: 'Each crash counted once', Icon: Activity, className: 'teal' },
    { label: 'Fatal / serious injury', value: summary.fatalSerious, note: 'Crash severity, not people', Icon: ShieldAlert, className: 'rust' },
    { label: 'Pedestrian / bicycle', value: summary.pedBike, note: 'Where involvement is recorded', Icon: Accessibility, className: 'gold' },
    { label: 'School-day crashes', value: summary.schoolDays, note: 'Under the assumed calendar*', Icon: CalendarDays, className: 'sage' },
  ];
  return <div className={`kpi-grid ${compact ? 'kpi-compact' : ''}`}>{items.map(({ label, value, note, Icon, className }) => <article className={`kpi-card ${className}`} key={label} title={ready ? note : 'Data unavailable'}><div className="kpi-title"><span>{label}</span><Icon size={14} strokeWidth={1.7} /></div><strong data-testid={label === 'Unique crashes' ? 'unique-crash-count' : undefined}>{ready ? value.toLocaleString() : '—'}</strong></article>)}</div>;
}
