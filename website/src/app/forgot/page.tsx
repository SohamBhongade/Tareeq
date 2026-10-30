import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { getI18n, pageTitle } from "@/lib/i18n/server";
import { ForgotFlow } from "./ForgotFlow";

export const generateMetadata = () => pageTitle("auth.metaForgot");
export const dynamic = "force-dynamic";

export default async function ForgotPage() {
  if (await getSession()) redirect("/");
  const { t } = await getI18n();
  return (
    <AuthShell title={t("auth.forgotTitle")} subtitle={t("auth.forgotSub")}>
      <ForgotFlow />
    </AuthShell>
  );
}
