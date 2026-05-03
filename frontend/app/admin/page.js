"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Edit,
  ImagePlus,
  Leaf,
  LogOut,
  Save,
  ShieldCheck,
  Sprout,
  Trash2,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

const emptyYearForm = { year: "" };
const emptyFruitForm = { name: "", category: "", color: "#6f9f83" };

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
    throw new Error(detail);
  }

  return payload?.results || payload;
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

export default function AdminPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);
  const [profileForm, setProfileForm] = useState(profileFormFromUser(null));
  const [years, setYears] = useState([]);
  const [fruits, setFruits] = useState([]);
  const [yearForm, setYearForm] = useState(emptyYearForm);
  const [fruitForm, setFruitForm] = useState(emptyFruitForm);
  const [editingYearId, setEditingYearId] = useState(null);
  const [editingFruitId, setEditingFruitId] = useState(null);

  const loadMasterData = useCallback(async () => {
    const [yearRows, fruitRows] = await Promise.all([
      apiRequest("/years/"),
      apiRequest("/fruits/"),
    ]);
    setYears(yearRows || []);
    setFruits(fruitRows || []);
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
        if (!user?.is_admin) {
          router.replace("/");
          return;
        }

        setCurrentUser(user);
        setProfileForm(profileFormFromUser(user));
        setAuthState("ready");
        await loadMasterData();
      } catch (error) {
        if (mounted) router.replace("/login");
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadMasterData, router]);

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
      toast.success("อัปเดตโปรไฟล์ admin แล้ว");
    } catch (error) {
      toast.error(`บันทึกโปรไฟล์ไม่สำเร็จ: ${error.message}`);
    }
  }

  async function handleYearSubmit(event) {
    event.preventDefault();

    try {
      const payload = { year: Number(yearForm.year) };
      const path = editingYearId ? `/years/${editingYearId}/` : "/years/";
      const method = editingYearId ? "PATCH" : "POST";
      await apiRequest(path, { method, body: payload });
      setYearForm(emptyYearForm);
      setEditingYearId(null);
      await loadMasterData();
      toast.success(editingYearId ? "แก้ไขปีแล้ว" : "เพิ่มปีแล้ว");
    } catch (error) {
      toast.error(`บันทึกปีไม่สำเร็จ: ${error.message}`);
    }
  }

  function editYear(year) {
    setEditingYearId(year.id);
    setYearForm({ year: year.year });
  }

  function deleteYear(year) {
    confirmDelete(`ลบปี ${year.year} ?`, async () => {
      try {
        await apiRequest(`/years/${year.id}/`, { method: "DELETE" });
        await loadMasterData();
        toast.success("ลบปีแล้ว");
      } catch (error) {
        toast.error(`ลบปีไม่สำเร็จ: ${error.message}`);
      }
    });
  }

  async function handleFruitSubmit(event) {
    event.preventDefault();

    try {
      const path = editingFruitId ? `/fruits/${editingFruitId}/` : "/fruits/";
      const method = editingFruitId ? "PATCH" : "POST";
      await apiRequest(path, { method, body: fruitForm });
      setFruitForm(emptyFruitForm);
      setEditingFruitId(null);
      await loadMasterData();
      toast.success(editingFruitId ? "แก้ไขผลไม้แล้ว" : "เพิ่มผลไม้แล้ว");
    } catch (error) {
      toast.error(`บันทึกผลไม้ไม่สำเร็จ: ${error.message}`);
    }
  }

  function editFruit(fruit) {
    setEditingFruitId(fruit.id);
    setFruitForm({
      name: fruit.name,
      category: fruit.category || "",
      color: fruit.color || "#6f9f83",
    });
  }

  function deleteFruit(fruit) {
    confirmDelete(`ลบผลไม้ ${fruit.name} ?`, async () => {
      try {
        await apiRequest(`/fruits/${fruit.id}/`, { method: "DELETE" });
        await loadMasterData();
        toast.success("ลบผลไม้แล้ว");
      } catch (error) {
        toast.error(`ลบผลไม้ไม่สำเร็จ: ${error.message}`);
      }
    });
  }

  if (authState !== "ready") {
    return (
      <main className="loading-page">
        <section className="login-panel">
          <p className="eyebrow">HarvestData Admin</p>
          <h1>กำลังตรวจสอบสิทธิ์ผู้ดูแล</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell admin-shell">
      <aside className="sidebar admin-sidebar">
        <div className="brand-block">
          <span className="brand-mark"><ShieldCheck size={24} /></span>
          <div>
            <p className="eyebrow">HarvestData</p>
            <h1>Admin Center</h1>
          </div>
        </div>
        <div className="admin-profile-summary">
          <Avatar image={currentUser?.avatar} name={currentUser?.name || currentUser?.username} size="lg" />
          <strong>{currentUser?.name || currentUser?.username}</strong>
          <small>{currentUser?.email || currentUser?.username}</small>
        </div>
        <button type="button" className="nav-button" onClick={() => router.push("/")}>
          <Leaf size={18} /> ไปหน้าเว็บ
        </button>
        <button type="button" className="nav-button" onClick={handleLogout}>
          <LogOut size={18} /> ออกจากระบบ
        </button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">สิทธิ์ผู้ดูแลระบบ</p>
            <h2>จัดการโปรไฟล์ admin และ master data ที่ผู้ใช้ปกติใช้งาน</h2>
          </div>
        </header>

        <section className="panel profile-editor">
          <FormHeading label="Admin Profile" title="แก้ไขข้อมูลตัวเอง" />
          <form className="profile-editor-grid" onSubmit={handleProfileSubmit}>
            <div className="avatar-editor">
              <Avatar image={profileForm.avatar} name={`${profileForm.first_name} ${profileForm.last_name}`} size="lg" />
              <div className="avatar-tools">
                <label className="icon-upload-button" title="อัปโหลดรูป">
                  <ImagePlus size={17} />
                  <input type="file" accept="image/*" onChange={handleProfileImageChange} />
                </label>
                <button
                  type="button"
                  className="icon-button danger-button"
                  onClick={() => setProfileForm({ ...profileForm, avatar: "" })}
                  title="ลบรูป"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
            <div className="entity-form profile-fields">
              <Field label="ชื่อ" value={profileForm.first_name} onChange={(value) => setProfileForm({ ...profileForm, first_name: value })} />
              <Field label="นามสกุล" value={profileForm.last_name} onChange={(value) => setProfileForm({ ...profileForm, last_name: value })} />
              <Field label="อีเมล" type="email" value={profileForm.email} onChange={(value) => setProfileForm({ ...profileForm, email: value })} />
              <Field label="เบอร์โทร" value={profileForm.phone} onChange={(value) => setProfileForm({ ...profileForm, phone: value })} />
              <TextArea label="ข้อมูลเพิ่มเติม" value={profileForm.bio} onChange={(value) => setProfileForm({ ...profileForm, bio: value })} />
              <button type="submit"><Save size={16} />บันทึกโปรไฟล์</button>
            </div>
          </form>
        </section>

        <div className="admin-master-grid">
          <section className="panel">
            <FormHeading
              label="Master Data"
              title={editingYearId ? "แก้ไขปี" : "เพิ่มปี"}
              onCancel={editingYearId ? () => {
                setEditingYearId(null);
                setYearForm(emptyYearForm);
              } : null}
            />
            <form className="entity-form admin-inline-form" onSubmit={handleYearSubmit}>
              <Field label="ปี" type="number" value={yearForm.year} onChange={(value) => setYearForm({ year: value })} required />
              <button type="submit"><CalendarDays size={16} />{editingYearId ? "บันทึกปี" : "เพิ่มปี"}</button>
            </form>
            <div className="master-list">
              {years.map((year) => (
                <article key={year.id} className="master-row">
                  <strong>{year.year}</strong>
                  <div className="action-row table-actions">
                    <button type="button" onClick={() => editYear(year)}><Edit size={15} />แก้ไข</button>
                    <button type="button" className="danger-button" onClick={() => deleteYear(year)}><Trash2 size={15} />ลบ</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <FormHeading
              label="Master Data"
              title={editingFruitId ? "แก้ไขผลไม้" : "เพิ่มผลไม้"}
              onCancel={editingFruitId ? () => {
                setEditingFruitId(null);
                setFruitForm(emptyFruitForm);
              } : null}
            />
            <form className="entity-form" onSubmit={handleFruitSubmit}>
              <Field label="ชื่อผลไม้" value={fruitForm.name} onChange={(value) => setFruitForm({ ...fruitForm, name: value })} required />
              <Field label="หมวดหมู่" value={fruitForm.category} onChange={(value) => setFruitForm({ ...fruitForm, category: value })} />
              <Field label="สีกราฟ" type="color" value={fruitForm.color} onChange={(value) => setFruitForm({ ...fruitForm, color: value })} />
              <button type="submit"><Sprout size={16} />{editingFruitId ? "บันทึกผลไม้" : "เพิ่มผลไม้"}</button>
            </form>
            <div className="master-list fruit-master-list">
              {fruits.map((fruit) => (
                <article key={fruit.id} className="master-row">
                  <span className="fruit-inline">
                    <span className="fruit-swatch" style={{ backgroundColor: fruit.color }} />
                    <strong>{fruit.name}</strong>
                  </span>
                  <small>{fruit.category || "ไม่ระบุหมวดหมู่"}</small>
                  <div className="action-row table-actions">
                    <button type="button" onClick={() => editFruit(fruit)}><Edit size={15} />แก้ไข</button>
                    <button type="button" className="danger-button" onClick={() => deleteFruit(fruit)}><Trash2 size={15} />ลบ</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Avatar({ image, name, size = "md" }) {
  const initial = (name || "A").trim().slice(0, 1).toUpperCase();

  return (
    <span className={`avatar avatar-${size}`}>
      {image ? <img src={image} alt="" /> : <span>{initial}</span>}
    </span>
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

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
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
