import type { Metadata } from "next";
import AdminInbox from "@/components/admin-inbox";
import "./admin.css";

export const metadata: Metadata = {
  title: "Inbox",
  description: "Private portfolio contact inbox.",
  alternates: { canonical: "/admin/" },
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminInbox />;
}
