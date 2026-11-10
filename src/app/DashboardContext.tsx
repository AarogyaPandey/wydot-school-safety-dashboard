import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchDataset, type DatasetState } from '../data/client';
import { DEFAULT_FILTERS, parseFilters, serializeFilters } from '../domain/filters';
import { selectMatches, selectSchoolCounts, summarize } from '../domain/selectors';
import type { Filters } from '../domain/types';

function useDashboardState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  const filters = useMemo(() => parseFilters(search), [search]);
  const [state, setState] = useState<DatasetState>({ status: 'loading', data: null, message: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setState({ status: 'loading', data: null, message: '' });
    void fetchDataset(abort.signal).then(setState).catch(error => {
      if (!abort.signal.aborted) setState({ status: 'error', data: null, message: error instanceof Error ? error.message : 'Data could not be loaded.' });
    });
    return () => abort.abort();
  }, [attempt]);
  const updateFilters = useCallback((patch: Partial<Filters> | ((current: Filters) => Partial<Filters>)) => {
    // History is updated before React finishes a navigation transition. Read that
    // current value so a quick second control change cannot restore stale filters.
    const current = parseFilters(window.location.search);
    const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
    setSearchParams(serializeFilters(next).slice(1), { replace: true });
  }, [setSearchParams]);
  const resetFilters = useCallback(() => setSearchParams(serializeFilters(DEFAULT_FILTERS), { replace: true }), [setSearchParams]);
  const selectSchool = useCallback((id: string) => updateFilters({ schoolId: id, level: 'all', bounds: null }), [updateFilters]);
  const matches = useMemo(() => state.data ? selectMatches(state.data, filters) : [], [state.data, filters]);
  const schoolCounts = useMemo(() => state.data ? selectSchoolCounts(state.data, matches, filters) : [], [state.data, matches, filters]);
  const summary = useMemo(() => summarize(matches), [matches]);
  const selectedSchool = state.data?.schools.find(s => s.id === filters.schoolId);
  return { state, filters, updateFilters, resetFilters, selectSchool, matches, schoolCounts, summary, selectedSchool, retry: () => setAttempt(n => n + 1) };
}
type DashboardContextValue = ReturnType<typeof useDashboardState>;
const DashboardContext = createContext<DashboardContextValue | null>(null);
export function DashboardProvider({ children }: { children: ReactNode }) {
  const value = useDashboardState();
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('DashboardProvider is required.');
  return context;
}
