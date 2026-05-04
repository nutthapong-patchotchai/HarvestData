"use client";
/* eslint-disable @next/next/no-img-element */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { apiRequest, apiUrl, getCookie } from "./api-client.mjs";
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
  Menu,
  Moon,
  Save,
  Search,
  ShieldCheck,
  Sprout,
  Sun,
  TrendingUp,
  Trash2,
  Upload,
  Users,
  Wheat,
  X,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
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

const navItems = [
  { key: "overview", label: "ภาพรวม", icon: BarChart3 },
  { key: "farmers", label: "เกษตรกร", icon: Users },
  { key: "plantings", label: "แปลงปลูก", icon: Sprout },
  { key: "harvests", label: "เก็บเกี่ยว", icon: Wheat },
  { key: "transfer", label: "นำเข้า/ส่งออก", icon: Upload },
];

const transferDatasets = [
  { key: "farmers", label: "เกษตรกร" },
  { key: "plantings", label: "แปลงปลูก" },
  { key: "harvests", label: "ผลผลิตเก็บเกี่ยว" },
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

async function dataTransferRequest(formData) {
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(apiUrl("/data-transfer/import/"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: formData,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = payload?.detail || `HTTP ${response.status}`;
    const error = new Error(detail);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function downloadDataFile(path) {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { Accept: "*/*" },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const filename = disposition.match(/filename="?(?<name>[^"]+)"?/)?.groups?.name || "harvestdata-download";
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function downloadTextFile(filename, content, contentType = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function csvValue(value) {
  const text = Array.isArray(value)
    ? value.join("; ")
    : typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "");
  const normalized = text.replace(/\r?\n/g, " ");
  return /[",\n;]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

function importErrorReportCsv(preview) {
  const headers = ["row", "dataset", "status", "action", "errors", "data"];
  const rows = (preview?.rows || [])
    .filter((row) => row.status === "error")
    .map((row) => ({
      row: row.row,
      dataset: row.dataset,
      status: row.status,
      action: row.action,
      errors: row.errors || [],
      data: row.data || {},
    }));
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => csvValue(row[header])).join(","));
  });
  return `\ufeff${lines.join("\n")}`;
}

function normalizeNumber(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function normalizeText(value) {
  return value ?? "";
}

function getStoredDashboardTheme() {
  if (typeof window === "undefined") return "dark";
  const storedTheme = window.localStorage.getItem("harvestdata-dashboard-theme");
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
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

function LoadingShell() {
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

function useConfirmModal() {
  const [dialog, setDialog] = useState(null);
  const openConfirm = useCallback((options) => {
    setDialog(options);
  }, []);

  const confirmModal = dialog ? (
    <ConfirmDialog
      {...dialog}
      onClose={() => setDialog(null)}
      onConfirm={async () => {
        const action = dialog.onConfirm;
        setDialog(null);
        await action?.();
      }}
    />
  ) : null;

  return { openConfirm, confirmModal };
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeView = searchParams.get("view") || "";
  const [activeTab, setActiveTab] = useState("overview");
  const [authState, setAuthState] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileCardOpen, setProfileCardOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(profileFormFromUser(null));
  const [dashboardTheme, setDashboardTheme] = useState(getStoredDashboardTheme);
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
  const { openConfirm, confirmModal } = useConfirmModal();

  useEffect(() => {
    window.localStorage.setItem("harvestdata-dashboard-theme", dashboardTheme);
  }, [dashboardTheme]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileSidebarOpen]);

  const loadData = useCallback(async () => {
    const [summary, farmerRows, plantingRows, harvestRows, yearRows, fruitRows] = await Promise.all([
      apiRequest("/dashboard/"),
      apiRequest("/farmers/", { fetchAllPages: true }),
      apiRequest("/plantings/", { fetchAllPages: true }),
      apiRequest("/harvests/", { fetchAllPages: true }),
      apiRequest("/years/", { fetchAllPages: true }),
      apiRequest("/fruits/", { fetchAllPages: true }),
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
        if (routeView === "landing") {
          setAuthState("guest");
          return;
        }

        const user = await apiRequest("/auth/me/");
        if (!mounted) return;

        if (!user?.is_authenticated) {
          setAuthState("guest");
          return;
        }

        if (user?.is_admin && routeView !== "dashboard") {
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
  }, [loadData, routeView, router]);

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

  async function performLogout() {
    await apiRequest("/auth/logout/", { method: "POST" }).catch(() => null);
    router.replace("/login");
  }

  function confirmLogout() {
    openConfirm({
      title: "ออกจากระบบ",
      description: "ต้องการออกจากระบบ HarvestData ใช่ไหม?",
      details: ["งานที่ยังไม่ได้บันทึกอาจหายไป", "หลังออกจากระบบต้องเข้าสู่ระบบใหม่เพื่อใช้งาน Dashboard"],
      confirmLabel: "ออกจากระบบ",
      variant: "danger",
      onConfirm: performLogout,
    });
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
    openConfirm({
      title: "ลบข้อมูลเกษตรกร",
      description: `ต้องการลบ ${farmer.full_name} ใช่ไหม?`,
      details: ["ข้อมูลแปลงปลูกและรายการเก็บเกี่ยวที่เกี่ยวข้องอาจได้รับผลกระทบ", "การลบนี้ไม่สามารถย้อนกลับได้"],
      confirmLabel: "ลบเกษตรกร",
      variant: "danger",
      onConfirm: async () => {
        try {
          await apiRequest(`/farmers/${farmer.id}/`, { method: "DELETE" });
          await refreshWithMessage("ลบข้อมูลเกษตรกรแล้ว");
        } catch (error) {
          toast.error(`ลบเกษตรกรไม่สำเร็จ: ${error.message}`);
        }
      },
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
    openConfirm({
      title: "ลบข้อมูลแปลงปลูก",
      description: `ต้องการลบแปลง ${planting.fruit_name} ${planting.variety || ""} ของ ${planting.farmer_name} ใช่ไหม?`,
      details: ["รายการเก็บเกี่ยวที่ผูกกับแปลงนี้อาจได้รับผลกระทบ", "การลบนี้ไม่สามารถย้อนกลับได้"],
      confirmLabel: "ลบแปลงปลูก",
      variant: "danger",
      onConfirm: async () => {
        try {
          await apiRequest(`/plantings/${planting.id}/`, { method: "DELETE" });
          await refreshWithMessage("ลบข้อมูลแปลงปลูกแล้ว");
        } catch (error) {
          toast.error(`ลบแปลงปลูกไม่สำเร็จ: ${error.message}`);
        }
      },
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
    openConfirm({
      title: "ลบรายการเก็บเกี่ยว",
      description: `ต้องการลบ ${harvest.fruit_name} ปี ${harvest.year} ของ ${harvest.farmer_name} ใช่ไหม?`,
      details: [`ผลผลิต ${formatNumber(harvest.quantity_kg, 2)} กก. / รายได้ ${formatCurrency(harvest.revenue)}`, "การลบนี้ไม่สามารถย้อนกลับได้"],
      confirmLabel: "ลบรายการ",
      variant: "danger",
      onConfirm: async () => {
        try {
          await apiRequest(`/harvests/${harvest.id}/`, { method: "DELETE" });
          await refreshWithMessage("ลบข้อมูลเก็บเกี่ยวแล้ว");
        } catch (error) {
          toast.error(`ลบเก็บเกี่ยวไม่สำเร็จ: ${error.message}`);
        }
      },
    });
  }

  if (authState === "guest") {
    return <LandingPage />;
  }

  if (authState !== "ready") {
    return <LoadingShell />;
  }

  return (
    <main className={`app-shell dashboard-shell dashboard-theme-${dashboardTheme}`}>
      <button
        type="button"
        className="mobile-sidebar-toggle"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="เปิดเมนู Dashboard"
      >
        <Menu size={18} />
        <span>เมนู</span>
      </button>
      {mobileSidebarOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="ปิดเมนู Dashboard"
        />
      )}
      <aside className={mobileSidebarOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="sidebar-heading">
          <div className="brand-block">
            <span className="brand-mark"><Leaf size={24} /></span>
            <div>
              <p className="eyebrow">HarvestData</p>
              <h1>สวนผลไม้วันนี้</h1>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="ปิดเมนู Dashboard"
            title="ปิดเมนู"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Dashboard sections">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={activeTab === item.key ? "nav-button active" : "nav-button"}
              onClick={() => {
                setActiveTab(item.key);
                setMobileSidebarOpen(false);
              }}
              type="button"
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="dashboard-sidebar-footer">
          <button type="button" className="nav-button" onClick={() => router.push("/?view=landing")}>
            <Leaf size={18} /> ไปหน้าเว็บไซต์
          </button>
          <button type="button" className="nav-button" onClick={confirmLogout}>
            <LogOut size={18} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ระบบจัดการข้อมูลเก็บเกี่ยวผลไม้</p>
            <h2>ติดตามผลผลิต รายได้ และแปลงปลูกในมุมเดียว</h2>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="theme-toggle"
              aria-pressed={dashboardTheme === "dark"}
              onClick={() => setDashboardTheme((theme) => (theme === "dark" ? "light" : "dark"))}
              title={dashboardTheme === "dark" ? "สลับเป็น Light mode" : "สลับเป็น Dark mode"}
            >
              {dashboardTheme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
              <span>{dashboardTheme === "dark" ? "Dark mode" : "Light mode"}</span>
            </button>
            <div className="profile-chip">
              <button
                type="button"
                className="profile-chip-main"
                onClick={() => {
                  setProfileOpen(false);
                  setProfileCardOpen(true);
                }}
                aria-label="ดูบัตรโปรไฟล์"
                title="ดูบัตรโปรไฟล์"
              >
                <Avatar image={currentUser?.avatar} name={currentUser?.name || currentUser?.username} size="sm" />
                <span>
                  <strong>{currentUser?.name || currentUser?.username}</strong>
                  <small>{currentUser?.email || currentUser?.username}</small>
                </span>
              </button>
              <div className="profile-actions">
                <button
                  type="button"
                  className="profile-action-edit"
                  onClick={() => {
                    setProfileCardOpen(false);
                    setProfileOpen((open) => !open);
                  }}
                  title="แก้ไขโปรไฟล์"
                >
                  <Edit size={16} />
                  <span>แก้ไข</span>
                </button>
                <button
                  type="button"
                  className="profile-action-logout"
                  onClick={confirmLogout}
                  title="ออกจากระบบ"
                >
                  <LogOut size={16} />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
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

        {profileCardOpen && (
          <ProfileCardModal
            user={currentUser}
            onClose={() => setProfileCardOpen(false)}
            onEdit={() => {
              setProfileCardOpen(false);
              setProfileOpen(true);
            }}
          />
        )}
        {confirmModal}

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
            theme={dashboardTheme}
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

        {activeTab === "transfer" && (
          <TransferSection
            years={years}
            fruits={fruits}
            farmers={farmers}
            onRefresh={loadData}
          />
        )}
      </section>
    </main>
  );
}

const landingNavItems = [
  { key: "home", label: "Home" },
  { key: "mission", label: "Mission" },
  { key: "dashboard", label: "Preview" },
  { key: "project", label: "Project" },
];

function LandingPage() {
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const sections = landingNavItems
      .map((item) => document.getElementById(item.key))
      .filter(Boolean);

    if (!sections.length) return undefined;

    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const marker = Math.min(window.innerHeight * 0.42, 420);
      let current = sections[0].id;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= marker) {
          current = section.id;
        }
      });

      setActiveSection(current);
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <div className="brand-block">
          <span className="brand-mark"><Leaf size={24} /></span>
          <div>
            <strong>HarvestData</strong>
            <small>Fruit Harvest Intelligence</small>
          </div>
        </div>
        <nav className="landing-menu" aria-label="Landing sections">
          {landingNavItems.map((item) => (
            <a
              key={item.key}
              href={`#${item.key}`}
              className={activeSection === item.key ? "landing-menu-active" : undefined}
              aria-current={activeSection === item.key ? "location" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <Link href="/login" className="landing-login-button">เข้าสู่ระบบ</Link>
      </header>
      <section className="landing-hero" id="home">
        <div className="landing-copy">
          <p className="eyebrow">Digital Agriculture Solution</p>
          <h1>Fruit Harvest Intelligence</h1>
          <p>
            แพลตฟอร์มข้อมูลสวนผลไม้ที่รวมผลผลิต แปลงปลูก รายได้ และมุมมองรายปีไว้ในภาพเดียว
            เพื่อให้ทีมสวนตัดสินใจจากข้อมูลที่ชัดขึ้น
          </p>
          <div className="landing-actions">
            <Link href="/login" className="landing-primary-action">เข้าสู่แดชบอร์ด</Link>
            <a href="#dashboard" className="landing-secondary-action">ดูตัวอย่าง Dashboard</a>
          </div>
        </div>
        <div className="landing-hero-preview" aria-hidden="true">
          <img src="/landing/dashboard-preview.png" alt="" />
        </div>
        <div className="landing-hero-meta" aria-label="HarvestData highlights">
          <span><ShieldCheck size={18} /> Secure farm records</span>
          <span><MapPinned size={18} /> Province-level context</span>
          <span><ChartNoAxesCombined size={18} /> Yield trends</span>
        </div>
      </section>
      <section className="landing-impact" id="mission">
        <div className="landing-impact-heading">
          <p className="eyebrow">Mission</p>
          <h2>ข้อมูลเก็บเกี่ยวรายปี</h2>
        </div>
        <div className="landing-impact-grid" id="signals">
          <article>
            <span className="landing-impact-number">01</span>
            <i className="landing-impact-icon"><BarChart3 size={34} /></i>
            <strong>Yield Monitoring</strong>
            <p>ติดตามผลผลิตรวมและแนวโน้มรายปีของสวนผลไม้แต่ละชนิด</p>
          </article>
          <article>
            <span className="landing-impact-number">02</span>
            <i className="landing-impact-icon"><MapPinned size={34} /></i>
            <strong>Farm Network</strong>
            <p>เชื่อมข้อมูลเกษตรกร แปลงปลูก และตำแหน่งจังหวัดในมุมเดียว</p>
          </article>
          <article id="network">
            <span className="landing-impact-number">03</span>
            <i className="landing-impact-icon"><TrendingUp size={34} /></i>
            <strong>Harvest Decisions</strong>
            <p>ดูราคาเฉลี่ย รายได้ และกิจกรรมล่าสุดเพื่อวางแผนฤดูกาลถัดไป</p>
          </article>
        </div>
      </section>
      <section className="landing-dashboard-showcase" id="dashboard">
        <div className="landing-dashboard-copy">
          <p className="eyebrow">Dashboard Preview</p>
          <h2>เห็นภาพผลผลิต รายได้ และแปลงปลูกได้ทันที</h2>
          <p>
            HarvestData dashboard ช่วยสรุปข้อมูลสำคัญของสวนผลไม้ให้อยู่ในหน้าจอเดียว
            ทั้งยอดผลผลิตรวม รายได้ แนวโน้มรายปี สัดส่วนผลไม้ และรายการล่าสุด
            เพื่อให้ติดตามงานได้เร็วขึ้นและตัดสินใจจากข้อมูลจริง
          </p>
          <div className="landing-dashboard-points" aria-label="Dashboard selling points">
            <span><Activity size={18} /> สรุปตัวเลขหลักของสวนแบบ real-time</span>
            <span><MapPinned size={18} /> ดูเกษตรกรและแปลงปลูกเชื่อมกับพื้นที่</span>
            <span><TrendingUp size={18} /> วิเคราะห์แนวโน้มผลผลิตและรายได้รายปี</span>
          </div>
          <Link href="/login" className="landing-dashboard-action">ลองเข้าใช้งาน Dashboard</Link>
        </div>
        <div className="landing-product-stage" aria-label="HarvestData dashboard previews">
          <div className="landing-product-heading">
            <span>HarvestData Dashboard</span>
            <h3>Dark, Light & Mobile</h3>
            <p>Preview the real dashboard experience across desktop and mobile layouts.</p>
          </div>
          <div className="landing-product-devices">
            <figure className="landing-device landing-device-desktop">
              <span>Dark mode</span>
              <img src="/landing/dashboard-preview.png" alt="HarvestData dashboard in dark mode on desktop" />
            </figure>
            <figure className="landing-device landing-device-light">
              <span>Light mode</span>
              <img src="/landing/dashboard-light-preview.png" alt="HarvestData dashboard in light mode on desktop" />
            </figure>
            <figure className="landing-device landing-device-mobile">
              <span>Mobile</span>
              <img src="/landing/dashboard-mobile-preview.png" alt="HarvestData dashboard on a mobile viewport" />
            </figure>
          </div>
        </div>
      </section>
      <footer className="landing-footer" id="project">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <p className="eyebrow">Graduation Project</p>
            <strong>HarvestData</strong>
            <span>Fruit Harvest Intelligence Dashboard</span>
          </div>
          <div className="landing-footer-details">
            <p>A graduation project developed for the Software Engineering Program.</p>
            <div className="landing-footer-grid" aria-label="Academic project details">
              <span>
                <small>University</small>
                <b>University of Phayao</b>
              </span>
              <span>
                <small>Faculty</small>
                <b>School of Information and Communication Technology</b>
              </span>
              <span>
                <small>Academic Year</small>
                <b>2019</b>
              </span>
            </div>
          </div>
          <div className="landing-footer-author">
            <small>Prepared by</small>
            <strong>Nutthapong Patchotchai</strong>
          </div>
        </div>
      </footer>
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

function ProfileCardModal({ user, onClose, onEdit }) {
  const displayName = user?.name || user?.username || "HarvestData User";
  const contactEmail = user?.email || user?.username || "ยังไม่ระบุ";
  const contactPhone = user?.phone || "ยังไม่ระบุ";

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="profile-card-backdrop" role="dialog" aria-modal="true" aria-label="บัตรโปรไฟล์" onClick={onClose}>
      <article className="profile-card-preview" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="profile-card-close" onClick={onClose} title="ปิด">
          <X size={18} />
        </button>
        <div className="profile-card-hero">
          <div className="profile-card-brand">
            <span className="profile-card-logo"><Leaf size={21} /></span>
            <div>
              <strong>HarvestData</strong>
              <small>Fruit harvest management</small>
            </div>
          </div>
        </div>
        <div className="profile-card-avatar-ring">
          <Avatar image={user?.avatar} name={displayName} size="lg" />
        </div>
        <div className="profile-card-body">
          <h3>{displayName}</h3>
          <dl className="profile-card-details">
            <div>
              <dt>Email</dt>
              <dd>{contactEmail}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{contactPhone}</dd>
            </div>
          </dl>
          <button type="button" className="profile-card-edit" onClick={onEdit}>
            <Edit size={16} />แก้ไขโปรไฟล์
          </button>
        </div>
      </article>
    </div>
  );
}

function PopupModal({ eyebrow, title, children, footer, onClose, variant = "", size = "" }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="popup-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <article
        className={`popup-dialog ${variant ? `popup-dialog-${variant}` : ""} ${size ? `popup-dialog-${size}` : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="popup-close" onClick={onClose} title="ปิด">
          <X size={18} />
        </button>
        <header className="popup-header">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h3>{title}</h3>
        </header>
        <div className="popup-body">{children}</div>
        {footer && <footer className="popup-actions">{footer}</footer>}
      </article>
    </div>
  );
}

function ConfirmDialog({
  title = "ยืนยันการทำงาน",
  description,
  details = [],
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  variant = "default",
  onConfirm,
  onClose,
}) {
  return (
    <PopupModal
      eyebrow="Confirmation"
      title={title}
      variant={variant}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="ghost-button" onClick={onClose}>{cancelLabel}</button>
          <button type="button" className={variant === "danger" ? "popup-danger-action" : "transfer-primary-button"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      )}
    >
      {description && <p className="popup-copy">{description}</p>}
      {!!details.length && (
        <ul className="popup-detail-list">
          {details.map((detail) => <li key={detail}>{detail}</li>)}
        </ul>
      )}
    </PopupModal>
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
  const [selectedHarvestYear, setSelectedHarvestYear] = useState(null);
  const [selectedProductShare, setSelectedProductShare] = useState(null);
  const chartTick = { fill: "var(--chart-tick)", fontSize: 12 };
  const chartTooltipStyle = {
    border: "1px solid var(--chart-tooltip-border)",
    borderRadius: 8,
    padding: "8px 10px",
    color: "var(--ink)",
    background: "var(--chart-tooltip-bg)",
    boxShadow: "var(--chart-tooltip-shadow)",
  };
  const chartLegendStyle = { paddingTop: 4, color: "var(--chart-tick)", fontSize: 12 };
  const chartActiveDot = { r: 5, strokeWidth: 2, fill: "var(--chart-dot-fill)" };
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
  const productTotals = dashboard.product_trends.reduce((totalMap, item) => {
    const current = totalMap.get(item.product_name) || 0;
    totalMap.set(item.product_name, current + Number(item.quantity_kg || 0));
    return totalMap;
  }, new Map());
  const productSeries = Array.from(
    new Map(
      dashboard.product_trends.map((item) => [
        item.product_name,
        {
          name: item.product_name,
          color: item.color || "#6f9f83",
          total: productTotals.get(item.product_name) || 0,
        },
      ])
    ).values()
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const visibleProductNames = new Set(productSeries.map((product) => product.name));
  const productTrendData = Array.from(
    dashboard.product_trends.reduce((yearMap, item) => {
      const existing = yearMap.get(item.year) || { year: item.year };
      if (visibleProductNames.has(item.product_name)) {
        existing[item.product_name] = item.quantity_kg;
      }
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
    .filter((item) => item.quantity_kg > 0)
    .sort((a, b) => b.quantity_kg - a.quantity_kg);
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
  const selectedYearSummary = selectedHarvestYear
    ? dashboard.harvest_by_year.find((item) => String(item.year) === String(selectedHarvestYear.year))
    : null;
  const selectedYearProducts = selectedHarvestYear
    ? dashboard.product_trends
        .filter((item) => String(item.year) === String(selectedHarvestYear.year))
        .sort((a, b) => Number(b.quantity_kg || 0) - Number(a.quantity_kg || 0))
        .slice(0, 8)
    : [];

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
        <div className="line-chart-wrap compact-chart-wrap">
          {!!chartData.length && (
            <ResponsiveContainer width="100%" height={248}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 2 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 8" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={chartTick} tickMargin={8} />
                <YAxis
                  yAxisId="quantity"
                  axisLine={false}
                  tickLine={false}
                  tick={chartTick}
                  tickCount={4}
                  width={46}
                  tickFormatter={(value) => `${formatNumber(value / 1000, 1)}k`}
                />
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={chartTick}
                  tickCount={4}
                  width={48}
                  tickFormatter={(value) => `${formatNumber(value)}฿`}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value, name) => {
                    if (name === "ผลผลิตรวม") return [`${formatNumber(value, 2)} กก.`, name];
                    return [`${formatCurrency(value)}/กก.`, name];
                  }}
                />
                <Legend iconType="circle" wrapperStyle={chartLegendStyle} />
                <Line
                  yAxisId="quantity"
                  type="monotone"
                  dataKey="quantity_kg"
                  name="ผลผลิตรวม"
                  stroke="var(--chart-primary)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={chartActiveDot}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="average_price"
                  name="ราคาเฉลี่ย"
                  stroke="var(--chart-secondary)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={chartActiveDot}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {!dashboard.harvest_by_year.length && <p className="empty-state">ยังไม่มีข้อมูลเก็บเกี่ยว</p>}
        </div>
        <div className="year-chart compact-trend">
          {dashboard.harvest_by_year.map((item) => (
            <button type="button" className="year-row chart-drill-row" key={item.year} onClick={() => setSelectedHarvestYear(item)}>
              <span>{item.year}</span>
              <div className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: `${Math.max((item.quantity_kg / maxYearQuantity) * 100, 8)}%` }}
                />
              </div>
              <strong>{formatNumber(item.quantity_kg)} กก.</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="panel chart-panel product-trend-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Product Trends</p>
            <h3>แนวโน้มผลผลิต Top 6 รายปี</h3>
          </div>
          <span className="panel-icon"><Sprout size={20} /></span>
        </div>
        <div className="line-chart-wrap compact-chart-wrap product-line-chart">
          {!!productTrendData.length && (
            <ResponsiveContainer width="100%" height={248}>
              <LineChart data={productTrendData} margin={{ top: 8, right: 8, left: -8, bottom: 2 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 8" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={chartTick} tickMargin={8} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={chartTick}
                  tickCount={4}
                  width={46}
                  tickFormatter={(value) => `${formatNumber(value / 1000, 1)}k`}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value, name) => [`${formatNumber(value, 2)} กก.`, name]}
                />
                <Legend iconType="circle" wrapperStyle={chartLegendStyle} />
                {productSeries.map((product) => (
                  <Line
                    key={product.name}
                    type="monotone"
                    dataKey={product.name}
                    name={product.name}
                    stroke={product.color}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={chartActiveDot}
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
                <ResponsiveContainer width="100%" height={238}>
                  <PieChart>
                    <Pie
                      data={productShareData}
                      dataKey="quantity_kg"
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={86}
                      paddingAngle={2}
                      stroke="var(--chart-pie-stroke)"
                      strokeWidth={2}
                      onClick={(slice) => setSelectedProductShare(slice?.payload || slice)}
                    >
                      {productShareData.map((item) => (
                        <Cell key={item.id || item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
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
              <button type="button" className="product-share-row" key={item.id || item.name} onClick={() => setSelectedProductShare(item)}>
                <span className="fruit-swatch" style={{ backgroundColor: item.color }} />
                <div>
                  <strong>{item.name}</strong>
                  <small>{formatNumber(item.quantity_kg, 2)} กก.</small>
                </div>
                <b>{formatNumber(item.percent, 1)}%</b>
              </button>
            ))}
          </div>
        </div>
      </section>

      {selectedHarvestYear && (
        <PopupModal
          eyebrow="Year Drill-down"
          title={`ภาพรวมปี ${selectedHarvestYear.year}`}
          onClose={() => setSelectedHarvestYear(null)}
          size="wide"
        >
          <div className="popup-stat-grid">
            <div><b>{formatNumber(selectedYearSummary?.quantity_kg, 2)} กก.</b><span>ผลผลิตรวม</span></div>
            <div><b>{formatCurrency(selectedYearSummary?.revenue)}</b><span>รายได้รวม</span></div>
            <div><b>{formatCurrency(selectedYearSummary?.average_price)}</b><span>ราคาเฉลี่ย/กก.</span></div>
          </div>
          <div className="popup-section">
            <strong>ผลผลิตหลักในปีนี้</strong>
            <div className="popup-data-preview">
              {selectedYearProducts.map((item) => (
                <div key={`${item.product_id}-${item.product_name}`}>
                  <dt>{item.product_name}</dt>
                  <dd>{formatNumber(item.quantity_kg, 2)} กก. / {formatCurrency(item.revenue)}</dd>
                </div>
              ))}
              {!selectedYearProducts.length && <p className="empty-state">ยังไม่มีข้อมูลรายผลไม้ในปีนี้</p>}
            </div>
          </div>
        </PopupModal>
      )}

      {selectedProductShare && (
        <PopupModal
          eyebrow="Product Share"
          title={`${selectedProductShare.name} ปี ${selectedProductShareYear}`}
          onClose={() => setSelectedProductShare(null)}
        >
          <div className="popup-stat-grid">
            <div><b>{formatNumber(selectedProductShare.percent, 1)}%</b><span>สัดส่วนผลผลิต</span></div>
            <div><b>{formatNumber(selectedProductShare.quantity_kg, 2)} กก.</b><span>ผลผลิต</span></div>
            <div><b>{formatCurrency(selectedProductShare.revenue)}</b><span>รายได้</span></div>
          </div>
        </PopupModal>
      )}

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
        <div className="line-chart-wrap compact-chart-wrap">
          {!!farmerProductData.length && (
            <ResponsiveContainer width="100%" height={248}>
              <ComposedChart data={farmerProductData} margin={{ top: 8, right: 8, left: -8, bottom: 2 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 8" vertical={false} />
                <XAxis dataKey="product" axisLine={false} tickLine={false} tick={chartTick} tickMargin={8} minTickGap={14} />
                <YAxis
                  yAxisId="quantity"
                  axisLine={false}
                  tickLine={false}
                  tick={chartTick}
                  tickCount={4}
                  width={46}
                  tickFormatter={(value) => `${formatNumber(value / 1000, 1)}k`}
                />
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={chartTick}
                  tickCount={4}
                  width={48}
                  tickFormatter={(value) => `${formatNumber(value)}฿`}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value, name) => {
                    if (name === "ผลผลิต") return [`${formatNumber(value, 2)} กก.`, name];
                    return [`${formatCurrency(value)}/กก.`, name];
                  }}
                />
                <Legend iconType="circle" wrapperStyle={chartLegendStyle} />
                <Bar
                  yAxisId="quantity"
                  dataKey="quantity_kg"
                  name="ผลผลิต"
                  fill="var(--chart-primary)"
                  radius={[6, 6, 0, 0]}
                  barSize={34}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="average_price"
                  name="ราคาเฉลี่ย"
                  stroke="var(--chart-tertiary)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={chartActiveDot}
                />
              </ComposedChart>
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

function ThailandPlantingMap({ plantings, harvests, theme }) {
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
  const [selectedProvince, setSelectedProvince] = useState(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const maxMetric = d3.max(provinceGroups, (group) => group.quantity || group.count) || 1;
    const themeStyles = getComputedStyle(mapWrapRef.current || document.documentElement);
    const mapStart = themeStyles.getPropertyValue("--map-scale-start").trim() || "#a6c5a1";
    const mapEnd = themeStyles.getPropertyValue("--map-scale-end").trim() || "#2f604d";
    const colorScale = d3.scaleSequential()
      .domain([0, maxMetric])
      .interpolator(d3.interpolateRgb(mapStart, mapEnd));

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

    function openProvince(location) {
      const group = provinceGroups.find((item) => item.mapName === location.name) || null;
      setSelectedProvince({
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
        if (!group) return "var(--map-empty)";
        return colorScale(group.quantity || group.count);
      })
      .attr("stroke", "var(--map-stroke)")
      .attr("stroke-width", 1.1)
      .on("mouseenter", showTooltip)
      .on("mousemove", showTooltip)
      .on("focus", showTooltip)
      .on("click", (event, location) => openProvince(location))
      .on("keydown", (event, location) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProvince(location);
        }
      })
      .on("mouseleave blur", () => {
        setTooltip((current) => ({ ...current, visible: false }));
      });
  }, [provinceGroupMap, provinceGroups, theme]);

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
            <button type="button" className="map-location-row" key={group.province} onClick={() => setSelectedProvince({ province: group.province, group })}>
              <strong>{group.province}</strong>
              <small>{group.farmers.map((farmer) => `${farmer.name}: ${farmer.crops.join(", ")}`).join(" / ")}</small>
              <span>{formatNumber(group.count)} แปลง / {formatNumber(group.area, 2)} ไร่ / {formatNumber(group.quantity, 2)} กก.</span>
            </button>
          ))}
          {!provinceGroups.length && <p className="empty-state">ยังไม่มีข้อมูลจังหวัดของแปลงปลูก</p>}
        </div>
      </div>
      {selectedProvince && (
        <PopupModal
          eyebrow="Province Drill-down"
          title={selectedProvince.province}
          onClose={() => setSelectedProvince(null)}
          size="wide"
        >
          {selectedProvince.group ? (
            <>
              <div className="popup-stat-grid">
                <div><b>{formatNumber(selectedProvince.group.count)}</b><span>แปลง</span></div>
                <div><b>{formatNumber(selectedProvince.group.area, 2)} ไร่</b><span>พื้นที่ปลูก</span></div>
                <div><b>{formatNumber(selectedProvince.group.quantity, 2)} กก.</b><span>ผลผลิตรวม</span></div>
                <div><b>{formatCurrency(selectedProvince.group.revenue)}</b><span>รายได้รวม</span></div>
              </div>
              <div className="popup-section">
                <strong>เกษตรกรและผลไม้</strong>
                <div className="popup-data-preview">
                  {selectedProvince.group.farmers.slice(0, 10).map((farmer) => (
                    <div key={farmer.name}>
                      <dt>{farmer.name}</dt>
                      <dd>{farmer.crops.join(", ")} / {formatNumber(farmer.quantity, 2)} กก.</dd>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="popup-copy">ยังไม่มีข้อมูลแปลงปลูกในจังหวัดนี้</p>
          )}
        </PopupModal>
      )}
    </div>
  );
}

function PlantingsSection({ plantings, harvests, farmers, fruits, theme, form, setForm, editingId, onSubmit, onEdit, onDelete, onCancel }) {
  const formDisabled = !farmers.length || !fruits.length;
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const pageCount = Math.max(Math.ceil(plantings.length / pageSize), 1);
  const currentPage = Math.min(page, pageCount);
  const pagedPlantings = plantings.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="management-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">แปลงและสายพันธุ์</p>
            <h3>ข้อมูลการปลูก</h3>
          </div>
        </div>
        <ThailandPlantingMap plantings={plantings} harvests={harvests} theme={theme} />
        <div className="planting-grid">
          {pagedPlantings.map((planting) => (
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
        {plantings.length > pageSize && (
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
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const pageCount = Math.max(Math.ceil(harvests.length / pageSize), 1);
  const currentPage = Math.min(page, pageCount);
  const pagedHarvests = harvests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="กรองตามปี"
              value={yearFilter}
              onChange={(event) => {
                setYearFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">ทุกปี</option>
              {years.map((year) => (
                <option key={year.id} value={year.year}>{year.year}</option>
              ))}
            </select>
          </div>
        </div>
        <HarvestTable rows={pagedHarvests} onEdit={onEdit} onDelete={onDelete} />
        {harvests.length > pageSize && (
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

function TransferSection({ years, fruits, farmers, onRefresh }) {
  const [importDataset, setImportDataset] = useState("farmers");
  const [importFile, setImportFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [specOpen, setSpecOpen] = useState(false);
  const [commitConfirmOpen, setCommitConfirmOpen] = useState(false);
  const [selectedImportRow, setSelectedImportRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportDataset, setExportDataset] = useState("all");
  const [exportYear, setExportYear] = useState("all");
  const [exportFruit, setExportFruit] = useState("all");
  const [exportFarmer, setExportFarmer] = useState("all");
  const selectedImportLabel = transferDatasets.find((item) => item.key === importDataset)?.label;
  const previewRows = preview?.rows || [];
  const errorRows = previewRows.filter((row) => row.status === "error");

  async function handleTemplateDownload() {
    try {
      await downloadDataFile("/data-transfer/template/");
      toast.success("ดาวน์โหลดไฟล์ตัวอย่างแล้ว");
    } catch (error) {
      toast.error(`ดาวน์โหลด template ไม่สำเร็จ: ${error.message}`);
    }
  }

  async function submitImport(commit = false) {
    if (!importFile) {
      toast.error("เลือกไฟล์ CSV ก่อน");
      return;
    }

    const formData = new FormData();
    formData.append("dataset", importDataset);
    formData.append("file", importFile);
    formData.append("commit", commit ? "true" : "false");

    setLoading(true);
    try {
      const result = await dataTransferRequest(formData);
      setPreview(result);
      if (commit) {
        await onRefresh();
        toast.success(`นำเข้าสำเร็จ ${formatNumber(result.summary.valid_rows)} แถว`);
      } else {
        toast.success(`ตรวจไฟล์แล้ว: ผ่าน ${formatNumber(result.summary.valid_rows)} แถว / error ${formatNumber(result.summary.error_rows)} แถว`);
      }
    } catch (error) {
      const limits = error.payload?.limits;
      const limitText = limits
        ? ` ไม่เกิน ${formatNumber(limits.max_rows)} แถว / ${limits.max_file_size_mb}MB`
        : "";
      toast.error(`นำเข้าไฟล์ไม่สำเร็จ: ${error.message}${limitText}`);
    } finally {
      setLoading(false);
    }
  }

  function handleErrorReportDownload() {
    if (!errorRows.length) {
      toast.info("ไม่มี error ให้ดาวน์โหลด");
      return;
    }

    downloadTextFile(`harvestdata-${importDataset}-import-errors.csv`, importErrorReportCsv(preview));
    toast.success("ดาวน์โหลดรายงาน error แล้ว");
  }

  async function handleExport() {
    const params = new URLSearchParams({ dataset: exportDataset });
    if (exportYear !== "all") params.set("year", exportYear);
    if (exportFruit !== "all") params.set("fruit", exportFruit);
    if (exportFarmer !== "all") params.set("farmer", exportFarmer);

    try {
      await downloadDataFile(`/data-transfer/export/?${params.toString()}`);
      toast.success("ส่งออกข้อมูลแล้ว");
    } catch (error) {
      toast.error(`ส่งออกข้อมูลไม่สำเร็จ: ${error.message}`);
    }
  }

  return (
    <div className="transfer-layout">
      <section className="panel transfer-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Bulk Import</p>
            <h3>นำเข้าข้อมูลจำนวนมาก</h3>
          </div>
          <span className="panel-icon"><Upload size={20} /></span>
        </div>

        <div className="transfer-actions">
          <button type="button" className="ghost-button" onClick={handleTemplateDownload}>
            <Save size={16} />ดาวน์โหลดไฟล์ตัวอย่าง
          </button>
          <button type="button" className="ghost-button" onClick={() => setSpecOpen(true)}>
            <Search size={16} />ดูรูปแบบไฟล์
          </button>
        </div>

        <p className="transfer-note compact">ดาวน์โหลด template แล้ว clean data ให้ตรงรูปแบบ ก่อนกดตรวจไฟล์เพื่อนำเข้าจริง</p>

        <div className="transfer-form">
          <SelectField label="ประเภทข้อมูล" value={importDataset} onChange={(value) => {
            setImportDataset(value);
            setPreview(null);
          }}>
            {transferDatasets.map((dataset) => (
              <option key={dataset.key} value={dataset.key}>{dataset.label}</option>
            ))}
          </SelectField>
          <label className="file-field">
            ไฟล์ CSV สำหรับ {selectedImportLabel}
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] || null);
                setPreview(null);
              }}
            />
          </label>
        </div>

        <div className="transfer-actions">
          <button type="button" className="ghost-button" onClick={() => submitImport(false)} disabled={loading || !importFile}>
            <Search size={16} />ตรวจไฟล์ก่อนนำเข้า
          </button>
          <button
            type="button"
            className="transfer-primary-button"
            onClick={() => setCommitConfirmOpen(true)}
            disabled={loading || !importFile || !preview?.summary?.valid_rows}
          >
            <Upload size={16} />นำเข้าแถวที่ผ่าน
          </button>
        </div>

        {preview && (
          <div className="import-preview">
            <div className="preview-summary">
              <span>ทั้งหมด <strong>{formatNumber(preview.summary.total_rows)}</strong></span>
              <span>ผ่าน <strong>{formatNumber(preview.summary.valid_rows)}</strong></span>
              <span>error <strong>{formatNumber(preview.summary.error_rows)}</strong></span>
              {!!preview.summary.skipped_blank_rows && (
                <span>ข้ามแถวว่าง <strong>{formatNumber(preview.summary.skipped_blank_rows)}</strong></span>
              )}
            </div>
            {!!errorRows.length && (
              <div className="transfer-actions preview-actions">
                <button type="button" className="ghost-button" onClick={handleErrorReportDownload}>
                  <Save size={16} />ดาวน์โหลดรายงาน error
                </button>
              </div>
            )}
            <div className="table-wrap">
              <table className="import-preview-table">
                <thead>
                  <tr>
                    <th>แถว</th>
                    <th>สถานะ</th>
                    <th>การทำงาน</th>
                    <th>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 12).map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td><span className={`import-status ${row.status}`}>{row.status === "valid" ? "ผ่าน" : "error"}</span></td>
                      <td>{row.action || "-"}</td>
                      <td>
                        {row.errors.length ? (
                          <button type="button" className="inline-link-button" onClick={() => setSelectedImportRow(row)}>
                            ดู error {row.errors.length} จุด
                          </button>
                        ) : (
                          "พร้อมนำเข้า"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewRows.length > 12 && <p className="empty-state">แสดงตัวอย่าง 12 แถวแรกจากทั้งหมด {formatNumber(previewRows.length)} แถว</p>}
          </div>
        )}

        {specOpen && (
          <PopupModal eyebrow="Import Template" title="รูปแบบไฟล์ที่นำเข้าได้" onClose={() => setSpecOpen(false)} size="wide">
            <div className="popup-section">
              <strong>ลำดับการนำเข้า</strong>
              <p>เริ่มจากเกษตรกร → แปลงปลูก → ผลผลิตเก็บเกี่ยว เพื่อให้ระบบจับคู่ข้อมูลได้ถูกต้อง</p>
            </div>
            <div className="popup-stat-grid">
              <div><b>farmers.csv</b><span>first_name, last_name, age, phone, village, address</span></div>
              <div><b>plantings.csv</b><span>farmer_first_name, fruit_name, variety, area_rai, province...</span></div>
              <div><b>harvests.csv</b><span>farmer_first_name, fruit_name, year, quantity_kg, price_per_kg...</span></div>
            </div>
            <ul className="popup-detail-list">
              <li>ชื่อคอลัมน์ต้องตรงกับ template ทุกตัว</li>
              <li>วันที่ใช้รูปแบบ YYYY-MM-DD เช่น 2026-05-03</li>
              <li>ตัวเลขใส่เฉพาะเลข ไม่ต้องใส่หน่วย เช่น 1250.50</li>
              <li>fruit_name และ year ต้องมีอยู่ใน master data ก่อน</li>
              <li>ควรใส่ farmer_phone เพื่อจับคู่เกษตรกรไม่ให้กำกวม</li>
            </ul>
          </PopupModal>
        )}

        {commitConfirmOpen && preview && (
          <ConfirmDialog
            title="ยืนยันนำเข้าข้อมูล"
            description={`ระบบจะนำเข้าเฉพาะแถวที่ผ่าน validation ของชุดข้อมูล ${selectedImportLabel}`}
            details={[
              `ผ่าน ${formatNumber(preview.summary.valid_rows)} แถว`,
              `มี error ${formatNumber(preview.summary.error_rows)} แถว และจะไม่ถูกนำเข้า`,
              `การทำงาน: ${Object.entries(preview.summary.actions || {}).map(([name, count]) => `${name} ${formatNumber(count)}`).join(", ") || "ไม่มี"}`,
            ]}
            confirmLabel="นำเข้าข้อมูล"
            onClose={() => setCommitConfirmOpen(false)}
            onConfirm={async () => {
              setCommitConfirmOpen(false);
              await submitImport(true);
            }}
          />
        )}

        {selectedImportRow && (
          <PopupModal eyebrow="Import Error" title={`รายละเอียดแถว ${selectedImportRow.row}`} onClose={() => setSelectedImportRow(null)}>
            <ul className="popup-detail-list error-list">
              {selectedImportRow.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
            <div className="popup-data-preview">
              {Object.entries(selectedImportRow.data || {}).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value ?? "-")}</dd>
                </div>
              ))}
            </div>
          </PopupModal>
        )}
      </section>

      <section className="panel transfer-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Export</p>
            <h3>ส่งออกข้อมูลไปใช้ต่อ</h3>
          </div>
          <span className="panel-icon"><Save size={20} /></span>
        </div>

        <div className="transfer-form export-form">
          <SelectField label="ชุดข้อมูล" value={exportDataset} onChange={setExportDataset}>
            <option value="all">ทั้งหมด ZIP</option>
            {transferDatasets.map((dataset) => (
              <option key={dataset.key} value={dataset.key}>{dataset.label}</option>
            ))}
          </SelectField>
          <SelectField label="ปี" value={exportYear} onChange={setExportYear}>
            <option value="all">ทุกปี</option>
            {years.map((year) => (
              <option key={year.id} value={year.year}>{year.year}</option>
            ))}
          </SelectField>
          <SelectField label="ผลไม้" value={exportFruit} onChange={setExportFruit}>
            <option value="all">ทุกผลไม้</option>
            {fruits.map((fruit) => (
              <option key={fruit.id} value={fruit.id}>{fruit.name}</option>
            ))}
          </SelectField>
          <SelectField label="เกษตรกร" value={exportFarmer} onChange={setExportFarmer}>
            <option value="all">ทุกคน</option>
            {farmers.map((farmer) => (
              <option key={farmer.id} value={farmer.id}>{farmer.full_name}</option>
            ))}
          </SelectField>
        </div>
        <button type="button" className="transfer-primary-button" onClick={handleExport}>
          <Save size={16} />ส่งออกไฟล์
        </button>
        <p className="transfer-note">
          Export จะได้ CSV หรือ ZIP ที่เปิดต่อใน Excel/Google Sheets ได้ เหมาะสำหรับตรวจสอบและ clean data ก่อนนำกลับเข้าใหม่
        </p>
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
