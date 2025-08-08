// Shared TypeScript interfaces for the Luz API
// These mirror the database schema for type safety

import { Request } from 'express';

export type PaymentMethod = 'cash' | 'bit' | 'paybox' | 'transfer';

export interface Studio {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
}

export interface Customer {
  id: string;
  studio_id: string;
  first_name: string;
  avatar_key?: string;
  contact_phone?: string;
  contact_email?: string;
  created_at: Date;
}

export interface Child {
  id: string;
  customer_id: string;
  first_name: string;
  avatar_key: string;
  created_at: Date;
}

export interface Slot {
  id: string;
  studio_id: string;
  title: string;
  starts_at: Date;
  duration_min: number;
  recurrence_rule?: string;
  price: number;
  min_participants: number;
  max_participants: number;
  for_children: boolean;
  active: boolean;
}

export interface Invite {
  id: string;
  studio_id: string;
  customer_id: string;
  short_hash: string;
  created_at: Date;
  expires_at?: Date;
}

export interface Booking {
  id: string;
  slot_id: string;
  customer_id?: string;
  child_id?: string;
  status: string;
  created_at: Date;
  paid: boolean;
  paid_at?: Date;
  paid_method?: PaymentMethod;
}

// API Request/Response types
export interface CreateStudioRequest {
  slug: string;
  name: string;
  timezone: string;
  currency: string;
}

export interface CreateSlotRequest {
  title: string;
  startsAt: string; // ISO 8601 datetime string
  durationMin: number;
  recurrenceRule?: string;
  price: number;
  minParticipants: number;
  maxParticipants: number;
  forChildren: boolean;
}

export interface CreateCustomerRequest {
  firstName: string;
  avatarKey?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface CreateChildRequest {
  firstName: string;
  avatarKey: string;
}

export interface CreateInviteRequest {
  firstName: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface UpdatePaymentRequest {
  paidMethod: PaymentMethod;
  paidAt?: string; // ISO 8601 datetime string
}

export interface CreateBookingRequest {
  slotId: string;
  customerId?: string;
  childId?: string;
  childData?: CreateChildRequest;
}

// API Response types with related data
export interface BookingWithDetails extends Booking {
  slot_title: string;
  starts_at: Date;
  duration_min: number;
  price: number;
  customer_name?: string;
  contact_email?: string;
  contact_phone?: string;
  child_name?: string;
}

export interface SlotsByDay {
  [date: string]: Slot[];
}

// Express request extensions
export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  authenticated?: boolean;
  studioId?: string;
}

// Database query result types
export interface DatabaseRow {
  [key: string]: unknown;
}

export interface BookingStatsRow {
  status: string;
  count: string;
  paid_count: string;
}

export interface PopularStudioRow {
  name: string;
  slug: string;
  booking_count: string;
}

// Test data types
export interface TestStudio {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
}

export interface TestCustomer {
  id: string;
  studio_id: string;
  first_name: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface TestChild {
  id: string;
  customer_id: string;
  first_name: string;
  avatar_key: string;
}

export interface TestSlot {
  id: string;
  studio_id: string;
  title: string;
  starts_at: string;
  duration_min: number;
  price: number;
  min_participants: number;
  max_participants: number;
  for_children: boolean;
}

// Utility types
export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}
