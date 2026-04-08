import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  ImagePlus,
  LayoutDashboard,
  Layers3,
  MapPinned,
  Megaphone,
  MoreHorizontal,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";
const ADMIN_API_KEY =
  import.meta.env.VITE_ADMIN_API_KEY?.trim() ||
  import.meta.env.VITE_BACKEND_ADMIN_API_KEY?.trim() ||
  "";

const statCards = [
  {
    key: "totalPois",
    title: "Total POIs",
    icon: MapPinned,
    gradient: "from-orange-500 to-rose-500",
  },
  {
    key: "publishedPois",
    title: "Published POIs",
    icon: ShieldCheck,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    key: "needsAudioPois",
    title: "Needs audio",
    icon: Megaphone,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    key: "syncVersion",
    title: "Sync version",
    icon: Layers3,
    gradient: "from-sky-500 to-cyan-500",
  },
];

const pipelineCards = [
  {
    key: "contentReview",
    label: "Content review",
  },
  {
    key: "audioGeneration",
    label: "Audio generation",
  },
  {
    key: "imageUploads",
    label: "Image uploads",
  },
];

const healthChecks = [
  {
    key: "backendApi",
    label: "Backend API",
    icon: Gauge,
  },
  {
    key: "adminAuth",
    label: "Admin auth",
    icon: ShieldCheck,
  },
  {
    key: "ttsQueue",
    label: "TTS queue",
    icon: Megaphone,
  },
  {
    key: "syncManifest",
    label: "Sync manifest",
    icon: ImagePlus,
  },
];

const shortcuts = [
  {
    title: "Create POI",
    description: "Add a new narration point with multilingual text.",
    icon: MapPinned,
  },
  {
    title: "Publish tour",
    description: "Push a curated route to the live map.",
    icon: Layers3,
  },
  {
    title: "Generate audio",
    description: "Queue TTS generation for the latest content.",
    icon: Megaphone,
  },
  {
    title: "View reports",
    description: "Inspect analytics, sync health, and exports.",
    icon: FileText,
  },
];

function DashboardMetric({ title, value, delta, icon, gradient }) {
  const MetricIcon = icon;

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/60">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-white/55">{delta}</p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${gradient} text-white shadow-lg shadow-black/20`}
        >
          <MetricIcon size={22} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ tone, children }) {
  const toneMap = {
    amber: "border-amber-400/30 bg-amber-400/12 text-amber-100",
    emerald: "border-emerald-400/30 bg-emerald-400/12 text-emerald-100",
    rose: "border-rose-400/30 bg-rose-400/12 text-rose-100",
    slate: "border-white/15 bg-white/8 text-white/70",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneMap[tone] ?? toneMap.slate}`}
    >
      {children}
    </span>
  );
}

function buildApiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL.replace(/\/+$/, "")}${cleanPath}`;
}

async function fetchJson(path, options = {}) {
  const { method = "GET", headers = {}, body } = options;
  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      ...headers,
    },
    body,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload?.message || payload?.error || message;
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }

    throw new Error(message);
  }

  return response.json();
}

function getStoredToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("token")?.trim() || "";
}

function pickLocalizedText(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    const record = value;
    const preferred = record.vi || record.en;
    if (typeof preferred === "string" && preferred.trim()) {
      return preferred.trim();
    }

    const firstText = Object.values(record).find(
      (item) => typeof item === "string" && item.trim(),
    );
    if (typeof firstText === "string") {
      return firstText.trim();
    }
  }

  return String(value);
}

function hasAudioUrls(audioUrls) {
  if (!audioUrls || typeof audioUrls !== "object") {
    return false;
  }

  return Object.values(audioUrls).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

function formatRelativeTime(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getPoiStatusTone(poi) {
  if (!poi.isPublished) {
    return "slate";
  }

  if (!hasAudioUrls(poi.audioUrls)) {
    return "rose";
  }

  return "emerald";
}

function getPoiStatusLabel(poi) {
  if (!poi.isPublished) {
    return "Draft";
  }

  if (!hasAudioUrls(poi.audioUrls)) {
    return "Needs audio";
  }

  return "Published";
}

export default function AdminDashboard() {
  const [adminPois, setAdminPois] = useState([]);
  const [ttsQueueStatus, setTtsQueueStatus] = useState(null);
  const [ttsValidation, setTtsValidation] = useState(null);
  const [syncManifest, setSyncManifest] = useState(null);
  const [analyticsStats, setAnalyticsStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const storedToken = getStoredToken();

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setIsLoading(true);
      setLoadError("");

      if (!ADMIN_API_KEY) {
        if (!cancelled) {
          setLoadError(
            "Thiếu VITE_ADMIN_API_KEY nên chưa thể tải dữ liệu admin thật.",
          );
          setIsLoading(false);
        }
        return;
      }

      const adminHeaders = { "x-admin-api-key": ADMIN_API_KEY };
      const bearerHeaders = storedToken
        ? { Authorization: `Bearer ${storedToken}` }
        : null;

      const adminRequests = await Promise.allSettled([
        fetchJson("/api/v1/admin/pois", { headers: adminHeaders }),
        fetchJson("/api/v1/admin/tts/queue/status", { headers: adminHeaders }),
        fetchJson("/api/v1/admin/tts/config/validate", {
          headers: adminHeaders,
        }),
      ]);

      const errors = [];

      if (adminRequests[0].status === "fulfilled") {
        setAdminPois(adminRequests[0].value.items ?? []);
      } else {
        setAdminPois([]);
        errors.push(`POIs: ${adminRequests[0].reason.message}`);
      }

      if (adminRequests[1].status === "fulfilled") {
        setTtsQueueStatus(adminRequests[1].value);
      } else {
        setTtsQueueStatus(null);
        errors.push(`TTS queue: ${adminRequests[1].reason.message}`);
      }

      if (adminRequests[2].status === "fulfilled") {
        setTtsValidation(adminRequests[2].value);
      } else {
        setTtsValidation(null);
        errors.push(`TTS config: ${adminRequests[2].reason.message}`);
      }

      if (bearerHeaders) {
        const userRequests = await Promise.allSettled([
          fetchJson("/api/v1/sync/manifest", { headers: bearerHeaders }),
          fetchJson("/api/v1/analytics/stats", { headers: bearerHeaders }),
        ]);

        if (userRequests[0].status === "fulfilled") {
          setSyncManifest(userRequests[0].value);
        } else {
          setSyncManifest(null);
          errors.push(`Sync manifest: ${userRequests[0].reason.message}`);
        }

        if (userRequests[1].status === "fulfilled") {
          setAnalyticsStats(userRequests[1].value.data ?? null);
        } else {
          setAnalyticsStats(null);
          errors.push(`Analytics: ${userRequests[1].reason.message}`);
        }
      } else {
        setSyncManifest(null);
        setAnalyticsStats(null);
      }

      if (!cancelled) {
        setLoadError(errors.length > 0 ? errors.join(" • ") : "");
        setIsLoading(false);
      }
    }

    loadDashboard().catch((error) => {
      if (!cancelled) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Không tải được dữ liệu admin.",
        );
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reloadTick, storedToken]);

  const totalPois = adminPois.length;
  const publishedPois = adminPois.filter((poi) => poi.isPublished).length;
  const imageReadyPois = adminPois.filter((poi) => Boolean(poi.image)).length;
  const audioReadyPois = adminPois.filter((poi) =>
    hasAudioUrls(poi.audioUrls),
  ).length;
  const needsAudioPois = totalPois - audioReadyPois;
  const syncVersion =
    syncManifest?.contentVersion ??
    adminPois.reduce(
      (highestVersion, poi) =>
        Math.max(highestVersion, Number(poi.contentVersion ?? 0)),
      0,
    );
  const totalTours = syncManifest?.totalTours ?? 0;
  const queueWaiting = ttsQueueStatus?.waiting ?? 0;
  const queueActive = ttsQueueStatus?.active ?? 0;
  const queueMode = ttsQueueStatus?.mode ?? "unknown";
  const queueTotal = queueWaiting + queueActive;
  const ttsWarnings = ttsValidation?.warnings?.length ?? 0;
  const ttsErrors = ttsValidation?.errors?.length ?? 0;

  const dashboardStats = statCards.map((card) => {
    if (card.key === "totalPois") {
      return {
        ...card,
        value: formatNumber(totalPois),
        delta: `${formatNumber(totalTours)} tours in manifest`,
      };
    }

    if (card.key === "publishedPois") {
      return {
        ...card,
        value: formatNumber(publishedPois),
        delta: totalPois
          ? `${Math.round((publishedPois / totalPois) * 100)}% of content published`
          : "No POIs loaded yet",
      };
    }

    if (card.key === "needsAudioPois") {
      return {
        ...card,
        value: formatNumber(needsAudioPois),
        delta: totalPois
          ? `${formatNumber(audioReadyPois)} items already have audio`
          : "No POIs loaded yet",
      };
    }

    return {
      ...card,
      value: syncVersion ? `v${syncVersion}` : "N/A",
      delta: syncManifest?.lastUpdatedAt
        ? `Updated ${formatRelativeTime(syncManifest.lastUpdatedAt)}`
        : "Sync manifest not loaded",
    };
  });

  const pipelineItems = pipelineCards.map((card) => {
    if (card.key === "contentReview") {
      return {
        ...card,
        progress: totalPois ? Math.round((publishedPois / totalPois) * 100) : 0,
        note: `${formatNumber(totalPois - publishedPois)} POIs waiting for moderation`,
      };
    }

    if (card.key === "audioGeneration") {
      return {
        ...card,
        progress: totalPois
          ? Math.round((audioReadyPois / totalPois) * 100)
          : 0,
        note: `${formatNumber(needsAudioPois)} POIs still need audio`,
      };
    }

    return {
      ...card,
      progress: totalPois ? Math.round((imageReadyPois / totalPois) * 100) : 0,
      note: `${formatNumber(imageReadyPois)}/${formatNumber(totalPois)} POIs have images`,
    };
  });

  const systemChecks = healthChecks.map((item) => {
    if (item.key === "backendApi") {
      return {
        ...item,
        status: API_BASE_URL,
        subtitle: "Backend base URL",
        tone: "emerald",
      };
    }

    if (item.key === "adminAuth") {
      return {
        ...item,
        status: ADMIN_API_KEY ? "Configured" : "Missing key",
        subtitle: ADMIN_API_KEY
          ? "Admin access is enabled"
          : "Set VITE_ADMIN_API_KEY",
        tone: ADMIN_API_KEY ? "emerald" : "rose",
      };
    }

    if (item.key === "ttsQueue") {
      return {
        ...item,
        status: ttsQueueStatus
          ? `${queueMode} / ${queueTotal} jobs`
          : "Unavailable",
        subtitle: ttsValidation
          ? `${ttsWarnings} warnings, ${ttsErrors} errors`
          : "TTS config not loaded",
        tone: ttsQueueStatus ? "amber" : "slate",
      };
    }

    return {
      ...item,
      status: syncManifest ? `v${syncManifest.contentVersion}` : "Unavailable",
      subtitle: syncManifest
        ? `${formatNumber(syncManifest.totalPois)} POIs • ${formatNumber(syncManifest.totalTours)} tours`
        : "Requires bearer token",
      tone: syncManifest ? "emerald" : "slate",
    };
  });

  const queueRows = adminPois.slice(0, 6).map((poi) => ({
    type: poi.type || "POI",
    name: pickLocalizedText(poi.name) || "Untitled POI",
    version: `v${poi.contentVersion ?? 1}`,
    status: getPoiStatusLabel(poi),
    updated: formatRelativeTime(poi.updatedAt),
    tone: getPoiStatusTone(poi),
  }));

  const latestUpdatedLabel = adminPois[0]?.updatedAt
    ? formatRelativeTime(adminPois[0].updatedAt)
    : "No POIs loaded";

  return (
    <div className="relative min-h-full overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.20),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[48px_48px] opacity-35" />
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-orange-500/18 blur-3xl" />
      <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative z-10 flex min-h-full">
        <aside className="hidden xl:flex w-80 flex-col gap-6 border-r border-white/10 bg-slate-950/55 p-6 backdrop-blur-xl">
          <div className="rounded-[30px] border border-white/10 bg-white/6 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-orange-500 to-rose-500 shadow-lg shadow-orange-500/25">
                <UtensilsCrossed size={22} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/45">
                  Admin console
                </p>
                <h2 className="text-xl font-black text-white">Phố Ẩm Thực</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={16} />
                  Backend connected
                </span>
                <span>
                  {syncManifest ? `v${syncManifest.contentVersion}` : "Live"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/70">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Clock3 size={16} />
                  Last loaded
                </span>
                <span>{latestUpdatedLabel}</span>
              </div>
            </div>
          </div>

          <nav className="rounded-[30px] border border-white/10 bg-white/6 p-3 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
            {[
              { label: "Overview", icon: LayoutDashboard, active: true },
              { label: "Content queue", icon: FileText },
              { label: "Media library", icon: ImagePlus },
              { label: "Sync versioning", icon: Layers3 },
              { label: "Analytics", icon: BarChart3 },
              { label: "Settings", icon: Settings2 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition last:mb-0 ${
                    item.active
                      ? "bg-linear-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20"
                      : "text-white/65 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="rounded-[30px] border border-white/10 bg-white/6 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
              Quick health
            </p>
            <div className="mt-4 space-y-3">
              {systemChecks.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/10 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-orange-300">
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-white/45">{item.subtitle}</p>
                      </div>
                    </div>
                    <StatusPill tone={item.tone}>{item.status}</StatusPill>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 xl:px-8 xl:py-6">
          <section className="rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-2xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-100">
                  <Sparkles size={12} />
                  Admin dashboard
                </p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Command center for POIs, tours, and audio operations.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65 md:text-lg">
                  Monitor publishing, manage content, check sync health, and
                  keep narration assets ready for the map experience.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/12"
                >
                  Open map
                </Link>
                <button
                  type="button"
                  onClick={() => setReloadTick((tick) => tick + 1)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-orange-500 to-rose-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-105"
                >
                  <ArrowUpRight size={16} />
                  Refresh data
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <div className="relative min-w-0">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                  size={18}
                />
                <input
                  type="search"
                  placeholder="Search POIs, tours, users, or content versions"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/55 py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-white/35 outline-none ring-0 transition focus:border-orange-300/40 focus:bg-slate-950/75"
                />
              </div>
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/12"
              >
                {isLoading ? "Loading" : "Filters"}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/12"
              >
                Export
              </button>
            </div>
          </section>

          {loadError && (
            <section className="mt-6 rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100 backdrop-blur-xl">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">Backend data warning</p>
                  <p className="mt-1 text-rose-100/80">{loadError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReloadTick((tick) => tick + 1)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-2 font-semibold text-rose-100 transition hover:bg-rose-300/15"
                >
                  Retry
                </button>
              </div>
            </section>
          )}

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboardStats.map((item) => (
              <DashboardMetric key={item.title} {...item} />
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <div className="rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                    Publishing pipeline
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Operational flow
                  </h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  <CheckCircle2 size={13} />
                  Stable
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {pipelineItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[26px] border border-white/8 bg-black/10 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm text-white/50">
                          {item.note}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-white">
                        {item.progress}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-orange-500 to-rose-500"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[26px] border border-white/8 bg-black/10 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">
                      Queue throughput
                    </p>
                    <span className="text-xs text-emerald-300">+18%</span>
                  </div>
                  <div className="mt-4 flex items-end gap-2">
                    {[38, 52, 46, 61, 58, 74, 88].map((value, index) => (
                      <div key={value} className="flex-1">
                        <div
                          className="rounded-t-2xl bg-linear-to-t from-orange-500 to-amber-300"
                          style={{
                            height: `${value}px`,
                            opacity: 0.55 + index * 0.06,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[26px] border border-white/8 bg-black/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <CalendarClock size={16} className="text-orange-300" />
                    Today’s schedule
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <div className="flex items-center justify-between rounded-2xl bg-white/6 px-3 py-2">
                      <span>10:00 Content review</span>
                      <span className="text-white/45">30m</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/6 px-3 py-2">
                      <span>13:30 TTS batch publish</span>
                      <span className="text-white/45">45m</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/6 px-3 py-2">
                      <span>16:00 Analytics sync</span>
                      <span className="text-white/45">20m</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                      Quick actions
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Shortcuts
                    </h2>
                  </div>
                  <MoreHorizontal className="text-white/45" size={18} />
                </div>

                <div className="mt-5 grid gap-3">
                  {shortcuts.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.title}
                        type="button"
                        className="group flex items-start gap-4 rounded-[26px] border border-white/8 bg-black/10 p-4 text-left transition hover:border-orange-300/30 hover:bg-white/8"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-semibold text-white">
                              {item.title}
                            </p>
                            <ArrowUpRight
                              className="text-white/35 transition group-hover:text-orange-200"
                              size={16}
                            />
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-white/55">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                      System snapshot
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Live health
                    </h2>
                  </div>
                  <Bell className="text-orange-300" size={18} />
                </div>

                <div className="mt-5 space-y-3">
                  {systemChecks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-3xl border border-white/8 bg-black/10 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-orange-300">
                            <Icon size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {item.label}
                            </p>
                            <p className="text-xs text-white/45">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                        <StatusPill tone={item.tone}>{item.status}</StatusPill>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-[26px] border border-white/8 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Usage pulse
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {analyticsStats
                          ? "Live analytics from backend"
                          : "Bearer token required"}
                      </p>
                    </div>
                    <BarChart3 className="text-orange-300" size={18} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-white/6 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Plays
                      </p>
                      <p className="mt-1 text-xl font-black text-white">
                        {analyticsStats
                          ? formatNumber(analyticsStats.plays ?? 0)
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/6 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                        QR scans
                      </p>
                      <p className="mt-1 text-xl font-black text-white">
                        {analyticsStats
                          ? formatNumber(analyticsStats.qrScans ?? 0)
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-[34px] border border-white/10 bg-white/6 p-5 md:p-6 backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                  Content queue
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  Ready for review
                </h2>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/12"
              >
                <Settings2 size={16} />
                Table settings
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-[28px] border border-white/8 bg-black/10">
              <div className="grid grid-cols-[0.8fr_2fr_0.7fr_0.9fr_0.9fr_1fr] gap-3 border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                <span>Type</span>
                <span>Name</span>
                <span>Version</span>
                <span>Status</span>
                <span>Updated</span>
                <span className="text-right">Action</span>
              </div>

              <div className="divide-y divide-white/8">
                {queueRows.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-white/55">
                    No POIs loaded from backend yet.
                  </div>
                ) : (
                  queueRows.map((item) => (
                    <div
                      key={`${item.type}-${item.name}`}
                      className="grid grid-cols-[0.8fr_2fr_0.7fr_0.9fr_0.9fr_1fr] items-center gap-3 px-4 py-4 text-sm"
                    >
                      <div className="font-semibold text-white/80">
                        {item.type}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="mt-1 text-xs text-white/45">
                          Multilingual content record
                        </p>
                      </div>
                      <div className="text-white/60">{item.version}</div>
                      <div>
                        <StatusPill tone={item.tone}>{item.status}</StatusPill>
                      </div>
                      <div className="text-white/60">{item.updated}</div>
                      <div className="text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/12"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/55">
              <span>
                {formatNumber(totalPois)} POIs loaded •{" "}
                {formatNumber(totalTours)} tours in manifest
              </span>
              <span>
                TTS queue: {queueMode} / {queueTotal} jobs active
              </span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
