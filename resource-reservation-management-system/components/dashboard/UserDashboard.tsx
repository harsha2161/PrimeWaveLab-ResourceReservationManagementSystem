"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Hourglass,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  UserRound,
  UsersRound,
  Waves,
  Wrench,
  X,
  XCircle,
} from "lucide-react";

type Section = "home" | "profile" | "resources" | "bookings";
type Envelope<T> = { success: boolean; data: T; error?: string };
type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "USER" | "ADMIN";
  createdAt: string;
};
type Resource = {
  id: string;
  name: string;
  code: string;
  description: string;
  location: string | null;
  maxCapacity: number | null;
  status: "ACTIVE" | "WAITING" | "INACTIVE";
  resourceCategory: { name: string };
};
type Reservation = {
  id: string;
  title: string | null;
  resourceId: string;
  StartTime: string;
  Endtime: string;
  status: "PENDING" | "COMFORMED";
  cancelledAt: string | null;
  resource: { id: string; name: string; code: string; location: string | null } | null;
};
type Maintenance = {
  id: string;
  resourceId: string;
  description: string;
  startTime: string;
  endTime: string;
  maintenancestatus: "INPROGRESS" | "COMPLETE";
};

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, credentials: "same-origin" });
  const body = (await response.json().catch(() => ({}))) as Partial<Envelope<T>>;
  if (!response.ok || !body.success) {
    const error = new Error(body.error || "Could not load your workspace.") as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return body.data as T;
}

