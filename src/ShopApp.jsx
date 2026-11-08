import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  KeyRound,
  Lock,
  LockOpen,
  Filter,
  LogOut,
  Menu,
  PackagePlus,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./ShopApp.css";
import "./ShopAppExtras.css";
import "./ShopAppResponsive.css";

const MANUAL_LOOKUP_MESSAGE = "Device details could not be identified automatically. Please enter the details manually.";
const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "shop_token";
const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
const setToken = (token) => {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};
async function api(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) {
    if (path === "/auth/logout") setToken(null);
    return null;
  }
  const result = await response.json().catch(() => ({}));
  if (result.token) setToken(result.token);
  if (response.status === 401) setToken(null);
  if (!response.ok)
    throw Object.assign(new Error(result.message || `Request failed (${response.status})`), {
      status: response.status,
      data: result,
    });
  return result;
}

// null = withheld by the server because financial information is locked.
const money = (value = 0) =>
  value === null ? "₹ ••••" : new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "—";
const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
const dayKey = (value) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
function reportDateParams(period, from, to) {
  let start = "";
  let end = dayKey(new Date());
  if (period === "custom") {
    start = from;
    end = to || dayKey(new Date());
  } else if (period === "1") {
    start = end;
  } else if (period === "2") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    start = dayKey(yesterday);
    end = start;
  } else if (period === "month") {
    const monthStart = new Date();
    monthStart.setDate(1);
    start = dayKey(monthStart);
  } else if (period !== "all") {
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - Number(period) + 1);
    start = dayKey(rangeStart);
  }
  return start ? { from: start, to: end } : {};
}
const masked = (value = "") =>
  value.length === 15 ? `${value.slice(0, 4)}•••••••${value.slice(-4)}` : value;

export default function ShopApp() {
  const [session, setSession] = useState({
    loading: true,
    setup: false,
    user: null,
    error: "",
  });
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    api("/auth/status")
      .then(async ({ setupRequired }) => {
        if (setupRequired) return { setup: true, user: null };
        try {
          return { setup: false, user: (await api("/auth/me")).user };
        } catch {
          return { setup: false, user: null };
        }
      })
      .then(
        (result) =>
          active && setSession({ loading: false, ...result, error: "" }),
      )
      .catch(
        (error) =>
          active &&
          setSession({
            loading: false,
            setup: false,
            user: null,
            error: error.message,
          }),
      );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setSession((current) => ({ ...current, user: null }));
  }

  if (session.loading)
    return (
      <div className="boot-screen">
        <span className="brand-mark">
          <Smartphone size={21} />
        </span>
        <span>Opening your shop</span>
      </div>
    );
  if (session.error) return <ConnectionScreen message={session.error} />;
  if (!session.user)
    return (
      <AuthScreen
        setup={session.setup}
        onSuccess={(user) =>
          setSession((current) => ({ ...current, setup: false, user }))
        }
      />
    );
  return (
    <Workspace
      user={session.user}
      signOut={signOut}
      notify={setToast}
      toast={toast}
    />
  );
}

