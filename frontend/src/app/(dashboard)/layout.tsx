import TourProvider from "@/components/tour/TourProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TourProvider>{children}</TourProvider>;
}
