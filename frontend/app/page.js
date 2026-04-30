"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChartNoAxesCombined,
  Leaf,
  LogOut,
  MapPinned,
  Sprout,
  TrendingUp,
  UserRound,
  Users,
  Wheat,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

const navItems = [
  { key: "overview", label: "ภาพรวม", icon: BarChart3 },
  { key: "farmers", label: "เกษตรกร", icon: Users },
  { key: "plantings", label: "แปลงปลูก", icon: Sprout },
  { key: "harvests", label: "เก็บเกี่ยว", icon: Wheat },
];

const blankDashboard = {
  totals: {
    farmers: 0,
    plantings: 0,
    harvests: 0,
    quantity_kg: 0,
    revenue: 0,
    average_price: 0,
  },
  harvest_by_year: [],
  fruit_breakdown: [],
  product_trends: [],
  top_farmers: [],
  recent_harvests: [],
};

const emptyFarmerForm = {
  first_name: "",
  last_name: "",
  age: "",
  phone: "",
  village: "",
  address: "",
};

const emptyPlantingForm = {
  farmer: "",
  fruit: "",
  variety: "",
  area_rai: "",
  planted_at: "",
  note: "",
};

const emptyHarvestForm = {
  planting: "",
  harvest_year: "",
  quantity_kg: "",
  price_per_kg: "",
  harvested_at: "",
  note: "",
};

function getCookie(name) {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split("=")[1] || "";
}