function AuthScreen({ setup, onSuccess }) {
  const [values, setValues] = useState({
    name: "",
    username: "",
    email: "",
    identifier: "",
    password: "",
    setupKey: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api(setup ? "/auth/setup" : "/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      onSuccess(user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow">MOBILE RETAIL MANAGEMENT</span>
          <h1>{setup ? "Set up your shop." : "Welcome back."}</h1>
          <p>
            {setup
              ? "Create the first administrator account to open your private inventory workspace."
              : "Sign in to pick up where your shop left off."}
          </p>
          {error && <Notice message={error} />}
          <form className="stack-form" onSubmit={submit}>
            {setup && (
              <Field
                label="Administrator name"
                value={values.name}
                onChange={(name) => setValues({ ...values, name })}
                required
                autoComplete="name"
              />
            )}
            {setup ? (
              <>
                <Field
                  label="Username"
                  value={values.username}
                  onChange={(username) => setValues({ ...values, username })}
                  required
                  autoComplete="username"
                />
                <Field
                  label="Email address"
                  type="email"
                  value={values.email}
                  onChange={(email) => setValues({ ...values, email })}
                  autoComplete="email"
                />
              </>
            ) : (
              <Field
                label="Username or email"
                value={values.identifier}
                onChange={(identifier) => setValues({ ...values, identifier })}
                required
                autoComplete="username"
              />
            )}
            <Field
              label="Password"
              type="password"
              value={values.password}
              onChange={(password) => setValues({ ...values, password })}
              required
              minLength={10}
              autoComplete={setup ? "new-password" : "current-password"}
            />
            {setup && (
              <Field
                label="Initial setup key"
                type="password"
                value={values.setupKey}
                onChange={(setupKey) => setValues({ ...values, setupKey })}
                required
                autoComplete="off"
              />
            )}
            <button className="button primary wide" disabled={busy}>
              {busy
                ? "Please wait…"
                : setup
                  ? "Create administrator"
                  : "Sign in"}
              <ArrowUpRight size={17} />
            </button>
          </form>
          {setup && (
            <p className="auth-hint">
              Use the first-admin key configured by the server owner.
            </p>
          )}
        </div>
        <div className="auth-foot">
          Your data is stored in your connected MongoDB database.
        </div>
      </section>
      <AuthArt />
    </main>
  );
}

function ConnectionScreen({ message }) {
  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow">CONNECTION NEEDED</span>
          <h1>Your shop data lives in your database.</h1>
          <p>
            The API is not reachable yet. Start the server and confirm your
            MongoDB connection settings, then retry.
          </p>
          <Notice message={message} />
          <button
            className="button primary wide"
            onClick={() => window.location.reload()}
          >
            Retry connection
          </button>
        </div>
        <div className="auth-foot">Private inventory workspace</div>
      </section>
      <AuthArt />
    </main>
  );
}

function Brand() {
  return (
    <div className="brand-lockup">
      <span className="brand-mark">
        <Smartphone size={21} />
      </span>
      <span>
        Shabana Inventory<span className="brand-dot">.</span>
      </span>
    </div>
  );
}

function AuthArt() {
  return (
    <div className="auth-art">
      <div className="art-grid" />
      <div className="art-note">
        <span>LIVE INVENTORY</span>
        <strong>
          Every device.
          <br />
          Accounted for.
        </strong>
        <div className="art-bars">
          {Array.from({ length: 11 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
        <small>IMEI · PURCHASE · PROFIT</small>
      </div>
      <div className="art-stat">
        <span>ONE DEVICE AT A TIME</span>
        <strong>
          01 <em>/ 01</em>
        </strong>
        <small>Unique. Traceable. Yours.</small>
      </div>
    </div>
  );
}

const navigation = [
  { to: "/", label: "Overview", icon: Activity },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/invoices", label: "Purchase invoices", icon: FileText },
  { to: "/purchases", label: "Stock in", icon: ArrowDownToLine },
  { to: "/sell", label: "Sell a mobile", icon: ArrowUpRight },
  { to: "/sold", label: "Sold mobiles", icon: ClipboardList },
  { to: "/reports", label: "Profit & reports", icon: BarChart3 },
  { to: "/dealers", label: "Dealers", icon: Building2 },
  { to: "/security", label: "Security", icon: ShieldCheck },
];

function Workspace({ user, signOut, notify, toast }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const active =
    navigation.find((item) => item.to === location.pathname || (item.to !== "/" && location.pathname.startsWith(`${item.to}/`)))?.label ||
    "Overview";
  const mobileNav = navigation.filter((item) => item.to !== "/invoices").slice(0, 5);
  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <FinancialProvider>
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="side-brand">
          <Brand />
          <button
            className="icon-button side-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>
        <div className="store-switch">
          <div className="store-avatar">S</div>
          <div>
            <strong>My shop</strong>
            <small>Retail workspace</small>
          </div>
          <ChevronDown size={16} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Sell a mobile" && <span className="nav-add">+</span>}
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="plan-note">
            <ShieldCheck size={17} />
            <strong>Shop records</strong>
            <span>Backed by your database</span>
            <div className="plan-line">
              <i />
            </div>
          </div>
          <div className="user-row">
            <span className="user-avatar">
              {user.name?.slice(0, 1).toUpperCase() || "A"}
            </span>
            <span className="user-meta">
              <strong>{user.name}</strong>
              <small>Administrator</small>
            </span>
            <button
              className="sidebar-signout icon-button"
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <button
        className={`mobile-scrim ${menuOpen ? "visible" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-label="Close navigation"
      />
      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
          <div className="crumb">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{active}</strong>
          </div>
          <div className="topbar-actions">
            <FinancialChip />
            <span className="connection-pill">
              <i /> Connected
            </span>
            <button
              className="button outline top-signout"
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Sign out"
            >
              <LogOut size={15} />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/inventory"
              element={<InventoryPage notify={notify} />}
            />
            <Route path="/purchases" element={<StockPage notify={notify} />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/new" element={<InvoiceFormPage notify={notify} />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage notify={notify} />} />
            <Route path="/invoices/:id/edit" element={<InvoiceFormPage notify={notify} />} />
            <Route path="/sell" element={<SellPage notify={notify} />} />
            <Route path="/sold" element={<SoldPage notify={notify} />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/dealers" element={<DealersPage notify={notify} />} />
            <Route path="/security" element={<SecurityPage notify={notify} />} />
          </Routes>
          <footer className="page-footer">
            <span>
              Shabana Inventory <b>·</b> Mobile retail management
            </span>
            <span>All figures in INR</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav">
        {mobileNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              `bottom-link ${isActive ? "active" : ""}`
            }
          >
            <Icon size={19} />
            <span>
              {label === "Overview"
                ? "Home"
                : label === "Sell a mobile"
                  ? "Sell"
                  : label === "Sold mobiles"
                    ? "Sold"
                    : label}
            </span>
          </NavLink>
        ))}
      </nav>
      {toast && (
        <div className="toast-message">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
    </FinancialProvider>
  );
}

// ---------------- Financial PIN protection ----------------
// The server decides what is returned; this layer only asks for the PIN and refreshes pages.
// The unlock lives in an HttpOnly cookie, so nothing about it is kept in JS storage.
const FinancialContext = createContext({
  pinEnabled: false, unlocked: false, locked: false, expiresAt: null, version: 0,
  ensureUnlocked: async () => true, lock: async () => {}, refresh: async () => null,
});
const useFinancial = () => useContext(FinancialContext);

function FinancialProvider({ children }) {
  const [status, setStatus] = useState({ pinEnabled: false, unlocked: false, expiresAt: null, loaded: false });
  const [version, setVersion] = useState(0);
  const [prompt, setPrompt] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const next = await api("/financial/status");
      setStatus((current) => {
        if (current.unlocked && !next.unlocked) setVersion((v) => v + 1);
        return { ...next, loaded: true };
      });
      return next;
    } catch {
      return null;
    }
  }, []);
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  // Automatic relock when the server-side window ends; pages refetch redacted data.
  useEffect(() => {
    if (!status.unlocked || !status.expiresAt) return undefined;
    const timer = window.setTimeout(() => {
      setStatus((current) => ({ ...current, unlocked: false, expiresAt: null }));
      setVersion((v) => v + 1);
    }, Math.max(0, new Date(status.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [status.unlocked, status.expiresAt]);
  const ensureUnlocked = useCallback(async () => {
    const current = await refresh();
    if (!current) return false;
    if (!current.pinEnabled || current.unlocked) return true;
    return new Promise((resolve) => setPrompt({ resolve }));
  }, [refresh]);
  const lock = useCallback(async () => {
    await api("/financial/lock", { method: "POST" }).catch(() => {});
    setStatus((current) => ({ ...current, unlocked: false, expiresAt: null }));
    setVersion((v) => v + 1);
  }, []);
  const markUnlocked = (expiresAt) => {
    setStatus((current) => ({ ...current, pinEnabled: true, unlocked: true, expiresAt }));
    setVersion((v) => v + 1);
  };
  const value = {
    ...status,
    locked: status.pinEnabled && !status.unlocked,
    version,
    ensureUnlocked,
    lock,
    refresh,
    markUnlocked,
  };
  return (
    <FinancialContext.Provider value={value}>
      {children}
      {prompt && (
        <PinModal
          onVerified={(expiresAt) => {
            markUnlocked(expiresAt);
            prompt.resolve(true);
            setPrompt(null);
          }}
          onCancel={() => {
            prompt.resolve(false);
            setPrompt(null);
          }}
        />
      )}
    </FinancialContext.Provider>
  );
}

function PinInput({ value, onChange, label = "4-digit PIN", autoFocus = false }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field pin-field">
      <span>{label}</span>
      <span className="pin-input-wrap">
        <input
          type={show ? "text" : "password"}
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4}"
          maxLength={4}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
          className="pin-input"
          placeholder="••••"
          required
        />
        <button
          type="button"
          className="pin-toggle"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide PIN" : "Show PIN"}
          title={show ? "Hide PIN" : "Show PIN"}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

function pinErrorMessage(error) {
  if (error.status === 429) return "Too many incorrect attempts. Try again later.";
  if (error.status === 400) return error.message;
  if (error.status === 401) return "Incorrect PIN.";
  return error.message || "Could not verify the PIN.";
}

function PinModal({ onVerified, onCancel }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) return setError("Enter your 4-digit PIN.");
    setBusy(true);
    setError("");
    try {
      const result = await api("/financial/verify", { method: "POST", body: JSON.stringify({ pin }) });
      setPin("");
      onVerified(result.expiresAt);
    } catch (requestError) {
      setPin("");
      setError(pinErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Financial Information Protected" onClose={onCancel}>
      <form className="stack-form pin-modal" onSubmit={submit}>
        <p className="pin-modal-text">
          <Lock size={16} /> Enter your 4-digit security PIN to continue.
        </p>
        <PinInput value={pin} onChange={setPin} autoFocus />
        {error && <Notice message={error} />}
        <div className="pin-actions">
          <button type="button" className="button outline" onClick={onCancel}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || pin.length !== 4}>
            {busy ? "Verifying…" : "Verify"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FinancialChip() {
  const fin = useFinancial();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!fin.unlocked) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [fin.unlocked]);
  if (!fin.pinEnabled) return null;
  if (!fin.unlocked)
    return (
      <button className="financial-chip locked" type="button" onClick={() => fin.ensureUnlocked()} title="Unlock financial information" aria-label="Financial information locked. Unlock with PIN">
        <Lock size={14} /> <span className="chip-label">Financials locked</span>
      </button>
    );
  const left = Math.max(0, Math.round((new Date(fin.expiresAt) - now) / 1000));
  return (
    <span className="financial-chip unlocked">
      <LockOpen size={14} />
      <span className="chip-label">Unlocked · </span>
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
      <button type="button" onClick={() => fin.lock()}>Lock now</button>
    </span>
  );
}

function FinancialLockedBanner() {
  const fin = useFinancial();
  return (
    <div className="financial-banner">
      <Lock size={16} />
      <span>Purchase prices and profit are hidden.</span>
      <button className="button outline" type="button" onClick={() => fin.ensureUnlocked()}>
        Unlock with PIN
      </button>
    </div>
  );
}

function FinancialLockedPanel() {
  const fin = useFinancial();
  return (
    <section className="panel financial-locked-panel">
      <span className="empty-icon"><Lock size={20} /></span>
      <strong>Financial Information Protected</strong>
      <p>Profit reports and exports need your 4-digit security PIN.</p>
      <button className="button primary" type="button" onClick={() => fin.ensureUnlocked()}>
        <KeyRound size={16} /> Enter PIN
      </button>
    </section>
  );
}

function SecurityPage({ notify }) {
  const fin = useFinancial();
  const [setupForm, setSetupForm] = useState({ password: "", pin: "", confirmPin: "" });
  const [changeForm, setChangeForm] = useState({ currentPin: "", newPin: "", confirmPin: "" });
  const [resetForm, setResetForm] = useState({ password: "", recoveryKey: "", newPin: "", confirmPin: "" });
  const [showReset, setShowReset] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (requestError) {
      setError(requestError.status === 429 ? "Too many incorrect attempts. Try again later." : requestError.message);
    } finally {
      setBusy(false);
    }
  }
  const setPin = (event) => {
    event.preventDefault();
    if (setupForm.pin !== setupForm.confirmPin) return setError("The two PINs do not match.");
    run(async () => {
      const result = await api("/financial/pin", { method: "POST", body: JSON.stringify(setupForm) });
      setSetupForm({ password: "", pin: "", confirmPin: "" });
      fin.markUnlocked(result.expiresAt);
      notify("Financial PIN set. Financial information is now protected.");
    });
  };
  const changePin = (event) => {
    event.preventDefault();
    if (changeForm.newPin !== changeForm.confirmPin) return setError("The two new PINs do not match.");
    run(async () => {
      await api("/financial/pin", { method: "PUT", body: JSON.stringify(changeForm) });
      setChangeForm({ currentPin: "", newPin: "", confirmPin: "" });
      await fin.refresh();
      notify("Financial PIN changed.");
    });
  };
  const resetPin = (event) => {
    event.preventDefault();
    if (resetForm.newPin !== resetForm.confirmPin) return setError("The two new PINs do not match.");
    run(async () => {
      await api("/financial/pin/reset", { method: "POST", body: JSON.stringify(resetForm) });
      setResetForm({ password: "", recoveryKey: "", newPin: "", confirmPin: "" });
      setShowReset(false);
      await fin.refresh();
      notify("Financial PIN reset.");
    });
  };
  const state = !fin.pinEnabled ? "off" : fin.unlocked ? "unlocked" : "locked";
  const StatusIcon = state === "unlocked" ? LockOpen : state === "locked" ? Lock : ShieldCheck;
  return (
    <div className="security-page">
      <Heading
        eyebrow="PRIVACY SETTINGS"
        title="Financial security"
        subtitle="Protect purchase prices and profit with a 4-digit PIN."
      />
      {error && <Notice message={error} />}
      <section className={`panel security-status ${state}`}>
        <span className="security-status-icon"><StatusIcon size={20} /></span>
        <div className="security-status-copy">
          <span className="section-kicker">STATUS</span>
          <h2>{fin.pinEnabled ? "PIN protection is on" : "PIN protection is off"}</h2>
          <p className="security-text">
            {state === "unlocked"
              ? "Financial information is unlocked. It locks automatically after 5 minutes."
              : state === "locked"
                ? "Purchase prices, costs and profit are hidden until the PIN is entered."
                : "Anyone using this login can see purchase prices and profit. Set a PIN to protect them."}
          </p>
        </div>
        {fin.pinEnabled && (
          <div className="security-status-action">
            {fin.unlocked ? (
              <button className="button outline" type="button" onClick={() => fin.lock()}>
                <Lock size={16} /> Lock now
              </button>
            ) : (
              <button className="button primary" type="button" onClick={() => fin.ensureUnlocked()}>
                <LockOpen size={16} /> Unlock
              </button>
            )}
          </div>
        )}
      </section>

      {!fin.pinEnabled ? (
        <div className="security-grid single">
          <section className="panel security-card">
            <PanelTitle kicker="SET UP" title="Set your financial PIN" />
            <p className="security-text">Your account password is required, so only the owner can turn this on.</p>
            <form className="security-form" onSubmit={setPin}>
              <Field label="Account password" type="password" autoComplete="current-password" value={setupForm.password} onChange={(password) => setSetupForm({ ...setupForm, password })} required />
              <div className="pin-pair">
                <PinInput label="New 4-digit PIN" value={setupForm.pin} onChange={(pin) => setSetupForm({ ...setupForm, pin })} />
                <PinInput label="Confirm PIN" value={setupForm.confirmPin} onChange={(confirmPin) => setSetupForm({ ...setupForm, confirmPin })} />
              </div>
              <div className="security-actions">
                <button className="button primary" disabled={busy}>Set PIN</button>
              </div>
            </form>
          </section>
        </div>
      ) : (
        <div className="security-grid">
          <section className="panel security-card">
            <PanelTitle kicker="CHANGE" title="Change PIN" />
            <p className="security-text">Enter your current PIN, then choose a new one. Financial information locks again afterwards.</p>
            <form className="security-form" onSubmit={changePin}>
              <PinInput label="Current PIN" value={changeForm.currentPin} onChange={(currentPin) => setChangeForm({ ...changeForm, currentPin })} />
              <div className="pin-pair">
                <PinInput label="New PIN" value={changeForm.newPin} onChange={(newPin) => setChangeForm({ ...changeForm, newPin })} />
                <PinInput label="Confirm new PIN" value={changeForm.confirmPin} onChange={(confirmPin) => setChangeForm({ ...changeForm, confirmPin })} />
              </div>
              <div className="security-actions">
                <button className="button primary" disabled={busy}>Change PIN</button>
              </div>
            </form>
          </section>
          <section className="panel security-card">
            <PanelTitle
              kicker="RECOVERY"
              title="Forgot your PIN?"
              right={
                <button className="text-button" type="button" aria-expanded={showReset} onClick={() => setShowReset(!showReset)}>
                  {showReset ? "Hide" : "Reset PIN"}
                </button>
              }
            />
            <p className="security-text">Reset needs your account password and the recovery key held on the server (FINANCIAL_PIN_RECOVERY_KEY).</p>
            {showReset && (
              <form className="security-form" onSubmit={resetPin}>
                <Field label="Account password" type="password" autoComplete="current-password" value={resetForm.password} onChange={(password) => setResetForm({ ...resetForm, password })} required />
                <Field label="Recovery key" type="password" autoComplete="off" value={resetForm.recoveryKey} onChange={(recoveryKey) => setResetForm({ ...resetForm, recoveryKey })} required />
                <div className="pin-pair">
                  <PinInput label="New PIN" value={resetForm.newPin} onChange={(newPin) => setResetForm({ ...resetForm, newPin })} />
                  <PinInput label="Confirm new PIN" value={resetForm.confirmPin} onChange={(confirmPin) => setResetForm({ ...resetForm, confirmPin })} />
                </div>
                <div className="security-actions">
                  <button className="button outline" disabled={busy}>Reset PIN</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// ---------------- Purchase invoices (stock inward) ----------------
const INVOICE_MAX_MB = 8;
const invoiceStatusClass = (status) => (status === "Completed" ? "completed" : status === "Pending" ? "pending" : "partial");
function InvoiceStatus({ status }) {
  return <span className={`invoice-status ${invoiceStatusClass(status)}`}><i />{status}</span>;
}
function QuantityBar({ invoice }) {
  const pct = invoice.totalQuantity ? Math.round((invoice.addedQuantity / invoice.totalQuantity) * 100) : 0;
  return (
    <div className="qty-bar" title={`${invoice.addedQuantity} of ${invoice.totalQuantity} added`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
const invoiceOptionLabel = (invoice) =>
  `${invoice.invoiceNumber} | ${invoice.dealerName} | ${date(invoice.invoiceDate)} | ${invoice.remainingQuantity} Remaining`;

/** Opens or downloads the attachment. It shows prices, so the server requires the PIN when one is set. */
async function openInvoiceAttachment(fin, invoice, download) {
  if (!(await fin.ensureUnlocked())) return;
  const popup = download ? null : window.open("", "_blank");
  try {
    const response = await fetch(`${apiBase}/purchase-invoices/${invoice._id}/attachment${download ? "?download=1" : ""}`, {
      credentials: "include",
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || "Could not open the invoice file.");
    }
    const url = URL.createObjectURL(await response.blob());
    if (download) {
      const link = document.createElement("a");
      link.href = url;
      link.download = invoice.attachment?.originalName || `${invoice.invoiceNumber}.pdf`;
      link.click();
    } else if (popup) popup.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    popup?.close();
    window.alert(error.message);
  }
}

function InvoicesPage() {
  const fin = useFinancial();
  const [filters, setFilters] = useState({ search: "", dealer: "", from: "", to: "", status: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [dealers, setDealers] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/dealers").then(({ items }) => setDealers(items)).catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ ...filters, page: String(page), limit: "20" });
    const timer = window.setTimeout(() => {
      api(`/purchase-invoices?${params}`)
        .then((result) => active && (setData(result), setError("")))
        .catch((requestError) => active && setError(requestError.message));
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [filters, page, fin.version]);
  const setFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  return (
    <>
      <Heading
        eyebrow="STOCK INWARD"
        title="Purchase invoices"
        subtitle="Create the dealer invoice first, then add each phone against it."
        right={<NavLink to="/invoices/new" className="button primary"><Plus size={17} />New invoice</NavLink>}
      />
      {data?.financialLocked && <FinancialLockedBanner />}
      <div className="invoice-filters">
        <div className="search-box">
          <Search size={17} />
          <input placeholder="Search invoice number" value={filters.search} onChange={(event) => setFilter("search", event.target.value)} aria-label="Search invoice number" />
        </div>
        <label>Dealer<select value={filters.dealer} onChange={(event) => setFilter("dealer", event.target.value)}><option value="">All dealers</option>{dealers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>
        <label>Status<select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}><option value="">All</option><option value="pending">Pending</option><option value="partial">Partially added</option><option value="completed">Completed</option></select></label>
        <label>From<input type="date" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} /></label>
        <label>To<input type="date" value={filters.to} onChange={(event) => setFilter("to", event.target.value)} /></label>
      </div>
      {error ? <Notice message={error} /> : !data ? <Loading /> : (
        <section className="panel table-panel">
          <div className="table-scroll">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Invoice</th><th>Dealer</th><th>Date</th><th>Total amount</th><th>Quantity</th><th>Added</th><th>Remaining</th><th>File</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((invoice) => (
                  <tr key={invoice._id}>
                    <td><NavLink className="invoice-link" to={`/invoices/${invoice._id}`}>{invoice.invoiceNumber}</NavLink>{invoice.brand && <small>{invoice.brand}</small>}</td>
                    <td>{invoice.dealerName}</td>
                    <td>{date(invoice.invoiceDate)}</td>
                    <td className="table-amount">{money(invoice.totalPurchaseAmount)}</td>
                    <td>{invoice.totalQuantity}</td>
                    <td>{invoice.addedQuantity}<QuantityBar invoice={invoice} /></td>
                    <td><strong>{invoice.remainingQuantity}</strong></td>
                    <td>{invoice.attachment ? <Paperclip size={16} aria-label="Has attachment" /> : "—"}</td>
                    <td><InvoiceStatus status={invoice.status} /></td>
                    <td><NavLink className="icon-button" to={`/invoices/${invoice._id}`} title="View invoice" aria-label={`View invoice ${invoice.invoiceNumber}`}><Eye size={17} /></NavLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && (
              <Empty
                icon={FileText}
                title={Object.values(filters).some(Boolean) ? "No matching invoices" : "No purchase invoices yet"}
                description={Object.values(filters).some(Boolean) ? "Try another invoice number, dealer or date." : "Create an invoice when stock arrives, then add phones to it."}
                action={<NavLink to="/invoices/new" className="button primary"><Plus size={16} />New invoice</NavLink>}
              />
            )}
          </div>
          <Pagination page={page} pages={data.pages} onPage={setPage} />
        </section>
      )}
    </>
  );
}

function InvoiceFormPage({ notify }) {
  const { id } = useParams();
  const editing = Boolean(id);
  const fin = useFinancial();
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [form, setForm] = useState({ dealer: "", invoiceNumber: "", invoiceDate: new Date().toISOString().slice(0, 10), totalPurchaseAmount: "", totalQuantity: "", brand: "", notes: "" });
  const [original, setOriginal] = useState(null);
  const [file, setFile] = useState(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [newDealer, setNewDealer] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loadDealers = () => api("/dealers").then(({ items }) => setDealers(items)).catch(() => {});
  useEffect(() => { loadDealers(); }, []);
  useEffect(() => {
    if (!editing) return;
    api(`/purchase-invoices/${id}`).then(({ invoice }) => {
      setOriginal(invoice);
      setForm({
        dealer: invoice.dealer, invoiceNumber: invoice.invoiceNumber, invoiceDate: String(invoice.invoiceDate).slice(0, 10),
        totalPurchaseAmount: invoice.totalPurchaseAmount ?? "", totalQuantity: String(invoice.totalQuantity), brand: invoice.brand || "", notes: invoice.notes || "",
      });
    }).catch((requestError) => setError(requestError.message));
  }, [editing, id, fin.version]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const amountLocked = form.totalPurchaseAmount === null || (editing && original?.totalPurchaseAmount === null);
  function pickFile(selected) {
    setError("");
    if (!selected) return setFile(null);
    if (!/\.(pdf|jpe?g|png)$/i.test(selected.name)) return setError("Only PDF, JPG, JPEG and PNG files are allowed.");
    if (selected.size > INVOICE_MAX_MB * 1024 * 1024) return setError(`The invoice file must be ${INVOICE_MAX_MB} MB or smaller.`);
    setFile(selected);
    setRemoveAttachment(false);
  }
  async function addDealer(event) {
    event.preventDefault();
    try {
      const { dealer } = await api("/dealers", { method: "POST", body: JSON.stringify(newDealer) });
      await loadDealers();
      update("dealer", dealer._id);
      setNewDealer(null);
      notify("Dealer added.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    const amountChanged = !editing || String(form.totalPurchaseAmount) !== String(original?.totalPurchaseAmount ?? "");
    // Entering or changing the invoice amount, or its attachment, is protected by the Financial PIN.
    if ((amountChanged || file || removeAttachment) && !(await fin.ensureUnlocked())) {
      setError("Unlock financial information with your PIN to save the invoice amount or file.");
      return;
    }
    if (amountLocked && amountChanged) {
      setError("Reload the page after unlocking to edit the amount.");
      return;
    }
    const body = new FormData();
    for (const key of ["dealer", "invoiceNumber", "invoiceDate", "totalQuantity", "brand", "notes"]) body.append(key, form[key]);
    if (amountChanged) body.append("totalPurchaseAmount", form.totalPurchaseAmount);
    if (file) body.append("invoiceFile", file);
    if (removeAttachment) body.append("removeAttachment", "true");
    setBusy(true);
    try {
      const { invoice } = await api(editing ? `/purchase-invoices/${id}` : "/purchase-invoices", { method: editing ? "PUT" : "POST", body });
      notify(editing ? "Invoice updated." : `Invoice ${invoice.invoiceNumber} created. Now add the phones.`);
      navigate(`/invoices/${invoice._id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  const lockedDealer = editing && original?.addedQuantity > 0;
  return (
    <>
      <Heading
        eyebrow="STOCK INWARD"
        title={editing ? `Edit invoice ${original?.invoiceNumber || ""}` : "New purchase invoice"}
        subtitle={editing ? "Quantities already added stay linked to this invoice." : "Record the dealer invoice once; phones are added against it later."}
        right={<NavLink className="back-link" to={editing ? `/invoices/${id}` : "/invoices"}><ArrowLeft size={16} />{editing ? "Invoice" : "Invoices"}</NavLink>}
      />
      {error && <Notice message={error} />}
      <form className="invoice-form-layout" onSubmit={submit}>
        <section className="panel form-panel">
          <FormSection number="01" title="Dealer" description="Pick the supplier this invoice came from." />
          <div className="field-grid">
            <label className="field">
              <span>Dealer</span>
              <select value={form.dealer} onChange={(event) => update("dealer", event.target.value)} required disabled={lockedDealer}>
                <option value="">Choose a dealer</option>
                {dealers.map((dealer) => <option key={dealer._id} value={dealer._id}>{dealer.name}</option>)}
              </select>
              {lockedDealer && <small className="field-hint">The dealer cannot change after phones are added.</small>}
            </label>
            {!lockedDealer && (
              <div className="field add-dealer-cell">
                <span>Not listed?</span>
                <button type="button" className="button outline" onClick={() => setNewDealer(newDealer ? null : { name: "", phone: "", address: "" })}>
                  <Plus size={16} />{newDealer ? "Cancel new dealer" : "Add new dealer"}
                </button>
              </div>
            )}
          </div>
          {newDealer && (
            <div className="inline-dealer">
              <Field label="Dealer name" value={newDealer.name} onChange={(name) => setNewDealer({ ...newDealer, name })} />
              <Field label="Phone" value={newDealer.phone} onChange={(phone) => setNewDealer({ ...newDealer, phone })} placeholder="Optional" />
              <button type="button" className="button primary" onClick={addDealer} disabled={newDealer.name.trim().length < 2}>Save dealer</button>
            </div>
          )}
        </section>
        <section className="panel form-panel">
          <FormSection number="02" title="Invoice details" description="As printed on the dealer's invoice." />
          <div className="field-grid">
            <Field label="Invoice number" value={form.invoiceNumber} onChange={(value) => update("invoiceNumber", value)} required maxLength={80} placeholder="e.g. INV-1025" />
            <Field label="Invoice date" type="date" value={form.invoiceDate} onChange={(value) => update("invoiceDate", value)} required />
            <Field
              label={amountLocked ? "Total purchase amount (locked)" : fin.locked ? "Total purchase amount (PIN needed to save)" : "Total purchase amount"}
              type={amountLocked ? "text" : "number"}
              value={amountLocked ? "₹ ••••" : form.totalPurchaseAmount}
              onChange={(value) => update("totalPurchaseAmount", value)}
              required={!editing}
              disabled={amountLocked}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
            <Field
              label="Total quantity (phones)"
              type="number"
              value={form.totalQuantity}
              onChange={(value) => update("totalQuantity", value)}
              required
              min={Math.max(1, original?.addedQuantity || 0)}
              step="1"
              placeholder="e.g. 20"
            />
            <Field label="Brand / category" value={form.brand} onChange={(value) => update("brand", value)} placeholder="Optional" maxLength={80} />
            <label className="field field-wide">
              <span>Notes</span>
              <textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} maxLength={1000} placeholder="Optional" />
            </label>
          </div>
          {editing && original?.addedQuantity > 0 && <p className="field-hint">{original.addedQuantity} phones are already added, so the quantity cannot go below {original.addedQuantity}.</p>}
        </section>
        <section className="panel form-panel">
          <FormSection number="03" title="Invoice file" description={`Original PDF or photo (PDF, JPG, PNG, up to ${INVOICE_MAX_MB} MB).`} />
          <label className="file-drop">
            <Upload size={20} />
            <span>{file ? file.name : original?.attachment && !removeAttachment ? `Current: ${original.attachment.originalName}. Choose a file to replace it.` : "Choose a file"}</span>
            <input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={(event) => pickFile(event.target.files?.[0])} />
          </label>
          {editing && original?.attachment && !file && (
            <label className="checkbox-line"><input type="checkbox" checked={removeAttachment} onChange={(event) => setRemoveAttachment(event.target.checked)} />Remove the current file</label>
          )}
        </section>
        <div className="invoice-form-actions">
          <NavLink className="button outline" to={editing ? `/invoices/${id}` : "/invoices"}>Cancel</NavLink>
          <button className="button primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create invoice"}</button>
        </div>
      </form>
    </>
  );
}

function InvoiceDetailPage({ notify }) {
  const { id } = useParams();
  const fin = useFinancial();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [stock, setStock] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/purchase-invoices/${id}`).then(setData).catch((requestError) => setError(requestError.message));
  }, [id, fin.version]);
  useEffect(() => {
    api(`/purchase-invoices/${id}/stock?page=${page}&limit=20`).then(setStock).catch(() => {});
  }, [id, page, fin.version]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  async function remove() {
    await api(`/purchase-invoices/${id}`, { method: "DELETE" });
    notify("Invoice deleted.");
    navigate("/invoices");
  }
  if (error && !data) return <Notice message={error} />;
  if (!data) return <Loading />;
  const { invoice, dealer, linkedStock } = data;
  return (
    <>
      <Heading
        eyebrow="PURCHASE INVOICE"
        title={invoice.invoiceNumber}
        subtitle={`${invoice.dealerName} · ${date(invoice.invoiceDate)}`}
        right={<NavLink className="back-link" to="/invoices"><ArrowLeft size={16} />Invoices</NavLink>}
      />
      {error && <Notice message={error} />}
      {data.financialLocked && <FinancialLockedBanner />}
      <section className="panel invoice-summary">
        <div className="invoice-summary-top">
          <InvoiceStatus status={invoice.status} />
          <div className="invoice-actions">
            {invoice.remainingQuantity > 0 && (
              <NavLink className="button primary" to={`/purchases?invoice=${invoice._id}`}><PackagePlus size={16} />Add phones</NavLink>
            )}
            <NavLink className="button outline" to={`/invoices/${invoice._id}/edit`}><Pencil size={16} />Edit</NavLink>
            {invoice.addedQuantity === 0 && <button type="button" className="button outline danger" onClick={() => setConfirmingDelete(true)}><Trash2 size={16} />Delete</button>}
          </div>
        </div>
        <div className="invoice-qty">
          <div><span>Invoice quantity</span><strong>{invoice.totalQuantity}</strong></div>
          <div><span>Added to inventory</span><strong>{invoice.addedQuantity}</strong></div>
          <div><span>Remaining</span><strong className={invoice.remainingQuantity ? "" : "done"}>{invoice.remainingQuantity}</strong></div>
        </div>
        <QuantityBar invoice={invoice} />
        <div className="invoice-facts">
          <Detail label="Dealer" value={dealer?.name || invoice.dealerName} />
          <Detail label="Dealer phone" value={dealer?.phone} />
          <Detail label="Invoice date" value={date(invoice.invoiceDate)} />
          <Detail label="Brand / category" value={invoice.brand} />
          <Detail label="Total purchase amount" value={money(invoice.totalPurchaseAmount)} />
          <Detail label="Sum of phone purchase prices" value={money(data.linkedPurchaseTotal)} />
          <Detail label="In stock / sold" value={`${linkedStock.inStock} / ${linkedStock.sold}`} />
          <Detail label="Notes" value={invoice.notes} />
        </div>
        <div className="invoice-file-row">
          <Paperclip size={16} />
          {invoice.attachment ? (
            <>
              <span className="invoice-file-name">{invoice.attachment.originalName} <small>{Math.max(1, Math.round(invoice.attachment.size / 1024))} KB</small></span>
              <button type="button" className="button outline" onClick={() => openInvoiceAttachment(fin, invoice, false)}><Eye size={16} />View</button>
              <button type="button" className="button outline" onClick={() => openInvoiceAttachment(fin, invoice, true)}><Download size={16} />Download</button>
            </>
          ) : <span className="invoice-file-name">No file uploaded. <NavLink to={`/invoices/${invoice._id}/edit`}>Upload one</NavLink></span>}
        </div>
      </section>
      <section className="panel table-panel">
        <div className="report-table-heading"><PanelTitle kicker="LINKED STOCK" title={`Phones on this invoice (${stock?.total ?? invoice.addedQuantity})`} /></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Brand</th><th>Device</th><th>Model number</th><th>IMEI</th><th>Purchase price</th><th>Stock entry</th><th>Status</th></tr></thead>
            <tbody>
              {(stock?.items || []).map((item) => (
                <tr key={item._id}>
                  <td>{item.brand}</td>
                  <td><strong>{item.model}</strong></td>
                  <td>{item.modelNumber || "—"}</td>
                  <td className="imei-text">{masked(item.imei1)}</td>
                  <td className="table-amount">{money(item.purchasePrice)}</td>
                  <td>{dateTime(item.createdAt)}</td>
                  <td><Badge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {stock && !stock.items.length && <Empty icon={PackagePlus} title="No phones added yet" description="Use Add phones to scan each phone against this invoice." />}
        </div>
        {stock && <Pagination page={page} pages={stock.pages} onPage={setPage} />}
      </section>
      {confirmingDelete && (
        <ConfirmDelete
          title="Delete invoice"
          message={`Delete invoice ${invoice.invoiceNumber} from ${invoice.dealerName}? Its uploaded file is deleted too.`}
          onConfirm={remove}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}

/** Searchable invoice picker for Add Stock. Lists only invoices with remaining quantity. */
function InvoicePicker({ selected, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      api(`/purchase-invoices/available-for-stock?search=${encodeURIComponent(query)}`)
        .then((result) => active && setItems(result.items))
        .catch(() => active && setItems([]));
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, open]);
  if (selected) {
    return (
      <div className="invoice-picked">
        <div>
          <span className="section-kicker">PURCHASE INVOICE</span>
          <strong>{selected.invoiceNumber}</strong>
          <span>{selected.dealerName} · {date(selected.invoiceDate)}</span>
        </div>
        <span className={`invoice-remaining ${selected.remainingQuantity ? "" : "done"}`}>{selected.remainingQuantity} of {selected.totalQuantity} remaining</span>
        <button type="button" className="button outline" onClick={() => onSelect(null)}>Change</button>
      </div>
    );
  }
  return (
    <div className="invoice-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <label className="field">
        <span>Select purchase invoice</span>
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls="invoice-picker-list"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search invoice number…"
        />
      </label>
      {open && (
        <div className="invoice-options" id="invoice-picker-list" role="listbox">
          {items.map((invoice) => (
            <button type="button" role="option" aria-selected="false" key={invoice._id} className="invoice-option" title={invoiceOptionLabel(invoice)} onClick={() => { onSelect(invoice); setOpen(false); setQuery(""); }}>
              <strong>{invoice.invoiceNumber}</strong>
              <span>{invoice.dealerName} · {date(invoice.invoiceDate)}</span>
              <span className="invoice-remaining">{invoice.remainingQuantity} Remaining</span>
            </button>
          ))}
          {!items.length && <span className="invoice-option-empty">No open invoices{query ? ` matching "${query}"` : ""}.</span>}
          <NavLink className="invoice-option create" to="/invoices/new"><Plus size={15} />Create a new purchase invoice</NavLink>
        </div>
      )}
    </div>
  );
}

function Heading({ eyebrow, title, subtitle, right }) {
  return (
    <div className="page-heading">
      <div>
        <div className="page-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div className="heading-action">{right}</div>}
    </div>
  );
}

function Dashboard() {
  const fin = useFinancial();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/dashboard")
      .then(setData)
      .catch((requestError) => setError(requestError.message));
  }, [fin.version]);
  if (error) return <Notice message={error} />;
  if (!data) return <Loading />;
  const { metrics, charts, recent } = data;
  const today = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date());
  return (
    <>
      <Heading
        eyebrow={new Intl.DateTimeFormat("en", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
          .format(new Date())
          .toUpperCase()}
        title="Overview"
        subtitle="A clear view of your shop, at a glance."
        right={
          <span className="date-tag">
            <CalendarDays size={15} />
            {today}
          </span>
        }
      />
      {data.financialLocked && <FinancialLockedBanner />}
      <section className="metric-grid">
        <Metric
          label="Available mobiles"
          value={metrics.available}
          icon={Smartphone}
          color="green"
          note="Ready for sale"
        />
        <Metric
          label="Total sold"
          value={metrics.sold}
          icon={ArrowUpRight}
          color="blue"
          note="Completed transactions"
        />
        <Metric
          label="Stock investment"
          value={money(metrics.purchaseInvestment)}
          icon={Wallet}
          color="amber"
          note="Unsold inventory"
        />
        <Metric
          label="Net profit"
          value={money(metrics.netProfit)}
          icon={TrendingUp}
          color="rose"
          note={metrics.grossProfit === null ? "Locked" : `${money(metrics.grossProfit)} gross profit`}
        />
      </section>
      <section className="metric-strip">
        <div>
          <span>Sales revenue</span>
          <strong>{money(metrics.salesRevenue)}</strong>
        </div>
        <div>
          <span>Total purchase amount</span>
          <strong>{money(metrics.totalPurchaseAmount)}</strong>
        </div>
        <div>
          <span>Today's sales</span>
          <strong>
            {metrics.todaySales} <small>mobiles</small>
          </strong>
        </div>
        <div>
          <span>Today's net profit</span>
          <strong>{money(metrics.todayProfit)}</strong>
        </div>
      </section>
      {data.lowStock?.length > 0 && (
        <section className="low-stock-alert">
          <CircleAlert size={18} />
          <div>
            <strong>Low stock · {data.lowStock.length} models need attention</strong>
            <span>
              {data.lowStock
                .map((item) => `${item.brand} ${item.model} (${item.count})`)
                .join(" · ")}
            </span>
          </div>
        </section>
      )}
      <section className="dashboard-grid">
        <div className="panel chart-panel">
          <PanelTitle
            kicker="PERFORMANCE"
            title="Sales & profit"
            right={<span className="chart-period">Last 7 days</span>}
          />
          {charts.daily.length ? (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={charts.daily}
                  margin={{ left: 0, right: 8, top: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#24765d"
                        stopOpacity={0.19}
                      />
                      <stop offset="100%" stopColor="#24765d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e9eeeb" />
                  <XAxis
                    dataKey="_id"
                    tickFormatter={(value) =>
                      new Intl.DateTimeFormat("en", {
                        weekday: "short",
                      }).format(new Date(`${value}T00:00:00`))
                    }
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#858e88", fontSize: 11 }}
                    dy={9}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value, name) => [
                      money(value),
                      name === "sales" ? "Sales" : "Net profit",
                    ]}
                    labelFormatter={date}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#24765d"
                    strokeWidth={2.5}
                    fill="url(#salesFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#d5a24d"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty
              icon={BarChart3}
              title="Your sales chart is waiting"
              description="Completed sales will appear here with revenue and profit."
            />
          )}
          <div className="chart-legend">
            <span>
              <i className="legend-sales" /> Sales
            </span>
            <span>
              <i className="legend-profit" /> Net profit
            </span>
          </div>
        </div>
        <div className="panel chart-panel brand-panel">
          <PanelTitle
            kicker="STOCK BREAKDOWN"
            title="By company"
            right={<Boxes size={18} className="muted-icon" />}
          />
          {charts.brandMix.length ? (
            <>
              <div className="brand-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={charts.brandMix}
                    layout="vertical"
                    margin={{ left: 0, right: 6, top: 2, bottom: 2 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#68736c", fontSize: 11 }}
                    />
                    <Tooltip cursor={{ fill: "#f5f8f5" }} />
                    <Bar
                      dataKey="value"
                      fill="#24765d"
                      radius={[0, 4, 4, 0]}
                      barSize={13}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="panel-footnote">Available devices by brand</p>
            </>
          ) : (
            <Empty
              icon={Smartphone}
              title="No stock to break down"
              description="Add mobiles to see the mix by brand."
            />
          )}
        </div>
      </section>
      <section className="panel recent-panel">
        <PanelTitle
          kicker="LATEST ACTIVITY"
          title="Recent sales"
          right={
            <NavLink className="text-link" to="/sold">
              View all <ArrowUpRight size={15} />
            </NavLink>
          }
        />
        {recent.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mobile</th>
                  <th>Sale date</th>
                  <th>Sale amount</th>
                  <th>Net profit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <strong>
                        {sale.brand} {sale.model}
                      </strong>
                      <small>Sale transaction</small>
                    </td>
                    <td>{dateTime(sale.soldAt)}</td>
                    <td>{money(sale.sellingPrice)}</td>
                    <td
                      className={sale.netProfit < 0 ? "negative" : "positive"}
                    >
                      {money(sale.netProfit)}
                    </td>
                    <td>
                      <Badge status="SOLD" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={ClipboardList}
            title="No completed sales yet"
            description="When you sell a mobile, the transaction will show here."
          />
        )}
      </section>
    </>
  );
}

function Metric({ label, value, icon: Icon, color, note }) {
  return (
    <div className="metric-card">
      <span className={`metric-icon ${color}`}>
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </div>
  );
}

function PanelTitle({ kicker, title, right }) {
  return (
    <div className="panel-heading">
      <div>
        <span className="section-kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      {right}
    </div>
  );
}

function InventoryPage({ notify }) {
  const fin = useFinancial();
  const [locked, setLocked] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ ram: "", storage: "", from: "", to: "", sort: "newest" });
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ search, page: String(page), limit: "20", ...filters });
    const timer = window.setTimeout(
      () =>
        api(`/inventory?${params}`)
          .then((result) => {
            if (!active) return;
            setItems(result.items);
            setPages(result.pages);
            setTotal(result.total);
            setLocked(Boolean(result.financialLocked));
          })
          .catch((requestError) => active && setError(requestError.message))
          .finally(() => active && setLoading(false)),
      180,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, filters, page, fin.version, reload]);
  // Editing shows the purchase price, so it needs financial access.
  async function openEdit(item) {
    if (!(await fin.ensureUnlocked())) return;
    try {
      setEditing((await api(`/inventory/${item._id}`)).item);
    } catch (requestError) {
      notify(requestError.message);
    }
  }
  async function removeItem() {
    const result = await api(`/inventory/${deleting._id}`, { method: "DELETE" });
    notify(result.message);
    if (items.length === 1 && page > 1) setPage(page - 1);
    else setReload((current) => current + 1);
  }
  return (
    <>
      <Heading
        eyebrow="STOCK CONTROL"
        title="Inventory"
        subtitle="Track every device by its unique IMEI."
        right={
          <NavLink to="/purchases" className="button primary">
            <Plus size={17} />
            Add mobile
          </NavLink>
        }
      />
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            placeholder="Search IMEI, model, company or dealer"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLoading(true);
              setError("");
            }}
          />
          <span className="search-hint">Search</span>
        </div>
        <span className="record-count">
          <Boxes size={16} />
          {loading ? "Loading…" : `${total} in stock`}
        </span>
      </div>
      {locked && <FinancialLockedBanner />}
      <div className="inventory-filters">
        <span><Filter size={15} />Filter & sort</span>
        <label>RAM<input value={filters.ram} onChange={(event) => { setFilters({ ...filters, ram: event.target.value }); setPage(1); setLoading(true); }} placeholder="Any" /></label>
        <label>Storage<input value={filters.storage} onChange={(event) => { setFilters({ ...filters, storage: event.target.value }); setPage(1); setLoading(true); }} placeholder="Any" /></label>
        <label>Purchased after<input type="date" value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); setLoading(true); }} /></label>
        <label>Purchased before<input type="date" value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); setLoading(true); }} /></label>
        <label>Sort<select value={filters.sort} onChange={(event) => { setFilters({ ...filters, sort: event.target.value }); setPage(1); setLoading(true); }}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="priceAsc">Price: low to high</option><option value="priceDesc">Price: high to low</option></select></label>
      </div>
      {error ? (
        <Notice message={error} />
      ) : loading ? (
        <Loading />
      ) : (
        <section className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>IMEI</th>
                  <th>RAM / storage</th>
                  <th>Dealer</th>
                  <th>Purchase price</th>
                  <th>Purchase date</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <DeviceCell
                        brand={item.brand}
                        model={item.model}
                        detail={
                          item.modelNumber || item.color || "Mobile device"
                        }
                      />
                    </td>
                    <td className="imei-text">{masked(item.imei1)}</td>
                    <td>
                      {[item.ram, item.storage].filter(Boolean).join(" / ") ||
                        "—"}
                    </td>
                    <td>{item.dealerName || "—"}</td>
                    <td className="table-amount">
                      {money(item.purchasePrice)}
                    </td>
                    <td>{date(item.purchaseDate)}</td>
                    <td>
                      <Badge status={item.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" title="Edit mobile" aria-label={`Edit ${item.brand} ${item.model}`} onClick={() => openEdit(item)}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-button row-delete" title="Delete mobile" aria-label={`Delete ${item.brand} ${item.model}`} onClick={() => setDeleting(item)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && (
              <Empty
                icon={Boxes}
                title={
                  search ? "No matching mobiles" : "Your inventory is empty"
                }
                description={
                  search
                    ? "Try another IMEI, model, brand, or dealer."
                    : "Add your first phone to start tracking stock and investment."
                }
                action={
                  !search && (
                    <NavLink to="/purchases" className="button primary">
                      <Plus size={16} />
                      Add first mobile
                    </NavLink>
                  )
                }
              />
            )}
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </section>
      )}
      {editing && (
        <EditStockModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify("Mobile details updated.");
            setReload((current) => current + 1);
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          title="Delete mobile"
          message={`Delete ${deleting.brand} ${deleting.model} (IMEI ${deleting.imei1}) from stock?${deleting.purchaseInvoiceId ? ` One phone is given back to invoice ${deleting.invoiceNumber}.` : ""}`}
          onConfirm={removeItem}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

const STOCK_EDIT_FIELDS = ["imei1", "imei2", "serialNumber", "brand", "model", "modelNumber", "color", "ram", "storage", "dealer", "dealerName", "invoiceNumber", "purchaseDate", "purchasePrice"];
const stockEditForm = (item) => ({
  ...Object.fromEntries(STOCK_EDIT_FIELDS.map((key) => [key, item[key] ?? ""])),
  purchaseDate: String(item.purchaseDate || "").slice(0, 10),
  purchasePrice: String(item.purchasePrice ?? ""),
});

function EditStockModal({ item, onClose, onSaved }) {
  const [original] = useState(() => stockEditForm(item));
  const [form, setForm] = useState(original);
  const [dealers, setDealers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const linked = Boolean(item.purchaseInvoiceId);
  useEffect(() => {
    if (linked) return;
    api("/dealers").then(({ items }) => setDealers(items)).catch(() => {});
  }, [linked]);
  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const digits = (key) => (value) => update(key)(value.replace(/\D/g, "").slice(0, 15));
  async function submit(event) {
    event.preventDefault();
    if (!isValidImeiClient(form.imei1)) return setError("Enter a valid 15-digit IMEI 1.");
    if (form.imei2 && !isValidImeiClient(form.imei2)) return setError("Enter a valid 15-digit IMEI 2, or leave it empty.");
    if (form.imei1 === form.imei2) return setError("IMEI 1 and IMEI 2 must be different.");
    const managed = linked ? ["dealer", "dealerName", "invoiceNumber", "purchaseDate"] : [];
    const changes = {};
    for (const key of STOCK_EDIT_FIELDS) if (!managed.includes(key) && form[key] !== original[key]) changes[key] = form[key];
    if (changes.purchasePrice !== undefined) changes.purchasePrice = Number(changes.purchasePrice);
    if (!Object.keys(changes).length) return onClose();
    setBusy(true);
    setError("");
    try {
      await api(`/inventory/${item._id}`, { method: "PATCH", body: JSON.stringify(changes) });
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Edit mobile" onClose={() => !busy && onClose()}>
      <form className="stack-form" onSubmit={submit}>
        <div className="field-grid">
          <Field label="IMEI 1" value={form.imei1} onChange={digits("imei1")} required inputMode="numeric" maxLength={15} />
          <Field label="IMEI 2" value={form.imei2} onChange={digits("imei2")} inputMode="numeric" maxLength={15} placeholder="Optional" />
          <Field label="Serial number (S/N)" value={form.serialNumber} onChange={(value) => update("serialNumber")(value.toUpperCase())} maxLength={60} />
          <Field label="Brand name" value={form.brand} onChange={update("brand")} required />
          <Field label="Device name" value={form.model} onChange={update("model")} required />
          <Field label="Model number" value={form.modelNumber} onChange={update("modelNumber")} />
          <Field label="Color" value={form.color} onChange={update("color")} />
          <Field label="RAM" value={form.ram} onChange={update("ram")} />
          <Field label="Storage / ROM" value={form.storage} onChange={update("storage")} />
          {!linked && (
            <>
              <label className="field">
                <span>Dealer</span>
                <select value={form.dealer} onChange={(event) => update("dealer")(event.target.value)}>
                  <option value="">Not listed</option>
                  {dealers.map((dealer) => <option key={dealer._id} value={dealer._id}>{dealer.name}</option>)}
                </select>
              </label>
              {!form.dealer && <Field label="Dealer name (manual)" value={form.dealerName} onChange={update("dealerName")} />}
              <Field label="Invoice number" value={form.invoiceNumber} onChange={update("invoiceNumber")} />
              <Field label="Purchase date" type="date" value={form.purchaseDate} onChange={update("purchaseDate")} required />
            </>
          )}
          <Field label="Dealer purchase price" type="number" value={form.purchasePrice} onChange={update("purchasePrice")} required min="0" step="0.01" />
        </div>
        {linked && <p className="edit-note">Dealer, invoice number and date come from invoice {item.invoiceNumber}. Change them on the invoice.</p>}
        {error && <Notice message={error} />}
        <div className="pin-actions">
          <button type="button" className="button outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <span>Page {page} of {pages}</span>
      <div>
        <button className="icon-button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button>
        <button className="icon-button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button>
      </div>
    </div>
  );
}

function DeviceCell({ brand, model, detail }) {
  return (
    <div className="device-cell">
      <span className="device-thumb">
        <Smartphone size={17} />
      </span>
      <span>
        <strong>
          {brand} {model}
        </strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}

const emptyDevice = () => ({
  brand: "",
  model: "",
  modelNumber: "",
  imei1: "",
  imei2: "",
  serialNumber: "",
  ram: "",
  storage: "",
  color: "",
  dealer: "",
  dealerName: "",
  invoiceNumber: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  purchasePrice: "",
});

function StockPage({ notify }) {
  const fin = useFinancial();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dealers, setDealers] = useState([]);
  const [form, setForm] = useState(emptyDevice);
  // Selected purchase invoice: the source of truth for dealer, invoice number and date.
  const [invoice, setInvoice] = useState(null);
  const invoiceParam = searchParams.get("invoice");
  useEffect(() => {
    if (!invoiceParam) return;
    api(`/purchase-invoices/${invoiceParam}`)
      .then(({ invoice: found }) => found.remainingQuantity > 0 && setInvoice(found))
      .catch(() => {});
  }, [invoiceParam]);
  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [error, setError] = useState("");
  const [lookupNote, setLookupNote] = useState("");
  const [lookupSuccess, setLookupSuccess] = useState(false);
  const [lookupRequest, setLookupRequest] = useState(0);
  const [imeiTaken, setImeiTaken] = useState(false);
  useEffect(() => {
    api("/dealers")
      .then(({ items }) => setDealers(items))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const imei = form.imei1;
    if (imei.length !== 15) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLookupBusy(true);
      setLookupNote("");
      setLookupSuccess(false);
      if (!isValidImeiClient(imei)) {
        setLookupNote("Invalid IMEI check digit. Check the number and try again.");
        setLookupBusy(false);
        return;
      }
      try {
        // A phone that is already recorded must not be added, so skip the (possibly paid) lookup.
        const existing = await api(`/inventory/check-imei?imei=${imei}`);
        if (!active) return;
        if (existing.exists) {
          setImeiTaken(true);
          setLookupNote(existing.message);
          return;
        }
        const result = await api("/device-lookup", {
          method: "POST",
          body: JSON.stringify({ imei }),
        });
        if (!active) return;
        if (result.success) {
          setForm((current) => current.imei1 !== imei ? current : ({
            ...current,
            brand: result.data.brandName || current.brand,
            model: result.data.deviceName || current.model,
            modelNumber: result.data.modelNumber || current.modelNumber,
          }));
          const sourceLabel = result.source === "local_database" ? "local TAC database" : "HiCellTek IMEI API";
          const missingLabels = { brandName: "brand", deviceName: "device name", modelNumber: "model number" };
          const missing = (result.missingFields || []).map((field) => missingLabels[field] || field);
          setLookupSuccess(true);
          setLookupNote(missing.length
            ? `Device details partly found from ${sourceLabel}. Please enter the ${missing.join(", ")} manually.`
            : `Device details found from ${sourceLabel}. Review and edit if needed.`);
        } else {
          setLookupNote(result.message || MANUAL_LOOKUP_MESSAGE);
        }
      } catch (requestError) {
        if (!active) return;
        const detail = requestError.data?.fallbackError?.code === "hicelltek_quota"
          ? " (Online lookup limit reached for now.)"
          : "";
        setLookupNote(requestError.status === 400
          ? requestError.message
          : `${requestError.data?.message || MANUAL_LOOKUP_MESSAGE}${detail}`);
      } finally {
        if (active) setLookupBusy(false);
      }
    }, lookupRequest ? 0 : 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.imei1, lookupRequest]);
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  function setPrimaryImei(value) {
    const imei1 = value.replace(/\D/g, "").slice(0, 15);
    setForm((current) => ({
      ...current,
      imei1,
      ...(current.imei1 !== imei1 ? { brand: "", model: "", modelNumber: "" } : {}),
    }));
    setLookupNote("");
    setLookupSuccess(false);
    setImeiTaken(false);
    setError("");
  }
  function lookup() {
    if (!isValidImeiClient(form.imei1)) {
      setLookupNote("Enter a valid 15-digit IMEI before searching.");
      setLookupSuccess(false);
      return;
    }
    setLookupRequest((current) => current + 1);
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.imei2 && form.imei1 === form.imei2) {
      setError("IMEI 1 and IMEI 2 must be different.");
      return;
    }
    // Entering a dealer purchase price is protected; the API enforces this too.
    if (!(await fin.ensureUnlocked())) {
      setError("Unlock financial information with your PIN to save the purchase price.");
      return;
    }
    setBusy(true);
    try {
      const duplicateChecks = await Promise.all(
        [form.imei1, form.imei2].filter(Boolean).map((imei) =>
          api(`/inventory/check-imei?imei=${encodeURIComponent(imei)}`),
        ),
      );
      const taken = duplicateChecks.find((check) => check.exists);
      if (taken) throw new Error(taken.message);
      const payload = invoice
        ? { ...form, dealer: "", dealerName: "", invoiceNumber: "", purchaseDate: undefined, purchaseInvoiceId: invoice._id }
        : { ...form };
      await api("/inventory", {
        method: "POST",
        body: JSON.stringify({ ...payload, purchasePrice: Number(form.purchasePrice) }),
      });
      if (!invoice) {
        notify("Mobile added to stock.");
        navigate("/inventory");
        return;
      }
      // Invoice workflow: stay here with the invoice selected so the next phone can be scanned.
      const { invoice: refreshed } = await api(`/purchase-invoices/${invoice._id}`);
      if (refreshed.remainingQuantity <= 0) {
        notify(`Invoice ${refreshed.invoiceNumber} is complete: all ${refreshed.totalQuantity} phones added.`);
        navigate(`/invoices/${refreshed._id}`);
        return;
      }
      setInvoice(refreshed);
      setForm((current) => ({ ...emptyDevice(), purchasePrice: current.purchasePrice }));
      setLookupNote("");
      setLookupSuccess(false);
      notify(`Added to ${refreshed.invoiceNumber}: ${refreshed.addedQuantity} of ${refreshed.totalQuantity}. Scan the next phone.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="PURCHASE MANAGEMENT"
        title="Add to stock"
        subtitle="Record each physical mobile as its own inventory item."
        right={
          <NavLink className="back-link" to="/inventory">
            <ArrowLeft size={16} />
            Inventory
          </NavLink>
        }
      />
      {error && <Notice message={error} />}
      <form className="form-layout" onSubmit={submit}>
        <div className="form-main">
          <section className="panel form-panel">
            <FormSection
              number="01"
              title="Device details"
              description="Scan the box or enter the device information."
            />
            <div className="imei-entry">
              <Field
                label="IMEI 1"
                value={form.imei1}
                onChange={setPrimaryImei}
                required
                inputMode="numeric"
                placeholder="15-digit IMEI"
                maxLength={15}
              />
              <button
                type="button"
                className="button outline"
                onClick={() => setScanner(true)}
              >
                <Smartphone size={17} />
                Scan barcode
              </button>
              <button
                type="button"
                className="button outline"
                onClick={lookup}
                disabled={lookupBusy}
              >
                {lookupBusy ? "Searching…" : "Search"}
              </button>
            </div>
            <p className="lookup-warning">If the local TAC database has no match, the online lookup may use account balance.</p>
            {lookupNote && (
              <div className={`lookup-note ${lookupSuccess ? "success" : "failure"}`}>
                {lookupSuccess ? <Check size={15} /> : <CircleAlert size={15} />}
                {lookupNote}
              </div>
            )}
            <div className="field-grid">
              <Field
                label="IMEI 2"
                value={form.imei2}
                onChange={(value) =>
                  update("imei2", value.replace(/\D/g, "").slice(0, 15))
                }
                inputMode="numeric"
                placeholder="Optional"
                maxLength={15}
              />
              <Field
                label="Serial number (S/N)"
                value={form.serialNumber}
                onChange={(value) => update("serialNumber", value.toUpperCase().slice(0, 60))}
                placeholder="Scan the S/N barcode or type it"
                maxLength={60}
              />
              <Field
                label="Company / brand"
                label="Brand name"
                value={form.brand}
                onChange={(value) => update("brand", value)}
                required
                placeholder="Enter or identify a brand"
              />
              <Field
                label="Device name"
                value={form.model}
                onChange={(value) => update("model", value)}
                required
                placeholder="Enter or identify a device"
              />
              <Field
                label="Model number"
                value={form.modelNumber}
                onChange={(value) => update("modelNumber", value)}
                placeholder="Enter or identify a model number"
              />
              <Field
                label="Color"
                value={form.color}
                onChange={(value) => update("color", value)}
                placeholder="e.g. Navy"
              />
              <Field
                label="RAM"
                value={form.ram}
                onChange={(value) => update("ram", value)}
                placeholder="e.g. 8 GB"
              />
              <Field
                label="Storage / ROM"
                value={form.storage}
                onChange={(value) => update("storage", value)}
                placeholder="e.g. 256 GB"
              />
            </div>
          </section>
          <section className="panel form-panel">
            <FormSection
              number="02"
              title="Purchase details"
              description="Pick the purchase invoice; dealer, invoice number and date come from it."
            />
            <InvoicePicker selected={invoice} onSelect={setInvoice} />
            <div className="field-grid">
              {invoice ? (
                <>
                  <Field label="Dealer (from invoice)" value={invoice.dealerName} onChange={() => {}} readOnly aria-readonly="true" className="readonly" />
                  <Field label="Invoice number (from invoice)" value={invoice.invoiceNumber} onChange={() => {}} readOnly aria-readonly="true" />
                  <Field label="Invoice date (read-only)" type="date" value={String(invoice.invoiceDate).slice(0, 10)} onChange={() => {}} readOnly aria-readonly="true" />
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Dealer</span>
                    <select
                      value={form.dealer}
                      onChange={(event) => update("dealer", event.target.value)}
                    >
                      <option value="">Choose a dealer</option>
                      {dealers.map((dealer) => (
                        <option key={dealer._id} value={dealer._id}>
                          {dealer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Dealer name (manual)"
                    value={form.dealerName}
                    onChange={(value) => update("dealerName", value)}
                    placeholder="When dealer is not listed"
                  />
                  <Field
                    label="Invoice number"
                    value={form.invoiceNumber}
                    onChange={(value) => update("invoiceNumber", value)}
                    placeholder="Optional"
                  />
                  <Field
                    label="Purchase date"
                    type="date"
                    value={form.purchaseDate}
                    onChange={(value) => update("purchaseDate", value)}
                    required
                  />
                </>
              )}
              <Field
                label={fin.locked ? "Dealer purchase price (PIN needed to save)" : "Dealer purchase price"}
                type="number"
                value={form.purchasePrice}
                onChange={(value) => update("purchasePrice", value)}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
          </section>
        </div>
        <aside className="form-aside">
          <div className="panel aside-summary">
            <span className="section-kicker">STOCK ENTRY</span>
            <div className="summary-device">
              <Smartphone size={21} />
              <span>
                {form.brand || "New mobile"}
                <small>{form.model || "Device details will appear here"}</small>
              </span>
            </div>
            <div className="summary-line">
              <span>IMEI</span>
              <strong>{form.imei1 ? masked(form.imei1) : "Not entered"}</strong>
            </div>
            {invoice && (
              <div className="summary-line">
                <span>Invoice</span>
                <strong>{invoice.invoiceNumber} · {invoice.remainingQuantity} left</strong>
              </div>
            )}
            <div className="summary-line">
              <span>Purchase cost</span>
              <strong>
                {form.purchasePrice ? money(Number(form.purchasePrice)) : "—"}
              </strong>
            </div>
            <div className="summary-status">
              <i />
              Will be added as in stock
            </div>
            <button className="button primary wide" disabled={busy || imeiTaken}>
              {busy ? (
                "Saving mobile…"
              ) : (
                <>
                  <Plus size={17} />
                  Add to stock
                </>
              )}
            </button>
            <p className="aside-footnote">
              An IMEI can be recorded only once, even after the phone is sold.
            </p>
          </div>
        </aside>
      </form>
      {scanner && (
        <ScannerModal
          onScan={(imei) => {
            setPrimaryImei(imei);
            setScanner(false);
            setError("");
          }}
          onSerial={(serialNumber) => {
            update("serialNumber", serialNumber);
            setScanner(false);
            setError("");
          }}
          onClose={() => setScanner(false)}
        />
      )}
    </>
  );
}

function FormSection({ number, title, description }) {
  return (
    <div className="form-section-title">
      <span className="step-index">{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function SellPage({ notify }) {
  const fin = useFinancial();
  const [imei, setImei] = useState("");
  const [lastSix, setLastSix] = useState("");
  const [matches, setMatches] = useState(null);
  const [searching, setSearching] = useState(false);
  const [device, setDevice] = useState(null);
  const [scanner, setScanner] = useState(false);
  const [form, setForm] = useState({
    sellingPrice: "",
    discount: "0",
    additionalExpenses: "0",
    customerName: "",
    customerPhone: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  // Loads the full stock record (purchase price is only included when unlocked).
  async function selectDevice(item, saleImei) {
    setError("");
    try {
      const result = await api(`/inventory/${item._id}`);
      if (result.item.status !== "IN_STOCK")
        return setError("This mobile is no longer available to sell.");
      setDevice({ ...result.item, saleImei });
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  async function searchLastSix(value = lastSix) {
    setError("");
    setDevice(null);
    setMatches(null);
    if (!/^\d{6}$/.test(value))
      return setError("Enter exactly 6 digits of the IMEI.");
    setSearching(true);
    try {
      const result = await api(
        `/inventory/search-imei-last-six?digits=${encodeURIComponent(value)}`,
      );
      if (!result.items.length)
        return setError(result.message || "No available phone found with these IMEI last 6 digits.");
      setMatches(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSearching(false);
    }
  }
  // Short debounce: search as soon as 6 digits are typed. Enter searches immediately.
  useEffect(() => {
    if (lastSix.length !== 6) return undefined;
    const timer = window.setTimeout(() => searchLastSix(lastSix), 350);
    return () => window.clearTimeout(timer);
  }, [lastSix]);
  // Re-read the selected phone when financial access changes so cost appears or is cleared.
  useEffect(() => {
    if (!device) return;
    api(`/inventory/${device._id}`)
      .then((result) => setDevice((current) => current && current._id === result.item._id ? { ...result.item, saleImei: current.saleImei } : current))
      .catch(() => {});
  }, [fin.version]);
  async function findDevice(value = imei) {
    setError("");
    setDevice(null);
    setMatches(null);
    if (!/^\d{15}$/.test(value))
      return setError("Enter a valid 15-digit IMEI.");
    try {
      const result = await api(
        `/inventory?search=${encodeURIComponent(value)}&limit=1`,
      );
      const item = result.items.find((candidate) =>
        candidate.imeiKeys?.includes(value),
      );
      if (!item)
        return setError("No available mobile was found for this IMEI.");
      await selectDevice(item, value);
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  // "Sell out" only opens the confirmation dialog; recordSale runs when it is confirmed.
  function submit(event) {
    event.preventDefault();
    if (!device) return;
    setConfirmError("");
    setConfirming(true);
  }
  async function recordSale() {
    if (!device || busy) return;
    setBusy(true);
    setError("");
    setConfirmError("");
    try {
      await api("/sales", {
        method: "POST",
        body: JSON.stringify({ imei: device.saleImei || device.imei1, ...form }),
      });
      notify("Sale recorded and inventory updated.");
      setConfirming(false);
      setDevice(null);
      setImei("");
      setLastSix("");
      setMatches(null);
      setForm({
        sellingPrice: "",
        discount: "0",
        additionalExpenses: "0",
        customerName: "",
        customerPhone: "",
      });
    } catch (requestError) {
      setConfirmError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="SALES MANAGEMENT"
        title="Sell a mobile"
        subtitle="Find the exact device, review its cost, then record the sale."
      />
      <div className="sell-layout">
        <section className="panel sell-search-panel">
          <PanelTitle
            kicker="STEP 01"
            title="Identify mobile"
            right={<span className="step-bubble">01</span>}
          />
          <form
            className="last-six-form"
            onSubmit={(event) => {
              event.preventDefault();
              searchLastSix();
            }}
          >
            <div className="sell-imei-row">
              <Field
                label="Search phone by IMEI last 6 digits"
                value={lastSix}
                onChange={(value) => {
                  setLastSix(value.replace(/\D/g, "").slice(0, 6));
                  setMatches(null);
                }}
                inputMode="numeric"
                maxLength={6}
                placeholder="e.g. 123456"
                autoFocus
              />
              <button className="button primary" type="submit" disabled={searching}>
                <Search size={17} />
                {searching ? "Searching…" : "Search"}
              </button>
            </div>
          </form>
          {matches && (
            <div className="match-list" role="list">
              <span className="match-count">
                {matches.items.length === 1
                  ? "1 available phone found. Select it to continue."
                  : `${matches.items.length} available phones end with ${matches.digits}. Select the correct one.`}
                {matches.truncated && " Showing the first 25."}
              </span>
              {matches.items.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  role="listitem"
                  className={`match-item ${device?._id === item._id ? "selected" : ""}`}
                  onClick={() => selectDevice(item, item.matchedImei)}
                >
                  <strong>{item.brand} {item.model}</strong>
                  <span>{item.modelNumber || "No model number"} · {[item.ram, item.storage, item.color].filter(Boolean).join(" · ") || "—"}</span>
                  <span className="imei-text">IMEI {masked(item.matchedImei)} · last 6 <b>{item.imeiLastSix}</b></span>
                  <span>Invoice {item.invoiceNumber || "—"} · Dealer {item.dealerName || "—"} · <Badge status={item.status} /></span>
                </button>
              ))}
            </div>
          )}
          <div className="sell-or">or scan / enter the full IMEI</div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              findDevice();
            }}
          >
            <div className="sell-imei-row">
              <Field
                label="Scan or enter IMEI"
                value={imei}
                onChange={(value) =>
                  setImei(value.replace(/\D/g, "").slice(0, 15))
                }
                inputMode="numeric"
                maxLength={15}
                placeholder="15-digit IMEI"
              />
              <button
                className="button outline sell-scan"
                type="button"
                onClick={() => setScanner(true)}
              >
                <Smartphone size={17} />
                Scan
              </button>
              <button className="button primary" type="submit">
                <Search size={17} />
                Find mobile
              </button>
            </div>
          </form>
          {error && <Notice message={error} />}
          {device ? (
            <div className="sale-device">
              <div className="sale-device-top">
                <span className="device-thumb large">
                  <Smartphone size={21} />
                </span>
                <div>
                  <span className="status-label">AVAILABLE TO SELL</span>
                  <h3>
                    {device.brand} {device.model}
                  </h3>
                  <span>
                    {device.ram || "—"} RAM · {device.storage || "—"} storage ·{" "}
                    {device.color || "—"}
                  </span>
                </div>
              </div>
              <div className="sale-device-details">
                <Detail label="IMEI" value={masked(device.saleImei || device.imei1)} />
                <Detail label="Model number" value={device.modelNumber || "—"} />
                <Detail
                  label="Purchase price"
                  value={money(device.purchasePrice)}
                />
                <Detail label="Dealer" value={device.dealerName || "—"} />
                <Detail label="Invoice" value={device.invoiceNumber || "—"} />
                <Detail
                  label="Purchase date"
                  value={date(device.purchaseDate)}
                />
              </div>
            </div>
          ) : (
            <div className="sell-empty">
              <div className="scan-orbit">
                <Smartphone size={25} />
              </div>
              <strong>Device details will appear here</strong>
              <span>Type the last 6 IMEI digits, scan the barcode, or enter the full IMEI.</span>
            </div>
          )}
        </section>
        <section
          className={`panel sell-form-panel ${!device ? "form-disabled" : ""}`}
        >
          <PanelTitle
            kicker="STEP 02"
            title="Complete sale"
            right={
              <span className={`step-bubble ${device ? "ready" : ""}`}>02</span>
            }
          />
          <form className="stack-form" onSubmit={submit}>
            <div className="field-grid">
              <Field
                label="Selling price"
                type="number"
                value={form.sellingPrice}
                onChange={(sellingPrice) => setForm({ ...form, sellingPrice })}
                min="0.01"
                step="0.01"
                placeholder="0.00"
                required
                disabled={!device}
              />
              <Field
                label="Discount"
                type="number"
                value={form.discount}
                onChange={(discount) => setForm({ ...form, discount })}
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={!device}
              />
              <Field
                label="Additional expenses"
                type="number"
                value={form.additionalExpenses}
                onChange={(additionalExpenses) =>
                  setForm({ ...form, additionalExpenses })
                }
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={!device}
              />
              <Field
                label="Customer name"
                value={form.customerName}
                onChange={(customerName) => setForm({ ...form, customerName })}
                placeholder="Optional"
                disabled={!device}
              />
              <Field
                label="Customer phone"
                type="tel"
                value={form.customerPhone}
                onChange={(customerPhone) =>
                  setForm({ ...form, customerPhone })
                }
                placeholder="Optional"
                disabled={!device}
              />
            </div>
            {device && typeof device.purchasePrice === "number" && (
              <div className="profit-preview">
                <span>Estimated net profit</span>
                <strong>
                  {money(
                    Number(form.sellingPrice || 0) -
                      device.purchasePrice -
                      Number(form.additionalExpenses || 0),
                  )}
                </strong>
                <small>Selling price − purchase price − expenses</small>
              </div>
            )}
            <button className="button primary wide" disabled={!device || busy}>
              {busy ? (
                "Recording sale…"
              ) : (
                <>
                  <ArrowUpRight size={17} />
                  Sell out
                </>
              )}
            </button>
            <p className="sale-warning">
              <CircleAlert size={15} />A sale is final. An IMEI can only be sold
              once.
            </p>
          </form>
        </section>
      </div>
      {scanner && (
        <ScannerModal
          onScan={(value) => {
            setImei(value);
            setScanner(false);
            findDevice(value);
          }}
          onClose={() => setScanner(false)}
        />
      )}
      {confirming && device && (
        <Modal title="Confirm sale" onClose={() => !busy && setConfirming(false)}>
          <div className="sale-confirm">
            <div className="modal-device">
              <span className="device-thumb large">
                <Smartphone size={21} />
              </span>
              <div>
                <h3>{device.brand} {device.model}</h3>
                {device.modelNumber && <p>{device.modelNumber}</p>}
              </div>
            </div>
            <div className="sale-ledger">
              <Detail label="IMEI ending" value={(device.saleImei || device.imei1).slice(-6)} />
              <Detail label="Selling price" value={money(Number(form.sellingPrice))} />
            </div>
            <p className="sale-confirm-warning">
              <CircleAlert size={15} /> This cannot be undone.
            </p>
            {confirmError && <Notice message={confirmError} />}
            <div className="pin-actions">
              <button type="button" className="button outline" onClick={() => setConfirming(false)} disabled={busy} autoFocus>
                Cancel
              </button>
              <button type="button" className="button primary" onClick={recordSale} disabled={busy}>
                {busy ? "Recording sale…" : "Confirm sale"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function SoldPage({ notify }) {
  const fin = useFinancial();
  const [locked, setLocked] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setSelected(null); // drop any detail opened under a previous unlock
    api(`/sales?page=${page}&limit=20`)
      .then((result) => {
        setItems(result.items);
        setPages(result.pages);
        setTotal(result.total);
        setLocked(Boolean(result.financialLocked));
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [page, fin.version, reload]);
  // Both change profit figures, so they need financial access (the API enforces this too).
  async function openEdit(sale) {
    if (!(await fin.ensureUnlocked())) return;
    try {
      setEditing((await api(`/sales/${sale._id}`)).sale);
    } catch (requestError) {
      notify(requestError.message);
    }
  }
  async function openDelete(sale) {
    if (await fin.ensureUnlocked()) setDeleting(sale);
  }
  async function removeSale() {
    const result = await api(`/sales/${deleting._id}`, { method: "DELETE" });
    notify(result.message);
    if (items.length === 1 && page > 1) setPage(page - 1);
    else setReload((current) => current + 1);
  }
  return (
    <>
      <Heading
        eyebrow="SALES HISTORY"
        title="Sold mobiles"
        subtitle="Every completed sale, with purchase and profit snapshots."
        right={
          <span className="record-count">
            <ClipboardList size={16} />
            {total} transactions
          </span>
        }
      />
      {locked && <FinancialLockedBanner />}
      {error ? (
        <Notice message={error} />
      ) : loading ? (
        <Loading />
      ) : (
        <section className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>IMEI</th>
                  <th>Purchase price</th>
                  <th>Selling price</th>
                  <th>Net profit</th>
                  <th>Sold on</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((sale) => (
                  <tr key={sale._id}>
                    <td>
                      <DeviceCell
                        brand={sale.snapshot.brand}
                        model={sale.snapshot.model}
                        detail={
                          [sale.snapshot.ram, sale.snapshot.storage]
                            .filter(Boolean)
                            .join(" / ") || "Mobile device"
                        }
                      />
                    </td>
                    <td className="imei-text">{masked(sale.snapshot.imei1)}</td>
                    <td>{money(sale.purchasePrice)}</td>
                    <td className="table-amount">{money(sale.sellingPrice)}</td>
                    <td
                      className={sale.netProfit < 0 ? "negative" : "positive"}
                    >
                      {money(sale.netProfit)}
                    </td>
                    <td>{dateTime(sale.soldAt)}</td>
                    <td>
                      <Badge status="SOLD" />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button eye-button"
                          title="View sale details"
                          aria-label="View sale details"
                          onClick={() => setSelected(sale)}
                        >
                          <Eye size={18} />
                        </button>
                        <button className="icon-button" title="Edit sale" aria-label="Edit sale" onClick={() => openEdit(sale)}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-button row-delete" title="Delete sale" aria-label="Delete sale" onClick={() => openDelete(sale)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && (
              <Empty
                icon={ClipboardList}
                title="No sold mobiles yet"
                description="Completed sales are preserved with their original purchase details."
              />
            )}
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </section>
      )}
      {selected && (
        <SaleModal sale={selected} onClose={() => setSelected(null)} />
      )}
      {editing && (
        <EditSaleModal
          sale={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify("Sale updated.");
            setReload((current) => current + 1);
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          title="Delete sale"
          message={`Delete this sale of ${deleting.snapshot.brand} ${deleting.snapshot.model} (IMEI ${deleting.snapshot.imei1})? The phone goes back to stock and its sale and profit are removed from your reports.`}
          onConfirm={removeSale}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

function EditSaleModal({ sale, onClose, onSaved }) {
  const [form, setForm] = useState({
    sellingPrice: String(sale.sellingPrice),
    discount: String(sale.discount || 0),
    additionalExpenses: String(sale.additionalExpenses || 0),
    customerName: sale.customer?.name || "",
    customerPhone: sale.customer?.phone || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const netProfit = Number(form.sellingPrice || 0) - sale.purchasePrice - Number(form.additionalExpenses || 0);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/sales/${sale._id}`, { method: "PATCH", body: JSON.stringify(form) });
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Edit sale" onClose={() => !busy && onClose()}>
      <form className="stack-form" onSubmit={submit}>
        <div className="modal-device">
          <span className="device-thumb large"><Smartphone size={21} /></span>
          <div>
            <h3>{sale.snapshot.brand} {sale.snapshot.model}</h3>
            <p>IMEI {sale.snapshot.imei1}</p>
          </div>
        </div>
        <div className="field-grid">
          <Field label="Selling price" type="number" value={form.sellingPrice} onChange={update("sellingPrice")} min="0.01" step="0.01" required />
          <Field label="Discount" type="number" value={form.discount} onChange={update("discount")} min="0" step="0.01" />
          <Field label="Additional expenses" type="number" value={form.additionalExpenses} onChange={update("additionalExpenses")} min="0" step="0.01" />
          <Field label="Customer name" value={form.customerName} onChange={update("customerName")} placeholder="Optional" />
          <Field label="Customer phone" type="tel" value={form.customerPhone} onChange={update("customerPhone")} placeholder="Optional" />
        </div>
        <div className="profit-preview">
          <span>Net profit after this change</span>
          <strong>{money(netProfit)}</strong>
          <small>Selling price − purchase price − expenses</small>
        </div>
        {error && <Notice message={error} />}
        <div className="pin-actions">
          <button type="button" className="button outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function SaleModal({ sale, onClose }) {
  const item = sale.snapshot || {};
  return (
    <Modal title="Sale details" onClose={onClose}>
      <div className="modal-device">
        <span className="device-thumb large">
          <Smartphone size={21} />
        </span>
        <div>
          <span className="section-kicker">SOLD DEVICE</span>
          <h3>
            {item.brand} {item.model}
          </h3>
          <p>
            {[item.modelNumber, item.ram, item.storage, item.color]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <div className="detail-grid">
        <Detail label="IMEI 1" value={item.imei1} />
        <Detail label="IMEI 2" value={item.imei2 || "—"} />
        <Detail label="Dealer" value={item.dealerName || "—"} />
        <Detail label="Serial number" value={item.serialNumber || "—"} />
        <Detail label="Invoice" value={item.invoiceNumber || "—"} />
        <Detail label="Purchase date" value={date(item.purchaseDate)} />
        <Detail label="Sale date" value={dateTime(sale.soldAt)} />
        <Detail label="Customer" value={sale.customer?.name || "—"} />
        <Detail label="Customer phone" value={sale.customer?.phone || "—"} />
      </div>
      <div className="sale-ledger">
        <Detail label="Purchase price" value={money(sale.purchasePrice)} />
        <Detail label="Selling price" value={money(sale.sellingPrice)} />
        <Detail label="Discount" value={money(sale.discount)} />
        <Detail
          label="Additional expenses"
          value={money(sale.additionalExpenses)}
        />
        <div className="ledger-profit">
          <span>Gross profit</span>
          <strong>{money(sale.grossProfit)}</strong>
        </div>
        <div className="ledger-profit net">
          <span>Net profit</span>
          <strong>{money(sale.netProfit)}</strong>
        </div>
      </div>
    </Modal>
  );
}

function ReportsPage() {
  const fin = useFinancial();
  const [locked, setLocked] = useState(false);
  const [period, setPeriod] = useState("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams({ ...reportDateParams(period, from, to), page: String(page), limit: "20" });
    setData(null);
    setError("");
    api(`/reports?${params}`)
      .then((result) => { setData(result); setLocked(false); })
      .catch((requestError) => {
        if (requestError.data?.code === "FINANCIAL_PIN_REQUIRED") setLocked(true);
        else setError(requestError.message);
      });
  }, [period, from, to, page, fin.version]);
  async function exportCsv() {
    try {
      const params = new URLSearchParams(reportDateParams(period, from, to));
      const response = await fetch(`${apiBase}/reports/export.csv?${params}`, { credentials: "include", headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
      if (!response.ok) throw new Error("Could not export this report.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "Shabana Inventory-profit-report.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="BUSINESS PERFORMANCE"
        title="Profit & reports"
        subtitle="Realized results from completed sales only."
        right={
          <div className="export-actions">
            <button
              className="button outline"
              onClick={exportCsv}
              disabled={!data?.total}
            >
              <FileDown size={16} />
              Export CSV
            </button>
            <button
              className="button outline"
              onClick={() => window.print()}
              disabled={!data}
            >
              <FileText size={16} />
              Save PDF
            </button>
          </div>
        }
      />
      <div className="report-toolbar">
        <div className="period-tabs">
          {[
            ["1", "Today"],
            ["2", "Yesterday"],
            ["7", "7 days"],
            ["30", "30 days"],
            ["month", "This month"],
            ["all", "All time"],
            ["custom", "Custom"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={period === value ? "selected" : ""}
              onClick={() => {
                setError("");
                setPeriod(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="custom-dates">
            <label>
              From
              <input
                type="date"
                value={from}
                onChange={(event) => {
                  setError("");
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={to}
                onChange={(event) => {
                  setError("");
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
        )}
      </div>
      {locked ? (
        <FinancialLockedPanel />
      ) : error ? (
        <Notice message={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <section className="report-metrics">
            <Metric
              label="Gross profit"
              value={money(data.summary.grossProfit)}
              icon={TrendingUp}
              color="green"
              note="Sales less purchase cost"
            />
            <Metric
              label="Net profit"
              value={money(data.summary.netProfit)}
              icon={Wallet}
              color="rose"
              note="After additional expenses"
            />
            <Metric
              label="Sales revenue"
              value={money(data.summary.salesRevenue)}
              icon={ArrowUpRight}
              color="blue"
              note="Completed transactions"
            />
            <Metric
              label="Sold devices"
              value={data.summary.soldCount}
              icon={Smartphone}
              color="amber"
              note="Realized sales only"
            />
          </section>
          <section className="report-grid">
            <div className="panel chart-panel">
              <PanelTitle kicker="REALIZED RESULTS" title="Profit by day" />
              {data.daily.length ? (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.daily}>
                      <CartesianGrid vertical={false} stroke="#e9eeeb" />
                      <XAxis
                        dataKey="_id"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#858e88", fontSize: 11 }}
                      />
                      <YAxis hide />
                      <Tooltip formatter={money} />
                      <Area
                        type="monotone"
                        dataKey="netProfit"
                        stroke="#24765d"
                        fill="#e6f1ec"
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  icon={BarChart3}
                  title="No profit to chart"
                  description="Choose another period or record a completed sale."
                />
              )}
            </div>
            <div className="panel report-breakdown">
              <PanelTitle kicker="BY COMPANY" title="Net profit" />
              {data.company.length ? (
                data.company.map((entry) => (
                  <div className="breakdown-row" key={entry._id}>
                    <div>
                      <strong>{entry._id || "Unspecified"}</strong>
                      <span>
                        {entry.soldCount} sold · {money(entry.revenue)} revenue
                      </span>
                    </div>
                    <strong>{money(entry.netProfit)}</strong>
                  </div>
                ))
              ) : (
                <Empty
                  icon={Building2}
                  title="No company results"
                  description="Company totals appear after sales are recorded."
                />
              )}
            </div>
          </section>
          <section className="report-summary-bar">
            <div>
              <span>Total purchase amount sold</span>
              <strong>{money(data.summary.purchaseAmount)}</strong>
            </div>
            <div>
              <span>Unsold inventory investment</span>
              <strong>{money(data.inventoryInvestment.amount)}</strong>
            </div>
            <div>
              <span>Unsold devices</span>
              <strong>{data.inventoryInvestment.count}</strong>
            </div>
          </section>
          <section className="report-segment-grid">
            <div className="panel report-breakdown">
              <PanelTitle kicker="BY MODEL" title="Net profit" />
              {data.model.length ? (
                data.model.map((entry) => (
                  <div
                    className="breakdown-row"
                    key={`${entry._id.brand}-${entry._id.model}`}
                  >
                    <div>
                      <strong>
                        {entry._id.brand} {entry._id.model}
                      </strong>
                      <span>{entry.soldCount} sold</span>
                    </div>
                    <strong>{money(entry.netProfit)}</strong>
                  </div>
                ))
              ) : (
                <p className="breakdown-empty">No model results in this period.</p>
              )}
            </div>
            <div className="panel report-breakdown">
              <PanelTitle kicker="BY MONTH" title="Monthly profit" />
              {data.monthly.length ? (
                data.monthly.map((entry) => (
                  <div className="breakdown-row" key={entry._id}>
                    <div>
                      <strong>{entry._id}</strong>
                      <span>{money(entry.salesRevenue)} sales</span>
                    </div>
                    <strong>{money(entry.netProfit)}</strong>
                  </div>
                ))
              ) : (
                <p className="breakdown-empty">No monthly results in this period.</p>
              )}
            </div>
            <div className="panel report-breakdown">
              <PanelTitle kicker="DEALER PURCHASES" title="By supplier" />
              {data.dealerPurchases.length ? (
                data.dealerPurchases.map((entry) => (
                  <div
                    className="breakdown-row"
                    key={entry._id || entry.dealerName || "unassigned"}
                  >
                    <div>
                      <strong>{entry.dealerName || "Unassigned"}</strong>
                      <span>{entry.purchaseCount} devices purchased</span>
                    </div>
                    <strong>{money(entry.purchaseAmount)}</strong>
                  </div>
                ))
              ) : (
                <p className="breakdown-empty">No purchases in this period.</p>
              )}
            </div>
          </section>
          <section className="panel table-panel report-table">
            <div className="report-table-heading">
              <PanelTitle
                kicker="DEVICE-LEVEL DETAIL"
                title="IMEI-wise profit"
              />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>IMEI</th>
                    <th>Purchase</th>
                    <th>Sale</th>
                    <th>Gross profit</th>
                    <th>Net profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((sale) => (
                    <tr key={sale._id}>
                      <td>
                        <strong>
                          {sale.snapshot.brand} {sale.snapshot.model}
                        </strong>
                      </td>
                      <td className="imei-text">
                        {masked(sale.snapshot.imei1)}
                      </td>
                      <td>{money(sale.purchasePrice)}</td>
                      <td>{money(sale.sellingPrice)}</td>
                      <td>{money(sale.grossProfit)}</td>
                      <td
                        className={sale.netProfit < 0 ? "negative" : "positive"}
                      >
                        {money(sale.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.items.length && (
                <Empty
                  icon={FileText}
                  title="No sales in this period"
                  description="Unsold devices are excluded from realized profit."
                />
              )}
            </div>
            <Pagination page={page} pages={data.pages} onPage={setPage} />
          </section>
        </>
      )}
    </>
  );
}

function DealersPage({ notify }) {
  const fin = useFinancial();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleting, setDeleting] = useState(null);
  async function load() {
    try {
      setItems((await api("/dealers")).items);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    api("/dealers")
      .then(({ items: rows }) => active && setItems(rows))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [fin.version]);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/dealers", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", phone: "", address: "" });
      notify("Dealer added.");
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveEdit(event) {
    event.preventDefault();
    setEditBusy(true);
    setEditError("");
    try {
      await api(`/dealers/${editing._id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editing.name, phone: editing.phone || "", address: editing.address || "" }),
      });
      setEditing(null);
      notify("Dealer updated.");
      load();
    } catch (requestError) {
      setEditError(requestError.message);
    } finally {
      setEditBusy(false);
    }
  }
  async function remove() {
    const result = await api(`/dealers/${deleting._id}`, { method: "DELETE" });
    notify(result.message);
    load();
  }
  return (
    <>
      <Heading
        eyebrow="SUPPLIER DIRECTORY"
        title="Dealers"
        subtitle="Keep supplier details and purchase history together."
        right={
          <span className="record-count">
            <Building2 size={16} />
            {items.length} active dealers
          </span>
        }
      />
      {error && <Notice message={error} />}
      {items.some((dealer) => dealer.totalPurchaseAmount === null) && <FinancialLockedBanner />}
      <div className="dealer-layout">
        <section className="dealer-list">
          {loading ? (
            <Loading />
          ) : items.length ? (
            items.map((dealer) => (
              <article className="panel dealer-card" key={dealer._id}>
                <div className="dealer-card-top">
                  <span className="dealer-avatar">
                    {dealer.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h2>{dealer.name}</h2>
                    <span>
                      {dealer.phone || "No phone number"}
                      {dealer.address ? ` · ${dealer.address}` : ""}
                    </span>
                  </div>
                  <div className="dealer-actions">
                    <button
                      className="icon-button"
                      title="Edit dealer"
                      aria-label={`Edit ${dealer.name}`}
                      onClick={() => { setEditError(""); setEditing(dealer); }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button row-delete"
                      title="Delete dealer"
                      aria-label={`Delete ${dealer.name}`}
                      onClick={() => setDeleting(dealer)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="dealer-stats">
                  <div>
                    <span>Purchase history</span>
                    <strong>{dealer.purchaseCount || 0} devices</strong>
                  </div>
                  <div>
                    <span>Total purchased</span>
                    <strong>{money(dealer.totalPurchaseAmount === null ? null : dealer.totalPurchaseAmount || 0)}</strong>
                  </div>
                  <div>
                    <span>Currently in stock</span>
                    <strong>{dealer.stockCount || 0}</strong>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <section className="panel">
              <Empty
                icon={Building2}
                title="No dealers added"
                description="Add the suppliers you buy mobile devices from."
              />
            </section>
          )}
        </section>
        <section className="panel dealer-form-panel">
          <PanelTitle
            kicker="NEW SUPPLIER"
            title="Add dealer"
            right={
              <span className="step-bubble">
                <Plus size={16} />
              </span>
            }
          />
          <form className="stack-form" onSubmit={submit}>
            <Field
              label="Dealer name"
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              required
              placeholder="Business or contact name"
            />
            <Field
              label="Phone number"
              type="tel"
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
              placeholder="Optional"
            />
            <label className="field">
              <span>Address</span>
              <textarea
                rows="3"
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
                placeholder="Optional"
              />
            </label>
            <button className="button primary wide" disabled={busy}>
              {busy ? (
                "Adding dealer…"
              ) : (
                <>
                  <Plus size={17} />
                  Add dealer
                </>
              )}
            </button>
          </form>
        </section>
      </div>
      {editing && (
        <Modal title="Edit dealer" onClose={() => !editBusy && setEditing(null)}>
          <form className="stack-form" onSubmit={saveEdit}>
            <Field label="Dealer name" value={editing.name} onChange={(name) => setEditing({ ...editing, name })} required minLength={2} autoFocus />
            <Field label="Phone number" type="tel" value={editing.phone || ""} onChange={(phone) => setEditing({ ...editing, phone })} placeholder="Optional" />
            <label className="field">
              <span>Address</span>
              <textarea rows="3" value={editing.address || ""} onChange={(event) => setEditing({ ...editing, address: event.target.value })} placeholder="Optional" />
            </label>
            {editError && <Notice message={editError} />}
            <div className="pin-actions">
              <button type="button" className="button outline" onClick={() => setEditing(null)} disabled={editBusy}>Cancel</button>
              <button className="button primary" disabled={editBusy}>{editBusy ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <ConfirmDelete
          title="Delete dealer"
          message={`Delete ${deleting.name}?${deleting.purchaseCount ? " This dealer has purchase history, so it will be archived and its past records kept." : ""}`}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

function ScannerModal({ onScan, onSerial, onClose }) {
  const [message, setMessage] = useState("Requesting camera access…");
  useEffect(() => {
    let scanner;
    let active = true;
    const timer = window.setTimeout(async () => {
      scanner = new Html5Qrcode("imei-camera-reader");
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (text) => {
            const imei = parseImei(text);
            if (imei) {
              onScan(imei);
              scanner.stop().catch(() => {});
            } else if (onSerial && parseSerial(text)) {
              onSerial(parseSerial(text));
              scanner.stop().catch(() => {});
            } else if (active)
              setMessage(
                onSerial
                  ? "Barcode found, but it is not an IMEI or serial number. Enter it manually."
                  : "Barcode found, but it does not contain a supported 15-digit IMEI. Enter it manually.",
              );
          },
          () => {},
        );
        if (active) setMessage("Point the rear camera at the device barcode.");
      } catch {
        if (active)
          setMessage(
            "Camera access unavailable. Check permission or enter the IMEI manually.",
          );
      }
    }, 80);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (scanner?.isScanning) scanner.stop().catch(() => {});
    };
  }, [onScan, onSerial]);
  return (
    <Modal title="Scan device barcode" onClose={onClose}>
      <p className="scanner-copy">
        Use the phone's rear camera. The scanner accepts labeled IMEI or
        supported 8004 barcode data{onSerial ? ", and the S/N (serial number) barcode" : ""}.
      </p>
      <div id="imei-camera-reader" className="scanner-view" />
      <div className="scanner-status">
        <i />
        {message}
      </div>
    </Modal>
  );
}

function isValidImeiClient(value) {
  if (!/^\d{15}$/.test(value)) return false;
  let sum = 0;
  let doubleDigit = true;
  for (let index = value.length - 2; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return (sum + Number(value.at(-1))) % 10 === 0;
}

function parseImei(raw) {
  const input = String(raw || "").trim();
  try {
    const parsed = JSON.parse(input);
    const value = parsed.imei || parsed.IMEI || parsed.imei1 || parsed.imei2;
    if (isValidImeiClient(String(value || ""))) return String(value);
  } catch {
    /* Barcode is not JSON. */
  }
  const labeled = input.match(/\b(?:IMEI(?:\s*[12])?|8004)\D{0,16}(\d{15})\b/i)?.[1];
  if (labeled && isValidImeiClient(labeled)) return labeled;
  return (input.match(/\d{15}/g) || []).find(isValidImeiClient) || "";
}

// Serial number from an S/N barcode, e.g. "S/N: R58N123ABC", "SN R58N123ABC" or just "R58N123ABC".
// Product barcodes (EAN/UPC, 8-14 digits) and IMEIs are not treated as serial numbers.
function parseSerial(raw) {
  const input = String(raw || "").trim().toUpperCase();
  const labeled = input.match(/(?:S\/N|SN|SERIAL(?:\s*NO\.?|\s*NUMBER)?)\s*[:#.-]?\s*([A-Z0-9][A-Z0-9-]{4,39})/)?.[1];
  const value = labeled || input;
  if (!/^[A-Z0-9][A-Z0-9-]{4,39}$/.test(value)) return "";
  if (!labeled && /^\d{8,15}$/.test(value)) return "";
  return value;
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handler = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

// Second step for every delete. Cancel has focus so a stray Enter cannot delete anything.
function ConfirmDelete({ title, message, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      <div className="sale-confirm">
        <p className="confirm-message">{message}</p>
        <p className="sale-confirm-warning"><CircleAlert size={15} /> This cannot be undone.</p>
        {error && <Notice message={error} />}
        <div className="pin-actions">
          <button type="button" className="button outline" onClick={onClose} disabled={busy} autoFocus>Cancel</button>
          <button type="button" className="button delete-confirm" onClick={confirm} disabled={busy}>
            <Trash2 size={16} />{busy ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value, onChange, type = "text", ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}
function Detail({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}
function Badge({ status }) {
  return (
    <span className={`status-badge ${status === "SOLD" ? "sold" : "in-stock"}`}>
      <i />
      {status === "SOLD" ? "Sold" : "In stock"}
    </span>
  );
}
function Empty({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={20} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading-state">
      <span className="spinner" />
      Loading shop records…
    </div>
  );
}
function Notice({ message }) {
  return (
    <div className="notice error-notice">
      <CircleAlert size={17} />
      <span>{message}</span>
    </div>
  );
}
