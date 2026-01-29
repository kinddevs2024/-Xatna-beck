// SQLite не поддерживает enums, используем строковые константы
export const UserRole = {
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  CLIENT: 'CLIENT',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export const BookingStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;

export type BookingStatus = typeof BookingStatus[keyof typeof BookingStatus];

export interface User {
  id: number;
  name?: string | null;
  phone_number?: string | null;
  tg_id?: string | null;
  tg_username?: string | null;
  password?: string | null;
  role: UserRole;
  working?: boolean | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
  profile_image?: string | null;
  created_at: Date;
}

export interface Booking {
  id: number;
  client_id?: number | null;
  doctor_id?: number | null;
  date: string;
  time: string;
  status: BookingStatus;
  comment?: string | null;
  notification_sent: boolean;
  created_at: Date;
  client?: User | null;
  doctor?: User | null;
}

export interface CreateBookingDto {
  phone_number: string;
  doctor_id?: number;
  date: string;
  time: string;
  client_name?: string;
}

export interface UpdateStatusDto {
  status: BookingStatus;
}

export interface BookingStatisticsDto {
  startDate: string;
  endDate: string;
}

export interface LoginDto {
  tg_username: string;
  password: string;
}