async function apiRequest(path, options = {}) {
  const method = options.method || "GET";
  const headers = {
    Accept: "application/json",
    ...options.headers,
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      headers["X-CSRFToken"] = csrfToken;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    credentials: "include",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      payload?.detail ||
      Object.values(payload || {}).flat().join(" ") ||
      `HTTP ${response.status}`;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return payload?.results || payload;
}

function normalizeNumber(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function normalizeText(value) {
  return value ?? "";
}

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits }).format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [authState, setAuthState] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);
  const [connection, setConnection] = useState("loading");
  const [message, setMessage] = useState("กำลังตรวจสอบสิทธิ์");
  const [dashboard, setDashboard] = useState(blankDashboard);
  const [farmers, setFarmers] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [years, setYears] = useState([]);
  const [fruits, setFruits] = useState([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [editingFarmerId, setEditingFarmerId] = useState(null);
  const [editingPlantingId, setEditingPlantingId] = useState(null);
  const [editingHarvestId, setEditingHarvestId] = useState(null);
  const [farmerForm, setFarmerForm] = useState(emptyFarmerForm);
  const [plantingForm, setPlantingForm] = useState(emptyPlantingForm);
  const [harvestForm, setHarvestForm] = useState(emptyHarvestForm);

  const loadData = useCallback(async () => {
    const [summary, farmerRows, plantingRows, harvestRows, yearRows, fruitRows] = await Promise.all([
      apiRequest("/dashboard/"),
      apiRequest("/farmers/"),
      apiRequest("/plantings/"),
      apiRequest("/harvests/"),
      apiRequest("/years/"),
      apiRequest("/fruits/"),
    ]);

    setDashboard(summary || blankDashboard);
    setFarmers(farmerRows || []);
    setPlantings(plantingRows || []);
    setHarvests(harvestRows || []);
    setYears(yearRows || []);
    setFruits(fruitRows || []);
    setConnection("online");
    setMessage("ข้อมูลถูกกรองตามบัญชีผู้ใช้ที่เข้าสู่ระบบ");
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const user = await apiRequest("/auth/me/");
        if (!mounted) return;

        if (!user?.is_authenticated) {
          router.replace("/login");
          return;
        }

        setCurrentUser(user);
        setAuthState("ready");
        await loadData();
      } catch (error) {
        if (!mounted) return;
        router.replace("/login");
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadData, router]);

  const filteredHarvests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return harvests.filter((harvest) => {
      const matchesSearch = [harvest.farmer_name, harvest.fruit_name, harvest.variety]
        .join(" ")
        .toLowerCase()
        .includes(query);
      const matchesYear = yearFilter === "all" || Number(harvest.year) === Number(yearFilter);
      return matchesSearch && matchesYear;
    });
  }, [harvests, search, yearFilter]);

  const maxRevenue = Math.max(...dashboard.fruit_breakdown.map((fruit) => fruit.revenue), 1);
  const maxYearQuantity = Math.max(...dashboard.harvest_by_year.map((item) => item.quantity_kg), 1);

  async function refreshWithMessage(successMessage) {
    await loadData();
    setMessage(successMessage);
  }

  async function handleLogout() {
    await apiRequest("/auth/logout/", { method: "POST" }).catch(() => null);
    router.replace("/login");
  }

  async function handleFarmerSubmit(event) {
    event.preventDefault();
    const payload = {
      ...farmerForm,
      age: normalizeNumber(farmerForm.age),
    };
    const path = editingFarmerId ? `/farmers/${editingFarmerId}/` : "/farmers/";
    const method = editingFarmerId ? "PATCH" : "POST";

    try {
      await apiRequest(path, { method, body: payload });
      setEditingFarmerId(null);
      setFarmerForm(emptyFarmerForm);
      await refreshWithMessage(editingFarmerId ? "แก้ไขข้อมูลเกษตรกรแล้ว" : "เพิ่มข้อมูลเกษตรกรแล้ว");
    } catch (error) {
      setMessage(`บันทึกเกษตรกรไม่สำเร็จ: ${error.message}`);
    }
  }

  function startEditFarmer(farmer) {
    setEditingFarmerId(farmer.id);
    setFarmerForm({
      first_name: normalizeText(farmer.first_name),
      last_name: normalizeText(farmer.last_name),
      age: normalizeText(farmer.age),
      phone: normalizeText(farmer.phone),
      village: normalizeText(farmer.village),
      address: normalizeText(farmer.address),
    });
  }

  async function deleteFarmer(farmer) {
    if (!window.confirm(`ลบข้อมูล ${farmer.full_name} ?`)) return;
    try {
      await apiRequest(`/farmers/${farmer.id}/`, { method: "DELETE" });
      await refreshWithMessage("ลบข้อมูลเกษตรกรแล้ว");
    } catch (error) {
      setMessage(`ลบเกษตรกรไม่สำเร็จ: ${error.message}`);
    }
  }

  async function handlePlantingSubmit(event) {
    event.preventDefault();
    const payload = {
      ...plantingForm,
      farmer: Number(plantingForm.farmer || farmers[0]?.id),
      fruit: Number(plantingForm.fruit || fruits[0]?.id),
      area_rai: plantingForm.area_rai || "0",
      planted_at: plantingForm.planted_at || null,
    };
    const path = editingPlantingId ? `/plantings/${editingPlantingId}/` : "/plantings/";
    const method = editingPlantingId ? "PATCH" : "POST";

    try {
      await apiRequest(path, { method, body: payload });
      setEditingPlantingId(null);
      setPlantingForm({
        ...emptyPlantingForm,
        farmer: farmers[0]?.id || "",
        fruit: fruits[0]?.id || "",
      });
      await refreshWithMessage(editingPlantingId ? "แก้ไขข้อมูลแปลงปลูกแล้ว" : "เพิ่มข้อมูลแปลงปลูกแล้ว");
    } catch (error) {
      setMessage(`บันทึกแปลงปลูกไม่สำเร็จ: ${error.message}`);
    }
  }

  function startEditPlanting(planting) {
    setEditingPlantingId(planting.id);
    setPlantingForm({
      farmer: normalizeText(planting.farmer),
      fruit: normalizeText(planting.fruit),
      variety: normalizeText(planting.variety),
      area_rai: normalizeText(planting.area_rai),
      planted_at: normalizeText(planting.planted_at),
      note: normalizeText(planting.note),
    });
  }

  async function deletePlanting(planting) {
    if (!window.confirm(`ลบแปลง ${planting.fruit_name} ${planting.variety || ""} ?`)) return;
    try {
      await apiRequest(`/plantings/${planting.id}/`, { method: "DELETE" });
      await refreshWithMessage("ลบข้อมูลแปลงปลูกแล้ว");
    } catch (error) {
      setMessage(`ลบแปลงปลูกไม่สำเร็จ: ${error.message}`);
    }
  }

  async function handleHarvestSubmit(event) {
    event.preventDefault();
    const payload = {
      ...harvestForm,
      planting: Number(harvestForm.planting || plantings[0]?.id),
      harvest_year: Number(harvestForm.harvest_year || years[0]?.id),
      harvested_at: harvestForm.harvested_at || null,
    };
    const path = editingHarvestId ? `/harvests/${editingHarvestId}/` : "/harvests/";
    const method = editingHarvestId ? "PATCH" : "POST";

    try {
      await apiRequest(path, { method, body: payload });
      setEditingHarvestId(null);
      setHarvestForm({
        ...emptyHarvestForm,
        planting: plantings[0]?.id || "",
        harvest_year: years[0]?.id || "",
      });
      await refreshWithMessage(editingHarvestId ? "แก้ไขข้อมูลเก็บเกี่ยวแล้ว" : "เพิ่มข้อมูลเก็บเกี่ยวแล้ว");
    } catch (error) {
      setMessage(`บันทึกเก็บเกี่ยวไม่สำเร็จ: ${error.message}`);
    }
  }

  function startEditHarvest(harvest) {
    setEditingHarvestId(harvest.id);
    setHarvestForm({
      planting: normalizeText(harvest.planting),
      harvest_year: normalizeText(harvest.harvest_year),
      quantity_kg: normalizeText(harvest.quantity_kg),
      price_per_kg: normalizeText(harvest.price_per_kg),
      harvested_at: normalizeText(harvest.harvested_at),
      note: normalizeText(harvest.note),
    });
  }

  async function deleteHarvest(harvest) {
    if (!window.confirm(`ลบรายการเก็บเกี่ยว ${harvest.fruit_name} ปี ${harvest.year} ?`)) return;
    try {
      await apiRequest(`/harvests/${harvest.id}/`, { method: "DELETE" });
      await refreshWithMessage("ลบข้อมูลเก็บเกี่ยวแล้ว");
    } catch (error) {
      setMessage(`ลบเก็บเกี่ยวไม่สำเร็จ: ${error.message}`);
    }
  }

  if (authState !== "ready") {
    return (
      <main className="loading-page">
        <section className="login-panel">
          <p className="eyebrow">HarvestData</p>
          <h1>กำลังตรวจสอบการเข้าสู่ระบบ</h1>
          <p className="login-copy">ถ้ายังไม่ได้เข้าสู่ระบบ ระบบจะพาไปหน้า login</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark"><Leaf size={24} /></span>
          <div>
            <p className="eyebrow">HarvestData</p>
            <h1>สวนผลไม้วันนี้</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Dashboard sections">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={activeTab === item.key ? "nav-button active" : "nav-button"}
              onClick={() => setActiveTab(item.key)}
              type="button"
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* <div className="orchard-visual" aria-hidden="true">
          <span className="sun" />
          <span className="row row-one" />
          <span className="row row-two" />
          <span className="row row-three" />
          <span className="fruit-dot mango" />
          <span className="fruit-dot durian" />
          <span className="fruit-dot mangosteen" />
        </div> */}

        {/* <div className="status-panel">
          <span className={`status-dot ${connection}`} />
          <div>
            <strong>{message}</strong>
            <small>{API_BASE_URL}</small>
          </div>
        </div> */}
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ระบบจัดการข้อมูลเก็บเกี่ยวผลไม้</p>
            <h2>ติดตามผลผลิต รายได้ และแปลงปลูกในมุมเดียว</h2>
          </div>
          <div className="profile-chip">
            <span><UserRound size={18} /></span>
            <div>
              <strong>{currentUser?.name || currentUser?.username}</strong>
              <small>{currentUser?.email || currentUser?.username}</small>
            </div>
            <button type="button" onClick={handleLogout}><LogOut size={16} />ออกจากระบบ</button>
          </div>
        </header>

        <section className="yield-overview" aria-label="Harvest summary">
          <div className="section-heading">
            <p className="eyebrow">Yield Overview</p>
            <h3>สรุปภาพรวมการผลิต</h3>
          </div>
          <div className="metrics-grid">
            <Metric icon={Users} label="เกษตรกร" value={formatNumber(dashboard.totals.farmers)} note="ราย" />
            <Metric icon={MapPinned} label="แปลงปลูก" value={formatNumber(dashboard.totals.plantings)} note="แปลง" />
            <Metric icon={Wheat} label="ผลผลิตรวม" value={formatNumber(dashboard.totals.quantity_kg)} note="กก." />
            <Metric icon={TrendingUp} label="รายได้รวม" value={formatCurrency(dashboard.totals.revenue)} note={`เฉลี่ย ${formatCurrency(dashboard.totals.average_price)}/กก.`} wide />
          </div>
        </section>

        {activeTab === "overview" && (
          <Overview
            dashboard={dashboard}
            maxRevenue={maxRevenue}
            maxYearQuantity={maxYearQuantity}
          />
        )}

        {activeTab === "farmers" && (
          <FarmersSection
            farmers={farmers}
            form={farmerForm}
            setForm={setFarmerForm}
            editingId={editingFarmerId}
            onSubmit={handleFarmerSubmit}
            onEdit={startEditFarmer}
            onDelete={deleteFarmer}
            onCancel={() => {
              setEditingFarmerId(null);
              setFarmerForm(emptyFarmerForm);
            }}
          />
        )}

        {activeTab === "plantings" && (
          <PlantingsSection
            plantings={plantings}
            farmers={farmers}
            fruits={fruits}
            form={plantingForm}
            setForm={setPlantingForm}
            editingId={editingPlantingId}
            onSubmit={handlePlantingSubmit}
            onEdit={startEditPlanting}
            onDelete={deletePlanting}
            onCancel={() => {
              setEditingPlantingId(null);
              setPlantingForm({
                ...emptyPlantingForm,
                farmer: farmers[0]?.id || "",
                fruit: fruits[0]?.id || "",
              });
            }}
          />
        )}

        {activeTab === "harvests" && (
          <HarvestsSection
            harvests={filteredHarvests}
            plantings={plantings}
            years={years}
            search={search}
            setSearch={setSearch}
            yearFilter={yearFilter}
            setYearFilter={setYearFilter}
            form={harvestForm}
            setForm={setHarvestForm}
            editingId={editingHarvestId}
            onSubmit={handleHarvestSubmit}
            onEdit={startEditHarvest}
            onDelete={deleteHarvest}
            onCancel={() => {
              setEditingHarvestId(null);
              setHarvestForm({
                ...emptyHarvestForm,
                planting: plantings[0]?.id || "",
                harvest_year: years[0]?.id || "",
              });
            }}
          />
        )}
      </section>
    </main>
  );
}

