"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
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
  if (reservation.status === "COMFORMED") return { label: "Confirmed", className: "user-status-confirmed", Icon: CheckCircle2 };
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setError("");
    const profile = await request<User>("/api/auth/me");
    if (profile.role === "ADMIN") {
      router.replace("/admin");
      return;
    }
    const [resourceData, bookingData] = await Promise.all([
      request<{ resources: Resource[] }>("/api/resources"),
      request<{ reservations: Reservation[] }>("/api/reservations"),
    ]);
    setUser(profile);
    setResources(resourceData.resources ?? []);
    setBookings(bookingData.reservations ?? []);
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

  const latestBookings = useMemo(() => bookings.slice(0, 4), [bookings]);
  const availableCount = resources.filter((resource) => resource.status === "ACTIVE").length;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
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
              {resources.length === 0 ? <EmptyPanel icon={DoorOpen} title="No resources yet" message="There are no resources available right now." /> : <div className="user-resource-grid">{resources.slice(0, 4).map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>}
            </section>

            <section className="user-section-block user-latest-block">
              <SectionHeading title="Latest bookings" description="Your most recent reservation activity." action="View all bookings" onAction={() => setSection("bookings")} />
              {latestBookings.length === 0 ? <EmptyPanel icon={CalendarDays} title="No bookings yet" message="Your reservation requests will appear here." /> : <div className="user-booking-list">{latestBookings.map((booking) => <BookingRow key={booking.id} booking={booking} />)}</div>}
            </section>
          </>
        )}

        {section === "profile" && user && (
          <section className="user-profile-card">
            <div className="user-profile-banner"><span className="user-profile-avatar">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span><div><span className="user-profile-role">WORKSPACE MEMBER</span><h2>{user.firstName} {user.lastName}</h2><p>Member since {formatDate(user.createdAt)}</p></div></div>
            <div className="user-profile-details"><ProfileField icon={Mail} label="Email address" value={user.email} /><ProfileField icon={Phone} label="Phone number" value={user.phone} /><ProfileField icon={UsersRound} label="Account type" value="User" /></div>
          </section>
        )}

        {section === "resources" && (resources.length === 0 ? <EmptyPanel icon={DoorOpen} title="No resources yet" message="There are no resources available right now." /> : <div className="user-resource-grid user-resource-grid-full">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>)}

        {section === "bookings" && (bookings.length === 0 ? <EmptyPanel icon={CalendarDays} title="No bookings yet" message="Your reservation requests will appear here." /> : <div className="user-booking-list user-booking-list-full">{bookings.map((booking) => <BookingRow key={booking.id} booking={booking} />)}</div>)}
      </div>
      <footer className="user-footer"><span>primewave<span>lab</span></span><span>Your space, ready when you are.</span></footer>
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value, note }: { icon: typeof DoorOpen; label: string; value: number; note: string }) {
  return <article className="user-summary-card"><span className="user-summary-icon"><Icon size={18} /></span><span className="user-summary-value">{value}</span><strong>{label}</strong><small>{note}</small></article>;
}

function SectionHeading({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return <div className="user-section-heading"><div><h2>{title}</h2><p>{description}</p></div><button type="button" onClick={onAction}>{action}<ArrowRight size={15} /></button></div>;
}

function ResourceCard({ resource }: { resource: Resource }) {
  const status = resourceStatus(resource.status);
  return <article className="user-resource-card"><div className="user-resource-card-top"><span className="user-resource-icon"><DoorOpen size={20} /></span><span className={`user-status ${status.className}`}><i />{status.label}</span></div><span className="user-resource-category">{resource.resourceCategory?.name ?? "Resource"}</span><h3>{resource.name}</h3><p className="user-resource-description">{resource.description || "Workspace resource ready for your next project."}</p><div className="user-resource-meta"><span><DoorOpen size={14} />{resource.code}</span>{resource.location && <span><MapPin size={14} />{resource.location}</span>}{resource.maxCapacity != null && <span><UsersRound size={14} />Up to {resource.maxCapacity}</span>}</div></article>;
}

function BookingRow({ booking }: { booking: Reservation }) {
  const status = bookingStatus(booking);
  const StatusIcon = status.Icon;
  return <article className="user-booking-row"><span className="user-booking-icon"><CalendarDays size={19} /></span><div className="user-booking-main"><strong>{booking.title || booking.resource?.name || "Resource reservation"}</strong><span>{booking.resource?.name ?? "Resource details unavailable"}{booking.resource?.code ? ` · ${booking.resource.code}` : ""}</span></div><div className="user-booking-time"><strong>{formatDate(booking.StartTime, true)}</strong><span>Until {formatDate(booking.Endtime, true)}</span></div><span className={`user-status ${status.className}`}><StatusIcon size={13} />{status.label}</span></article>;
}

function ProfileField({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="user-profile-field"><span className="user-profile-field-icon"><Icon size={17} /></span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function EmptyPanel({ icon: Icon, title, message }: { icon: typeof DoorOpen; title: string; message: string }) {
  return <div className="user-empty-panel"><span><Icon size={22} /></span><strong>{title}</strong><p>{message}</p></div>;
}
