import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  Droplets,
  Edit3,
  Eye,
  FileClock,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Stethoscope,
  Trash2,
  User,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';
import { DashboardLayout, NavItem } from '../../layouts/DashboardLayout';
import { StatCard } from '../../components/StatCard';
import { StatusText } from '../../components/StatusText';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { PatientHistoryPanel } from '../../components/PatientHistoryPanel';
import { appointmentService, patientService, visitService } from '../../services/clinicalServices';
import { lookupService } from '../../services/authService';
import { extractApiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatVisitDateTime, formatVisitDuration, nowLocalDateTimeInput } from '../../utils/visitTime';

const REG_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'register', label: 'Patient Registration', icon: UserPlus },
  { id: 'update-patient', label: 'Update Patient Details', icon: UserCog },
  { id: 'patients', label: 'Patient List', icon: Users },
  { id: 'visits', label: 'Visit Entry / Exit Log', icon: ArrowRightLeft },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'availability', label: 'Doctor Availability', icon: Clock },
  { id: 'history', label: 'Patient & Visit History', icon: FileClock },
];

const EMPTY_PATIENT_FORM = {
  fullName: '',
  dob: '',
  gender: 'Male',
  bloodGroup: 'O+',
  maritalStatus: 'Single',
  mobileNumber: '',
  alternatePhone: '',
  email: '',
  houseNumber: '',
  streetLocality: '',
  city: '',
  state: '',
  country: 'India',
  pinCode: '',
  emergencyContactName: '',
  emergencyRelationship: 'Spouse',
  emergencyContactNumber: '',
  idProofType: 'Aadhaar',
  idProofNumber: '',
  registrationDate: new Date().toISOString().slice(0, 10),
  registrationType: 'OPD',
  assignedDepartmentId: '',
  assignedDoctorId: '',
};

function computeAge(dobStr: string): string {
  if (!dobStr) return '—';
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return '—';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return `${Math.max(0, age)} yrs`;
}

