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
  if (reservation.cancelledAt) return { label: "Cancelled", className: "user-status-cancelled", Icon: XCircle };
  if (reservation.status === "COMFORMED") return { label: "Booking complete", className: "user-status-confirmed", Icon: CheckCircle2 };
  return { label: "Pending", className: "user-status-pending", Icon: Hourglass };
}

function resourceStatus(status: Resource["status"]) {
  if (status === "ACTIVE") return { label: "Available", className: "user-status-confirmed" };
  if (status === "WAITING") return { label: "In use", className: "user-status-pending" };
  return { label: "Unavailable", className: "user-status-cancelled" };
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

  if (loading) return <main className="user-loading"><span className="user-loader"><RefreshCw size={20} /></span><p>Opening your workspace…</p></main>;

  return (
    <main className="user-workspace">
      <header className="user-header">
        <a className="user-brand" href="/dashboard" aria-label="PrimeWave Lab dashboard">
          <span className="user-brand-mark"><Waves size={19} /></span>
          <span>primewave<span>lab</span></span>
        </a>
        <nav className="user-nav" aria-label="Dashboard navigation">
          <button className={section === "home" ? "user-nav-active" : ""} onClick={() => setSection("home")} type="button">Overview</button>
          <button className={section === "profile" ? "user-nav-active" : ""} onClick={() => setSection("profile")} type="button"><UserRound size={15} /> My profile</button>
          <button className={section === "resources" ? "user-nav-active" : ""} onClick={() => setSection("resources")} type="button"><DoorOpen size={15} /> Resources</button>
          <button className={section === "bookings" ? "user-nav-active" : ""} onClick={() => setSection("bookings")} type="button"><CalendarDays size={15} /> My bookings{bookings.length > 0 && <span className="user-nav-count">{bookings.length}</span>}</button>
        </nav>
        <div className="user-header-account">
          {user && <span className="user-account-name">{user.firstName} {user.lastName}</span>}
          <button className="user-logout" type="button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      <div className="user-page-content">
        <div className="user-page-heading">
          <div>
            <span className="user-eyebrow">YOUR PRIMEWAVE WORKSPACE</span>
            <h1>{section === "home" ? `Welcome back${user ? `, ${user.firstName}` : ""}` : section === "profile" ? "Your profile" : section === "resources" ? "Explore resources" : "Your bookings"}</h1>
            <p>{section === "home" ? "Find a space for your next great idea." : section === "profile" ? "Your account information and contact details." : section === "resources" ? "Browse the spaces and equipment available to you." : "Keep track of your latest reservation requests."}</p>
          </div>
          <button className="user-refresh" type="button" onClick={() => { setLoading(true); void loadDashboard().catch((cause) => setError(cause instanceof Error ? cause.message : "Refresh failed.")).finally(() => setLoading(false)); }}><RefreshCw size={15} /> Refresh</button>
        </div>

        {error && <div className="user-error" role="alert"><span>!</span>{error}</div>}
        {notice && <div className="user-notice" role="status"><CheckCircle2 size={16} /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button></div>}

        {section === "home" && (
          <>
            <div className="user-welcome-card">
              <div><span className="user-welcome-kicker">A GOOD DAY TO GET THINGS DONE</span><h2>Your next idea needs a place.</h2><p>Explore available resources and keep your bookings close at hand.</p><button type="button" className="user-welcome-action" onClick={() => setSection("resources")}>Explore resources <ArrowRight size={16} /></button></div>
              <div className="user-welcome-art"><span className="welcome-ring welcome-ring-one" /><span className="welcome-ring welcome-ring-two" /><DoorOpen size={72} strokeWidth={1.25} /></div>
            </div>

            <div className="user-summary-grid">
              <SummaryCard icon={DoorOpen} label="Available resources" value={availableCount} note={`of ${resources.length} total resources`} />
              <SummaryCard icon={CalendarCheck} label="My bookings" value={bookings.length} note="Latest reservations and requests" />
              <SummaryCard icon={Clock3} label="Pending requests" value={bookings.filter((booking) => booking.status === "PENDING" && !booking.cancelledAt).length} note="Waiting for confirmation" />
            </div>

            <section className="user-section-block">
              <SectionHeading title="Resources for your work" description="A few spaces and tools available in your workspace." action="View all resources" onAction={() => setSection("resources")} />
              {resources.length === 0 ? <EmptyPanel icon={DoorOpen} title="No resources yet" message="There are no resources available right now." /> : <div className="user-resource-grid">{resources.slice(0, 4).map((resource) => <ResourceCard key={resource.id} resource={resource} onBook={() => { setError(""); setBookingResource(resource); }} />)}</div>}
            </section>

            <section className="user-section-block user-latest-block">
              <SectionHeading title="Latest bookings" description="Your most recent reservation activity." action="View all bookings" onAction={() => setSection("bookings")} />
              {latestBookings.length === 0 ? <EmptyPanel icon={CalendarDays} title="No bookings yet" message="Your reservation requests will appear here." /> : <div className="user-booking-list">{latestBookings.map((booking) => <BookingRow key={booking.id} booking={booking} maintenance={maintenanceByResource.get(booking.resourceId)} />)}</div>}
            </section>
          </>
        )}

        {section === "profile" && user && (
          <section className="user-profile-card">
            <div className="user-profile-banner"><span className="user-profile-avatar">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span><div><span className="user-profile-role">WORKSPACE MEMBER</span><h2>{user.firstName} {user.lastName}</h2><p>Member since {formatDate(user.createdAt)}</p></div></div>
            <div className="user-profile-details"><ProfileField icon={Mail} label="Email address" value={user.email} /><ProfileField icon={Phone} label="Phone number" value={user.phone} /><ProfileField icon={UsersRound} label="Account type" value="User" /></div>
          </section>
        )}

        {section === "resources" && (resources.length === 0 ? <EmptyPanel icon={DoorOpen} title="No resources yet" message="There are no resources available right now." /> : <div className="user-resource-grid user-resource-grid-full">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} onBook={() => { setError(""); setBookingResource(resource); }} />)}</div>)}

        {section === "bookings" && (bookings.length === 0 ? <EmptyPanel icon={CalendarDays} title="No bookings yet" message="Your reservation requests will appear here." /> : <div className="user-booking-list user-booking-list-full">{bookings.map((booking) => <BookingRow key={booking.id} booking={booking} maintenance={maintenanceByResource.get(booking.resourceId)} />)}</div>)}
      </div>
      <footer className="user-footer"><span>primewave<span>lab</span></span><span>Your space, ready when you are.</span></footer>
      {bookingResource && <BookingModal resource={bookingResource} busy={bookingBusy} error={error} onClose={() => { if (!bookingBusy) setBookingResource(null); }} onSubmit={submitBooking} />}
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value, note }: { icon: typeof DoorOpen; label: string; value: number; note: string }) {
  return <article className="user-summary-card"><span className="user-summary-icon"><Icon size={18} /></span><span className="user-summary-value">{value}</span><strong>{label}</strong><small>{note}</small></article>;
}

