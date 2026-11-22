import React, { useEffect, useState } from 'react';
import { Search, UserCheck } from 'lucide-react';
import { patientService } from '../services/clinicalServices';
import { extractApiError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { StatusText } from './StatusText';
import { EmptyState } from './EmptyState';
import { formatVisitDateTime, formatVisitDuration } from '../utils/visitTime';

interface PatientHistoryPanelProps {
  initialPatientId?: number | string | null;
}

export const PatientHistoryPanel: React.FC<PatientHistoryPanelProps> = ({ initialPatientId }) => {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const loadHistory = async (idOrCode: number | string) => {
    setLoading(true);
    try {
      const data = await patientService.getHistory(idOrCode);
      setHistoryData(data);
    } catch (err) {
      showToast(extractApiError(err, 'Failed to load patient history.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPatientId) {
      loadHistory(initialPatientId);
    } else {
      // Load patient list preview for quick selection
      patientService
        .list({ limit: 8 })
        .then((res) => setSearchResults(res.items || []))
        .catch(() => {});
    }
  }, [initialPatientId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const rows = await patientService.search(query.trim());
      setSearchResults(rows);
      if (rows.length === 1) {
        await loadHistory(rows[0].id);
      } else if (rows.length === 0) {
        showToast('No matching patient found.', 'info');
      }
    } catch (err) {
      showToast(extractApiError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const patient = historyData?.patient;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
        <div className="hmis-band-blue border-b border-[#E2E8F0] px-5 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0B1F3A]">Patient Medical & Administrative History</h2>
            <p className="mt-0.5 text-xs text-[#475569]">
              Search patient records by Patient ID (e.g. HMIS-PAT-0001), full name, or mobile number.
            </p>
          </div>
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search HMIS-PAT-0001 or name..."
                className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#0284C7] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF] shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              Find Patient
            </button>
          </form>
        </div>

        {searchResults.length > 0 && (
          <div className="px-5 py-4 flex flex-wrap gap-2">
            {searchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => loadHistory(p.id)}
                className={`rounded-lg border px-3 py-1.5 text-left text-xs transition-colors ${
                  patient?.id === p.id
                    ? 'border-[#0284C7] bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
                    : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:border-[#94A3B8]'
                }`}
              >
                <span className="font-mono font-semibold">{p.patient_code}</span>
                <span className="mx-1.5 text-[#94A3B8]">·</span>
                <span>{p.full_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && !historyData && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]">
          Loading longitudinal patient record...
        </div>
      )}

      {!loading && !patient && (
        <EmptyState
          title="Select a Patient Record"
          description="Search by unique Patient ID or select a patient above to inspect appointments, diagnoses, prescriptions, diagnostic reports, and billing history."
        />
      )}

      {patient && (
        <div className="space-y-6">
          {/* Patient Demographic Summary */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="hmis-band-teal border-b border-[#E2E8F0] px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0D9488] text-white shadow-xs">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#475569]">
                    <span className="font-mono font-bold text-[#1D4ED8]">{patient.patient_code}</span>
                    <span>·</span>
                    <span>{patient.registration_type}</span>
                    <span>·</span>
                    <span>Registered {patient.registration_date}</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#0B1F3A]">{patient.full_name}</h3>
                </div>
              </div>
              <div className="text-xs font-medium text-[#334155] tabular-nums">
                {patient.age} yrs · {patient.gender} · Blood Group: <strong className="text-[#0B1F3A]">{patient.blood_group || 'N/A'}</strong>
                <span> · Visits: </span>
                <strong className="text-[#1D4ED8]">{historyData.visits?.length ?? 0}</strong>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[#64748B]">Contact</p>
                <p className="mt-1 font-semibold text-[#0F172A] tabular-nums">{patient.mobile_number}</p>
                <p className="text-[#475569]">{patient.email || 'No email'}</p>
              </div>
              <div>
                <p className="text-[#64748B]">Address</p>
                <p className="mt-1 font-semibold text-[#0F172A]">
                  {[patient.house_number, patient.street_locality, patient.city].filter(Boolean).join(', ')}
                </p>
                <p className="text-[#475569]">
                  {patient.state}, {patient.country} {patient.pin_code}
                </p>
              </div>
              <div>
                <p className="text-[#64748B]">Assigned Care</p>
                <p className="mt-1 font-semibold text-[#0F172A]">{patient.department_name || 'Unassigned'}</p>
                <p className="text-[#475569]">{patient.doctor_name || 'No primary doctor'}</p>
              </div>
              <div>
                <p className="text-[#64748B]">Emergency Contact</p>
                <p className="mt-1 font-semibold text-[#0F172A]">
                  {patient.emergency_contact_name} ({patient.emergency_relationship})
                </p>
                <p className="text-[#475569] tabular-nums">{patient.emergency_contact_number}</p>
              </div>
            </div>
          </div>

          {/* Patient Visit History — Arrival & Departure Log */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="hmis-band-blue border-b border-[#E2E8F0] px-6 py-3.5 flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-[#0B1F3A]">
                  Patient Visit History — Hospital Entry & Exit Log ({historyData.visits?.length ?? 0})
                </h4>
                <p className="text-[11px] text-[#475569]">
                  Chronological record of when the patient arrived (Check-In) and left (Check-Out) the hospital.
                </p>
              </div>
            </div>
            {!historyData.visits || historyData.visits.length === 0 ? (
              <p className="p-6 text-xs text-[#64748B]">No hospital check-in / check-out visits logged for this patient yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="hmis-table-head">
                    <tr>
                      <th className="px-4 py-2.5">Visit ID</th>
                      <th className="px-4 py-2.5">Visit Type & Purpose</th>
                      <th className="px-4 py-2.5">Dept / Doctor</th>
                      <th className="px-4 py-2.5">Arrived (Check-In)</th>
                      <th className="px-4 py-2.5">Left (Check-Out)</th>
                      <th className="px-4 py-2.5">Duration</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {historyData.visits.map((v: any) => (
                      <tr key={v.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-mono font-semibold text-[#1D4ED8] whitespace-nowrap">{v.visit_code}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#0B1F3A]">{v.visit_type}</p>
                          <p className="text-[11px] text-[#475569]">{v.purpose || v.notes || 'General hospital visit'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[#0F172A]">{v.department_name || 'General'}</p>
                          <p className="text-[11px] text-[#64748B]">{v.doctor_name || 'Front Desk'}</p>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[#0F172A] whitespace-nowrap">
                          {formatVisitDateTime(v.check_in_time)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums whitespace-nowrap">
                          {v.check_out_time ? (
                            <span className="text-[#334155]">{formatVisitDateTime(v.check_out_time)}</span>
                          ) : (
                            <span className="font-sans font-medium text-[#0284C7]">Currently In Hospital</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[#475569] whitespace-nowrap">
                          {formatVisitDuration(v.check_in_time, v.check_out_time)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusText status={v.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Clinical Records */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="hmis-band-indigo border-b border-[#E2E8F0] px-6 py-3.5">
              <h4 className="text-sm font-bold text-[#0B1F3A]">Medical Records & Progress ({historyData.medicalRecords.length})</h4>
            </div>
            <div className="p-6">
              {historyData.medicalRecords.length === 0 ? (
                <p className="text-xs text-[#64748B]">No clinical diagnoses recorded yet.</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {historyData.medicalRecords.map((rec: any) => (
                    <div key={rec.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-[#64748B]">
                          <span className="font-mono font-semibold text-[#1D4ED8]">{rec.record_code}</span>
                          <span>·</span>
                          <span className="tabular-nums">{rec.visit_date}</span>
                          <span>·</span>
                          <span>{rec.doctor_name}</span>
                        </div>
                        <StatusText status={rec.progress_status} />
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-[#0F172A]">{rec.diagnosis}</p>
                      <p className="mt-1 text-xs text-[#334155]">Treatment: {rec.treatment_plan}</p>
                      {(rec.vitals_bp || rec.vitals_temp || rec.vitals_pulse) && (
                        <p className="mt-1 text-xs font-mono text-[#64748B] tabular-nums">
                          Vitals: BP {rec.vitals_bp || '-'} · Temp {rec.vitals_temp || '-'} · Pulse {rec.vitals_pulse || '-'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Appointments & Prescriptions Split */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
              <div className="hmis-band-blue border-b border-[#E2E8F0] px-6 py-3.5">
                <h4 className="text-sm font-bold text-[#0B1F3A]">Appointments ({historyData.appointments.length})</h4>
              </div>
              {historyData.appointments.length === 0 ? (
                <p className="p-6 text-xs text-[#64748B]">No appointments on record.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="hmis-table-head">
                      <tr>
                        <th className="px-4 py-2.5">Code</th>
                        <th className="px-4 py-2.5">Date & Slot</th>
                        <th className="px-4 py-2.5">Doctor</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {historyData.appointments.map((a: any) => (
                        <tr key={a.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 font-mono font-medium text-[#0B1F3A]">{a.appointment_code}</td>
                          <td className="px-4 py-3 tabular-nums text-[#334155]">
                            {a.appointment_date} · {a.time_slot}
                          </td>
                          <td className="px-4 py-3 text-[#334155]">{a.doctor_name}</td>
                          <td className="px-4 py-3">
                            <StatusText status={a.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
              <div className="hmis-band-emerald border-b border-[#E2E8F0] px-6 py-3.5">
                <h4 className="text-sm font-bold text-[#0B1F3A]">Prescriptions ({historyData.prescriptions.length})</h4>
              </div>
              <div className="p-6">
                {historyData.prescriptions.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No prescriptions issued.</p>
                ) : (
                  <div className="divide-y divide-[#F1F5F9]">
                    {historyData.prescriptions.map((rx: any) => (
                      <div key={rx.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-[#0B1F3A]">
                            {rx.prescription_code} · {rx.prescribed_date}
                          </span>
                          <StatusText status={rx.status} />
                        </div>
                        <ul className="mt-1.5 space-y-1 text-xs text-[#334155]">
                          {rx.items.map((item: any) => (
                            <li key={item.id}>
                              {item.medicine_name} — {item.dosage}, {item.frequency} ({item.duration_days} days · Qty {item.quantity_prescribed})
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Diagnostic Tests & Billing */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
              <div className="hmis-band-violet border-b border-[#E2E8F0] px-6 py-3.5">
                <h4 className="text-sm font-bold text-[#0B1F3A]">Diagnostic Reports ({historyData.diagnosticTests.length})</h4>
              </div>
              <div className="p-6">
                {historyData.diagnosticTests.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No diagnostic tests ordered.</p>
                ) : (
                  <div className="divide-y divide-[#F1F5F9]">
                    {historyData.diagnosticTests.map((t: any) => (
                      <div key={t.id} className="py-3 first:pt-0 last:pb-0 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#0F172A]">
                            {t.test_name} <span className="font-normal text-[#64748B]">({t.test_category})</span>
                          </span>
                          <StatusText status={t.status} />
                        </div>
                        {t.result_summary && <p className="mt-1 text-[#334155]">Result: {t.result_summary}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
              <div className="hmis-band-amber border-b border-[#E2E8F0] px-6 py-3.5">
                <h4 className="text-sm font-bold text-[#0B1F3A]">Billing Ledger ({historyData.bills.length})</h4>
              </div>
              {historyData.bills.length === 0 ? (
                <p className="p-6 text-xs text-[#64748B]">No invoices generated yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="hmis-table-head">
                      <tr>
                        <th className="px-4 py-2.5">Invoice</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                        <th className="px-4 py-2.5 text-right">Paid</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {historyData.bills.map((b: any) => (
                        <tr key={b.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 font-mono font-medium text-[#0B1F3A]">{b.bill_code}</td>
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
