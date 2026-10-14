"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  DoorOpen,
  HardHat,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPin,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
  X,
} from "lucide-react";

type Envelope<T> = {
  success: boolean;
  message?: string;
  error?: string;
  details?: Record<string, string[]>;
  data: T;
};

type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "BLOCKED" | "SUSPENDED";
  createdAt: string;
  _count?: { resavation: number };
};

type ResourceCategory = { id: string; name: string };
type Resource = {
  id: string;
  name: string;
  code: string;
  description: string;
  location: string | null;
  maxCapacity: number | null;
  status: "ACTIVE" | "WAITING" | "INACTIVE";
  categoryId: string;
  resourceCategory: ResourceCategory;
};
type Reservation = {
  id: string;
  title: string | null;
  userId: string;
  resourceId: string;
  StartTime: string;
  Endtime: string;
  status: "PENDING" | "COMFORMED";
  cancelledAt: string | null;
  user: Pick<AdminUser, "id" | "firstName" | "lastName" | "email">;
  resource: Pick<Resource, "id" | "name" | "code" | "location" | "status"> | null;
};
type Maintenance = {
  id: string;
  description: string;
  resourceId: string;
  startTime: string;
  endTime: string;
  maintenancestatus: "INPROGRESS" | "COMPLETE";
  resource: Pick<Resource, "id" | "name" | "code" | "location" | "status">;
};
type UserProfile = Pick<AdminUser, "id" | "firstName" | "lastName" | "email" | "role">;
type Section = "overview" | "reservations" | "resources" | "maintenance" | "users";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<Envelope<T>> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  const body = (await response.json().catch(() => ({}))) as Partial<Envelope<T>>;

  if (!response.ok || body.success === false) {
    const details = Object.values(body.details ?? {}).flat().join(" ");
    throw new ApiError(details || body.error || "The request could not be completed.", response.status);
  }

  return body as Envelope<T>;
}

function initials(user: Pick<AdminUser, "firstName" | "lastName">) {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

function formatDate(value: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", includeTime
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function toLocalDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const navigation: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "reservations", label: "Reservations", icon: CalendarClock },
  { id: "resources", label: "Resources", icon: DoorOpen },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
  { id: "users", label: "Users", icon: Users },
];

