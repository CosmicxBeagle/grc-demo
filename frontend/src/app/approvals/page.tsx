"use client";
// My Approvals was merged into My Work (Approvals tab).
// This redirect ensures old bookmarks / nav links still land correctly.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ApprovalsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/my-work"); }, [router]);
  return null;
}