export const RegistrationDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [departments, setDepartments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);

  // Dashboard state
  const [recentPatients, setRecentPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [availabilityList, setAvailabilityList] = useState<any[]>([]);
  const [totalPatientsCount, setTotalPatientsCount] = useState(0);

  // Registration / Edit patient form
  const [patientForm, setPatientForm] = useState({ ...EMPTY_PATIENT_FORM });
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null);
  const [editingPatientCode, setEditingPatientCode] = useState<string>('');
  const [updateSearch, setUpdateSearch] = useState('');
  const [updateCandidates, setUpdateCandidates] = useState<any[]>([]);
  const [savingPatient, setSavingPatient] = useState(false);

  // Patient List state
  const [patientsData, setPatientsData] = useState<{ items: any[]; pagination: any }>({
    items: [],
    pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
  });
  const [ptSearch, setPtSearch] = useState('');
  const [ptGender, setPtGender] = useState('');
  const [ptBloodGroup, setPtBloodGroup] = useState('');
  const [ptRegType, setPtRegType] = useState('');
  const [ptSortBy, setPtSortBy] = useState('id');
  const [ptSortDir, setPtSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [ptPage, setPtPage] = useState(1);

  // History link
  const [historyPatientId, setHistoryPatientId] = useState<number | null>(null);

  // Availability date & filters
  const [availDate, setAvailDate] = useState('2026-11-22');
  const [availDeptId, setAvailDeptId] = useState('');

  // Appointment scheduling modal
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [allPatientsDropdown, setAllPatientsDropdown] = useState<any[]>([]);
  const [apptForm, setApptForm] = useState({
    patientId: '',
    departmentId: '',
    doctorId: '',
    appointmentDate: '2026-11-22',
    timeSlot: '10:00',
    visitType: 'Consultation',
    reason: '',
  });
  const [apptAvailableSlots, setApptAvailableSlots] = useState<string[]>([]);

  // Visit Entry / Exit (Check-In / Check-Out) state
  const [visitsData, setVisitsData] = useState<{
    items: any[];
    summary: { totalVisits: number; inHospitalCount: number; checkedOutTodayCount: number; todayTotalCount: number };
  }>({
    items: [],
    summary: { totalVisits: 0, inHospitalCount: 0, checkedOutTodayCount: 0, todayTotalCount: 0 },
  });
  const [visitSearch, setVisitSearch] = useState('');
  const [visitStatusFilter, setVisitStatusFilter] = useState('');
  const [visitDateFilter, setVisitDateFilter] = useState('');
  const [savingVisit, setSavingVisit] = useState(false);
  const [checkInForm, setCheckInForm] = useState({
    patientId: '',
    departmentId: '',
    doctorId: '',
    visitType: 'OPD',
    checkInTime: nowLocalDateTimeInput(),
    purpose: '',
    notes: '',
  });
  const [checkOutModal, setCheckOutModal] = useState<{
    visit: any;
    checkOutTime: string;
    notes: string;
  } | null>(null);
  const [editVisitModal, setEditVisitModal] = useState<{
    visit: any;
    departmentId: string;
    doctorId: string;
    visitType: string;
    checkInTime: string;
    checkOutTime: string;
    purpose: string;
    notes: string;
  } | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const loadLookups = useCallback(async () => {
    try {
      const [depts, docs] = await Promise.all([lookupService.getDepartments(), lookupService.getDoctors()]);
      setDepartments(depts);
      setDoctors(docs);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  }, [showToast]);

  const loadPatientsList = useCallback(async () => {
    try {
      const data = await patientService.list({
        search: ptSearch,
        gender: ptGender,
        bloodGroup: ptBloodGroup,
        registrationType: ptRegType,
        sortBy: ptSortBy,
        sortDir: ptSortDir,
        page: ptPage,
        limit: 10,
      });
      setPatientsData(data);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  }, [ptSearch, ptGender, ptBloodGroup, ptRegType, ptSortBy, ptSortDir, ptPage, showToast]);

  const loadAvailability = useCallback(async (date: string, deptId?: string) => {
    try {
      const rows = await appointmentService.getAvailability({
        date,
        departmentId: deptId ? Number(deptId) : undefined,
      });
      setAvailabilityList(rows);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  }, [showToast]);

  const loadVisits = useCallback(async () => {
    try {
      const data = await visitService.list({
        search: visitSearch,
        status: visitStatusFilter,
        date: visitDateFilter,
        limit: 100,
      });
      setVisitsData(data);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  }, [visitSearch, visitStatusFilter, visitDateFilter, showToast]);

  const loadDashboard = useCallback(async () => {
    try {
      const [ptRes, appts, avail, visitRes] = await Promise.all([
        patientService.list({ limit: 5, page: 1 }),
        appointmentService.list(),
        appointmentService.getAvailability({ date: availDate }),
        visitService.list({ limit: 30 }),
      ]);
      setRecentPatients(ptRes.items || []);
      setTotalPatientsCount(ptRes.pagination?.total || 0);
      setAppointments(appts);
      setAvailabilityList(avail);
      setVisitsData(visitRes);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  }, [availDate, showToast]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'patients') {
      loadPatientsList();
    } else if (activeTab === 'visits') {
      loadVisits();
      patientService.list({ limit: 100 }).then((r) => setAllPatientsDropdown(r.items || [])).catch(() => {});
    } else if (activeTab === 'update-patient') {
      patientService
        .list({ search: updateSearch, limit: 12, page: 1 })
        .then((r) => setUpdateCandidates(r.items || []))
        .catch(() => {});
    } else if (activeTab === 'appointments') {
      appointmentService.list().then(setAppointments).catch((e) => showToast(extractApiError(e), 'error'));
      patientService.list({ limit: 100 }).then((r) => setAllPatientsDropdown(r.items || [])).catch(() => {});
    } else if (activeTab === 'availability') {
      loadAvailability(availDate, availDeptId);
    }
  }, [activeTab, loadDashboard, loadPatientsList, loadVisits, loadAvailability, availDate, availDeptId, updateSearch, showToast]);

  // Update open slots dynamically when doctor/date changes in appointment modal
  useEffect(() => {
    if (!apptModalOpen || !apptForm.doctorId || !apptForm.appointmentDate) return;
    appointmentService
      .getAvailability({
        date: apptForm.appointmentDate,
        doctorId: Number(apptForm.doctorId),
      })
      .then((rows) => {
        const slots = rows[0]?.availableSlots || [];
        setApptAvailableSlots(slots);
        if (slots.length > 0 && !slots.includes(apptForm.timeSlot)) {
          setApptForm((f) => ({ ...f, timeSlot: slots[0] }));
        }
      })
      .catch(() => {});
  }, [apptModalOpen, apptForm.doctorId, apptForm.appointmentDate]);

  const calculatedAgeDisplay = useMemo(() => computeAge(patientForm.dob), [patientForm.dob]);

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPatient(true);
    try {
      const payload = {
        ...patientForm,
        assignedDepartmentId: patientForm.assignedDepartmentId ? Number(patientForm.assignedDepartmentId) : null,
        assignedDoctorId: patientForm.assignedDoctorId ? Number(patientForm.assignedDoctorId) : null,
      };
      if (editingPatientId) {
        const res = await patientService.update(editingPatientId, payload);
        showToast(res.message || 'Patient details updated successfully.', 'success');
        setEditingPatientId(null);
        setEditingPatientCode('');
        setPatientForm({ ...EMPTY_PATIENT_FORM });
        setActiveTab('patients');
      } else {
        const res = await patientService.create(payload);
        showToast(res.message || 'Patient registered successfully.', 'success');
        setPatientForm({ ...EMPTY_PATIENT_FORM });
        setActiveTab('patients');
      }
    } catch (err) {
      showToast(extractApiError(err), 'error');
    } finally {
      setSavingPatient(false);
    }
  };

  const handleEditPatient = (p: any) => {
    setEditingPatientId(p.id);
    setEditingPatientCode(p.patient_code || '');
    setPatientForm({
      fullName: p.full_name || '',
      dob: p.dob || '',
      gender: p.gender || 'Male',
      bloodGroup: p.blood_group || 'O+',
      maritalStatus: p.marital_status || 'Single',
      mobileNumber: p.mobile_number || '',
      alternatePhone: p.alternate_phone || '',
      email: p.email || '',
      houseNumber: p.house_number || '',
      streetLocality: p.street_locality || '',
      city: p.city || '',
      state: p.state || '',
      country: p.country || 'India',
      pinCode: p.pin_code || '',
      emergencyContactName: p.emergency_contact_name || '',
      emergencyRelationship: p.emergency_relationship || 'Spouse',
      emergencyContactNumber: p.emergency_contact_number || '',
      idProofType: p.id_proof_type || 'Aadhaar',
      idProofNumber: p.id_proof_number || '',
      registrationDate: p.registration_date || new Date().toISOString().slice(0, 10),
      registrationType: p.registration_type || 'OPD',
      assignedDepartmentId: p.assigned_department_id ? String(p.assigned_department_id) : '',
      assignedDoctorId: p.assigned_doctor_id ? String(p.assigned_doctor_id) : '',
    });
    setActiveTab('update-patient');
  };

  const handleDeletePatient = (p: any) => {
    setConfirmState({
      open: true,
      title: 'Delete Patient Record',
      message: `Are you sure you want to delete ${p.full_name} (${p.patient_code})? This removes linked appointments and clinical records.`,
      onConfirm: async () => {
        try {
          const res = await patientService.remove(p.id);
          showToast(res.message, 'success');
          setConfirmState(null);
          await loadPatientsList();
        } catch (err) {
          showToast(extractApiError(err), 'error');
        }
      },
    });
  };

  const openBookAppointmentModal = async (prefill?: { doctorId?: number; departmentId?: number; date?: string; slot?: string }) => {
    try {
      const ptRes = await patientService.list({ limit: 100 });
      const items = ptRes.items || [];
      setAllPatientsDropdown(items);
      const firstDoc = doctors[0];
      setApptForm({
        patientId: items[0]?.id ? String(items[0].id) : '',
        departmentId: prefill?.departmentId
          ? String(prefill.departmentId)
          : firstDoc?.department_id
          ? String(firstDoc.department_id)
          : String(departments[0]?.id || ''),
        doctorId: prefill?.doctorId ? String(prefill.doctorId) : String(firstDoc?.id || ''),
        appointmentDate: prefill?.date || availDate,
        timeSlot: prefill?.slot || '10:00',
        visitType: 'Consultation',
        reason: '',
      });
      setApptModalOpen(true);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const submitAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await appointmentService.create({
        patientId: Number(apptForm.patientId),
        departmentId: Number(apptForm.departmentId),
        doctorId: Number(apptForm.doctorId),
        appointmentDate: apptForm.appointmentDate,
        timeSlot: apptForm.timeSlot,
        visitType: apptForm.visitType,
        reason: apptForm.reason,
      });
      showToast(res.message, 'success');
      setApptModalOpen(false);
      if (activeTab === 'appointments') {
        setAppointments(await appointmentService.list());
      } else if (activeTab === 'availability') {
        await loadAvailability(availDate, availDeptId);
      } else {
        await loadDashboard();
      }
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const updateApptStatus = async (id: number, status: string) => {
    try {
      await appointmentService.update(id, { status });
      showToast(`Appointment marked as ${status}.`, 'success');
      setAppointments(await appointmentService.list());
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const handleStartCheckInForPatient = (p: any) => {
    setCheckInForm({
      patientId: String(p.id),
      departmentId: p.assigned_department_id ? String(p.assigned_department_id) : '',
      doctorId: p.assigned_doctor_id ? String(p.assigned_doctor_id) : '',
      visitType: p.registration_type || 'OPD',
      checkInTime: nowLocalDateTimeInput(),
      purpose: '',
      notes: '',
    });
    setActiveTab('visits');
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInForm.patientId) {
      showToast('Please select a patient to check in.', 'error');
      return;
    }
    setSavingVisit(true);
    try {
      const res = await visitService.checkIn({
        patientId: Number(checkInForm.patientId),
        departmentId: checkInForm.departmentId ? Number(checkInForm.departmentId) : null,
        doctorId: checkInForm.doctorId ? Number(checkInForm.doctorId) : null,
        visitType: checkInForm.visitType,
        checkInTime: checkInForm.checkInTime || nowLocalDateTimeInput(),
        purpose: checkInForm.purpose,
        notes: checkInForm.notes,
      });
      showToast(res.message || 'Patient checked in successfully.', 'success');
      setCheckInForm((prev) => ({
        ...prev,
        checkInTime: nowLocalDateTimeInput(),
        purpose: '',
        notes: '',
      }));
      await loadVisits();
    } catch (err) {
      showToast(extractApiError(err), 'error');
    } finally {
      setSavingVisit(false);
    }
  };

  const openCheckOutModal = (visit: any) => {
    setCheckOutModal({
      visit,
      checkOutTime: nowLocalDateTimeInput(),
      notes: visit.notes || '',
    });
  };

  const submitCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkOutModal) return;
    setSavingVisit(true);
    try {
      const res = await visitService.checkOut(checkOutModal.visit.id, {
        checkOutTime: checkOutModal.checkOutTime,
        notes: checkOutModal.notes,
      });
      showToast(res.message || 'Patient checked out successfully.', 'success');
      setCheckOutModal(null);
      if (activeTab === 'dashboard') {
        await loadDashboard();
      } else {
        await loadVisits();
      }
    } catch (err) {
      showToast(extractApiError(err), 'error');
    } finally {
      setSavingVisit(false);
    }
  };

  const openEditVisitModal = (visit: any) => {
    setEditVisitModal({
      visit,
      departmentId: visit.department_id ? String(visit.department_id) : '',
      doctorId: visit.doctor_id ? String(visit.doctor_id) : '',
      visitType: visit.visit_type || 'OPD',
      checkInTime: visit.check_in_time ? String(visit.check_in_time).slice(0, 16) : nowLocalDateTimeInput(),
      checkOutTime: visit.check_out_time ? String(visit.check_out_time).slice(0, 16) : '',
      purpose: visit.purpose || '',
      notes: visit.notes || '',
    });
  };

  const submitEditVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVisitModal) return;
    setSavingVisit(true);
    try {
      const res = await visitService.update(editVisitModal.visit.id, {
        departmentId: editVisitModal.departmentId ? Number(editVisitModal.departmentId) : null,
        doctorId: editVisitModal.doctorId ? Number(editVisitModal.doctorId) : null,
        visitType: editVisitModal.visitType,
        checkInTime: editVisitModal.checkInTime,
        checkOutTime: editVisitModal.checkOutTime ? editVisitModal.checkOutTime : null,
        purpose: editVisitModal.purpose,
        notes: editVisitModal.notes,
      });
      showToast(res.message || 'Visit timings updated.', 'success');
      setEditVisitModal(null);
      await loadVisits();
    } catch (err) {
      showToast(extractApiError(err), 'error');
    } finally {
      setSavingVisit(false);
    }
  };

  const handleDeleteVisit = (v: any) => {
    setConfirmState({
      open: true,
      title: 'Delete Visit Record',
      message: `Remove visit entry ${v.visit_code} for ${v.patient_name}? This deletes its arrival/departure log.`,
      onConfirm: async () => {
        try {
          const res = await visitService.remove(v.id);
          showToast(res.message, 'success');
          setConfirmState(null);
          await loadVisits();
        } catch (err) {
          showToast(extractApiError(err), 'error');
        }
      },
    });
  };

  const scheduledApptCount = appointments.filter((a) => a.status === 'SCHEDULED').length;
  const availableDoctorsCount = availabilityList.filter((d) => d.isAvailable).length;
  const activeInHospitalVisits = visitsData.items.filter((v) => v.status === 'IN_HOSPITAL');

  return (
    <DashboardLayout
      roleLabel="Registration Staff"
      navItems={REG_NAV}
      activeTab={activeTab}
      onSelectTab={(tab) => {
        if (tab === 'register') {
          setEditingPatientId(null);
          setEditingPatientCode('');
          setPatientForm({ ...EMPTY_PATIENT_FORM });
        }
        setActiveTab(tab);
      }}
      primaryAction={
        <button
          type="button"
          onClick={() => {
            setEditingPatientId(null);
            setEditingPatientCode('');
            setPatientForm({ ...EMPTY_PATIENT_FORM });
            setActiveTab('register');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
        >
          <UserPlus className="h-3.5 w-3.5" /> Register Patient
        </button>
      }
    >
      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Registered Patients" value={totalPatientsCount} tone="primary" detail="Active patient directory records" />
            <StatCard label="Currently In Hospital" value={visitsData.summary.inHospitalCount} tone="warning" detail={`${visitsData.summary.checkedOutTodayCount} checked out today`} />
            <StatCard label="Scheduled Appointments" value={scheduledApptCount} detail="Upcoming consultations" />
            <StatCard label="Available Doctors" value={availableDoctorsCount} tone="success" detail={`For ${availDate}`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
              <div className="hmis-band-blue flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
                <h2 className="text-base font-bold text-[#0B1F3A]">Recent Patient Registrations</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('patients')}
                  className="text-xs font-semibold text-[#0284C7] hover:underline"
                >
                  Open Patient Directory
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="hmis-table-head">
                    <tr>
                      <th className="px-4 py-3">Patient ID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Age / Gender</th>
                      <th className="px-4 py-3">Mobile</th>
                      <th className="px-4 py-3">Reg. Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {recentPatients.map((p) => (
                      <tr key={p.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-mono font-semibold text-[#1D4ED8]">{p.patient_code}</td>
                        <td className="px-4 py-3 font-medium text-[#0F172A]">{p.full_name}</td>
                        <td className="px-4 py-3 tabular-nums text-[#475569]">
                          {p.age}y · {p.gender}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[#334155]">{p.mobile_number}</td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[#64748B]">{p.registration_date}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleEditPatient(p)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-[#1D4ED8] hover:bg-[#EFF6FF]"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Update
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
              <div className="hmis-band-teal flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
                <h2 className="text-base font-bold text-[#0B1F3A]">Doctor Slot Availability ({availDate})</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('availability')}
                  className="text-xs font-semibold text-[#0284C7] hover:underline"
                >
                  Check All Slots
                </button>
              </div>
              <div className="p-6 divide-y divide-[#F1F5F9]">
                {availabilityList.map((doc) => (
                  <div key={doc.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#0F172A]">{doc.full_name}</p>
                      <p className="text-[11px] text-[#64748B]">
                        {doc.department_name} · {doc.roomNumber || 'OPD'}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-[#0284C7] tabular-nums">
                      {doc.availableSlots.length} open slots
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Currently In Hospital (Live Entry / Exit Overview) */}
          <div className="overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-indigo flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A]">
                  Currently In Hospital ({activeInHospitalVisits.length})
                </h2>
                <p className="text-xs text-[#475569]">
                  Active patient check-ins awaiting departure (Check-Out) confirmation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('visits')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" /> Open Visit Entry / Exit Log
              </button>
            </div>
            {activeInHospitalVisits.length === 0 ? (
              <p className="p-6 text-xs text-[#64748B]">
                No patients are currently checked in. Use Visit Entry / Exit Log to record a new patient arrival.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="hmis-table-head">
                    <tr>
                      <th className="px-4 py-3">Visit ID</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Department & Doctor</th>
                      <th className="px-4 py-3">Arrived (Check-In)</th>
                      <th className="px-4 py-3">Stay So Far</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {activeInHospitalVisits.map((v) => (
                      <tr key={v.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-mono font-semibold text-[#1D4ED8] whitespace-nowrap">{v.visit_code}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#0F172A]">{v.patient_name}</p>
                          <p className="font-mono text-[11px] text-[#64748B]">{v.patient_code}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[#0F172A]">{v.department_name || 'General'}</p>
                          <p className="text-[11px] text-[#64748B]">{v.doctor_name || 'Front Desk'}</p>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[#334155] whitespace-nowrap">
                          {formatVisitDateTime(v.check_in_time)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[#0284C7] whitespace-nowrap">
                          {formatVisitDuration(v.check_in_time, v.check_out_time)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusText status={v.status} />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openCheckOutModal(v)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7]"
                          >
                            <LogOut className="h-3.5 w-3.5" /> Check Out
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryPatientId(v.patient_id);
                              setActiveTab('history');
                            }}
                            className="ml-1.5 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#0B1F3A] hover:bg-slate-100"
                          >
                            <FileClock className="h-3.5 w-3.5" /> History
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPDATE PATIENT PICKER */}
      {activeTab === 'update-patient' && (
        <div className="mb-6 overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
          <div className="hmis-band-blue flex flex-col gap-3 border-b border-[#E2E8F0] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0B1F3A]">Select Patient to Update Details</h2>
              <p className="mt-0.5 text-xs text-[#475569]">
                Search or pick a patient below to modify demographic, contact, address, emergency, or care assignment details.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={updateSearch}
                onChange={(e) => setUpdateSearch(e.target.value)}
                placeholder="Search ID, name, or mobile..."
                className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {updateCandidates.map((p) => {
                const isSelected = editingPatientId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleEditPatient(p)}
                    className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-[#0284C7] bg-[#EFF6FF]'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#0284C7]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#1D4ED8]">{p.patient_code}</span>
                      <span className="text-[11px] font-mono text-[#64748B] tabular-nums">{p.mobile_number}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#0B1F3A] truncate">{p.full_name}</p>
                    <p className="text-[11px] text-[#64748B] truncate">
                      {p.age}y · {p.gender} · {p.city}, {p.state}
                    </p>
                  </button>
                );
              })}
            </div>
            {updateCandidates.length === 0 && (
              <p className="text-xs text-[#64748B]">No matching patients found. Try a different Patient ID, name, or mobile number.</p>
            )}
          </div>
        </div>
      )}

      {/* PATIENT REGISTRATION / UPDATE FORM (ALL 6 SECTIONS) */}
      {(activeTab === 'register' || (activeTab === 'update-patient' && editingPatientId !== null)) && (
        <form onSubmit={handlePatientSubmit} className="space-y-6">
          {/* Form Header & Quick Section Index */}
          <div className="overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-blue flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] px-6 py-5">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0284C7] to-[#1D4ED8] text-white shadow-xs">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-[#0B1F3A]">
                    {editingPatientId ? 'Update Patient Details' : 'New Patient Registration'}
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-[#475569]">
                    Enter patient details across the six clinical intake sections below.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-[#BFDBFE] bg-white px-3.5 py-2 text-xs font-mono font-semibold text-[#1D4ED8] shadow-2xs">
                {editingPatientId
                  ? `Updating Record: ${editingPatientCode || `#${editingPatientId}`}`
                  : 'Patient ID: Auto-Generated (HMIS-PAT-XXXX)'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-6 py-3.5 bg-white">
              {[
                { id: 'reg-sec-1', num: '1', label: 'Demographics', accent: 'text-[#0284C7] border-[#BAE6FD] hover:bg-[#E0F2FE]/60' },
                { id: 'reg-sec-2', num: '2', label: 'Contact', accent: 'text-[#0D9488] border-[#99F6E4] hover:bg-[#CCFBF1]/60' },
                { id: 'reg-sec-3', num: '3', label: 'Address', accent: 'text-[#2563EB] border-[#BFDBFE] hover:bg-[#DBEAFE]/60' },
                { id: 'reg-sec-4', num: '4', label: 'Emergency', accent: 'text-[#E11D48] border-[#FECDD3] hover:bg-[#FFE4E6]/60' },
                { id: 'reg-sec-5', num: '5', label: 'ID Proof', accent: 'text-[#4F46E5] border-[#C7D2FE] hover:bg-[#E0E7FF]/60' },
                { id: 'reg-sec-6', num: '6', label: 'Care Assignment', accent: 'text-[#059669] border-[#A7F3D0] hover:bg-[#D1FAE5]/60' },
              ].map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={`inline-flex items-center gap-1.5 rounded-lg border bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${sec.accent}`}
                >
                  <span className="font-mono font-bold">{sec.num}.</span>
                  <span>{sec.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 1: Patient Information */}
          <section id="reg-sec-1" className="scroll-mt-24 overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-blue flex items-center gap-3.5 border-b border-[#E2E8F0] px-6 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0284C7] text-sm font-bold text-white shadow-2xs">
                1
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0B1F3A]">Patient Information</h3>
                <p className="text-xs text-[#475569]">
                  Legal name, date of birth (auto-calculates age), gender, blood group, and marital status.
                </p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Full Name <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0284C7]" />
                  <input
                    required
                    value={patientForm.fullName}
                    onChange={(e) => setPatientForm({ ...patientForm, fullName: e.target.value })}
                    placeholder="Enter patient's full legal name"
                    className="w-full rounded-lg border border-[#CBD5E1] py-2.5 pl-9 pr-3.5 text-sm focus:border-[#0284C7] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Date of Birth <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0284C7]" />
                  <input
                    required
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={patientForm.dob}
                    onChange={(e) => setPatientForm({ ...patientForm, dob: e.target.value })}
                    className="w-full rounded-lg border border-[#CBD5E1] py-2.5 pl-9 pr-3.5 text-sm focus:border-[#0284C7] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Calculated Age</label>
                <input
                  readOnly
                  value={calculatedAgeDisplay}
                  className="mt-1.5 w-full rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-2.5 text-sm font-mono font-bold tabular-nums text-[#1D4ED8]"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Gender <span className="text-[#DC2626]">*</span>
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {['Male', 'Female', 'Other'].map((g) => {
                    const selected = patientForm.gender === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setPatientForm({ ...patientForm, gender: g })}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 px-2 text-xs font-semibold transition-colors ${
                          selected
                            ? 'border-[#0284C7] bg-[#EFF6FF] text-[#0284C7]'
                            : 'border-[#CBD5E1] bg-white text-[#334155] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <span
                          className={`h-3 w-3 rounded-full border flex items-center justify-center ${
                            selected ? 'border-[#0284C7]' : 'border-[#94A3B8]'
                          }`}
                        >
                          {selected && <span className="h-1.5 w-1.5 rounded-full bg-[#0284C7]" />}
                        </span>
                        <span>{g}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Blood Group</label>
                <div className="relative mt-1.5">
                  <Droplets className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#DC2626]" />
                  <select
                    value={patientForm.bloodGroup}
                    onChange={(e) => setPatientForm({ ...patientForm, bloodGroup: e.target.value })}
                    className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-3.5 text-sm focus:border-[#0284C7] focus:outline-none"
                  >
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Marital Status</label>
                <select
                  value={patientForm.maritalStatus}
                  onChange={(e) => setPatientForm({ ...patientForm, maritalStatus: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm focus:border-[#0284C7] focus:outline-none"
                >
                  {['Single', 'Married', 'Widowed', 'Divorced'].map((ms) => (
                    <option key={ms} value={ms}>
                      {ms}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Section 2: Contact Information */}
          <section id="reg-sec-2" className="scroll-mt-24 overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-teal flex items-center gap-3.5 border-b border-[#E2E8F0] px-6 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0D9488] text-sm font-bold text-white shadow-2xs">
                2
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0B1F3A]">Contact Information</h3>
                <p className="text-xs text-[#475569]">
                  Primary mobile number for appointment notifications, alternate phone, and email address.
                </p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Mobile Number <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D9488]" />
                  <input
                    required
                    value={patientForm.mobileNumber}
                    onChange={(e) => setPatientForm({ ...patientForm, mobileNumber: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="w-full rounded-lg border border-[#CBD5E1] py-2.5 pl-9 pr-3.5 text-sm tabular-nums focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Alternate Phone</label>
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <input
                    value={patientForm.alternatePhone}
                    onChange={(e) => setPatientForm({ ...patientForm, alternatePhone: e.target.value })}
                    placeholder="Optional secondary number"
                    className="w-full rounded-lg border border-[#CBD5E1] py-2.5 pl-9 pr-3.5 text-sm tabular-nums focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Email Address</label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D9488]" />
                  <input
                    type="email"
                    value={patientForm.email}
                    onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
                    placeholder="patient@example.com"
                    className="w-full rounded-lg border border-[#CBD5E1] py-2.5 pl-9 pr-3.5 text-sm focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Address Information */}
          <section id="reg-sec-3" className="scroll-mt-24 overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-indigo flex items-center gap-3.5 border-b border-[#E2E8F0] px-6 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-sm font-bold text-white shadow-2xs">
                3
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0B1F3A]">Address Information</h3>
                <p className="text-xs text-[#475569]">
                  Current residential address including city, state, country, and postal PIN code.
                </p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">House / Flat Number</label>
                <div className="relative mt-1.5">
                  <Home className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2563EB]" />
                  <input
                    value={patientForm.houseNumber}
                    onChange={(e) => setPatientForm({ ...patientForm, houseNumber: e.target.value })}
                    placeholder="e.g. B-42, Sector 4"
                    className="w-full rounded-lg border border-[#CBD5E1] py-2.5 pl-9 pr-3.5 text-sm focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Street / Locality</label>
                <div className="relative mt-1.5">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2563EB]" />
                  <input
                    value={patientForm.streetLocality}
                    onChange={(e) => setPatientForm({ ...patientForm, streetLocality: e.target.value })}
                    placeholder="Colony, Road, or Landmark"
                    className="w-full rounded-lg border border-[#CBD5E1] py-2.5 pl-9 pr-3.5 text-sm focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  City <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  required
                  value={patientForm.city}
                  onChange={(e) => setPatientForm({ ...patientForm, city: e.target.value })}
                  placeholder="e.g. Lucknow"
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3.5 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  State / Union Territory <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  required
                  value={patientForm.state}
                  onChange={(e) => setPatientForm({ ...patientForm, state: e.target.value })}
                  placeholder="e.g. Uttar Pradesh"
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3.5 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Country <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  required
                  value={patientForm.country}
                  onChange={(e) => setPatientForm({ ...patientForm, country: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3.5 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">PIN Code</label>
                <input
                  value={patientForm.pinCode}
                  onChange={(e) => setPatientForm({ ...patientForm, pinCode: e.target.value })}
                  placeholder="6-digit postal code"
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3.5 py-2.5 text-sm tabular-nums focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Emergency Contact */}
          <section id="reg-sec-4" className="scroll-mt-24 overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-rose flex items-center gap-3.5 border-b border-[#E2E8F0] px-6 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E11D48] text-sm font-bold text-white shadow-2xs">
                4
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0B1F3A]">Emergency Contact</h3>
                <p className="text-xs text-[#475569]">
                  Guardian or family contact details required for emergency medical notifications.
                </p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Emergency Contact Name <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative mt-1.5">
                  <ShieldAlert className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E11D48]" />
                  <input
                    required
                    value={patientForm.emergencyContactName}
                    onChange={(e) => setPatientForm({ ...patientForm, emergencyContactName: e.target.value })}
                    placeholder="Full name of relative / guardian"
                    className="w-full rounded-lg border border-[#CBD5E1] py-2.5 pl-9 pr-3.5 text-sm focus:border-[#E11D48] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Relationship <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  required
                  value={patientForm.emergencyRelationship}
                  onChange={(e) => setPatientForm({ ...patientForm, emergencyRelationship: e.target.value })}
                  placeholder="e.g. Spouse, Father, Mother"
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3.5 py-2.5 text-sm focus:border-[#E11D48] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Emergency Contact Number <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E11D48]" />
                  <input
                    required
                    value={patientForm.emergencyContactNumber}
                    onChange={(e) => setPatientForm({ ...patientForm, emergencyContactNumber: e.target.value })}
                    placeholder="10-digit emergency phone"
                    className="w-full rounded-lg border border-[#CBD5E1] py-2.5 pl-9 pr-3.5 text-sm tabular-nums focus:border-[#E11D48] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Identification Information */}
          <section id="reg-sec-5" className="scroll-mt-24 overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-violet flex items-center gap-3.5 border-b border-[#E2E8F0] px-6 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-sm font-bold text-white shadow-2xs">
                5
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0B1F3A]">Identification Information</h3>
                <p className="text-xs text-[#475569]">
                  Government-issued identity document used for hospital verification and billing.
                </p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">ID Proof Type</label>
                <div className="relative mt-1.5">
                  <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4F46E5]" />
                  <select
                    value={patientForm.idProofType}
                    onChange={(e) => setPatientForm({ ...patientForm, idProofType: e.target.value })}
                    className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-3.5 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    {['Aadhaar', 'PAN', 'Passport', 'Driving License', 'Birth Certificate'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">ID Proof Number</label>
                <input
                  value={patientForm.idProofNumber}
                  onChange={(e) => setPatientForm({ ...patientForm, idProofNumber: e.target.value })}
                  placeholder="e.g. XXXX-XXXX-1234"
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3.5 py-2.5 text-sm font-mono focus:border-[#4F46E5] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Section 6: Registration Information */}
          <section id="reg-sec-6" className="scroll-mt-24 overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-emerald flex items-center gap-3.5 border-b border-[#E2E8F0] px-6 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#059669] text-sm font-bold text-white shadow-2xs">
                6
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0B1F3A]">Registration & Care Assignment</h3>
                <p className="text-xs text-[#475569]">
                  Admission visit type (OPD, IPD, Emergency), clinical department, and consulting doctor assignment.
                </p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Registration Date <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#059669]" />
                  <input
                    required
                    type="date"
                    value={patientForm.registrationDate}
                    onChange={(e) => setPatientForm({ ...patientForm, registrationDate: e.target.value })}
                    className="w-full rounded-lg border border-[#CBD5E1] py-2.5 pl-9 pr-3.5 text-sm focus:border-[#059669] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Registration Type <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  value={patientForm.registrationType}
                  onChange={(e) => setPatientForm({ ...patientForm, registrationType: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm font-medium focus:border-[#059669] focus:outline-none"
                >
                  <option value="OPD">OPD (Outpatient)</option>
                  <option value="IPD">IPD (Inpatient)</option>
                  <option value="EMERGENCY">EMERGENCY</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Assigned Department</label>
                <div className="relative mt-1.5">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#059669]" />
                  <select
                    value={patientForm.assignedDepartmentId}
                    onChange={(e) => {
                      const nextDeptId = e.target.value;
                      const currentDoc = doctors.find((d) => String(d.id) === patientForm.assignedDoctorId);
                      const keepDoctor =
                        !nextDeptId || !currentDoc || String(currentDoc.department_id) === nextDeptId;
                      setPatientForm({
                        ...patientForm,
                        assignedDepartmentId: nextDeptId,
                        assignedDoctorId: keepDoctor ? patientForm.assignedDoctorId : '',
                      });
                    }}
                    className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-3.5 text-sm focus:border-[#059669] focus:outline-none"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Assigned Doctor</label>
                <div className="relative mt-1.5">
                  <Stethoscope className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#059669]" />
                  <select
                    value={patientForm.assignedDoctorId}
                    onChange={(e) => setPatientForm({ ...patientForm, assignedDoctorId: e.target.value })}
                    className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-3.5 text-sm focus:border-[#059669] focus:outline-none"
                  >
                    <option value="">Select Doctor</option>
                    {doctors
                      .filter((doc) => !patientForm.assignedDepartmentId || String(doc.department_id) === patientForm.assignedDepartmentId)
                      .map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.full_name}{doc.specialization ? ` — ${doc.specialization}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Form Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#CBD5E1]/80 bg-white p-5">
            <p className="text-xs text-[#475569]">
              Fields marked with <span className="font-semibold text-[#DC2626]">*</span> are mandatory for patient registration.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingPatient}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-6 py-2.5 text-xs font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF] shadow-xs disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" />
                {savingPatient ? 'Saving...' : editingPatientId ? 'Save Updated Details' : 'Register Patient'}
              </button>
              {!editingPatientId && (
                <button
                  type="button"
                  onClick={() => setPatientForm({ ...EMPTY_PATIENT_FORM })}
                  className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2.5 text-xs font-semibold text-[#334155] hover:bg-slate-50"
                >
                  Reset / Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingPatientId(null);
                  setEditingPatientCode('');
                  setPatientForm({ ...EMPTY_PATIENT_FORM });
                  setActiveTab('patients');
                }}
                className="rounded-lg px-4 py-2.5 text-xs font-semibold text-[#475569] hover:text-[#0F172A]"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* PATIENT LIST (SEARCH, FILTER, SORT, PAGINATION) */}
      {activeTab === 'patients' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={ptSearch}
                onChange={(e) => {
                  setPtSearch(e.target.value);
                  setPtPage(1);
                }}
                placeholder="Search by Patient ID, Name, or Mobile..."
                className="w-full rounded-lg border border-[#CBD5E1] py-2 pl-9 pr-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={ptGender}
                onChange={(e) => {
                  setPtGender(e.target.value);
                  setPtPage(1);
                }}
                className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-2 text-xs text-[#334155]"
              >
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>

              <select
                value={ptBloodGroup}
                onChange={(e) => {
                  setPtBloodGroup(e.target.value);
                  setPtPage(1);
                }}
                className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-2 text-xs text-[#334155]"
              >
                <option value="">All Blood Groups</option>
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>

              <select
                value={ptRegType}
                onChange={(e) => {
                  setPtRegType(e.target.value);
                  setPtPage(1);
                }}
                className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-2 text-xs text-[#334155]"
              >
                <option value="">All Reg. Types</option>
                <option value="OPD">OPD</option>
                <option value="IPD">IPD</option>
                <option value="EMERGENCY">EMERGENCY</option>
              </select>

              <select
                value={`${ptSortBy}:${ptSortDir}`}
                onChange={(e) => {
                  const [col, dir] = e.target.value.split(':');
                  setPtSortBy(col);
                  setPtSortDir(dir as 'ASC' | 'DESC');
                }}
                className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-2 text-xs text-[#334155]"
              >
                <option value="id:DESC">Newest Registered</option>
                <option value="patient_code:ASC">Patient ID (A–Z)</option>
                <option value="full_name:ASC">Name (A–Z)</option>
                <option value="age:DESC">Age (High–Low)</option>
                <option value="registration_date:DESC">Reg. Date (Latest)</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-blue flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
              <h2 className="text-sm font-bold text-[#0B1F3A]">Registered Patient Directory</h2>
              <span className="text-xs font-mono font-semibold text-[#0284C7] tabular-nums">
                Total Patients: {patientsData.pagination?.total ?? patientsData.items.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="hmis-table-head">
                  <tr>
                    <th className="px-3 py-3">Patient ID</th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">DOB</th>
                    <th className="px-3 py-3 text-right">Age</th>
                    <th className="px-3 py-3">Gender</th>
                    <th className="px-3 py-3">Blood Group</th>
                    <th className="px-3 py-3">Mobile Number</th>
                    <th className="px-3 py-3">Country</th>
                    <th className="px-3 py-3">State</th>
                    <th className="px-3 py-3">Reg. Date</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {patientsData.items.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-3 py-3 font-mono font-semibold text-[#1D4ED8] whitespace-nowrap">{p.patient_code}</td>
                      <td className="px-3 py-3 font-medium text-[#0F172A] whitespace-nowrap">{p.full_name}</td>
                      <td className="px-3 py-3 font-mono tabular-nums text-[#475569] whitespace-nowrap">{p.dob}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-[#0F172A]">{p.age}</td>
                      <td className="px-3 py-3 text-[#334155]">{p.gender}</td>
                      <td className="px-3 py-3 font-mono font-medium text-[#0B1F3A]">{p.blood_group || '—'}</td>
                      <td className="px-3 py-3 font-mono tabular-nums text-[#334155] whitespace-nowrap">{p.mobile_number}</td>
                      <td className="px-3 py-3 text-[#475569]">{p.country}</td>
                      <td className="px-3 py-3 text-[#475569]">{p.state}</td>
                      <td className="px-3 py-3 font-mono tabular-nums text-[#64748B] whitespace-nowrap">{p.registration_date}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleStartCheckInForPatient(p)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-[#0D9488] hover:bg-teal-50"
                          title="Record Hospital Arrival (Check-In)"
                        >
                          <LogIn className="h-3.5 w-3.5" /> Check In
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryPatientId(p.id);
                            setActiveTab('history');
                          }}
                          className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#0B1F3A] hover:bg-slate-100"
                          title="View Patient & Visit History"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditPatient(p)}
                          className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-[#EFF6FF]"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePatient(p)}
                          className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2]"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {patientsData.items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No patients found"
                  description="Adjust your search query or filters, or register a new patient."
                  actionLabel="Register Patient"
                  onAction={() => setActiveTab('register')}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 text-xs text-[#64748B]">
                <span className="tabular-nums">
                  Showing page {patientsData.pagination.page} of {patientsData.pagination.totalPages} ({patientsData.pagination.total}{' '}
                  patients)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={ptPage <= 1}
                    onClick={() => setPtPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-[#CBD5E1] px-3 py-1 font-medium text-[#334155] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={ptPage >= patientsData.pagination.totalPages}
                    onClick={() => setPtPage((p) => p + 1)}
                    className="rounded border border-[#CBD5E1] px-3 py-1 font-medium text-[#334155] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PATIENT VISIT ENTRY / EXIT LOG & CHECK-IN / CHECK-OUT */}
      {activeTab === 'visits' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Currently In Hospital"
              value={visitsData.summary.inHospitalCount}
              tone="warning"
              detail="Checked in, awaiting departure"
            />
            <StatCard
              label="Checked Out Today"
              value={visitsData.summary.checkedOutTodayCount}
              tone="success"
              detail="Completed hospital visits today"
            />
            <StatCard
              label="Visits Today"
              value={visitsData.summary.todayTotalCount}
              tone="primary"
              detail="Total arrivals logged today"
            />
            <StatCard
              label="Total Visit History"
              value={visitsData.summary.totalVisits}
              detail="All historical arrival & exit logs"
            />
          </div>

          {/* Record Patient Arrival (Check-In) Form */}
          <form onSubmit={handleCheckInSubmit} className="overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-teal flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D9488] text-white shadow-xs">
                  <LogIn className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0B1F3A]">Record Patient Arrival (Check-In)</h2>
                  <p className="text-xs text-[#475569]">
                    Log exact date and time when a patient enters the hospital for OPD, IPD, Emergency, Diagnostic, or Pharmacy visits.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckInForm((prev) => ({ ...prev, checkInTime: nowLocalDateTimeInput() }))}
                className="rounded-lg border border-[#99F6E4] bg-white px-3 py-1.5 text-xs font-semibold text-[#0D9488] hover:bg-[#CCFBF1]/50"
              >
                Use Current Time
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Select Patient <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  required
                  value={checkInForm.patientId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const matched = allPatientsDropdown.find((pt) => String(pt.id) === pid);
                    setCheckInForm((prev) => ({
                      ...prev,
                      patientId: pid,
                      departmentId: matched?.assigned_department_id ? String(matched.assigned_department_id) : prev.departmentId,
                      doctorId: matched?.assigned_doctor_id ? String(matched.assigned_doctor_id) : prev.doctorId,
                      visitType: matched?.registration_type || prev.visitType,
                    }));
                  }}
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="">Select Patient (ID — Name — Mobile)</option>
                  {allPatientsDropdown.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_code} — {p.full_name} ({p.mobile_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Visit Type</label>
                <select
                  value={checkInForm.visitType}
                  onChange={(e) => setCheckInForm({ ...checkInForm, visitType: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="OPD">OPD (Outpatient)</option>
                  <option value="FOLLOW_UP">Follow-Up</option>
                  <option value="DIAGNOSTIC">Diagnostic / Lab</option>
                  <option value="PHARMACY">Pharmacy Refill</option>
                  <option value="IPD">IPD Admission</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">
                  Arrival Date & Time <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  required
                  type="datetime-local"
                  value={checkInForm.checkInTime}
                  onChange={(e) => setCheckInForm({ ...checkInForm, checkInTime: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm font-mono focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Department</label>
                <select
                  value={checkInForm.departmentId}
                  onChange={(e) => {
                    const deptId = e.target.value;
                    const doc = doctors.find((d) => String(d.id) === checkInForm.doctorId);
                    const keepDoc = !deptId || !doc || String(doc.department_id) === deptId;
                    setCheckInForm({
                      ...checkInForm,
                      departmentId: deptId,
                      doctorId: keepDoc ? checkInForm.doctorId : '',
                    });
                  }}
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="">Front Desk / General</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Doctor</label>
                <select
                  value={checkInForm.doctorId}
                  onChange={(e) => setCheckInForm({ ...checkInForm, doctorId: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="">No Specific Doctor</option>
                  {doctors
                    .filter((d) => !checkInForm.departmentId || String(d.department_id) === checkInForm.departmentId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Purpose of Visit</label>
                <input
                  value={checkInForm.purpose}
                  onChange={(e) => setCheckInForm({ ...checkInForm, purpose: e.target.value })}
                  placeholder="e.g. Cardiology checkup, Lab test"
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3.5 py-2.5 text-sm focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0B1F3A]">Front-Desk Notes</label>
                <input
                  value={checkInForm.notes}
                  onChange={(e) => setCheckInForm({ ...checkInForm, notes: e.target.value })}
                  placeholder="Token / ward / escort notes"
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3.5 py-2.5 text-sm focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] px-6 py-3.5 bg-[#F8FAFC]">
              <p className="text-xs text-[#64748B]">
                Once checked in, click <strong>Check Out</strong> in the table below when the patient leaves the hospital.
              </p>
              <button
                type="submit"
                disabled={savingVisit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0F766E] shadow-xs disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" />
                {savingVisit ? 'Checking In...' : 'Check In Patient'}
              </button>
            </div>
          </form>

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={visitSearch}
                onChange={(e) => setVisitSearch(e.target.value)}
                placeholder="Search Visit ID, Patient ID, Name, Mobile, Purpose..."
                className="w-full rounded-lg border border-[#CBD5E1] py-2 pl-9 pr-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: '', label: 'All Visits' },
                { key: 'IN_HOSPITAL', label: 'In Hospital' },
                { key: 'CHECKED_OUT', label: 'Checked Out' },
              ].map((st) => (
                <button
                  key={st.key || 'ALL'}
                  type="button"
                  onClick={() => setVisitStatusFilter(st.key)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    visitStatusFilter === st.key
                      ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8]'
                      : 'border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {st.label}
                </button>
              ))}

              <input
                type="date"
                value={visitDateFilter}
                onChange={(e) => setVisitDateFilter(e.target.value)}
                className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#334155]"
              />
              {visitDateFilter && (
                <button
                  type="button"
                  onClick={() => setVisitDateFilter('')}
                  className="rounded-lg border border-[#CBD5E1] px-2.5 py-1.5 text-xs font-medium text-[#475569] hover:bg-slate-50"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          {/* Visit Log Table */}
          <div className="overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="hmis-band-blue flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
              <div>
                <h2 className="text-sm font-bold text-[#0B1F3A]">Patient Visit History — Hospital Entry & Exit Log</h2>
                <p className="text-[11px] text-[#475569]">
                  Tracks exact patient arrival time, departure time, total stay duration, and front-desk sign-off.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-[#0284C7] tabular-nums">
                Showing: {visitsData.items.length}
              </span>
            </div>

            {visitsData.items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No visit entries match your filter"
                  description="Clear your filters or use the Check-In form above when a patient arrives at the hospital."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="hmis-table-head">
                    <tr>
                      <th className="px-3 py-3">Visit ID</th>
                      <th className="px-3 py-3">Patient</th>
                      <th className="px-3 py-3">Dept / Doctor / Type</th>
                      <th className="px-3 py-3">Arrived (Check-In)</th>
                      <th className="px-3 py-3">Left (Check-Out)</th>
                      <th className="px-3 py-3">Duration</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {visitsData.items.map((v) => (
                      <tr key={v.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-3 py-3 font-mono font-semibold text-[#1D4ED8] whitespace-nowrap">{v.visit_code}</td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-[#0F172A] whitespace-nowrap">{v.patient_name}</p>
                          <p className="font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                            {v.patient_code} · {v.patient_mobile}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-[#0B1F3A]">
                            {v.visit_type} · {v.department_name || 'General'}
                          </p>
                          <p className="text-[11px] text-[#475569]">{v.purpose || v.doctor_name || 'Walk-in visit'}</p>
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums text-[#0F172A] whitespace-nowrap">
                          {formatVisitDateTime(v.check_in_time)}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums whitespace-nowrap">
                          {v.check_out_time ? (
                            <span className="text-[#334155]">{formatVisitDateTime(v.check_out_time)}</span>
                          ) : (
                            <span className="font-sans font-semibold text-[#0284C7]">Still In Hospital</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums text-[#475569] whitespace-nowrap">
                          {formatVisitDuration(v.check_in_time, v.check_out_time)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <StatusText status={v.status} />
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {v.status === 'IN_HOSPITAL' && (
                            <button
                              type="button"
                              onClick={() => openCheckOutModal(v)}
                              className="inline-flex items-center gap-1 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7]"
                              title="Record Departure (Check-Out)"
                            >
                              <LogOut className="h-3.5 w-3.5" /> Check Out
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditVisitModal(v)}
                            className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-[#EFF6FF]"
                            title="Edit Check-In / Check-Out Timings"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryPatientId(v.patient_id);
                              setActiveTab('history');
                            }}
                            className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#0B1F3A] hover:bg-slate-100"
                            title="Open Full Patient & Visit History"
                          >
                            <FileClock className="h-3.5 w-3.5" /> History
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVisit(v)}
                            className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2]"
                            title="Delete Visit Log"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748B]">Schedule, update, or cancel patient consultations with slot double-booking checks.</p>
            <button
              type="button"
              onClick={() => openBookAppointmentModal()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Schedule Appointment
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="hmis-table-head">
                  <tr>
                    <th className="px-4 py-3">Appt. ID</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Doctor & Dept</th>
                    <th className="px-4 py-3">Date & Slot</th>
                    <th className="px-4 py-3">Visit Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {appointments.map((a) => (
                    <tr key={a.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono font-semibold text-[#0B1F3A]">{a.appointment_code}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#0F172A]">{a.patient_name}</p>
                        <p className="font-mono text-[11px] text-[#64748B]">{a.patient_code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[#0F172A]">{a.doctor_name}</p>
                        <p className="text-[11px] text-[#64748B]">{a.department_name}</p>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-[#334155]">
                        {a.appointment_date} · {a.time_slot}
                      </td>
                      <td className="px-4 py-3 text-[#475569]">{a.visit_type}</td>
                      <td className="px-4 py-3">
                        <StatusText status={a.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {a.status === 'SCHEDULED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateApptStatus(a.id, 'COMPLETED')}
                              className="rounded px-2 py-1 text-xs font-medium text-[#15803D] hover:bg-emerald-50"
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => updateApptStatus(a.id, 'CANCELLED')}
                              className="ml-1 rounded px-2 py-1 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2]"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {a.status !== 'SCHEDULED' && <span className="text-[11px] text-[#94A3B8]">Closed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DOCTOR AVAILABILITY */}
      {activeTab === 'availability' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-white p-4">
            <div>
              <h2 className="text-sm font-semibold text-[#0B1F3A]">Doctor Slot Availability</h2>
              <p className="text-xs text-[#64748B]">Click any open slot to schedule an appointment directly.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={availDate}
                onChange={(e) => setAvailDate(e.target.value)}
                className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs text-[#0F172A]"
              />
              <select
                value={availDeptId}
                onChange={(e) => setAvailDeptId(e.target.value)}
                className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#334155]"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {availabilityList.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 border-b border-[#F1F5F9] pb-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0B1F3A]">{doc.full_name}</p>
                    <p className="text-xs text-[#475569]">
                      {doc.department_name} · {doc.specialization}
                    </p>
                    <p className="mt-0.5 text-[11px] font-mono text-[#64748B]">
                      {doc.roomNumber ? `Room ${doc.roomNumber}` : 'Off Duty'} · Shift {doc.shiftWindow || 'N/A'} · Fee ₹
                      {doc.consultation_fee}
                    </p>
                  </div>
                  <StatusText status={doc.isAvailable ? 'ACTIVE' : 'INACTIVE'} />
                </div>

                <div className="mt-3">
                  {doc.availableSlots.length === 0 ? (
                    <p className="text-xs text-[#64748B]">No open slots on {doc.date} ({doc.dayOfWeek}).</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {doc.availableSlots.map((slot: string) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() =>
                            openBookAppointmentModal({
                              doctorId: doc.id,
                              departmentId: doc.department_id,
                              date: doc.date,
                              slot,
                            })
                          }
                          className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-mono font-medium text-[#1D4ED8] hover:bg-[#1D4ED8] hover:text-white transition-colors tabular-nums"
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PATIENT HISTORY */}
      {activeTab === 'history' && <PatientHistoryPanel initialPatientId={historyPatientId} />}

      {/* SCHEDULE APPOINTMENT MODAL */}
      {apptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">Schedule Appointment</h3>
            <form onSubmit={submitAppointment} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Patient *</label>
                <select
                  required
                  value={apptForm.patientId}
                  onChange={(e) => setApptForm({ ...apptForm, patientId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  {allPatientsDropdown.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_code} — {p.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Department *</label>
                  <select
                    required
                    value={apptForm.departmentId}
                    onChange={(e) => {
                      const deptId = e.target.value;
                      const firstInDept = doctors.find((d) => String(d.department_id) === deptId);
                      setApptForm({
                        ...apptForm,
                        departmentId: deptId,
                        doctorId: firstInDept ? String(firstInDept.id) : apptForm.doctorId,
                      });
                    }}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Doctor *</label>
                  <select
                    required
                    value={apptForm.doctorId}
                    onChange={(e) => setApptForm({ ...apptForm, doctorId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                  >
                    {doctors
                      .filter((d) => !apptForm.departmentId || String(d.department_id) === apptForm.departmentId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Appointment Date *</label>
                  <input
                    required
                    type="date"
                    value={apptForm.appointmentDate}
                    onChange={(e) => setApptForm({ ...apptForm, appointmentDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Available Time Slot *</label>
                  <select
                    required
                    value={apptForm.timeSlot}
                    onChange={(e) => setApptForm({ ...apptForm, timeSlot: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-mono"
                  >
                    {apptAvailableSlots.length === 0 ? (
                      <option value="">No slots available</option>
                    ) : (
                      apptAvailableSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Visit Type</label>
                <select
                  value={apptForm.visitType}
                  onChange={(e) => setApptForm({ ...apptForm, visitType: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  <option value="Consultation">Consultation</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Diagnostic Review">Diagnostic Review</option>
                  <option value="Vaccination">Vaccination</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Reason / Chief Complaint</label>
                <input
                  value={apptForm.reason}
                  onChange={(e) => setApptForm({ ...apptForm, reason: e.target.value })}
                  placeholder="Brief reason for visit"
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setApptModalOpen(false)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={apptAvailableSlots.length === 0}
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-50"
                >
                  Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECK-OUT MODAL */}
      {checkOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#15803D] text-white">
                <LogOut className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#0B1F3A]">Record Patient Departure (Check-Out)</h3>
                <p className="text-xs text-[#64748B]">
                  {checkOutModal.visit.visit_code} · {checkOutModal.visit.patient_name}
                </p>
              </div>
            </div>
            <form onSubmit={submitCheckOut} className="mt-4 space-y-3">
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#475569]">
                Arrived at:{' '}
                <strong className="font-mono text-[#0B1F3A]">{formatVisitDateTime(checkOutModal.visit.check_in_time)}</strong>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#334155]">Departure Date & Time *</label>
                  <button
                    type="button"
                    onClick={() => setCheckOutModal({ ...checkOutModal, checkOutTime: nowLocalDateTimeInput() })}
                    className="text-[11px] font-semibold text-[#0284C7] hover:underline"
                  >
                    Set Now
                  </button>
                </div>
                <input
                  required
                  type="datetime-local"
                  value={checkOutModal.checkOutTime}
                  onChange={(e) => setCheckOutModal({ ...checkOutModal, checkOutTime: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Exit / Discharge Remarks</label>
                <textarea
                  rows={2}
                  value={checkOutModal.notes}
                  onChange={(e) => setCheckOutModal({ ...checkOutModal, notes: e.target.value })}
                  placeholder="Optional exit notes (e.g. billing settled, meds collected)"
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCheckOutModal(null)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVisit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#15803D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#166534] disabled:opacity-60"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {savingVisit ? 'Saving...' : 'Confirm Check-Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VISIT DETAILS MODAL */}
      {editVisitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">
              Edit Visit Record — {editVisitModal.visit.visit_code}
            </h3>
            <p className="text-xs text-[#64748B]">
              {editVisitModal.visit.patient_name} ({editVisitModal.visit.patient_code})
            </p>
            <form onSubmit={submitEditVisit} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Arrival (Check-In) *</label>
                  <input
                    required
                    type="datetime-local"
                    value={editVisitModal.checkInTime}
                    onChange={(e) => setEditVisitModal({ ...editVisitModal, checkInTime: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Departure (Check-Out)</label>
                  <input
                    type="datetime-local"
                    value={editVisitModal.checkOutTime}
                    onChange={(e) => setEditVisitModal({ ...editVisitModal, checkOutTime: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Visit Type</label>
                  <select
                    value={editVisitModal.visitType}
                    onChange={(e) => setEditVisitModal({ ...editVisitModal, visitType: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="OPD">OPD</option>
                    <option value="FOLLOW_UP">FOLLOW_UP</option>
                    <option value="DIAGNOSTIC">DIAGNOSTIC</option>
                    <option value="PHARMACY">PHARMACY</option>
                    <option value="IPD">IPD</option>
                    <option value="EMERGENCY">EMERGENCY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Department</label>
                  <select
                    value={editVisitModal.departmentId}
                    onChange={(e) => setEditVisitModal({ ...editVisitModal, departmentId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="">General</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Doctor</label>
                  <select
                    value={editVisitModal.doctorId}
                    onChange={(e) => setEditVisitModal({ ...editVisitModal, doctorId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="">Front Desk</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Purpose</label>
                <input
                  value={editVisitModal.purpose}
                  onChange={(e) => setEditVisitModal({ ...editVisitModal, purpose: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Notes</label>
                <textarea
                  rows={2}
                  value={editVisitModal.notes}
                  onChange={(e) => setEditVisitModal({ ...editVisitModal, notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditVisitModal(null)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVisit}
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                >
                  {savingVisit ? 'Updating...' : 'Save Visit Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          destructive
          confirmLabel="Delete"
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </DashboardLayout>
  );
};
