"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as d3 from "d3";
import thailandMap from "@svg-maps/thailand";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Edit,
  ImagePlus,
  Leaf,
  LogOut,
  Map as MapIcon,
  MapPinned,
  Save,
  Search,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Trash2,
  Upload,
  Users,
  Wheat,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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
  active_years: [],
  farmer_trends: [],
  top_farmers: [],
  planting_locations: [],
  recent_harvests: [],
};

const emptyFarmerForm = {
  first_name: "",
  last_name: "",
  age: "",
  phone: "",
  village: "",
  address: "",
  photo: "",
};

const emptyPlantingForm = {
  farmer: "",
  fruit: "",
  variety: "",
  area_rai: "",
  planted_at: "",
  province: "",
  district: "",
  subdistrict: "",
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

function profileFormFromUser(user) {
  return {
    first_name: normalizeText(user?.first_name),
    last_name: normalizeText(user?.last_name),
    email: normalizeText(user?.email),
    avatar: normalizeText(user?.avatar),
    phone: normalizeText(user?.phone),
    bio: normalizeText(user?.bio),
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      reject(new Error("เลือกได้เฉพาะไฟล์รูปภาพ"));
      return;
    }
    if (file.size > 1_500_000) {
      reject(new Error("รูปต้องมีขนาดไม่เกิน 1.5MB"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function confirmDelete(message, onConfirm) {
  toast.warning(message, {
    description: "กดลบเพื่อยืนยัน",
    action: {
      label: "ลบ",
      onClick: onConfirm,
    },
    cancel: {
      label: "ยกเลิก",
      onClick: () => {},
    },
  });
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(profileFormFromUser(null));
  const [dashboard, setDashboard] = useState(blankDashboard);
  const [farmers, setFarmers] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [years, setYears] = useState([]);
  const [fruits, setFruits] = useState([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [personYearFilter, setPersonYearFilter] = useState("");
  const [activeFarmerTrendId, setActiveFarmerTrendId] = useState("");
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

    const activeYears = summary?.active_years || [];
    setPersonYearFilter((current) => current || (activeYears[0] ? String(activeYears[0]) : ""));
    setActiveFarmerTrendId((current) => {
      const ids = Array.from(new Set((summary?.farmer_trends || []).map((item) => String(item.farmer_id))));
      return ids.includes(String(current)) ? current : ids[0] || "";
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const user = await apiRequest("/auth/me/");
        if (!mounted) return;

        if (!user?.is_authenticated) {
          setAuthState("guest");
          return;
        }

        if (user?.is_admin) {
          router.replace("/admin");
          return;
        }

        setCurrentUser(user);
        setProfileForm(profileFormFromUser(user));
        setAuthState("ready");
        await loadData();
      } catch (error) {
        if (!mounted) return;
        setAuthState("guest");
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
    toast.success(successMessage);
  }

  async function handleLogout() {
    await apiRequest("/auth/logout/", { method: "POST" }).catch(() => null);
    router.replace("/login");
  }

  async function handleProfileImageChange(event) {
    try {
      const dataUrl = await fileToDataUrl(event.target.files?.[0]);
      setProfileForm((current) => ({ ...current, avatar: dataUrl }));
      toast.success("เลือกรูปโปรไฟล์แล้ว");
    } catch (error) {
      toast.error(error.message);
    } finally {
      event.target.value = "";
    }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    try {
      const user = await apiRequest("/auth/me/", {
        method: "PATCH",
        body: profileForm,
      });
      setCurrentUser(user);
      setProfileForm(profileFormFromUser(user));
      setProfileOpen(false);
      toast.success("อัปเดตโปรไฟล์แล้ว");
    } catch (error) {
      toast.error(`บันทึกโปรไฟล์ไม่สำเร็จ: ${error.message}`);
    }
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
      toast.error(`บันทึกเกษตรกรไม่สำเร็จ: ${error.message}`);
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
      photo: normalizeText(farmer.photo),
    });
  }

  async function deleteFarmer(farmer) {
    confirmDelete(`ลบข้อมูล ${farmer.full_name} ?`, async () => {
      try {
        await apiRequest(`/farmers/${farmer.id}/`, { method: "DELETE" });
        await refreshWithMessage("ลบข้อมูลเกษตรกรแล้ว");
      } catch (error) {
        toast.error(`ลบเกษตรกรไม่สำเร็จ: ${error.message}`);
      }
    });
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
      toast.error(`บันทึกแปลงปลูกไม่สำเร็จ: ${error.message}`);
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
      province: normalizeText(planting.province),
      district: normalizeText(planting.district),
      subdistrict: normalizeText(planting.subdistrict),
      note: normalizeText(planting.note),
    });
  }

  async function deletePlanting(planting) {
    confirmDelete(`ลบแปลง ${planting.fruit_name} ${planting.variety || ""} ?`, async () => {
      try {
        await apiRequest(`/plantings/${planting.id}/`, { method: "DELETE" });
        await refreshWithMessage("ลบข้อมูลแปลงปลูกแล้ว");
      } catch (error) {
        toast.error(`ลบแปลงปลูกไม่สำเร็จ: ${error.message}`);
      }
    });
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
      toast.error(`บันทึกเก็บเกี่ยวไม่สำเร็จ: ${error.message}`);
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
    confirmDelete(`ลบรายการเก็บเกี่ยว ${harvest.fruit_name} ปี ${harvest.year} ?`, async () => {
      try {
        await apiRequest(`/harvests/${harvest.id}/`, { method: "DELETE" });
        await refreshWithMessage("ลบข้อมูลเก็บเกี่ยวแล้ว");
      } catch (error) {
        toast.error(`ลบเก็บเกี่ยวไม่สำเร็จ: ${error.message}`);
      }
    });
  }

  if (authState === "guest") {
    return <LandingPage />;
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

      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ระบบจัดการข้อมูลเก็บเกี่ยวผลไม้</p>
            <h2>ติดตามผลผลิต รายได้ และแปลงปลูกในมุมเดียว</h2>
          </div>
          <div className="profile-chip">
            <Avatar image={currentUser?.avatar} name={currentUser?.name || currentUser?.username} size="sm" />
            <div>
              <strong>{currentUser?.name || currentUser?.username}</strong>
              <small>{currentUser?.email || currentUser?.username}</small>
            </div>
            <div className="profile-actions">
              <button type="button" onClick={() => setProfileOpen((open) => !open)} title="แก้ไขโปรไฟล์">
                <Edit size={16} />
              </button>
              <button type="button" onClick={handleLogout} title="ออกจากระบบ">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {profileOpen && (
          <ProfileEditor
            form={profileForm}
            setForm={setProfileForm}
            onSubmit={handleProfileSubmit}
            onImageChange={handleProfileImageChange}
            onClose={() => {
              setProfileForm(profileFormFromUser(currentUser));
              setProfileOpen(false);
            }}
          />
        )}

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
            activeFarmerTrendId={activeFarmerTrendId}
            setActiveFarmerTrendId={setActiveFarmerTrendId}
            personYearFilter={personYearFilter}
            setPersonYearFilter={setPersonYearFilter}
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
            harvests={harvests}
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

function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <div className="brand-block">
          <span className="brand-mark"><Leaf size={24} /></span>
          <div>
            <p className="eyebrow">HarvestData</p>
            <strong>สวนข้อมูลผลไม้</strong>
          </div>
        </div>
        <Link href="/login" className="landing-login-button">เข้าสู่ระบบ</Link>
      </header>
      <section className="landing-hero">
        <div className="eden-scene" aria-hidden="true">
          <span className="world-canopy" />
          <span className="world-trunk" />
          <span className="eden-ground" />
          <span className="data-vine vine-one" />
          <span className="data-vine vine-two" />
          <span className="data-fruit fruit-a" />
          <span className="data-fruit fruit-b" />
          <span className="data-fruit fruit-c" />
        </div>
        <div className="landing-copy">
          <p className="eyebrow">World Tree / Eden Garden</p>
          <h1>HarvestData</h1>
          <p>
            ระบบจัดการสวนผลไม้ที่รวมข้อมูลเกษตรกร แปลงปลูก ผลผลิต ราคา และภาพรวมรายปีให้เห็นชัดในที่เดียว
          </p>
          <div className="landing-stats" aria-label="HarvestData highlights">
            <span><ShieldCheck size={18} /> ข้อมูลแยกตามบัญชี</span>
            <span><MapPinned size={18} /> เห็นแปลงตามจังหวัด</span>
            <span><ChartNoAxesCombined size={18} /> วิเคราะห์รายคน</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function Avatar({ image, name, size = "md" }) {
  const initial = (name || "H").trim().slice(0, 1).toUpperCase();

  return (
    <span className={`avatar avatar-${size}`}>
      {image ? <img src={image} alt="" /> : <span>{initial}</span>}
    </span>
  );
}

function ProfileEditor({ form, setForm, onSubmit, onImageChange, onClose }) {
  return (
    <section className="panel profile-editor">
      <FormHeading label="โปรไฟล์ผู้ใช้" title="แก้ไขข้อมูลตัวเอง" onCancel={onClose} />
      <form className="profile-editor-grid" onSubmit={onSubmit}>
        <div className="avatar-editor">
          <Avatar image={form.avatar} name={`${form.first_name} ${form.last_name}`} size="lg" />
          <div className="avatar-tools">
            <label className="icon-upload-button" title="อัปโหลดรูป">
              <ImagePlus size={17} />
              <input type="file" accept="image/*" onChange={onImageChange} />
            </label>
            <button
              type="button"
              className="icon-button danger-button"
              onClick={() => setForm({ ...form, avatar: "" })}
              title="ลบรูป"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
        <div className="entity-form profile-fields">
          <Field label="ชื่อ" value={form.first_name} onChange={(value) => setForm({ ...form, first_name: value })} />
          <Field label="นามสกุล" value={form.last_name} onChange={(value) => setForm({ ...form, last_name: value })} />
          <Field label="อีเมล" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <Field label="เบอร์โทร" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
          <TextArea label="ข้อมูลเพิ่มเติม" value={form.bio} onChange={(value) => setForm({ ...form, bio: value })} />
          <button type="submit"><Save size={16} />บันทึกโปรไฟล์</button>
        </div>
      </form>
    </section>
  );
}

function Overview({
  dashboard,
  maxRevenue,
  maxYearQuantity,
  activeFarmerTrendId,
  setActiveFarmerTrendId,
  personYearFilter,
  setPersonYearFilter,
}) {
  const [productShareYear, setProductShareYear] = useState("");
  const activeYears = dashboard.active_years || [];
  const productShareYears = activeYears.map((year) => String(year));
  const selectedProductShareYear = productShareYears.includes(String(productShareYear))
    ? String(productShareYear)
    : productShareYears[0] || "";
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
  const fallbackSliceColors = ["#6f9f83", "#7aaed6", "#e4c86a", "#c99066", "#8a6fa5", "#2f604d"];
  const productShareBaseData = dashboard.product_trends
    .filter((item) => String(item.year) === selectedProductShareYear)
    .map((item, index) => ({
      id: item.product_id,
      name: item.product_name,
      color: item.color || fallbackSliceColors[index % fallbackSliceColors.length],
      quantity_kg: Number(item.quantity_kg || 0),
      revenue: Number(item.revenue || 0),
    }))
    .filter((item) => item.quantity_kg > 0);
  const productShareTotal = productShareBaseData.reduce((sum, item) => sum + item.quantity_kg, 0);
  const productShareData = productShareBaseData.map((item) => ({
    ...item,
    percent: productShareTotal ? (item.quantity_kg / productShareTotal) * 100 : 0,
  }));
  const farmerTrendTabs = Array.from(
    new Map(
      dashboard.farmer_trends.map((item) => [
        item.farmer_id,
        {
          id: item.farmer_id,
          name: item.farmer_name,
          photo: item.farmer_photo,
        },
      ])
    ).values()
  );
  const activeFarmer =
    farmerTrendTabs.find((farmer) => String(farmer.id) === String(activeFarmerTrendId)) ||
    farmerTrendTabs[0];
  const selectedYear = personYearFilter || (activeYears[0] ? String(activeYears[0]) : "");
  const farmerProductData = dashboard.farmer_trends
    .filter((item) => String(item.farmer_id) === String(activeFarmer?.id) && String(item.year) === String(selectedYear))
    .map((item) => ({
      product: item.product_name,
      quantity_kg: item.quantity_kg,
      average_price: item.average_price,
      revenue: item.revenue,
      color: item.color,
    }));

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

      <section className="panel chart-panel product-share-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Product Share</p>
            <h3>สัดส่วนผลผลิตแต่ละชนิดต่อปี</h3>
          </div>
          <div className="filters">
            <select
              aria-label="เลือกปีสำหรับสัดส่วนผลผลิต"
              value={selectedProductShareYear}
              onChange={(event) => setProductShareYear(event.target.value)}
              disabled={!productShareYears.length}
            >
              {!productShareYears.length && <option value="">ไม่มีข้อมูลปี</option>}
              {productShareYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="product-share-content">
          <div className="pie-chart-wrap">
            {!!productShareData.length && (
              <>
                <ResponsiveContainer width="100%" height={310}>
                  <PieChart>
                    <Pie
                      data={productShareData}
                      dataKey="quantity_kg"
                      nameKey="name"
                      innerRadius={72}
                      outerRadius={112}
                      paddingAngle={2}
                      stroke="#fffdf7"
                      strokeWidth={3}
                    >
                      {productShareData.map((item) => (
                        <Cell key={item.id || item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        border: "1px solid rgba(194, 211, 190, 0.8)",
                        borderRadius: 8,
                        background: "rgba(255, 253, 247, 0.96)",
                        boxShadow: "0 18px 44px rgba(54, 71, 55, 0.14)",
                      }}
                      formatter={(value, name, props) => [
                        `${formatNumber(value, 2)} กก. (${formatNumber(props?.payload?.percent, 1)}%)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-center" aria-hidden="true">
                  <div>
                    <strong>{formatNumber(productShareTotal, 2)}</strong>
                    <span>กก. รวม</span>
                  </div>
                </div>
              </>
            )}
            {!productShareData.length && <p className="empty-state">ยังไม่มีข้อมูลผลผลิตในปีนี้</p>}
          </div>
          <div className="product-share-list">
            {productShareData.map((item) => (
              <article className="product-share-row" key={item.id || item.name}>
                <span className="fruit-swatch" style={{ backgroundColor: item.color }} />
                <div>
                  <strong>{item.name}</strong>
                  <small>{formatNumber(item.quantity_kg, 2)} กก.</small>
                </div>
                <b>{formatNumber(item.percent, 1)}%</b>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel chart-panel farmer-trend-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Farmer Insights</p>
            <h3>ข้อมูลรายคนว่าปลูกอะไรบ้าง</h3>
          </div>
          <div className="filters">
            <select
              aria-label="กรองปีข้อมูลรายคน"
              value={selectedYear}
              onChange={(event) => setPersonYearFilter(event.target.value)}
            >
              {activeYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="farmer-tabs" role="tablist" aria-label="เลือกเกษตรกร">
          {farmerTrendTabs.map((farmer) => (
            <button
              key={farmer.id}
              type="button"
              role="tab"
              className={String(activeFarmer?.id) === String(farmer.id) ? "farmer-tab active" : "farmer-tab"}
              onClick={() => setActiveFarmerTrendId(String(farmer.id))}
            >
              <Avatar image={farmer.photo} name={farmer.name} size="xs" />
              {farmer.name}
            </button>
          ))}
        </div>
        <div className="line-chart-wrap">
          {!!farmerProductData.length && (
            <ResponsiveContainer width="100%" height={310}>
              <LineChart data={farmerProductData} margin={{ top: 12, right: 14, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#dce8dc" strokeDasharray="5 8" vertical={false} />
                <XAxis dataKey="product" axisLine={false} tickLine={false} tick={{ fill: "#6d756c", fontSize: 12 }} />
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
                    if (name === "ผลผลิต") return [`${formatNumber(value, 2)} กก.`, name];
                    return [`${formatCurrency(value)}/กก.`, name];
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 10 }} />
                <Line
                  yAxisId="quantity"
                  type="monotone"
                  dataKey="quantity_kg"
                  name="ผลผลิต"
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
                  stroke="#9b6da3"
                  strokeWidth={4}
                  dot={{ r: 5, strokeWidth: 3, fill: "#fffdf7" }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {!farmerProductData.length && <p className="empty-state">ยังไม่มีข้อมูลรายคนในปีนี้</p>}
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
              <Avatar image={farmer.photo} name={farmer.name} size="xs" />
              <div>
                <strong>{index + 1}. {farmer.name}</strong>
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
  const [farmerSearch, setFarmerSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const filteredFarmers = useMemo(() => {
    const query = farmerSearch.trim().toLowerCase();
    if (!query) return farmers;

    return farmers.filter((farmer) =>
      [farmer.full_name, farmer.village, farmer.phone, farmer.address]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [farmers, farmerSearch]);
  const pageCount = Math.max(Math.ceil(filteredFarmers.length / pageSize), 1);
  const currentPage = Math.min(page, pageCount);
  const pagedFarmers = filteredFarmers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleFarmerImageChange(event) {
    try {
      const dataUrl = await fileToDataUrl(event.target.files?.[0]);
      setForm({ ...form, photo: dataUrl });
      toast.success("เลือกรูปเกษตรกรแล้ว");
    } catch (error) {
      toast.error(error.message);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="management-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ทะเบียนเกษตรกร</p>
            <h3>รายชื่อเจ้าของสวน</h3>
          </div>
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="ค้นหาเกษตรกร"
              placeholder="ค้นหาเกษตรกร"
              value={farmerSearch}
              onChange={(event) => {
                setFarmerSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="card-grid">
          {pagedFarmers.map((farmer) => (
            <article className="person-card" key={farmer.id}>
              <Avatar image={farmer.photo} name={farmer.full_name} size="md" />
              <div>
                <strong>{farmer.full_name}</strong>
                <small>{farmer.village || "ยังไม่ระบุพื้นที่"}</small>
                <p>{farmer.phone || "ไม่มีเบอร์ติดต่อ"}</p>
                <div className="action-row">
                  <button type="button" onClick={() => onEdit(farmer)} title="แก้ไข">
                    <Edit size={15} />แก้ไข
                  </button>
                  <button type="button" className="danger-button" onClick={() => onDelete(farmer)} title="ลบ">
                    <Trash2 size={15} />ลบ
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!filteredFarmers.length && <p className="empty-state">ยังไม่มีเกษตรกรที่ตรงกับการค้นหา</p>}
        </div>
        {filteredFarmers.length > pageSize && (
          <div className="pagination">
            <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={currentPage === 1}>
              <ChevronLeft size={16} />
            </button>
            <span>{currentPage} / {pageCount}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(current + 1, pageCount))} disabled={currentPage === pageCount}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>

      <section className="panel form-panel">
        <FormHeading label="ข้อมูลเกษตรกร" title={editingId ? "แก้ไขเกษตรกร" : "เพิ่มเกษตรกร"} onCancel={editingId ? onCancel : null} />
        <form className="entity-form" onSubmit={onSubmit}>
          <div className="avatar-editor compact">
            <Avatar image={form.photo} name={`${form.first_name} ${form.last_name}`} size="lg" />
            <div className="avatar-tools">
              <label className="icon-upload-button" title="อัปโหลดรูปเกษตรกร">
                <Upload size={17} />
                <input type="file" accept="image/*" onChange={handleFarmerImageChange} />
              </label>
              <button
                type="button"
                className="icon-button danger-button"
                onClick={() => setForm({ ...form, photo: "" })}
                title="ลบรูปเกษตรกร"
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
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

const MAP_PROVINCE_TO_THAI = {
  Bangkok: "กรุงเทพมหานคร",
  "Samut Prakan": "สมุทรปราการ",
  Nonthaburi: "นนทบุรี",
  "Pathum Thani": "ปทุมธานี",
  "Phra Nakhon Si Ayutthaya": "พระนครศรีอยุธยา",
  "Ang Thong": "อ่างทอง",
  "Lop Buri": "ลพบุรี",
  "Sing Buri": "สิงห์บุรี",
  "Chai Nat": "ชัยนาท",
  Saraburi: "สระบุรี",
  "Chon Buri": "ชลบุรี",
  Rayong: "ระยอง",
  Chanthaburi: "จันทบุรี",
  Trat: "ตราด",
  Chachoengsao: "ฉะเชิงเทรา",
  "Prachin Buri": "ปราจีนบุรี",
  "Nakhon Nayok": "นครนายก",
  "Sa Kaeo": "สระแก้ว",
  "Nakhon Ratchasima": "นครราชสีมา",
  Buriram: "บุรีรัมย์",
  Surin: "สุรินทร์",
  "Si Sa Ket": "ศรีสะเกษ",
  "Ubon Ratchathani": "อุบลราชธานี",
  Yasothon: "ยโสธร",
  Chaiyaphum: "ชัยภูมิ",
  "Amnat Charoen": "อำนาจเจริญ",
  "Bueng Kan": "บึงกาฬ",
  "Nong Bua Lam Phu": "หนองบัวลำภู",
  "Khon Kaen": "ขอนแก่น",
  "Udon Thani": "อุดรธานี",
  Loei: "เลย",
  "Nong Khai": "หนองคาย",
  "Maha Sarakham": "มหาสารคาม",
  "Roi Et": "ร้อยเอ็ด",
  Kalasin: "กาฬสินธุ์",
  "Sakon Nakhon": "สกลนคร",
  "Nakhon Phanom": "นครพนม",
  Mukdahan: "มุกดาหาร",
  "Chiang Mai": "เชียงใหม่",
  Lamphun: "ลำพูน",
  Lampang: "ลำปาง",
  Uttaradit: "อุตรดิตถ์",
  Phrae: "แพร่",
  Nan: "น่าน",
  Phayao: "พะเยา",
  "Chiang Rai": "เชียงราย",
  "Mae Hong Son": "แม่ฮ่องสอน",
  "Nakhon Sawan": "นครสวรรค์",
  "Uthai Thani": "อุทัยธานี",
  "Kamphaeng Phet": "กำแพงเพชร",
  Tak: "ตาก",
  Sukhothai: "สุโขทัย",
  Phitsanulok: "พิษณุโลก",
  Phichit: "พิจิตร",
  Phetchabun: "เพชรบูรณ์",
  Ratchaburi: "ราชบุรี",
  Kanchanaburi: "กาญจนบุรี",
  "Suphan Buri": "สุพรรณบุรี",
  "Nakhon Pathom": "นครปฐม",
  "Samut Sakhon": "สมุทรสาคร",
  "Samut Songkhram": "สมุทรสงคราม",
  Phetchaburi: "เพชรบุรี",
  "Prachuap Khiri Khan": "ประจวบคีรีขันธ์",
  "Nakhon Si Thammarat": "นครศรีธรรมราช",
  Krabi: "กระบี่",
  Phangnga: "พังงา",
  Phuket: "ภูเก็ต",
  "Surat Thani": "สุราษฎร์ธานี",
  Ranong: "ระนอง",
  Chumphon: "ชุมพร",
  Songkhla: "สงขลา",
  Satun: "สตูล",
  Trang: "ตรัง",
  Phatthalung: "พัทลุง",
  Pattani: "ปัตตานี",
  Yala: "ยะลา",
  Narathiwat: "นราธิวาส",
};

const THAI_PROVINCE_TO_MAP = Object.fromEntries(
  Object.entries(MAP_PROVINCE_TO_THAI).map(([mapName, thaiName]) => [thaiName, mapName])
);

const MAP_LOCATIONS = thailandMap.locations.filter((location) => location.id !== "lksg");

function buildProvinceGroups(plantings, harvests) {
  const harvestByPlanting = harvests.reduce((harvestMap, harvest) => {
    const existing = harvestMap.get(harvest.planting) || { quantity: 0, revenue: 0, years: new Set() };
    existing.quantity += Number(harvest.quantity_kg || 0);
    existing.revenue += Number(harvest.revenue || 0);
    if (harvest.year) existing.years.add(harvest.year);
    harvestMap.set(harvest.planting, existing);
    return harvestMap;
  }, new Map());

  return plantings.reduce((provinceMap, planting) => {
    if (!planting.province) return provinceMap;

    const mapName = THAI_PROVINCE_TO_MAP[planting.province] || planting.province;
    const existing = provinceMap.get(mapName) || {
      mapName,
      province: MAP_PROVINCE_TO_THAI[mapName] || planting.province,
      count: 0,
      area: 0,
      quantity: 0,
      revenue: 0,
      crops: new Set(),
      farmers: new Map(),
    };
    const harvestTotal = harvestByPlanting.get(planting.id) || { quantity: 0, revenue: 0 };
    const farmerName = planting.farmer_name || "ไม่ระบุเกษตรกร";
    const farmer = existing.farmers.get(farmerName) || {
      name: farmerName,
      quantity: 0,
      crops: new Set(),
    };

    existing.count += 1;
    existing.area += Number(planting.area_rai || 0);
    existing.quantity += harvestTotal.quantity;
    existing.revenue += harvestTotal.revenue;
    existing.crops.add(planting.fruit_name || "ไม่ระบุผลไม้");
    farmer.quantity += harvestTotal.quantity;
    farmer.crops.add(planting.fruit_name || "ไม่ระบุผลไม้");
    existing.farmers.set(farmerName, farmer);
    provinceMap.set(mapName, existing);

    return provinceMap;
  }, new Map());
}

function ThailandPlantingMap({ plantings, harvests }) {
  const svgRef = useRef(null);
  const mapWrapRef = useRef(null);
  const provinceGroupMap = useMemo(
    () => buildProvinceGroups(plantings, harvests),
    [plantings, harvests]
  );
  const provinceGroups = useMemo(
    () =>
      Array.from(provinceGroupMap.values())
        .map((group) => ({
          ...group,
          crops: Array.from(group.crops),
          farmers: Array.from(group.farmers.values()).map((farmer) => ({
            ...farmer,
            crops: Array.from(farmer.crops),
          })),
        }))
        .sort((a, b) => b.quantity - a.quantity || b.count - a.count),
    [provinceGroupMap]
  );
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    province: "",
    group: null,
  });

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const maxMetric = d3.max(provinceGroups, (group) => group.quantity || group.count) || 1;
    const colorScale = d3.scaleSequential()
      .domain([0, maxMetric])
      .interpolator(d3.interpolateRgb("#a6c5a1", "#2f604d"));

    function tooltipPosition(event) {
      const bounds = mapWrapRef.current?.getBoundingClientRect();
      if (!bounds || !("clientX" in event)) {
        return { x: 20, y: 20 };
      }
      return {
        x: event.clientX - bounds.left + 14,
        y: event.clientY - bounds.top + 14,
      };
    }

    function showTooltip(event, location) {
      const group = provinceGroupMap.get(location.name) || null;
      const position = tooltipPosition(event);
      setTooltip({
        visible: true,
        x: position.x,
        y: position.y,
        province: MAP_PROVINCE_TO_THAI[location.name] || location.name,
        group,
      });
    }

    svg.selectAll("*").remove();
    svg
      .attr("viewBox", thailandMap.viewBox)
      .attr("role", "img")
      .attr("aria-label", "แผนที่ประเทศไทยแสดงจังหวัดที่มีผลผลิต");

    svg
      .append("g")
      .attr("class", "d3-thailand-provinces")
      .selectAll("path")
      .data(MAP_LOCATIONS, (location) => location.id)
      .join("path")
      .attr("d", (location) => location.path)
      .attr("tabIndex", 0)
      .attr("class", (location) =>
        provinceGroupMap.has(location.name) ? "d3-province has-data" : "d3-province no-data"
      )
      .attr("fill", (location) => {
        const group = provinceGroupMap.get(location.name);
        if (!group) return "#d6d9d1";
        return colorScale(group.quantity || group.count);
      })
      .attr("stroke", "rgba(255, 253, 247, 0.86)")
      .attr("stroke-width", 1.1)
      .on("mouseenter", showTooltip)
      .on("mousemove", showTooltip)
      .on("focus", showTooltip)
      .on("mouseleave blur", () => {
        setTooltip((current) => ({ ...current, visible: false }));
      });
  }, [provinceGroupMap, provinceGroups]);

  return (
    <div className="thailand-map-card">
      <div className="map-heading">
        <span className="panel-icon"><MapIcon size={20} /></span>
        <div>
          <strong>แผนที่แปลงปลูกประเทศไทย</strong>
          <small>แสดงจังหวัดที่มีแปลงปลูกและเจ้าของแปลง</small>
        </div>
      </div>
      <div className="map-content">
        <div ref={mapWrapRef} className="thailand-map-canvas" aria-label="จังหวัดที่มีผลผลิต">
          <svg ref={svgRef} />
          {tooltip.visible && (
            <div className="d3-map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
              <strong>{tooltip.province}</strong>
              {tooltip.group ? (
                <>
                  <span>{formatNumber(tooltip.group.count)} แปลง / {formatNumber(tooltip.group.area, 2)} ไร่</span>
                  <span>ผลผลิตรวม {formatNumber(tooltip.group.quantity, 2)} กก.</span>
                  <small>{Array.from(tooltip.group.crops).join(", ")}</small>
                  <ul>
                    {Array.from(tooltip.group.farmers.values()).slice(0, 6).map((farmer) => (
                      <li key={farmer.name}>
                        {farmer.name}: {Array.from(farmer.crops).join(", ")}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <span>ไม่มีข้อมูล</span>
              )}
            </div>
          )}
          <div className="map-legend" aria-hidden="true">
            <span><i className="legend-empty" />ไม่มีข้อมูล</span>
            <span><i className="legend-active" />มีผลผลิต</span>
          </div>
        </div>
        <div className="map-location-list">
          {provinceGroups.map((group) => (
            <article key={group.province}>
              <strong>{group.province}</strong>
              <small>{group.farmers.map((farmer) => `${farmer.name}: ${farmer.crops.join(", ")}`).join(" / ")}</small>
              <span>{formatNumber(group.count)} แปลง / {formatNumber(group.area, 2)} ไร่ / {formatNumber(group.quantity, 2)} กก.</span>
            </article>
          ))}
          {!provinceGroups.length && <p className="empty-state">ยังไม่มีข้อมูลจังหวัดของแปลงปลูก</p>}
        </div>
      </div>
    </div>
  );
}

function PlantingsSection({ plantings, harvests, farmers, fruits, form, setForm, editingId, onSubmit, onEdit, onDelete, onCancel }) {
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
        <ThailandPlantingMap plantings={plantings} harvests={harvests} />
        <div className="planting-grid">
          {plantings.map((planting) => (
            <article className="planting-card" key={planting.id}>
              <span className="fruit-swatch" style={{ backgroundColor: planting.fruit_color }} />
              <div>
                <strong>{planting.fruit_name}</strong>
                <small>{planting.variety || "ไม่ระบุสายพันธุ์"}</small>
                <p>{planting.farmer_name}</p>
                <p>{[planting.subdistrict, planting.district, planting.province].filter(Boolean).join(" / ") || "ยังไม่ระบุที่ตั้ง"}</p>
                <div className="action-row">
                  <button type="button" onClick={() => onEdit(planting)}><Edit size={15} />แก้ไข</button>
                  <button type="button" className="danger-button" onClick={() => onDelete(planting)}><Trash2 size={15} />ลบ</button>
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
          <Field label="จังหวัด" value={form.province} onChange={(value) => setForm({ ...form, province: value })} />
          <Field label="อำเภอ" value={form.district} onChange={(value) => setForm({ ...form, district: value })} />
          <Field label="ตำบล" value={form.subdistrict} onChange={(value) => setForm({ ...form, subdistrict: value })} />
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
                  <button type="button" onClick={() => onEdit(harvest)}><Edit size={15} />แก้ไข</button>
                  <button type="button" className="danger-button" onClick={() => onDelete(harvest)}><Trash2 size={15} />ลบ</button>
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
