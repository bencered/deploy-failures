"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  addDays,
  format,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import type { DeployEvent } from "@/lib/vercel-api";
import { fetchEvents, signInWithVercel } from "../actions";

// Small enough that the user sees real data in ~2s. Covers the default 30d
// view for typical users; the background pass fills in the rest for All.
const INITIAL_LIMIT = 150;
const BACKGROUND_LIMIT = 5000;

// localStorage cache key. Version-suffixed so a schema change can invalidate
// every user's cache by bumping the number — no manual clears needed.
// Bumped to v2 when we migrated from Gmail events (with kind/subject/snippet)
// to Vercel API events (with url/branch/commitSha). Old cached entries would
// silently inflate counts on first paint, so we invalidate by version.
const CACHE_KEY = "deploy-failures:events:v2";

function loadCache(): DeployEvent[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function saveCache(events: DeployEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(events));
  } catch {
    // QuotaExceededError or similar — best-effort cache; ignore.
  }
}

type Range = 7 | 30 | 365 | "all";

// Vercel-ish palette for stacked project bars. Ordered so adjacent entries
// stay visually distinct (alternating hue families).
const PROJECT_COLORS = [
  "#0070f0", // blue
  "#ff0080", // pink
  "#50e3c2", // cyan
  "#f5a623", // amber
  "#7928ca", // purple
  "#00d084", // green
  "#ff4d4f", // red
  "#52a9ff", // light blue
  "#c779ff", // light purple
  "#ffb35c", // light amber
  "#22c55e", // emerald
  "#f472b6", // rose
];
const OTHER_COLOR = "var(--gray-500)";
const TOP_N_PROJECTS = 12;
// Only bucket into "Other" if doing so collapses at least this many projects
// — otherwise it's silly to hide 1–2 projects behind a generic label.
const OTHER_MIN_PROJECTS = 3;

export function DashboardChrome({
  banner,
  children,
}: {
  banner?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.04em]">
            Deploy Failures
          </h1>
          <p className="text-[14px] text-(--text-secondary) mt-1">
            Failed deployments pulled directly from the{" "}
            <span className="mono text-(--text-primary)">Vercel REST API</span>.
          </p>
        </div>
      </div>
      {banner ? <div className="mb-6">{banner}</div> : null}
      {children}
    </div>
  );
}

