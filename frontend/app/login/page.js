"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  Leaf,
  LockKeyhole,
  ShieldCheck,
  Sprout,
  UserRound,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo1234");

  async function handleSubmit(event) {
    event.preventDefault();
    toast.info("กำลังเข้าสู่ระบบ");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const detail = errorBody?.detail || `HTTP ${response.status}`;
        throw new Error(detail);
      }

      const user = await response.json();
      toast.success("เข้าสู่ระบบสำเร็จ");
      router.push(user?.is_admin ? "/admin" : "/");
    } catch (error) {
      toast.error(`ยังเข้าสู่ระบบไม่ได้: ${error.message}`);
    }
  }

  return (
    <main className="login-page">
      <Link href="/?view=landing" className="login-back-link">
        <ArrowLeft size={18} />
        กลับหน้าแรก
      </Link>
      <section className="login-story" aria-label="HarvestData dashboard access">
        <div className="brand-block">
          <span className="brand-mark"><Leaf size={24} /></span>
          <div>
            <p className="eyebrow">HarvestData</p>
            <h1>
              <span>เข้าสู่ระบบ</span>
              <span>ข้อมูลสวนผลไม้</span>
            </h1>
          </div>
        </div>
        <p>
          จัดการข้อมูลเกษตรกร แปลงปลูก ผลผลิต และรายได้จาก dashboard เดียว
          พร้อมมุมมองแนวโน้มที่อ่านง่ายสำหรับการวางแผนฤดูกาลถัดไป
        </p>
        <div className="login-feature-list" aria-label="Dashboard features">
          <span><BarChart3 size={18} /> Yield trends</span>
          <span><Sprout size={18} /> Planting records</span>
          <span><ShieldCheck size={18} /> Secure access</span>
        </div>
      </section>
      <section className="login-panel">
        <span className="login-panel-icon"><LockKeyhole size={22} /></span>
        <p className="eyebrow">Dashboard Login</p>
        <h1>เข้าสู่ระบบจัดการสวน</h1>
        <p className="login-copy">ใช้บัญชี demo เพื่อทดลอง dashboard และชุดข้อมูลตัวอย่าง</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span><UserRound size={16} /> Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            <span><LockKeyhole size={16} /> Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit">
            <ShieldCheck size={18} />
            เข้าสู่ Dashboard
          </button>
        </form>
      </section>
    </main>
  );
}
