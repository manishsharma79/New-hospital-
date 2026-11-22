import React, { useCallback, useEffect, useState } from 'react';
import {
  ClipboardPlus,
  FileClock,
  FlaskConical,
  LayoutDashboard,
  Pill,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  Users,
} from 'lucide-react';
import { DashboardLayout, NavItem } from '../../layouts/DashboardLayout';
import { StatCard } from '../../components/StatCard';
import { StatusText } from '../../components/StatusText';
import { EmptyState } from '../../components/EmptyState';
import { PatientHistoryPanel } from '../../components/PatientHistoryPanel';
import { doctorService, pharmacistService } from '../../services/clinicalServices';
import { extractApiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const DOCTOR_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'patients', label: 'Patient List', icon: Users },
  { id: 'history', label: 'Patient History', icon: FileClock },
  { id: 'diagnosis', label: 'Diagnosis & Treatment', icon: Stethoscope },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'reports', label: 'Diagnostic Reports', icon: FlaskConical },
];

export const DoctorDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientScope, setPatientScope] = useState<'all' | 'assigned'>('all');
  const [patientSearch, setPatientSearch] = useState('');
  const [historyPatientId, setHistoryPatientId] = useState<number | null>(null);

  const [records, setRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [diagnosticTests, setDiagnosticTests] = useState<any[]>([]);

  // Diagnosis Form
  const [diagForm, setDiagForm] = useState({
    patientId: '',
    appointmentId: '',
    chiefComplaint: '',
    diagnosis: '',
    treatmentPlan: '',
    clinicalNotes: '',
    progressStatus: 'UNDER_OBSERVATION',
    vitalsBp: '120/80',
    vitalsTemp: '98.4 F',
    vitalsPulse: '76 bpm',
  });

  // Progress Update Modal
  const [progressModal, setProgressModal] = useState<{
    recordId: number;
    recordCode: string;
    patientName: string;
    progressStatus: string;
    treatmentPlan: string;
    clinicalNotes: string;
  } | null>(null);

  // Prescription Form
  const [rxForm, setRxForm] = useState({
    patientId: '',
    notes: '',
    items: [{ medicineId: '', dosage: '500 mg', frequency: 'Twice daily (BD)', durationDays: '5', quantityPrescribed: '10', instructions: 'After meals' }],
  });

  // Diagnostic Request Form
  const [testForm, setTestForm] = useState({
    patientId: '',
    testName: '',
    testCategory: 'Biochemistry',
    priority: 'ROUTINE',
    testCharge: '650',
    reportNotes: '',
  });

  // Diagnostic Report Entry Modal
  const [reportModal, setReportModal] = useState<{
    id: number;
    testCode: string;
    testName: string;
    status: string;
    resultSummary: string;
    reportNotes: string;
  } | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await doctorService.getDashboard();
      setDashboardData(data);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  }, [showToast]);

  const loadPatients = useCallback(async () => {
    try {
      const rows = await doctorService.getPatients({ scope: patientScope, search: patientSearch });
      setPatients(rows);
      if (rows.length > 0 && !diagForm.patientId) {
        setDiagForm((f) => ({ ...f, patientId: String(rows[0].id) }));
        setRxForm((f) => ({ ...f, patientId: String(rows[0].id) }));
        setTestForm((f) => ({ ...f, patientId: String(rows[0].id) }));
      }
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  }, [patientScope, patientSearch, diagForm.patientId, showToast]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'diagnosis') {
      doctorService.getRecords().then(setRecords).catch((e) => showToast(extractApiError(e), 'error'));
    } else if (activeTab === 'prescriptions') {
      Promise.all([doctorService.getPrescriptions(), pharmacistService.getMedicines()])
        .then(([rxs, meds]) => {
          setPrescriptions(rxs);
          setMedicines(meds);
          if (meds.length > 0 && !rxForm.items[0]?.medicineId) {
            setRxForm((f) => ({
              ...f,
              items: [{ ...f.items[0], medicineId: String(meds[0].id) }],
            }));
          }
        })
        .catch((e) => showToast(extractApiError(e), 'error'));
    } else if (activeTab === 'reports') {
      doctorService.getDiagnosticTests().then(setDiagnosticTests).catch((e) => showToast(extractApiError(e), 'error'));
    }
  }, [activeTab, loadDashboard, rxForm.items, showToast]);

  const handleConsultFromQueue = (appt: any) => {
    setDiagForm((f) => ({
      ...f,
      patientId: String(appt.patient_id),
      appointmentId: String(appt.id),
      chiefComplaint: appt.reason || '',
    }));
    setActiveTab('diagnosis');
  };

  const submitDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await doctorService.addDiagnosis({
        ...diagForm,
        patientId: Number(diagForm.patientId),
        appointmentId: diagForm.appointmentId ? Number(diagForm.appointmentId) : null,
      });
      showToast(res.message || 'Clinical diagnosis saved.', 'success');
      setDiagForm((f) => ({
        ...f,
        appointmentId: '',
        chiefComplaint: '',
        diagnosis: '',
        treatmentPlan: '',
        clinicalNotes: '',
      }));
      setRecords(await doctorService.getRecords());
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const submitProgressUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressModal) return;
    try {
      await doctorService.addTreatment({
        recordId: progressModal.recordId,
        treatmentPlan: progressModal.treatmentPlan,
        clinicalNotes: progressModal.clinicalNotes,
      });
      await doctorService.updateProgress({
        recordId: progressModal.recordId,
        progressStatus: progressModal.progressStatus,
        clinicalNotes: progressModal.clinicalNotes,
      });
      showToast('Treatment and progress updated.', 'success');
      setProgressModal(null);
      setRecords(await doctorService.getRecords());
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const addRxItemRow = () => {
    setRxForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          medicineId: medicines[0]?.id ? String(medicines[0].id) : '',
          dosage: '1 tab',
          frequency: 'Once daily',
          durationDays: '5',
          quantityPrescribed: '5',
          instructions: 'After meals',
        },
      ],
    }));
  };

  const removeRxItemRow = (idx: number) => {
    setRxForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));
  };

  const submitPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        patientId: Number(rxForm.patientId),
        notes: rxForm.notes,
        items: rxForm.items.map((it) => ({
          medicineId: Number(it.medicineId),
          dosage: it.dosage,
          frequency: it.frequency,
          durationDays: Number(it.durationDays),
          quantityPrescribed: Number(it.quantityPrescribed),
          instructions: it.instructions,
        })),
      };
      const res = await doctorService.createPrescription(payload);
      showToast(res.message || 'Prescription created.', 'success');
      setRxForm((f) => ({ ...f, notes: '' }));
      setPrescriptions(await doctorService.getPrescriptions());
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const submitTestRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await doctorService.requestDiagnosticTest({
        ...testForm,
        patientId: Number(testForm.patientId),
        testCharge: Number(testForm.testCharge),
      });
      showToast(res.message || 'Diagnostic test requested.', 'success');
      setTestForm((f) => ({ ...f, testName: '', reportNotes: '' }));
      setDiagnosticTests(await doctorService.getDiagnosticTests());
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const submitReportUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModal) return;
    try {
      await doctorService.updateDiagnosticReport(reportModal.id, {
        status: reportModal.status,
        resultSummary: reportModal.resultSummary,
        reportNotes: reportModal.reportNotes,
      });
      showToast('Diagnostic report saved.', 'success');
      setReportModal(null);
      setDiagnosticTests(await doctorService.getDiagnosticTests());
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  return (
    <DashboardLayout
      roleLabel="Doctor"
      navItems={DOCTOR_NAV}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      primaryAction={
        <button
          type="button"
          onClick={() => setActiveTab('diagnosis')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
        >
          <ClipboardPlus className="h-3.5 w-3.5" /> New Diagnosis
        </button>
      }
    >
      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Scheduled Appointments" value={dashboardData?.stats?.scheduledAppointments ?? '—'} tone="primary" />
            <StatCard label="Assigned Patients" value={dashboardData?.stats?.assignedPatients ?? '—'} />
            <StatCard label="Medical Records" value={dashboardData?.stats?.medicalRecords ?? '—'} />
            <StatCard label="Prescriptions Issued" value={dashboardData?.stats?.prescriptionsIssued ?? '—'} tone="success" />
            <StatCard label="Pending Diagnostics" value={dashboardData?.stats?.pendingDiagnostics ?? '—'} tone="warning" />
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="hmis-band-blue border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1F3A]">Consultation Queue</h2>
              <button
                type="button"
                onClick={() => setActiveTab('patients')}
                className="text-xs font-semibold text-[#0284C7] hover:underline"
              >
                Browse All Patients
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="hmis-table-head">
                  <tr>
                    <th className="px-4 py-3">Appt. ID</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Demographics</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {(dashboardData?.upcomingAppointments || []).map((a: any) => (
                    <tr key={a.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono font-medium text-[#0B1F3A]">{a.appointment_code}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0F172A]">{a.patient_name}</p>
                        <p className="font-mono text-[11px] text-[#64748B]">{a.patient_code}</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#475569]">
                        {a.age}y · {a.gender} · {a.blood_group || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-[#334155]">
                        {a.appointment_date} · {a.time_slot}
                      </td>
                      <td className="px-4 py-3 text-[#475569] max-w-xs truncate">{a.reason || a.visit_type}</td>
                      <td className="px-4 py-3">
                        <StatusText status={a.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleConsultFromQueue(a)}
                          className="rounded-lg bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                        >
                          Record Diagnosis
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

      {/* PATIENT LIST */}
      {activeTab === 'patients' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search by Patient ID, name, or mobile..."
                className="w-full rounded-lg border border-[#CBD5E1] py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-[#F1F5F9] p-1">
              <button
                type="button"
                onClick={() => setPatientScope('all')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  patientScope === 'all' ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-[#64748B]'
                }`}
              >
                All Patients
              </button>
              <button
                type="button"
                onClick={() => setPatientScope('assigned')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  patientScope === 'assigned' ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-[#64748B]'
                }`}
              >
                My Patients
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="hmis-table-head">
                  <tr>
                    <th className="px-4 py-3">Patient ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Age / Gender / Blood</th>
                    <th className="px-4 py-3">Assigned Dept</th>
                    <th className="px-4 py-3 text-right">Records</th>
                    <th className="px-4 py-3 text-right">Clinical Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {patients.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono font-semibold text-[#1D4ED8]">{p.patient_code}</td>
                      <td className="px-4 py-3 font-medium text-[#0F172A]">{p.full_name}</td>
                      <td className="px-4 py-3 tabular-nums text-[#475569]">
                        {p.age} yrs · {p.gender} · {p.blood_group || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-[#475569]">{p.department_name || 'General'}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{p.record_count}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryPatientId(p.id);
                            setActiveTab('history');
                          }}
                          className="rounded px-2.5 py-1 text-xs font-medium text-[#0B1F3A] hover:bg-slate-100"
                        >
                          Medical History
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDiagForm((f) => ({ ...f, patientId: String(p.id) }));
                            setActiveTab('diagnosis');
                          }}
                          className="ml-1 rounded px-2.5 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-[#EFF6FF]"
                        >
                          Add Diagnosis
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

      {/* PATIENT HISTORY */}
      {activeTab === 'history' && <PatientHistoryPanel initialPatientId={historyPatientId} />}

      {/* DIAGNOSIS & TREATMENT */}
      {activeTab === 'diagnosis' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form onSubmit={submitDiagnosis} className="lg:col-span-5 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs h-fit">
            <div className="hmis-band-blue border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Record Diagnosis & Treatment</h2>
              <p className="text-xs text-[#475569]">Every medical record is linked directly to Patient ID and Attending Doctor.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Select Patient *</label>
                <select
                  required
                  value={diagForm.patientId}
                  onChange={(e) => setDiagForm({ ...diagForm, patientId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_code} — {p.full_name} ({p.age}y)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#334155]">BP (mmHg)</label>
                  <input
                    value={diagForm.vitalsBp}
                    onChange={(e) => setDiagForm({ ...diagForm, vitalsBp: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#334155]">Temp</label>
                  <input
                    value={diagForm.vitalsTemp}
                    onChange={(e) => setDiagForm({ ...diagForm, vitalsTemp: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#334155]">Pulse</label>
                  <input
                    value={diagForm.vitalsPulse}
                    onChange={(e) => setDiagForm({ ...diagForm, vitalsPulse: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#334155]">Chief Complaint</label>
                <input
                  value={diagForm.chiefComplaint}
                  onChange={(e) => setDiagForm({ ...diagForm, chiefComplaint: e.target.value })}
                  placeholder="Presenting symptoms"
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#334155]">Clinical Diagnosis *</label>
                <input
                  required
                  value={diagForm.diagnosis}
                  onChange={(e) => setDiagForm({ ...diagForm, diagnosis: e.target.value })}
                  placeholder="Primary / differential diagnosis"
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#334155]">Treatment Plan *</label>
                <textarea
                  required
                  rows={3}
                  value={diagForm.treatmentPlan}
                  onChange={(e) => setDiagForm({ ...diagForm, treatmentPlan: e.target.value })}
                  placeholder="Therapeutic protocol, follow-up instructions..."
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Patient Progress</label>
                  <select
                    value={diagForm.progressStatus}
                    onChange={(e) => setDiagForm({ ...diagForm, progressStatus: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs"
                  >
                    <option value="UNDER_OBSERVATION">UNDER_OBSERVATION</option>
                    <option value="STABLE">STABLE</option>
                    <option value="IMPROVING">IMPROVING</option>
                    <option value="RECOVERED">RECOVERED</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Clinical Notes</label>
                  <input
                    value={diagForm.clinicalNotes}
                    onChange={(e) => setDiagForm({ ...diagForm, clinicalNotes: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-4 py-2.5 text-xs font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF] shadow-xs"
              >
                Save Medical Record
              </button>
            </div>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs h-fit">
            <div className="hmis-band-teal border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Medical Records & Progress Updates</h2>
            </div>
            <div className="p-6 divide-y divide-[#F1F5F9]">
              {records.map((rec) => (
                <div key={rec.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-[#64748B]">
                      <span className="font-mono font-semibold text-[#1D4ED8]">{rec.record_code}</span>
                      <span className="mx-1.5">·</span>
                      <span className="font-semibold text-[#0F172A]">{rec.patient_name}</span>
                      <span className="ml-1 font-mono text-[11px]">({rec.patient_code})</span>
                      <span className="mx-1.5">·</span>
                      <span className="tabular-nums">{rec.visit_date}</span>
                    </div>
                    <StatusText status={rec.progress_status} />
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-[#0B1F3A]">{rec.diagnosis}</p>
                  <p className="mt-1 text-xs text-[#334155]">Treatment: {rec.treatment_plan}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-[#64748B] tabular-nums">
                      BP {rec.vitals_bp || '—'} · Temp {rec.vitals_temp || '—'} · Pulse {rec.vitals_pulse || '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setProgressModal({
                          recordId: rec.id,
                          recordCode: rec.record_code,
                          patientName: rec.patient_name,
                          progressStatus: rec.progress_status,
                          treatmentPlan: rec.treatment_plan,
                          clinicalNotes: rec.clinical_notes || '',
                        })
                      }
                      className="text-xs font-semibold text-[#0284C7] hover:underline"
                    >
                      Update Treatment & Progress
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRESCRIPTIONS */}
      {activeTab === 'prescriptions' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form onSubmit={submitPrescription} className="lg:col-span-5 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs h-fit">
            <div className="hmis-band-indigo border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Create Medicine Prescription</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Patient *</label>
                <select
                  required
                  value={rxForm.patientId}
                  onChange={(e) => setRxForm({ ...rxForm, patientId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_code} — {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 border-t border-[#F1F5F9] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0B1F3A]">Prescribed Medicines</span>
                  <button
                    type="button"
                    onClick={addRxItemRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284C7] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Medicine
                  </button>
                </div>
                {rxForm.items.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        required
                        value={item.medicineId}
                        onChange={(e) => {
                          const next = [...rxForm.items];
                          next[idx] = { ...next[idx], medicineId: e.target.value };
                          setRxForm({ ...rxForm, items: next });
                        }}
                        className="flex-1 rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs"
                      >
                        {medicines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.medicine_name} (Stock: {m.available_quantity})
                          </option>
                        ))}
                      </select>
                      {rxForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRxItemRow(idx)}
                          className="text-[#DC2626] p-1"
                          aria-label="Remove medicine"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        required
                        placeholder="Dosage (e.g. 500mg)"
                        value={item.dosage}
                        onChange={(e) => {
                          const next = [...rxForm.items];
                          next[idx] = { ...next[idx], dosage: e.target.value };
                          setRxForm({ ...rxForm, items: next });
                        }}
                        className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs"
                      />
                      <input
                        required
                        placeholder="Frequency"
                        value={item.frequency}
                        onChange={(e) => {
                          const next = [...rxForm.items];
                          next[idx] = { ...next[idx], frequency: e.target.value };
                          setRxForm({ ...rxForm, items: next });
                        }}
                        className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[#64748B]">Days</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.durationDays}
                          onChange={(e) => {
                            const next = [...rxForm.items];
                            next[idx] = { ...next[idx], durationDays: e.target.value };
                            setRxForm({ ...rxForm, items: next });
                          }}
                          className="w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#64748B]">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantityPrescribed}
                          onChange={(e) => {
                            const next = [...rxForm.items];
                            next[idx] = { ...next[idx], quantityPrescribed: e.target.value };
                            setRxForm({ ...rxForm, items: next });
                          }}
                          className="w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#334155]">Clinical Notes</label>
                <input
                  value={rxForm.notes}
                  onChange={(e) => setRxForm({ ...rxForm, notes: e.target.value })}
                  placeholder="Instructions for pharmacist / patient"
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-4 py-2.5 text-xs font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF] shadow-xs"
              >
                Issue Prescription to Pharmacy
              </button>
            </div>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs h-fit">
            <div className="hmis-band-emerald border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Issued Prescriptions</h2>
            </div>
            <div className="p-6 divide-y divide-[#F1F5F9]">
              {prescriptions.map((rx) => (
                <div key={rx.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-mono font-semibold text-[#1D4ED8]">{rx.prescription_code}</span>
                      <span className="mx-1.5 text-[#94A3B8]">·</span>
                      <span className="font-semibold text-[#0F172A]">{rx.patient_name}</span>
                      <span className="ml-1 font-mono text-[11px] text-[#64748B]">({rx.patient_code})</span>
                      <span className="mx-1.5 text-[#94A3B8]">·</span>
                      <span className="tabular-nums text-[#64748B]">{rx.prescribed_date}</span>
                    </div>
                    <StatusText status={rx.status} />
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-[#334155]">
                    {rx.items.map((it: any) => (
                      <li key={it.id}>
                        {it.medicine_name} — {it.dosage}, {it.frequency} · {it.duration_days}d (Qty {it.quantity_prescribed})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DIAGNOSTIC REPORTS */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form onSubmit={submitTestRequest} className="lg:col-span-4 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs h-fit">
            <div className="hmis-band-violet border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Request Diagnostic Test</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Patient *</label>
                <select
                  required
                  value={testForm.patientId}
                  onChange={(e) => setTestForm({ ...testForm, patientId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_code} — {p.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Test Name *</label>
                <input
                  required
                  value={testForm.testName}
                  onChange={(e) => setTestForm({ ...testForm, testName: e.target.value })}
                  placeholder="e.g. Complete Blood Count, Chest X-Ray"
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Category</label>
                  <select
                    value={testForm.testCategory}
                    onChange={(e) => setTestForm({ ...testForm, testCategory: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs"
                  >
                    <option value="Hematology">Hematology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Radiology">Radiology</option>
                    <option value="Endocrinology">Endocrinology</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Priority</label>
                  <select
                    value={testForm.priority}
                    onChange={(e) => setTestForm({ ...testForm, priority: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs"
                  >
                    <option value="ROUTINE">ROUTINE</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Estimated Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={testForm.testCharge}
                  onChange={(e) => setTestForm({ ...testForm, testCharge: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-4 py-2.5 text-xs font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF] shadow-xs"
              >
                Submit Diagnostic Order
              </button>
            </div>
          </form>

          <div className="lg:col-span-8 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs h-fit">
            <div className="hmis-band-teal border-b border-[#E2E8F0] px-6 py-4">
              <h2 className="text-base font-bold text-[#0B1F3A]">Diagnostic Orders & Lab Reports</h2>
            </div>
            <div className="p-6 divide-y divide-[#F1F5F9]">
              {diagnosticTests.length === 0 ? (
                <EmptyState title="No diagnostic tests" description="Order a diagnostic test on the left." />
              ) : (
                diagnosticTests.map((t) => (
                  <div key={t.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-mono font-semibold text-[#1D4ED8]">{t.test_code}</span>
                        <span className="mx-1.5 text-[#94A3B8]">·</span>
                        <span className="font-semibold text-[#0F172A]">{t.test_name}</span>
                        <span className="mx-1.5 text-[#94A3B8]">·</span>
                        <span className="text-[#475569]">
                          {t.patient_name} ({t.patient_code})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusText status={t.priority} />
                        <StatusText status={t.status} />
                      </div>
                    </div>
                    {t.result_summary ? (
                      <div className="mt-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-3 text-xs">
                        <p className="font-semibold text-[#0B1F3A]">Finding: {t.result_summary}</p>
                        {t.report_notes && <p className="mt-0.5 text-[#475569]">{t.report_notes}</p>}
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between text-xs text-[#64748B]">
                        <span>Requested on {t.requested_date} · Charge ₹{t.test_charge}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setReportModal({
                              id: t.id,
                              testCode: t.test_code,
                              testName: t.test_name,
                              status: 'COMPLETED',
                              resultSummary: t.result_summary || '',
                              reportNotes: t.report_notes || '',
                            })
                          }
                          className="font-semibold text-[#0284C7] hover:underline"
                        >
                          Enter / Finalize Report
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* UPDATE PROGRESS MODAL */}
      {progressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">
              Update Progress — {progressModal.patientName} ({progressModal.recordCode})
            </h3>
            <form onSubmit={submitProgressUpdate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Progress Status</label>
                <select
                  value={progressModal.progressStatus}
                  onChange={(e) => setProgressModal({ ...progressModal, progressStatus: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  <option value="UNDER_OBSERVATION">UNDER_OBSERVATION</option>
                  <option value="STABLE">STABLE</option>
                  <option value="IMPROVING">IMPROVING</option>
                  <option value="RECOVERED">RECOVERED</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Treatment Plan</label>
                <textarea
                  rows={3}
                  value={progressModal.treatmentPlan}
                  onChange={(e) => setProgressModal({ ...progressModal, treatmentPlan: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Clinical Progress Notes</label>
                <input
                  value={progressModal.clinicalNotes}
                  onChange={(e) => setProgressModal({ ...progressModal, clinicalNotes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProgressModal(null)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  Save Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FINALIZE DIAGNOSTIC REPORT MODAL */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">
              Diagnostic Report — {reportModal.testName} ({reportModal.testCode})
            </h3>
            <form onSubmit={submitReportUpdate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Status</label>
                <select
                  value={reportModal.status}
                  onChange={(e) => setReportModal({ ...reportModal, status: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Result Summary *</label>
                <input
                  required
                  value={reportModal.resultSummary}
                  onChange={(e) => setReportModal({ ...reportModal, resultSummary: e.target.value })}
                  placeholder="Key diagnostic findings"
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Detailed Interpretation Notes</label>
                <textarea
                  rows={3}
                  value={reportModal.reportNotes}
                  onChange={(e) => setReportModal({ ...reportModal, reportNotes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReportModal(null)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  Save Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
