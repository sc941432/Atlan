const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

let token: string | null = localStorage.getItem("access_token");

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("access_token", t);
  else localStorage.removeItem("access_token");
}

export function getToken() {
  return token;
}

class ApiError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {})
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    // surface status for UI
    const info = await res.json().catch(() => ({} as any));
    throw new ApiError(info.detail || res.statusText, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const auth = {
  signup: (data: { name: string; email: string; password: string }) =>
    api<{ id: number; name: string; email: string; role: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    api<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => api<{ id: number; name: string; email: string; role: string }>("/auth/me"),
};

// Events (Public)
export const events = {
  list: (params: {
    page?: number;
    page_size?: number;
    q?: string;
    venue?: string;
    status?: 'active' | 'inactive';
    date_from?: string;
    date_to?: string;
    sort?: 'name' | 'start_time' | 'utilization';
    order?: 'asc' | 'desc';
  } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, String(value));
    });
    return api<{ items: Event[]; meta: { page: number; page_size: number; total: number } }>(
      `/events?${searchParams}`
    );
  },

  getById: (id: number) => api<Event>(`/events/${id}`),

  getSeats: (id: number) => api<Seat[]>(`/events/${id}/seats`),

  book: (eventId: number, data: { qty: number; waitlist?: boolean; seat_ids?: number[] }, idempotencyKey: string) =>
    api<Booking>(`/events/${eventId}/book`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(data),
    }),
};

// Bookings
export const bookings = {
  list: () => api<Booking[]>("/me/bookings"),
  cancel: (id: number) => api<Booking>(`/bookings/${id}`, { method: "DELETE" }),
};

// Admin Events
export const adminEvents = {
  create: (data: {
    name: string;
    venue: string;
    start_time: string;
    end_time: string;
    capacity: number;
  }) =>
    api<Event>("/admin/events", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<{
    name: string;
    venue: string;
    start_time: string;
    end_time: string;
    capacity: number;
    status: 'active' | 'inactive';
  }>) =>
    api<Event>(`/admin/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deactivate: (id: number) => api<Event>(`/admin/events/${id}/deactivate`, { method: "POST" }),

  delete: (id: number) => api<void>(`/admin/events/${id}`, { method: "DELETE" }),
};

// Public Stats (for homepage)
export const publicStats = {
  getHomepageStats: () => api<HomepageStats>('/stats/homepage'),
};

// Admin Analytics
export const adminAnalytics = {
  getSummary: (refresh = false) => 
    api<AnalyticsSummary>(`/admin/analytics/summary${refresh ? '?refresh=1' : ''}`),
};

// Admin Bookings (for waitlist counts)
export const adminBookings = {
  list: () => api<Booking[]>("/admin/bookings"),
};

// Admin Users
export const adminUsers = {
  list: (role?: 'user' | 'admin') => {
    const params = role ? `?role=${role}` : '';
    return api<{ id: number; name: string; email: string; role: string }[]>(`/admin/users${params}`);
  },
  
  create: (data: { name: string; email: string; password: string; role: string }) =>
    api<{ id: number; name: string; email: string; role: string }>("/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRole: (id: number, role: string) =>
    api<{ id: number; name: string; email: string; role: string }>(`/admin/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
};

// Types
export type BookingStatus = "CONFIRMED" | "WAITLISTED" | "CANCELLED";

export interface Event {
  id: number;
  name: string;
  venue: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  waitlisted_count: number;
  status: 'active' | 'inactive';
  utilization_pct?: number;
}

export interface Seat {
  id: number;
  label: string;
  row_label: string;
  col_number: number;
  reserved: boolean;
}

export interface Booking {
  id: number;
  user_id: number;
  event_id: number;
  qty: number;
  status: BookingStatus;
  created_at: string;
  event?: Event;
  seat_labels?: string[];
}

export interface HomepageStats {
  total_events: number;
  total_tickets_sold: number;
  total_customers: number;
  cities_covered: number;
}

export interface AnalyticsSummary {
  generated_at: string;
  totals: {
    events: number;
    active_events: number;
    capacity: number;
    booked: number;
    utilization_pct: number;
  };
  events: Event[];
  top_events: Event[];
  timeseries_7d: {
    bookings: Array<{ date: string; count: number }>;
    cancellations: Array<{ date: string; count: number }>;
  };
}

export { ApiError };