export default function AdminPanel() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [admin, setAdmin] = useState<UserProfile | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [resourceDialog, setResourceDialog] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [maintenanceDialog, setMaintenanceDialog] = useState(false);

  const loadCollections = useCallback(async () => {
    const [reservationResult, resourceResult, categoryResult, maintenanceResult, userResult] = await Promise.all([
      apiRequest<{ reservations: Reservation[] }>("/api/reservations"),
      apiRequest<{ resources: Resource[] }>("/api/resources"),
      apiRequest<{ categories: ResourceCategory[] }>("/api/resources/categories"),
      apiRequest<{ maintenances: Maintenance[] }>("/api/maintenance"),
      apiRequest<{ users: AdminUser[] }>("/api/users"),
    ]);
    setReservations(reservationResult.data.reservations ?? []);
    setResources(resourceResult.data.resources ?? []);
    setCategories(categoryResult.data.categories ?? []);
    setMaintenance(maintenanceResult.data.maintenances ?? []);
    setUsers(userResult.data.users ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    async function start() {
      setLoading(true);
      try {
        const profile = await apiRequest<UserProfile>("/api/auth/me");
        if (!active) return;
        if (profile.data.role !== "ADMIN") {
          setActionError("This area is only available to administrators.");
          setLoading(false);
          return;
        }
        setAdmin(profile.data);
        await loadCollections();
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }
        setActionError(error instanceof Error ? error.message : "Could not load the admin panel.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void start();
    return () => { active = false; };
  }, [loadCollections, router]);

  const pendingReservations = reservations.filter((item) => item.status === "PENDING" && !item.cancelledAt);
  const activeResources = resources.filter((item) => item.status === "ACTIVE");
  const ongoingMaintenance = maintenance.filter((item) => item.maintenancestatus === "INPROGRESS");
  const todayReservations = reservations.filter((item) => new Date(item.StartTime).toDateString() === new Date().toDateString());

  const filteredReservations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reservations;
    return reservations.filter((item) => `${item.title ?? ""} ${item.user.firstName} ${item.user.lastName} ${item.resource?.name ?? ""} ${item.resource?.code ?? ""}`.toLowerCase().includes(query));
  }, [reservations, search]);
  const filteredResources = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return resources;
    return resources.filter((item) => `${item.name} ${item.code} ${item.resourceCategory.name} ${item.location ?? ""}`.toLowerCase().includes(query));
  }, [resources, search]);
  const filteredMaintenance = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return maintenance;
    return maintenance.filter((item) => `${item.description} ${item.resource.name} ${item.resource.code}`.toLowerCase().includes(query));
  }, [maintenance, search]);
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((item) => `${item.firstName} ${item.lastName} ${item.email} ${item.phone}`.toLowerCase().includes(query));
  }, [users, search]);

  async function runAction(id: string, action: () => Promise<void>, message: string) {
    setActionError("");
    setNotice("");
    setBusyId(id);
    try {
      await action();
      await loadCollections();
      setNotice(message);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setBusyId("");
    }
  }

  async function handleReservation(id: string, action: "CONFIRM" | "REJECT") {
    await runAction(id, async () => {
      await apiRequest(`/api/reservations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
    }, action === "CONFIRM" ? "Reservation confirmed." : "Reservation rejected.");
  }

  async function deleteResource(resource: Resource) {
    if (!window.confirm(`Delete “${resource.name}” (${resource.code})? This cannot be undone.`)) return;
    await runAction(resource.id, async () => {
      await apiRequest(`/api/resources/${encodeURIComponent(resource.id)}`, { method: "DELETE" });
    }, "Resource deleted.");
  }

  async function deleteUser(user: AdminUser) {
    if (user.id === admin?.id) return;
    const bookingCount = user._count?.resavation ?? 0;
    const detail = bookingCount > 0 ? ` Their ${bookingCount} reservation${bookingCount === 1 ? "" : "s"} will also be deleted.` : "";
    if (!window.confirm(`Permanently delete ${user.firstName} ${user.lastName}?${detail}`)) return;
    await runAction(user.id, async () => {
      await apiRequest(`/api/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
    }, "User deleted.");
  }

  async function finishMaintenance(item: Maintenance) {
    if (!window.confirm(`Mark maintenance for “${item.resource.name}” as finished now?`)) return;
    await runAction(item.id, async () => {
      await apiRequest(`/api/maintenance/${encodeURIComponent(item.id)}/finish`, { method: "POST" });
    }, "Maintenance marked as finished.");
  }

  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      location: String(formData.get("location") ?? ""),
      status: String(formData.get("status") ?? "ACTIVE"),
    };
    const code = String(formData.get("code") ?? "").trim();
    const capacity = String(formData.get("maxCapacity") ?? "").trim();
    if (code) payload.code = code;
    if (capacity) payload.maxCapacity = Number(capacity);

    setActionError("");
    setBusyId("resource-form");
    try {
      await apiRequest(editingResource ? `/api/resources/${encodeURIComponent(editingResource.id)}` : "/api/resources", {
        method: editingResource ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      await loadCollections();
      setResourceDialog(false);
      setEditingResource(null);
      setNotice(editingResource ? "Resource updated." : "Resource added.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save the resource.");
    } finally {
      setBusyId("");
    }
  }

  async function saveMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startInput = String(formData.get("startTime") ?? "");
    const endInput = String(formData.get("endTime") ?? "");
    const payload = {
      resourceId: String(formData.get("resourceId") ?? ""),
      description: String(formData.get("description") ?? ""),
      startTime: new Date(startInput).toISOString(),
      endTime: new Date(endInput).toISOString(),
      maintenancestatus: "INPROGRESS",
    };

    setActionError("");
    setBusyId("maintenance-form");
    try {
      await apiRequest("/api/maintenance", { method: "POST", body: JSON.stringify(payload) });
      await loadCollections();
      setMaintenanceDialog(false);
      setNotice("Maintenance created. It will stay in progress until you finish it manually.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not create maintenance.");
    } finally {
      setBusyId("");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
  }

  const pageTitle = navigation.find((item) => item.id === section)?.label ?? "Overview";

  if (loading) {
    return <main className="admin-loading"><span className="loading-mark"><LoaderCircle size={22} /></span><p>Opening your workspace…</p></main>;
  }

  if (!admin) {
    return (
      <main className="admin-denied">
        <div className="denied-icon"><ShieldCheck size={24} /></div>
        <h1>Admin access required</h1>
        <p>{actionError || "Sign in with an administrator account to continue."}</p>
        <Link href="/login" className="admin-button admin-button-primary">Back to sign in</Link>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin" aria-label="PrimeWave Lab admin home">
          <span className="admin-brand-mark"><Activity size={19} /></span>
          <span>primewave<span>lab</span></span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="admin-nav" aria-label="Admin sections">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`admin-nav-item ${section === id ? "is-active" : ""}`} onClick={() => { setSection(id); setSearch(""); setActionError(""); }}>
              <Icon size={17} strokeWidth={1.9} /><span>{label}</span>
              {id === "reservations" && pendingReservations.length > 0 && <span className="nav-count">{pendingReservations.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-help">
          <div className="help-icon"><CircleHelp size={17} /></div>
          <strong>Need a hand?</strong>
          <span>Manage your space and team from one place.</span>
        </div>

        <button type="button" className="sidebar-logout" onClick={logout}><LogOut size={16} /> Sign out</button>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{pageTitle}</strong></div>
          <div className="topbar-right">
            <span className="today-label">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span>
            <button className="icon-button notification-button" type="button" aria-label="Notifications" title="Notifications"><Bell size={17} /><i /></button>
            <div className="admin-profile">
              <span className="profile-avatar">{admin.firstName.charAt(0)}{admin.lastName.charAt(0)}</span>
              <span className="profile-copy"><strong>{admin.firstName} {admin.lastName}</strong><small>Administrator</small></span>
              <ChevronDown size={14} className="profile-chevron" />
            </div>
          </div>
        </header>

        <div className="admin-content">
          <div className="page-heading-row">
            <div>
              <div className="eyebrow">PRIMEWAVE LAB · ADMIN</div>
              <h1>{section === "overview" ? `Good day, ${admin.firstName}` : pageTitle}</h1>
              <p>{section === "overview" ? "Here’s what’s happening across your workspace." : sectionCopy(section)}</p>
            </div>
            <div className="heading-actions">
              <button type="button" className="admin-button admin-button-secondary" onClick={() => { setActionError(""); void loadCollections().catch((error) => setActionError(error instanceof Error ? error.message : "Refresh failed.")); }}><Activity size={15} /> Refresh</button>
              {section === "resources" && <button type="button" className="admin-button admin-button-primary" onClick={() => { setEditingResource(null); setActionError(""); setResourceDialog(true); }}><Plus size={16} /> Add resource</button>}
              {section === "maintenance" && <button type="button" className="admin-button admin-button-primary" onClick={() => { setActionError(""); setMaintenanceDialog(true); }}><Plus size={16} /> Schedule maintenance</button>}
            </div>
          </div>

          {actionError && <div className="admin-alert admin-alert-error" role="alert"><span>!</span>{actionError}<button type="button" onClick={() => setActionError("")} aria-label="Dismiss"><X size={15} /></button></div>}
          {notice && <div className="admin-alert admin-alert-success" role="status"><CheckCircle2 size={16} />{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}

          {section === "overview" && (
            <>
              <div className="metrics-grid">
                <MetricCard label="Pending reservations" value={pendingReservations.length} note="Waiting for your review" icon={CalendarClock} tone="mint" trend={<ArrowUpRight size={14} />} />
                <MetricCard label="Active resources" value={activeResources.length} note={`${resources.length} total resources`} icon={DoorOpen} tone="blue" trend={<ArrowUpRight size={14} />} />
                <MetricCard label="In maintenance" value={ongoingMaintenance.length} note="Finish manually when ready" icon={Wrench} tone="amber" trend={<Clock3 size={14} />} />
                <MetricCard label="Registered users" value={users.length} note="Across your workspace" icon={Users} tone="violet" trend={<ArrowUpRight size={14} />} />
              </div>

              <div className="overview-grid">
                <section className="panel-card overview-reservations">
                  <div className="panel-heading"><div><h2>Reservation requests</h2><p>Review the latest bookings</p></div><button type="button" className="text-button" onClick={() => setSection("reservations")}>View all <ArrowUpRight size={14} /></button></div>
                  {pendingReservations.length === 0 ? <EmptyState icon={CheckCircle2} title="You’re all caught up" message="There are no reservations waiting for approval." /> : (
                    <div className="compact-list">
                      {pendingReservations.slice(0, 5).map((item) => <ReservationRow key={item.id} item={item} />)}
                    </div>
                  )}
                </section>
                <section className="panel-card overview-side-card">
                  <div className="panel-heading"><div><h2>Today at a glance</h2><p>Workspace activity</p></div><span className="today-dot" /></div>
                  <div className="activity-summary"><span className="summary-icon summary-icon-teal"><CalendarClock size={17} /></span><div><strong>{todayReservations.length}</strong><span>reservations today</span></div></div>
                  <div className="activity-summary"><span className="summary-icon summary-icon-orange"><HardHat size={17} /></span><div><strong>{ongoingMaintenance.length}</strong><span>ongoing maintenance</span></div></div>
                  <div className="activity-summary"><span className="summary-icon summary-icon-blue"><DoorOpen size={17} /></span><div><strong>{resources.length - activeResources.length}</strong><span>resources unavailable</span></div></div>
                  <div className="side-card-footer"><ShieldCheck size={15} /> Changes are saved securely.</div>
                </section>
              </div>

              <div className="overview-grid overview-grid-bottom">
                <section className="panel-card">
                  <div className="panel-heading"><div><h2>Resources</h2><p>Recently added to your workspace</p></div><button type="button" className="text-button" onClick={() => setSection("resources")}>Manage <ArrowUpRight size={14} /></button></div>
                  {resources.length === 0 ? <EmptyState icon={DoorOpen} title="No resources yet" message="Add your first resource to get started." /> : <div className="resource-mini-list">{resources.slice(0, 4).map((resource) => <div className="resource-mini" key={resource.id}><span className="resource-mini-icon"><DoorOpen size={16} /></span><span className="resource-mini-copy"><strong>{resource.name}</strong><small>{resource.code} · {resource.resourceCategory.name}</small></span><StatusPill status={resource.status} /></div>)}</div>}
                </section>
                <section className="panel-card">
                  <div className="panel-heading"><div><h2>Maintenance</h2><p>Active work orders</p></div><button type="button" className="text-button" onClick={() => setSection("maintenance")}>View all <ArrowUpRight size={14} /></button></div>
                  {ongoingMaintenance.length === 0 ? <EmptyState icon={Wrench} title="Nothing under maintenance" message="Resources are ready to use." /> : <div className="maintenance-mini-list">{ongoingMaintenance.slice(0, 3).map((item) => <div className="maintenance-mini" key={item.id}><span className="maintenance-mini-icon"><Wrench size={15} /></span><div><strong>{item.resource.name}</strong><small>{item.description}</small></div><span className="in-progress-dot" title="In progress" /></div>)}</div>}
                </section>
              </div>
            </>
          )}

          {section !== "overview" && (
            <section className="panel-card data-panel">
              <div className="table-toolbar">
                <div className="table-intro"><strong>{section === "reservations" ? `${reservations.length} reservations` : section === "resources" ? `${resources.length} resources` : section === "maintenance" ? `${maintenance.length} work orders` : `${users.length} users`}</strong><span>Manage your {section} here</span></div>
                <label className="table-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${section}…`} aria-label={`Search ${section}`} /></label>
              </div>

              {section === "reservations" && <ReservationsTable items={filteredReservations} busyId={busyId} onAction={handleReservation} />}
              {section === "resources" && <ResourcesTable items={filteredResources} busyId={busyId} onEdit={(item) => { setEditingResource(item); setActionError(""); setResourceDialog(true); }} onDelete={deleteResource} />}
              {section === "maintenance" && <MaintenanceTable items={filteredMaintenance} busyId={busyId} onFinish={finishMaintenance} />}
              {section === "users" && <UsersTable items={filteredUsers} currentUserId={admin.id} busyId={busyId} onDelete={deleteUser} />}
            </section>
          )}
        </div>
      </section>

      {resourceDialog && <ResourceModal resource={editingResource} categories={categories} busy={busyId === "resource-form"} onClose={() => { setResourceDialog(false); setEditingResource(null); }} onSubmit={saveResource} />}
      {maintenanceDialog && <MaintenanceModal resources={resources.filter((item) => item.status === "ACTIVE")} busy={busyId === "maintenance-form"} onClose={() => setMaintenanceDialog(false)} onSubmit={saveMaintenance} />}
    </main>
  );
}

function sectionCopy(section: Section) {
  const copy: Record<Section, string> = {
    overview: "Your workspace at a glance.",
    reservations: "Review requests and keep bookings moving.",
    resources: "Add, update, and organize the things your team can reserve.",
    maintenance: "Schedule work and mark it finished when it’s actually done.",
    users: "See the people who can access your workspace.",
  };
  return copy[section];
}

function MetricCard({ label, value, note, icon: Icon, tone, trend }: { label: string; value: number; note: string; icon: typeof Users; tone: string; trend: ReactNode }) {
  return <article className="metric-card"><div className={`metric-icon metric-${tone}`}><Icon size={18} /></div><span className="metric-trend">{trend}</span><div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-note">{note}</div></article>;
}

function EmptyState({ icon: Icon, title, message }: { icon: typeof Users; title: string; message: string }) {
  return <div className="empty-state"><span><Icon size={19} /></span><strong>{title}</strong><p>{message}</p></div>;
}

function StatusPill({ status }: { status: string }) {
  const label = status === "COMFORMED" ? "Confirmed" : status === "INPROGRESS" ? "In progress" : status.charAt(0) + status.slice(1).toLowerCase();
  const style = status === "ACTIVE" || status === "COMFORMED" || status === "COMPLETE" ? "status-green" : status === "PENDING" || status === "WAITING" || status === "INPROGRESS" ? "status-amber" : status === "BLOCKED" || status === "INACTIVE" ? "status-red" : "status-gray";
  return <span className={`status-pill ${style}`}><i />{label}</span>;
}

function ReservationRow({ item }: { item: Reservation }) {
  return <div className="reservation-row"><div className="reservation-avatar">{initials(item.user)}</div><div className="reservation-copy"><strong>{item.user.firstName} {item.user.lastName}</strong><span>{item.resource?.name ?? "Resource removed"}</span></div><div className="reservation-when"><strong>{formatDate(item.StartTime, true)}</strong><span>{item.title || "Resource reservation"}</span></div><StatusPill status={item.cancelledAt ? "CANCELLED" : item.status} /></div>;
}

function ReservationsTable({ items, busyId, onAction }: { items: Reservation[]; busyId: string; onAction: (id: string, action: "CONFIRM" | "REJECT") => void }) {
  if (items.length === 0) return <EmptyState icon={CalendarClock} title="No reservations found" message="New requests will show up here." />;
  return <div className="table-scroll"><table className="admin-table"><thead><tr><th>REQUESTED BY</th><th>RESOURCE</th><th>DATE & TIME</th><th>STATUS</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{items.map((item) => {
    const isPending = item.status === "PENDING" && !item.cancelledAt;
    return <tr key={item.id}><td><div className="table-person"><span className="table-avatar">{initials(item.user)}</span><span><strong>{item.user.firstName} {item.user.lastName}</strong><small>{item.user.email}</small></span></div></td><td><strong className="table-primary">{item.resource?.name ?? "Resource removed"}</strong><small className="table-secondary">{item.resource?.code ?? "—"}</small></td><td><strong className="table-primary">{formatDate(item.StartTime)}</strong><small className="table-secondary">{formatDate(item.StartTime, true)} – {new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(item.Endtime))}</small></td><td><StatusPill status={item.cancelledAt ? "CANCELLED" : item.status} /></td><td className="align-right">{isPending ? <div className="row-actions"><button type="button" className="small-action small-action-confirm" disabled={busyId === item.id} onClick={() => onAction(item.id, "CONFIRM")}><Check size={14} /> Confirm</button><button type="button" className="small-action small-action-reject" disabled={busyId === item.id} onClick={() => onAction(item.id, "REJECT")}><X size={14} /> Reject</button></div> : <span className="no-action">—</span>}</td></tr>;
  })}</tbody></table></div>;
}

function ResourcesTable({ items, busyId, onEdit, onDelete }: { items: Resource[]; busyId: string; onEdit: (item: Resource) => void; onDelete: (item: Resource) => void }) {
  if (items.length === 0) return <EmptyState icon={DoorOpen} title="No resources found" message="Add a resource or try another search." />;
  return <div className="table-scroll"><table className="admin-table"><thead><tr><th>RESOURCE</th><th>CATEGORY</th><th>LOCATION</th><th>STATUS</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><div className="resource-table-cell"><span className="table-resource-icon"><DoorOpen size={16} /></span><span><strong className="table-primary">{item.name}</strong><small className="table-secondary">{item.code}{item.maxCapacity ? ` · Capacity ${item.maxCapacity}` : ""}</small></span></div></td><td><span className="category-tag">{item.resourceCategory.name}</span></td><td><span className="location-cell"><MapPin size={13} />{item.location || "Not specified"}</span></td><td><StatusPill status={item.status} /></td><td className="align-right"><div className="row-actions"><button type="button" className="icon-button row-icon-button" disabled={busyId === item.id} onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`} title="Edit resource"><Settings2 size={16} /></button><button type="button" className="icon-button row-icon-button row-icon-danger" disabled={busyId === item.id} onClick={() => onDelete(item)} aria-label={`Delete ${item.name}`} title="Delete resource"><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>;
}

function MaintenanceTable({ items, busyId, onFinish }: { items: Maintenance[]; busyId: string; onFinish: (item: Maintenance) => void }) {
  if (items.length === 0) return <EmptyState icon={Wrench} title="No maintenance found" message="Scheduled maintenance will show up here." />;
  return <div className="table-scroll"><table className="admin-table"><thead><tr><th>RESOURCE</th><th>WORK DETAILS</th><th>SCHEDULED</th><th>STATUS</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><div className="resource-table-cell"><span className="table-resource-icon table-resource-amber"><Wrench size={16} /></span><span><strong className="table-primary">{item.resource.name}</strong><small className="table-secondary">{item.resource.code}</small></span></div></td><td><span className="work-description">{item.description}</span></td><td><strong className="table-primary">{formatDate(item.startTime)}</strong><small className="table-secondary">Until {formatDate(item.endTime, true)}</small></td><td><StatusPill status={item.maintenancestatus} /></td><td className="align-right">{item.maintenancestatus === "INPROGRESS" ? <button type="button" className="small-action small-action-confirm" disabled={busyId === item.id} onClick={() => onFinish(item)}><Check size={14} /> Mark finished</button> : <span className="no-action">Finished {formatDate(item.endTime)}</span>}</td></tr>)}</tbody></table><p className="manual-finish-note"><Clock3 size={14} /> Maintenance stays in progress until an administrator marks it finished.</p></div>;
}

function UsersTable({ items, currentUserId, busyId, onDelete }: { items: AdminUser[]; currentUserId: string; busyId: string; onDelete: (user: AdminUser) => void }) {
  if (items.length === 0) return <EmptyState icon={Users} title="No users found" message="Try a different search." />;
  return <div className="table-scroll"><table className="admin-table"><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>RESERVATIONS</th><th>JOINED</th><th className="align-right">ACTIONS</th></tr></thead><tbody>{items.map((user) => <tr key={user.id}><td><div className="table-person"><span className="table-avatar">{initials(user)}</span><span><strong>{user.firstName} {user.lastName}</strong><small>{user.email} · {user.phone}</small></span></div></td><td><span className={`role-tag ${user.role === "ADMIN" ? "role-admin" : "role-user"}`}>{user.role === "ADMIN" ? "Admin" : "User"}</span></td><td><StatusPill status={user.status} /></td><td><span className="reservation-count">{user._count?.resavation ?? 0}</span></td><td><span className="table-secondary plain-secondary">{formatDate(user.createdAt)}</span></td><td className="align-right">{user.id === currentUserId ? <span className="self-label">You</span> : <button type="button" className="icon-button row-icon-button row-icon-danger" disabled={busyId === user.id} onClick={() => onDelete(user)} aria-label={`Delete ${user.firstName} ${user.lastName}`} title="Delete user and their reservations"><Trash2 size={16} /></button>}</td></tr>)}</tbody></table><p className="manual-finish-note"><ShieldCheck size={14} /> Your own administrator account can’t be deleted from this page.</p></div>;
}

function ResourceModal({ resource, categories, busy, onClose, onSubmit }: { resource: Resource | null; categories: ResourceCategory[]; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title={resource ? "Update resource" : "Add a resource"} description={resource ? "Update the details people use to find this resource." : "Add a room, piece of equipment, or shared space."} onClose={onClose}>
    <form className="admin-form" onSubmit={onSubmit}>
      <label className="admin-field"><span>Resource name</span><input name="name" defaultValue={resource?.name} placeholder="e.g. Design studio" minLength={2} maxLength={100} required /></label>
      <div className="admin-form-row"><label className="admin-field"><span>Category</span><select name="categoryId" defaultValue={resource?.categoryId ?? ""} required><option value="" disabled>Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="admin-field"><span>Resource code <small>Optional</small></span><input name="code" defaultValue={resource?.code} placeholder="Auto-generated" minLength={2} maxLength={50} /></label></div>
      <label className="admin-field"><span>Description</span><textarea name="description" defaultValue={resource?.description} placeholder="What should people know before reserving it?" minLength={5} rows={3} required /></label>
      <div className="admin-form-row"><label className="admin-field"><span>Location</span><input name="location" defaultValue={resource?.location ?? ""} placeholder="Building, floor, or room" maxLength={255} /></label><label className="admin-field"><span>Capacity <small>Optional</small></span><input name="maxCapacity" type="number" defaultValue={resource?.maxCapacity ?? ""} placeholder="e.g. 12" min={1} step={1} /></label></div>
      {resource && <label className="admin-field"><span>Status</span><select name="status" defaultValue={resource.status}><option value="ACTIVE">Active</option><option value="WAITING">Waiting</option><option value="INACTIVE">Inactive</option></select></label>}
      <div className="modal-actions"><button type="button" className="admin-button admin-button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="admin-button admin-button-primary" disabled={busy}>{busy ? "Saving…" : resource ? "Save changes" : "Add resource"}</button></div>
    </form>
  </Modal>;
}

function MaintenanceModal({ resources, busy, onClose, onSubmit }: { resources: Resource[]; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  return <Modal title="Schedule maintenance" description="Set the expected window. This work order will remain active until you finish it." onClose={onClose}>
    {resources.length === 0 ? <div className="modal-empty"><Wrench size={22} /><strong>No eligible resources</strong><span>Add or activate a resource before scheduling maintenance.</span><button type="button" className="admin-button admin-button-secondary" onClick={onClose}>Close</button></div> : <form className="admin-form" onSubmit={onSubmit}>
      <label className="admin-field"><span>Resource</span><select name="resourceId" defaultValue="" required><option value="" disabled>Select resource</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {resource.code}</option>)}</select></label>
      <label className="admin-field"><span>Work details</span><textarea name="description" placeholder="Describe the maintenance work" minLength={3} rows={3} required /></label>
      <div className="admin-form-row"><label className="admin-field"><span>Starts</span><input name="startTime" type="datetime-local" defaultValue={toLocalDateTime(now)} required /></label><label className="admin-field"><span>Expected end</span><input name="endTime" type="datetime-local" defaultValue={toLocalDateTime(later)} required /></label></div>
      <div className="manual-note"><Clock3 size={15} /> This work order will not finish automatically.</div>
      <div className="modal-actions"><button type="button" className="admin-button admin-button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="admin-button admin-button-primary" disabled={busy}>{busy ? "Scheduling…" : "Create maintenance"}</button></div>
    </form>}
  </Modal>;
}

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{description}</p></div><button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></header>{children}</section></div>;
}