function Overview({ dashboard, maxRevenue, maxYearQuantity }) {
  const chartData = dashboard.harvest_by_year.map((item) => ({
    year: item.year,
    quantity_kg: item.quantity_kg,
    average_price:
      item.average_price ||
      (item.quantity_kg ? Number(item.revenue || 0) / Number(item.quantity_kg || 1) : 0),
  }));
  const productSeries = Array.from(
    new Map(
      dashboard.product_trends.map((item) => [
        item.product_name,
        {
          name: item.product_name,
          color: item.color || "#6f9f83",
        },
      ])
    ).values()
  );
  const productTrendData = Array.from(
    dashboard.product_trends.reduce((yearMap, item) => {
      const existing = yearMap.get(item.year) || { year: item.year };
      existing[item.product_name] = item.quantity_kg;
      yearMap.set(item.year, existing);
      return yearMap;
    }, new Map()).values()
  ).sort((a, b) => Number(a.year) - Number(b.year));

  return (
    <div className="dashboard-grid">
      <section className="panel trend-panel chart-panel product-trend-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Harvest Trends</p>
            <h3>เปรียบเทียบผลผลิตและราคาเฉลี่ยรายปี</h3>
          </div>
          <span className="panel-icon"><ChartNoAxesCombined size={20} /></span>
        </div>
        <div className="line-chart-wrap">
          {!!chartData.length && (
            <ResponsiveContainer width="100%" height={315}>
              <LineChart data={chartData} margin={{ top: 12, right: 14, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#dce8dc" strokeDasharray="5 8" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#6d756c", fontSize: 12 }} />
                <YAxis
                  yAxisId="quantity"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6d756c", fontSize: 12 }}
                  tickFormatter={(value) => `${formatNumber(value / 1000, 1)}k`}
                />
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6d756c", fontSize: 12 }}
                  tickFormatter={(value) => `${formatNumber(value)}฿`}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid rgba(194, 211, 190, 0.8)",
                    borderRadius: 18,
                    background: "rgba(255, 253, 247, 0.96)",
                    boxShadow: "0 18px 44px rgba(54, 71, 55, 0.14)",
                  }}
                  formatter={(value, name) => {
                    if (name === "ผลผลิตรวม") return [`${formatNumber(value, 2)} กก.`, name];
                    return [`${formatCurrency(value)}/กก.`, name];
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 10 }} />
                <Line
                  yAxisId="quantity"
                  type="monotone"
                  dataKey="quantity_kg"
                  name="ผลผลิตรวม"
                  stroke="#6f9f83"
                  strokeWidth={4}
                  dot={{ r: 5, strokeWidth: 3, fill: "#fffdf7" }}
                  activeDot={{ r: 7 }}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="average_price"
                  name="ราคาเฉลี่ย"
                  stroke="#7aaed6"
                  strokeWidth={4}
                  dot={{ r: 5, strokeWidth: 3, fill: "#fffdf7" }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {!dashboard.harvest_by_year.length && <p className="empty-state">ยังไม่มีข้อมูลเก็บเกี่ยว</p>}
        </div>
        <div className="year-chart compact-trend">
          {dashboard.harvest_by_year.map((item) => (
            <div className="year-row" key={item.year}>
              <span>{item.year}</span>
              <div className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: `${Math.max((item.quantity_kg / maxYearQuantity) * 100, 8)}%` }}
                />
              </div>
              <strong>{formatNumber(item.quantity_kg)} กก.</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel chart-panel product-trend-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Product Trends</p>
            <h3>กราฟเส้นผลผลิตราย product แยกตามปี</h3>
          </div>
          <span className="panel-icon"><Sprout size={20} /></span>
        </div>
        <div className="line-chart-wrap product-line-chart">
          {!!productTrendData.length && (
            <ResponsiveContainer width="100%" height={310}>
              <LineChart data={productTrendData} margin={{ top: 12, right: 14, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#dce8dc" strokeDasharray="5 8" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#6d756c", fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6d756c", fontSize: 12 }}
                  tickFormatter={(value) => `${formatNumber(value / 1000, 1)}k`}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid rgba(194, 211, 190, 0.8)",
                    borderRadius: 18,
                    background: "rgba(255, 253, 247, 0.96)",
                    boxShadow: "0 18px 44px rgba(54, 71, 55, 0.14)",
                  }}
                  formatter={(value, name) => [`${formatNumber(value, 2)} กก.`, name]}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 10 }} />
                {productSeries.map((product) => (
                  <Line
                    key={product.name}
                    type="monotone"
                    dataKey={product.name}
                    name={product.name}
                    stroke={product.color}
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: "#fffdf7" }}
                    activeDot={{ r: 7 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          {!productTrendData.length && <p className="empty-state">ยังไม่มีข้อมูล product รายปี</p>}
        </div>
      </section>

      <section className="panel fruit-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ผลไม้หลัก</p>
            <h3>สัดส่วนรายได้ตามชนิดผลไม้</h3>
          </div>
          <span className="panel-icon"><Leaf size={20} /></span>
        </div>
        <div className="fruit-list">
          {dashboard.fruit_breakdown.map((fruit) => (
            <article className="fruit-row" key={fruit.id}>
              <div className="fruit-title">
                <span className="fruit-swatch" style={{ backgroundColor: fruit.color }} />
                <div>
                  <strong>{fruit.name}</strong>
                  <small>{formatNumber(fruit.quantity_kg)} กก.</small>
                </div>
              </div>
              <div className="mini-track">
                <span style={{ width: `${Math.max((fruit.revenue / maxRevenue) * 100, 10)}%`, backgroundColor: fruit.color }} />
              </div>
              <b>{formatCurrency(fruit.revenue)}</b>
            </article>
          ))}
          {!dashboard.fruit_breakdown.length && <p className="empty-state">ยังไม่มีผลไม้ในรายการเก็บเกี่ยว</p>}
        </div>
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recent Activities</p>
            <h3>กิจกรรมล่าสุดในสวน</h3>
          </div>
          <span className="panel-icon"><Activity size={20} /></span>
        </div>
        <RecentActivities rows={dashboard.recent_harvests} />
      </section>

      <section className="panel farmers-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">สวนที่โดดเด่น</p>
            <h3>เกษตรกรรายได้สูงสุด</h3>
          </div>
          <span className="panel-icon"><Users size={20} /></span>
        </div>
        <div className="rank-list">
          {dashboard.top_farmers.map((farmer, index) => (
            <article className="rank-row" key={farmer.id}>
              <span>{index + 1}</span>
              <div>
                <strong>{farmer.name}</strong>
                <small>{farmer.village}</small>
              </div>
              <b>{formatCurrency(farmer.revenue)}</b>
            </article>
          ))}
          {!dashboard.top_farmers.length && <p className="empty-state">ยังไม่มีข้อมูลจัดอันดับ</p>}
        </div>
      </section>
    </div>
  );
}

function RecentActivities({ rows }) {
  return (
    <div className="activity-list">
      {rows.slice(0, 5).map((item) => (
        <article className="activity-row" key={item.id}>
          <span className="activity-icon"><CalendarDays size={17} /></span>
          <div>
            <strong>{item.fruit_name} {item.variety}</strong>
            <small>{item.farmer_name} / ปี {item.year}</small>
          </div>
          <span className="organic-badge">{formatNumber(item.quantity_kg, 2)} กก.</span>
        </article>
      ))}
      {!rows.length && <p className="empty-state">ยังไม่มีกิจกรรมล่าสุด</p>}
    </div>
  );
}

function FarmersSection({ farmers, form, setForm, editingId, onSubmit, onEdit, onDelete, onCancel }) {
  return (
    <div className="management-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ทะเบียนเกษตรกร</p>
            <h3>รายชื่อเจ้าของสวน</h3>
          </div>
        </div>
        <div className="card-grid">
          {farmers.map((farmer) => (
            <article className="person-card" key={farmer.id}>
              <span>{farmer.full_name?.slice(0, 1) || "F"}</span>
              <div>
                <strong>{farmer.full_name}</strong>
                <small>{farmer.village || "ยังไม่ระบุพื้นที่"}</small>
                <p>{farmer.phone || "ไม่มีเบอร์ติดต่อ"}</p>
                <div className="action-row">
                  <button type="button" onClick={() => onEdit(farmer)}>แก้ไข</button>
                  <button type="button" className="danger-button" onClick={() => onDelete(farmer)}>ลบ</button>
                </div>
              </div>
            </article>
          ))}
          {!farmers.length && <p className="empty-state">ยังไม่มีเกษตรกรในบัญชีนี้</p>}
        </div>
      </section>

      <section className="panel form-panel">
        <FormHeading label="ข้อมูลเกษตรกร" title={editingId ? "แก้ไขเกษตรกร" : "เพิ่มเกษตรกร"} onCancel={editingId ? onCancel : null} />
        <form className="entity-form" onSubmit={onSubmit}>
          <Field label="ชื่อ" value={form.first_name} onChange={(value) => setForm({ ...form, first_name: value })} required />
          <Field label="นามสกุล" value={form.last_name} onChange={(value) => setForm({ ...form, last_name: value })} />
          <Field label="อายุ" type="number" value={form.age} onChange={(value) => setForm({ ...form, age: value })} />
          <Field label="เบอร์โทร" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
          <Field label="หมู่บ้าน/พื้นที่" value={form.village} onChange={(value) => setForm({ ...form, village: value })} />
          <TextArea label="ที่อยู่" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
          <button type="submit">{editingId ? "บันทึกการแก้ไข" : "เพิ่มเกษตรกร"}</button>
        </form>
      </section>
    </div>
  );
}

function PlantingsSection({ plantings, farmers, fruits, form, setForm, editingId, onSubmit, onEdit, onDelete, onCancel }) {
  const formDisabled = !farmers.length || !fruits.length;

  return (
    <div className="management-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">แปลงและสายพันธุ์</p>
            <h3>ข้อมูลการปลูก</h3>
          </div>
        </div>
        <div className="planting-grid">
          {plantings.map((planting) => (
            <article className="planting-card" key={planting.id}>
              <span className="fruit-swatch" style={{ backgroundColor: planting.fruit_color }} />
              <div>
                <strong>{planting.fruit_name}</strong>
                <small>{planting.variety || "ไม่ระบุสายพันธุ์"}</small>
                <p>{planting.farmer_name}</p>
                <div className="action-row">
                  <button type="button" onClick={() => onEdit(planting)}>แก้ไข</button>
                  <button type="button" className="danger-button" onClick={() => onDelete(planting)}>ลบ</button>
                </div>
              </div>
              <b>{formatNumber(planting.area_rai, 2)} ไร่</b>
            </article>
          ))}
          {!plantings.length && <p className="empty-state">ยังไม่มีแปลงปลูกในบัญชีนี้</p>}
        </div>
      </section>

      <section className="panel form-panel">
        <FormHeading label="ข้อมูลแปลงปลูก" title={editingId ? "แก้ไขแปลงปลูก" : "เพิ่มแปลงปลูก"} onCancel={editingId ? onCancel : null} />
        {formDisabled && <p className="empty-state">เพิ่มเกษตรกรก่อน แล้วจึงเพิ่มแปลงปลูกได้</p>}
        <form className="entity-form" onSubmit={onSubmit}>
          <SelectField label="เกษตรกร" value={form.farmer || farmers[0]?.id || ""} onChange={(value) => setForm({ ...form, farmer: value })} required disabled={formDisabled}>
            {farmers.map((farmer) => (
              <option key={farmer.id} value={farmer.id}>{farmer.full_name}</option>
            ))}
          </SelectField>
          <SelectField label="ผลไม้" value={form.fruit || fruits[0]?.id || ""} onChange={(value) => setForm({ ...form, fruit: value })} required disabled={formDisabled}>
            {fruits.map((fruit) => (
              <option key={fruit.id} value={fruit.id}>{fruit.name}</option>
            ))}
          </SelectField>
          <Field label="สายพันธุ์" value={form.variety} onChange={(value) => setForm({ ...form, variety: value })} />
          <Field label="พื้นที่ ไร่" type="number" step="0.01" value={form.area_rai} onChange={(value) => setForm({ ...form, area_rai: value })} />
          <Field label="วันที่ปลูก" type="date" value={form.planted_at} onChange={(value) => setForm({ ...form, planted_at: value })} />
          <TextArea label="หมายเหตุ" value={form.note} onChange={(value) => setForm({ ...form, note: value })} />
          <button type="submit" disabled={formDisabled}>{editingId ? "บันทึกการแก้ไข" : "เพิ่มแปลงปลูก"}</button>
        </form>
      </section>
    </div>
  );
}

function HarvestsSection({
  harvests,
  plantings,
  years,
  search,
  setSearch,
  yearFilter,
  setYearFilter,
  form,
  setForm,
  editingId,
  onSubmit,
  onEdit,
  onDelete,
  onCancel,
}) {
  const formDisabled = !plantings.length || !years.length;

  return (
    <div className="harvest-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">รายการล่าสุด</p>
            <h3>ข้อมูลการเก็บเกี่ยว</h3>
          </div>
          <div className="filters">
            <input
              aria-label="ค้นหารายการเก็บเกี่ยว"
              placeholder="ค้นหาผลไม้หรือเกษตรกร"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="กรองตามปี"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option value="all">ทุกปี</option>
              {years.map((year) => (
                <option key={year.id} value={year.year}>{year.year}</option>
              ))}
            </select>
          </div>
        </div>
        <HarvestTable rows={harvests} onEdit={onEdit} onDelete={onDelete} />
      </section>

      <section className="panel form-panel">
        <FormHeading label="บันทึกผลผลิต" title={editingId ? "แก้ไขเก็บเกี่ยว" : "เพิ่มเก็บเกี่ยว"} onCancel={editingId ? onCancel : null} />
        {formDisabled && <p className="empty-state">เพิ่มแปลงปลูกก่อน แล้วจึงเพิ่มข้อมูลเก็บเกี่ยวได้</p>}
        <form className="entity-form" onSubmit={onSubmit}>
          <SelectField label="แปลงปลูก" value={form.planting || plantings[0]?.id || ""} onChange={(value) => setForm({ ...form, planting: value })} required disabled={formDisabled}>
            {plantings.map((planting) => (
              <option key={planting.id} value={planting.id}>
                {planting.fruit_name} {planting.variety} / {planting.farmer_name}
              </option>
            ))}
          </SelectField>
          <SelectField label="ปี" value={form.harvest_year || years[0]?.id || ""} onChange={(value) => setForm({ ...form, harvest_year: value })} required disabled={formDisabled}>
            {years.map((year) => (
              <option key={year.id} value={year.id}>{year.year}</option>
            ))}
          </SelectField>
          <Field label="ผลผลิต กก." type="number" step="0.01" value={form.quantity_kg} onChange={(value) => setForm({ ...form, quantity_kg: value })} required />
          <Field label="ราคา/กก." type="number" step="0.01" value={form.price_per_kg} onChange={(value) => setForm({ ...form, price_per_kg: value })} required />
          <Field label="วันที่เก็บเกี่ยว" type="date" value={form.harvested_at} onChange={(value) => setForm({ ...form, harvested_at: value })} />
          <TextArea label="หมายเหตุ" value={form.note} onChange={(value) => setForm({ ...form, note: value })} />
          <button type="submit" disabled={formDisabled}>{editingId ? "บันทึกการแก้ไข" : "เพิ่มเก็บเกี่ยว"}</button>
        </form>
      </section>
    </div>
  );
}

function FormHeading({ label, title, onCancel }) {
  return (
    <div className="panel-heading">
      <div>
        <p className="eyebrow">{label}</p>
        <h3>{title}</h3>
      </div>
      {onCancel && <button type="button" className="ghost-button" onClick={onCancel}>ยกเลิก</button>}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", step, required = false }) {
  return (
    <label>
      {label}
      <input
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, required = false, disabled = false, children }) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label>
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
    </label>
  );
}

function Metric({ icon: Icon, label, value, note, wide = false }) {
  return (
    <article className={wide ? "metric-card wide" : "metric-card"}>
      <span className="metric-icon"><Icon size={21} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function HarvestTable({ rows, onEdit, onDelete }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ผลไม้</th>
            <th>เกษตรกร</th>
            <th>ปี</th>
            <th>ผลผลิต</th>
            <th>ราคา</th>
            <th>รายได้</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((harvest) => (
            <tr key={harvest.id}>
              <td>
                <span className="fruit-inline">
                  <span className="fruit-swatch" style={{ backgroundColor: harvest.fruit_color }} />
                  {harvest.fruit_name} {harvest.variety}
                </span>
              </td>
              <td>{harvest.farmer_name}</td>
              <td>{harvest.year}</td>
              <td>{formatNumber(harvest.quantity_kg, 2)} กก.</td>
              <td>{formatCurrency(harvest.price_per_kg)}</td>
              <td>{formatCurrency(harvest.revenue)}</td>
              <td>
                <div className="action-row table-actions">
                  <button type="button" onClick={() => onEdit(harvest)}>แก้ไข</button>
                  <button type="button" className="danger-button" onClick={() => onDelete(harvest)}>ลบ</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="empty-state">ไม่พบรายการที่ตรงกับตัวกรอง</p>}
    </div>
  );
}
