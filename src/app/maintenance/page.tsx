import type { Metadata } from "next";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { getMaintenanceMessage } from "@/lib/settings";

export const metadata: Metadata = {
  title: "نعود قريباً",
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const message = await getMaintenanceMessage();
  return <MaintenanceScreen message={message} />;
}
