import { useEffect, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
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
  Eye,
  FileDown,
  FileText,
  Filter,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  TrendingUp,
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
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

const money = (value = 0) =>
  new Intl.NumberFormat("en-IN", {
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
  { to: "/purchases", label: "Stock in", icon: ArrowDownToLine },
  { to: "/sell", label: "Sell a mobile", icon: ArrowUpRight },
  { to: "/sold", label: "Sold mobiles", icon: ClipboardList },
  { to: "/reports", label: "Profit & reports", icon: BarChart3 },
  { to: "/dealers", label: "Dealers", icon: Building2 },
];

function Workspace({ user, signOut, notify, toast }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const active =
    navigation.find((item) => item.to === location.pathname)?.label ||
    "Overview";
  const mobileNav = navigation.slice(0, 5);
  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }
  return (
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
            <Route path="/sell" element={<SellPage notify={notify} />} />
            <Route path="/sold" element={<SoldPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/dealers" element={<DealersPage notify={notify} />} />
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
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/dashboard")
      .then(setData)
      .catch((requestError) => setError(requestError.message));
  }, []);
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
          note={`${money(metrics.grossProfit)} gross profit`}
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
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ ram: "", storage: "", from: "", to: "", sort: "newest" });
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
          })
          .catch((requestError) => active && setError(requestError.message))
          .finally(() => active && setLoading(false)),
      180,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, filters, page]);
  async function updatePrice(item) {
    const value = window.prompt(
      "Update purchase price",
      String(item.purchasePrice),
    );
    if (value === null) return;
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0)
      return notify("Enter a valid purchase price.");
    try {
      await api(`/inventory/${item._id}`, {
        method: "PATCH",
        body: JSON.stringify({ purchasePrice: price }),
      });
      notify("Inventory details updated.");
      const params = new URLSearchParams({ search, page: String(page), limit: "20", ...filters });
      const result = await api(`/inventory?${params}`);
      setItems(result.items);
    } catch (requestError) {
      notify(requestError.message);
    }
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
                      <button
                        className="icon-button"
                        title="Edit purchase price"
                        onClick={() => updatePrice(item)}
                      >
                        <Settings2 size={17} />
                      </button>
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
    </>
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
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [form, setForm] = useState(emptyDevice);
  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [error, setError] = useState("");
  const [lookupNote, setLookupNote] = useState("");
  const [lookupSuccess, setLookupSuccess] = useState(false);
  const [lookupRequest, setLookupRequest] = useState(0);
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
    setBusy(true);
    setError("");
    try {
      const duplicateChecks = await Promise.all(
        [form.imei1, form.imei2].filter(Boolean).map((imei) =>
          api(`/inventory/check-imei?imei=${encodeURIComponent(imei)}`),
        ),
      );
      if (duplicateChecks.some((check) => check.exists)) {
        throw new Error("This IMEI is already recorded in inventory.");
      }
      await api("/inventory", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          purchasePrice: Number(form.purchasePrice),
        }),
      });
      notify("Mobile added to stock.");
      navigate("/inventory");
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
              description="Link the dealer and enter the actual acquisition cost."
            />
            <div className="field-grid">
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
              <Field
                label="Dealer purchase price"
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
            <button className="button primary wide" disabled={busy}>
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
              Each IMEI is recorded separately. Duplicate IMEIs are rejected.
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
  const [imei, setImei] = useState("");
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
  async function findDevice(value = imei) {
    setError("");
    setDevice(null);
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
      setDevice(item);
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (
      !device ||
      !window.confirm(
        `Sell ${device.brand} ${device.model} for ${money(Number(form.sellingPrice))}? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api("/sales", {
        method: "POST",
        body: JSON.stringify({ imei: device.imei1, ...form }),
      });
      notify("Sale recorded and inventory updated.");
      setDevice(null);
      setImei("");
      setForm({
        sellingPrice: "",
        discount: "0",
        additionalExpenses: "0",
        customerName: "",
        customerPhone: "",
      });
    } catch (requestError) {
      setError(requestError.message);
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
                required
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
                <Detail label="IMEI" value={masked(device.imei1)} />
                <Detail
                  label="Purchase price"
                  value={money(device.purchasePrice)}
                />
                <Detail label="Dealer" value={device.dealerName || "—"} />
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
              <span>Scan the barcode or enter the IMEI above.</span>
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
            {device && (
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
    </>
  );
}

function SoldPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api(`/sales?page=${page}&limit=20`)
      .then((result) => {
        setItems(result.items);
        setPages(result.pages);
        setTotal(result.total);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [page]);
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
                  <th>Details</th>
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
                      <button
                        className="icon-button eye-button"
                        title="View sale details"
                        aria-label="View sale details"
                        onClick={() => setSelected(sale)}
                      >
                        <Eye size={18} />
                      </button>
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
    </>
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
  const [period, setPeriod] = useState("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams({ ...reportDateParams(period, from, to), page: String(page), limit: "20" });
    api(`/reports?${params}`)
      .then(setData)
      .catch((requestError) => setError(requestError.message));
  }, [period, from, to, page]);
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
      {error ? (
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
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
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
  }, []);
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
  async function edit(dealer) {
    const name = window.prompt("Dealer name", dealer.name);
    if (name === null) return;
    const phone = window.prompt("Phone number", dealer.phone || "");
    if (phone === null) return;
    try {
      await api(`/dealers/${dealer._id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, phone }),
      });
      notify("Dealer updated.");
      load();
    } catch (requestError) {
      notify(requestError.message);
    }
  }
  async function remove(dealer) {
    if (
      !window.confirm(
        `Remove ${dealer.name}? Dealers with purchase history will be archived.`,
      )
    )
      return;
    try {
      const result = await api(`/dealers/${dealer._id}`, { method: "DELETE" });
      notify(result.message);
      load();
    } catch (requestError) {
      notify(requestError.message);
    }
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
                      onClick={() => edit(dealer)}
                    >
                      <Settings2 size={17} />
                    </button>
                    <button
                      className="icon-button"
                      title="Delete or archive dealer"
                      onClick={() => remove(dealer)}
                    >
                      <X size={17} />
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
                    <strong>{money(dealer.totalPurchaseAmount || 0)}</strong>
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
      <section className="modal-panel">
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
