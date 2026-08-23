// constants/mockMechanicDashboard.ts

export interface MockMechanicStats {
  todaysRequests: number;
  accepted: number;
  completed: number;
  earnings: number;
}

export const MOCK_MECHANIC_STATS: MockMechanicStats = {
  todaysRequests: 5,
  accepted: 2,
  completed: 3,
  earnings: 1850,
};

export interface MockServiceRequest {
  id: string;
  issue: string;
  vehicleName: string;
  plateNumber: string;
  distanceKm: number;
  estimatedPrice: number;
}

export const MOCK_SERVICE_REQUESTS: MockServiceRequest[] = [
  {
    id: "req-1",
    issue: "Engine won't start",
    vehicleName: "Toyota Vios",
    plateNumber: "ABC 1234",
    distanceKm: 2.4,
    estimatedPrice: 500,
  },
  {
    id: "req-2",
    issue: "Flat tire",
    vehicleName: "Honda Click 125",
    plateNumber: "XYZ 5678",
    distanceKm: 1.1,
    estimatedPrice: 300,
  },
  {
    id: "req-3",
    issue: "Brake noise",
    vehicleName: "Mitsubishi Mirage",
    plateNumber: "DEF 4321",
    distanceKm: 3.8,
    estimatedPrice: 450,
  },
];

export interface MockActiveJob {
  customerName: string;
  vehicleName: string;
  serviceType: string;
  distanceKm: number;
}

// Set to null to preview the dashboard's empty-state UI instead.
export const MOCK_ACTIVE_JOB: MockActiveJob | null = {
  customerName: "Maria Santos",
  vehicleName: "Honda Civic",
  serviceType: "Battery replacement",
  distanceKm: 3.2,
};