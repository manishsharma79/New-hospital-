import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  CalendarClock,
  IndianRupee,
  LayoutDashboard,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Edit3,
} from 'lucide-react';
import { DashboardLayout, NavItem } from '../../layouts/DashboardLayout';
import { StatCard } from '../../components/StatCard';
import { StatusText } from '../../components/StatusText';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { adminService } from '../../services/authService';
import { extractApiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const ADMIN_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'staff', label: 'Staff Management', icon: Users },
  { id: 'departments', label: 'Department Management', icon: Building2 },
  { id: 'roles', label: 'Roles & Permissions', icon: ShieldCheck },
  { id: 'schedules', label: 'Staff Schedules', icon: CalendarClock },
  { id: 'overview', label: 'Hospital Overview', icon: Activity },
  { id: 'billing', label: 'Billing Overview', icon: IndianRupee },
];

export const AdminDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [rolesData, setRolesData] = useState<{ roles: any[]; permissions: any[] }>({ roles: [], permissions: [] });
  const [schedules, setSchedules] = useState<any[]>([]);
  const [billingData, setBillingData] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);

  // Staff filters & modal
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('');
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    roleName: 'DOCTOR',
    departmentId: '',
    specialization: '',
    qualification: '',
    consultationFee: '600',
    status: 'ACTIVE',
  });

  // Department modal
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [deptForm, setDeptForm] = useState({
    name: '',
    headDoctorName: '',
    location: '',
    phoneExt: '',
    description: '',
    status: 'ACTIVE',
  });

  // Schedule modal
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedForm, setSchedForm] = useState({
    staffId: '',
    departmentId: '',
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '16:00',
    slotDurationMinutes: '30',
    maxPatients: '14',
    roomNumber: 'OPD-101',
    isAvailable: true,
  });

  // Roles & Permissions state
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<number[]>([]);

  // Billing filter
  const [billFilter, setBillFilter] = useState('');

  // Confirm Dialog
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const loadTabData = useCallback(async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'dashboard') {
        const data = await adminService.getDashboard();
        setDashboardData(data);
      } else if (tab === 'staff') {
        const [st, depts] = await Promise.all([adminService.getStaff(), adminService.getDepartments()]);
        setStaffList(st);
        setDepartments(depts);
      } else if (tab === 'departments') {
        const depts = await adminService.getDepartments();
        setDepartments(depts);
      } else if (tab === 'roles') {
        const data = await adminService.getRolesAndPermissions();
        setRolesData(data);
        if (data.roles.length > 0) {
          const target = data.roles[0];
          setSelectedRoleId(target.id);
          setSelectedPermIds(target.permissionIds || []);
        }
      } else if (tab === 'schedules') {
        const [sch, st, depts] = await Promise.all([
          adminService.getSchedules(),
          adminService.getStaff(),
          adminService.getDepartments(),
        ]);
        setSchedules(sch);
        setStaffList(st);
        setDepartments(depts);
      } else if (tab === 'overview') {
        const [dash, acts] = await Promise.all([adminService.getDashboard(), adminService.getActivities()]);
        setDashboardData(dash);
        setActivities(acts);
      } else if (tab === 'billing') {
        const b = await adminService.getBillingOverview();
        setBillingData(b);
      }
    } catch (err) {
      showToast(extractApiError(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  // Staff handlers
  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({
      fullName: '',
      email: '',
      password: '',
      phone: '',
      roleName: 'DOCTOR',
      departmentId: departments[0]?.id ? String(departments[0].id) : '',
      specialization: '',
      qualification: '',
      consultationFee: '600',
      status: 'ACTIVE',
    });
    setStaffModalOpen(true);
  };

  const openEditStaff = (s: any) => {
    setEditingStaff(s);
    setStaffForm({
      fullName: s.full_name || '',
      email: s.email || '',
      password: '',
      phone: s.phone || '',
      roleName: s.role_name || 'DOCTOR',
      departmentId: s.department_id ? String(s.department_id) : '',
      specialization: s.specialization || '',
      qualification: s.qualification || '',
      consultationFee: String(s.consultation_fee ?? 0),
      status: s.status || 'ACTIVE',
    });
    setStaffModalOpen(true);
  };

  const submitStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...staffForm,
        departmentId: staffForm.departmentId ? Number(staffForm.departmentId) : null,
        consultationFee: Number(staffForm.consultationFee || 0),
      };
      if (editingStaff) {
        const res = await adminService.updateStaff(editingStaff.id, payload);
        showToast(res.message || 'Staff updated.', 'success');
      } else {
        const res = await adminService.createStaff(payload);
        showToast(res.message || 'Staff created.', 'success');
      }
      setStaffModalOpen(false);
      await loadTabData('staff');
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const handleDeleteStaff = (s: any) => {
    setConfirmState({
      open: true,
      title: 'Remove Staff Member',
      message: `Are you sure you want to remove ${s.full_name} (${s.staff_code})? Staff with clinical records will be marked INACTIVE to preserve audit integrity.`,
      onConfirm: async () => {
        try {
          const res = await adminService.deleteStaff(s.id);
          showToast(res.message, 'success');
          setConfirmState(null);
          await loadTabData('staff');
        } catch (err) {
          showToast(extractApiError(err), 'error');
        }
      },
    });
  };

  // Department handlers
  const openAddDept = () => {
    setEditingDept(null);
    setDeptForm({ name: '', headDoctorName: '', location: '', phoneExt: '', description: '', status: 'ACTIVE' });
    setDeptModalOpen(true);
  };

  const openEditDept = (d: any) => {
    setEditingDept(d);
    setDeptForm({
      name: d.name || '',
      headDoctorName: d.head_doctor_name || '',
      location: d.location || '',
      phoneExt: d.phone_ext || '',
      description: d.description || '',
      status: d.status || 'ACTIVE',
    });
    setDeptModalOpen(true);
  };

  const submitDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await adminService.updateDepartment(editingDept.id, deptForm);
        showToast('Department updated.', 'success');
      } else {
        await adminService.createDepartment(deptForm);
        showToast('Department created.', 'success');
      }
      setDeptModalOpen(false);
      await loadTabData('departments');
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const handleDeleteDept = (d: any) => {
    setConfirmState({
      open: true,
      title: 'Remove Department',
      message: `Confirm deletion or deactivation of ${d.name} (${d.department_code})?`,
      onConfirm: async () => {
        try {
          const res = await adminService.deleteDepartment(d.id);
          showToast(res.message, 'success');
          setConfirmState(null);
          await loadTabData('departments');
        } catch (err) {
          showToast(extractApiError(err), 'error');
        }
      },
    });
  };

  // Role Permission handlers
  const handleSelectRole = (role: any) => {
    setSelectedRoleId(role.id);
    setSelectedPermIds(role.permissionIds || []);
  };

  const togglePermission = (pid: number) => {
    setSelectedPermIds((prev) => (prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]));
  };

  const savePermissions = async () => {
    if (!selectedRoleId) return;
    try {
      await adminService.updateRolePermissions(selectedRoleId, selectedPermIds);
      showToast('Role permissions saved to database.', 'success');
      const refreshed = await adminService.getRolesAndPermissions();
      setRolesData(refreshed);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  // Schedule handlers
  const submitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.createSchedule({
        ...schedForm,
        staffId: Number(schedForm.staffId),
        departmentId: schedForm.departmentId ? Number(schedForm.departmentId) : null,
        slotDurationMinutes: Number(schedForm.slotDurationMinutes),
        maxPatients: Number(schedForm.maxPatients),
      });
      showToast('Schedule entry created.', 'success');
      setSchedModalOpen(false);
      await loadTabData('schedules');
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const toggleScheduleAvailability = async (s: any) => {
    try {
      await adminService.updateSchedule(s.id, { isAvailable: !s.is_available });
      showToast('Schedule availability updated.', 'success');
      await loadTabData('schedules');
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const deleteSchedule = (s: any) => {
    setConfirmState({
      open: true,
      title: 'Delete Schedule Slot',
      message: `Remove ${s.day_of_week} (${s.start_time}–${s.end_time}) schedule for ${s.staff_name}?`,
      onConfirm: async () => {
        try {
          await adminService.deleteSchedule(s.id);
          showToast('Schedule deleted.', 'success');
          setConfirmState(null);
          await loadTabData('schedules');
        } catch (err) {
          showToast(extractApiError(err), 'error');
        }
      },
    });
  };

  const filteredStaff = staffList.filter((s) => {
    const matchesQ =
      !staffSearch.trim() ||
      s.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.staff_code.toLowerCase().includes(staffSearch.toLowerCase());
    const matchesRole = !staffRoleFilter || s.role_name === staffRoleFilter;
    return matchesQ && matchesRole;
  });

  const filteredBills = (billingData?.bills || []).filter(
    (b: any) => !billFilter || b.payment_status === billFilter
  );

  return (
    <DashboardLayout
      roleLabel="Administrator"
      navItems={ADMIN_NAV}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      primaryAction={
        activeTab === 'staff' ? (
          <button
            type="button"
            onClick={openAddStaff}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Add Staff
          </button>
        ) : activeTab === 'departments' ? (
          <button
            type="button"
            onClick={openAddDept}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Add Department
          </button>
        ) : activeTab === 'schedules' ? (
          <button
            type="button"
            onClick={() => {
              setSchedForm((f) => ({
                ...f,
                staffId: staffList[0]?.id ? String(staffList[0].id) : '',
                departmentId: departments[0]?.id ? String(departments[0].id) : '',
              }));
              setSchedModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Add Schedule
          </button>
        ) : null
      }
    >
      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total Staff" value={dashboardData?.stats?.totalStaff ?? '—'} detail="Active personnel" />
            <StatCard label="Total Doctors" value={dashboardData?.stats?.totalDoctors ?? '—'} tone="primary" detail="Attending physicians" />
            <StatCard label="Total Patients" value={dashboardData?.stats?.totalPatients ?? '—'} detail="Registered in HMIS" />
            <StatCard label="Total Departments" value={dashboardData?.stats?.totalDepartments ?? '—'} detail="Clinical units" />
            <StatCard label="Total Appointments" value={dashboardData?.stats?.totalAppointments ?? '—'} detail="All encounters" />
            <StatCard
              label="Total Revenue"
              value={dashboardData ? `₹${Number(dashboardData.stats.totalRevenue).toLocaleString('en-IN')}` : '—'}
              tone="success"
              detail={`${dashboardData?.stats?.pendingBills ?? 0} pending invoices`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
              <div className="hmis-band-blue border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0B1F3A]">Department Operations Breakdown</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('departments')}
                  className="text-xs font-semibold text-[#0284C7] hover:underline"
                >
                  Manage Departments
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="hmis-table-head">
                    <tr>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Department Head</th>
                      <th className="px-4 py-3 text-right">Doctors</th>
                      <th className="px-4 py-3 text-right">Patients</th>
                      <th className="px-4 py-3 text-right">Appointments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(dashboardData?.departmentBreakdown || []).map((d: any) => (
                      <tr key={d.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                          {d.name} <span className="ml-1 font-mono text-[11px] text-[#64748B]">{d.department_code}</span>
                        </td>
                        <td className="px-4 py-3 text-[#475569]">{d.head_doctor_name || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{d.doctor_count}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{d.patient_count}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{d.appointment_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
              <div className="hmis-band-teal border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0B1F3A]">Recent Appointments</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="text-xs font-semibold text-[#0284C7] hover:underline"
                >
                  Hospital Feed
                </button>
              </div>
              <div className="p-6 divide-y divide-[#F1F5F9]">
                {(dashboardData?.recentAppointments || []).map((a: any) => (
                  <div key={a.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">{a.patient_name}</p>
                      <p className="mt-0.5 text-[11px] text-[#64748B] truncate">
                        <span className="font-mono">{a.appointment_code}</span> · {a.doctor_name} · {a.appointment_date} {a.time_slot}
                      </p>
                    </div>
                    <StatusText status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF MANAGEMENT */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Search by staff ID, name, or email..."
                className="w-full rounded-lg border border-[#CBD5E1] py-2 pl-9 pr-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={staffRoleFilter}
                onChange={(e) => setStaffRoleFilter(e.target.value)}
                className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-medium text-[#334155] focus:border-[#1D4ED8] focus:outline-none"
              >
                <option value="">All Roles</option>
                <option value="ADMIN">Administrator</option>
                <option value="REGISTRATION_STAFF">Registration Staff</option>
                <option value="DOCTOR">Doctor</option>
                <option value="PHARMACIST">Pharmacist</option>
              </select>
              <button
                type="button"
                onClick={openAddStaff}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> Add Staff
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="hmis-table-head">
                  <tr>
                    <th className="px-4 py-3">Staff ID</th>
                    <th className="px-4 py-3">Full Name & Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Specialization</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filteredStaff.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono font-medium text-[#0B1F3A] whitespace-nowrap">{s.staff_code}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0F172A]">{s.full_name}</p>
                        <p className="text-[11px] text-[#64748B]">{s.email}</p>
                      </td>
                      <td className="px-4 py-3 text-[#334155] whitespace-nowrap">{s.role_name}</td>
                      <td className="px-4 py-3 text-[#334155]">{s.department_name || 'Hospital-Wide'}</td>
                      <td className="px-4 py-3 text-[#475569]">{s.specialization || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusText status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditStaff(s)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-[#EFF6FF]"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(s)}
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
            {!loading && filteredStaff.length === 0 && (
              <div className="p-6">
                <EmptyState title="No staff match your filter" description="Clear the search query or add a new staff member." />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DEPARTMENT MANAGEMENT */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748B]">Configure clinical departments, assigned heads, and unit locations.</p>
            <button
              type="button"
              onClick={openAddDept}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Add Department
            </button>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="hmis-table-head">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Department Name</th>
                    <th className="px-4 py-3">Head of Department</th>
                    <th className="px-4 py-3">Location & Ext</th>
                    <th className="px-4 py-3 text-right">Staff</th>
                    <th className="px-4 py-3 text-right">Patients</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {departments.map((d) => (
                    <tr key={d.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono font-medium text-[#0B1F3A]">{d.department_code}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0F172A]">{d.name}</p>
                        <p className="text-[11px] text-[#64748B] max-w-xs truncate">{d.description}</p>
                      </td>
                      <td className="px-4 py-3 text-[#334155]">{d.head_doctor_name || '—'}</td>
                      <td className="px-4 py-3 text-[#475569]">
                        {d.location || '—'} {d.phone_ext ? `· Ext ${d.phone_ext}` : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{d.staff_count ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{d.patient_count ?? 0}</td>
                      <td className="px-4 py-3">
                        <StatusText status={d.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditDept(d)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-[#EFF6FF]"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDept(d)}
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
          </div>
        </div>
      )}

      {/* TAB 4: ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
              <div className="hmis-band-indigo border-b border-[#E2E8F0] px-5 py-3.5">
                <h2 className="text-sm font-bold text-[#0B1F3A]">System Roles</h2>
                <p className="mt-0.5 text-xs text-[#475569]">Select a role to configure granular permissions.</p>
              </div>
              <div className="p-4 space-y-2">
                {rolesData.roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={`w-full rounded-lg border p-3.5 text-left transition-colors ${
                      selectedRoleId === r.id
                        ? 'border-[#0284C7] bg-[#EFF6FF]'
                        : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0B1F3A]">{r.name}</span>
                      <span className="text-[11px] font-mono font-semibold text-[#0284C7] tabular-nums">
                        {(r.permissionIds || []).length} perms
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#475569]">{r.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="hmis-band-blue flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A]">
                  Permission Matrix — {rolesData.roles.find((r) => r.id === selectedRoleId)?.name || ''}
                </h2>
                <p className="mt-0.5 text-xs text-[#475569]">
                  Changes persist directly to the role_permissions table in the database.
                </p>
              </div>
              <button
                type="button"
                onClick={savePermissions}
                className="rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF] shadow-xs transition-all whitespace-nowrap shrink-0"
              >
                Save Permissions
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rolesData.permissions.map((perm) => {
                const checked = selectedPermIds.includes(perm.id);
                return (
                  <label
                    key={perm.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                      checked ? 'border-[#0284C7]/50 bg-[#EFF6FF]/60' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(perm.id)}
                      className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#0284C7]"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A]">{perm.name}</p>
                      <p className="text-[11px] font-mono text-[#64748B]">
                        {perm.module} · {perm.code}
                      </p>
                      <p className="mt-1 text-[11px] text-[#475569]">{perm.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: STAFF SCHEDULES */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748B]">
              Weekly duty rosters used to calculate open doctor consultation slots.
            </p>
            <button
              type="button"
              onClick={() => {
                setSchedForm((f) => ({
                  ...f,
                  staffId: staffList[0]?.id ? String(staffList[0].id) : '',
                  departmentId: departments[0]?.id ? String(departments[0].id) : '',
                }));
                setSchedModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Add Schedule
            </button>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="hmis-table-head">
                  <tr>
                    <th className="px-4 py-3">Staff Member</th>
                    <th className="px-4 py-3">Role & Dept</th>
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Shift Window</th>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Availability</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0F172A]">{s.staff_name}</p>
                        <p className="font-mono text-[11px] text-[#64748B]">{s.staff_code}</p>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">
                        {s.role_name} · {s.department_name || 'General'}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{s.day_of_week}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-[#334155]">
                        {s.start_time} – {s.end_time} ({s.slot_duration_minutes}m)
                      </td>
                      <td className="px-4 py-3 font-mono text-[#475569]">{s.room_number || '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleScheduleAvailability(s)}
                          className="hover:underline"
                        >
                          <StatusText status={s.is_available ? 'ACTIVE' : 'INACTIVE'} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => deleteSchedule(s)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2]"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: HOSPITAL OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="hmis-band-teal border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Live Hospital Activity Log</h2>
              <p className="mt-0.5 text-xs text-[#475569]">Recent registrations, appointments, and prescription issuances across departments.</p>
            </div>
            <div className="p-6 divide-y divide-[#F1F5F9]">
              {activities.map((act, idx) => (
                <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#64748B]">
                      <span className="font-mono font-semibold text-[#1D4ED8]">{act.code}</span>
                      <span>·</span>
                      <span>{act.type.replace('_', ' ')}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-[#0F172A]">{act.title}</p>
                    <p className="text-xs text-[#475569]">{act.detail}</p>
                  </div>
                  <span className="text-[11px] font-mono text-[#64748B] tabular-nums whitespace-nowrap">
                    {String(act.timestamp).slice(0, 16)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs h-fit">
            <div className="hmis-band-indigo border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Clinical Throughput Summary</h2>
            </div>
            <div className="p-6 space-y-4">
              {(dashboardData?.departmentBreakdown || []).map((d: any) => (
                <div key={d.id} className="border-b border-[#F1F5F9] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">{d.name}</span>
                    <span className="font-mono text-[#475569] tabular-nums">
                      {d.patient_count} patients · {d.appointment_count} visits
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-[#EFF6FF] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0284C7] to-[#1D4ED8]"
                      style={{ width: `${Math.min(100, Math.max(12, Number(d.appointment_count) * 18))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: BILLING OVERVIEW */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Billed Amount"
              value={`₹${Number(billingData?.summary?.total_billed ?? 0).toLocaleString('en-IN')}`}
              detail={`${billingData?.summary?.total_invoices ?? 0} invoices`}
            />
            <StatCard
              label="Total Revenue Collected"
              value={`₹${Number(billingData?.summary?.total_collected ?? 0).toLocaleString('en-IN')}`}
              tone="success"
              detail={`${billingData?.summary?.paid_count ?? 0} settled invoices`}
            />
            <StatCard
              label="Outstanding Receivables"
              value={`₹${Number(billingData?.summary?.total_outstanding ?? 0).toLocaleString('en-IN')}`}
              tone="warning"
              detail={`${(billingData?.summary?.pending_count ?? 0) + (billingData?.summary?.partial_count ?? 0)} open invoices`}
            />
            <StatCard
              label="Revenue Streams"
              value={`₹${Number(billingData?.summary?.diagnostic_revenue ?? 0).toLocaleString('en-IN')}`}
              tone="primary"
              detail={`Diagnostics · Consult ₹${Number(billingData?.summary?.consultation_revenue ?? 0)} · Meds ₹${Number(billingData?.summary?.medicine_revenue ?? 0)}`}
            />
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="hmis-band-amber flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-bold text-[#0B1F3A]">Hospital Billing Ledger</h2>
              <div className="flex items-center gap-1 rounded-lg bg-white/80 border border-[#E2E8F0] p-1">
                {['', 'PAID', 'PARTIAL', 'PENDING'].map((st) => (
                  <button
                    key={st || 'ALL'}
                    type="button"
                    onClick={() => setBillFilter(st)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      billFilter === st ? 'bg-[#0B3560] text-white shadow-xs' : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    {st || 'All'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="hmis-table-head">
                  <tr>
                    <th className="px-4 py-3">Invoice ID</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3 text-right">Consult</th>
                    <th className="px-4 py-3 text-right">Medicine</th>
                    <th className="px-4 py-3 text-right">Diagnostic</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filteredBills.map((b: any) => (
                    <tr key={b.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono font-medium text-[#0B1F3A]">{b.bill_code}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#0F172A]">{b.patient_name}</span>
                        <span className="ml-1.5 font-mono text-[11px] text-[#64748B]">{b.patient_code}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">₹{Number(b.consultation_charges).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">₹{Number(b.medicine_charges).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">₹{Number(b.diagnostic_charges).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">₹{Number(b.total_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">₹{Number(b.paid_amount).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <StatusText status={b.payment_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STAFF MODAL */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-[#0B1F3A]">{editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
            <form onSubmit={submitStaff} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Full Name *</label>
                <input
                  required
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Email Address *</label>
                <input
                  required
                  type="email"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">
                  {editingStaff ? 'New Password (leave blank to keep)' : 'Password *'}
                </label>
                <input
                  type="password"
                  required={!editingStaff}
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Role *</label>
                <select
                  value={staffForm.roleName}
                  onChange={(e) => setStaffForm({ ...staffForm, roleName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="REGISTRATION_STAFF">REGISTRATION_STAFF</option>
                  <option value="DOCTOR">DOCTOR</option>
                  <option value="PHARMACIST">PHARMACIST</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Department</label>
                <select
                  value={staffForm.departmentId}
                  onChange={(e) => setStaffForm({ ...staffForm, departmentId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Hospital-Wide</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Phone</label>
                <input
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Specialization</label>
                <input
                  value={staffForm.specialization}
                  onChange={(e) => setStaffForm({ ...staffForm, specialization: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Qualification</label>
                <input
                  value={staffForm.qualification}
                  onChange={(e) => setStaffForm({ ...staffForm, qualification: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Consultation Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={staffForm.consultationFee}
                  onChange={(e) => setStaffForm({ ...staffForm, consultationFee: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Status</label>
                <select
                  value={staffForm.status}
                  onChange={(e) => setStaffForm({ ...staffForm, status: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <div className="sm:col-span-2 mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  {editingStaff ? 'Save Changes' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEPARTMENT MODAL */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">{editingDept ? 'Edit Department' : 'Add Department'}</h3>
            <form onSubmit={submitDept} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Department Name *</label>
                <input
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Head of Department</label>
                  <input
                    value={deptForm.headDoctorName}
                    onChange={(e) => setDeptForm({ ...deptForm, headDoctorName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Phone Extension</label>
                  <input
                    value={deptForm.phoneExt}
                    onChange={(e) => setDeptForm({ ...deptForm, phoneExt: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Location / Floor</label>
                  <input
                    value={deptForm.location}
                    onChange={(e) => setDeptForm({ ...deptForm, location: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Status</label>
                  <select
                    value={deptForm.status}
                    onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Description</label>
                <textarea
                  rows={2}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  {editingDept ? 'Save Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {schedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">Add Staff Schedule</h3>
            <form onSubmit={submitSchedule} className="mt-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#334155]">Staff Member *</label>
                <select
                  required
                  value={schedForm.staffId}
                  onChange={(e) => setSchedForm({ ...schedForm, staffId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name} ({st.role_name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Department</label>
                <select
                  value={schedForm.departmentId}
                  onChange={(e) => setSchedForm({ ...schedForm, departmentId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
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
                <label className="block text-xs font-medium text-[#334155]">Day of Week *</label>
                <select
                  value={schedForm.dayOfWeek}
                  onChange={(e) => setSchedForm({ ...schedForm, dayOfWeek: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Start Time *</label>
                <input
                  type="time"
                  required
                  value={schedForm.startTime}
                  onChange={(e) => setSchedForm({ ...schedForm, startTime: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">End Time *</label>
                <input
                  type="time"
                  required
                  value={schedForm.endTime}
                  onChange={(e) => setSchedForm({ ...schedForm, endTime: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Room Number</label>
                <input
                  value={schedForm.roomNumber}
                  onChange={(e) => setSchedForm({ ...schedForm, roomNumber: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Slot Duration (mins)</label>
                <input
                  type="number"
                  min="10"
                  step="5"
                  value={schedForm.slotDurationMinutes}
                  onChange={(e) => setSchedForm({ ...schedForm, slotDurationMinutes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2 mt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSchedModalOpen(false)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  Create Schedule
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
          confirmLabel="Confirm"
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </DashboardLayout>
  );
};
