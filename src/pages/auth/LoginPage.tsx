import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Eye, EyeOff, Lock, Mail, Moon, Phone, ShieldCheck, Stethoscope, Sun, User, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { extractApiError } from '../../services/api';
import { authService, PublicDepartment } from '../../services/authService';
import { HospitalLogo } from '../../components/HospitalLogo';

const ATRIUM_SRC = '/src/assets/images/hospital_login_atrium_1795346117802.jpg';

const STAFF_ACCOUNTS = [
  { role: 'Administrator', name: 'Neha Kumari', email: 'admin@hmis.edu', pass: 'Admin@123' },
  { role: 'Registration Staff', name: 'Manish Sharma', email: 'reg1@hmis.edu', pass: 'Reg@123' },
  { role: 'Doctor', name: 'Dr. Nisha Kumari', email: 'dr.nisha@hmis.edu', pass: 'Doctor@123' },
  { role: 'Pharmacist', name: 'Atit Kumar', email: 'pharma1@hmis.edu', pass: 'Pharma@123' },
];

export const LoginPage: React.FC = () => {
  const { login, registerUser } = useAuth();
  const { showToast } = useToast();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Sign-In state
  const [email, setEmail] = useState('admin@hmis.edu');
  const [password, setPassword] = useState('Admin@123');
  const [showPass, setShowPass] = useState(false);

  // Registration state
  const [departments, setDepartments] = useState<PublicDepartment[]>([]);
  const [regForm, setRegForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    roleName: 'REGISTRATION_STAFF' as 'REGISTRATION_STAFF' | 'DOCTOR' | 'PHARMACIST',
    departmentId: '',
    specialization: '',
    qualification: '',
    consultationFee: '600',
    password: '',
    confirmPassword: '',
  });
  const [showRegPass, setShowRegPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    authService
      .getPublicDepartments()
      .then((rows) => {
        setDepartments(rows);
        if (rows.length > 0) {
          setRegForm((prev) => (prev.departmentId ? prev : { ...prev, departmentId: String(rows[0].id) }));
        }
      })
      .catch(() => {
        // Non-blocking fallback when offline
      });
  }, []);

  const routeForRole = (role: string) => {
    if (role === 'ADMIN') return '/admin';
    if (role === 'REGISTRATION_STAFF') return '/registration';
    if (role === 'DOCTOR') return '/doctor';
    if (role === 'PHARMACIST') return '/pharmacist';
    return '/';
  };

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setErrorMsg('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      showToast(`Signed in as ${user.fullName}`, 'success');
      navigate(routeForRole(user.role), { replace: true });
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Invalid credentials. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!regForm.fullName.trim() || !regForm.email.trim() || !regForm.password) {
      setErrorMsg('Full name, email address, and password are required.');
      return;
    }
    if (regForm.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const user = await registerUser({
        fullName: regForm.fullName.trim(),
        email: regForm.email.trim().toLowerCase(),
        password: regForm.password,
        phone: regForm.phone.trim() || undefined,
        roleName: regForm.roleName,
        departmentId: regForm.departmentId ? Number(regForm.departmentId) : null,
        specialization: regForm.roleName === 'DOCTOR' ? regForm.specialization.trim() || undefined : undefined,
        qualification: regForm.roleName === 'DOCTOR' ? regForm.qualification.trim() || undefined : undefined,
        consultationFee:
          regForm.roleName === 'DOCTOR' ? Math.max(0, Number(regForm.consultationFee) || 500) : undefined,
      });
      showToast(`Account created (${user.staffCode}). Welcome, ${user.fullName}`, 'success');
      navigate(routeForRole(user.role), { replace: true });
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Registration failed. Please verify your details.'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSignIn = async (accEmail: string, accPass: string) => {
    setMode('login');
    setEmail(accEmail);
    setPassword(accPass);
    setErrorMsg('');
    setLoading(true);
    try {
      const user = await login(accEmail, accPass);
      showToast(`Signed in as ${user.fullName}`, 'success');
      navigate(routeForRole(user.role), { replace: true });
    } catch (err) {
      setErrorMsg(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white">
      {/* Left Architectural Clinical Panel */}
      <div className="relative hidden lg:flex lg:col-span-6 xl:col-span-6 flex-col justify-between overflow-hidden bg-[#0B1F3A]">
        <img
          src={ATRIUM_SRC}
          alt="Hospital Clinical Atrium"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A] via-[#0B1F3A]/65 to-[#0B1F3A]/35" />

        <div className="relative z-10 flex items-center gap-5 p-10">
          <HospitalLogo size="xl" className="shadow-lg" />
          <div className="min-w-0">
            <h1 className="text-4xl xl:text-[46px] font-bold tracking-tight leading-[1.12] text-white [text-wrap:balance]">
              Hospital Management Information System
            </h1>
          </div>
        </div>

        <div className="relative z-10 p-10 max-w-xl">
          <h2 className="text-xl xl:text-2xl font-semibold leading-snug text-[#F8FAFC] [text-wrap:balance]">
            Integrated clinical care, patient registration, scheduling, and pharmacy billing.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#DBEAFE]">
            Centralized hospital operations connecting administration, front-desk intake, attending physicians, and
            clinical pharmacy through real-time relational workflows.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-white/15 bg-white/10 px-3.5 py-2.5 text-white backdrop-blur-xs">
              <p className="font-semibold">Patient & OPD Intake</p>
              <p className="mt-0.5 text-[#BFDBFE]">Demographics, slots & history</p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 px-3.5 py-2.5 text-white backdrop-blur-xs">
              <p className="font-semibold">Clinical & Pharmacy</p>
              <p className="mt-0.5 text-[#BFDBFE]">E-prescriptions, lab orders & billing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Authentication & Registration Workspace */}
      <div className="lg:col-span-6 xl:col-span-6 flex flex-col justify-center px-5 py-8 sm:px-10 lg:px-12 bg-[#EEF4FB]">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-4 flex items-center justify-between gap-3">
            {/* Mobile Brand Header */}
            <div className="flex items-center gap-3.5 lg:hidden">
              <HospitalLogo size="md" />
              <div className="min-w-0">
                <p className="text-2xl sm:text-[26px] font-bold text-[#0B1F3A] leading-tight [text-wrap:balance]">
                  Hospital Management Information System
                </p>
              </div>
            </div>
            <div className="ml-auto">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#334155] hover:bg-slate-50 transition-colors"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="h-3.5 w-3.5 text-[#FBBF24]" /> : <Moon className="h-3.5 w-3.5 text-[#475569]" />}
                <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-xs">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#F1F5F9] p-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'login' ? 'bg-white text-[#0B1F3A] shadow-xs' : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'register' ? 'bg-white text-[#0B1F3A] shadow-xs' : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                New User Registration
              </button>
            </div>

            <div className="mt-5">
              <h2 className="text-xl font-semibold text-[#0B1F3A]">
                {mode === 'login' ? 'Staff Portal Sign In' : 'Create New User Account'}
              </h2>
              <p className="mt-1 text-xs text-[#64748B]">
                {mode === 'login'
                  ? 'Sign in with your hospital credentials to access your role workspace.'
                  : 'Register a new Registration Staff, Doctor, or Pharmacist account to connect directly.'}
              </p>
            </div>

            {errorMsg && (
              <div className="mt-4 rounded-lg border border-[#DC2626]/25 bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#DC2626]">
                {errorMsg}
              </div>
            )}

            {mode === 'login' ? (
              <>
                <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-medium text-[#334155]">
                      Hospital Email Address
                    </label>
                    <div className="relative mt-1.5">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@hmis.edu"
                        className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-xs font-medium text-[#334155]">
                      Password
                    </label>
                    <div className="relative mt-1.5">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <input
                        id="login-password"
                        type={showPass ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-10 text-sm text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((s) => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A]"
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF] shadow-xs transition-all disabled:opacity-60"
                  >
                    {loading ? 'Verifying Credentials...' : 'Sign In to Workspace'}
                  </button>
                </form>

                {/* Role Accounts */}
                <div className="mt-6 border-t border-[#E2E8F0] pt-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#0B1F3A]">Authorized Staff Portals</p>
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="text-xs font-semibold text-[#0284C7] hover:underline"
                    >
                      Register new user
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">
                    Select a staff portal below to authenticate directly.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {STAFF_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        disabled={loading}
                        onClick={() => handleQuickSignIn(acc.email, acc.pass)}
                        className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-left hover:border-[#0284C7] hover:bg-[#EFF6FF] transition-colors"
                      >
                        <p className="text-[11px] font-semibold text-[#0284C7]">{acc.role}</p>
                        <p className="text-xs font-semibold text-[#0B1F3A]">{acc.name}</p>
                        <p className="text-[11px] font-mono text-[#475569] truncate">{acc.email}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="mt-5 space-y-3.5">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-fullname" className="block text-xs font-medium text-[#334155]">
                      Full Name *
                    </label>
                    <div className="relative mt-1">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <input
                        id="reg-fullname"
                        type="text"
                        required
                        value={regForm.fullName}
                        onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                        placeholder="e.g. Rahul Verma"
                        className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-phone" className="block text-xs font-medium text-[#334155]">
                      Phone Number
                    </label>
                    <div className="relative mt-1">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <input
                        id="reg-phone"
                        type="tel"
                        value={regForm.phone}
                        onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                        placeholder="+91-98XXXXXXXX"
                        className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-xs font-medium text-[#334155]">
                    Hospital Email Address *
                  </label>
                  <div className="relative mt-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      placeholder="name@hmis.edu"
                      className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-role" className="block text-xs font-medium text-[#334155]">
                      Role *
                    </label>
                    <select
                      id="reg-role"
                      value={regForm.roleName}
                      onChange={(e) =>
                        setRegForm({
                          ...regForm,
                          roleName: e.target.value as 'REGISTRATION_STAFF' | 'DOCTOR' | 'PHARMACIST',
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none"
                    >
                      <option value="REGISTRATION_STAFF">Registration Staff</option>
                      <option value="DOCTOR">Doctor</option>
                      <option value="PHARMACIST">Pharmacist</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="reg-dept" className="block text-xs font-medium text-[#334155]">
                      Department
                    </label>
                    <div className="relative mt-1">
                      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <select
                        id="reg-dept"
                        value={regForm.departmentId}
                        onChange={(e) => setRegForm({ ...regForm, departmentId: e.target.value })}
                        className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none"
                      >
                        <option value="">General / Unassigned</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {regForm.roleName === 'DOCTOR' && (
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#334155]">Specialization</label>
                      <div className="relative mt-1">
                        <Stethoscope className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                        <input
                          type="text"
                          value={regForm.specialization}
                          onChange={(e) => setRegForm({ ...regForm, specialization: e.target.value })}
                          placeholder="e.g. Cardiology"
                          className="w-full rounded-md border border-[#CBD5E1] bg-white py-1.5 pl-8 pr-2 text-xs text-[#0F172A]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#334155]">Qualification</label>
                      <input
                        type="text"
                        value={regForm.qualification}
                        onChange={(e) => setRegForm({ ...regForm, qualification: e.target.value })}
                        placeholder="e.g. MBBS, MD"
                        className="mt-1 w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#334155]">Fee (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={regForm.consultationFee}
                        onChange={(e) => setRegForm({ ...regForm, consultationFee: e.target.value })}
                        className="mt-1 w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-mono text-[#0F172A] tabular-nums"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-password" className="block text-xs font-medium text-[#334155]">
                      Password *
                    </label>
                    <div className="relative mt-1">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <input
                        id="reg-password"
                        type={showRegPass ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={regForm.password}
                        onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                        placeholder="Min 6 characters"
                        className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-9 text-sm text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPass((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A]"
                        aria-label={showRegPass ? 'Hide password' : 'Show password'}
                      >
                        {showRegPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-confirm" className="block text-xs font-medium text-[#334155]">
                      Confirm Password *
                    </label>
                    <div className="relative mt-1">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <input
                        id="reg-confirm"
                        type={showRegPass ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={regForm.confirmPassword}
                        onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                        placeholder="Re-enter password"
                        className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white hover:from-[#0369A1] hover:to-[#1E40AF] shadow-xs transition-all disabled:opacity-60"
                >
                  {loading ? 'Creating Account...' : 'Register & Open Workspace'}
                </button>

                <p className="text-center text-xs text-[#64748B]">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-semibold text-[#1D4ED8] hover:underline"
                  >
                    Sign in here
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
