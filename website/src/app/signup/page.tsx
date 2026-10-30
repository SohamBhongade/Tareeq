import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { getI18n, pageTitle } from "@/lib/i18n/server";
import { SignupFlow } from "./SignupFlow";

export const generateMetadata = () => pageTitle("auth.metaSignUp");
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSession()) redirect("/");
  const { t } = await getI18n();
  return (
    <AuthShell title={t("auth.signupTitle")} subtitle={t("auth.signupSub")}>
      <SignupFlow />
    </AuthShell>
  );
}
