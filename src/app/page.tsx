import { BdbApp } from "@/components/bdb-app";
import type { Role } from "@/lib/types";

const previewRoles: Role[] = ["buyer", "agent", "admin"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[]; role?: string | string[] }>;
}) {
  const params = await searchParams;
  const preview = Array.isArray(params.preview) ? params.preview[0] : params.preview;
  const role = Array.isArray(params.role) ? params.role[0] : params.role;
  const initialRole = previewRoles.includes(role as Role) ? (role as Role) : "buyer";
  const hasPreviewRole = previewRoles.includes(role as Role);

  return (
    <BdbApp
      initialPreviewMode={preview === "1"}
      initialPreviewRoleSpecified={hasPreviewRole}
      initialRole={initialRole}
    />
  );
}
