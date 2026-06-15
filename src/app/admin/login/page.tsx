import { LoginForm } from "@/components/admin/login-form";

export const metadata = {
  title: "Admin — Acceso",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <LoginForm />
    </main>
  );
}