function formatDate(value: string, time = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", time
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function bookingStatus(reservation: Reservation) {
  if (reservation.cancelledAt) return { label: "Cancelled", className: "user-status-cancelled [color:#a85b52] [background:#fff0ee]", Icon: XCircle };
  if (reservation.status === "COMFORMED") return { label: "Booking complete", className: "user-status-confirmed [color:#38815e] [background:#edf8f1]", Icon: CheckCircle2 };
  return { label: "Pending", className: "user-status-pending [color:#a77734] [background:#fff5e5]", Icon: Hourglass };
}

function resourceStatus(status: Resource["status"]) {
  if (status === "ACTIVE") return { label: "Available", className: "user-status-confirmed [color:#38815e] [background:#edf8f1]" };
  if (status === "WAITING") return { label: "In use", className: "user-status-pending [color:#a77734] [background:#fff5e5]" };
  return { label: "Unavailable", className: "user-status-cancelled [color:#a85b52] [background:#fff0ee]" };
}

export default function UserDashboard() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("home");
  const [user, setUser] = useState<User | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [bookingResource, setBookingResource] = useState<Resource | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [cancellingId, setCancellingId] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setError("");
    const profile = await request<User>("/api/auth/me");
    if (profile.role === "ADMIN") {
      router.replace("/admin");
      return;
    }
    const [resourceData, bookingData, maintenanceData] = await Promise.all([
      request<{ resources: Resource[] }>("/api/resources"),
      request<{ reservations: Reservation[] }>("/api/reservations"),
      request<{ maintenances: Maintenance[] }>("/api/maintenance"),
    ]);
    setUser(profile);
    setResources(resourceData.resources ?? []);
    setBookings(bookingData.reservations ?? []);
    setMaintenance(maintenanceData.maintenances ?? []);
  }, [router]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        await loadDashboard();
      } catch (cause) {
        const failure = cause as Error & { status?: number };
        if (failure.status === 401) {
          router.replace("/login");
          return;
        }
        if (active) setError(failure.message || "Could not load your dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [loadDashboard, router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void request<{ reservations: Reservation[] }>("/api/reservations")
        .then((data) => setBookings(data.reservations ?? []))
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const latestBookings = useMemo(() => bookings.slice(0, 4), [bookings]);
  const maintenanceByResource = useMemo(() => {
    const result = new Map<string, Maintenance>();
    for (const record of maintenance) {
      const current = result.get(record.resourceId);
      if (!current || (record.maintenancestatus === "INPROGRESS" && current.maintenancestatus !== "INPROGRESS")) {
        result.set(record.resourceId, record);
      }
    }
    return result;
  }, [maintenance]);
  const availableCount = resources.filter((resource) => resource.status === "ACTIVE").length;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingResource) return;
    const formData = new FormData(event.currentTarget);
    const startTime = new Date(String(formData.get("startTime") ?? ""));
    const endTime = new Date(String(formData.get("endTime") ?? ""));
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
      setError("Choose a valid start and end time. The end time must be later than the start time.");
      return;
    }

    setBookingBusy(true);
    setError("");
    setNotice("");
    try {
      await request("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: bookingResource.id,
          title: String(formData.get("title") ?? "").trim() || undefined,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });
      await loadDashboard();
      setBookingResource(null);
      setSection("bookings");
      setNotice("Booking request sent. It will show as complete after an administrator confirms it.");
    } catch (cause) {
      const failure = cause as Error & { status?: number };
      if (failure.status === 401) {
        router.replace("/login");
        return;
      }
      setError(failure.message || "Could not submit your booking request.");
    } finally {
      setBookingBusy(false);
    }
  }

  async function cancelBooking(booking: Reservation) {
    if (!window.confirm(`Cancel your booking for “${booking.resource?.name ?? "this resource"}”?`)) return;
    setError("");
    setNotice("");
    setCancellingId(booking.id);
    try {
      await request(`/api/reservations/${encodeURIComponent(booking.id)}`, { method: "DELETE" });
      await loadDashboard();
      setNotice("Booking cancelled successfully.");
    } catch (cause) {
      const failure = cause as Error & { status?: number };
      if (failure.status === 401) {
        router.replace("/login");
        return;
      }
      setError(failure.message || "Could not cancel this booking.");
    } finally {
      setCancellingId("");
    }
  }

  if (loading) return <main className="user-loading [min-height:100vh] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [gap:11px] [color:#7a8a90] [background:#f6f8f7] [&_p]:[margin:0] [&_p]:[font-size:11px]"><span className="user-loader [width:40px] [height:40px] [display:grid] [place-items:center] [border-radius:12px] [color:#13817d] [background:#e5f4f0] [&_svg]:animate-spin"><RefreshCw size={20} /></span><p>Opening your workspace…</p></main>;

  return (
    <main className="user-workspace [min-height:100vh] [color:#263b49] [background:#f6f8f7] motion-reduce:[&_*]:[scroll-behavior:auto]! motion-reduce:[&_*]:[transition-duration:.01ms]! motion-reduce:[&_*]:[animation-duration:.01ms]! motion-reduce:[&_*]:[animation-iteration-count:1]! motion-reduce:[&_*::before]:[scroll-behavior:auto]! motion-reduce:[&_*::before]:[transition-duration:.01ms]! motion-reduce:[&_*::before]:[animation-duration:.01ms]! motion-reduce:[&_*::before]:[animation-iteration-count:1]! motion-reduce:[&_*::after]:[scroll-behavior:auto]! motion-reduce:[&_*::after]:[transition-duration:.01ms]! motion-reduce:[&_*::after]:[animation-duration:.01ms]! motion-reduce:[&_*::after]:[animation-iteration-count:1]!">
      <header className="user-header [height:72px] [display:flex] [align-items:center] [gap:46px] [padding:0_max(32px,_calc((100vw_-_1220px)_/_2))] [border-bottom:1px_solid_#e8edec] [background:#fff] max-[900px]:[gap:22px] max-[900px]:[padding-right:22px] max-[900px]:[padding-left:22px] max-[620px]:[height:auto] max-[620px]:[min-height:62px] max-[620px]:[flex-wrap:wrap] max-[620px]:[gap:0] max-[620px]:[padding:11px_15px_0]">
        <a className="user-brand [display:inline-flex] [align-items:center] [gap:9px] [flex:0_0_auto] [color:#263c47] [text-decoration:none] [font-size:16px] [font-weight:750] [letter-spacing:-.55px] [&>_span:last-child_>_span]:[color:#16837d] [&>_span:last-child_>_span]:[font-weight:550] max-[620px]:[height:38px] max-[620px]:[font-size:14px]" href="/dashboard" aria-label="PrimeWave Lab dashboard">
          <span className="user-brand-mark [width:34px] [height:34px] [display:grid] [place-items:center] [border-radius:10px] [color:#fff] [background:linear-gradient(145deg,_#0b8e87,_#086c77)] [box-shadow:0_4px_9px_rgba(7,_113,_119,_.15)] max-[620px]:[width:29px] max-[620px]:[height:29px]"><Waves size={19} /></span>
          <span>primewave<span>lab</span></span>
        </a>
        <nav className="user-nav [height:100%] [display:flex] [align-items:center] [gap:7px] [flex:1] [&_button]:[height:100%] [&_button]:[position:relative] [&_button]:[display:inline-flex] [&_button]:[align-items:center] [&_button]:[gap:7px] [&_button]:[padding:0_13px] [&_button]:[border:0] [&_button]:[color:#71818a] [&_button]:[background:transparent] [&_button]:[font-size:11px] [&_button]:[font-weight:600] [&_button]:[cursor:pointer] [&_button]:[transition:color_.15s_ease] [&_button:hover]:[color:#087d7d] [&_button.user-nav-active]:[color:#087d7d] [&_button.user-nav-active::after]:[content:&quot;&quot;] [&_button.user-nav-active::after]:[position:absolute] [&_button.user-nav-active::after]:[right:13px] [&_button.user-nav-active::after]:[bottom:0] [&_button.user-nav-active::after]:[left:13px] [&_button.user-nav-active::after]:[height:2px] [&_button.user-nav-active::after]:[border-radius:2px_2px_0_0] [&_button.user-nav-active::after]:[background:#138984] max-[900px]:[gap:0] max-[900px]:[&_button]:[padding-right:9px] max-[900px]:[&_button]:[padding-left:9px] max-[900px]:[&_button.user-nav-active::after]:[right:9px] max-[900px]:[&_button.user-nav-active::after]:[left:9px] max-[620px]:[width:calc(100%_+_30px)] max-[620px]:[height:43px] max-[620px]:[flex:0_0_calc(100%_+_30px)] max-[620px]:[order:2] max-[620px]:[overflow-x:auto] max-[620px]:[margin:9px_-15px_0] max-[620px]:[padding:0_8px] max-[620px]:[border-top:1px_solid_#f0f2f2] max-[620px]:[scrollbar-width:none] max-[620px]:[&::-webkit-scrollbar]:[display:none] max-[620px]:[&_button]:[height:43px] max-[620px]:[&_button]:[flex:0_0_auto] max-[620px]:[&_button]:[font-size:9px] max-[620px]:[&_button.user-nav-active::after]:[bottom:0]" aria-label="Dashboard navigation">
          <button className={section === "home" ? "user-nav-active" : ""} onClick={() => setSection("home")} type="button">Overview</button>
          <button className={section === "profile" ? "user-nav-active" : ""} onClick={() => setSection("profile")} type="button"><UserRound size={15} /> My profile</button>
          <button className={section === "resources" ? "user-nav-active" : ""} onClick={() => setSection("resources")} type="button"><DoorOpen size={15} /> Resources</button>
          <button className={section === "bookings" ? "user-nav-active" : ""} onClick={() => setSection("bookings")} type="button"><CalendarDays size={15} /> My bookings{bookings.length > 0 && <span className="user-nav-count [min-width:18px] [height:18px] [display:grid] [place-items:center] [padding:0_4px] [border-radius:6px] [color:#8c6c37] [background:#fff4df] [font-size:8px] [font-weight:750]">{bookings.length}</span>}</button>
        </nav>
        <div className="user-header-account [display:flex] [align-items:center] [gap:12px] max-[620px]:[margin-left:auto]">
          {user && <span className="user-account-name [color:#546670] [font-size:10px] [font-weight:650] [white-space:nowrap] max-[620px]:[max-width:110px] max-[620px]:[overflow:hidden] max-[620px]:[font-size:9px] max-[620px]:[text-overflow:ellipsis] max-[620px]:[white-space:nowrap]">{user.firstName} {user.lastName}</span>}
          <button className="user-logout [width:34px] [height:34px] [display:grid] [place-items:center] [border:1px_solid_#e7eceb] [border-radius:9px] [color:#7d8b91] [background:#fff] [cursor:pointer] [transition:color_.15s_ease,_border-color_.15s_ease] hover:[border-color:#ebcfcb] hover:[color:#b6534a] max-[620px]:[width:30px] max-[620px]:[height:30px]" type="button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      <div className="user-page-content [width:min(1120px,_calc(100%_-_56px))] [min-height:calc(100vh_-_132px)] [margin:0_auto] [padding:37px_0_55px] max-[900px]:[width:min(100%_-_42px,_760px)] max-[620px]:[width:calc(100%_-_30px)] max-[620px]:[min-height:calc(100vh_-_165px)] max-[620px]:[padding:25px_0_37px]">
        <div className="user-page-heading [display:flex] [align-items:flex-end] [justify-content:space-between] [gap:20px] [margin-bottom:24px] [&_h1]:[margin:7px_0_0] [&_h1]:[color:#213744] [&_h1]:[font-size:26px] [&_h1]:[font-weight:700] [&_h1]:[letter-spacing:-.9px] [&_p]:[margin:7px_0_0] [&_p]:[color:#85939a] [&_p]:[font-size:11px] max-[620px]:[align-items:flex-start] max-[620px]:[margin-bottom:18px] max-[620px]:[&_h1]:[font-size:22px] max-[620px]:[&_p]:[max-width:270px] max-[620px]:[&_p]:[line-height:1.5]">
          <div>
            <span className="user-eyebrow [color:#15827e] [font-size:9px] [font-weight:760] [letter-spacing:1.15px]">YOUR PRIMEWAVE WORKSPACE</span>
            <h1>{section === "home" ? `Welcome back${user ? `, ${user.firstName}` : ""}` : section === "profile" ? "Your profile" : section === "resources" ? "Explore resources" : "Your bookings"}</h1>
            <p>{section === "home" ? "Find a space for your next great idea." : section === "profile" ? "Your account information and contact details." : section === "resources" ? "Browse the spaces and equipment available to you." : "Keep track of your latest reservation requests."}</p>
          </div>
          <button className="user-refresh [height:34px] [display:inline-flex] [align-items:center] [gap:7px] [padding:0_11px] [border:1px_solid_#e1e9e7] [border-radius:8px] [color:#64767f] [background:#fff] [font-size:10px] [font-weight:620] [cursor:pointer] hover:[border-color:#c6ded9] hover:[color:#137d79] max-[620px]:[width:32px] max-[620px]:[height:32px] max-[620px]:[justify-content:center] max-[620px]:[flex:0_0_auto] max-[620px]:[overflow:hidden] max-[620px]:[padding:0] max-[620px]:[font-size:0]" type="button" onClick={() => { setLoading(true); void loadDashboard().catch((cause) => setError(cause instanceof Error ? cause.message : "Refresh failed.")).finally(() => setLoading(false)); }}><RefreshCw size={15} /> Refresh</button>
        </div>

        {error && <div className="user-error [display:flex] [align-items:center] [gap:9px] [margin-bottom:16px] [padding:11px_13px] [border:1px_solid_#efd4d0] [border-radius:9px] [color:#934c44] [background:#fff8f7] [font-size:10px] [&>_span]:[width:17px] [&>_span]:[height:17px] [&>_span]:[display:grid] [&>_span]:[place-items:center] [&>_span]:[border-radius:50%] [&>_span]:[color:#fff] [&>_span]:[background:#c66b60] [&>_span]:[font-weight:750]" role="alert"><span>!</span>{error}</div>}
        {notice && <div className="user-notice [display:flex] [align-items:center] [gap:9px] [margin-bottom:16px] [padding:11px_13px] [border:1px_solid_#cde8dc] [border-radius:9px] [color:#347153] [background:#f3fbf7] [font-size:10px] [line-height:1.45] [&>_svg]:[flex:0_0_auto] [&>_button]:[display:grid] [&>_button]:[place-items:center] [&>_button]:[margin-left:auto] [&>_button]:[padding:2px] [&>_button]:[border:0] [&>_button]:[color:currentColor] [&>_button]:[background:transparent] [&>_button]:[cursor:pointer]" role="status"><CheckCircle2 size={16} /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button></div>}

        {section === "home" && (
          <>
            <div className="user-welcome-card [min-height:207px] [position:relative] [display:flex] [align-items:center] [justify-content:space-between] [overflow:hidden] [padding:29px_36px] [border-radius:16px] [color:#f5fffd] [background:linear-gradient(112deg,_#123c49,_#087a78)] [box-shadow:0_10px_24px_rgba(9,_80,_82,_.11)] [&>_div:first-child]:[position:relative] [&>_div:first-child]:[z-index:1] [&_h2]:[margin:12px_0_8px] [&_h2]:[color:#fff] [&_h2]:[font-size:24px] [&_h2]:[font-weight:680] [&_h2]:[letter-spacing:-.7px] [&_p]:[margin:0] [&_p]:[color:rgba(237,_255,_251,_.75)] [&_p]:[font-size:11px] max-[620px]:[min-height:195px] max-[620px]:[padding:23px_20px] max-[620px]:[&_h2]:[max-width:245px] max-[620px]:[&_h2]:[font-size:20px] max-[620px]:[&_h2]:[line-height:1.2] max-[620px]:[&_p]:[max-width:230px] max-[620px]:[&_p]:[line-height:1.5]">
              <div><span className="user-welcome-kicker [color:#15827e] [font-size:9px] [font-weight:760] [letter-spacing:1.15px] [color:#a0e3da]">A GOOD DAY TO GET THINGS DONE</span><h2>Your next idea needs a place.</h2><p>Explore available resources and keep your bookings close at hand.</p><button type="button" className="user-welcome-action [display:inline-flex] [align-items:center] [gap:7px] [margin-top:20px] [padding:0] [border:0] [color:#a9eee2] [background:transparent] [font-size:10px] [font-weight:700] [cursor:pointer] hover:[color:#fff]" onClick={() => setSection("resources")}>Explore resources <ArrowRight size={16} /></button></div>
              <div className="user-welcome-art [width:215px] [height:180px] [position:absolute] [top:8px] [right:17px] [display:grid] [place-items:center] [color:rgba(221,_255,_249,_.82)] [&>_svg]:[position:relative] [&>_svg]:[z-index:1] [&>_svg]:[filter:drop-shadow(0_7px_9px_rgba(0,_40,_48,_.14))] max-[620px]:[width:100px] max-[620px]:[height:100px] max-[620px]:[top:auto] max-[620px]:[right:-3px] max-[620px]:[bottom:-3px] max-[620px]:[opacity:.6] max-[620px]:[&>_svg]:[width:43px] max-[620px]:[&>_svg]:[height:43px]"><span className="welcome-ring welcome-ring-one [position:absolute] [display:block] [border:1px_solid_rgba(209,_255,_248,_.16)] [border-radius:50%] [width:155px] [height:155px] max-[620px]:[width:90px] max-[620px]:[height:90px]" /><span className="welcome-ring welcome-ring-two [position:absolute] [display:block] [border:1px_solid_rgba(209,_255,_248,_.16)] [border-radius:50%] [width:210px] [height:210px] max-[620px]:[width:130px] max-[620px]:[height:130px]" /><DoorOpen size={72} strokeWidth={1.25} /></div>
            </div>

            <div className="user-summary-grid [display:grid] [grid-template-columns:repeat(3,_minmax(0,_1fr))] [gap:14px] [margin-top:16px] max-[620px]:[gap:8px] max-[620px]:[margin-top:10px]">
              <SummaryCard icon={DoorOpen} label="Available resources" value={availableCount} note={`of ${resources.length} total resources`} />
              <SummaryCard icon={CalendarCheck} label="My bookings" value={bookings.length} note="Latest reservations and requests" />
              <SummaryCard icon={Clock3} label="Pending requests" value={bookings.filter((booking) => booking.status === "PENDING" && !booking.cancelledAt).length} note="Waiting for confirmation" />
            </div>

            <section className="user-section-block [margin-top:31px] max-[620px]:[margin-top:25px]">
              <SectionHeading title="Resources for your work" description="A few spaces and tools available in your workspace." action="View all resources" onAction={() => setSection("resources")} />
              {resources.length === 0 ? <EmptyPanel icon={DoorOpen} title="No resources yet" message="There are no resources available right now." /> : <div className="user-resource-grid [display:grid] [grid-template-columns:repeat(4,_minmax(0,_1fr))] [gap:13px] max-[900px]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[620px]:[gap:9px]">{resources.slice(0, 4).map((resource) => <ResourceCard key={resource.id} resource={resource} onBook={() => { setError(""); setBookingResource(resource); }} />)}</div>}
            </section>

            <section className="user-section-block user-latest-block [margin-top:31px] max-[620px]:[margin-top:25px]">
              <SectionHeading title="Latest bookings" description="Your most recent reservation activity." action="View all bookings" onAction={() => setSection("bookings")} />
              {latestBookings.length === 0 ? <EmptyPanel icon={CalendarDays} title="No bookings yet" message="Your reservation requests will appear here." /> : <div className="user-booking-list [overflow:hidden] [border:1px_solid_#e8edec] [border-radius:12px] [background:#fff]">{latestBookings.map((booking) => <BookingRow key={booking.id} booking={booking} maintenance={maintenanceByResource.get(booking.resourceId)} cancelling={cancellingId === booking.id} onCancel={cancelBooking} />)}</div>}
            </section>
          </>
        )}

        {section === "profile" && user && (
          <section className="user-profile-card [overflow:hidden] [border:1px_solid_#e8edec] [border-radius:14px] [background:#fff] [box-shadow:0_2px_5px_rgba(31,_52,_61,_.02)]">
            <div className="user-profile-banner [display:flex] [align-items:center] [gap:15px] [padding:24px] [border-bottom:1px_solid_#edf1f0] [background:linear-gradient(105deg,_#f7fbf9,_#f4f8f8)] [&_h2]:[margin:5px_0_4px] [&_h2]:[color:#2e444e] [&_h2]:[font-size:17px] [&_p]:[margin:0] [&_p]:[color:#8e9ba0] [&_p]:[font-size:9px] max-[620px]:[padding:19px]"><span className="user-profile-avatar [width:55px] [height:55px] [display:grid] [place-items:center] [border:3px_solid_#fff] [border-radius:17px] [color:#137d78] [background:#dff1ec] [box-shadow:0_3px_10px_rgba(39,_106,_96,_.09)] [font-size:17px] [font-weight:750]">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span><div><span className="user-profile-role [color:#15817d] [font-size:8px] [font-weight:760] [letter-spacing:.9px]">WORKSPACE MEMBER</span><h2>{user.firstName} {user.lastName}</h2><p>Member since {formatDate(user.createdAt)}</p></div></div>
            <div className="user-profile-details [display:grid] [grid-template-columns:repeat(3,_minmax(0,_1fr))] [gap:16px] [padding:23px] max-[620px]:[grid-template-columns:1fr] max-[620px]:[gap:17px] max-[620px]:[padding:18px]"><ProfileField icon={Mail} label="Email address" value={user.email} /><ProfileField icon={Phone} label="Phone number" value={user.phone} /><ProfileField icon={UsersRound} label="Account type" value="User" /></div>
          </section>
        )}

        {section === "resources" && (resources.length === 0 ? <EmptyPanel icon={DoorOpen} title="No resources yet" message="There are no resources available right now." /> : <div className="user-resource-grid user-resource-grid-full [display:grid] [grid-template-columns:repeat(4,_minmax(0,_1fr))] [gap:13px] max-[900px]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[620px]:[gap:9px] [grid-template-columns:repeat(3,_minmax(0,_1fr))]">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} onBook={() => { setError(""); setBookingResource(resource); }} />)}</div>)}

        {section === "bookings" && (bookings.length === 0 ? <EmptyPanel icon={CalendarDays} title="No bookings yet" message="Your reservation requests will appear here." /> : <div className="user-booking-list user-booking-list-full [overflow:hidden] [border:1px_solid_#e8edec] [border-radius:12px] [background:#fff] [margin-top:4px]">{bookings.map((booking) => <BookingRow key={booking.id} booking={booking} maintenance={maintenanceByResource.get(booking.resourceId)} cancelling={cancellingId === booking.id} onCancel={cancelBooking} />)}</div>)}
      </div>
      <footer className="user-footer [&>_span:first-child_>_span]:[color:#16837d] [&>_span:first-child_>_span]:[font-weight:550] [min-height:60px] [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] [padding:0_max(32px,_calc((100vw_-_1120px)_/_2))] [border-top:1px_solid_#e9eeed] [color:#9aa5a8] [background:#fff] [font-size:8px] [&>_span:first-child]:[color:#64767e] [&>_span:first-child]:[font-size:10px] [&>_span:first-child]:[font-weight:740] max-[620px]:[min-height:50px] max-[620px]:[padding:0_15px]"><span>primewave<span>lab</span></span><span>Your space, ready when you are.</span></footer>
      {bookingResource && <BookingModal resource={bookingResource} busy={bookingBusy} error={error} onClose={() => { if (!bookingBusy) setBookingResource(null); }} onSubmit={submitBooking} />}
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value, note }: { icon: typeof DoorOpen; label: string; value: number; note: string }) {
  return <article className="user-summary-card [min-height:126px] [position:relative] [display:flex] [flex-direction:column] [align-items:flex-start] [padding:16px_17px] [border:1px_solid_#e8edec] [border-radius:12px] [background:#fff] [box-shadow:0_2px_5px_rgba(31,_52,_61,_.02)] [&_strong]:[color:#50636d] [&_strong]:[font-size:10px] [&_strong]:[font-weight:660] [&_small]:[margin-top:5px] [&_small]:[color:#9aa5aa] [&_small]:[font-size:8px] max-[620px]:[min-height:112px] max-[620px]:[padding:11px] max-[620px]:[&_strong]:[font-size:8px] max-[620px]:[&_small]:[font-size:7px] max-[620px]:[&_small]:[line-height:1.45]"><span className="user-summary-icon [width:31px] [height:31px] [display:grid] [place-items:center] [margin-bottom:9px] [border-radius:9px] [color:#13827d] [background:#e7f5f1] max-[620px]:[width:27px] max-[620px]:[height:27px] max-[620px]:[margin-bottom:7px] max-[620px]:[&_svg]:[width:15px] max-[620px]:[&_svg]:[height:15px]"><Icon size={18} /></span><span className="user-summary-value [position:absolute] [top:21px] [right:18px] [color:#263e4a] [font-size:24px] [font-weight:720] [letter-spacing:-.7px] max-[620px]:[top:15px] max-[620px]:[right:11px] max-[620px]:[font-size:19px]">{value}</span><strong>{label}</strong><small>{note}</small></article>;
}

