// =============================================================
// src/types/index.ts
// Master interface definitions — every DB row & DTO lives here
// =============================================================

// ─── Enums (string-literal unions matching MySQL ENUMs) ─────

export type RoleName =
  | 'ADMIN'
  | 'SUBADMIN'
  | 'PEETH'
  | 'SHAKHA'
  | 'SUBSHAKHA'
  | 'STAFF_VOLUNTEER'
  | 'FIELD_WORKER'
  | 'GUEST_VOLUNTEER'
  | 'CONTRIBUTOR';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_PAN' | 'UNVERIFIED';

export type VolunteerType = 'STAFF' | 'FIELD_WORKER' | 'GUEST';

export type ContributorType = 'GENERAL' | 'TRUSTEE' | 'GRUHINI';

export type PanStatus = 'NOT_UPLOADED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export type DonationTypeName = 'AMOUNT' | 'RICE_GRAIN' | 'CUSTOM';

export type PaymentMethod =
  | 'CASH' | 'UPI' | 'NEFT' | 'RTGS' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE';

export type CommissionType = 'FIXED' | 'PERCENTAGE';

export type CommissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export type WorkStatus = 'PROPOSED' | 'ONGOING' | 'COMPLETED';

export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export type SalaryStatus = 'PENDING' | 'PAID';

export type EventParticipantRole = 'VOLUNTEER' | 'CONTRIBUTOR' | 'GUEST';

// ─── Row Interfaces (mirror DB columns 1 : 1) ──────────────

export interface Role {
  id: number;
  name: RoleName;
  description: string | null;
}

