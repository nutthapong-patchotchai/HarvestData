"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiRequest } from "../api-client.mjs";
import {
  BarChart3,
  CalendarDays,
  Edit,
  ImagePlus,
  Leaf,
  LogOut,
  Moon,
  Save,
  ShieldCheck,
  Sprout,
  Sun,
  Trash2,
  X,
} from "lucide-react";

const emptyYearForm = { year: "" };
const emptyFruitForm = { name: "", category: "", color: "#6f9f83" };

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

export default function AdminPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);
  const [profileCardOpen, setProfileCardOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(profileFormFromUser(null));
  const [dashboardTheme, setDashboardTheme] = useState(getStoredDashboardTheme);
  const profileEditorRef = useRef(null);
  const [years, setYears] = useState([]);
  const [fruits, setFruits] = useState([]);
  const [yearForm, setYearForm] = useState(emptyYearForm);
  const [fruitForm, setFruitForm] = useState(emptyFruitForm);
  const [editingYearId, setEditingYearId] = useState(null);
  const [editingFruitId, setEditingFruitId] = useState(null);
  const { openConfirm, confirmModal } = useConfirmModal();

  useEffect(() => {
    window.localStorage.setItem("harvestdata-dashboard-theme", dashboardTheme);
  }, [dashboardTheme]);

  const loadMasterData = useCallback(async () => {
    const [yearRows, fruitRows] = await Promise.all([
      apiRequest("/years/", { fetchAllPages: true }),
      apiRequest("/fruits/", { fetchAllPages: true }),
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

  async function performLogout() {
    await apiRequest("/auth/logout/", { method: "POST" }).catch(() => null);
    router.replace("/login");
  }

  function confirmLogout() {
    openConfirm({
      title: "ออกจากระบบ",
      description: "ต้องการออกจากระบบ Admin Center ใช่ไหม?",
      details: ["งานที่ยังไม่ได้บันทึกอาจหายไป", "หลังออกจากระบบต้องเข้าสู่ระบบใหม่เพื่อจัดการข้อมูล"],
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
    openConfirm({
      title: "ลบปีข้อมูล",
      description: `ต้องการลบปี ${year.year} ใช่ไหม?`,
      details: ["ผู้ใช้จะไม่สามารถเลือกปีนี้ในข้อมูลใหม่ได้", "การลบนี้ไม่สามารถย้อนกลับได้"],
      confirmLabel: "ลบปี",
      variant: "danger",
      onConfirm: async () => {
        try {
          await apiRequest(`/years/${year.id}/`, { method: "DELETE" });
          await loadMasterData();
          toast.success("ลบปีแล้ว");
        } catch (error) {
          toast.error(`ลบปีไม่สำเร็จ: ${error.message}`);
        }
      },
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
    openConfirm({
      title: "ลบชนิดผลไม้",
      description: `ต้องการลบ ${fruit.name} ใช่ไหม?`,
      details: ["ชนิดผลไม้นี้จะหายจาก master data", "ตรวจสอบว่ามีแปลงปลูกหรือผลผลิตที่ใช้อยู่ก่อนลบ"],
      confirmLabel: "ลบผลไม้",
      variant: "danger",
      onConfirm: async () => {
        try {
          await apiRequest(`/fruits/${fruit.id}/`, { method: "DELETE" });
          await loadMasterData();
          toast.success("ลบผลไม้แล้ว");
        } catch (error) {
          toast.error(`ลบผลไม้ไม่สำเร็จ: ${error.message}`);
        }
      },
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
    <main className={`app-shell admin-shell dashboard-theme-${dashboardTheme}`}>
      <aside className="sidebar admin-sidebar">
        <div className="brand-block">
          <span className="brand-mark"><ShieldCheck size={24} /></span>
          <div>
            <p className="eyebrow">HarvestData</p>
            <h1>Admin Center</h1>
          </div>
        </div>
        <button
          type="button"
          className="admin-profile-summary"
          onClick={() => setProfileCardOpen(true)}
          aria-label="ดูบัตรโปรไฟล์ admin"
          title="ดูบัตรโปรไฟล์"
        >
          <Avatar image={currentUser?.avatar} name={currentUser?.name || currentUser?.username} size="lg" />
          <strong>{currentUser?.name || currentUser?.username}</strong>
          <small>{currentUser?.email || currentUser?.username}</small>
        </button>
        <div className="admin-sidebar-footer">
          <button type="button" className="nav-button" onClick={() => router.push("/?view=landing")}>
            <Leaf size={18} /> ไปหน้าเว็บไซต์
          </button>
          <button type="button" className="nav-button" onClick={() => router.push("/?view=dashboard")}>
            <BarChart3 size={18} /> ไปหน้า Dashboard
          </button>
          <button type="button" className="nav-button" onClick={confirmLogout}>
            <LogOut size={18} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">สิทธิ์ผู้ดูแลระบบ</p>
            <h2>จัดการโปรไฟล์ admin และ master data ที่ผู้ใช้ปกติใช้งาน</h2>
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
          </div>
        </header>

        <section className="panel profile-editor" ref={profileEditorRef}>
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

      {profileCardOpen && (
        <ProfileCardModal
          user={currentUser}
          onClose={() => setProfileCardOpen(false)}
          onEdit={() => {
            setProfileCardOpen(false);
            profileEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}
      {confirmModal}
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

function PopupModal({ eyebrow, title, children, footer, onClose, variant = "" }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="popup-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <article className={`popup-dialog ${variant ? `popup-dialog-${variant}` : ""}`} onClick={(event) => event.stopPropagation()}>
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