export function Dashboard() {
  const [events, setEvents] = useState<DeployEvent[]>([]);
  // "initial": waiting on the fast paint fetch (skeleton shown)
  // "background": initial done; still fetching the long tail
  // "done": both fetches complete
  // "auth-expired": Vercel token revoked or expired — show re-auth banner
  const [phase, setPhase] = useState<
    "initial" | "background" | "done" | "auth-expired"
  >("initial");
  const [range, setRange] = useState<Range>(30);
  // null = show all projects. Otherwise, only the named category is visible
  // in the chart. Set by clicking a legend row; cleared by re-clicking the
  // same row, clicking the inline "show all" link, or clicking nothing.
  const [isolatedProject, setIsolatedProject] = useState<string | null>(null);

  // Single mount effect: hydrate from localStorage cache (instant paint on
  // return visits), then always refresh from the Vercel API. If we have no
  // cache, do a small initial fetch first so we can paint quickly, then run
  // the long-tail fetch in the background only if we capped.
  useEffect(() => {
    let cancelled = false;

    const cached = loadCache();
    if (cached) {
      setEvents(cached);
      setPhase("background");
      fetchEvents(BACKGROUND_LIMIT).then((res) => {
        if (cancelled) return;
        if (res.authExpired) {
          setPhase("auth-expired");
          return;
        }
        if (res.ok) {
          setEvents(res.events);
          saveCache(res.events);
        }
        setPhase("done");
      });
      return () => {
        cancelled = true;
      };
    }

    fetchEvents(INITIAL_LIMIT).then((res) => {
      if (cancelled) return;
      if (res.authExpired) {
        setPhase("auth-expired");
        return;
      }
      setEvents(res.events);
      saveCache(res.events);

      if (res.events.length >= INITIAL_LIMIT) {
        setPhase("background");
        fetchEvents(BACKGROUND_LIMIT).then((res2) => {
          if (cancelled) return;
          if (res2.ok) {
            setEvents(res2.events);
            saveCache(res2.events);
          }
          setPhase("done");
        });
      } else {
        setPhase("done");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadingMore = phase === "background";

  // True when the currently selected range extends past the oldest event
  // we've fetched AND a background fetch is still in flight — i.e. the chart
  // would be lying to the user by showing an empty tail for a period we
  // haven't yet pulled. Drives the chart's loading overlay.
  const rangeNotYetCovered = useMemo(() => {
    if (!loadingMore) return false;
    if (events.length === 0) return true;
    const oldest = new Date(events[events.length - 1].date).getTime();
    const daysCovered = (Date.now() - oldest) / 86400000;
    // "All" — only blank the chart if we don't have a meaningful amount yet.
    // After cache hydration we usually have plenty; showing "Loading…" over
    // real data would be misleading.
    if (range === "all") return events.length < INITIAL_LIMIT;
    return range > daysCovered;
  }, [loadingMore, events, range]);

  // The Vercel API only returns real failed deployments — no permission
  // denials or unknown-parse cases like the old Gmail path. Kept as an alias
  // so the rest of the component reads the same.
  const realFailures = events;

  const inRange = useMemo(() => {
    if (range === "all") return realFailures;
    const cutoff = subDays(new Date(), range).getTime();
    return realFailures.filter((e) => new Date(e.date).getTime() >= cutoff);
  }, [realFailures, range]);

  // Top projects (all-time) define the legend; everything else collapses into
  // an "Other" stack. Stable across range changes so the legend doesn't jump.
  const projectSeries = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of realFailures)
      totals.set(e.project, (totals.get(e.project) ?? 0) + 1);
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const hasOther = sorted.length >= TOP_N_PROJECTS + OTHER_MIN_PROJECTS;
    const top = hasOther
      ? sorted.slice(0, TOP_N_PROJECTS).map(([n]) => n)
      : sorted.map(([n]) => n);
    const topSet = new Set(top);
    return {
      categories: hasOther ? [...top, "Other"] : top,
      bucketKey: (project: string) =>
        topSet.has(project) ? project : hasOther ? "Other" : project,
      colorFor: (cat: string, idx: number) =>
        cat === "Other" ? OTHER_COLOR : PROJECT_COLORS[idx % PROJECT_COLORS.length],
    };
  }, [realFailures]);

  // Apply isolation: when a project is isolated, only events that bucket
  // to that category survive into the chart and the header count.
  const visibleEvents = useMemo(() => {
    if (!isolatedProject) return inRange;
    return inRange.filter(
      (e) => projectSeries.bucketKey(e.project) === isolatedProject
    );
  }, [inRange, isolatedProject, projectSeries]);

  const buckets = useMemo(
    () => buildBuckets(visibleEvents, range, projectSeries.bucketKey),
    [visibleEvents, range, projectSeries]
  );

  const visibleCategories = useMemo(
    () =>
      isolatedProject
        ? projectSeries.categories.filter((c) => c === isolatedProject)
        : projectSeries.categories,
    [projectSeries.categories, isolatedProject]
  );

  // Per-category totals for the legend, computed from the active time
  // range. Mirrors what Vercel shows under their billing chart: name +
  // absolute value + percentage share.
  const legendRows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of inRange) {
      const k = projectSeries.bucketKey(e.project);
      totals.set(k, (totals.get(k) ?? 0) + 1);
    }
    const sum = inRange.length || 1;
    return projectSeries.categories.map((cat) => {
      const count = totals.get(cat) ?? 0;
      return { cat, count, pct: (count / sum) * 100 };
    });
  }, [inRange, projectSeries]);

  const toggleIsolate = (cat: string) => {
    setIsolatedProject((prev) => (prev === cat ? null : cat));
  };

  // For "All", explicitly mark which buckets start a new year — we'll use
  // them as X-axis ticks so the year label appears only on Jan 1st.
  const yearTickDates = useMemo(() => {
    if (range !== "all" || buckets.length === 0) return undefined;
    const ticks: string[] = [];
    let lastYear: number | null = null;
    for (const b of buckets) {
      const year = new Date(b.date).getFullYear();
      if (year !== lastYear) {
        ticks.push(b.date);
        lastYear = year;
      }
    }
    return ticks;
  }, [buckets, range]);

  const stats = useMemo(() => {
    const projectCounts = new Map<string, number>();
    const teamCounts = new Map<string, number>();
    for (const e of realFailures) {
      projectCounts.set(e.project, (projectCounts.get(e.project) ?? 0) + 1);
      if (e.team) teamCounts.set(e.team, (teamCounts.get(e.team) ?? 0) + 1);
    }
    const top = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    const topProject = top(projectCounts);
    const topTeam = top(teamCounts);

    // Time since the most recent real failure. realFailures is sorted desc
    // by date so realFailures[0] is the latest.
    let lastFailure: { value: number; unit: string; date: string } | null = null;
    if (realFailures.length > 0) {
      const latest = new Date(realFailures[0].date);
      const ms = Math.max(0, Date.now() - latest.getTime());
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor(ms / 3600000);
      const mins = Math.floor(ms / 60000);
      if (days >= 1) {
        lastFailure = { value: days, unit: days === 1 ? "day" : "days", date: realFailures[0].date };
      } else if (hours >= 1) {
        lastFailure = { value: hours, unit: hours === 1 ? "hour" : "hours", date: realFailures[0].date };
      } else {
        lastFailure = { value: mins, unit: mins === 1 ? "minute" : "minutes", date: realFailures[0].date };
      }
    }

    return {
      total: realFailures.length,
      topProject: topProject ? { name: topProject[0], count: topProject[1] } : null,
      topTeam: topTeam ? { name: topTeam[0], count: topTeam[1] } : null,
      lastFailure,
    };
  }, [realFailures]);

  // Worst days of all time: top 10 days by failure count, each with a
  // project breakdown for the stacked mini-bar. Always uses the full
  // realFailures set so the range toggle doesn't affect this table —
  // "the day Vercel broke us hardest" is a stable, all-time fact.
  // Still respects isolation: if a project is isolated, the table narrows
  // to that project's worst days only.
  const worstDays = useMemo(() => {
    const byDay = new Map<
      string,
      { total: number; projects: Map<string, number> }
    >();
    for (const e of realFailures) {
      const cat = projectSeries.bucketKey(e.project);
      if (isolatedProject && cat !== isolatedProject) continue;
      const day = format(startOfDay(new Date(e.date)), "yyyy-MM-dd");
      let entry = byDay.get(day);
      if (!entry) {
        entry = { total: 0, projects: new Map() };
        byDay.set(day, entry);
      }
      entry.total++;
      entry.projects.set(cat, (entry.projects.get(cat) ?? 0) + 1);
    }
    return [...byDay.entries()]
      .map(([day, data]) => ({
        day,
        total: data.total,
        projects: [...data.projects.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => ({ cat, count })),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [realFailures, isolatedProject, projectSeries]);

  // Period-over-period trend for the Total failures card. Compares the
  // current range to the equivalent prior window. Null for "All" (no
  // "previous all-time") and when both periods are zero.
  const trend = useMemo(() => {
    if (range === "all") return null;
    const now = Date.now();
    const periodMs = range * 86400000;
    const currentStart = now - periodMs;
    const previousStart = now - 2 * periodMs;
    let current = 0;
    let previous = 0;
    for (const e of realFailures) {
      const t = new Date(e.date).getTime();
      if (t >= currentStart) current++;
      else if (t >= previousStart) previous++;
    }
    if (current === 0 && previous === 0) return null;
    const periodLabel = range === 365 ? "year" : `${range}d`;
    if (previous === 0) {
      return { dir: "up" as const, pct: null, periodLabel };
    }
    const raw = ((current - previous) / previous) * 100;
    const pct = Math.round(raw);
    return {
      dir: pct > 0 ? ("up" as const) : pct < 0 ? ("down" as const) : ("flat" as const),
      pct: Math.abs(pct),
      periodLabel,
    };
  }, [realFailures, range]);

  // Early returns live AFTER every hook so the hook call order is stable
  // between renders (Rules of Hooks).
  if (phase === "auth-expired") {
    return (
      <DashboardChrome
        banner={
          <form
            action={signInWithVercel}
            className="card p-4 flex items-center justify-between gap-4"
          >
            <div className="text-[13px]">
              <span className="text-(--warning)">Your Vercel session expired.</span>{" "}
              <span className="text-(--text-secondary)">
                Sign in again to refresh access.
              </span>
            </div>
            <button type="submit" className="btn-secondary btn-sm">
              Re-authenticate
            </button>
          </form>
        }
      />
    );
  }

  if (phase === "initial" && events.length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <DashboardChrome>
      <div className="flex flex-row gap-4 mb-6 [&>*]:flex-1 [&>*]:min-w-0">
        <StatCard
          label="Total failures"
          value={stats.total}
          hint={
            loadingMore
              ? "Loading older failures…"
              : "All time, via Vercel API"
          }
        />
        <StatCard
          label="Since last failure"
          value={stats.lastFailure?.value ?? 0}
          unit={stats.lastFailure?.unit ?? "—"}
          hint={
            stats.lastFailure
              ? format(new Date(stats.lastFailure.date), "MMM d, yyyy · h:mm a")
              : "No failures yet"
          }
        />
        <StatCard
          label="Top project"
          value={stats.topProject?.count ?? 0}
          hint={stats.topProject?.name ?? "—"}
          monoHint
        />
        <StatCard
          label="Top team"
          value={stats.topTeam?.count ?? 0}
          hint={stats.topTeam?.name ?? "—"}
          monoHint
        />
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-(--border)">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
              Failures over time
            </h2>
            <p className="text-[12px] text-(--text-tertiary) mt-[2px]">
              {range === "all"
                ? "All time"
                : range === 365
                ? "Last year"
                : `Last ${range} days`}{" "}
              ·{" "}
              {visibleEvents.length}{" "}
              {visibleEvents.length === 1 ? "failure" : "failures"}
              {trend ? (
                <span className="ml-1.5 align-middle">
                  <TrendChip trend={trend} />
                </span>
              ) : null}
              {isolatedProject ? (
                <>
                  {" "}
                  ·{" "}
                  <button
                    type="button"
                    onClick={() => setIsolatedProject(null)}
                    className="underline underline-offset-2 hover:text-(--text-primary)"
                  >
                    show all
                  </button>
                </>
              ) : null}
              {loadingMore && range === "all" ? (
                <span className="ml-2 text-(--text-tertiary)">· still loading</span>
              ) : null}
            </p>
          </div>
          <RangeToggle range={range} onChange={setRange} />
        </div>
        <div className="relative px-2 pt-4 pb-2 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
                minTickGap={16}
                ticks={yearTickDates}
                interval={
                  range === "all"
                    ? 0
                    : Math.max(0, Math.floor(buckets.length / 10) - 1)
                }
                tickFormatter={(date: string) => formatTick(date, range)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={32}
                tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                isAnimationActive={false}
                animationDuration={0}
                wrapperStyle={{ outline: "none" }}
                offset={12}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    label={props.label as string | undefined}
                    payload={
                      props.payload as unknown as
                        | Array<{ dataKey: string; value: number; color: string }>
                        | undefined
                    }
                    range={range}
                  />
                )}
              />
              {projectSeries.categories.map((cat, i) => {
                if (isolatedProject && cat !== isolatedProject) return null;
                const isTop =
                  visibleCategories[visibleCategories.length - 1] === cat;
                return (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="failures"
                    fill={projectSeries.colorFor(cat, i)}
                    radius={isTop ? [3, 3, 0, 0] : 0}
                    isAnimationActive={false}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
          {rangeNotYetCovered ? (
            <div className="absolute inset-0 flex items-center justify-center bg-(--bg-100)/70 backdrop-blur-[1px] rounded-b-[12px]">
              <div className="flex items-center gap-2 text-[12px] text-(--text-secondary)">
                <Spinner />
                <span>
                  Loading{" "}
                  {range === "all"
                    ? "full history"
                    : range === 365
                    ? "last year"
                    : `last ${range} days`}
                  …
                </span>
              </div>
            </div>
          ) : null}
        </div>
        {legendRows.length > 0 ? (
          <ul className="border-t border-(--border)">
            {legendRows.map(({ cat, count, pct }, i) => {
              const isIsolated = isolatedProject === cat;
              const dimmed = isolatedProject !== null && !isIsolated;
              const color = projectSeries.colorFor(cat, i);
              return (
                <li
                  key={cat}
                  className="border-b border-(--border) last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => toggleIsolate(cat)}
                    title={isIsolated ? `Show all projects` : `Isolate ${cat}`}
                    style={{
                      backgroundImage: `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%)`,
                      backgroundSize: "100% 2px",
                      backgroundPosition: "bottom left",
                      backgroundRepeat: "no-repeat",
                    }}
                    className={`w-full h-10 px-6 flex items-center gap-3 text-left hover:bg-(--gray-100) transition-colors ${
                      dimmed ? "opacity-40" : ""
                    } ${isIsolated ? "bg-(--gray-100)" : ""}`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: color }}
                      aria-hidden
                    />
                    <span className="text-[13px] text-(--text-primary) truncate min-w-0 flex-1">
                      {cat}
                    </span>
                    <span className="mono tabular-nums text-[12px] text-(--text-secondary) shrink-0">
                      {count}
                    </span>
                    <span className="mono tabular-nums text-[12px] text-(--text-tertiary) shrink-0 w-12 text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>

      <WorstDaysCard
        worstDays={worstDays}
        projectSeries={projectSeries}
        isolatedProject={isolatedProject}
      />

    </DashboardChrome>
  );
}

function WorstDaysCard({
  worstDays,
  projectSeries,
  isolatedProject,
}: {
  worstDays: Array<{
    day: string;
    total: number;
    projects: Array<{ cat: string; count: number }>;
  }>;
  projectSeries: {
    categories: string[];
    bucketKey: (project: string) => string;
    colorFor: (cat: string, idx: number) => string;
  };
  isolatedProject: string | null;
}) {
  const maxTotal = worstDays[0]?.total ?? 1;
  // Lookup so each segment is colored by the project's stable legend slot,
  // not by its local position within the day — keeps colors consistent with
  // the chart above.
  const colorOf = (cat: string) => {
    const idx = projectSeries.categories.indexOf(cat);
    return projectSeries.colorFor(cat, idx === -1 ? 0 : idx);
  };

  return (
    <Card>
      <div className="px-6 pt-5 pb-4 border-b border-(--border)">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
          Worst days
        </h2>
        <p className="text-[12px] text-(--text-tertiary) mt-[2px]">
          {worstDays.length === 0
            ? "Nothing to show"
            : `Top ${worstDays.length} ${
                worstDays.length === 1 ? "day" : "days"
              } by failure count, all time${
                isolatedProject ? ` · ${isolatedProject} only` : ""
              }`}
        </p>
      </div>
      {worstDays.length === 0 ? (
        <div className="px-6 py-16 text-center text-[14px] text-(--text-secondary)">
          No failures in this range.{" "}
          <span className="text-(--success)">Nice.</span>
        </div>
      ) : (
        <ul>
          {worstDays.map(({ day, total, projects }) => {
            const date = new Date(day);
            const barWidthPct = (total / maxTotal) * 100;
            return (
              <li
                key={day}
                className="px-6 h-[56px] flex items-center gap-4 border-b border-(--border) last:border-b-0"
              >
                <div className="w-[110px] shrink-0">
                  <div className="mono text-[13px] text-(--text-primary) tabular-nums">
                    {format(date, "MMM d, yyyy")}
                  </div>
                  <div className="text-[11px] text-(--text-tertiary)">
                    {format(date, "EEEE")}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="h-2 rounded-full overflow-hidden flex"
                    style={{ width: `${barWidthPct}%` }}
                    title={projects
                      .map((p) => `${p.cat}: ${p.count}`)
                      .join(" · ")}
                  >
                    {projects.map(({ cat, count }) => (
                      <div
                        key={cat}
                        style={{
                          flex: count,
                          background: colorOf(cat),
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="mono tabular-nums text-[15px] font-semibold text-(--text-primary) shrink-0 w-10 text-right">
                  {total}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <DashboardChrome>
      {/* Stat cards — flex-1/min-w-0 stated on each card explicitly here
          since the real-dashboard `[&>*]:flex-1` selector relies on a class
          generated from another file, and Tailwind v4's purge can be picky
          about same-pulse-class extraction. Belt + suspenders. */}
      <div className="flex flex-row gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5 flex-1 min-w-0">
            <div className="h-3 w-24 bg-(--gray-200) rounded animate-pulse" />
            <div className="mt-3 h-[38px] w-20 bg-(--gray-200) rounded animate-pulse" />
            <div className="mt-1 h-3 w-32 bg-(--gray-100) rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Chart card — header row matches the real header exactly (title +
          subtitle on the left, range toggle on the right). The chart body
          uses the same `px-2 pt-4 pb-2 h-[260px]` outer + a flex bar row
          inset to mimic Recharts' Y-axis (32px) and X-axis (~24px) gutters. */}
      <div className="card mb-6">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-(--border)">
          <div>
            <div className="h-5 w-44 bg-(--gray-200) rounded animate-pulse" />
            <div className="mt-2 h-3 w-32 bg-(--gray-100) rounded animate-pulse" />
          </div>
          <div className="h-7 w-44 bg-(--gray-100) border border-(--border) rounded-lg animate-pulse" />
        </div>
        <div className="px-2 pt-4 pb-2 h-[260px]">
          <div className="h-full flex items-end gap-[3px] pl-8 pr-4 pb-6">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-(--gray-200) rounded-t animate-pulse"
                style={{ height: `${18 + ((i * 41) % 62)}%` }}
              />
            ))}
          </div>
        </div>
        {/* Legend rows — match the real `h-10 px-6` row layout. */}
        <ul className="border-t border-(--border)">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="h-10 px-6 flex items-center gap-3 border-b border-(--border) last:border-b-0"
            >
              <span className="h-2 w-2 rounded-full bg-(--gray-300) shrink-0" />
              <span
                className="h-3 bg-(--gray-200) rounded animate-pulse flex-1"
                style={{ maxWidth: `${140 - i * 20}px` }}
              />
              <span className="h-3 w-6 bg-(--gray-100) rounded animate-pulse" />
              <span className="h-3 w-12 bg-(--gray-100) rounded animate-pulse" />
            </li>
          ))}
        </ul>
      </div>

      {/* Worst days card */}
      <div className="card">
        <div className="px-6 pt-5 pb-4 border-b border-(--border)">
          <div className="h-5 w-32 bg-(--gray-200) rounded animate-pulse" />
          <div className="mt-2 h-3 w-48 bg-(--gray-100) rounded animate-pulse" />
        </div>
        <ul>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li
              key={i}
              className="px-6 h-[56px] flex items-center gap-4 border-b border-(--border) last:border-b-0"
            >
              <div className="w-[110px] shrink-0">
                <div className="h-3 w-24 bg-(--gray-200) rounded animate-pulse" />
                <div className="mt-1.5 h-2 w-16 bg-(--gray-100) rounded animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="h-2 rounded-full bg-(--gray-200) animate-pulse"
                  style={{ width: `${90 - i * 12}%` }}
                />
              </div>
              <div className="h-4 w-8 bg-(--gray-200) rounded animate-pulse shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    </DashboardChrome>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin text-(--text-tertiary)"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Trend = {
  dir: "up" | "down" | "flat";
  pct: number | null;
  periodLabel: string;
};

function StatCard({
  label,
  value,
  unit,
  hint,
  dot,
  monoHint = false,
  trend,
}: {
  label: string;
  value: number;
  unit?: string;
  hint: string;
  dot?: "warn" | "ok";
  monoHint?: boolean;
  trend?: Trend | null;
}) {
  const dotColor =
    dot === "warn" ? "var(--warning)" : dot === "ok" ? "var(--success)" : undefined;
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        {dotColor ? (
          <span
            className="h-[6px] w-[6px] rounded-full"
            style={{ background: dotColor }}
            aria-hidden
          />
        ) : null}
        <div className="text-[12px] uppercase tracking-wider text-(--text-tertiary) font-medium">
          {label}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[32px] font-semibold tracking-[-0.04em] tabular-nums text-(--text-primary) leading-none">
          {value}
        </span>
        {unit ? (
          <span className="text-[14px] text-(--text-secondary)">{unit}</span>
        ) : null}
        {trend ? <TrendChip trend={trend} /> : null}
      </div>
      <div
        className={`mt-2 text-[12px] text-(--text-secondary) truncate ${monoHint ? "mono" : ""}`}
      >
        {hint}
      </div>
    </div>
  );
}

function TrendChip({ trend }: { trend: Trend }) {
  // For failures, "up" is bad → red; "down" is good → green.
  const color =
    trend.dir === "up"
      ? "var(--error)"
      : trend.dir === "down"
      ? "var(--success)"
      : "var(--text-tertiary)";
  const arrow =
    trend.dir === "up" ? "↑" : trend.dir === "down" ? "↓" : "→";
  return (
    <span
      className="text-[12px] mono tabular-nums inline-flex items-center gap-0.5"
      style={{ color }}
      title={`vs previous ${trend.periodLabel}`}
    >
      <span aria-hidden>{arrow}</span>
      {trend.pct !== null ? `${trend.pct}%` : "new"}
    </span>
  );
}

function RangeToggle({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  const opts: Range[] = [7, 30, 365, "all"];
  return (
    <div className="inline-flex items-center rounded-lg border border-(--border) p-[2px] bg-(--bg-100)">
      {opts.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`h-7 px-3 rounded-md text-[12px] mono transition-colors ${
            r === range
              ? "bg-(--gray-200) text-(--text-primary)"
              : "text-(--text-tertiary) hover:text-(--text-primary)"
          }`}
        >
          {r === "all" ? "All" : r === 365 ? "1y" : `${r}d`}
        </button>
      ))}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  range,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  range: Range;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  if (rows.length === 0) return null;
  const total = rows.reduce((s, p) => s + p.value, 0);
  return (
    <div
      className="rounded-lg text-[12px] w-[240px]"
      style={{
        background: "var(--gray-100)",
        border: "1px solid var(--border)",
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)",
      }}
    >
      <div className="px-3 py-2 border-b border-(--border) text-[11px] text-(--text-secondary)">
        {formatTooltipLabel(String(label ?? ""), range)}
      </div>
      <div className="px-3 py-2 flex flex-col gap-1.5">
        {rows.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-[2px] shrink-0"
              style={{ background: entry.color }}
              aria-hidden
            />
            <span className="mono text-[11px] text-(--text-secondary) truncate flex-1 min-w-0">
              {entry.dataKey}
            </span>
            <span className="mono tabular-nums text-(--text-primary) text-[12px] shrink-0">
              {entry.value}
            </span>
          </div>
        ))}
        {rows.length > 1 ? (
          <div className="mt-1 pt-2 border-t border-(--border) flex items-center gap-2">
            <span className="h-2 w-2 shrink-0" aria-hidden />
            <span className="text-[11px] text-(--text-tertiary) flex-1">Total</span>
            <span className="mono tabular-nums text-(--text-primary) text-[12px] font-semibold shrink-0">
              {total}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatTick(date: string, range: Range): string {
  const d = new Date(date);
  if (range === "all") return format(d, "yyyy");
  if (range === 7) return format(d, "EEE");
  return format(d, "MMM d");
}

function formatTooltipLabel(date: string, range: Range): string {
  const d = new Date(date);
  if (range === "all") return format(d, "MMM d, yyyy");
  if (range === 7) return format(d, "EEE, MMM d");
  return format(d, "MMM d, yyyy");
}

type Bucket = { date: string } & Record<string, string | number>;

function buildBuckets(
  events: DeployEvent[],
  range: Range,
  bucketKey: (project: string) => string
): Bucket[] {
  const now = startOfDay(new Date());

  let granularity: "day" | "week" = "day";
  let start: Date;

  if (range === "all") {
    if (events.length === 0) {
      start = subDays(now, 29);
    } else {
      const earliest = startOfDay(new Date(events[events.length - 1].date));
      const spanDays = Math.ceil((now.getTime() - earliest.getTime()) / 86400000);
      if (spanDays > 120) {
        granularity = "week";
        start = startOfWeek(earliest, { weekStartsOn: 1 });
      } else {
        start = earliest;
      }
    }
  } else {
    // Same 120-day threshold as "All": switch to weekly buckets for long
    // ranges so 1y doesn't render 365 razor-thin bars.
    if (range > 120) {
      granularity = "week";
      start = startOfWeek(subDays(now, range - 1), { weekStartsOn: 1 });
    } else {
      start = subDays(now, range - 1);
    }
  }

  const keyOf = (d: Date) =>
    granularity === "week"
      ? format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd")
      : format(startOfDay(d), "yyyy-MM-dd");

  const buckets = new Map<string, Bucket>();
  const step = granularity === "week" ? 7 : 1;
  for (let cur = start; cur.getTime() <= now.getTime(); cur = addDays(cur, step)) {
    const k = keyOf(cur);
    buckets.set(k, { date: k });
  }

  for (const e of events) {
    const k = keyOf(new Date(e.date));
    const b = buckets.get(k);
    if (!b) continue;
    const cat = bucketKey(e.project);
    b[cat] = ((b[cat] as number | undefined) ?? 0) + 1;
  }

  return [...buckets.values()];
}