function SectionHeading({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return <div className="user-section-heading"><div><h2>{title}</h2><p>{description}</p></div><button type="button" onClick={onAction}>{action}<ArrowRight size={15} /></button></div>;
}

function ResourceCard({ resource, onBook }: { resource: Resource; onBook: () => void }) {
  const status = resourceStatus(resource.status);
  return <article className="user-resource-card"><div className="user-resource-card-top"><span className="user-resource-icon"><DoorOpen size={20} /></span><span className={`user-status ${status.className}`}><i />{status.label}</span></div><span className="user-resource-category">{resource.resourceCategory?.name ?? "Resource"}</span><h3>{resource.name}</h3><p className="user-resource-description">{resource.description || "Workspace resource ready for your next project."}</p><div className="user-resource-meta"><span><DoorOpen size={14} />{resource.code}</span>{resource.location && <span><MapPin size={14} />{resource.location}</span>}{resource.maxCapacity != null && <span><UsersRound size={14} />Up to {resource.maxCapacity}</span>}</div><button className="user-book-resource" type="button" disabled={resource.status !== "ACTIVE"} onClick={onBook}>{resource.status === "ACTIVE" ? "Book resource" : "Unavailable"}<ArrowRight size={14} /></button></article>;
}

function BookingRow({ booking, maintenance }: { booking: Reservation; maintenance?: Maintenance }) {
  const status = bookingStatus(booking);
  const StatusIcon = status.Icon;
  const maintenanceInProgress = maintenance?.maintenancestatus === "INPROGRESS";
  return (
    <article className="user-booking-row">
      <span className="user-booking-icon"><CalendarDays size={19} /></span>
      <div className="user-booking-main"><strong>{booking.title || booking.resource?.name || "Resource reservation"}</strong><span>{booking.resource?.name ?? "Resource details unavailable"}{booking.resource?.code ? ` · ${booking.resource.code}` : ""}</span></div>
      <div className="user-booking-time"><strong>{formatDate(booking.StartTime, true)}</strong><span>Until {formatDate(booking.Endtime, true)}</span></div>
      <span className={`user-status ${status.className}`}><StatusIcon size={13} />{status.label}</span>
      <div className={`user-booking-maintenance ${maintenanceInProgress ? "maintenance-active" : maintenance ? "maintenance-complete" : "maintenance-none"}`}>
        <Wrench size={14} />
        <span className="maintenance-label">Resource maintenance</span>
        <strong>{maintenanceInProgress ? "In progress" : maintenance ? "Completed" : "No maintenance recorded"}</strong>
        {maintenance && <small>{maintenance.description} · {formatDate(maintenanceInProgress ? maintenance.endTime : maintenance.startTime)}</small>}
      </div>
    </article>
  );
}

function ProfileField({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="user-profile-field"><span className="user-profile-field-icon"><Icon size={17} /></span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function EmptyPanel({ icon: Icon, title, message }: { icon: typeof DoorOpen; title: string; message: string }) {
  return <div className="user-empty-panel"><span><Icon size={22} /></span><strong>{title}</strong><p>{message}</p></div>;
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
    <div className="user-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="user-booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
        <header className="user-modal-heading"><div><span className="user-modal-icon"><CalendarClock size={19} /></span><div><h2 id="booking-modal-title">Book a resource</h2><p>{resource.name} · {resource.code}</p></div></div><button className="user-modal-close" type="button" onClick={onClose} disabled={busy} aria-label="Close booking form"><X size={17} /></button></header>
        <form className="user-booking-form" onSubmit={onSubmit}>
          {error && <div className="user-booking-modal-error" role="alert">{error}</div>}
          <label className="user-booking-field"><span>Booking title <small>Optional</small></span><input name="title" type="text" maxLength={255} placeholder="What are you using it for?" /></label>
          <div className="user-booking-form-row">
            <label className="user-booking-field"><span>Start time</span><input name="startTime" type="datetime-local" min={localDateTime(new Date())} defaultValue={localDateTime(initialStart)} required /></label>
            <label className="user-booking-field"><span>End time</span><input name="endTime" type="datetime-local" min={localDateTime(initialStart)} defaultValue={localDateTime(initialEnd)} required /></label>
          </div>
          <p className="user-booking-hint"><Hourglass size={14} /> Your request will stay pending until an administrator confirms it.</p>
          <div className="user-modal-actions"><button className="user-modal-cancel" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="user-modal-submit" type="submit" disabled={busy}>{busy ? "Sending request…" : "Send booking request"}<ArrowRight size={15} /></button></div>
        </form>
      </section>
    </div>
  );
}
