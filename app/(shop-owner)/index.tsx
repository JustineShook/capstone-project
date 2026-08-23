// app/(shop-owner)/index.tsx
import { RoleDashboard } from "../../components/RoleDashboard";
import { useAuth } from "../../hooks/useAuth";

export default function ShopOwnerDashboard() {
  const { userProfile } = useAuth();

  return (
    <RoleDashboard
      title="Shop Owner Dashboard"
      displayName={userProfile?.displayName}
      cards={[
        { label: "Bookings" },
        { label: "Services" },
        { label: "Customers" },
        { label: "Staff" },
        { label: "Availability" },
        { label: "Earnings" },
        { label: "Notifications" },
        { label: "Profile" },
      ]}
    />
  );
}