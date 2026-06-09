// ============================================================
// D-Ride Shared Types — Domain Model Contracts
// ============================================================
// All TypeScript interfaces for the D-Ride mass-transit platform
// ============================================================

// ── Enums ───────────────────────────────────────────────────

export enum UserRole {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
  SUPER_ADMIN = 'SUPER_ADMIN',
  OPERATION = 'OPERATION',
}

export enum TripStatus {
  SCHEDULED = 'SCHEDULED',
  BOARDING = 'BOARDING',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  BOARDED = 'BOARDED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  INACTIVE = 'INACTIVE',
}

// ── GeoJSON Types ───────────────────────────────────────────

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoLineString {
  type: 'LineString';
  coordinates: [number, number][]; // Array of [longitude, latitude]
}

// ── User ────────────────────────────────────────────────────

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: UserRole;
}

// ── Stop ────────────────────────────────────────────────────

export interface Stop {
  _id: string;
  name: string;
  nameAr?: string; // Arabic name
  location: GeoPoint;
  address?: string;
  order: number; // Position in route sequence
  type?: 'START' | 'CHECKPOINT' | 'END';
  bufferTimeMinutes?: number;
  geofenceRadiusMeters?: number;
}

export interface CreateStopDto {
  name: string;
  nameAr?: string;
  location: GeoPoint;
  address?: string;
  type?: 'START' | 'CHECKPOINT' | 'END';
  bufferTimeMinutes?: number;
  geofenceRadiusMeters?: number;
}

// ── Route ───────────────────────────────────────────────────

export interface RouteDto {
  _id: string;
  routeId: string;
  name: string;
  nameAr?: string;
  path: GeoLineString;
  stops: Stop[];
  checkpoints?: Stop[];
  estimatedDurationMinutes: number;
  distanceKm: number;
  isActive: boolean;
  coverImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRouteDto {
  name: string;
  nameAr?: string;
  path: GeoLineString;
  stops: string[]; // Stop IDs
  estimatedDurationMinutes: number;
  distanceKm: number;
}

// ── Vehicle ─────────────────────────────────────────────────

export interface Vehicle {
  _id: string;
  plateNumber: string;
  model: string;
  capacity: number;
  currentOccupancy: number;
  status: VehicleStatus;
  driverId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleDto {
  plateNumber: string;
  model: string;
  capacity: number;
}

// ── Driver ──────────────────────────────────────────────────

export interface Driver {
  _id: string;
  userId: string; // Reference to User
  licenseNumber: string;
  vehicleId?: string; // Reference to Vehicle
  rating: number;
  totalTrips: number;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDriverDto {
  userId: string;
  licenseNumber: string;
  vehicleId?: string;
}

// ── Trip ────────────────────────────────────────────────────

export interface Trip {
  _id: string;
  routeId: string;
  vehicleId: string;
  driverId: string;
  departureTime: Date;
  arrivalTime?: Date;
  status: TripStatus;
  priceEGP: number;
  availableSeats: number;
  bookedSeats: number;
  lockedSeats?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTripDto {
  routeId: string;
  vehicleId: string;
  driverId: string;
  departureTime: Date;
  priceEGP: number;
  availableSeats: number;
}

// ── Booking ─────────────────────────────────────────────────

export interface Booking {
  _id: string;
  userId: string;
  tripId: string;
  seatNumbers?: number[];
  pickupStopId: string;
  dropoffStopId: string;
  pickupCheckpoint?: Stop;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymobOrderId?: number;
  amountEGP: number;
  discountEGP: number;
  promoCodeId?: string;
  promoCode?: PromoCode;
  bookedAt: Date;
  boardingNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBookingDto {
  tripId: string;
  pickupStopId: string;
  dropoffStopId: string;
  pickupCheckpoint?: Stop;
  seatNumbers?: number[];
}

// ── Live Vehicle Location ───────────────────────────────────

export interface LiveVehicleLocationDto {
  vehicleId: string;
  driverId: string;
  tripId?: string;
  location: GeoPoint;
  speed?: number;        // km/h
  heading?: number;      // degrees
  timestamp: Date;
}

// ── Paymob ──────────────────────────────────────────────────

export interface PaymobWebhookPayload {
  obj: {
    id: number;
    amount_cents: number;
    success: boolean;
    is_refunded: boolean;
    is_voided: boolean;
    currency: string;
    created_at: string;
    error_occured: boolean;
    has_parent_transaction: boolean;
    integration_id: number;
    is_3d_secure: boolean;
    is_auth: boolean;
    is_capture: boolean;
    is_standalone_payment: boolean;
    pending: boolean;
    order: {
      id: number;
    };
    owner: number;
    source_data: {
      pan: string;
      type: string;
      sub_type: string;
    };
    data: {
      message: string;
    };
  };
}

export interface PaymobCheckoutRequest {
  bookingId: string;
  amountCents: number;
  currency?: string; // Default: 'EGP'
  billingData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

export interface PaymobCheckoutResponse {
  paymentKey: string;
  iframeUrl: string;
  orderId: number;
}

// ── API Response Wrappers ───────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  timestamp: string;
}

// ── Dashboard Stats ─────────────────────────────────────────

export interface DashboardStats {
  totalTrips: number;
  activeVehicles: number;
  revenueToday: number;
  activePassengers: number;
  tripsToday: number;
  bookingsToday: number;
}

// ── Promo Code ──────────────────────────────────────────────

export interface PromoCode {
  _id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxDiscountEGP?: number;
  minBookingAmountEGP: number;
  expiryDate?: Date | string;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreatePromoCodeDto {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxDiscountEGP?: number;
  minBookingAmountEGP?: number;
  expiryDate?: Date | string | null;
  usageLimit?: number | null;
  isActive?: boolean;
}
