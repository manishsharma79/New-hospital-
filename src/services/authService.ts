import api from './api';

export type UserRole = 'ADMIN' | 'REGISTRATION_STAFF' | 'DOCTOR' | 'PHARMACIST';

export interface AuthUser {
  id: number;
  staffCode: string;
  fullName: string;
  email: string;
  phone?: string | null;
  specialization?: string | null;
  qualification?: string | null;
  consultationFee?: number;
  departmentId?: number | null;
  departmentName?: string | null;
  role: UserRole;
  permissions: string[];
}

export interface PublicDepartment {
  id: number;
  department_code: string;
  name: string;
}

export interface RegisterUserPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  roleName: 'REGISTRATION_STAFF' | 'DOCTOR' | 'PHARMACIST';
  departmentId?: number | null;
  specialization?: string;
  qualification?: string;
  consultationFee?: number;
}

export const authService = {
  async login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    return res.data.data as { token: string; user: AuthUser };
  },
  async getPublicDepartments() {
    const res = await api.get('/auth/departments');
    return res.data.data as PublicDepartment[];
  },
  async register(payload: RegisterUserPayload) {
    const res = await api.post('/auth/register', payload);
    return res.data.data as { token: string; user: AuthUser };
  },
  async me() {
    const res = await api.get('/auth/me');
    return res.data.data as AuthUser;
  },
  async logout() {
    const res = await api.post('/auth/logout');
    return res.data;
  },
};

export const adminService = {
  async getDashboard() {
    const res = await api.get('/admin/dashboard');
    return res.data.data;
  },
  async getStaff() {
    const res = await api.get('/admin/staff');
    return res.data.data;
  },
  async createStaff(payload: Record<string, unknown>) {
    const res = await api.post('/admin/staff', payload);
    return res.data;
  },
  async updateStaff(id: number, payload: Record<string, unknown>) {
    const res = await api.put(`/admin/staff/${id}`, payload);
    return res.data;
  },
  async deleteStaff(id: number) {
    const res = await api.delete(`/admin/staff/${id}`);
    return res.data;
  },
  async getDepartments() {
    const res = await api.get('/admin/departments');
    return res.data.data;
  },
  async createDepartment(payload: Record<string, unknown>) {
    const res = await api.post('/admin/departments', payload);
    return res.data;
  },
  async updateDepartment(id: number, payload: Record<string, unknown>) {
    const res = await api.put(`/admin/departments/${id}`, payload);
    return res.data;
  },
  async deleteDepartment(id: number) {
    const res = await api.delete(`/admin/departments/${id}`);
    return res.data;
  },
  async getRolesAndPermissions() {
    const res = await api.get('/admin/roles');
    return res.data.data;
  },
  async updateRolePermissions(roleId: number, permissionIds: number[]) {
    const res = await api.put(`/admin/roles/${roleId}/permissions`, { permissionIds });
    return res.data;
  },
  async getSchedules() {
    const res = await api.get('/admin/schedules');
    return res.data.data;
  },
  async createSchedule(payload: Record<string, unknown>) {
    const res = await api.post('/admin/schedules', payload);
    return res.data;
  },
  async updateSchedule(id: number, payload: Record<string, unknown>) {
    const res = await api.put(`/admin/schedules/${id}`, payload);
    return res.data;
  },
  async deleteSchedule(id: number) {
    const res = await api.delete(`/admin/schedules/${id}`);
    return res.data;
  },
  async getBillingOverview() {
    const res = await api.get('/admin/billing-overview');
    return res.data.data;
  },
  async getActivities() {
    const res = await api.get('/admin/activities');
    return res.data.data;
  },
};

export const lookupService = {
  async getDepartments() {
    const res = await api.get('/departments');
    return res.data.data;
  },
  async getDoctors(departmentId?: number) {
    const res = await api.get('/doctors', { params: departmentId ? { departmentId } : {} });
    return res.data.data;
  },
};
