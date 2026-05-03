"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
      <section className="login-panel">
        <p className="eyebrow">HarvestData</p>
        <h1>เข้าสู่ระบบจัดการสวน</h1>
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
      </section>
    </main>
  );
}