function SectionHeading({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return <div className="user-section-heading [display:flex] [align-items:flex-end] [justify-content:space-between] [gap:14px] [margin-bottom:14px] [&_h2]:[margin:0] [&_h2]:[color:#2c424e] [&_h2]:[font-size:15px] [&_h2]:[font-weight:690] [&_h2]:[letter-spacing:-.25px] [&_p]:[margin:5px_0_0] [&_p]:[color:#929ea3] [&_p]:[font-size:9px] [&_button]:[display:inline-flex] [&_button]:[align-items:center] [&_button]:[gap:5px] [&_button]:[padding:2px_0] [&_button]:[border:0] [&_button]:[color:#13817d] [&_button]:[background:transparent] [&_button]:[font-size:9px] [&_button]:[font-weight:670] [&_button]:[white-space:nowrap] [&_button]:[cursor:pointer] [&_button:hover]:[color:#075f61] max-[620px]:[align-items:flex-start] max-[620px]:[&_h2]:[font-size:13px] max-[620px]:[&_p]:[max-width:210px] max-[620px]:[&_p]:[line-height:1.4] max-[620px]:[&_button]:[font-size:8px]"><div><h2>{title}</h2><p>{description}</p></div><button type="button" onClick={onAction}>{action}<ArrowRight size={15} /></button></div>;
}

function ResourceCard({ resource, onBook }: { resource: Resource; onBook: () => void }) {
  const status = resourceStatus(resource.status);
  return <article className="user-resource-card [min-width:0] [display:flex] [flex-direction:column] [padding:15px] [border:1px_solid_#e8edec] [border-radius:12px] [background:#fff] [box-shadow:0_2px_5px_rgba(31,_52,_61,_.02)] [transition:transform_.16s_ease,_box-shadow_.16s_ease] hover:[transform:translateY(-2px)] hover:[box-shadow:0_7px_17px_rgba(31,_52,_61,_.07)] [&_h3]:[margin:5px_0_0] [&_h3]:[overflow:hidden] [&_h3]:[color:#354b56] [&_h3]:[font-size:12px] [&_h3]:[font-weight:690] [&_h3]:[text-overflow:ellipsis] [&_h3]:[white-space:nowrap] max-[620px]:[padding:11px] max-[620px]:[&_h3]:[font-size:10px]"><div className="user-resource-card-top [display:flex] [align-items:center] [justify-content:space-between] [gap:6px]"><span className="user-resource-icon [width:34px] [height:34px] [display:grid] [place-items:center] [border-radius:10px] [color:#21877f] [background:#e8f5f1] max-[620px]:[width:29px] max-[620px]:[height:29px] max-[620px]:[&_svg]:[width:17px] max-[620px]:[&_svg]:[height:17px]"><DoorOpen size={20} /></span><span className={`user-status [min-height:23px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:5px] [flex:0_0_auto] [padding:0_8px] [border-radius:6px] [font-size:8px] [font-weight:660] [white-space:nowrap] [&_i]:[width:5px] [&_i]:[height:5px] [&_i]:[border-radius:50%] [&_i]:[background:currentColor] max-[620px]:[min-height:20px] max-[620px]:[gap:4px] max-[620px]:[padding:0_6px] max-[620px]:[font-size:7px] ${status.className}`}><i />{status.label}</span></div><span className="user-resource-category [margin-top:14px] [color:#17817d] [font-size:8px] [font-weight:700] [letter-spacing:.5px] [text-transform:uppercase] max-[620px]:[margin-top:11px] max-[620px]:[font-size:7px]">{resource.resourceCategory?.name ?? "Resource"}</span><h3>{resource.name}</h3><p className="user-resource-description [min-height:35px] [display:-webkit-box] [overflow:hidden] [margin:6px_0_13px] [color:#87949a] [font-size:9px] [line-height:1.55] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] max-[620px]:[min-height:39px] max-[620px]:[font-size:8px]">{resource.description || "Workspace resource ready for your next project."}</p><div className="user-resource-meta [display:grid] [gap:7px] [margin-top:auto] [padding-top:10px] [border-top:1px_solid_#f0f3f2] [&_span]:[min-width:0] [&_span]:[display:flex] [&_span]:[align-items:center] [&_span]:[gap:6px] [&_span]:[overflow:hidden] [&_span]:[color:#85949a] [&_span]:[font-size:8px] [&_span]:[text-overflow:ellipsis] [&_span]:[white-space:nowrap] [&_svg]:[flex:0_0_auto] [&_svg]:[color:#9aadaa] max-[620px]:[&_span]:[gap:4px] max-[620px]:[&_span]:[font-size:7px]"><span><DoorOpen size={14} />{resource.code}</span>{resource.location && <span><MapPin size={14} />{resource.location}</span>}{resource.maxCapacity != null && <span><UsersRound size={14} />Up to {resource.maxCapacity}</span>}</div><button className="user-book-resource [min-height:32px] [display:flex] [align-items:center] [justify-content:center] [gap:7px] [margin-top:13px] [border:1px_solid_#d6eae5] [border-radius:8px] [color:#117b77] [background:#f5fbf9] [font-size:9px] [font-weight:680] [cursor:pointer] [transition:border-color_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[border-color:#a8d5cc] [&:hover:not(:disabled)]:[background:#eaf7f3] disabled:[border-color:#edf0ef] disabled:[color:#a5afb1] disabled:[background:#f7f8f8] disabled:[cursor:not-allowed] max-[620px]:[min-height:29px] max-[620px]:[margin-top:10px] max-[620px]:[font-size:8px]" type="button" disabled={resource.status !== "ACTIVE"} onClick={onBook}>{resource.status === "ACTIVE" ? "Book resource" : "Unavailable"}<ArrowRight size={14} /></button></article>;
}

function BookingRow({ booking, maintenance, cancelling, onCancel }: { booking: Reservation; maintenance?: Maintenance; cancelling: boolean; onCancel: (booking: Reservation) => void }) {
  const status = bookingStatus(booking);
  const StatusIcon = status.Icon;
  const maintenanceInProgress = maintenance?.maintenancestatus === "INPROGRESS";
  const canCancel = !booking.cancelledAt && new Date(booking.StartTime).getTime() > Date.now();
  return (
    <article className="user-booking-row [min-height:70px] [display:flex] [align-items:center] [gap:13px] [padding:12px_16px] [border-bottom:1px_solid_#f0f3f2] [&:last-child]:[border-bottom:0] max-[620px]:[align-items:flex-start] max-[620px]:[flex-wrap:wrap] max-[620px]:[gap:9px] max-[620px]:[padding:12px] max-[620px]:[&>_.user-status]:[align-self:flex-start] max-[620px]:[&>_.user-status]:[margin-left:auto]">
      <span className="user-booking-icon [width:34px] [height:34px] [display:grid] [place-items:center] [flex:0_0_auto] [border-radius:10px] [color:#6485ac] [background:#edf3fa] max-[620px]:[width:30px] max-[620px]:[height:30px]"><CalendarDays size={19} /></span>
      <div className="user-booking-main [min-width:120px] [flex:1] [display:grid] [gap:5px] [&_strong]:[overflow:hidden] [&_strong]:[color:#455a64] [&_strong]:[font-size:10px] [&_strong]:[font-weight:660] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&_span]:[overflow:hidden] [&_span]:[color:#98a4a9] [&_span]:[font-size:8px] [&_span]:[text-overflow:ellipsis] [&_span]:[white-space:nowrap] max-[620px]:[min-width:calc(100%_-_45px)] max-[620px]:[padding-top:2px]"><strong>{booking.title || booking.resource?.name || "Resource reservation"}</strong><span>{booking.resource?.name ?? "Resource details unavailable"}{booking.resource?.code ? ` · ${booking.resource.code}` : ""}</span></div>
      <div className="user-booking-time [&_span]:[overflow:hidden] [&_span]:[color:#98a4a9] [&_span]:[font-size:8px] [&_span]:[text-overflow:ellipsis] [&_span]:[white-space:nowrap] [width:177px] [display:grid] [gap:5px] [&_strong]:[color:#60727a] [&_strong]:[font-size:9px] [&_strong]:[font-weight:620] max-[620px]:[width:calc(100%_-_94px)] max-[620px]:[margin-left:39px]"><strong>{formatDate(booking.StartTime, true)}</strong><span>Until {formatDate(booking.Endtime, true)}</span></div>
      <span className={`user-status [min-height:23px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:5px] [flex:0_0_auto] [padding:0_8px] [border-radius:6px] [font-size:8px] [font-weight:660] [white-space:nowrap] [&_i]:[width:5px] [&_i]:[height:5px] [&_i]:[border-radius:50%] [&_i]:[background:currentColor] max-[620px]:[min-height:20px] max-[620px]:[gap:4px] max-[620px]:[padding:0_6px] max-[620px]:[font-size:7px] ${status.className}`}><StatusIcon size={13} />{status.label}</span>
      {canCancel && <button className="user-booking-cancel [min-height:27px] [display:inline-flex] [align-items:center] [justify-content:center] [flex:0_0_auto] [padding:0_9px] [border:1px_solid_#eedbd8] [border-radius:7px] [color:#a65951] [background:#fffafa] [font-size:8px] [font-weight:650] [cursor:pointer] [transition:border-color_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[border-color:#e4bcb6] [&:hover:not(:disabled)]:[background:#fff2f0] disabled:[opacity:.58] disabled:[cursor:wait] max-[620px]:[min-height:24px] max-[620px]:[padding:0_7px] max-[620px]:[font-size:7px]" type="button" onClick={() => onCancel(booking)} disabled={cancelling} aria-label={`Cancel booking for ${booking.resource?.name ?? "resource"}`} title="Cancel booking">{cancelling ? "Cancelling…" : "Cancel"}</button>}
      <div className={`user-booking-maintenance [min-height:31px] [display:flex] [align-items:center] [gap:7px] [flex:0_0_calc(100%_-_47px)] [margin-left:47px] [padding:6px_9px] [border-radius:7px] [font-size:8px] [&>_svg]:[flex:0_0_auto] [&.maintenance-label]:[color:#788990] [&_strong]:[font-size:8px] [&_strong]:[font-weight:700] [&_small]:[overflow:hidden] [&_small]:[margin-left:auto] [&_small]:[color:#8c999d] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] max-[620px]:[min-height:30px] max-[620px]:[flex-basis:calc(100%_-_39px)] max-[620px]:[flex-wrap:wrap] max-[620px]:[gap:5px] max-[620px]:[margin-left:39px] max-[620px]:[font-size:7px] max-[620px]:[&_strong]:[font-size:7px] max-[620px]:[&_small]:[flex-basis:100%] max-[620px]:[&_small]:[margin-left:21px] [color:#a77634] [background:#fff7e9] [&>_svg]:[color:#ba853d] [&_strong]:[color:#996b2b] [color:#38825e] [background:#f0f8f3] [&>_svg]:[color:#4a9670] [&_strong]:[color:#3c7959] [color:#7d8b91] [background:#f5f7f7] [&>_svg]:[color:#8c9b9e] [&_strong]:[color:#738289] ${maintenanceInProgress ? "maintenance-active [color:#a77634] [background:#fff7e9] [&>_svg]:[color:#ba853d] [&_strong]:[color:#996b2b]" : maintenance ? "maintenance-complete [color:#38825e] [background:#f0f8f3] [&>_svg]:[color:#4a9670] [&_strong]:[color:#3c7959]" : "maintenance-none [color:#7d8b91] [background:#f5f7f7] [&>_svg]:[color:#8c9b9e] [&_strong]:[color:#738289]"}`}>
        <Wrench size={14} />
        <span className="maintenance-label">Resource maintenance</span>
        <strong>{maintenanceInProgress ? "In progress" : maintenance ? "Completed" : "No maintenance recorded"}</strong>
        {maintenance && <small>{maintenance.description} · {formatDate(maintenanceInProgress ? maintenance.endTime : maintenance.startTime)}</small>}
      </div>
    </article>
  );
}

function ProfileField({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="user-profile-field [display:flex] [align-items:center] [gap:10px] [min-width:0] [&>_div]:[min-width:0] [&>_div]:[display:grid] [&>_div]:[gap:5px] [&_small]:[color:#9aa5a9] [&_small]:[font-size:8px] [&_strong]:[overflow:hidden] [&_strong]:[color:#4b5f68] [&_strong]:[font-size:9px] [&_strong]:[font-weight:650] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap]"><span className="user-profile-field-icon [width:32px] [height:32px] [display:grid] [place-items:center] [flex:0_0_auto] [border-radius:9px] [color:#16827d] [background:#e8f5f1]"><Icon size={17} /></span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function EmptyPanel({ icon: Icon, title, message }: { icon: typeof DoorOpen; title: string; message: string }) {
  return <div className="user-empty-panel [min-height:174px] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [padding:22px] [border:1px_dashed_#dfe8e5] [border-radius:12px] [background:rgba(255,255,255,.7)] [text-align:center] [&>_span]:[width:39px] [&>_span]:[height:39px] [&>_span]:[display:grid] [&>_span]:[place-items:center] [&>_span]:[margin-bottom:10px] [&>_span]:[border-radius:12px] [&>_span]:[color:#19827c] [&>_span]:[background:#e9f5f1] [&_strong]:[color:#52656e] [&_strong]:[font-size:11px] [&_p]:[margin:5px_0_0] [&_p]:[color:#98a4a8] [&_p]:[font-size:9px]"><span><Icon size={22} /></span><strong>{title}</strong><p>{message}</p></div>;
}

function BookingModal({ resource, busy, error, onClose, onSubmit }: { resource: Resource; busy: boolean; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const localDateTime = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };
  const initialStart = new Date(Date.now() + 60 * 60 * 1000);
  initialStart.setMinutes(0, 0, 0);
  const initialEnd = new Date(initialStart.getTime() + 60 * 60 * 1000);
  return (
    <div className="user-modal-backdrop [position:fixed] [inset:0] [z-index:30] [display:grid] [place-items:center] [overflow-y:auto] [padding:20px] [background:rgba(17,_38,_46,_.44)] [backdrop-filter:blur(3px)]" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="user-booking-modal [width:min(510px,_100%)] [padding:22px] [border:1px_solid_rgba(255,255,255,.7)] [border-radius:15px] [background:#fff] [box-shadow:0_22px_65px_rgba(21,_39,_47,_.2)] max-[620px]:[padding:19px_16px]" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
        <header className="user-modal-heading [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:12px] [margin-bottom:21px] [&>_div]:[display:flex] [&>_div]:[align-items:center] [&>_div]:[gap:11px] [&_h2]:[margin:0] [&_h2]:[color:#2e444e] [&_h2]:[font-size:16px] [&_h2]:[font-weight:700] [&_p]:[margin:5px_0_0] [&_p]:[color:#909da1] [&_p]:[font-size:9px]"><div><span className="user-modal-icon [width:37px] [height:37px] [display:grid] [place-items:center] [border-radius:11px] [color:#17847d] [background:#e8f5f1]"><CalendarClock size={19} /></span><div><h2 id="booking-modal-title">Book a resource</h2><p>{resource.name} · {resource.code}</p></div></div><button className="user-modal-close [width:30px] [height:30px] [display:grid] [place-items:center] [border:1px_solid_#e8edec] [border-radius:8px] [color:#7d8b91] [background:#fff] [cursor:pointer] [&:hover:not(:disabled)]:[border-color:#e8cbc7] [&:hover:not(:disabled)]:[color:#b6534a] disabled:[opacity:.5] disabled:[cursor:wait]" type="button" onClick={onClose} disabled={busy} aria-label="Close booking form"><X size={17} /></button></header>
        <form className="user-booking-form [display:grid] [gap:14px]" onSubmit={onSubmit}>
          {error && <div className="user-booking-modal-error [padding:10px] [border:1px_solid_#efd4d0] [border-radius:8px] [color:#934c44] [background:#fff8f7] [font-size:9px] [line-height:1.5]" role="alert">{error}</div>}
          <label className="user-booking-field [min-width:0] [display:grid] [gap:6px] [color:#53656e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[justify-content:space-between] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:37px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Booking title <small>Optional</small></span><input name="title" type="text" maxLength={255} placeholder="What are you using it for?" /></label>
          <div className="user-booking-form-row [display:grid] [grid-template-columns:1fr_1fr] [gap:11px] max-[620px]:[grid-template-columns:1fr]">
            <label className="user-booking-field [min-width:0] [display:grid] [gap:6px] [color:#53656e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[justify-content:space-between] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:37px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Start time</span><input name="startTime" type="datetime-local" min={localDateTime(new Date())} defaultValue={localDateTime(initialStart)} required /></label>
            <label className="user-booking-field [min-width:0] [display:grid] [gap:6px] [color:#53656e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[justify-content:space-between] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:37px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>End time</span><input name="endTime" type="datetime-local" min={localDateTime(initialStart)} defaultValue={localDateTime(initialEnd)} required /></label>
          </div>
          <p className="user-booking-hint [display:flex] [align-items:center] [gap:7px] [margin:0] [padding:10px] [border-radius:8px] [color:#926a32] [background:#fff8eb] [font-size:8px] [line-height:1.5] [&_svg]:[flex:0_0_auto]"><Hourglass size={14} /> Your request will stay pending until an administrator confirms it.</p>
          <div className="user-modal-actions [display:flex] [justify-content:flex-end] [gap:8px] [margin-top:3px] [padding-top:14px] [border-top:1px_solid_#eff2f2] [&_button]:[min-height:35px] [&_button]:[display:inline-flex] [&_button]:[align-items:center] [&_button]:[justify-content:center] [&_button]:[gap:7px] [&_button]:[padding:0_11px] [&_button]:[border:1px_solid_transparent] [&_button]:[border-radius:8px] [&_button]:[font-size:9px] [&_button]:[font-weight:650] [&_button]:[cursor:pointer] [&_button:disabled]:[opacity:.58] [&_button:disabled]:[cursor:wait]"><button className="user-modal-cancel [color:#5e6e76] [background:#fff] [border-color:#e2e8e8]! [&:hover:not(:disabled)]:[background:#f9fcfb] [&:hover:not(:disabled)]:[border-color:#cddfdd]!" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="user-modal-submit [color:#fff] [background:#087e7e] [box-shadow:0_3px_8px_rgba(8,_126,_126,_.13)] [&:hover:not(:disabled)]:[background:#076e71]" type="submit" disabled={busy}>{busy ? "Sending request…" : "Send booking request"}<ArrowRight size={15} /></button></div>
        </form>
      </section>
    </div>
  );
}
