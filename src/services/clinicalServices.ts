import api from './api';

export const patientService = {
  async list(params?: Record<string, string | number>) {
    const res = await api.get('/patients', { params });
    return res.data.data;
  },
  async search(q: string) {
    const res = await api.get('/patients/search', { params: { q } });
    return res.data.data;
  },
  async getById(idOrCode: string | number) {
    const res = await api.get(`/patients/${encodeURIComponent(String(idOrCode))}`);
    return res.data.data;
  },
  async create(payload: Record<string, unknown>) {
    const res = await api.post('/patients', payload);
    return res.data;
  },
  async update(id: number, payload: Record<string, unknown>) {
    const res = await api.put(`/patients/${id}`, payload);
    return res.data;
  },
  async remove(id: number) {
    const res = await api.delete(`/patients/${id}`);
    return res.data;
  },
  async getHistory(idOrCode: string | number) {
    const res = await api.get(`/patients/${encodeURIComponent(String(idOrCode))}/history`);
    return res.data.data;
  },
};

export const appointmentService = {
  async list(params?: Record<string, string | number>) {
    const res = await api.get('/appointments', { params });
    return res.data.data;
  },
  async getAvailability(params: { date: string; departmentId?: number; doctorId?: number }) {
    const res = await api.get('/appointments/availability', { params });
    return res.data.data;
  },
  async create(payload: Record<string, unknown>) {
    const res = await api.post('/appointments', payload);
    return res.data;
  },
  async update(id: number, payload: Record<string, unknown>) {
    const res = await api.put(`/appointments/${id}`, payload);
    return res.data;
  },
  async remove(id: number) {
    const res = await api.delete(`/appointments/${id}`);
    return res.data;
  },
};

export const doctorService = {
  async getDashboard() {
    const res = await api.get('/doctor/dashboard');
    return res.data.data;
  },
  async getPatients(params?: { scope?: string; search?: string }) {
    const res = await api.get('/doctor/patients', { params });
    return res.data.data;
  },
  async getRecords(patientId?: number) {
    const res = await api.get('/doctor/records', { params: patientId ? { patientId } : {} });
    return res.data.data;
  },
  async addDiagnosis(payload: Record<string, unknown>) {
    const res = await api.post('/doctor/diagnosis', payload);
    return res.data;
  },
  async addTreatment(payload: Record<string, unknown>) {
    const res = await api.post('/doctor/treatment', payload);
    return res.data;
  },
  async updateProgress(payload: { recordId: number; progressStatus: string; clinicalNotes?: string }) {
    const res = await api.put('/doctor/progress', payload);
    return res.data;
  },
  async getPrescriptions(params?: Record<string, string | number>) {
    const res = await api.get('/prescriptions', { params });
    return res.data.data;
  },
  async getPrescriptionById(id: number) {
    const res = await api.get(`/prescriptions/${id}`);
    return res.data.data;
  },
  async createPrescription(payload: Record<string, unknown>) {
    const res = await api.post('/prescriptions', payload);
    return res.data;
  },
  async getDiagnosticTests(params?: Record<string, string | number>) {
    const res = await api.get('/diagnostic-tests', { params });
    return res.data.data;
  },
  async requestDiagnosticTest(payload: Record<string, unknown>) {
    const res = await api.post('/diagnostic-tests', payload);
    return res.data;
  },
  async updateDiagnosticReport(id: number, payload: Record<string, unknown>) {
    const res = await api.put(`/diagnostic-tests/${id}/report`, payload);
    return res.data;
  },
};

export const pharmacistService = {
  async getDashboard() {
    const res = await api.get('/pharmacist/dashboard');
    return res.data.data;
  },
  async getMedicines(params?: { search?: string; category?: string }) {
    const res = await api.get('/medicines', { params });
    return res.data.data;
  },
  async createMedicine(payload: Record<string, unknown>) {
    const res = await api.post('/medicines', payload);
    return res.data;
  },
  async updateMedicine(id: number, payload: Record<string, unknown>) {
    const res = await api.put(`/medicines/${id}`, payload);
    return res.data;
  },
  async updateStock(id: number, payload: { adjustment?: number; absoluteQuantity?: number }) {
    const res = await api.put(`/medicines/${id}/stock`, payload);
    return res.data;
  },
  async deleteMedicine(id: number) {
    const res = await api.delete(`/medicines/${id}`);
    return res.data;
  },
  async getLowStock() {
    const res = await api.get('/medicines/low-stock');
    return res.data.data;
  },
  async getExpired() {
    const res = await api.get('/medicines/expired');
    return res.data.data;
  },
  async getNearExpiry() {
    const res = await api.get('/medicines/near-expiry');
    return res.data.data;
  },
  async verifyPrescription(id: number) {
    const res = await api.put(`/prescriptions/${id}/verify`);
    return res.data;
  },
};

export const billingService = {
  async list(params?: Record<string, string | number>) {
    const res = await api.get('/billing', { params });
    return res.data.data;
  },
  async create(payload: Record<string, unknown>) {
    const res = await api.post('/billing', payload);
    return res.data;
  },
  async updatePaymentStatus(id: number, payload: Record<string, unknown>) {
    const res = await api.put(`/billing/${id}/payment-status`, payload);
    return res.data;
  },
};

export const visitService = {
  async list(params?: Record<string, string | number>) {
    const res = await api.get('/visits', { params });
    return res.data.data;
  },
  async checkIn(payload: Record<string, unknown>) {
    const res = await api.post('/visits/check-in', payload);
    return res.data;
  },
  async checkOut(id: number, payload?: { checkOutTime?: string; notes?: string }) {
    const res = await api.put(`/visits/${id}/check-out`, payload ?? {});
    return res.data;
  },
  async update(id: number, payload: Record<string, unknown>) {
    const res = await api.put(`/visits/${id}`, payload);
    return res.data;
  },
  async remove(id: number) {
    const res = await api.delete(`/visits/${id}`);
    return res.data;
  },
};
