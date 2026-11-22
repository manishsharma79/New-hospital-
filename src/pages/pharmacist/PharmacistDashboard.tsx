import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Edit3,
  Eye,
  FileText,
  IndianRupee,
  LayoutDashboard,
  Package,
  PackageCheck,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DashboardLayout, NavItem } from '../../layouts/DashboardLayout';
import { StatCard } from '../../components/StatCard';
import { StatusText } from '../../components/StatusText';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { billingService, doctorService, patientService, pharmacistService } from '../../services/clinicalServices';
import { extractApiError } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const PHARMA_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Medicine Inventory', icon: Package },
  { id: 'availability', label: 'Medicine Availability', icon: PackageCheck },
  { id: 'verify', label: 'View Prescriptions', icon: FileText },
  { id: 'billing', label: 'Billing & Payments', icon: IndianRupee },
  { id: 'expiry', label: 'Expiry Monitoring', icon: AlertTriangle },
];

export const PharmacistDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');

  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [medSearch, setMedSearch] = useState('');
  const [medCategory, setMedCategory] = useState('');

  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [rxFilter, setRxFilter] = useState('');
  const [rxSearch, setRxSearch] = useState('');
  const [viewingPrescription, setViewingPrescription] = useState<any | null>(null);

  const [bills, setBills] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  // Alert lists
  const [alertTab, setAlertTab] = useState<'low' | 'expired' | 'near'>('low');
  const [lowStockList, setLowStockList] = useState<any[]>([]);
  const [expiredList, setExpiredList] = useState<any[]>([]);
  const [nearExpiryList, setNearExpiryList] = useState<any[]>([]);

  // Medicine modal
  const [medModalOpen, setMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<any>(null);
  const [medForm, setMedForm] = useState({
    medicineName: '',
    batchNumber: '',
    category: 'Cardiovascular',
    availableQuantity: '100',
    reorderLevel: '25',
    unitPrice: '15.00',
    expiryDate: '2028-06-30',
    supplier: '',
    description: '',
  });

  // Quick stock update modal
  const [stockModal, setStockModal] = useState<{ id: number; name: string; current: number; absoluteQuantity: string } | null>(
    null
  );

  // Bill generation modal
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billForm, setBillForm] = useState({
    patientId: '',
    prescriptionId: '',
    consultationCharges: '600',
    medicineCharges: '0',
    diagnosticCharges: '0',
    paidAmount: '0',
    paymentMethod: 'UPI',
    notes: '',
  });

  // Payment update modal
  const [payModal, setPayModal] = useState<{
    id: number;
    billCode: string;
    totalAmount: number;
    paidAmount: string;
    paymentStatus: string;
    paymentMethod: string;
  } | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [dash, rxs, low, exp] = await Promise.all([
        pharmacistService.getDashboard(),
        doctorService.getPrescriptions({ status: 'PENDING' }),
        pharmacistService.getLowStock(),
        pharmacistService.getExpired(),
      ]);
      setDashboardStats(dash.stats);
      setPrescriptions(rxs);
      setLowStockList(low);
      setExpiredList(exp);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  }, [showToast]);

  const loadMedicines = useCallback(async () => {
    try {
      const rows = await pharmacistService.getMedicines({ search: medSearch, category: medCategory });
      setMedicines(rows);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  }, [medSearch, medCategory, showToast]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'inventory' || activeTab === 'availability') {
      loadMedicines();
    } else if (activeTab === 'verify') {
      doctorService.getPrescriptions(rxFilter ? { status: rxFilter } : {}).then(setPrescriptions).catch((e) => showToast(extractApiError(e), 'error'));
    } else if (activeTab === 'billing') {
      Promise.all([billingService.list(), patientService.list({ limit: 100 }), doctorService.getPrescriptions()])
        .then(([b, p, rxs]) => {
          setBills(b);
          setPatients(p.items || []);
          setPrescriptions(rxs);
        })
        .catch((e) => showToast(extractApiError(e), 'error'));
    } else if (activeTab === 'expiry') {
      Promise.all([pharmacistService.getLowStock(), pharmacistService.getExpired(), pharmacistService.getNearExpiry()])
        .then(([low, exp, near]) => {
          setLowStockList(low);
          setExpiredList(exp);
          setNearExpiryList(near);
        })
        .catch((e) => showToast(extractApiError(e), 'error'));
    }
  }, [activeTab, loadDashboard, loadMedicines, rxFilter, showToast]);

  const openAddMedicine = () => {
    setEditingMed(null);
    setMedForm({
      medicineName: '',
      batchNumber: '',
      category: 'Cardiovascular',
      availableQuantity: '100',
      reorderLevel: '25',
      unitPrice: '15.00',
      expiryDate: '2028-06-30',
      supplier: '',
      description: '',
    });
    setMedModalOpen(true);
  };

  const openEditMedicine = (m: any) => {
    setEditingMed(m);
    setMedForm({
      medicineName: m.medicine_name || '',
      batchNumber: m.batch_number || '',
      category: m.category || 'Cardiovascular',
      availableQuantity: String(m.available_quantity ?? 0),
      reorderLevel: String(m.reorder_level ?? 25),
      unitPrice: String(m.unit_price ?? 0),
      expiryDate: m.expiry_date || '2028-06-30',
      supplier: m.supplier || '',
      description: m.description || '',
    });
    setMedModalOpen(true);
  };

  const submitMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...medForm,
        availableQuantity: Number(medForm.availableQuantity),
        reorderLevel: Number(medForm.reorderLevel),
        unitPrice: Number(medForm.unitPrice),
      };
      if (editingMed) {
        await pharmacistService.updateMedicine(editingMed.id, payload);
        showToast('Medicine updated.', 'success');
      } else {
        await pharmacistService.createMedicine(payload);
        showToast('Medicine added to inventory.', 'success');
      }
      setMedModalOpen(false);
      await loadMedicines();
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const submitStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModal) return;
    try {
      await pharmacistService.updateStock(stockModal.id, {
        absoluteQuantity: Number(stockModal.absoluteQuantity),
      });
      showToast('Stock quantity updated.', 'success');
      setStockModal(null);
      await loadMedicines();
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const handleDeleteMedicine = (m: any) => {
    setConfirmState({
      open: true,
      title: 'Delete Medicine',
      message: `Remove ${m.medicine_name} (${m.batch_number}) from pharmacy inventory?`,
      onConfirm: async () => {
        try {
          await pharmacistService.deleteMedicine(m.id);
          showToast('Medicine deleted.', 'success');
          setConfirmState(null);
          await loadMedicines();
        } catch (err) {
          showToast(extractApiError(err), 'error');
        }
      },
    });
  };

  const handleViewPrescription = async (rx: any) => {
    setViewingPrescription(rx);
    try {
      const fresh = await doctorService.getPrescriptionById(rx.id);
      setViewingPrescription(fresh);
    } catch {
      // Keep preloaded card data if background refresh fails
    }
  };

  const handleVerifyPrescription = async (rx: any) => {
    try {
      const res = await pharmacistService.verifyPrescription(rx.id);
      showToast(res.message, 'success');
      if (viewingPrescription?.id === rx.id && res.data) {
        setViewingPrescription(res.data);
      }
      if (activeTab === 'dashboard') {
        await loadDashboard();
      } else {
        setPrescriptions(await doctorService.getPrescriptions(rxFilter ? { status: rxFilter } : {}));
      }
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const handleDispenseAndBill = async (rx: any) => {
    try {
      const res = await pharmacistService.verifyPrescription(rx.id);
      const updatedRx = res.data || { ...rx, status: 'DISPENSED' };
      showToast(`${updatedRx.prescription_code} dispensed. Opening bill generator...`, 'success');
      setViewingPrescription(null);
      await openBillFromPrescription(updatedRx);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const openBillFromPrescription = async (rx: any) => {
    const consult = Number(rx.consultation_fee ?? 600);
    const medsTotal = Number(rx.estimatedMedicineTotal ?? 0);
    const diagTotal = Number(rx.diagnosticCharges ?? 0);
    const grandTotal = consult + medsTotal + diagTotal;

    setBillForm({
      patientId: String(rx.patient_id),
      prescriptionId: String(rx.id),
      consultationCharges: String(consult),
      medicineCharges: String(medsTotal.toFixed(2)),
      diagnosticCharges: String(diagTotal.toFixed(2)),
      paidAmount: String(grandTotal.toFixed(2)),
      paymentMethod: 'UPI',
      notes: `Prescription ${rx.prescription_code}`,
    });
    setActiveTab('billing');
    setBillModalOpen(true);

    if (patients.length === 0) {
      try {
        const [p, rxs] = await Promise.all([patientService.list({ limit: 100 }), doctorService.getPrescriptions()]);
        setPatients(p.items || []);
        setPrescriptions(rxs);
      } catch {
        // Billing tab effect will also sync
      }
    }
  };

  const submitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await billingService.create({
        patientId: Number(billForm.patientId),
        prescriptionId: billForm.prescriptionId ? Number(billForm.prescriptionId) : null,
        consultationCharges: Number(billForm.consultationCharges || 0),
        medicineCharges: Number(billForm.medicineCharges || 0),
        diagnosticCharges: Number(billForm.diagnosticCharges || 0),
        paidAmount: Number(billForm.paidAmount || 0),
        paymentMethod: billForm.paymentMethod,
        notes: billForm.notes,
      });
      showToast(res.message || 'Bill generated.', 'success');
      setBillModalOpen(false);
      const [b, rxs] = await Promise.all([billingService.list(), doctorService.getPrescriptions()]);
      setBills(b);
      setPrescriptions(rxs);
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const submitPaymentUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal) return;
    try {
      await billingService.updatePaymentStatus(payModal.id, {
        paidAmount: Number(payModal.paidAmount),
        paymentStatus: payModal.paymentStatus,
        paymentMethod: payModal.paymentMethod,
      });
      showToast('Payment status updated.', 'success');
      setPayModal(null);
      setBills(await billingService.list());
    } catch (err) {
      showToast(extractApiError(err), 'error');
    }
  };

  const medCategories = Array.from(new Set(medicines.map((m) => m.category))).sort();

  return (
    <DashboardLayout
      roleLabel="Pharmacist"
      navItems={PHARMA_NAV}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      primaryAction={
        activeTab === 'billing' ? (
          <button
            type="button"
            onClick={() => {
              setBillForm({
                patientId: patients[0]?.id ? String(patients[0].id) : '',
                prescriptionId: '',
                consultationCharges: '600',
                medicineCharges: '0',
                diagnosticCharges: '0',
                paidAmount: '0',
                paymentMethod: 'UPI',
                notes: '',
              });
              setBillModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Generate Bill
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setActiveTab('inventory');
              openAddMedicine();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Add Medicine
          </button>
        )
      }
    >
      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Medicines"
              value={dashboardStats?.totalMedicines ?? '—'}
              detail={`${dashboardStats?.totalUnitsInStock ?? 0} total units in stock`}
            />
            <StatCard
              label="Pending Prescriptions"
              value={dashboardStats?.pendingPrescriptions ?? '—'}
              tone="primary"
              detail="Awaiting verification & dispensing"
            />
            <StatCard
              label="Low Stock & Expiry Alerts"
              value={(dashboardStats?.lowStockCount ?? 0) + (dashboardStats?.expiredCount ?? 0)}
              tone="danger"
              detail={`${dashboardStats?.lowStockCount ?? 0} low stock · ${dashboardStats?.expiredCount ?? 0} expired · ${dashboardStats?.nearExpiryCount ?? 0} near expiry`}
            />
            <StatCard
              label="Revenue Collected"
              value={`₹${Number(dashboardStats?.totalRevenueCollected ?? 0).toLocaleString('en-IN')}`}
              tone="success"
              detail={`${dashboardStats?.pendingBillsCount ?? 0} open bills`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
              <div className="hmis-band-blue border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0B1F3A]">Prescriptions Pending Verification</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('verify')}
                  className="text-xs font-semibold text-[#0284C7] hover:underline"
                >
                  View All Prescriptions
                </button>
              </div>
              <div className="p-6">
                {prescriptions.length === 0 ? (
                  <p className="text-xs text-[#64748B]">All prescriptions have been verified and dispensed.</p>
                ) : (
                  <div className="divide-y divide-[#F1F5F9]">
                    {prescriptions.map((rx) => (
                      <div key={rx.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[#0F172A]">
                            <span className="font-mono text-[#1D4ED8]">{rx.prescription_code}</span> · {rx.patient_name} (
                            {rx.patient_code})
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#64748B]">
                            {rx.doctor_name} · {rx.items.length} item(s) · Est. ₹{Number(rx.estimatedMedicineTotal).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewPrescription(rx)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#334155] hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" /> View Prescription
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyPrescription(rx)}
                            className="rounded-lg border border-[#1D4ED8] bg-[#EFF6FF] px-2.5 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                          >
                            Dispense
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDispenseAndBill(rx)}
                            className="rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF]"
                          >
                            Dispense & Bill
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
              <div className="hmis-band-rose border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0B1F3A]">Stock & Expiry Watchlist</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('expiry')}
                  className="text-xs font-semibold text-[#0284C7] hover:underline"
                >
                  Inspect All Alerts
                </button>
              </div>
              <div className="p-6 divide-y divide-[#F1F5F9]">
                {expiredList.map((m) => (
                  <div key={`exp-${m.id}`} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{m.medicine_name}</p>
                      <p className="font-mono text-[11px] text-[#64748B]">
                        Batch {m.batch_number} · Exp {m.expiry_date}
                      </p>
                    </div>
                    <StatusText status="EXPIRED" />
                  </div>
                ))}
                {lowStockList.map((m) => (
                  <div key={`low-${m.id}`} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{m.medicine_name}</p>
                      <p className="font-mono text-[11px] text-[#64748B]">
                        {m.available_quantity} left (Reorder ≤ {m.reorder_level})
                      </p>
                    </div>
                    <StatusText status="LOW_STOCK" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEDICINE INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={medSearch}
                onChange={(e) => setMedSearch(e.target.value)}
                placeholder="Search medicine name, ID, batch, or supplier..."
                className="w-full rounded-lg border border-[#CBD5E1] py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={medCategory}
                onChange={(e) => setMedCategory(e.target.value)}
                className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#334155]"
              >
                <option value="">All Categories</option>
                {medCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={openAddMedicine}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> Add Medicine
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="hmis-table-head">
                  <tr>
                    <th className="px-3 py-3">Medicine ID</th>
                    <th className="px-3 py-3">Medicine Name</th>
                    <th className="px-3 py-3">Batch Number</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3 text-right">Available Qty</th>
                    <th className="px-3 py-3 text-right">Unit Price</th>
                    <th className="px-3 py-3">Expiry Date</th>
                    <th className="px-3 py-3">Supplier</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {medicines.map((m) => (
                    <tr key={m.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-3 py-3 font-mono font-semibold text-[#0B1F3A] whitespace-nowrap">{m.medicine_code}</td>
                      <td className="px-3 py-3 font-medium text-[#0F172A]">{m.medicine_name}</td>
                      <td className="px-3 py-3 font-mono text-[#475569]">{m.batch_number}</td>
                      <td className="px-3 py-3 text-[#475569]">{m.category}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        <span className={m.isLowStock ? 'font-bold text-[#B45309]' : 'text-[#0F172A]'}>
                          {m.available_quantity}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">₹{Number(m.unit_price).toFixed(2)}</td>
                      <td className="px-3 py-3 font-mono tabular-nums whitespace-nowrap">
                        <span className={m.isExpired ? 'font-semibold text-[#DC2626]' : m.isNearExpiry ? 'font-semibold text-[#B45309]' : 'text-[#334155]'}>
                          {m.expiry_date}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#475569]">{m.supplier}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setStockModal({
                              id: m.id,
                              name: m.medicine_name,
                              current: m.available_quantity,
                              absoluteQuantity: String(m.available_quantity),
                            })
                          }
                          className="rounded px-2 py-1 text-xs font-medium text-[#0B1F3A] hover:bg-slate-100"
                        >
                          Stock
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditMedicine(m)}
                          className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-[#EFF6FF]"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMedicine(m)}
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

      {/* MEDICINE AVAILABILITY */}
      {activeTab === 'availability' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="hmis-band-teal px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0B1F3A]">Live Medicine Availability & Dispensing Readiness</h2>
                <p className="text-xs text-[#475569]">Expired batches are automatically blocked from prescription dispensing.</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  value={medSearch}
                  onChange={(e) => setMedSearch(e.target.value)}
                  placeholder="Check medicine availability..."
                  className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {medicines.map((m) => (
              <div key={m.id} className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
                <div
                  className={`border-b border-[#E2E8F0] px-5 py-3 flex items-start justify-between gap-2 ${
                    m.isExpired ? 'hmis-band-rose' : m.isLowStock ? 'hmis-band-amber' : 'hmis-band-blue'
                  }`}
                >
                  <div>
                    <p className="text-xs font-mono text-[#475569]">
                      {m.medicine_code} · {m.category}
                    </p>
                    <h3 className="mt-0.5 text-sm font-bold text-[#0B1F3A]">{m.medicine_name}</h3>
                  </div>
                  {m.isExpired ? (
                    <StatusText status="EXPIRED" />
                  ) : m.isLowStock ? (
                    <StatusText status="LOW_STOCK" />
                  ) : (
                    <StatusText status="ACTIVE" />
                  )}
                </div>
                <div className="px-5 py-3.5 flex items-center justify-between text-xs tabular-nums">
                  <span>
                    Qty: <strong className="font-mono text-[#0B1F3A]">{m.available_quantity}</strong>
                  </span>
                  <span>
                    Price: <strong className="font-mono text-[#0B1F3A]">₹{Number(m.unit_price).toFixed(2)}</strong>
                  </span>
                  <span className="font-mono text-[#64748B]">Exp {m.expiry_date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW & VERIFY PRESCRIPTIONS */}
      {activeTab === 'verify' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
            <div className="hmis-band-indigo flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <h2 className="text-sm font-bold text-[#0B1F3A]">View & Verify Prescriptions</h2>
                <p className="text-xs text-[#475569]">
                  Inspect full doctor prescription details, check live stock & batch expiry, and verify dispensing.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    value={rxSearch}
                    onChange={(e) => setRxSearch(e.target.value)}
                    placeholder="Search Rx code, patient, doctor..."
                    className="w-full rounded-lg border border-[#CBD5E1] bg-white py-1.5 pl-8 pr-3 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-white/85 border border-[#E2E8F0] p-1">
                  {['', 'PENDING', 'DISPENSED'].map((st) => (
                    <button
                      key={st || 'ALL'}
                      type="button"
                      onClick={() => setRxFilter(st)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                        rxFilter === st ? 'bg-[#0B3560] text-white shadow-xs' : 'text-[#475569]'
                      }`}
                    >
                      {st || 'All'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {prescriptions
              .filter((rx) => {
                if (!rxSearch.trim()) return true;
                const q = rxSearch.toLowerCase();
                return (
                  String(rx.prescription_code).toLowerCase().includes(q) ||
                  String(rx.patient_name).toLowerCase().includes(q) ||
                  String(rx.patient_code).toLowerCase().includes(q) ||
                  String(rx.doctor_name).toLowerCase().includes(q)
                );
              })
              .map((rx) => (
                <div key={rx.id} className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
                  <div
                    className={`flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-3.5 ${
                      rx.status === 'DISPENSED' ? 'hmis-band-emerald' : 'hmis-band-blue'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#475569]">
                        <span className="font-mono font-bold text-[#1D4ED8]">{rx.prescription_code}</span>
                        <span>·</span>
                        <span className="tabular-nums">{rx.prescribed_date}</span>
                        <span>·</span>
                        <span>{rx.doctor_name}</span>
                      </div>
                      <h3 className="mt-0.5 text-sm font-bold text-[#0B1F3A]">
                        {rx.patient_name} <span className="font-mono text-xs text-[#64748B]">({rx.patient_code})</span>
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <StatusText status={rx.status} />
                      <button
                        type="button"
                        onClick={() => handleViewPrescription(rx)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#334155] hover:bg-slate-50"
                      >
                        <Eye className="h-3.5 w-3.5" /> View Prescription
                      </button>
                      {rx.status === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleVerifyPrescription(rx)}
                            className="rounded-lg border border-[#1D4ED8] bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                          >
                            Dispense Medicine
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDispenseAndBill(rx)}
                            className="rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-3.5 py-1.5 text-xs font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF]"
                          >
                            Dispense & Generate Bill
                          </button>
                        </>
                      ) : rx.bill_code ? (
                        <button
                          type="button"
                          onClick={() => setActiveTab('billing')}
                          className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-mono font-semibold text-[#15803D] hover:bg-slate-100"
                        >
                          Billed: {rx.bill_code}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openBillFromPrescription(rx)}
                          className="rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-3.5 py-1.5 text-xs font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF]"
                        >
                          Generate Bill
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="hmis-table-head">
                        <tr>
                          <th className="px-4 py-2.5">Medicine</th>
                          <th className="px-4 py-2.5">Dosage & Frequency</th>
                          <th className="px-4 py-2.5 text-right">Qty</th>
                          <th className="px-4 py-2.5 text-right">In Stock</th>
                          <th className="px-4 py-2.5">Expiry</th>
                          <th className="px-4 py-2.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {rx.items.map((it: any) => (
                          <tr key={it.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-2.5 font-medium text-[#0F172A]">{it.medicine_name}</td>
                            <td className="px-4 py-2.5 text-[#475569]">
                              {it.dosage} · {it.frequency} ({it.duration_days}d)
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums">{it.quantity_prescribed}</td>
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums">{it.available_quantity}</td>
                            <td className="px-4 py-2.5 font-mono tabular-nums text-[#475569]">{it.expiry_date}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                              ₹{(Number(it.unit_price) * Number(it.quantity_prescribed)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* BILLING & PAYMENTS */}
      {activeTab === 'billing' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748B]">
              Calculate consultation, medicine, and diagnostic charges, generate invoices, and record payments.
            </p>
            <button
              type="button"
              onClick={() => {
                setBillForm({
                  patientId: patients[0]?.id ? String(patients[0].id) : '',
                  prescriptionId: '',
                  consultationCharges: '600',
                  medicineCharges: '0',
                  diagnosticCharges: '0',
                  paidAmount: '0',
                  paymentMethod: 'UPI',
                  notes: '',
                });
                setBillModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF] shadow-xs whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Generate Bill
            </button>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
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
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {bills.map((b) => (
                    <tr key={b.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono font-semibold text-[#0B1F3A]">{b.bill_code}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#0F172A]">{b.patient_name}</p>
                        <p className="font-mono text-[11px] text-[#64748B]">{b.patient_code}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">₹{Number(b.consultation_charges).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">₹{Number(b.medicine_charges).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">₹{Number(b.diagnostic_charges).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">₹{Number(b.total_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">₹{Number(b.paid_amount).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <StatusText status={b.payment_status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setPayModal({
                              id: b.id,
                              billCode: b.bill_code,
                              totalAmount: Number(b.total_amount),
                              paidAmount: String(b.total_amount),
                              paymentStatus: 'PAID',
                              paymentMethod: b.payment_method || 'UPI',
                            })
                          }
                          className="text-xs font-medium text-[#1D4ED8] hover:underline"
                        >
                          Record Payment
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

      {/* EXPIRY MONITORING */}
      {activeTab === 'expiry' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1 rounded-lg bg-white border border-[#E2E8F0] p-1 w-fit">
            <button
              type="button"
              onClick={() => setAlertTab('low')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${
                alertTab === 'low' ? 'bg-[#1D4ED8] text-white' : 'text-[#475569]'
              }`}
            >
              Low Stock ({lowStockList.length})
            </button>
            <button
              type="button"
              onClick={() => setAlertTab('expired')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${
                alertTab === 'expired' ? 'bg-[#DC2626] text-white' : 'text-[#475569]'
              }`}
            >
              Expired ({expiredList.length})
            </button>
            <button
              type="button"
              onClick={() => setAlertTab('near')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${
                alertTab === 'near' ? 'bg-[#B45309] text-white' : 'text-[#475569]'
              }`}
            >
              Near Expiry ≤ 30d ({nearExpiryList.length})
            </button>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            {(() => {
              const rows = alertTab === 'low' ? lowStockList : alertTab === 'expired' ? expiredList : nearExpiryList;
              if (rows.length === 0) {
                return (
                  <div className="p-6">
                    <EmptyState title="No active alerts" description="All inventory batches in this category are nominal." />
                  </div>
                );
              }
              return (
                <table className="w-full text-left text-xs">
                  <thead className="hmis-table-head">
                    <tr>
                      <th className="px-4 py-3">Medicine</th>
                      <th className="px-4 py-3">Batch Number</th>
                      <th className="px-4 py-3 text-right">Available Qty</th>
                      <th className="px-4 py-3 text-right">Reorder Level</th>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Alert State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {rows.map((m) => (
                      <tr key={m.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-semibold text-[#0F172A]">{m.medicine_name}</td>
                        <td className="px-4 py-3 font-mono text-[#475569]">{m.batch_number}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{m.available_quantity}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{m.reorder_level}</td>
                        <td className="px-4 py-3 font-mono tabular-nums">{m.expiry_date}</td>
                        <td className="px-4 py-3 text-[#475569]">{m.supplier}</td>
                        <td className="px-4 py-3">
                          <StatusText
                            status={alertTab === 'low' ? 'LOW_STOCK' : alertTab === 'expired' ? 'EXPIRED' : 'NEAR_EXPIRY'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}

      {/* MEDICINE ADD / EDIT MODAL */}
      {medModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">{editingMed ? 'Edit Medicine' : 'Add Medicine'}</h3>
            <form onSubmit={submitMedicine} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#334155]">Medicine Name *</label>
                <input
                  required
                  value={medForm.medicineName}
                  onChange={(e) => setMedForm({ ...medForm, medicineName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Batch Number *</label>
                <input
                  required
                  value={medForm.batchNumber}
                  onChange={(e) => setMedForm({ ...medForm, batchNumber: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Category *</label>
                <input
                  required
                  value={medForm.category}
                  onChange={(e) => setMedForm({ ...medForm, category: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Available Quantity *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={medForm.availableQuantity}
                  onChange={(e) => setMedForm({ ...medForm, availableQuantity: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Unit Price (₹) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={medForm.unitPrice}
                  onChange={(e) => setMedForm({ ...medForm, unitPrice: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Expiry Date *</label>
                <input
                  required
                  type="date"
                  value={medForm.expiryDate}
                  onChange={(e) => setMedForm({ ...medForm, expiryDate: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Supplier *</label>
                <input
                  required
                  value={medForm.supplier}
                  onChange={(e) => setMedForm({ ...medForm, supplier: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2 mt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMedModalOpen(false)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  {editingMed ? 'Save Changes' : 'Add Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK STOCK MODAL */}
      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">Update Stock — {stockModal.name}</h3>
            <p className="mt-1 text-xs text-[#64748B]">Current stock: {stockModal.current} units</p>
            <form onSubmit={submitStockUpdate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155]">New Available Quantity</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={stockModal.absoluteQuantity}
                  onChange={(e) => setStockModal({ ...stockModal, absoluteQuantity: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStockModal(null)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATE BILL MODAL */}
      {billModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">Generate Patient Bill</h3>
            <form onSubmit={submitBill} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Patient *</label>
                <select
                  required
                  value={billForm.patientId}
                  onChange={(e) => setBillForm({ ...billForm, patientId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  {billForm.patientId &&
                    !patients.some((p) => String(p.id) === billForm.patientId) && (() => {
                      const matchedRx = prescriptions.find((r) => String(r.patient_id) === billForm.patientId);
                      return (
                        <option value={billForm.patientId}>
                          {matchedRx ? `${matchedRx.patient_code} — ${matchedRx.patient_name}` : `Patient #${billForm.patientId}`}
                        </option>
                      );
                    })()}
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_code} — {p.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Link Prescription (Optional)</label>
                <select
                  value={billForm.prescriptionId}
                  onChange={(e) => {
                    const rxId = e.target.value;
                    const rx = prescriptions.find((r) => String(r.id) === rxId);
                    if (!rx) {
                      setBillForm((f) => ({ ...f, prescriptionId: '' }));
                      return;
                    }
                    const consult = Number(rx.consultation_fee ?? 600);
                    const meds = Number(rx.estimatedMedicineTotal ?? 0);
                    const diag = Number(rx.diagnosticCharges ?? 0);
                    setBillForm((f) => ({
                      ...f,
                      prescriptionId: rxId,
                      patientId: String(rx.patient_id),
                      consultationCharges: String(consult),
                      medicineCharges: String(meds.toFixed(2)),
                      diagnosticCharges: String(diag.toFixed(2)),
                      paidAmount: String((consult + meds + diag).toFixed(2)),
                      notes: `Prescription ${rx.prescription_code}`,
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  <option value="">None (Manual charges)</option>
                  {prescriptions.map((r) => (
                    <option key={r.id} value={r.id} disabled={Boolean(r.bill_code) && String(r.id) !== billForm.prescriptionId}>
                      {r.prescription_code} — {r.patient_name} (₹{Number(r.estimatedMedicineTotal ?? 0).toFixed(2)})
                      {r.bill_code ? ` · Billed (${r.bill_code})` : ` · ${r.status}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Consultation (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billForm.consultationCharges}
                    onChange={(e) => setBillForm({ ...billForm, consultationCharges: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-2.5 py-2 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Medicine (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billForm.medicineCharges}
                    onChange={(e) => setBillForm({ ...billForm, medicineCharges: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-2.5 py-2 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Diagnostic (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billForm.diagnosticCharges}
                    onChange={(e) => setBillForm({ ...billForm, diagnosticCharges: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-2.5 py-2 text-xs tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Amount Paid Now (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billForm.paidAmount}
                    onChange={(e) => setBillForm({ ...billForm, paidAmount: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155]">Payment Method</label>
                  <select
                    value={billForm.paymentMethod}
                    onChange={(e) => setBillForm({ ...billForm, paymentMethod: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CARD">CARD</option>
                    <option value="CASH">CASH</option>
                    <option value="INSURANCE">INSURANCE</option>
                  </select>
                </div>
              </div>
              <div className="rounded-lg bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#0B1F3A] flex justify-between">
                <span>Calculated Total Amount</span>
                <span className="font-mono tabular-nums">
                  ₹
                  {(
                    Number(billForm.consultationCharges || 0) +
                    Number(billForm.medicineCharges || 0) +
                    Number(billForm.diagnosticCharges || 0)
                  ).toFixed(2)}
                </span>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBillModalOpen(false)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT RECORD MODAL */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0B1F3A]">Update Payment — {payModal.billCode}</h3>
            <p className="mt-1 text-xs text-[#64748B] font-mono">Total Due: ₹{payModal.totalAmount.toFixed(2)}</p>
            <form onSubmit={submitPaymentUpdate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Paid Amount (₹)</label>
                <input
                  required
                  type="number"
                  min="0"
                  max={payModal.totalAmount}
                  step="0.01"
                  value={payModal.paidAmount}
                  onChange={(e) => setPayModal({ ...payModal, paidAmount: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Payment Status</label>
                <select
                  value={payModal.paymentStatus}
                  onChange={(e) => setPayModal({ ...payModal, paymentStatus: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  <option value="PAID">PAID</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Payment Method</label>
                <select
                  value={payModal.paymentMethod}
                  onChange={(e) => setPayModal({ ...payModal, paymentMethod: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                >
                  <option value="UPI">UPI</option>
                  <option value="CARD">CARD</option>
                  <option value="CASH">CASH</option>
                  <option value="INSURANCE">INSURANCE</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModal(null)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PRESCRIPTION DETAIL MODAL */}
      {viewingPrescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
            <div className="hmis-band-blue -mx-6 -mt-6 mb-5 rounded-t-xl px-6 py-4 flex items-start justify-between gap-4 border-b border-[#E2E8F0]">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-bold text-[#1D4ED8]">
                    {viewingPrescription.prescription_code}
                  </span>
                  <StatusText status={viewingPrescription.status} />
                </div>
                <h3 className="mt-1 text-base font-bold text-[#0B1F3A]">Prescription Detail & Stock Verification</h3>
                <p className="mt-0.5 text-xs text-[#475569] tabular-nums">
                  Prescribed Date: {viewingPrescription.prescribed_date}
                  {viewingPrescription.verified_by_name
                    ? ` · Verified by ${viewingPrescription.verified_by_name}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPrescription(null)}
                className="rounded-lg border border-[#CBD5E1] bg-white p-1.5 text-[#64748B] hover:bg-slate-100"
                aria-label="Close prescription view"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs">
                <p className="text-[11px] font-medium text-[#64748B]">Patient Details</p>
                <p className="mt-1 text-sm font-semibold text-[#0B1F3A]">{viewingPrescription.patient_name}</p>
                <p className="mt-0.5 font-mono text-[#1D4ED8]">{viewingPrescription.patient_code}</p>
                {(viewingPrescription.patient_age || viewingPrescription.patient_gender || viewingPrescription.patient_mobile) && (
                  <p className="mt-1 text-[#475569] tabular-nums">
                    {[
                      viewingPrescription.patient_age ? `${viewingPrescription.patient_age} yrs` : null,
                      viewingPrescription.patient_gender,
                      viewingPrescription.patient_mobile,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs">
                <p className="text-[11px] font-medium text-[#64748B]">Prescribing Doctor</p>
                <p className="mt-1 text-sm font-semibold text-[#0B1F3A]">{viewingPrescription.doctor_name}</p>
                {viewingPrescription.doctor_specialization && (
                  <p className="mt-0.5 text-[#475569]">{viewingPrescription.doctor_specialization}</p>
                )}
                {viewingPrescription.notes && (
                  <p className="mt-1.5 text-[#334155]">
                    <span className="font-medium text-[#64748B]">Notes:</span> {viewingPrescription.notes}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[#E2E8F0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="hmis-table-head">
                    <tr>
                      <th className="px-3 py-2.5">Medicine & Batch</th>
                      <th className="px-3 py-2.5">Dosage & Regimen</th>
                      <th className="px-3 py-2.5">Instructions</th>
                      <th className="px-3 py-2.5 text-right">Prescribed</th>
                      <th className="px-3 py-2.5 text-right">Stock</th>
                      <th className="px-3 py-2.5">Expiry</th>
                      <th className="px-3 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(viewingPrescription.items || []).map((it: any) => {
                      const lowForRx = Number(it.available_quantity) < Number(it.quantity_prescribed);
                      return (
                        <tr key={it.id}>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-[#0F172A]">{it.medicine_name}</p>
                            <p className="font-mono text-[11px] text-[#64748B]">
                              {it.medicine_code || ''} {it.batch_number ? `· ${it.batch_number}` : ''}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-[#334155]">
                            {it.dosage} · {it.frequency}
                            <span className="block text-[11px] text-[#64748B]">{it.duration_days} days</span>
                          </td>
                          <td className="px-3 py-2.5 text-[#475569]">{it.instructions || 'As directed'}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-[#0B1F3A]">
                            {it.quantity_prescribed}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                              lowForRx ? 'font-semibold text-[#DC2626]' : 'text-[#15803D]'
                            }`}
                          >
                            {it.available_quantity}
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-[#475569]">{it.expiry_date}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#0F172A]">
                            ₹{(Number(it.unit_price) * Number(it.quantity_prescribed)).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#EFF6FF] px-4 py-3 text-xs">
              <span className="font-medium text-[#0B1F3A]">Total Estimated Medicine Charges</span>
              <span className="font-mono text-sm font-bold text-[#1D4ED8] tabular-nums">
                ₹{Number(viewingPrescription.estimatedMedicineTotal ?? 0).toFixed(2)}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setViewingPrescription(null)}
                className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-medium text-[#334155] hover:bg-slate-50"
              >
                Close
              </button>
              {viewingPrescription.status === 'PENDING' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleVerifyPrescription(viewingPrescription)}
                    className="rounded-lg border border-[#1D4ED8] bg-[#EFF6FF] px-4 py-2 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                  >
                    Dispense Medicine
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDispenseAndBill(viewingPrescription)}
                    className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                  >
                    Dispense & Generate Bill
                  </button>
                </>
              ) : viewingPrescription.bill_code ? (
                <button
                  type="button"
                  onClick={() => {
                    setViewingPrescription(null);
                    setActiveTab('billing');
                  }}
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  View Invoice ({viewingPrescription.bill_code})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const rx = viewingPrescription;
                    setViewingPrescription(null);
                    openBillFromPrescription(rx);
                  }}
                  className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                >
                  Generate Bill
                </button>
              )}
            </div>
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
