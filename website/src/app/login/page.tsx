import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { getI18n, pageTitle } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export const generateMetadata = () => pageTitle("auth.metaSignIn");
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  const { t } = await getI18n();
  return (
    <AuthShell title={t("auth.loginTitle")} subtitle={t("auth.loginSub")}>
      <LoginForm />
    </AuthShell>
  );
}
