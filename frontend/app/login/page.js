"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo1234");
  const [status, setStatus] = useState("พร้อมเชื่อมต่อ Django REST API");

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("กำลังเข้าสู่ระบบ");

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

      router.push("/");
    } catch (error) {
      setStatus(`ยังเข้าสู่ระบบไม่ได้: ${error.message}`);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        {/* <Link href="/" className="back-link">กลับหน้า dashboard</Link> */}
        <p className="eyebrow">HarvestData</p>
        <h1>เข้าสู่ระบบจัดการสวน</h1>
        {/* <p className="login-copy">
          ใช้บัญชี demo หลังรันคำสั่ง seed หรือเปลี่ยนเป็นบัญชีผู้ใช้ของคุณเอง
        </p> */}
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit">เข้าสู่ระบบ</button>
        </form>
        {/* <p className="login-status">{status}</p> */}
      </section>
    </main>
  );
}
