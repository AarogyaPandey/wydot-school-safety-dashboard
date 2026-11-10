import { AlertCircle, AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { useDashboard } from '../app/DashboardContext';

export function DatasetNotice({ compact = false }: { compact?: boolean }) {
  const { state, retry, filters, selectedSchool } = useDashboard();
  if (state.status === 'loading') return <div className={`data-notice ${compact ? 'compact' : ''}`} role="status"><span className="spinner" /><span>Loading data…</span></div>;
  if (state.status === 'error') return <div className="data-notice error" role="alert"><AlertCircle size={15} /><div><strong>Data could not be loaded.</strong><details><summary>Details</summary><p>{state.message}</p></details><button className="text-button" onClick={retry}><RefreshCw size={12} />Retry</button></div></div>;
  if (state.status === 'withheld') return <div className={`data-notice withheld ${compact ? 'compact' : ''}`} role="status"><Database size={15} /><span>Data unavailable in this build.</span></div>;
  const coverageUnknown = selectedSchool && !selectedSchool.hasLinkedRecords;
  if (coverageUnknown || filters.endYear === 2026) return <div className="data-notice compact warning"><AlertTriangle size={14} /><div>{coverageUnknown && <p>No linked crash records for this school. Coverage unverified.</p>}{filters.endYear === 2026 && <p>2026 is incomplete. Latest linked record: {state.data?.metadata.latestDate}.</p>}</div></div>;
  return null;
}