export interface User {
  id: number;
  unique_id: string;
  email: string | null;
  phone: string | null;
  otp_hash: string | null;
  otp_expires_at: Date | null;
  is_verified: boolean;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

/** Row in the `admins` table — password-based, fully separate from `users` */
export interface Admin {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: 'ADMIN' | 'SUBADMIN';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Peeth {
  id: number;
  name: string;
  user_id: number;
  created_by: number;
  is_active: boolean;
  created_at: Date;
}

export interface Shakha {
  id: number;
  peeth_id: number;
  name: string;
  user_id: number;
  created_by: number;
  is_active: boolean;
  created_at: Date;
}

export interface SubShakha {
  id: number;
  shakha_id: number;
  name: string;
  user_id: number;
  created_by: number;
  is_active: boolean;
  created_at: Date;
}

export interface Team {
  id: number;
  shakha_id: number | null;
  sub_shakha_id: number | null;
  name: string;
  created_by: number;
  is_active: boolean;
  created_at: Date;
}

export interface Volunteer {
  id: number;
  user_id: number;
  team_id: number;
  shakha_id: number | null;       // managing shakha (Guests)
  volunteer_type: VolunteerType;
  monthly_salary: number | null;  // STAFF only
  is_active: boolean;
  created_by: number;
  created_at: Date;
}

export interface ContributorCategory {
  id: number;
  name: string;
  is_default: boolean;
  created_by: number;
  created_at: Date;
}

export interface Contributor {
  id: number;
  user_id: number;
  category_id: number;
  pan_number: string | null;
  pan_status: PanStatus;
  contributor_type: ContributorType;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  photo_face: string | null;
  photo_full: string | null;
  photo_house: string | null;
  geo_latitude: number | null;
  geo_longitude: number | null;
  added_by_volunteer: number | null;
  assigned_team_id: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DonationType {
  id: number;
  name: DonationTypeName;
}

export interface Donation {
  id: number;
  contributor_id: number;
  volunteer_id: number;
  donation_type_id: number;
  amount: number | null;
  quantity_kg: number | null;
  market_rate: number | null;
  custom_description: string | null;
  payment_method: PaymentMethod | null;
  receipt_number: string | null;
  is_commission_applicable: boolean;
  created_at: Date;
}

export interface CommissionSlab {
  id: number;
  shakha_id: number | null;       // NULL = global default
  min_amount: number;
  max_amount: number;
  commission_type: CommissionType;
  commission_value: number;
  applies_to: 'AMOUNT' | 'RICE_GRAIN';
  is_active: boolean;
  created_by: number;
  created_at: Date;
}

export interface Commission {
  id: number;
  donation_id: number;
  volunteer_id: number;
  slab_id: number;
  calculated_amount: number;
  status: CommissionStatus;
  approved_by: number | null;
  approved_at: Date | null;
  paid_at: Date | null;
  created_at: Date;
}

export interface Work {
  id: number;
  title: string;
  description: string | null;
  status: WorkStatus;
  budget: number | null;
  actual_expense: number | null;
  shakha_id: number | null;
  sub_shakha_id: number | null;
  created_by: number;
  approved_by: number | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface WorkExpense {
  id: number;
  work_id: number;
  description: string;
  amount: number;
  created_by: number;
  created_at: Date;
}

export interface Event {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  event_date: Date;
  location: string | null;
  qr_code_token: string | null;
  created_by: number;
  shakha_id: number | null;
  sub_shakha_id: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EventParticipant {
  id: number;
  event_id: number;
  user_id: number;
  role: EventParticipantRole;
  registered_at: Date;
}

export interface Attendance {
  id: number;
  event_id: number;
  user_id: number;
  scan_time: Date;
  status: AttendanceStatus;
}

export interface StaffSalary {
  id: number;
  volunteer_id: number;
  pay_month: Date;          // first day of month
  amount: number;
  status: SalaryStatus;
  paid_at: Date | null;
  created_at: Date;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  table_name: string;
  record_id: number | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

export interface UserRole {
  id: number;
  user_id: number;
  role_id: number;
  is_active: boolean;
  created_at: Date;
}

// ─── DTO / Request Body Interfaces ──────────────────────────

export interface CreatePeethDTO {
  name: string;
  user_id: number;
}

export interface CreateShakhaDTO {
  peeth_id: number;
  name: string;
  user_id: number;
}

export interface CreateSubShakhaDTO {
  shakha_id: number;
  name: string;
  user_id: number;
}

export interface CreateTeamDTO {
  name: string;
  shakha_id?: number;
  sub_shakha_id?: number;
}

export interface CreateVolunteerDTO {
  user_id: number;
  team_id: number;
  volunteer_type: VolunteerType;
  monthly_salary?: number;     // required when type = STAFF
  shakha_id?: number;          // required when type = GUEST
}

export interface CreateContributorDTO {
  user_id: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  photo_face?: string;
  photo_full?: string;
  photo_house?: string;
  geo_latitude?: number;
  geo_longitude?: number;
}

export interface UploadPanDTO {
  pan_number: string;
}

export interface CreateDonationDTO {
  contributor_id: number;
  volunteer_id: number;
  donation_type: DonationTypeName;
  amount?: number;
  quantity_kg?: number;
  market_rate?: number;
  custom_description?: string;
  payment_method?: PaymentMethod;
}

export interface CreateCommissionSlabDTO {
  shakha_id?: number;
  min_amount: number;
  max_amount: number;
  commission_type: CommissionType;
  commission_value: number;
  applies_to: 'AMOUNT' | 'RICE_GRAIN';
}

export interface CreateWorkDTO {
  title: string;
  description?: string;
  budget?: number;
  shakha_id?: number;
  sub_shakha_id?: number;
}

export interface UpdateWorkDTO {
  title?: string;
  description?: string;
  status?: WorkStatus;
  budget?: number;
}

export interface CreateEventDTO {
  title: string;
  description?: string;
  category?: string;
  event_date: string;    // ISO string
  location?: string;
  shakha_id?: number;
  sub_shakha_id?: number;
}

export interface RegisterParticipantDTO {
  user_id: number;
  role: EventParticipantRole;
}

export interface MarkAttendanceDTO {
  qr_code_token: string;
  user_id: number;
}

export interface CreateContributorCategoryDTO {
  name: string;
}

// ─── Auth / Token ───────────────────────────────────────────

/**
 * Payload embedded in every JWT.
 * `source` distinguishes the two login paths so the middleware
 * never needs to hit the DB again after decoding.
 */
export interface TokenPayload {
  source: 'ADMIN' | 'ORG';   // which table the identity lives in
  // ADMIN source fields
  admin_id?: number;
  // ORG source fields
  user_id?: number;
  unique_id?: string;
  // Shared
  role: RoleName;
}

// ─── Admin auth DTOs ────────────────────────────────────────

export interface AdminRegisterDTO {
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'SUBADMIN';   // defaults to SUBADMIN
}

export interface AdminLoginDTO {
  email: string;
  password: string;
}

/** What the admin login endpoint returns on success */
export interface AdminLoginResponse {
  token: string;
  admin: {
    id: number;
    email: string;
    name: string;
    role: 'ADMIN' | 'SUBADMIN';
  };
}

// ─── Org (Peeth / Shakha / SubShakha) auth DTOs ────────────

export interface OtpRequestDTO {
  phone?: string;
  email?: string;
}

export interface OtpVerifyDTO {
  phone?: string;
  email?: string;
  otp: string;
}

/**
 * Resolved context returned after a successful OTP verify.
 * Tells the front-end exactly which org level this user owns.
 */
export interface OrgLoginResponse {
  token: string;
  user: {
    id: number;
    unique_id: string;
    email: string | null;
    phone: string | null;
    status: UserStatus;
  };
  role: RoleName;                        // resolved role
  context: {                             // which org entity they manage
    peeth_id?: number;
    shakha_id?: number;
    sub_shakha_id?: number;
  };
}
