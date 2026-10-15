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
    return <main className="admin-loading [min-height:100vh] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [padding:24px] [color:#6c7a82] [background:#f5f7f8] [text-align:center] [&_p]:[margin:13px_0_0] [&_p]:[font-size:11px]"><span className="loading-mark [width:45px] [height:45px] [display:grid] [place-items:center] [border-radius:14px] [color:#11807d] [background:#e5f4f0] [&_svg]:animate-spin [&_svg]:[animation-duration:1.1s]"><LoaderCircle size={22} /></span><p>Opening your workspace…</p></main>;
  }

  if (!admin) {
    return (
      <main className="admin-denied [min-height:100vh] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [padding:24px] [color:#6c7a82] [background:#f5f7f8] [text-align:center] [&_h1]:[margin:16px_0_6px] [&_h1]:[color:#29404c] [&_h1]:[font-size:21px] [&_p]:[max-width:360px] [&_p]:[margin:0_0_17px] [&_p]:[color:#79878d] [&_p]:[font-size:11px] [&_p]:[line-height:1.6]">
        <div className="denied-icon [width:45px] [height:45px] [display:grid] [place-items:center] [border-radius:14px] [color:#11807d] [background:#e5f4f0]"><ShieldCheck size={24} /></div>
        <h1>Admin access required</h1>
        <p>{actionError || "Sign in with an administrator account to continue."}</p>
        <Link href="/login" className="admin-button admin-button-primary [min-height:36px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:7px] [padding:0_12px] [border:1px_solid_transparent] [border-radius:8px] [font-size:10px] [font-weight:650] [white-space:nowrap] [cursor:pointer] [transition:transform_.15s_ease,_box-shadow_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[transform:translateY(-1px)] disabled:[opacity:.58] disabled:[cursor:wait] [color:#fff] [background:#087e7e] [box-shadow:0_3px_8px_rgba(8,_126,_126,_.13)] [&:hover:not(:disabled)]:[background:#076e71] [&:hover:not(:disabled)]:[box-shadow:0_5px_12px_rgba(8,_126,_126,_.18)]">Back to sign in</Link>
      </main>
    );
  }

  return (
    <main className="admin-shell [min-height:100vh] [display:flex] [color:#1e303d] [background:#f5f7f8] max-[620px]:[display:block]">
      <aside className="admin-sidebar [width:238px] [min-height:100vh] [position:fixed] [inset:0_auto_0_0] [z-index:5] [display:flex] [flex-direction:column] [padding:24px_15px_18px] [border-right:1px_solid_#e9edef] [background:#fff] max-[820px]:[width:190px] max-[820px]:[padding-right:11px] max-[820px]:[padding-left:11px] max-[620px]:[width:100%] max-[620px]:[min-height:0] max-[620px]:[position:sticky] max-[620px]:[top:0] max-[620px]:[inset:0_0_auto] max-[620px]:[padding:10px_12px_8px] max-[620px]:[border-right:0] max-[620px]:[border-bottom:1px_solid_#e8eded] max-[620px]:[box-shadow:0_3px_10px_rgba(31,_52,_61,_.04)]">
        <Link className="admin-brand [display:flex] [align-items:center] [gap:10px] [margin:0_0_42px_8px] [color:#1d3441] [font-size:16px] [font-weight:750] [letter-spacing:-.55px] [text-decoration:none] [&>_span:last-child_>_span]:[color:#108584] [&>_span:last-child_>_span]:[font-weight:550] max-[620px]:[margin:0_0_10px_2px] max-[620px]:[font-size:14px] max-[620px]:[margin-right:40px]" href="/admin" aria-label="PrimeWave Lab admin home">
          <span className="admin-brand-mark [width:34px] [height:34px] [display:grid] [place-items:center] [border-radius:10px] [color:#fff] [background:linear-gradient(145deg,_#098e88,_#076b78)] [box-shadow:0_4px_8px_rgba(7,_113,_119,_.17)] max-[620px]:[width:29px] max-[620px]:[height:29px]"><Activity size={19} /></span>
          <span>primewave<span>lab</span></span>
        </Link>

        <div className="sidebar-label [padding:0_11px] [color:#a4afb4] [font-size:9px] [font-weight:760] [letter-spacing:1.1px] max-[620px]:[display:none]">WORKSPACE</div>
        <nav className="admin-nav [display:grid] [gap:5px] [margin-top:12px] max-[620px]:[display:flex] max-[620px]:[gap:4px] max-[620px]:[overflow-x:auto] max-[620px]:[margin:0] max-[620px]:[padding-bottom:2px] max-[620px]:[scrollbar-width:none] max-[620px]:[&::-webkit-scrollbar]:[display:none]" aria-label="Admin sections">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`admin-nav-item [height:42px] [width:100%] [display:flex] [align-items:center] [gap:12px] [padding:0_11px] [border:0] [border-radius:9px] [color:#70808a] [background:transparent] [text-align:left] [font-size:11px] [font-weight:570] [cursor:pointer] [transition:background_.15s_ease,_color_.15s_ease] hover:[color:#146e72] hover:[background:#f5f9f8] [&.is-active]:[color:#08797c] [&.is-active]:[background:#eaf6f4] [&.is-active]:[font-weight:680] [&.is-active_svg]:[color:#08817d] max-[620px]:[width:auto] max-[620px]:[height:34px] max-[620px]:[flex:0_0_auto] max-[620px]:[gap:6px] max-[620px]:[padding:0_9px] max-[620px]:[font-size:9px] max-[620px]:[&_svg]:[width:14px] max-[620px]:[&_svg]:[height:14px] max-[370px]:[padding:0_7px] max-[370px]:[&_span:not(.nav-count)]:[font-size:8px] ${section === id ? "is-active" : ""}`} onClick={() => { setSection(id); setSearch(""); setActionError(""); }}>
              <Icon size={17} strokeWidth={1.9} /><span>{label}</span>
              {id === "reservations" && pendingReservations.length > 0 && <span className="nav-count [min-width:20px] [height:20px] [display:grid] [place-items:center] [margin-left:auto] [border-radius:7px] [color:#a96c27] [background:#fff3df] [font-size:9px] [font-weight:750] max-[620px]:[min-width:16px] max-[620px]:[height:16px] max-[620px]:[margin-left:0] max-[620px]:[font-size:8px]">{pendingReservations.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-help [display:grid] [gap:8px] [margin:auto_3px_17px] [padding:14px_12px] [border:1px_solid_#e8efed] [border-radius:12px] [background:linear-gradient(145deg,_#f8fcfa,_#f3f8f7)] [&_strong]:[color:#334651] [&_strong]:[font-size:10px] [&>_span]:[color:#859299] [&>_span]:[font-size:9px] [&>_span]:[line-height:1.55] max-[620px]:[display:none]">
          <div className="help-icon [width:28px] [height:28px] [display:grid] [place-items:center] [border-radius:8px] [color:#13817e] [background:#e2f3ef]"><CircleHelp size={17} /></div>
          <strong>Need a hand?</strong>
          <span>Manage your space and team from one place.</span>
        </div>

        <button type="button" className="sidebar-logout [height:38px] [display:flex] [align-items:center] [gap:10px] [padding:0_11px] [border:0] [border-top:1px_solid_#eff2f2] [color:#839097] [background:#fff] [text-align:left] [font-size:10px] [cursor:pointer] hover:[color:#ba514b] max-[620px]:[position:absolute] max-[620px]:[top:10px] max-[620px]:[right:12px] max-[620px]:[width:31px] max-[620px]:[height:29px] max-[620px]:[justify-content:center] max-[620px]:[padding:0] max-[620px]:[border:1px_solid_#e9eeee] max-[620px]:[border-radius:8px] max-[620px]:[font-size:0] max-[620px]:[&_svg]:[width:14px] max-[620px]:[&_svg]:[height:14px]" onClick={logout}><LogOut size={16} /> Sign out</button>
      </aside>

      <section className="admin-main [width:calc(100%_-_238px)] [min-height:100vh] [margin-left:238px] max-[820px]:[width:calc(100%_-_190px)] max-[820px]:[margin-left:190px] max-[620px]:[width:100%] max-[620px]:[min-height:calc(100vh_-_93px)] max-[620px]:[margin:0]">
        <header className="admin-topbar [height:66px] [display:flex] [align-items:center] [justify-content:space-between] [padding:0_34px] [border-bottom:1px_solid_#e9edef] [background:rgba(255,_255,_255,_.94)] max-[1080px]:[padding:0_23px] max-[620px]:[height:49px] max-[620px]:[padding:0_15px]">
          <div className="breadcrumb [color:#9aa5aa] [font-size:10px] [&_span]:[margin:0_8px] [&_span]:[color:#c2cacc] [&_strong]:[color:#43545e] [&_strong]:[font-weight:620]">Workspace <span>/</span> <strong>{pageTitle}</strong></div>
          <div className="topbar-right [display:flex] [align-items:center] [gap:19px] max-[620px]:[gap:10px]">
            <span className="today-label [color:#77868d] [font-size:10px] max-[820px]:[display:none]">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span>
            <button className="icon-button notification-button [position:relative] [display:inline-grid] [place-items:center] [border:1px_solid_#e9eeee] [border-radius:9px] [color:#74838b] [background:#fff] [cursor:pointer] [transition:color_.15s_ease,_border-color_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[border-color:#cce5e1] [&:hover:not(:disabled)]:[color:#087d7e] [&:hover:not(:disabled)]:[background:#f7fbfa] disabled:[opacity:.5] disabled:[cursor:wait] [width:33px] [height:33px] [&_i]:[width:6px] [&_i]:[height:6px] [&_i]:[position:absolute] [&_i]:[top:6px] [&_i]:[right:7px] [&_i]:[border:1px_solid_#fff] [&_i]:[border-radius:50%] [&_i]:[background:#e49a55] max-[620px]:[width:29px] max-[620px]:[height:29px] max-[620px]:[&_svg]:[width:15px] max-[620px]:[&_svg]:[height:15px]" type="button" aria-label="Notifications" title="Notifications"><Bell size={17} /><i /></button>
            <div className="admin-profile [display:flex] [align-items:center] [gap:9px] [padding-left:16px] [border-left:1px_solid_#e9eded] max-[820px]:[padding-left:10px] max-[620px]:[padding-left:9px]">
              <span className="profile-avatar [width:31px] [height:31px] [display:grid] [place-items:center] [border-radius:10px] [color:#176e70] [background:#e3f2ef] [font-size:10px] [font-weight:760] max-[620px]:[width:27px] max-[620px]:[height:27px] max-[370px]:[display:none]">{admin.firstName.charAt(0)}{admin.lastName.charAt(0)}</span>
              <span className="profile-copy [display:grid] [gap:3px] [&_strong]:[color:#344651] [&_strong]:[font-size:10px] [&_strong]:[font-weight:650] [&_small]:[color:#98a3a8] [&_small]:[font-size:9px] max-[820px]:[display:none]"><strong>{admin.firstName} {admin.lastName}</strong><small>Administrator</small></span>
              <ChevronDown size={14} className="profile-chevron [color:#a0aaae] max-[820px]:[display:none]" />
            </div>
          </div>
        </header>

        <div className="admin-content [width:min(1360px,_100%)] [margin:0_auto] [padding:34px] max-[1080px]:[padding:27px_23px] max-[620px]:[padding:22px_14px_30px] max-[370px]:[padding-right:11px] max-[370px]:[padding-left:11px]">
          <div className="page-heading-row [display:flex] [align-items:flex-end] [justify-content:space-between] [gap:18px] [margin-bottom:24px] [&_h1]:[margin:0] [&_h1]:[color:#203541] [&_h1]:[font-size:25px] [&_h1]:[font-weight:690] [&_h1]:[letter-spacing:-.9px] [&_p]:[margin:7px_0_0] [&_p]:[color:#859198] [&_p]:[font-size:11px] max-[620px]:[align-items:flex-start] max-[620px]:[flex-direction:column] max-[620px]:[gap:13px] max-[620px]:[margin-bottom:18px] max-[620px]:[&_h1]:[font-size:22px] max-[620px]:[&_p]:[max-width:320px] max-[620px]:[&_p]:[line-height:1.5]">
            <div>
              <div className="eyebrow [margin-bottom:7px] [color:#16827f] [font-size:9px] [font-weight:760] [letter-spacing:1.1px]">PRIMEWAVE LAB · ADMIN</div>
              <h1>{section === "overview" ? `Good day, ${admin.firstName}` : pageTitle}</h1>
              <p>{section === "overview" ? "Here’s what’s happening across your workspace." : sectionCopy(section)}</p>
            </div>
            <div className="heading-actions [display:flex] [align-items:center] [gap:9px] max-[620px]:[width:100%] max-[620px]:[&.admin-button]:[flex:1]">
              <button type="button" className="admin-button admin-button-secondary [min-height:36px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:7px] [padding:0_12px] [border:1px_solid_transparent] [border-radius:8px] [font-size:10px] [font-weight:650] [white-space:nowrap] [cursor:pointer] [transition:transform_.15s_ease,_box-shadow_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[transform:translateY(-1px)] disabled:[opacity:.58] disabled:[cursor:wait] [border-color:#e2e8e8] [color:#56666f] [background:#fff] [&:hover:not(:disabled)]:[border-color:#cddfdd] [&:hover:not(:disabled)]:[background:#f9fcfb]" onClick={() => { setActionError(""); void loadCollections().catch((error) => setActionError(error instanceof Error ? error.message : "Refresh failed.")); }}><Activity size={15} /> Refresh</button>
              {section === "resources" && <button type="button" className="admin-button admin-button-primary [min-height:36px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:7px] [padding:0_12px] [border:1px_solid_transparent] [border-radius:8px] [font-size:10px] [font-weight:650] [white-space:nowrap] [cursor:pointer] [transition:transform_.15s_ease,_box-shadow_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[transform:translateY(-1px)] disabled:[opacity:.58] disabled:[cursor:wait] [color:#fff] [background:#087e7e] [box-shadow:0_3px_8px_rgba(8,_126,_126,_.13)] [&:hover:not(:disabled)]:[background:#076e71] [&:hover:not(:disabled)]:[box-shadow:0_5px_12px_rgba(8,_126,_126,_.18)]" onClick={() => { setEditingResource(null); setActionError(""); setResourceDialog(true); }}><Plus size={16} /> Add resource</button>}
              {section === "maintenance" && <button type="button" className="admin-button admin-button-primary [min-height:36px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:7px] [padding:0_12px] [border:1px_solid_transparent] [border-radius:8px] [font-size:10px] [font-weight:650] [white-space:nowrap] [cursor:pointer] [transition:transform_.15s_ease,_box-shadow_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[transform:translateY(-1px)] disabled:[opacity:.58] disabled:[cursor:wait] [color:#fff] [background:#087e7e] [box-shadow:0_3px_8px_rgba(8,_126,_126,_.13)] [&:hover:not(:disabled)]:[background:#076e71] [&:hover:not(:disabled)]:[box-shadow:0_5px_12px_rgba(8,_126,_126,_.18)]" onClick={() => { setActionError(""); setMaintenanceDialog(true); }}><Plus size={16} /> Schedule maintenance</button>}
            </div>
          </div>

          {actionError && <div className="admin-alert admin-alert-error [display:flex] [align-items:center] [gap:9px] [margin:-8px_0_18px] [padding:10px_12px] [border:1px_solid] [border-radius:9px] [font-size:10px] [line-height:1.5] [&>_span]:[width:17px] [&>_span]:[height:17px] [&>_span]:[display:grid] [&>_span]:[place-items:center] [&>_span]:[flex:0_0_auto] [&>_span]:[border-radius:50%] [&>_span]:[color:#fff] [&>_span]:[background:#c66b60] [&>_span]:[font-weight:750] [&>_button]:[display:grid] [&>_button]:[place-items:center] [&>_button]:[margin-left:auto] [&>_button]:[padding:2px] [&>_button]:[border:0] [&>_button]:[color:currentColor] [&>_button]:[background:transparent] [&>_button]:[cursor:pointer] [border-color:#efd3cf] [color:#98463f] [background:#fff8f7]" role="alert"><span>!</span>{actionError}<button type="button" onClick={() => setActionError("")} aria-label="Dismiss"><X size={15} /></button></div>}
          {notice && <div className="admin-alert admin-alert-success [display:flex] [align-items:center] [gap:9px] [margin:-8px_0_18px] [padding:10px_12px] [border:1px_solid] [border-radius:9px] [font-size:10px] [line-height:1.5] [&>_span]:[width:17px] [&>_span]:[height:17px] [&>_span]:[display:grid] [&>_span]:[place-items:center] [&>_span]:[flex:0_0_auto] [&>_span]:[border-radius:50%] [&>_span]:[color:#fff] [&>_span]:[background:#c66b60] [&>_span]:[font-weight:750] [&>_button]:[display:grid] [&>_button]:[place-items:center] [&>_button]:[margin-left:auto] [&>_button]:[padding:2px] [&>_button]:[border:0] [&>_button]:[color:currentColor] [&>_button]:[background:transparent] [&>_button]:[cursor:pointer] [border-color:#cde8dc] [color:#347153] [background:#f3fbf7]" role="status"><CheckCircle2 size={16} />{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}

          {section === "overview" && (
            <>
              <div className="metrics-grid [display:grid] [grid-template-columns:repeat(4,_minmax(0,_1fr))] [gap:15px] max-[820px]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[620px]:[gap:9px]">
                <MetricCard label="Pending reservations" value={pendingReservations.length} note="Waiting for your review" icon={CalendarClock} tone="mint" trend={<ArrowUpRight size={14} />} />
                <MetricCard label="Active resources" value={activeResources.length} note={`${resources.length} total resources`} icon={DoorOpen} tone="blue" trend={<ArrowUpRight size={14} />} />
                <MetricCard label="In maintenance" value={ongoingMaintenance.length} note="Finish manually when ready" icon={Wrench} tone="amber" trend={<Clock3 size={14} />} />
                <MetricCard label="Registered users" value={users.length} note="Across your workspace" icon={Users} tone="violet" trend={<ArrowUpRight size={14} />} />
              </div>

              <div className="overview-grid [display:grid] [grid-template-columns:minmax(0,_1.6fr)_minmax(250px,_.9fr)] [gap:15px] [margin-top:17px] [&.panel-card]:[padding:18px] max-[1080px]:[grid-template-columns:minmax(0,_1.35fr)_minmax(220px,_.85fr)] max-[820px]:[grid-template-columns:1fr] max-[620px]:[grid-template-columns:1fr] max-[620px]:[gap:10px] max-[620px]:[margin-top:10px] max-[620px]:[&.panel-card]:[padding:14px]">
                <section className="panel-card overview-reservations [min-width:0] [border:1px_solid_#e9edef] [border-radius:13px] [background:#fff] [box-shadow:0_2px_5px_rgba(31,_52,_61,_.02)] max-[620px]:[&.data-panel]:[border-radius:11px]">
                  <div className="panel-heading [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:12px] [&_h2]:[margin:0] [&_h2]:[color:#2b3e49] [&_h2]:[font-size:12px] [&_h2]:[font-weight:680] [&_h2]:[letter-spacing:-.1px] [&_p]:[margin:5px_0_0] [&_p]:[color:#9aa4a9] [&_p]:[font-size:9px]"><div><h2>Reservation requests</h2><p>Review the latest bookings</p></div><button type="button" className="text-button [display:inline-flex] [align-items:center] [gap:5px] [padding:2px_0] [border:0] [color:#13827e] [background:transparent] [font-size:9px] [font-weight:670] [cursor:pointer] hover:[color:#075d61]" onClick={() => setSection("reservations")}>View all <ArrowUpRight size={14} /></button></div>
                  {pendingReservations.length === 0 ? <EmptyState icon={CheckCircle2} title="You’re all caught up" message="There are no reservations waiting for approval." /> : (
                    <div className="compact-list [margin-top:13px]">
                      {pendingReservations.slice(0, 5).map((item) => <ReservationRow key={item.id} item={item} />)}
                    </div>
                  )}
                </section>
                <section className="panel-card overview-side-card [min-width:0] [border:1px_solid_#e9edef] [border-radius:13px] [background:#fff] [box-shadow:0_2px_5px_rgba(31,_52,_61,_.02)] max-[620px]:[&.data-panel]:[border-radius:11px]">
                  <div className="panel-heading [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:12px] [&_h2]:[margin:0] [&_h2]:[color:#2b3e49] [&_h2]:[font-size:12px] [&_h2]:[font-weight:680] [&_h2]:[letter-spacing:-.1px] [&_p]:[margin:5px_0_0] [&_p]:[color:#9aa4a9] [&_p]:[font-size:9px]"><div><h2>Today at a glance</h2><p>Workspace activity</p></div><span className="today-dot [width:8px] [height:8px] [margin-top:3px] [border-radius:50%] [background:#43ad8b] [box-shadow:0_0_0_4px_#e8f6f0]" /></div>
                  <div className="activity-summary [display:flex] [align-items:center] [gap:11px] [padding:15px_0] [border-bottom:1px_solid_#f0f2f2] [&>_div]:[display:grid] [&>_div]:[gap:3px] [&_strong]:[color:#344a55] [&_strong]:[font-size:14px] [&_strong]:[font-weight:700] [&_span:not(.summary-icon)]:[color:#8f9ca2] [&_span:not(.summary-icon)]:[font-size:9px]"><span className="summary-icon summary-icon-teal [width:32px] [height:32px] [display:grid] [place-items:center] [border-radius:10px] [color:#11827d] [background:#e8f5f1]"><CalendarClock size={17} /></span><div><strong>{todayReservations.length}</strong><span>reservations today</span></div></div>
                  <div className="activity-summary [display:flex] [align-items:center] [gap:11px] [padding:15px_0] [border-bottom:1px_solid_#f0f2f2] [&>_div]:[display:grid] [&>_div]:[gap:3px] [&_strong]:[color:#344a55] [&_strong]:[font-size:14px] [&_strong]:[font-weight:700] [&_span:not(.summary-icon)]:[color:#8f9ca2] [&_span:not(.summary-icon)]:[font-size:9px]"><span className="summary-icon summary-icon-orange [width:32px] [height:32px] [display:grid] [place-items:center] [border-radius:10px] [color:#bd8642] [background:#fff4e7]"><HardHat size={17} /></span><div><strong>{ongoingMaintenance.length}</strong><span>ongoing maintenance</span></div></div>
                  <div className="activity-summary [display:flex] [align-items:center] [gap:11px] [padding:15px_0] [border-bottom:1px_solid_#f0f2f2] [&>_div]:[display:grid] [&>_div]:[gap:3px] [&_strong]:[color:#344a55] [&_strong]:[font-size:14px] [&_strong]:[font-weight:700] [&_span:not(.summary-icon)]:[color:#8f9ca2] [&_span:not(.summary-icon)]:[font-size:9px]"><span className="summary-icon summary-icon-blue [width:32px] [height:32px] [display:grid] [place-items:center] [border-radius:10px] [color:#5980b1] [background:#ecf3fb]"><DoorOpen size={17} /></span><div><strong>{resources.length - activeResources.length}</strong><span>resources unavailable</span></div></div>
                  <div className="side-card-footer [display:flex] [align-items:center] [gap:6px] [padding-top:14px] [color:#96a3a4] [font-size:8px] [&_svg]:[color:#6aab91]"><ShieldCheck size={15} /> Changes are saved securely.</div>
                </section>
              </div>

              <div className="overview-grid overview-grid-bottom [display:grid] [grid-template-columns:minmax(0,_1.6fr)_minmax(250px,_.9fr)] [gap:15px] [margin-top:17px] [&.panel-card]:[padding:18px] max-[1080px]:[grid-template-columns:minmax(0,_1.35fr)_minmax(220px,_.85fr)] max-[820px]:[grid-template-columns:1fr] max-[620px]:[grid-template-columns:1fr] max-[620px]:[gap:10px] max-[620px]:[margin-top:10px] max-[620px]:[&.panel-card]:[padding:14px] [grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[820px]:[grid-template-columns:1fr_1fr]">
                <section className="panel-card [min-width:0] [border:1px_solid_#e9edef] [border-radius:13px] [background:#fff] [box-shadow:0_2px_5px_rgba(31,_52,_61,_.02)] max-[620px]:[&.data-panel]:[border-radius:11px]">
                  <div className="panel-heading [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:12px] [&_h2]:[margin:0] [&_h2]:[color:#2b3e49] [&_h2]:[font-size:12px] [&_h2]:[font-weight:680] [&_h2]:[letter-spacing:-.1px] [&_p]:[margin:5px_0_0] [&_p]:[color:#9aa4a9] [&_p]:[font-size:9px]"><div><h2>Resources</h2><p>Recently added to your workspace</p></div><button type="button" className="text-button [display:inline-flex] [align-items:center] [gap:5px] [padding:2px_0] [border:0] [color:#13827e] [background:transparent] [font-size:9px] [font-weight:670] [cursor:pointer] hover:[color:#075d61]" onClick={() => setSection("resources")}>Manage <ArrowUpRight size={14} /></button></div>
                  {resources.length === 0 ? <EmptyState icon={DoorOpen} title="No resources yet" message="Add your first resource to get started." /> : <div className="resource-mini-list [margin-top:12px]">{resources.slice(0, 4).map((resource) => <div className="resource-mini [display:flex] [align-items:center] [gap:10px] [padding:10px_0] [border-top:1px_solid_#f0f2f2] [&.status-pill]:[font-size:8px]" key={resource.id}><span className="resource-mini-icon [width:30px] [height:30px] [display:grid] [place-items:center] [flex:0_0_auto] [border-radius:9px] [color:#16817c] [background:#e8f4f1]"><DoorOpen size={16} /></span><span className="resource-mini-copy [min-width:0] [flex:1] [display:grid] [gap:4px] [&_strong]:[overflow:hidden] [&_strong]:[color:#455761] [&_strong]:[font-size:9px] [&_strong]:[font-weight:650] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&_small]:[overflow:hidden] [&_small]:[color:#9aa5a9] [&_small]:[font-size:8px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap]"><strong>{resource.name}</strong><small>{resource.code} · {resource.resourceCategory.name}</small></span><StatusPill status={resource.status} /></div>)}</div>}
                </section>
                <section className="panel-card [min-width:0] [border:1px_solid_#e9edef] [border-radius:13px] [background:#fff] [box-shadow:0_2px_5px_rgba(31,_52,_61,_.02)] max-[620px]:[&.data-panel]:[border-radius:11px]">
                  <div className="panel-heading [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:12px] [&_h2]:[margin:0] [&_h2]:[color:#2b3e49] [&_h2]:[font-size:12px] [&_h2]:[font-weight:680] [&_h2]:[letter-spacing:-.1px] [&_p]:[margin:5px_0_0] [&_p]:[color:#9aa4a9] [&_p]:[font-size:9px]"><div><h2>Maintenance</h2><p>Active work orders</p></div><button type="button" className="text-button [display:inline-flex] [align-items:center] [gap:5px] [padding:2px_0] [border:0] [color:#13827e] [background:transparent] [font-size:9px] [font-weight:670] [cursor:pointer] hover:[color:#075d61]" onClick={() => setSection("maintenance")}>View all <ArrowUpRight size={14} /></button></div>
                  {ongoingMaintenance.length === 0 ? <EmptyState icon={Wrench} title="Nothing under maintenance" message="Resources are ready to use." /> : <div className="maintenance-mini-list [margin-top:12px]">{ongoingMaintenance.slice(0, 3).map((item) => <div className="maintenance-mini [display:flex] [align-items:center] [gap:10px] [padding:10px_0] [border-top:1px_solid_#f0f2f2] [&>_div]:[min-width:0] [&>_div]:[flex:1] [&>_div]:[display:grid] [&>_div]:[gap:4px] [&_strong]:[overflow:hidden] [&_strong]:[color:#455761] [&_strong]:[font-size:9px] [&_strong]:[font-weight:650] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&_small]:[overflow:hidden] [&_small]:[color:#9aa5a9] [&_small]:[font-size:8px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap]" key={item.id}><span className="maintenance-mini-icon [width:30px] [height:30px] [display:grid] [place-items:center] [flex:0_0_auto] [border-radius:9px] [color:#16817c] [background:#e8f4f1] [color:#af7e3c] [background:#fff4e5]"><Wrench size={15} /></span><div><strong>{item.resource.name}</strong><small>{item.description}</small></div><span className="in-progress-dot [width:7px] [height:7px] [flex:0_0_auto] [border-radius:50%] [background:#e2a24e] [box-shadow:0_0_0_3px_#fff6e9]" title="In progress" /></div>)}</div>}
                </section>
              </div>
            </>
          )}

          {section !== "overview" && (
            <section className="panel-card data-panel [min-width:0] [border:1px_solid_#e9edef] [border-radius:13px] [background:#fff] [box-shadow:0_2px_5px_rgba(31,_52,_61,_.02)] max-[620px]:[&.data-panel]:[border-radius:11px] [overflow:hidden]">
              <div className="table-toolbar [min-height:72px] [display:flex] [align-items:center] [justify-content:space-between] [gap:16px] [padding:14px_19px] [border-bottom:1px_solid_#edf0f0] max-[620px]:[align-items:flex-start] max-[620px]:[flex-direction:column] max-[620px]:[padding:13px]">
                <div className="table-intro [display:grid] [gap:5px] [&_strong]:[color:#344953] [&_strong]:[font-size:11px] [&_strong]:[font-weight:680] [&_span]:[color:#98a3a8] [&_span]:[font-size:9px]"><strong>{section === "reservations" ? `${reservations.length} reservations` : section === "resources" ? `${resources.length} resources` : section === "maintenance" ? `${maintenance.length} work orders` : `${users.length} users`}</strong><span>Manage your {section} here</span></div>
                <label className="table-search [width:min(245px,_45%)] [height:34px] [display:flex] [align-items:center] [gap:8px] [padding:0_9px] [border:1px_solid_#e5eaea] [border-radius:8px] [color:#9aa6aa] [background:#fff] focus-within:[border-color:#89c4bc] focus-within:[box-shadow:0_0_0_3px_rgba(21,_133,_127,_.08)] [&_input]:[min-width:0] [&_input]:[flex:1] [&_input]:[border:0] [&_input]:[outline:0] [&_input]:[color:#465962] [&_input]:[background:transparent] [&_input]:[font-size:9px] [&_input::placeholder]:[color:#a6b0b4] [&_kbd]:[padding:2px_4px] [&_kbd]:[border:1px_solid_#e8ecec] [&_kbd]:[border-radius:4px] [&_kbd]:[color:#a6afb2] [&_kbd]:[background:#fafbfb] [&_kbd]:[font-family:inherit] [&_kbd]:[font-size:8px] max-[620px]:[width:100%]"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${section}…`} aria-label={`Search ${section}`} /></label>
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
  const toneClasses: Record<string, string> = {
    mint: "[color:#13847d] [background:#e5f5f1]",
    blue: "[color:#537fb5] [background:#ebf2fb]",
    amber: "[color:#b87e37] [background:#fff4e5]",
    violet: "[color:#8574b6] [background:#f0edfa]",
  };
  return <article className="metric-card [position:relative] [min-height:139px] [padding:17px_18px_15px] [border:1px_solid_#e9edef] [border-radius:13px] [background:#fff] [box-shadow:0_2px_5px_rgba(31,_52,_61,_.02)] max-[1080px]:[padding-right:13px] max-[1080px]:[padding-left:13px] max-[620px]:[min-height:125px] max-[620px]:[padding:13px]"><div className={`metric-icon [width:34px] [height:34px] [display:grid] [place-items:center] [border-radius:10px] max-[620px]:[width:30px] max-[620px]:[height:30px] max-[620px]:[&_svg]:[width:16px] max-[620px]:[&_svg]:[height:16px] ${toneClasses[tone] ?? ""}`}><Icon size={18} /></div><span className="metric-trend [position:absolute] [top:20px] [right:17px] [color:#9bb4ab] max-[620px]:[top:17px] max-[620px]:[right:13px]">{trend}</span><div className="metric-value [margin-top:14px] [color:#203643] [font-size:24px] [font-weight:700] [line-height:1] [letter-spacing:-.8px] max-[620px]:[margin-top:12px] max-[620px]:[font-size:21px]">{value}</div><div className="metric-label [margin-top:7px] [color:#52636d] [font-size:10px] [font-weight:650] max-[620px]:[font-size:9px]">{label}</div><div className="metric-note [margin-top:5px] [color:#a0aaae] [font-size:9px] max-[620px]:[font-size:8px]">{note}</div></article>;
}

function EmptyState({ icon: Icon, title, message }: { icon: typeof Users; title: string; message: string }) {
  return <div className="empty-state [min-height:155px] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [padding:24px_15px] [text-align:center] [&>_span]:[width:34px] [&>_span]:[height:34px] [&>_span]:[display:grid] [&>_span]:[place-items:center] [&>_span]:[margin-bottom:9px] [&>_span]:[border-radius:11px] [&>_span]:[color:#5c9e91] [&>_span]:[background:#ebf6f2] [&_strong]:[color:#50616a] [&_strong]:[font-size:10px] [&_strong]:[font-weight:650] [&_p]:[margin:5px_0_0] [&_p]:[color:#9ba6ab] [&_p]:[font-size:9px]"><span><Icon size={19} /></span><strong>{title}</strong><p>{message}</p></div>;
}

function StatusPill({ status }: { status: string }) {
  const label = status === "COMFORMED" ? "Confirmed" : status === "INPROGRESS" ? "In progress" : status.charAt(0) + status.slice(1).toLowerCase();
  const style = status === "ACTIVE" || status === "COMFORMED" || status === "COMPLETE" ? "status-green [color:#38835f] [background:#edf8f1]" : status === "PENDING" || status === "WAITING" || status === "INPROGRESS" ? "status-amber [color:#a87735] [background:#fff6e9]" : status === "BLOCKED" || status === "INACTIVE" ? "status-red [color:#a85950] [background:#fff0ee]" : "status-gray [color:#74838b] [background:#f0f3f3]";
  return <span className={`status-pill [display:inline-flex] [align-items:center] [gap:5px] [padding:5px_7px] [border-radius:6px] [font-size:8px] [font-weight:630] [white-space:nowrap] [&_i]:[width:5px] [&_i]:[height:5px] [&_i]:[border-radius:50%] [&_i]:[background:currentColor] ${style}`}><i />{label}</span>;
}

function ReservationRow({ item }: { item: Reservation }) {
  return <div className="reservation-row [min-width:0] [display:flex] [align-items:center] [gap:10px] [padding:11px_0] [border-top:1px_solid_#f0f2f2] [&.status-pill]:[margin-left:2px] max-[620px]:[gap:7px] max-[620px]:[&.status-pill]:[padding:4px_5px]"><div className="reservation-avatar [width:30px] [height:30px] [display:grid] [place-items:center] [flex:0_0_auto] [border-radius:10px] [color:#52837c] [background:#eaf4f0] [font-size:9px] [font-weight:740]">{initials(item.user)}</div><div className="reservation-copy [min-width:0] [display:grid] [gap:4px] [flex:1] [&_strong]:[overflow:hidden] [&_strong]:[color:#43545e] [&_strong]:[font-size:9px] [&_strong]:[font-weight:650] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&_span]:[overflow:hidden] [&_span]:[color:#99a4a9] [&_span]:[font-size:8px] [&_span]:[text-overflow:ellipsis] [&_span]:[white-space:nowrap]"><strong>{item.user.firstName} {item.user.lastName}</strong><span>{item.resource?.name ?? "Resource removed"}</span></div><div className="reservation-when [min-width:0] [display:grid] [gap:4px] [&_strong]:[overflow:hidden] [&_strong]:[color:#43545e] [&_strong]:[font-size:9px] [&_strong]:[font-weight:650] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&_span]:[overflow:hidden] [&_span]:[color:#99a4a9] [&_span]:[font-size:8px] [&_span]:[text-overflow:ellipsis] [&_span]:[white-space:nowrap] [width:108px] [&_strong]:[color:#697981] [&_strong]:[font-weight:570] max-[620px]:[width:86px]"><strong>{formatDate(item.StartTime, true)}</strong><span>{item.title || "Resource reservation"}</span></div><StatusPill status={item.cancelledAt ? "CANCELLED" : item.status} /></div>;
}

function ReservationsTable({ items, busyId, onAction }: { items: Reservation[]; busyId: string; onAction: (id: string, action: "CONFIRM" | "REJECT") => void }) {
  if (items.length === 0) return <EmptyState icon={CalendarClock} title="No reservations found" message="New requests will show up here." />;
  return <div className="table-scroll [width:100%] [overflow-x:auto]"><table className="admin-table [width:100%] [border-collapse:collapse] [text-align:left] [&_th]:[height:39px] [&_th]:[padding:0_13px] [&_th]:[border-bottom:1px_solid_#edf0f0] [&_th]:[color:#a1aaae] [&_th]:[background:#fcfdfd] [&_th]:[font-size:8px] [&_th]:[font-weight:750] [&_th]:[letter-spacing:.65px] [&_th]:[white-space:nowrap] [&_th:first-child]:[padding-left:19px] [&_td:first-child]:[padding-left:19px] [&_th:last-child]:[padding-right:19px] [&_td:last-child]:[padding-right:19px] [&_td]:[height:61px] [&_td]:[padding:9px_13px] [&_td]:[border-bottom:1px_solid_#f1f3f3] [&_td]:[color:#697981] [&_td]:[font-size:9px] [&_td]:[vertical-align:middle] [&_tbody_tr:last-child_td]:[border-bottom:0] [&_tbody_tr:hover]:[background:#fcfdfd] max-[620px]:[min-width:730px] max-[620px]:[&_th:first-child]:[padding-left:13px] max-[620px]:[&_td:first-child]:[padding-left:13px] max-[620px]:[&_th:last-child]:[padding-right:13px] max-[620px]:[&_td:last-child]:[padding-right:13px]"><thead><tr><th>REQUESTED BY</th><th>RESOURCE</th><th>DATE & TIME</th><th>STATUS</th><th className="align-right [text-align:right]!">ACTIONS</th></tr></thead><tbody>{items.map((item) => {
    const isPending = item.status === "PENDING" && !item.cancelledAt;
    return <tr key={item.id}><td><div className="table-person [min-width:160px] [display:flex] [align-items:center] [gap:9px] [&>_span:last-child]:[min-width:0] [&>_span:last-child]:[display:grid] [&>_span:last-child]:[gap:4px] [&_strong]:[color:#455761] [&_strong]:[font-size:9px] [&_strong]:[font-weight:650] [&_strong]:[white-space:nowrap] [&_small]:[max-width:180px] [&_small]:[overflow:hidden] [&_small]:[color:#9ba6ab] [&_small]:[font-size:8px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap]"><span className="table-avatar [width:30px] [height:30px] [display:grid] [place-items:center] [flex:0_0_auto] [border-radius:10px] [color:#52837c] [background:#eaf4f0] [font-size:9px] [font-weight:740]">{initials(item.user)}</span><span><strong>{item.user.firstName} {item.user.lastName}</strong><small>{item.user.email}</small></span></div></td><td><strong className="table-primary [display:block] [max-width:180px] [overflow:hidden] [color:#50616a] [font-size:9px] [font-weight:620] [text-overflow:ellipsis] [white-space:nowrap]">{item.resource?.name ?? "Resource removed"}</strong><small className="table-secondary [display:block] [margin-top:4px] [color:#9da7ab] [font-size:8px] [white-space:nowrap]">{item.resource?.code ?? "—"}</small></td><td><strong className="table-primary [display:block] [max-width:180px] [overflow:hidden] [color:#50616a] [font-size:9px] [font-weight:620] [text-overflow:ellipsis] [white-space:nowrap]">{formatDate(item.StartTime)}</strong><small className="table-secondary [display:block] [margin-top:4px] [color:#9da7ab] [font-size:8px] [white-space:nowrap]">{formatDate(item.StartTime, true)} – {new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(item.Endtime))}</small></td><td><StatusPill status={item.cancelledAt ? "CANCELLED" : item.status} /></td><td className="align-right [text-align:right]!">{isPending ? <div className="row-actions [display:inline-flex] [align-items:center] [justify-content:flex-end] [gap:6px]"><button type="button" className="small-action small-action-confirm [min-height:28px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:4px] [padding:0_8px] [border:1px_solid] [border-radius:7px] [font-size:8px] [font-weight:650] [white-space:nowrap] [cursor:pointer] disabled:[opacity:.55] disabled:[cursor:wait] [border-color:#d5e9df] [color:#36805e] [background:#f3fbf7] [&:hover:not(:disabled)]:[border-color:#a9d4bf] [&:hover:not(:disabled)]:[background:#e9f7f0]" disabled={busyId === item.id} onClick={() => onAction(item.id, "CONFIRM")}><Check size={14} /> Confirm</button><button type="button" className="small-action small-action-reject [min-height:28px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:4px] [padding:0_8px] [border:1px_solid] [border-radius:7px] [font-size:8px] [font-weight:650] [white-space:nowrap] [cursor:pointer] disabled:[opacity:.55] disabled:[cursor:wait] [border-color:#efe1df] [color:#a35c55] [background:#fffafa] [&:hover:not(:disabled)]:[border-color:#e9c5c0] [&:hover:not(:disabled)]:[background:#fff3f1]" disabled={busyId === item.id} onClick={() => onAction(item.id, "REJECT")}><X size={14} /> Reject</button></div> : <span className="no-action [color:#a2abad] [font-size:8px]">—</span>}</td></tr>;
  })}</tbody></table></div>;
}

function ResourcesTable({ items, busyId, onEdit, onDelete }: { items: Resource[]; busyId: string; onEdit: (item: Resource) => void; onDelete: (item: Resource) => void }) {
  if (items.length === 0) return <EmptyState icon={DoorOpen} title="No resources found" message="Add a resource or try another search." />;
  return <div className="table-scroll [width:100%] [overflow-x:auto]"><table className="admin-table [width:100%] [border-collapse:collapse] [text-align:left] [&_th]:[height:39px] [&_th]:[padding:0_13px] [&_th]:[border-bottom:1px_solid_#edf0f0] [&_th]:[color:#a1aaae] [&_th]:[background:#fcfdfd] [&_th]:[font-size:8px] [&_th]:[font-weight:750] [&_th]:[letter-spacing:.65px] [&_th]:[white-space:nowrap] [&_th:first-child]:[padding-left:19px] [&_td:first-child]:[padding-left:19px] [&_th:last-child]:[padding-right:19px] [&_td:last-child]:[padding-right:19px] [&_td]:[height:61px] [&_td]:[padding:9px_13px] [&_td]:[border-bottom:1px_solid_#f1f3f3] [&_td]:[color:#697981] [&_td]:[font-size:9px] [&_td]:[vertical-align:middle] [&_tbody_tr:last-child_td]:[border-bottom:0] [&_tbody_tr:hover]:[background:#fcfdfd] max-[620px]:[min-width:730px] max-[620px]:[&_th:first-child]:[padding-left:13px] max-[620px]:[&_td:first-child]:[padding-left:13px] max-[620px]:[&_th:last-child]:[padding-right:13px] max-[620px]:[&_td:last-child]:[padding-right:13px]"><thead><tr><th>RESOURCE</th><th>CATEGORY</th><th>LOCATION</th><th>STATUS</th><th className="align-right [text-align:right]!">ACTIONS</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><div className="resource-table-cell [min-width:160px] [display:flex] [align-items:center] [gap:9px] [&>_span:last-child]:[min-width:0] [&>_span:last-child]:[display:grid] [&>_span:last-child]:[gap:4px]"><span className="table-resource-icon [width:30px] [height:30px] [display:grid] [place-items:center] [flex:0_0_auto] [border-radius:9px] [color:#2d8b83] [background:#eaf5f2]"><DoorOpen size={16} /></span><span><strong className="table-primary [display:block] [max-width:180px] [overflow:hidden] [color:#50616a] [font-size:9px] [font-weight:620] [text-overflow:ellipsis] [white-space:nowrap]">{item.name}</strong><small className="table-secondary [display:block] [margin-top:4px] [color:#9da7ab] [font-size:8px] [white-space:nowrap]">{item.code}{item.maxCapacity ? ` · Capacity ${item.maxCapacity}` : ""}</small></span></div></td><td><span className="category-tag [display:inline-block] [max-width:150px] [overflow:hidden] [padding:5px_7px] [border-radius:6px] [color:#6f7e83] [background:#f2f5f5] [font-size:8px] [text-overflow:ellipsis] [white-space:nowrap]">{item.resourceCategory.name}</span></td><td><span className="location-cell [display:inline-flex] [align-items:center] [gap:4px] [color:#829096] [font-size:8px] [white-space:nowrap] [&_svg]:[color:#9aabae]"><MapPin size={13} />{item.location || "Not specified"}</span></td><td><StatusPill status={item.status} /></td><td className="align-right [text-align:right]!"><div className="row-actions [display:inline-flex] [align-items:center] [justify-content:flex-end] [gap:6px]"><button type="button" className="icon-button row-icon-button [position:relative] [display:inline-grid] [place-items:center] [border:1px_solid_#e9eeee] [border-radius:9px] [color:#74838b] [background:#fff] [cursor:pointer] [transition:color_.15s_ease,_border-color_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[border-color:#cce5e1] [&:hover:not(:disabled)]:[color:#087d7e] [&:hover:not(:disabled)]:[background:#f7fbfa] disabled:[opacity:.5] disabled:[cursor:wait] [width:29px] [height:29px]" disabled={busyId === item.id} onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`} title="Edit resource"><Settings2 size={16} /></button><button type="button" className="icon-button row-icon-button row-icon-danger [position:relative] [display:inline-grid] [place-items:center] [border:1px_solid_#e9eeee] [border-radius:9px] [color:#74838b] [background:#fff] [cursor:pointer] [transition:color_.15s_ease,_border-color_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[border-color:#cce5e1] [&:hover:not(:disabled)]:[color:#087d7e] [&:hover:not(:disabled)]:[background:#f7fbfa] disabled:[opacity:.5] disabled:[cursor:wait] [width:29px] [height:29px] [&:hover:not(:disabled)]:[border-color:#f0d7d4] [&:hover:not(:disabled)]:[color:#b95249] [&:hover:not(:disabled)]:[background:#fff8f7]" disabled={busyId === item.id} onClick={() => onDelete(item)} aria-label={`Delete ${item.name}`} title="Delete resource"><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>;
}

function MaintenanceTable({ items, busyId, onFinish }: { items: Maintenance[]; busyId: string; onFinish: (item: Maintenance) => void }) {
  if (items.length === 0) return <EmptyState icon={Wrench} title="No maintenance found" message="Scheduled maintenance will show up here." />;
  return <div className="table-scroll [width:100%] [overflow-x:auto]"><table className="admin-table [width:100%] [border-collapse:collapse] [text-align:left] [&_th]:[height:39px] [&_th]:[padding:0_13px] [&_th]:[border-bottom:1px_solid_#edf0f0] [&_th]:[color:#a1aaae] [&_th]:[background:#fcfdfd] [&_th]:[font-size:8px] [&_th]:[font-weight:750] [&_th]:[letter-spacing:.65px] [&_th]:[white-space:nowrap] [&_th:first-child]:[padding-left:19px] [&_td:first-child]:[padding-left:19px] [&_th:last-child]:[padding-right:19px] [&_td:last-child]:[padding-right:19px] [&_td]:[height:61px] [&_td]:[padding:9px_13px] [&_td]:[border-bottom:1px_solid_#f1f3f3] [&_td]:[color:#697981] [&_td]:[font-size:9px] [&_td]:[vertical-align:middle] [&_tbody_tr:last-child_td]:[border-bottom:0] [&_tbody_tr:hover]:[background:#fcfdfd] max-[620px]:[min-width:730px] max-[620px]:[&_th:first-child]:[padding-left:13px] max-[620px]:[&_td:first-child]:[padding-left:13px] max-[620px]:[&_th:last-child]:[padding-right:13px] max-[620px]:[&_td:last-child]:[padding-right:13px]"><thead><tr><th>RESOURCE</th><th>WORK DETAILS</th><th>SCHEDULED</th><th>STATUS</th><th className="align-right [text-align:right]!">ACTIONS</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><div className="resource-table-cell [min-width:160px] [display:flex] [align-items:center] [gap:9px] [&>_span:last-child]:[min-width:0] [&>_span:last-child]:[display:grid] [&>_span:last-child]:[gap:4px]"><span className="table-resource-icon table-resource-amber [width:30px] [height:30px] [display:grid] [place-items:center] [flex:0_0_auto] [border-radius:9px] [color:#2d8b83] [background:#eaf5f2] [color:#ae7a35] [background:#fff4e5]"><Wrench size={16} /></span><span><strong className="table-primary [display:block] [max-width:180px] [overflow:hidden] [color:#50616a] [font-size:9px] [font-weight:620] [text-overflow:ellipsis] [white-space:nowrap]">{item.resource.name}</strong><small className="table-secondary [display:block] [margin-top:4px] [color:#9da7ab] [font-size:8px] [white-space:nowrap]">{item.resource.code}</small></span></div></td><td><span className="work-description [display:block] [max-width:180px] [overflow:hidden] [color:#7d8a90] [font-size:8px] [text-overflow:ellipsis] [white-space:nowrap]">{item.description}</span></td><td><strong className="table-primary [display:block] [max-width:180px] [overflow:hidden] [color:#50616a] [font-size:9px] [font-weight:620] [text-overflow:ellipsis] [white-space:nowrap]">{formatDate(item.startTime)}</strong><small className="table-secondary [display:block] [margin-top:4px] [color:#9da7ab] [font-size:8px] [white-space:nowrap]">Until {formatDate(item.endTime, true)}</small></td><td><StatusPill status={item.maintenancestatus} /></td><td className="align-right [text-align:right]!">{item.maintenancestatus === "INPROGRESS" ? <button type="button" className="small-action small-action-confirm [min-height:28px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:4px] [padding:0_8px] [border:1px_solid] [border-radius:7px] [font-size:8px] [font-weight:650] [white-space:nowrap] [cursor:pointer] disabled:[opacity:.55] disabled:[cursor:wait] [border-color:#d5e9df] [color:#36805e] [background:#f3fbf7] [&:hover:not(:disabled)]:[border-color:#a9d4bf] [&:hover:not(:disabled)]:[background:#e9f7f0]" disabled={busyId === item.id} onClick={() => onFinish(item)}><Check size={14} /> Mark finished</button> : <span className="no-action [color:#a2abad] [font-size:8px]">Finished {formatDate(item.endTime)}</span>}</td></tr>)}</tbody></table><p className="manual-finish-note [display:flex] [align-items:center] [gap:6px] [margin:0] [padding:12px_19px] [border-top:1px_solid_#f0f2f2] [color:#89969a] [font-size:8px] [&_svg]:[color:#b98a50]"><Clock3 size={14} /> Maintenance stays in progress until an administrator marks it finished.</p></div>;
}

function UsersTable({ items, currentUserId, busyId, onDelete }: { items: AdminUser[]; currentUserId: string; busyId: string; onDelete: (user: AdminUser) => void }) {
  if (items.length === 0) return <EmptyState icon={Users} title="No users found" message="Try a different search." />;
  return <div className="table-scroll [width:100%] [overflow-x:auto]"><table className="admin-table [width:100%] [border-collapse:collapse] [text-align:left] [&_th]:[height:39px] [&_th]:[padding:0_13px] [&_th]:[border-bottom:1px_solid_#edf0f0] [&_th]:[color:#a1aaae] [&_th]:[background:#fcfdfd] [&_th]:[font-size:8px] [&_th]:[font-weight:750] [&_th]:[letter-spacing:.65px] [&_th]:[white-space:nowrap] [&_th:first-child]:[padding-left:19px] [&_td:first-child]:[padding-left:19px] [&_th:last-child]:[padding-right:19px] [&_td:last-child]:[padding-right:19px] [&_td]:[height:61px] [&_td]:[padding:9px_13px] [&_td]:[border-bottom:1px_solid_#f1f3f3] [&_td]:[color:#697981] [&_td]:[font-size:9px] [&_td]:[vertical-align:middle] [&_tbody_tr:last-child_td]:[border-bottom:0] [&_tbody_tr:hover]:[background:#fcfdfd] max-[620px]:[min-width:730px] max-[620px]:[&_th:first-child]:[padding-left:13px] max-[620px]:[&_td:first-child]:[padding-left:13px] max-[620px]:[&_th:last-child]:[padding-right:13px] max-[620px]:[&_td:last-child]:[padding-right:13px]"><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>RESERVATIONS</th><th>JOINED</th><th className="align-right [text-align:right]!">ACTIONS</th></tr></thead><tbody>{items.map((user) => <tr key={user.id}><td><div className="table-person [min-width:160px] [display:flex] [align-items:center] [gap:9px] [&>_span:last-child]:[min-width:0] [&>_span:last-child]:[display:grid] [&>_span:last-child]:[gap:4px] [&_strong]:[color:#455761] [&_strong]:[font-size:9px] [&_strong]:[font-weight:650] [&_strong]:[white-space:nowrap] [&_small]:[max-width:180px] [&_small]:[overflow:hidden] [&_small]:[color:#9ba6ab] [&_small]:[font-size:8px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap]"><span className="table-avatar [width:30px] [height:30px] [display:grid] [place-items:center] [flex:0_0_auto] [border-radius:10px] [color:#52837c] [background:#eaf4f0] [font-size:9px] [font-weight:740]">{initials(user)}</span><span><strong>{user.firstName} {user.lastName}</strong><small>{user.email} · {user.phone}</small></span></div></td><td><span className={`role-tag [display:inline-flex] [padding:5px_8px] [border-radius:6px] [font-size:8px] [font-weight:680] [color:#7260a2] [background:#f0edfa] [color:#547d9c] [background:#edf4fa] ${user.role === "ADMIN" ? "role-admin [color:#7260a2] [background:#f0edfa]" : "role-user [color:#547d9c] [background:#edf4fa]"}`}>{user.role === "ADMIN" ? "Admin" : "User"}</span></td><td><StatusPill status={user.status} /></td><td><span className="reservation-count [min-width:23px] [height:23px] [display:inline-grid] [place-items:center] [border-radius:7px] [color:#65767e] [background:#f1f4f4] [font-size:9px] [font-weight:650]">{user._count?.resavation ?? 0}</span></td><td><span className="table-secondary plain-secondary [display:block] [margin-top:4px] [color:#9da7ab] [font-size:8px] [white-space:nowrap] [margin-top:0]">{formatDate(user.createdAt)}</span></td><td className="align-right [text-align:right]!">{user.id === currentUserId ? <span className="self-label [color:#8e9b9f] [font-size:8px]">You</span> : <button type="button" className="icon-button row-icon-button row-icon-danger [position:relative] [display:inline-grid] [place-items:center] [border:1px_solid_#e9eeee] [border-radius:9px] [color:#74838b] [background:#fff] [cursor:pointer] [transition:color_.15s_ease,_border-color_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[border-color:#cce5e1] [&:hover:not(:disabled)]:[color:#087d7e] [&:hover:not(:disabled)]:[background:#f7fbfa] disabled:[opacity:.5] disabled:[cursor:wait] [width:29px] [height:29px] [&:hover:not(:disabled)]:[border-color:#f0d7d4] [&:hover:not(:disabled)]:[color:#b95249] [&:hover:not(:disabled)]:[background:#fff8f7]" disabled={busyId === user.id} onClick={() => onDelete(user)} aria-label={`Delete ${user.firstName} ${user.lastName}`} title="Delete user and their reservations"><Trash2 size={16} /></button>}</td></tr>)}</tbody></table><p className="manual-finish-note [display:flex] [align-items:center] [gap:6px] [margin:0] [padding:12px_19px] [border-top:1px_solid_#f0f2f2] [color:#89969a] [font-size:8px] [&_svg]:[color:#b98a50]"><ShieldCheck size={14} /> Your own administrator account can’t be deleted from this page.</p></div>;
}

function ResourceModal({ resource, categories, busy, onClose, onSubmit }: { resource: Resource | null; categories: ResourceCategory[]; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title={resource ? "Update resource" : "Add a resource"} description={resource ? "Update the details people use to find this resource." : "Add a room, piece of equipment, or shared space."} onClose={onClose}>
    <form className="admin-form [display:grid] [gap:14px]" onSubmit={onSubmit}>
      <label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Resource name</span><input name="name" defaultValue={resource?.name} placeholder="e.g. Design studio" minLength={2} maxLength={100} required /></label>
      <div className="admin-form-row [display:grid] [grid-template-columns:1fr_1fr] [gap:12px] max-[370px]:[grid-template-columns:1fr]"><label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Category</span><select name="categoryId" defaultValue={resource?.categoryId ?? ""} required><option value="" disabled>Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Resource code <small>Optional</small></span><input name="code" defaultValue={resource?.code} placeholder="Auto-generated" minLength={2} maxLength={50} /></label></div>
      <label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Description</span><textarea name="description" defaultValue={resource?.description} placeholder="What should people know before reserving it?" minLength={5} rows={3} required /></label>
      <div className="admin-form-row [display:grid] [grid-template-columns:1fr_1fr] [gap:12px] max-[370px]:[grid-template-columns:1fr]"><label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Location</span><input name="location" defaultValue={resource?.location ?? ""} placeholder="Building, floor, or room" maxLength={255} /></label><label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Capacity <small>Optional</small></span><input name="maxCapacity" type="number" defaultValue={resource?.maxCapacity ?? ""} placeholder="e.g. 12" min={1} step={1} /></label></div>
      {resource && <label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Status</span><select name="status" defaultValue={resource.status}><option value="ACTIVE">Active</option><option value="WAITING">Waiting</option><option value="INACTIVE">Inactive</option></select></label>}
      <div className="modal-actions [display:flex] [justify-content:flex-end] [gap:8px] [margin-top:7px] [padding-top:14px] [border-top:1px_solid_#eff2f2]"><button type="button" className="admin-button admin-button-secondary [min-height:36px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:7px] [padding:0_12px] [border:1px_solid_transparent] [border-radius:8px] [font-size:10px] [font-weight:650] [white-space:nowrap] [cursor:pointer] [transition:transform_.15s_ease,_box-shadow_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[transform:translateY(-1px)] disabled:[opacity:.58] disabled:[cursor:wait] [border-color:#e2e8e8] [color:#56666f] [background:#fff] [&:hover:not(:disabled)]:[border-color:#cddfdd] [&:hover:not(:disabled)]:[background:#f9fcfb]" onClick={onClose}>Cancel</button><button type="submit" className="admin-button admin-button-primary [min-height:36px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:7px] [padding:0_12px] [border:1px_solid_transparent] [border-radius:8px] [font-size:10px] [font-weight:650] [white-space:nowrap] [cursor:pointer] [transition:transform_.15s_ease,_box-shadow_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[transform:translateY(-1px)] disabled:[opacity:.58] disabled:[cursor:wait] [color:#fff] [background:#087e7e] [box-shadow:0_3px_8px_rgba(8,_126,_126,_.13)] [&:hover:not(:disabled)]:[background:#076e71] [&:hover:not(:disabled)]:[box-shadow:0_5px_12px_rgba(8,_126,_126,_.18)]" disabled={busy}>{busy ? "Saving…" : resource ? "Save changes" : "Add resource"}</button></div>
    </form>
  </Modal>;
}

function MaintenanceModal({ resources, busy, onClose, onSubmit }: { resources: Resource[]; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  return <Modal title="Schedule maintenance" description="Set the expected window. This work order will remain active until you finish it." onClose={onClose}>
    {resources.length === 0 ? <div className="modal-empty [min-height:190px] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center] [gap:9px] [color:#a5824d] [text-align:center] [&_strong]:[color:#52636a] [&_strong]:[font-size:11px] [&_span]:[max-width:255px] [&_span]:[margin-bottom:6px] [&_span]:[color:#929da1] [&_span]:[font-size:9px] [&_span]:[line-height:1.5]"><Wrench size={22} /><strong>No eligible resources</strong><span>Add or activate a resource before scheduling maintenance.</span><button type="button" className="admin-button admin-button-secondary [min-height:36px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:7px] [padding:0_12px] [border:1px_solid_transparent] [border-radius:8px] [font-size:10px] [font-weight:650] [white-space:nowrap] [cursor:pointer] [transition:transform_.15s_ease,_box-shadow_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[transform:translateY(-1px)] disabled:[opacity:.58] disabled:[cursor:wait] [border-color:#e2e8e8] [color:#56666f] [background:#fff] [&:hover:not(:disabled)]:[border-color:#cddfdd] [&:hover:not(:disabled)]:[background:#f9fcfb]" onClick={onClose}>Close</button></div> : <form className="admin-form [display:grid] [gap:14px]" onSubmit={onSubmit}>
      <label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Resource</span><select name="resourceId" defaultValue="" required><option value="" disabled>Select resource</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {resource.code}</option>)}</select></label>
      <label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Work details</span><textarea name="description" placeholder="Describe the maintenance work" minLength={3} rows={3} required /></label>
      <div className="admin-form-row [display:grid] [grid-template-columns:1fr_1fr] [gap:12px] max-[370px]:[grid-template-columns:1fr]"><label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Starts</span><input name="startTime" type="datetime-local" defaultValue={toLocalDateTime(now)} required /></label><label className="admin-field [min-width:0] [display:grid] [gap:6px] [color:#55666e] [font-size:9px] [font-weight:660] [&>_span]:[display:flex] [&>_span]:[align-items:center] [&>_span]:[gap:6px] [&_small]:[color:#9ba6aa] [&_small]:[font-size:8px] [&_small]:[font-weight:450] [&_input]:[width:100%] [&_input]:[min-height:36px] [&_input]:[padding:8px_10px] [&_input]:[border:1px_solid_#e0e7e7] [&_input]:[border-radius:8px] [&_input]:[outline:0] [&_input]:[color:#435761] [&_input]:[background:#fff] [&_input]:[font-size:9px] [&_input]:[font-weight:450] [&_select]:[width:100%] [&_select]:[min-height:36px] [&_select]:[padding:8px_10px] [&_select]:[border:1px_solid_#e0e7e7] [&_select]:[border-radius:8px] [&_select]:[outline:0] [&_select]:[color:#435761] [&_select]:[background:#fff] [&_select]:[font-size:9px] [&_select]:[font-weight:450] [&_textarea]:[width:100%] [&_textarea]:[min-height:36px] [&_textarea]:[padding:8px_10px] [&_textarea]:[border:1px_solid_#e0e7e7] [&_textarea]:[border-radius:8px] [&_textarea]:[outline:0] [&_textarea]:[color:#435761] [&_textarea]:[background:#fff] [&_textarea]:[font-size:9px] [&_textarea]:[font-weight:450] [&_textarea]:[min-height:68px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&_input::placeholder]:[color:#a8b2b5] [&_textarea::placeholder]:[color:#a8b2b5] [&_input:focus]:[border-color:#7cbdb6] [&_input:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_select:focus]:[border-color:#7cbdb6] [&_select:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)] [&_textarea:focus]:[border-color:#7cbdb6] [&_textarea:focus]:[box-shadow:0_0_0_3px_rgba(19,_132,_126,_.08)]"><span>Expected end</span><input name="endTime" type="datetime-local" defaultValue={toLocalDateTime(later)} required /></label></div>
      <div className="manual-note [display:flex] [align-items:center] [gap:7px] [padding:9px_10px] [border-radius:8px] [color:#966c35] [background:#fff8eb] [font-size:9px]"><Clock3 size={15} /> This work order will not finish automatically.</div>
      <div className="modal-actions [display:flex] [justify-content:flex-end] [gap:8px] [margin-top:7px] [padding-top:14px] [border-top:1px_solid_#eff2f2]"><button type="button" className="admin-button admin-button-secondary [min-height:36px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:7px] [padding:0_12px] [border:1px_solid_transparent] [border-radius:8px] [font-size:10px] [font-weight:650] [white-space:nowrap] [cursor:pointer] [transition:transform_.15s_ease,_box-shadow_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[transform:translateY(-1px)] disabled:[opacity:.58] disabled:[cursor:wait] [border-color:#e2e8e8] [color:#56666f] [background:#fff] [&:hover:not(:disabled)]:[border-color:#cddfdd] [&:hover:not(:disabled)]:[background:#f9fcfb]" onClick={onClose}>Cancel</button><button type="submit" className="admin-button admin-button-primary [min-height:36px] [display:inline-flex] [align-items:center] [justify-content:center] [gap:7px] [padding:0_12px] [border:1px_solid_transparent] [border-radius:8px] [font-size:10px] [font-weight:650] [white-space:nowrap] [cursor:pointer] [transition:transform_.15s_ease,_box-shadow_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[transform:translateY(-1px)] disabled:[opacity:.58] disabled:[cursor:wait] [color:#fff] [background:#087e7e] [box-shadow:0_3px_8px_rgba(8,_126,_126,_.13)] [&:hover:not(:disabled)]:[background:#076e71] [&:hover:not(:disabled)]:[box-shadow:0_5px_12px_rgba(8,_126,_126,_.18)]" disabled={busy}>{busy ? "Scheduling…" : "Create maintenance"}</button></div>
    </form>}
  </Modal>;
}

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop [position:fixed] [inset:0] [z-index:20] [display:grid] [place-items:center] [overflow-y:auto] [padding:22px] [background:rgba(16,_35,_43,_.42)] [backdrop-filter:blur(3px)] max-[620px]:[align-items:end] max-[620px]:[padding:0]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-modal [width:min(510px,_100%)] [max-height:min(90vh,_760px)] [overflow-y:auto] [padding:22px] [border:1px_solid_rgba(255,255,255,.6)] [border-radius:16px] [background:#fff] [box-shadow:0_24px_80px_rgba(21,_39,_47,_.22)] max-[620px]:[width:100%] max-[620px]:[max-height:92vh] max-[620px]:[padding:19px_16px_max(20px,_env(safe-area-inset-bottom))] max-[620px]:[border-radius:17px_17px_0_0]" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:12px] [margin-bottom:21px] [&_h2]:[margin:0] [&_h2]:[color:#293e49] [&_h2]:[font-size:17px] [&_h2]:[font-weight:700] [&_h2]:[letter-spacing:-.4px] [&_p]:[margin:6px_0_0] [&_p]:[color:#8c999e] [&_p]:[font-size:9px] [&_p]:[line-height:1.6]"><div><h2 id="modal-title">{title}</h2><p>{description}</p></div><button type="button" className="icon-button modal-close [position:relative] [display:inline-grid] [place-items:center] [border:1px_solid_#e9eeee] [border-radius:9px] [color:#74838b] [background:#fff] [cursor:pointer] [transition:color_.15s_ease,_border-color_.15s_ease,_background_.15s_ease] [&:hover:not(:disabled)]:[border-color:#cce5e1] [&:hover:not(:disabled)]:[color:#087d7e] [&:hover:not(:disabled)]:[background:#f7fbfa] disabled:[opacity:.5] disabled:[cursor:wait] [width:30px] [height:30px] [flex:0_0_auto]" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></header>{children}</section></div>;
}
