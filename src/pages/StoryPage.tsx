import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, Map, ShieldCheck } from 'lucide-react';
import { useLatestFilterLink } from '../app/useLatestFilterLink';
import { useDashboard } from '../app/DashboardContext';
import { selectStoryCompleteYears, selectStoryMatches, selectStorySchoolCounts } from '../domain/selectors';
import { schoolStoryOption, weekdayHourOption } from '../features/analytics/options';
import ChartCard from '../features/analytics/ChartCard';
import BufferComparisonMaps from '../features/map/BufferComparisonMaps';

const BUFFER_OPTIONS = [500, 1000, 1320] as const;
type StoryYear = number | 'all';

export default function StoryPage() {
  const { state, usingUploads } = useDashboard();
  const location = useLocation();
  const preserveFilters = useLatestFilterLink();
  const [year, setYear] = useState<StoryYear>('all');
  const [bufferFt, setBufferFt] = useState<number>(1320);
  const [weekdayYear, setWeekdayYear] = useState<StoryYear>('all');
  const [weekdayBufferFt, setWeekdayBufferFt] = useState<number>(1320);
  const [weekdaySchoolId, setWeekdaySchoolId] = useState('all');
  const data = state.data;
  const years = useMemo(() => data ? selectStoryCompleteYears(data) : [], [data]);
  const schoolCounts = useMemo(() => data ? selectStorySchoolCounts(data, year, bufferFt).filter(row => row.school.hasLinkedRecords) : [], [data, year, bufferFt]);
  const weekdayMatches = useMemo(() => data ? selectStoryMatches(data, weekdayYear, weekdayBufferFt, weekdaySchoolId) : [], [data, weekdayYear, weekdayBufferFt, weekdaySchoolId]);
  const weekdayHour = useMemo(() => weekdayHourOption(weekdayMatches), [weekdayMatches]);
  const topSchool = schoolCounts[0];
  const chartNote = 'Crash records within the selected distance of each school. A crash near more than one school is counted once for each qualifying school; this is not a safety ranking or an exposure-adjusted risk measure.';
  const chartContext = `${year === 'all' ? `Complete years ${data?.metadata.firstYear}–${data?.metadata.completeThrough}` : year} · within ${bufferFt === 1320 ? '¼ mile (1,320 ft)' : `${bufferFt.toLocaleString()} ft`}`;
  const weekdayHourSchool = data?.schools.find(school => school.id === weekdaySchoolId);
  const weekdayHourSchoolLabel = weekdaySchoolId === 'all' ? 'All schools' : weekdayHourSchool?.name || 'Selected school';
  const weekdayHourNote = `Each cell counts distinct school-linked crash records for the selected year and proximity buffer${weekdaySchoolId === 'all' ? '' : ` at ${weekdayHourSchool?.name || 'the selected school'}`}, grouped by weekday and stored local clock hour. A crash linked to multiple schools is counted once in this heatmap. Color represents record counts, not severity or risk.`;
  const weekdayHourContext = `${weekdayYear === 'all' ? `Complete years ${data?.metadata.firstYear}–${data?.metadata.completeThrough}` : weekdayYear} · ${weekdayHourSchoolLabel} · within ${weekdayBufferFt === 1320 ? '¼ mile (1,320 ft)' : `${weekdayBufferFt.toLocaleString()} ft`}`;

  return <main id="main-content" className="story-page">
    <section className="story-hero">
      <div className="story-hero-copy">
        <span className="eyebrow">CHEYENNE, WYOMING SCHOOL SAFETY DASHBOARD</span>
        <h1>Understanding crashes near Cheyenne schools</h1>
        <p>Explore what this project measures, how to read its maps and charts, and how the patterns change with distance and time.</p>
        <Link className="button primary" to={`/map${location.search}`} onClick={preserveFilters}><Map size={14} />Explore the map<ArrowRight size={14} /></Link>
      </div>
      <div className="story-hero-mark" aria-hidden="true"><Map size={34} strokeWidth={1.3} /><span /><span /><span /></div>
    </section>

    <nav className="story-chapters" aria-label="Story chapters">
      <a href="#project"><span>01</span>Project</a>
      <a href="#map-story"><span>02</span>Read the map</a>
      <a href="#buffer-maps"><span>03</span>Compare buffers</a>
      <a href="#chart-story"><span>04</span>Explore the chart</a>
      <a href="#weekday-hour-chart"><span>05</span>Weekday and hour</a>
      <a href="#interpret"><span>06</span>Interpret carefully</a>
    </nav>

    <section id="project" className="story-section story-intro">
      <div className="story-section-heading"><span className="eyebrow">01 / THE PROJECT</span><h2>One dashboard, several ways to explore</h2></div>
      <div className="story-section-copy">
        <p>The Cheyenne, Wyoming School Safety Dashboard, developed in collaboration with WYDOT, brings school locations, crash records, mapped infrastructure, and existing analyses into one place. It helps people explore where and when crashes were recorded near schools—not to label a school as safe or unsafe.</p>
        <p>The interactive overview uses school-linked records: crashes connected to a school within at most 1,320 feet (¼ mile). The map, shared filters, and charts let you examine that same relationship data from different angles.</p>
      </div>
    </section>

    <section id="map-story" className="story-section story-feature">
      <div className="story-section-heading"><span className="eyebrow">02 / PLACE &amp; CONTEXT</span><h2>Read the map in layers</h2></div>
      <div className="story-feature-content">
        <div className="story-map-illustration" role="img" aria-label="Schematic illustration of school markers, crash locations, and a selected-distance proximity buffer">
          <div className="story-map-road road-one" /><div className="story-map-road road-two" />
          <div className="story-map-buffer" /><span className="story-map-school"><Map size={15} /></span>
          <i className="story-map-crash crash-one" /><i className="story-map-crash crash-two" /><i className="story-map-crash crash-three" /><i className="story-map-crash crash-four" />
          <span className="story-map-label">Selected distance</span>
        </div>
        <div className="story-explainer">
          <p>School markers locate schools from the dataset; crash points show the mapped crash records. Turn infrastructure and hotspot layers on or off to see them in geographic context.</p>
          <p>The illustration is schematic. On the main map, proximity circles follow the “Distance from school” filter: choose 500 ft, 1,000 ft, or 1,320 ft (¼ mile), or enter a custom whole-foot distance from 1 to 1,320 ft. These are straight-line analytical buffers—not verified legal school-zone boundaries, walking routes, or proof that a crash involved a school.</p>
          <Link className="text-button" to={`/map${location.search}`} onClick={preserveFilters}>Open the interactive map<ArrowRight size={14} /></Link>
        </div>
      </div>
    </section>

    <section id="buffer-maps" className="story-section story-buffer-section">
      <div className="story-section-heading"><span className="eyebrow">03 / COMPARE THE DISTANCES</span><h2>See how the school buffers grow</h2><p>Choose a school to compare its 500-ft, 1,000-ft, and ¼-mile boundaries side by side. These three story maps hold each preset distance constant for comparison; they are not a fixed 500-ft ring on the main map. The maps use the same basemap and synchronized pan and zoom.</p></div>
      {data ? <BufferComparisonMaps data={data} /> : <p className="buffer-map-unavailable" role="status">{state.status === 'withheld' ? 'School locations are not included in this release.' : state.status === 'error' ? 'School locations could not be loaded.' : 'Loading school locations…'}</p>}
    </section>

    <section id="chart-story" className="story-section story-chart-section">
      <div className="story-section-heading"><span className="eyebrow">04 / A SCHOOL-BY-SCHOOL VIEW</span><h2>How do nearby crash counts change?</h2><p>Each bar counts distinct crash records linked to that school whose recorded distance is within the selected radius. Choose a calendar year or compare all complete years, then change the 500-ft, 1,000-ft, or ¼-mile buffer. A crash can be counted for more than one school when it falls within multiple school buffers.</p></div>
      <fieldset className="story-chart-controls" disabled={state.status !== 'ready'}>
        <legend className="sr-only">Crash chart filters</legend>
        <label htmlFor="story-year">Year</label>
        <select id="story-year" value={year} onChange={event => setYear(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
          <option value="all">{data ? `All complete years (${data.metadata.firstYear}–${data.metadata.completeThrough})` : 'All complete years'}</option>
          {years.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <span className="story-control-label" id="story-buffer-label">Distance from school</span>
        <div className="segmented" role="group" aria-labelledby="story-buffer-label">
          {BUFFER_OPTIONS.map(value => <button key={value} type="button" className={bufferFt === value ? 'selected' : ''} aria-pressed={bufferFt === value} onClick={() => setBufferFt(value)}>{value === 1320 ? '¼ mile' : `${value.toLocaleString()} ft`}</button>)}
        </div>
      </fieldset>
      <div className="story-chart-frame">
        <ChartCard title="Nearby crash records by school" note={chartNote} option={schoolStoryOption(schoolCounts)} context={chartContext} available={state.status === 'ready'} wide emptyText={state.status === 'withheld' ? 'Project crash and school data are not included in this release.' : state.status === 'error' ? 'Crash and school data could not be loaded.' : 'Loading project crash and school data…'} countNote={chartNote} />
      </div>
      {state.status === 'ready' && topSchool && <p className="story-insight" role="status">{topSchool.crashes > 0 ? <><strong>{topSchool.crashes.toLocaleString()}</strong> is the highest displayed count for these filters, at <strong>{topSchool.school.name}</strong>.</> : <>No linked crash records appear at the displayed schools for these filters.</>} This describes counts only, not relative safety or risk.</p>}
      <p className="story-chart-caption">{chartNote} Schools without linked records are omitted because their coverage is unverified. Distances are rounded in the source relationship table, so counts near buffer edges are approximate.</p>
    </section>

    <section id="weekday-hour-chart" className="story-section story-chart-section">
      <div className="story-section-heading"><span className="eyebrow">05 / WHEN CRASHES WERE RECORDED</span><h2>Read the Weekday and hour chart</h2><p>Use the independent Year, Proximity buffer, and School dropdowns to filter this chart; changing one does not change the others, the school-count chart, or the maps. Defaults are All complete years, ¼ mile (1,320 ft), and All schools. Choosing a school includes only records linked to that school; All schools counts a crash once even if it is linked to multiple schools. Rows run Monday through Sunday; columns run by local clock hour from 00:00 to 23:00. Each cell counts distinct crash records that meet the selected filters. Darker cells mean more records, lighter cells mean fewer, and the lightest cells indicate zero—color does not show crash severity or risk.</p></div>
      <fieldset className="story-chart-controls story-weekday-controls" disabled={state.status !== 'ready' || usingUploads}>
        <legend className="sr-only">Weekday and hour chart filters</legend>
        <div className="story-weekday-filter weekday-year-filter">
          <label htmlFor="weekday-hour-year">Year</label>
          <select id="weekday-hour-year" value={weekdayYear} onChange={event => setWeekdayYear(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
            <option value="all">{data ? `All complete years (${data.metadata.firstYear}–${data.metadata.completeThrough})` : 'All complete years'}</option>
            {years.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="story-weekday-filter weekday-buffer-filter">
          <label htmlFor="weekday-hour-buffer">Proximity buffer</label>
          <select id="weekday-hour-buffer" value={weekdayBufferFt} onChange={event => setWeekdayBufferFt(Number(event.target.value))}>
            {BUFFER_OPTIONS.map(value => <option key={value} value={value}>{value === 1320 ? '¼ mile (1,320 ft)' : `${value.toLocaleString()} ft`}</option>)}
          </select>
        </div>
        <div className="story-weekday-filter weekday-school-filter">
          <label htmlFor="weekday-hour-school">School</label>
          <select id="weekday-hour-school" value={weekdaySchoolId} onChange={event => setWeekdaySchoolId(event.target.value)}>
            <option value="all">All schools</option>
            {data?.schools.map(school => <option key={school.id} value={school.id}>{school.name}{school.hasLinkedRecords ? '' : ' · coverage unverified'}</option>)}
          </select>
        </div>
      </fieldset>
      <ChartCard title="Weekday and hour" note={weekdayHourNote} option={weekdayHour} context={weekdayHourContext} available={state.status === 'ready' && !usingUploads} wide countNote={weekdayHourNote} emptyText={usingUploads ? 'This chart uses project crash records; return to project data in Analytics to view it.' : state.status === 'withheld' ? 'Project crash data is not included in this release.' : state.status === 'error' ? 'Crash data could not be loaded.' : 'Loading project crash data…'} />
    </section>

    <section className="story-section story-reading-grid">
      <article><span className="eyebrow">THE DASHBOARD</span><h2>What the other charts show</h2><p><strong>Crashes by year</strong> counts unique records in each selected year. <strong>Crashes by hour</strong> uses the stored local clock hour. <strong>Severity</strong> summarizes the most severe recorded crash outcome, not the number of people injured.</p><p><strong>School comparisons</strong> count qualifying crash-school relationships separately for each school. One crash may appear for more than one school, so school bars cannot be summed to get a citywide total.</p><Link className="text-button" to={`/analytics${location.search}`} onClick={preserveFilters}><BarChart3 size={15} />Explore all dashboard charts<ArrowRight size={14} /></Link></article>
      <article id="interpret"><span className="eyebrow">06 / INTERPRETATION</span><h2>Patterns are a starting point</h2><p>Counts are descriptive, not crash risk: traffic volume, walking exposure, enrollment, and school opening or closing dates are not fully represented. A nearby record does not establish school involvement, and schools with no linked records may have unverified coverage.</p><p>Historical comparisons use the school-linked export, not every crash in Cheyenne. The map and chart year controls use complete years only. Statistical results keep their Phase 2 populations and methods; they do not automatically change with the interactive chart filters.</p><Link className="text-button" to={`/about${location.search}`} onClick={preserveFilters}><ShieldCheck size={15} />Read sources, methods, and limitations<ArrowRight size={14} /></Link></article>
    </section>

    <footer className="story-footer"><BookOpen size={16} /><p>Use the map to inspect locations, or return to the dashboard to continue exploring.</p><Link className="button" to={`/map${location.search}`} onClick={preserveFilters}><ArrowLeft size={13} />Back to map</Link></footer>
  </main>;
}
