import { useState, useEffect, useRef } from 'react';
import { Code, Camera, BarChart3, PenTool, Home, ArrowLeftRight, User, Settings, LogOut, Bell, ArrowRight, CheckCircle, MessageSquare, Star, ArrowUpRight, Edit, Repeat, Bot, Send, Sparkles, Plus, Trash2, MessageSquarePlus, RefreshCw, Shield, Users, Search, Calendar as CalendarIcon, Clock, CalendarCheck, Check, FileText, Video, Paperclip, Download, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { API_URL } from '../config.js';
import { io } from 'socket.io-client';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import AdminTab from './components/AdminTab';
import { requestFirebaseToken, onMessageListener } from './firebase';
import { JitsiMeeting } from '@jitsi/react-sdk';

type Page = 'register' | 'login' | 'dashboard' | 'forgot-password' | 'reset-password';
type Tab = 'home' | 'matches' | 'search' | 'requests' | 'bookings' | 'profile' | 'settings' | 'chatbot' | 'admin';

interface UserData {
  name: string;
  email: string;
  initials: string;
  profilePhoto?: string;
  skillOffer: string;
  skillWant: string;
  bio?: string;
  rating?: number;
  exchanges?: number;
  // memberSince?: number;
  memberSince?: number;
  settings?: {
    visibility: boolean;
    matchRequests: boolean;
    messages: boolean;
    weeklyDigest: boolean;
  };
}

interface ActivityLogItem {
  id: string;
  type: 'success' | 'message' | 'star';
  text: string;
  time: string;
}

const USERS_STORAGE_KEY = 'SKILLSWAP_USERS';

async function safeFetchJson(url: string, options?: RequestInit) {
  // Prepend API base URL for relative paths
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  try {
    const response = await fetch(fullUrl, options);
    let data: any = {};
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (!response.ok) {
          throw new Error(`Server returned error status ${response.status}`);
        }
        throw new Error('Server returned an invalid non-JSON response.');
      }
    }
    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }
    return data;
  } catch (error: any) {
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      throw new Error('Could not connect to server. Please ensure the backend is running.');
    }
    throw error;
  }
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('register');
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) {
      setResetToken(token);
      setCurrentPage('reset-password');
    }
  }, []);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [activeVideoCall, setActiveVideoCall] = useState<{ roomName: string; subject: string; partnerName: string } | null>(null);
  const [user, setUser] = useState<UserData>({
    name: 'Alex Johnson',
    email: 'alex@example.com',
    initials: 'AJ',
    skillOffer: 'Web Development',
    skillWant: 'Graphic Design',
    bio: 'Fullstack developer and designer based in Chennai. I love building clean interfaces and helping others learn web skills.',
    rating: 4.9,
    exchanges: 12,
    memberSince: 2024
  });

  const showPage = (page: Page) => setCurrentPage(page);
  const switchTab = (tab: Tab) => setActiveTab(tab);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const skillOffer = formData.get('skillOffer') as string;
    const skillWant = formData.get('skillWant') as string;
    const password = formData.get('password') as string;

    if (!firstName || !lastName || !email || !skillOffer || !skillWant || !password) {
      toast.error('Please fill in all fields.');
      return;
    }

    try {
      const data = await safeFetchJson('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, skillOffer, skillWant, password })
      });

      setUser(data.user);
      showPage('dashboard');
      toast.success(`Welcome to SkillSwap, ${firstName}!`);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during registration.');
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      toast.error('Invalid email or password.');
      return;
    }

    try {
      const data = await safeFetchJson('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      setUser(data.user);
      showPage('dashboard');
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during login.');
    }
  };

  const handleLogout = () => {
    showPage('login');
    toast.success('You have been logged out.');
  };

  return (
    <div style={{ fontFamily: 'var(--font-body)' }} className="size-full flex items-center justify-center bg-[#f5f5f7] relative">
      <Toaster position="bottom-center" />

      {currentPage === 'register' && <RegisterPage onNavigate={() => showPage('login')} onRegister={handleRegister} />}
      {currentPage === 'login' && <LoginPage onNavigate={() => showPage('register')} onForgot={() => showPage('forgot-password')} onLogin={handleLogin} />}
      {currentPage === 'forgot-password' && <ForgotPasswordPage onBack={() => showPage('login')} />}
      {currentPage === 'reset-password' && <ResetPasswordPage token={resetToken!} onBack={() => showPage('login')} onComplete={() => { window.history.replaceState({}, document.title, '/'); showPage('login'); }} />}
      {currentPage === 'dashboard' && (
        <DashboardPage
          activeTab={activeTab}
          onTabChange={switchTab}
          user={user}
          onLogout={handleLogout}
          onUserUpdate={(updatedUser) => setUser(updatedUser)}
          setActiveVideoCall={setActiveVideoCall}
        />
      )}

      {activeVideoCall && (
        <div className="fixed inset-0 z-[999] flex flex-col bg-black/90 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 text-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></div>
              <div>
                <h3 className="text-sm font-bold leading-tight">{activeVideoCall.subject}</h3>
                <p className="text-[10px] text-zinc-400">Meeting Room: {activeVideoCall.roomName} · Call with {activeVideoCall.partnerName}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveVideoCall(null)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-md shadow-md transition-all cursor-pointer"
            >
              End / Leave Call
            </button>
          </div>
          <div className="flex-1 bg-zinc-950 flex items-center justify-center relative">
            <JitsiMeeting
              domain="meet.jit.si"
              roomName={activeVideoCall.roomName}
              configOverwrite={{
                startWithAudioMuted: true,
                startWithVideoMuted: true,
                prejoinPageEnabled: false,
              }}
              userInfo={{
                displayName: user.name,
                email: user.email

              }}
              getIFrameRef={(iframeRef) => {
                iframeRef.style.height = '100%';
                iframeRef.style.width = '100%';
              }}
              onReadyToClose={() => setActiveVideoCall(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RegisterPage({ onNavigate, onRegister }: { onNavigate: () => void; onRegister: (e: React.FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="w-full h-screen bg-background rounded-[10px] overflow-hidden shadow-lg">
      <div className="grid grid-cols-2 h-full">
        <AuthLeft
          title="Trade skills, grow together."
          subtitle="Connect with people who have what you need — and share what you know."
        />
        <div className="bg-background p-10 flex flex-col justify-center">
          <h1 style={{ fontFamily: 'var(--font-head)' }} className="text-[22px] font-bold mb-1.5">Create your account</h1>
          <p className="text-[13px] text-muted-foreground mb-8">
            Already have one? <button onClick={onNavigate} className="text-[var(--brand)] font-medium hover:underline">Sign in</button>
          </p>
          <form onSubmit={onRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" name="firstName" type="text" placeholder="Alex" />
              <FormField label="Last name" name="lastName" type="text" placeholder="Johnson" />
            </div>
            <FormField label="Email address" name="email" type="email" placeholder="alex@example.com" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Skill I know</label>
                <select name="skillOffer" className="w-full px-3 py-2.5 border-[0.5px] border-border rounded-md bg-secondary text-foreground text-sm outline-none focus:border-[var(--brand)]" required>
                  <option value="">Select a skill…</option>
                  <option>Full Stack Development</option>
                  <option>Frontend Development</option>
                  <option>Backend Development</option>
                  <option>Mobile App Development</option>
                  <option>Data Science</option>
                  <option>Artificial Intelligence & Machine Learning</option>
                  <option>Cybersecurity</option>
                  <option>Cloud Computing</option>
                  <option>DevOps</option>
                  <option>Software Testing</option>
                  <option>Database Administration (DBA)</option>
                  <option>UI/UX Design</option>
                  <option>Business Intelligence (BI)</option>
                  <option>Data Engineering</option>
                  <option>Embedded Systems / IoT</option>
                  <option>Game Development</option>
                  <option>Blockchain Development</option>
                  <option>ERP / CRM</option>
                  <option>Java + DSA + SQL</option>
                  <option>MERN Stack</option>
                  <option>Python + AI/ML</option>
                  <option>Cloud (AWS)</option>
                  <option>Testing (Selenium)</option>
                  <option>Power BI + SQL</option>
                  <option>Cybersecurity Basics</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Skill I want</label>
                <select name="skillWant" className="w-full px-3 py-2.5 border-[0.5px] border-border rounded-md bg-secondary text-foreground text-sm outline-none focus:border-[var(--brand)]" required>
                  <option value="">Select a skill…</option>
                  <option>Full Stack Development</option>
                  <option>Frontend Development</option>
                  <option>Backend Development</option>
                  <option>Mobile App Development</option>
                  <option>Data Science</option>
                  <option>Artificial Intelligence & Machine Learning</option>
                  <option>Cybersecurity</option>
                  <option>Cloud Computing</option>
                  <option>DevOps</option>
                  <option>Software Testing</option>
                  <option>Database Administration (DBA)</option>
                  <option>UI/UX Design</option>
                  <option>Business Intelligence (BI)</option>
                  <option>Data Engineering</option>
                  <option>Embedded Systems / IoT</option>
                  <option>Game Development</option>
                  <option>Blockchain Development</option>
                  <option>ERP / CRM</option>
                  <option>Java + DSA + SQL</option>
                  <option>MERN Stack</option>
                  <option>Python + AI/ML</option>
                  <option>Cloud (AWS)</option>
                  <option>Testing (Selenium)</option>
                  <option>Power BI + SQL</option>
                  <option>Cybersecurity Basics</option>
                </select>
              </div>
            </div>
            <FormField label="Password" name="password" type="password" placeholder="At least 8 characters" />
            <button type="submit" style={{ fontFamily: 'var(--font-head)' }} className="w-full mt-2 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-mid)] text-white rounded-md font-semibold text-[15px] transition-colors flex items-center justify-center gap-2">
              Create account <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-muted-foreground text-center mt-4 leading-relaxed">
              By registering you agree to our <button type="button" className="text-[var(--brand)] hover:underline">Terms of Service</button> and <button type="button" className="text-[var(--brand)] hover:underline">Privacy Policy</button>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function LoginPage({ onNavigate, onForgot, onLogin }: { onNavigate: () => void; onForgot: () => void; onLogin: (e: React.FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="w-full h-screen bg-background rounded-[10px] overflow-hidden shadow-lg">
      <div className="grid grid-cols-2 h-full">
        <AuthLeft
          title="Welcome back, skill trader."
          subtitle="Your next exchange is just one login away. Let's continue growing."
        />
        <div className="bg-background p-10 flex flex-col justify-center">
          <h1 style={{ fontFamily: 'var(--font-head)' }} className="text-[22px] font-bold mb-1.5">Sign in</h1>
          <p className="text-[13px] text-muted-foreground mb-8">
            New to SkillSwap? <button onClick={onNavigate} className="text-[var(--brand)] font-medium hover:underline">Create an account</button>
          </p>
          <form onSubmit={onLogin} className="space-y-4">
            <FormField label="Email address" name="email" type="email" placeholder="alex@example.com" />
            <FormField label="Password" name="password" type="password" placeholder="Your password" />
            <div className="text-right mb-4">
              <button type="button" onClick={onForgot} className="text-[13px] text-[var(--brand)] hover:underline">Forgot password?</button>
            </div>
            <button type="submit" style={{ fontFamily: 'var(--font-head)' }} className="w-full py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-mid)] text-white rounded-md font-semibold text-[15px] transition-colors flex items-center justify-center gap-2">
              Sign in <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function AuthLeft({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-[var(--brand-dark)] p-10 flex flex-col justify-between relative overflow-hidden">
      <div className="absolute w-[300px] h-[300px] rounded-full bg-[rgba(45,158,110,0.2)] -top-20 -right-20"></div>
      <div className="absolute w-[200px] h-[200px] rounded-full bg-[rgba(240,165,0,0.1)] bottom-10 -left-15"></div>
      
      <div className="relative z-10 flex items-center gap-2 text-white">
        <Repeat className="w-8 h-8" />
        <span style={{ fontFamily: 'var(--font-head)' }} className="text-xl font-bold">SkillSwap</span>
      </div>

      <div className="relative z-10 text-white">
        <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-[32px] font-bold leading-tight mb-4">
          {title}
        </h2>
        <p className="text-[15px] opacity-90">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    if (!email) {
      toast.error('Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      const data = await safeFetchJson('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      toast.success(data.message || 'Reset link sent!');
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-background rounded-[10px] overflow-hidden shadow-lg">
      <div className="grid grid-cols-2 h-full">
        <AuthLeft title="Forgot Password" subtitle="Enter your email to receive a password reset link." />
        <div className="bg-background p-10 flex flex-col justify-center">
          <button onClick={onBack} className="text-[var(--brand)] text-[13px] hover:underline mb-4 self-start flex items-center gap-1">
            <ArrowRight className="w-3 h-3 rotate-180" /> Back to Login
          </button>
          <h1 style={{ fontFamily: 'var(--font-head)' }} className="text-[22px] font-bold mb-1.5">Reset Password</h1>
          <p className="text-[13px] text-muted-foreground mb-8">We will send a reset link to your registered email address.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Email address" name="email" type="email" placeholder="alex@example.com" />
            <button type="submit" disabled={loading} style={{ fontFamily: 'var(--font-head)' }} className="w-full py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-mid)] text-white rounded-md font-semibold text-[15px] transition-colors flex items-center justify-center gap-2">
              {loading ? 'Sending...' : 'Send Reset Link'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordPage({ token, onBack, onComplete }: { token: string; onBack: () => void; onComplete: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!password || password !== confirmPassword) {
      toast.error('Passwords do not match or are empty.');
      return;
    }
    setLoading(true);
    try {
      const data = await safeFetchJson('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      toast.success(data.message || 'Password reset successful!');
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-background rounded-[10px] overflow-hidden shadow-lg">
      <div className="grid grid-cols-2 h-full">
        <AuthLeft title="Set New Password" subtitle="Create a new, secure password for your account." />
        <div className="bg-background p-10 flex flex-col justify-center">
          <h1 style={{ fontFamily: 'var(--font-head)' }} className="text-[22px] font-bold mb-1.5">New Password</h1>
          <p className="text-[13px] text-muted-foreground mb-8">Please enter your new password below.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="New Password" name="password" type="password" placeholder="New password" />
            <FormField label="Confirm Password" name="confirmPassword" type="password" placeholder="Confirm password" />
            <button type="submit" disabled={loading} style={{ fontFamily: 'var(--font-head)' }} className="w-full py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-mid)] text-white rounded-md font-semibold text-[15px] transition-colors flex items-center justify-center gap-2">
              {loading ? 'Resetting...' : 'Reset Password'} <ArrowRight className="w-4 h-4" />
            </button>
            <div className="text-center mt-4">
              <button type="button" onClick={onBack} className="text-[13px] text-[var(--brand)] hover:underline">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, name, type, placeholder }: { label: string; name: string; type: string; placeholder: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        type={type}
        id={name}
        name={name}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border-[0.5px] border-border rounded-md bg-secondary text-foreground text-sm outline-none focus:border-[var(--brand)] transition-colors"
        required
      />
    </div>
  );
}

function DashboardPage({ activeTab, onTabChange, user, onLogout, onUserUpdate, setActiveVideoCall }: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  user: UserData;
  onLogout: () => void;
  onUserUpdate: (updatedUser: UserData) => void;
  setActiveVideoCall: (call: any) => void;
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => {
    const saved = localStorage.getItem(`SKILLSWAP_UNREAD_${user.email.toLowerCase()}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [requests, setRequests] = useState<{incoming: any[], outgoing: any[]}>({incoming: [], outgoing: []});
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [chatbotInitialPrompt, setChatbotInitialPrompt] = useState<string>('');
  const [activeChatUser, setActiveChatUser] = useState<{ name: string; email: string; initials: string } | null>(null);
  const [activeBookingUser, setActiveBookingUser] = useState<{ name: string; email: string; initials: string } | null>(null);
  const [bookings, setBookings] = useState<{incoming: any[], outgoing: any[]}>({incoming: [], outgoing: []});
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const data = await safeFetchJson(`/api/bookings?email=${encodeURIComponent(user.email)}`);
      setBookings(data.bookings || {incoming: [], outgoing: []});
    } catch (e) {
      console.error('Error fetching bookings:', e);
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    if (user.email) {
      fetchBookings();
    }
  }, [user.email]);

  const isAdmin = user.email.toLowerCase() === 'admin@skillswap.com';

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const data = await safeFetchJson(`/api/matches?email=${encodeURIComponent(user.email)}`);
        setMatches(data.matches || []);
      } catch (e) {
        console.error('Error fetching matches:', e);
      } finally {
        setMatchesLoading(false);
      }
    };
    if (user.email) {
      fetchMatches();
    }
  }, [user.email]);

  const fetchRequests = async () => {
    try {
      const data = await safeFetchJson(`/api/requests?email=${encodeURIComponent(user.email)}`);
      setRequests(data.requests || {incoming: [], outgoing: []});
    } catch (e) {
      console.error('Error fetching requests:', e);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (user.email) {
      fetchRequests();
    }
  }, [user.email]);

  useEffect(() => {
    if (user.email) {
      const saved = localStorage.getItem(`SKILLSWAP_ACTIVITY_${user.email.toLowerCase()}`);
      if (saved) {
        setActivities(JSON.parse(saved));
      } else {
        const initialActivities: ActivityLogItem[] = [
          { id: '1', type: 'success', text: 'Account created successfully', time: 'Just now' }
        ];
        setActivities(initialActivities);
        localStorage.setItem(`SKILLSWAP_ACTIVITY_${user.email.toLowerCase()}`, JSON.stringify(initialActivities));
      }
    }
  }, [user.email]);

  const addActivity = (type: 'success' | 'message' | 'star', text: string) => {
    const newItem: ActivityLogItem = {
      id: Date.now().toString(),
      type,
      text,
      time: format(new Date(), "MMM d, h:mm a")
    };
    
    setActivities(prev => {
      const updated = [newItem, ...prev].slice(0, 10);
      localStorage.setItem(`SKILLSWAP_ACTIVITY_${user.email.toLowerCase()}`, JSON.stringify(updated));
      return updated;
    });
    
    setUnreadCount(prev => {
      const newCount = prev + 1;
      localStorage.setItem(`SKILLSWAP_UNREAD_${user.email.toLowerCase()}`, newCount.toString());
      return newCount;
    });
  };

  useEffect(() => {
    if (!user.email) return;
    const globalSocket = io(API_URL);
    
    globalSocket.on('connect', () => {
      globalSocket.emit('join_global', user.email);
    });

    globalSocket.on('new_notification', (data: any) => {
      addActivity(data.type, data.text);
      toast.success(data.text);
      if (data.type === 'request') {
        fetchRequests();
      } else if (data.type === 'booking') {
        fetchBookings();
      }
    });

    return () => {
      globalSocket.disconnect();
    };
  }, [user.email]);

  useEffect(() => {
    if (!user.email) return;

    const setupFirebase = async () => {
      try {
        const token = await requestFirebaseToken();
        if (token) {
          await safeFetchJson('/api/fcm-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, token })
          });
        }
      } catch (err) {
        console.warn('Firebase token retrieval error (this is normal if no valid VAPID key is provided):', err);
      }
    };

    setupFirebase();

    const listenForMessages = async () => {
      try {
        const payload: any = await onMessageListener();
        if (payload && payload.notification) {
          addActivity('message', payload.notification.body || payload.notification.title);
          toast.success(payload.notification.title, {
            description: payload.notification.body
          });
          listenForMessages(); // restart listener
        }
      } catch (e) {
        console.warn('Error listening to foreground messages', e);
      }
    };

    listenForMessages();
  }, [user.email]);

  const tabTitles: Record<Tab, string> = {
    home: 'Home',
    matches: 'Matches',
    search: 'Search & Explore Skills',
    requests: 'Pending Requests',
    bookings: 'Sessions',
    profile: 'Profile',
    settings: 'Settings',
    chatbot: 'AI Chatbot',
    admin: 'System Admin Panel'
  };

  return (
    <div className="w-full h-screen bg-[#f5f5f7] rounded-[10px] overflow-hidden shadow-lg">
      <div className="grid grid-cols-[220px_1fr] h-full">
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} onLogoutClick={() => setShowLogoutModal(true)} matchesCount={matches.length} requestsCount={requests.incoming.filter(r => r.status === 'pending').length} isAdmin={isAdmin} />

        <div className={`bg-[#f5f5f7] flex flex-col h-full ${activeTab === 'chatbot' || activeTab === 'admin' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className="bg-background border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0">
            <h1 style={{ fontFamily: 'var(--font-head)' }} className="text-lg font-bold">{tabTitles[activeTab]}</h1>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    setUnreadCount(0);
                    localStorage.setItem(`SKILLSWAP_UNREAD_${user.email.toLowerCase()}`, '0');
                  }
                }} className="relative w-[34px] h-[34px] rounded-full bg-secondary border border-border flex items-center justify-center cursor-pointer hover:bg-muted transition-colors">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[var(--color-accent)] rounded-full text-[9px] flex items-center justify-center text-black font-semibold">
                      {unreadCount}
                    </span>
                  )}
                </div>

                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                    <div className="absolute right-0 mt-2 w-72 bg-background border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="p-3 border-b border-border font-bold text-sm bg-secondary/50">
                        Recent Notifications
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                        {activities.length > 0 ? (
                          activities.map((act) => (
                            <div key={act.id} className="p-2 text-xs hover:bg-secondary rounded-md cursor-default">
                              <div className="text-foreground">{act.text}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{act.time}</div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-muted-foreground">
                            No recent activity
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div onClick={() => onTabChange('profile')} className="w-[34px] h-[34px] rounded-full bg-[var(--brand)] flex items-center justify-center text-[13px] font-semibold text-white cursor-pointer overflow-hidden">
                {user.profilePhoto ? <img src={`${API_URL}${user.profilePhoto}`} alt={user.name} className="w-full h-full object-cover" /> : user.initials}
              </div>
            </div>
          </div>

          <div className={activeTab === 'chatbot' ? 'flex-1 h-0 overflow-hidden' : activeTab === 'admin' || activeTab === 'search' || activeTab === 'requests' || activeTab === 'bookings' ? 'flex-1 h-0 overflow-y-auto p-6 bg-[#f5f5f7]' : 'p-6'}>
            {activeTab === 'home' && <HomeTab user={user} matches={matches} loading={matchesLoading} activities={activities} />}
            {activeTab === 'matches' && <MatchesTab user={user} matches={matches} loading={matchesLoading} onAddActivity={addActivity} requests={requests} fetchRequests={fetchRequests} setActiveChatUser={setActiveChatUser} setActiveBookingUser={setActiveBookingUser} />}
            {activeTab === 'requests' && <RequestsTab user={user} requests={requests} loading={requestsLoading} fetchRequests={fetchRequests} onAddActivity={addActivity} onTabChange={onTabChange} setChatbotInitialPrompt={setChatbotInitialPrompt} />}
            {activeTab === 'bookings' && <BookingsTab user={user} bookings={bookings} loading={bookingsLoading} fetchBookings={fetchBookings} onAddActivity={addActivity} setActiveChatUser={setActiveChatUser} onUserUpdate={onUserUpdate} setActiveVideoCall={setActiveVideoCall} />}
            {activeTab === 'search' && (
              <SearchTab 
                user={user} 
                onAddActivity={addActivity} 
                onTabChange={onTabChange} 
                setChatbotInitialPrompt={setChatbotInitialPrompt} 
                requests={requests}
                fetchRequests={fetchRequests}
                setActiveChatUser={setActiveChatUser}
                // setActiveBookingUser={setActiveBookingUser}
              />
            )}
            {activeTab === 'chatbot' && (
              <ChatbotTab 
                user={user} 
                chatbotInitialPrompt={chatbotInitialPrompt} 
                setChatbotInitialPrompt={setChatbotInitialPrompt} 
              />
            )}
            {activeTab === 'profile' && <ProfileTab user={user} onUpdate={onUserUpdate} onAddActivity={addActivity} />}
            {activeTab === 'settings' && (
              <SettingsTab user={user} onUserUpdate={onUserUpdate} onLogout={onLogout} />
            )}
            {activeTab === 'admin' && <AdminTab currentUser={user} />}
          </div>
        </div>
      </div>

      {activeChatUser && (
        <ChatWindow
          currentUser={user}
          chatPartner={activeChatUser}
          onClose={() => setActiveChatUser(null)}
          setActiveBookingUser={setActiveBookingUser}
          onAddActivity={addActivity}
          setActiveVideoCall={setActiveVideoCall}
        />
      )}

      {activeBookingUser && (
        <BookingModal
          currentUser={user}
          bookingPartner={activeBookingUser}
          onClose={() => setActiveBookingUser(null)}
          onSuccess={() => {
            fetchBookings();
            addActivity('success', `Session requested with ${activeBookingUser.name}`);
          }}
        />
      )}

      {showLogoutModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-[10px]">
          <div className="bg-background rounded-lg p-8 max-w-[320px] w-[90%] text-center border border-border">
            <div className="text-destructive text-4xl mb-4 flex justify-center">
              <LogOut className="w-9 h-9" />
            </div>
            <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-lg font-bold mb-2">Log out?</h2>
            <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">
              You'll need to sign in again to access your skill exchange dashboard.
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-2.5 border border-border rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={() => { setShowLogoutModal(false); onLogout(); }} className="flex-1 py-2.5 border border-destructive/30 rounded-md bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ activeTab, onTabChange, onLogoutClick, matchesCount, requestsCount, isAdmin }: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogoutClick: () => void;
  matchesCount: number;
  requestsCount: number;
  isAdmin: boolean;
}) {
  const navItems: Array<{ id: Tab; icon: React.ReactNode; label: string; badge?: number }> = [
    { id: 'home', icon: <Home className="w-5 h-5" />, label: 'Home' },
    { id: 'matches', icon: <ArrowLeftRight className="w-5 h-5" />, label: 'Matches', badge: matchesCount > 0 ? matchesCount : undefined },
    { id: 'search', icon: <Search className="w-5 h-5" />, label: 'Search Skills' },
    { id: 'requests', icon: <MessageSquarePlus className="w-5 h-5" />, label: 'Requests', badge: requestsCount > 0 ? requestsCount : undefined },
    { id: 'bookings', icon: <CalendarIcon className="w-5 h-5" />, label: 'Sessions' },
    { id: 'chatbot', icon: <Bot className="w-5 h-5" />, label: 'AI Chatbot' },
    { id: 'profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
    { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', icon: <Shield className="w-5 h-5 text-[var(--color-accent)]" />, label: 'Admin Panel' });
  }

  return (
    <div className="bg-[var(--brand-dark)] p-4 flex flex-col">
      <div style={{ fontFamily: 'var(--font-head)' }} className="text-white text-[20px] font-extrabold flex items-center gap-2 mb-8 px-2">
        <Repeat className="w-5 h-5" /> SkillSwap<span className="text-[var(--color-accent)]">.</span>
      </div>

      <nav className="space-y-0.5 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-all ${
              activeTab === item.id
                ? 'bg-[rgba(45,158,110,0.3)] text-white'
                : 'text-white/60 hover:bg-white/8 hover:text-white/90'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-auto bg-[var(--color-accent)] text-black text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <button
        onClick={onLogoutClick}
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all"
      >
        <LogOut className="w-5 h-5" />
        <span>Log out</span>
      </button>
    </div>
  );
}

function HomeTab({ user, matches, loading, activities }: { user: UserData; matches: any[]; loading: boolean; activities: ActivityLogItem[] }) {
  const recommendations = matches.slice(0, 4);

  const getSkillIcon = (skill: string) => {
    const s = skill?.toLowerCase() || '';
    if (s.includes('code') || s.includes('developer') || s.includes('development') || s.includes('react') || s.includes('mern') || s.includes('stack')) {
      return { icon: <Code className="w-5 h-5" />, bgColor: 'bg-[#e6f5ef]', iconColor: 'text-[var(--brand)]' };
    }
    if (s.includes('photo') || s.includes('video') || s.includes('camera')) {
      return { icon: <Camera className="w-5 h-5" />, bgColor: 'bg-[#fff8e6]', iconColor: 'text-[#c87400]' };
    }
    if (s.includes('data') || s.includes('science') || s.includes('chart') || s.includes('analyst') || s.includes('analytics')) {
      return { icon: <BarChart3 className="w-5 h-5" />, bgColor: 'bg-[#e6f1fb]', iconColor: 'text-[#185fa5]' };
    }
    return { icon: <PenTool className="w-5 h-5" />, bgColor: 'bg-[#eeedfe]', iconColor: 'text-[#534ab7]' };
  };

  const firstName = user.name ? user.name.split(' ')[0] : 'Member';
  const highestMatch = recommendations.length > 0 ? `${recommendations[0].match}%` : '0%';

  return (
    <div>
      <div className="mb-5">
        <p style={{ fontFamily: 'var(--font-head)' }} className="text-[22px] font-bold">Good day, {firstName} 👋</p>
        <p className="text-[13px] text-muted-foreground mt-1">
          {recommendations.length > 0 
            ? `You have ${recommendations.length} recommended skill trades matching your profile.`
            : 'Try updating your skills to find matching recommended skill trades.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Active swaps" value={String(matches.length)} change="In progress" showIcon={matches.length > 0} />
        <StatCard label="Skills offered" value="1" change={user.skillOffer || "Web Dev"} />
        <StatCard label="Match score" value={highestMatch} change="Top Match" showIcon={recommendations.length > 0} />
      </div>

      <div style={{ fontFamily: 'var(--font-head)' }} className="text-[15px] font-bold mb-4 flex items-center justify-between">
        <span>Recommended skill exchanges</span>
        <button className="text-xs font-normal text-[var(--brand)] cursor-pointer hover:underline">View all →</button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {loading ? (
          <div className="col-span-2 text-center py-8 text-xs text-muted-foreground bg-background border border-border rounded-lg">
            <div className="w-4 h-4 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading recommendations...
          </div>
        ) : recommendations.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-xs text-muted-foreground bg-background border border-border rounded-lg">
            No dynamic recommendations found. Try registering more users or changing your wanted skills!
          </div>
        ) : (
          recommendations.map((rec, i) => {
            const { icon, bgColor, iconColor } = getSkillIcon(rec.offers);
            return (
              <div key={i} className="bg-background border border-border rounded-lg p-4">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className={`w-[38px] h-[38px] ${bgColor} ${iconColor} rounded-md flex items-center justify-center`}>
                    {icon}
                  </div>
                  <div className="text-xs font-semibold truncate max-w-[120px] text-foreground">{rec.name}</div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                  Offers: <strong>{rec.offers}</strong><br/>
                  Wants: <strong>{rec.wants}</strong>
                </p>
                <div className="flex gap-1.5 mt-2.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e6f5ef] text-[#0d3d2a] border border-[#9FE1CB] font-semibold">
                    {rec.match}% match
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                    Remote
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ fontFamily: 'var(--font-head)' }} className="text-[15px] font-bold mb-4">Recent activity</div>
      <div className="space-y-2">
        {activities.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground bg-background border border-border rounded-lg">
            No recent activity. Try updating your profile or accepting a match!
          </div>
        ) : (
          activities.map((act) => {
            let icon = <CheckCircle className="w-4 h-4 text-[var(--brand)]" />;
            if (act.type === 'message') {
              icon = <MessageSquare className="w-4 h-4 text-[var(--brand)]" />;
            } else if (act.type === 'star') {
              icon = <Star className="w-4 h-4 text-[var(--brand)]" />;
            }
            return (
              <ActivityItem
                key={act.id}
                icon={icon}
                text={act.text}
                time={act.time}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, change, showIcon }: { label: string; value: string; change: string; showIcon?: boolean }) {
  return (
    <div className="bg-background border border-border rounded-lg p-4">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">{label}</div>
      <div style={{ fontFamily: 'var(--font-head)' }} className="text-[28px] font-bold">{value}</div>
      <div className={`text-xs mt-1 ${showIcon ? 'text-green-600' : 'text-muted-foreground'} flex items-center gap-1`}>
        {showIcon && <ArrowUpRight className="w-3 h-3" />}
        {change}
      </div>
    </div>
  );
}

function ActivityItem({ icon, text, time }: { icon: React.ReactNode; text: React.ReactNode; time: string }) {
  return (
    <div className="bg-background border border-border rounded-md px-4 py-3 flex items-center gap-3 text-[13px]">
      {icon}
      <span>{text}</span>
      <span className="ml-auto text-muted-foreground text-[11px]">{time}</span>
    </div>
  );
}

function MatchesTab({ user, matches, loading, onAddActivity, requests, fetchRequests, setActiveChatUser, setActiveBookingUser }: { user: UserData; matches: any[]; loading: boolean; onAddActivity: (type: 'success' | 'message' | 'star', text: string) => void; requests: { incoming: any[], outgoing: any[] }; fetchRequests: () => void; setActiveChatUser: (chatUser: { name: string; email: string; initials: string } | null) => void; setActiveBookingUser: (u: any) => void; }) {

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 bg-background border border-border rounded-lg">
        <div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mb-2"></div>
        <span className="text-xs text-muted-foreground">Finding matching members...</span>
      </div>
    );
  }

  const handleSendRequest = async (receiverEmail: string) => {
    try {
      await safeFetchJson('/api/requests/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: user.email, receiver: receiverEmail })
      });
      onAddActivity('success', `Swap request sent to ${receiverEmail}`);
      toast.success(`Swap request sent!`);
      fetchRequests();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getRequestState = (targetEmail: string) => {
    const incoming = requests.incoming.find(r => r.sender === targetEmail);
    const outgoing = requests.outgoing.find(r => r.receiver === targetEmail);
    const req = incoming || outgoing;
    if (!req) return 'none';
    return req.status; // 'pending', 'accepted', 'rejected'
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-5">
        {matches.length === 0 
          ? 'No active matches found. Try updating your offered or wanted skills!' 
          : `${matches.length} matches suggested based on your skill interests`}
      </p>
      <div className="space-y-3">
        {matches.map((match, i) => {
          const state = getRequestState(match.email);
          return (
          <div key={i} className="bg-background border border-border rounded-lg p-5 flex items-center gap-4">
            <div className={`w-12 h-12 ${match.bg} rounded-full flex items-center justify-center text-white text-base font-semibold flex-shrink-0 overflow-hidden`}>
              {match.profilePhoto ? <img src={`http://localhost:5000${match.profilePhoto}`} alt={match.name} className="w-full h-full object-cover" /> : match.initials}
            </div>
            <div className="flex-1">
              <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-[15px] font-semibold mb-0.5">{match.name}</h3>
              <p className="text-xs text-muted-foreground">{match.title}</p>
              <div className="text-xs text-muted-foreground mt-1.5">
                Offers: <strong className="text-foreground">{match.offers}</strong> · Wants: <strong className="text-foreground">{match.wants}</strong>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-head)' }} className="text-[22px] font-bold text-[var(--brand)] text-center flex-shrink-0">
              {match.match}%
              <span className="block text-[10px] text-muted-foreground font-normal">match</span>
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              {state === 'none' && (
                <button onClick={() => handleSendRequest(match.email)} className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)] transition-colors cursor-pointer">
                  Send Request
                </button>
              )}
              {state === 'pending' && (
                <button disabled className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-secondary text-muted-foreground border border-border cursor-not-allowed">
                  Request Sent
                </button>
              )}
              {state === 'accepted' && (
                <div className="flex flex-col gap-1.5 w-full">
                  <button onClick={() => setActiveChatUser({ name: match.name, email: match.email, initials: match.initials })} className="w-full px-3.5 py-1.5 rounded-md text-xs font-medium bg-[#185fa5] text-white hover:bg-[#124d88] transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>
                  <button onClick={() => setActiveBookingUser({ name: match.name, email: match.email, initials: match.initials })} className="w-full px-3.5 py-1.5 rounded-md text-xs font-medium bg-secondary border border-border text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-[var(--brand)]" /> Book Session
                  </button>
                </div>
              )}
              {state === 'rejected' && (
                <span className="text-[10px] text-destructive px-2 py-1 bg-destructive/10 rounded border border-destructive/20 text-center">
                  Rejected
                </span>
              )}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}

function RequestsTab({ user, requests, loading, fetchRequests, onAddActivity, onTabChange, setChatbotInitialPrompt }: { 
  user: UserData; requests: { incoming: any[], outgoing: any[] }; loading: boolean; fetchRequests: () => void; onAddActivity: any; onTabChange: (tab: Tab) => void; setChatbotInitialPrompt: (p: string) => void;
}) {
  if (loading) {
    return <div className="text-center py-10 text-muted-foreground text-sm">Loading requests...</div>;
  }

  const handleUpdate = async (id: string, status: string, name: string) => {
    try {
      await safeFetchJson('/api/requests/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      onAddActivity('success', `Swap request ${status}`);
      toast.success(`Request ${status}!`);
      fetchRequests();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const pendingIncoming = requests.incoming.filter(r => r.status === 'pending');
  const otherIncoming = requests.incoming.filter(r => r.status !== 'pending');
  
  return (
    <div className="space-y-8">
      <section>
        <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-base font-bold mb-3">Pending Incoming Requests</h2>
        {pendingIncoming.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-background border border-border p-4 rounded-lg">No pending incoming requests.</p>
        ) : (
          <div className="space-y-3">
            {pendingIncoming.map((req, i) => (
              <div key={i} className="bg-background border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{req.sender}</div>
                  <div className="text-xs text-muted-foreground">Wants to swap skills with you!</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(req._id, 'accepted', req.sender)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 cursor-pointer">Accept</button>
                  <button onClick={() => handleUpdate(req._id, 'rejected', req.sender)} className="px-3 py-1.5 bg-destructive/10 text-destructive text-xs rounded border border-destructive/20 hover:bg-destructive/20 cursor-pointer">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-base font-bold mb-3">Your Outgoing Requests</h2>
        {requests.outgoing.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-background border border-border p-4 rounded-lg">You haven't sent any requests yet.</p>
        ) : (
          <div className="space-y-3">
            {requests.outgoing.map((req, i) => (
              <div key={i} className="bg-background border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">To: {req.receiver}</div>
                  <div className="text-xs text-muted-foreground">Sent: {new Date(req.createdAt).toLocaleDateString()}</div>
                </div>
                <div>
                  {req.status === 'pending' && <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-1 border border-amber-200 rounded">Pending</span>}
                  {req.status === 'accepted' && <span className="text-[10px] uppercase font-bold text-green-700 bg-green-50 px-2 py-1 border border-green-200 rounded">Accepted</span>}
                  {req.status === 'rejected' && <span className="text-[10px] uppercase font-bold text-destructive bg-destructive/10 px-2 py-1 border border-destructive/20 rounded">Rejected</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileTab({ user, onUpdate, onAddActivity }: { user: UserData; onUpdate: (updated: UserData) => void; onAddActivity: (type: 'success' | 'message' | 'star', text: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || 'Fullstack developer and designer based in Chennai. I love building clean interfaces and helping others learn web skills. Looking to grow my visual storytelling abilities through skill exchange.');
  const [skillOffer, setSkillOffer] = useState(user.skillOffer || 'Web Development');
  const [skillWant, setSkillWant] = useState(user.skillWant || 'Graphic Design');

  const handleSave = async () => {
    try {
      const data = await safeFetchJson('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name, skillOffer, skillWant, bio })
      });
      onUpdate(data.user);
      onAddActivity('success', 'Profile details updated');
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (e: any) {
      toast.error(e.message || 'Network error. Failed to save profile.');
    }
  };

  return (
    <div>
      <div className="bg-background border border-border rounded-lg p-6 flex gap-5 items-start mb-4">
        <div className="relative group w-16 h-16 rounded-full bg-[var(--brand)] flex items-center justify-center text-white text-[22px] font-bold flex-shrink-0 overflow-hidden cursor-pointer" onClick={() => setShowPhotoModal(true)}>
          {user.profilePhoto ? <img src={`${API_URL}${user.profilePhoto}`} alt={user.name} className="w-full h-full object-cover" /> : user.initials}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3 max-w-md">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-secondary outline-none focus:border-[var(--brand)] mt-1 font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Skill I Offer</label>
                  <select
                    value={skillOffer}
                    onChange={e => setSkillOffer(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-secondary outline-none focus:border-[var(--brand)] mt-1"
                  >
                    <option>Full Stack Development</option>
                    <option>Frontend Development</option>
                    <option>Backend Development</option>
                    <option>Web Development</option>
                    <option>React Development</option>
                    <option>Graphic Design</option>
                    <option>UI/UX Design</option>
                    <option>Photography</option>
                    <option>Data Science</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Skill I Want</label>
                  <select
                    value={skillWant}
                    onChange={e => setSkillWant(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-secondary outline-none focus:border-[var(--brand)] mt-1"
                  >
                    <option>Full Stack Development</option>
                    <option>Frontend Development</option>
                    <option>Backend Development</option>
                    <option>Web Development</option>
                    <option>React Development</option>
                    <option>Graphic Design</option>
                    <option>UI/UX Design</option>
                    <option>Photography</option>
                    <option>Data Science</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-lg font-bold mb-1">{user.name}</h2>
              <p className="text-[13px] text-muted-foreground mb-2.5">{user.email}</p>
              <div className="flex gap-1.5">
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#e6f5ef] text-[#0d3d2a] border border-[#9FE1CB] flex items-center gap-1">
                  <Star className="w-3 h-3" /> {user.rating || 5.0} rating
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-foreground">
                  {user.exchanges || 0} exchanges
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-foreground">
                  Member since {user.memberSince || 2024}
                </span>
              </div>
            </>
          )}
        </div>
        {isEditing ? (
          <div className="flex flex-col gap-1.5">
            <button onClick={handleSave} className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)] transition-colors cursor-pointer">
              Save
            </button>
            <button onClick={() => { setIsEditing(false); setName(user.name); setBio(user.bio || ''); }} className="px-3.5 py-1.5 rounded-md text-xs font-medium border border-border bg-secondary hover:bg-muted transition-colors cursor-pointer">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-secondary hover:bg-muted transition-colors flex items-center gap-1.5 cursor-pointer">
            <Edit className="w-3 h-3" /> Edit profile
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-background border border-border rounded-lg p-5">
          <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Skills I offer</h3>
          <div className="flex flex-wrap gap-1">
            <SkillPill icon={<Code className="w-3 h-3" />} label={user.skillOffer || "Web Development"} />
          </div>
        </div>
        <div className="bg-background border border-border rounded-lg p-5">
          <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Skills I want</h3>
          <div className="flex flex-wrap gap-1">
            <SkillPill icon={<Camera className="w-3 h-3" />} label={user.skillWant || "Photography"} />
          </div>
        </div>
      </div>

      <div className="bg-background border border-border rounded-lg p-5">
        <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">About me</h3>
        {isEditing ? (
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-xs border border-border rounded-md bg-secondary outline-none focus:border-[var(--brand)] resize-none"
          />
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {user.bio || "No description provided yet."}
          </p>
        )}
      </div>

      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl max-w-sm w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h3 style={{ fontFamily: 'var(--font-head)' }} className="font-bold">Profile Photo</h3>
              <button onClick={() => setShowPhotoModal(false)} className="text-muted-foreground hover:text-foreground">
                <Trash2 className="w-4 h-4 opacity-0" /> {/* Spacer */}
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-6 flex flex-col items-center">
              <div className="w-40 h-40 rounded-full bg-[var(--brand)] flex items-center justify-center text-white text-5xl font-bold overflow-hidden shadow-lg mb-6">
                {user.profilePhoto ? <img src={`http://localhost:5000${user.profilePhoto}`} alt={user.name} className="w-full h-full object-cover" /> : user.initials}
              </div>
              
              <div className="flex w-full gap-3">
                <button 
                  onClick={() => document.getElementById('photo-upload-modal')?.click()} 
                  className="flex-1 py-2 rounded-md bg-[var(--brand)] text-white text-xs font-semibold hover:bg-[var(--brand-mid)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" /> Change
                </button>
                {user.profilePhoto && (
                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_URL}/api/profile/photo/remove`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: user.email })
                        });
                        const data = await res.json();
                        if (data.success) {
                          onUpdate(data.user);
                          onAddActivity('success', 'Profile photo removed');
                          toast.success('Photo removed');
                          setShowPhotoModal(false);
                        } else {
                          toast.error('Failed to remove photo');
                        }
                      } catch (e) {
                        toast.error('Network error');
                      }
                    }} 
                    className="flex-1 py-2 rounded-md bg-secondary text-destructive border border-destructive/20 text-xs font-semibold hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Remove
                  </button>
                )}
              </div>
            </div>
            <input type="file" id="photo-upload-modal" className="hidden" accept="image/*" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const formData = new FormData();
              formData.append('email', user.email);
              formData.append('photo', file);
              try {
                const res = await fetch(`${API_URL}/api/profile/photo`, {
                  method: 'POST',
                  body: formData,
                });
                const data = await res.json();
                if (data.success) {
                  onUpdate(data.user);
                  onAddActivity('success', 'Profile photo updated');
                  toast.success('Profile photo updated successfully!');
                  setShowPhotoModal(false);
                } else {
                  toast.error(data.error || 'Failed to update photo');
                }
              } catch (err) {
                toast.error('Network error updating photo');
              }
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

function SkillPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-border bg-secondary text-foreground">
      <span className="text-[var(--brand)]">{icon}</span>
      {label}
    </span>
  );
}

function SettingsTab({ user, onUserUpdate, onLogout }: { 
  user: UserData; 
  onUserUpdate: (updated: UserData) => void;
  onLogout: () => void;
}) {
  const [toggles, setToggles] = useState(user.settings || {
    visibility: true,
    matchRequests: true,
    messages: true,
    weeklyDigest: false,
  });

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleToggle = async (key: keyof typeof toggles) => {
    const newToggles = { ...toggles, [key]: !toggles[key] };
    setToggles(newToggles);
    
    try {
      const data = await safeFetchJson('/api/profile/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, settings: newToggles })
      });
      if (data.success && data.user) {
        onUserUpdate(data.user);
        toast.success('Settings updated');
      }
    } catch (e: any) {
      toast.error('Failed to update settings');
      setToggles(toggles); // revert
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Please enter a valid email.');
      return;
    }
    try {
      const data = await safeFetchJson('/api/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, newEmail })
      });
      if (data.success && data.user) {
        onUserUpdate(data.user);
        toast.success('Email address updated successfully!');
        setShowEmailModal(false);
        setNewEmail('');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to update email.');
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in both password fields.');
      return;
    }
    try {
      const data = await safeFetchJson('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, currentPassword, newPassword })
      });
      if (data.success && data.user) {
        toast.success('Password updated successfully!');
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to update password.');
    }
  };

  return (
    <div className="space-y-4">
      <SettingsCard title="Account">
        <SettingsRow
          label="Email address"
          description={user.email}
          action={<button onClick={() => setShowEmailModal(true)} className="px-3.5 py-1.5 rounded-md text-xs font-medium border border-border bg-secondary hover:bg-muted transition-colors cursor-pointer">Change</button>}
        />
        <SettingsRow
          label="Password"
          description="Update your account password"
          action={<button onClick={() => setShowPasswordModal(true)} className="px-3.5 py-1.5 rounded-md text-xs font-medium border border-border bg-secondary hover:bg-muted transition-colors cursor-pointer">Update</button>}
        />
        <SettingsRow
          label="Profile visibility"
          description="Anyone can find your profile"
          action={<Toggle active={toggles.visibility} onClick={() => handleToggle('visibility')} />}
        />
      </SettingsCard>

      <SettingsCard title="Notifications">
        <SettingsRow
          label="New match requests"
          description="Get notified when someone wants to swap"
          action={<Toggle active={toggles.matchRequests} onClick={() => handleToggle('matchRequests')} />}
        />
        <SettingsRow
          label="Messages"
          description="Email me when I receive a message"
          action={<Toggle active={toggles.messages} onClick={() => handleToggle('messages')} />}
        />
        <SettingsRow
          label="Weekly digest"
          description="Summary of new skill offerings"
          action={<Toggle active={toggles.weeklyDigest} onClick={() => handleToggle('weeklyDigest')} />}
        />
      </SettingsCard>

      <div className="bg-background border border-destructive/30 rounded-lg p-5">
        <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-semibold text-destructive mb-2">Danger zone</h3>
        <p className="text-[13px] text-muted-foreground mb-3 leading-relaxed">
          Permanently delete your account and all your data. This cannot be undone.
        </p>
        <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 rounded-md text-[13px] font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors cursor-pointer">
          Delete account
        </button>
      </div>

      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-[10px]">
          <div className="bg-background rounded-lg p-6 max-w-[320px] w-[90%] text-left border border-border shadow-xl">
            <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold mb-1">Change Email</h2>
            <p className="text-[11px] text-muted-foreground mb-4">Enter your new email address below.</p>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@example.com"
              className="w-full px-3 py-2 text-xs border border-border rounded-md bg-secondary outline-none focus:border-[var(--brand)] mb-4"
            />
            <div className="flex gap-2.5">
              <button onClick={() => setShowEmailModal(false)} className="flex-1 py-2 border border-border rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-muted transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleUpdateEmail} className="flex-1 py-2 rounded-md bg-[var(--brand)] text-white text-xs font-semibold hover:bg-[var(--brand-mid)] transition-colors cursor-pointer">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-[10px]">
          <div className="bg-background rounded-lg p-6 max-w-[320px] w-[90%] text-left border border-border shadow-xl">
            <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold mb-1">Update Password</h2>
            <p className="text-[11px] text-muted-foreground mb-4">Enter your current and new password.</p>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current Password"
              className="w-full px-3 py-2 text-xs border border-border rounded-md bg-secondary outline-none focus:border-[var(--brand)] mb-3"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              className="w-full px-3 py-2 text-xs border border-border rounded-md bg-secondary outline-none focus:border-[var(--brand)] mb-4"
            />
            <div className="flex gap-2.5">
              <button onClick={() => setShowPasswordModal(false)} className="flex-1 py-2 border border-border rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-muted transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleUpdatePassword} className="flex-1 py-2 rounded-md bg-[var(--brand)] text-white text-xs font-semibold hover:bg-[var(--brand-mid)] transition-colors cursor-pointer">
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 rounded-[10px]">
          <div className="bg-background rounded-lg p-6 max-w-[340px] w-[90%] text-left border border-destructive/40 shadow-xl">
            <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold text-destructive mb-1">Delete Account</h2>
            <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
              This action is <strong>permanent and irreversible</strong>. All your data including matches, chats, and bookings will be deleted.<br /><br />
              Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full px-3 py-2 text-xs border border-destructive/40 rounded-md bg-secondary outline-none focus:border-destructive mb-4"
            />
            <div className="flex gap-2.5">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }} className="flex-1 py-2 border border-border rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-muted transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                disabled={deleteConfirmText !== 'DELETE'}
                onClick={async () => {
                  try {
                    const res = await fetch('/api/profile/delete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: user.email })
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success('Account deleted successfully.');
                      setShowDeleteModal(false);
                      setTimeout(() => onLogout(), 800);
                    } else {
                      toast.error(data.error || 'Failed to delete account.');
                    }
                  } catch (e) {
                    toast.error('Network error. Try again.');
                  }
                }}
                className="flex-1 py-2 rounded-md bg-destructive text-white text-xs font-semibold transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden">
      <div style={{ fontFamily: 'var(--font-head)' }} className="px-5 py-4 text-sm font-semibold bg-secondary border-b border-border">
        {title}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, description, action }: { label: string; description?: string; action: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5 flex items-center justify-between border-b border-border last:border-0">
      <div>
        <div className="text-sm">{label}</div>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Toggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`w-10 h-5.5 rounded-full relative cursor-pointer transition-colors ${
        active ? 'bg-[var(--brand)]' : 'bg-border'
      }`}
    >
      <div className={`absolute w-4 h-4 bg-white rounded-full top-0.75 transition-all ${
        active ? 'right-0.75' : 'left-0.75'
      }`}></div>
    </div>
  );
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
}

const DEFAULT_SESSIONS = (user: UserData): ChatSession[] => [
  {
    id: 'session-1',
    title: 'React Learning Roadmap',
    messages: [
      {
        id: 'msg-1',
        sender: 'user',
        text: `Hey! I want to swap my ${user.skillOffer || 'Web Development'} skills to learn ${user.skillWant || 'Graphic Design'}. How should I start?`,
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'msg-2',
        sender: 'bot',
        text: `Hello ${user.name}! That is a fantastic skill trade combination. I recommend starting with a structured 4-week project. Let me write a custom learning roadmap for you based on ${user.skillWant || 'Graphic Design'}...`,
        timestamp: new Date(Date.now() - 3600000 * 2 + 1000).toISOString(),
      }
    ]
  },
  {
    id: 'session-2',
    title: 'Swap Message Draft',
    messages: [
      {
        id: 'msg-3',
        sender: 'user',
        text: `Draft a skill swap message to Priya M.`,
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: 'msg-4',
        sender: 'bot',
        text: `Sure! Here's a custom template you can copy and paste:

\`\`\`markdown
Hi Priya,

I noticed you offer React Development and want Graphic Design. I specialize in Graphic Design and would love to exchange skills! Let me know if you want to connect.
\`\`\`

Hope this helps! Let me know if you'd like to adjust the tone.`,
        timestamp: new Date(Date.now() - 3600000 * 24 + 1000).toISOString(),
      }
    ]
  }
];

const getBotResponse = (prompt: string, user: UserData) => {
  const lowercasePrompt = prompt.toLowerCase();
  const offer = user.skillOffer || 'Web Development';
  const want = user.skillWant || 'Graphic Design';

  if (lowercasePrompt.includes('priya') || lowercasePrompt.includes('draft') || lowercasePrompt.includes('message') || lowercasePrompt.includes('request')) {
    return `Here is a custom, high-converting swap request message you can send to **Priya M.**:

\`\`\`markdown
Hi Priya,

I noticed you offer React Development and are looking to learn Graphic Design. 
I actually specialize in Graphic Design and am looking to improve my React Dev skills! 

I think we'd be a great match for a skill trade. How about we connect for a quick 10-minute chat to discuss how we might help each other?

Best regards,
${user.name}
\`\`\`

You can copy-paste this message directly in the **Matches** tab when you accept her request! Let me know if you want to modify any part of it.`;
  }

  if (lowercasePrompt.includes('road') || lowercasePrompt.includes('roadmap') || lowercasePrompt.includes('learn') || lowercasePrompt.includes('plan')) {
    return `Here is a personalized **4-Week learning roadmap** to master **${want}** by trading your **${offer}** skills:

**Week 1: Fundamental Principles & Setup**
- *Goal*: Grasp foundational concepts of **${want}**.
- *SkillSwap Session (1 hour)*: Have your swap partner introduce you to key workflows and recommended tools (software, libraries).
- *Action Item*: Complete 3 basic tutorials and share your work for review.

**Week 2: Hands-on Projects**
- *Goal*: Build practical components.
- *SkillSwap Session (1 hour)*: Do a live pair-work session. If you know **${offer}**, you can show them how to structure code, while they guide your design layout.
- *Action Item*: Build a simple portfolio project combining both your skills.

**Week 3: Feedback & Iteration**
- *Goal*: Refine your technique based on feedback.
- *SkillSwap Session (1 hour)*: Conduct a detailed review of each other's work from Week 2.
- *Action Item*: Implement corrections and optimize performance.

**Week 4: Capstone Exchange Project**
- *Goal*: Deploy a collaborative mini-app or project.
- *SkillSwap Session (1 hour)*: Present and test your joint project.
- *Action Item*: Publish the project and leave a 5-star swap review for each other!

Does this schedule work for you, or would you like to tweak the timeline?`;
  }

  if (lowercasePrompt.includes('profile') || lowercasePrompt.includes('bio') || lowercasePrompt.includes('optimize') || lowercasePrompt.includes('improve')) {
    return `Here are three steps to optimize your SkillSwap profile to attract more matches:

1. **Be Specific in your Offers**: Instead of just listing **"${offer}"**, write details in your Bio. For example: *"I can help you build responsive web layouts, explain flexbox/grid, and deploy React projects on Vercel."*
2. **Clear Learning Goals**: State exactly what parts of **"${want}"** you are excited about. For instance: *"Looking to learn vector illustration, typography hierarchies, and layout rules for mobile design."*
3. **Add Portfolio Links**: Mention 1 or 2 projects you have completed. This builds massive trust.

Would you like me to generate a personalized bio/about section text for you based on this advice?`;
  }

  if (lowercasePrompt.includes('project') || lowercasePrompt.includes('practice') || lowercasePrompt.includes('portfolio') || lowercasePrompt.includes('idea')) {
    return `Here are some excellent collaborative project ideas that combine **${offer}** and **${want}**:

1. **The Interactive Portfolio**:
   - *Concept*: Design a gorgeous portfolio using **${want}** principles and code it using **${offer}**.
   - *Swap Benefit*: You both get a high-quality portfolio item showing off your respective skills.

2. **A Landing Page Template**:
   - *Concept*: Build a conversion-focused landing page where your partner designs the branding, and you develop the site.
   - *Swap Benefit*: Real-world experience collaborating on a design-to-development handoff.

3. **Interactive Skill Cards Game**:
   - *Concept*: A fun web card game teaching basic elements of design and development.
   - *Swap Benefit*: A great micro-project that can be completed in a single weekend.

Which of these would you like to start first? I can help you draft a project scope!`;
  }

  if (lowercasePrompt.includes('hello') || lowercasePrompt.includes('hi') || lowercasePrompt.includes('hey') || lowercasePrompt.includes('greet')) {
    return `Hello ${user.name}! 👋 I am your **SkillSwap AI Assistant**. 

I can help you:
- 🚀 Create customized learning roadmaps for **${want}**
- 📝 Draft personalized swap request messages to matches (like Priya M.)
- 💡 Brainstorm collaborative project ideas
- ⚙️ Optimize your profile bio for more matches

What would you like to work on today? Select one of the quick suggestions below or type your question!`;
  }

  return `That is a great question! Since you specialize in **${offer}** and are currently looking to learn **${want}**, we can approach this in a couple of ways:

1. **Leverage Your Strengths**: How can you apply your knowledge of **${offer}** to make learning **${want}** easier?
2. **Collaborative Trade**: Find a match in your **Matches** tab who has opposite needs, and design a custom lesson plan.

Could you elaborate a bit more on what specific topic or question you have about **${want}**? I want to make sure I give you the most accurate advice!`;
};

const renderMessageText = (text: string, isUser: boolean = false) => {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1] : 'code';
      const code = match ? match[2] : part.slice(3, -3);
      
      return (
        <div key={index} className="my-3 border border-border rounded-lg overflow-hidden bg-zinc-950 text-zinc-50 font-mono text-xs shadow-md">
          <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-400">
            <span>{language.toUpperCase()}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(code);
                toast.success('Copied to clipboard!');
              }}
              className="hover:text-zinc-100 transition-colors cursor-pointer"
            >
              Copy Code
            </button>
          </div>
          <pre className="p-4 overflow-x-auto">
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    
    const textParts = part.split(/(\*\*.*?\*\*)/g);
    return (
      <span key={index}>
        {textParts.map((tPart, tIndex) => {
          if (tPart.startsWith('**') && tPart.endsWith('**')) {
            return <strong key={tIndex} className={`font-bold ${isUser ? 'text-white font-semibold' : 'text-foreground font-semibold'}`}>{tPart.slice(2, -2)}</strong>;
          }
          return tPart;
        })}
      </span>
    );
  });
};

function ChatbotTab({ user, chatbotInitialPrompt, setChatbotInitialPrompt }: { 
  user: UserData;
  chatbotInitialPrompt: string;
  setChatbotInitialPrompt: (prompt: string) => void;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('SKILLSWAP_GEMINI_KEY') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatbotInitialPrompt) {
      setInputText(chatbotInitialPrompt);
      setChatbotInitialPrompt('');
      toast.info('AI Coach prompt drafted! Press Send to submit.');
    }
  }, [chatbotInitialPrompt]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await safeFetchJson(`/api/chatbot/sessions?email=${encodeURIComponent(user.email)}`);
        if (data.sessions && data.sessions.length > 0) {
          setSessions(data.sessions);
          setActiveSessionId(data.sessions[0].id);
        } else {
          const defaults = DEFAULT_SESSIONS(user);
          setSessions(defaults);
          setActiveSessionId(defaults[0].id);
        }
      } catch (e) {
        console.error('Error fetching sessions:', e);
        const defaults = DEFAULT_SESSIONS(user);
        setSessions(defaults);
        setActiveSessionId(defaults[0].id);
      }
    };
    if (user.email) {
      fetchSessions();
    }
  }, [user]);

  const saveSessions = async (updated: ChatSession[]) => {
    setSessions(updated);
    try {
      await safeFetchJson('/api/chatbot/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, sessions: updated })
      });
    } catch (e) {
      console.error('Failed to sync chat sessions with server:', e);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isTyping]);

  const handleCreateNewChat = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'New Chat',
      messages: []
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    saveSessions(updated);
    if (activeSessionId === id && updated.length > 0) {
      setActiveSessionId(updated[0].id);
    } else if (updated.length === 0) {
      const defaultSess = {
        id: `session-${Date.now()}`,
        title: 'New Chat',
        messages: []
      };
      saveSessions([defaultSess]);
      setActiveSessionId(defaultSess.id);
    }
    toast.success('Chat deleted');
  };

  const handleSendMessage = (textToSend: string) => {
    if (!textToSend.trim() || !activeSessionId) return;

    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user' as const,
      text: textToSend.trim(),
      timestamp: new Date().toISOString()
    };

    let updatedSession = { ...activeSession! };
    updatedSession.messages = [...updatedSession.messages, userMsg];

    if (updatedSession.title === 'New Chat') {
      updatedSession.title = textToSend.slice(0, 24) + (textToSend.length > 24 ? '...' : '');
    }

    const updatedSessions = sessions.map(s => s.id === activeSessionId ? updatedSession : s);
    saveSessions(updatedSessions);
    setInputText('');
    setIsTyping(true);

    setTimeout(async () => {
      let botResponseText = '';
      
      try {
        const data = await safeFetchJson('/api/chatbot/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: textToSend, email: user.email, apiKey })
        });
        botResponseText = data.response;
      } catch (error: any) {
        console.error(error);
        toast.error(`Chatbot error: ${error.message || 'Check connection'}. Using offline simulator fallback.`);
        botResponseText = getBotResponse(textToSend, user) + '\n\n*(Note: Client-side simulator active as server was offline.)*';
      }

      setIsTyping(false);
      
      const botMsgId = `msg-${Date.now()}`;
      const botMsgPlaceholder = {
        id: botMsgId,
        sender: 'bot' as const,
        text: '',
        timestamp: new Date().toISOString()
      };

      let sessionWithPlaceholder = { ...updatedSession };
      sessionWithPlaceholder.messages = [...sessionWithPlaceholder.messages, botMsgPlaceholder];
      let sessionsWithPlaceholder = sessions.map(s => s.id === activeSessionId ? sessionWithPlaceholder : s);
      setSessions(sessionsWithPlaceholder);

      let currentLength = 0;
      const totalText = botResponseText;
      const interval = setInterval(() => {
        currentLength += Math.min(3, totalText.length - currentLength);
        const partialText = totalText.slice(0, currentLength);

        setSessions(prevSessions => 
          prevSessions.map(s => {
            if (s.id === activeSessionId) {
              return {
                ...s,
                messages: s.messages.map(m => m.id === botMsgId ? { ...m, text: partialText } : m)
              };
            }
            return s;
          })
        );

        if (currentLength >= totalText.length) {
          clearInterval(interval);
          setSessions(finalSessions => {
            saveSessions(finalSessions);
            return finalSessions;
          });
        }
      }, 15);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputText);
    }
  };

  const suggestions = [
    {
      title: 'Draft swap request',
      desc: 'Create template for Priya',
      prompt: 'Draft a message to Priya for React skill swap'
    },
    {
      title: '4-Week Roadmap',
      desc: `Learn ${user.skillWant || 'Design'}`,
      prompt: `Create a 4-week roadmap to learn ${user.skillWant || 'Graphic Design'}`
    },
    {
      title: 'Optimize profile',
      desc: `Attract skill matches`,
      prompt: `How can I improve my ${user.skillOffer || 'Web Dev'} profile?`
    },
    {
      title: 'Brainstorm project',
      desc: 'Collaborative ideas',
      prompt: `Suggest portfolio project ideas combining my skills`
    }
  ];

  return (
    <div className="flex h-full bg-background overflow-hidden relative">
      {/* Inner Sidebar - Conversation History */}
      <div className="w-[200px] bg-secondary/35 border-r border-border flex flex-col h-full flex-shrink-0">
        <button
          onClick={handleCreateNewChat}
          className="flex items-center justify-center gap-1.5 px-3 py-2 border border-border/80 rounded-lg bg-background hover:bg-muted text-xs font-semibold transition-all shadow-sm mx-3 mt-3 flex-shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
        
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {sessions.map(s => {
            const isActive = s.id === activeSessionId;
            return (
              <div
                key={s.id}
                onClick={() => {
                  if (!isTyping) setActiveSessionId(s.id);
                }}
                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-xs transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-background border border-border shadow-sm text-[var(--brand)] font-semibold'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground font-medium'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <MessageSquare className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--brand)]' : 'text-muted-foreground/75'}`} />
                  <span className="truncate">{s.title}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 rounded transition-opacity flex-shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-border bg-secondary/15 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--brand)] flex items-center justify-center text-[10px] font-bold text-white uppercase">
              {user.initials}
            </div>
            <div className="truncate">
              <div className="text-[10px] font-bold truncate text-foreground leading-tight">{user.name}</div>
              <div className="text-[9px] text-muted-foreground truncate leading-none">{user.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
        {/* Chat Window Header */}
        <div className="border-b border-border px-5 py-3 flex items-center justify-between bg-background flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-light)] border border-[var(--brand-mid)]/25 flex items-center justify-center text-[var(--brand)] shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-tight">
                SkillSwap AI Coach
                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse bg-green-500"></span>
              </div>
              <div className="text-[10px] text-muted-foreground leading-none">
                🟢 Gemini API Active
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTempKey(apiKey);
                setShowKeyModal(true);
              }}
              className="text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 cursor-pointer font-medium border-green-600/35 bg-green-500/10 text-green-700 hover:bg-green-500/20"
            >
              <span>API Settings</span>
            </button>
            <button
              onClick={() => {
                if (activeSessionId) {
                  const updated = sessions.map(s => s.id === activeSessionId ? { ...s, messages: [] } : s);
                  saveSessions(updated);
                  toast.success('Conversation cleared');
                }
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline transition-colors px-2 py-1 rounded border border-border bg-secondary/40 cursor-pointer"
            >
              Clear Screen
            </button>
          </div>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background">
          {!activeSession ? (
            <div className="h-full flex flex-col justify-center py-6">
              <div className="text-center text-xs text-muted-foreground">Loading Chatbot Session...</div>
            </div>
          ) : activeSession.messages && activeSession.messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center py-6">
              <div className="text-center mb-6">
                <div className="inline-flex w-12 h-12 rounded-full bg-[var(--brand-light)] text-[var(--brand)] items-center justify-center mb-3.5 shadow-sm">
                  <Bot className="w-6 h-6" />
                </div>
                <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-base font-bold text-foreground">
                  Ask SkillSwap AI Assistant
                </h2>
                <p className="text-[11px] text-muted-foreground max-w-[320px] mx-auto mt-1 leading-normal">
                  Draft messages for your swap matches, schedule a step-by-step roadmap to learn {user.skillWant}, or optimize your profile.
                </p>
                {!apiKey && (
                  <button
                    onClick={() => {
                      setTempKey('');
                      setShowKeyModal(true);
                    }}
                    className="mt-3 text-[10px] bg-amber-500/10 text-amber-800 border border-amber-500/30 px-2.5 py-1 rounded-full font-semibold hover:bg-amber-500/20 transition-all cursor-pointer"
                  >
                    🔑 Click here to connect Gemini API for dynamic replies!
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 max-w-[460px] mx-auto w-full px-4">
                {suggestions.map((sug, i) => (
                  <div
                    key={i}
                    onClick={() => handleSendMessage(sug.prompt)}
                    className="p-3 border border-border rounded-xl bg-background hover:bg-secondary/40 text-left transition-all cursor-pointer shadow-sm hover:border-[var(--brand-mid)]/50 group"
                  >
                    <div className="w-6 h-6 rounded bg-secondary/80 flex items-center justify-center mb-2 text-[var(--brand)] group-hover:bg-[var(--brand-light)] transition-all">
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-[11px] font-bold text-foreground group-hover:text-[var(--brand)] transition-colors">{sug.title}</div>
                    <div className="text-[9.5px] text-muted-foreground leading-normal truncate">{sug.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-[640px] mx-auto">
              {activeSession.messages && activeSession.messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2.5`}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-[var(--brand-light)] border border-[var(--brand-mid)]/20 flex items-center justify-center text-[var(--brand)] flex-shrink-0 shadow-sm">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm max-w-[82%] ${
                      isUser
                        ? 'bg-[var(--brand)] text-white rounded-tr-none'
                        : 'bg-secondary/40 border border-border/40 text-foreground rounded-tl-none'
                    }`}>
                      {renderMessageText(msg.text, isUser)}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex justify-start items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[var(--brand-light)] border border-[var(--brand-mid)]/20 flex items-center justify-center text-[var(--brand)] flex-shrink-0 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex gap-1 items-center py-2 px-3 bg-secondary/40 border border-border/40 rounded-2xl rounded-tl-none">
                    <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar Area */}
        <div className="border-t border-border p-3.5 bg-background flex-shrink-0">
          <div className="relative max-w-[500px] mx-auto">
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message SkillSwap AI Coach...`}
              disabled={isTyping}
              className="w-full pl-3.5 pr-11 py-2.5 border border-border rounded-xl bg-secondary text-sm outline-none focus:border-[var(--brand)] transition-colors resize-none max-h-[100px] text-foreground scrollbar-none"
            />
            <button
              onClick={() => handleSendMessage(inputText)}
              disabled={isTyping || !inputText.trim()}
              className="absolute right-2 top-2 p-1.5 rounded-lg bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)] transition-colors disabled:opacity-35 disabled:hover:bg-[var(--brand)] cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[9.5px] text-muted-foreground text-center mt-2.5">
            AI Coach can make mistakes. Verify information regarding matches and skill guidelines.
          </div>
        </div>
      </div>

      {/* API Key settings modal */}
      {showKeyModal && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-[10px] p-4 backdrop-blur-[2px]">
          <div className="bg-background rounded-lg p-6 max-w-[340px] w-full text-center border border-border shadow-xl">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold mb-1">Configure Gemini API Key</h3>
            <p className="text-[11px] text-muted-foreground mb-4">
              To unlock live, dynamic ChatGPT-like conversations, get a free key from <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] font-semibold hover:underline">Google AI Studio</a> and paste it below.
            </p>
            
            <input
              type="password"
              placeholder="Paste AIzaSy... API key here"
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-secondary text-foreground text-xs outline-none focus:border-[var(--brand)] mb-4"
            />
            
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => {
                  setShowKeyModal(false);
                  setTempKey('');
                }}
                className="flex-1 py-2 border border-border rounded bg-secondary text-foreground hover:bg-muted font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const trimmed = tempKey.trim();
                  setApiKey(trimmed);
                  if (trimmed) {
                    localStorage.setItem('SKILLSWAP_GEMINI_KEY', trimmed);
                    toast.success('Gemini API key saved!');
                  } else {
                    localStorage.removeItem('SKILLSWAP_GEMINI_KEY');
                    toast.success('API key cleared. Offline simulator active.');
                  }
                  setShowKeyModal(false);
                  setTempKey('');
                }}
                className="flex-1 py-2 rounded bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)] font-semibold transition-colors cursor-pointer"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SearchTabProps {
  user: UserData;
  onAddActivity: (type: 'success' | 'message' | 'star', text: string) => void;
  onTabChange: (tab: Tab) => void;
  setChatbotInitialPrompt: (prompt: string) => void;
  requests: { incoming: any[], outgoing: any[] };
  fetchRequests: () => void;
  setActiveChatUser: (chatUser: { name: string; email: string; initials: string } | null) => void;
}

function SearchTab({ user, onAddActivity, onTabChange, setChatbotInitialPrompt, requests, fetchRequests, setActiveChatUser }: SearchTabProps) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | 'offer' | 'want'>('all');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSearchResults = async (searchQuery: string, searchType: string) => {
    setLoading(true);
    try {
      const data = await safeFetchJson(
        `/api/search?query=${encodeURIComponent(searchQuery)}&type=${searchType}&email=${encodeURIComponent(user.email)}`
      );
      setResults(data.results || []);
    } catch (e) {
      console.error('Error fetching search results:', e);
      toast.error('Failed to search skills.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchSearchResults(query, type);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, type]);

  const handleSendRequest = async (receiverEmail: string) => {
    try {
      await safeFetchJson('/api/requests/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: user.email, receiver: receiverEmail })
      });
      onAddActivity('success', `Swap request sent to ${receiverEmail}`);
      toast.success(`Swap request sent!`);
      fetchRequests();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getRequestState = (targetEmail: string) => {
    const incoming = requests.incoming.find(r => r.sender === targetEmail);
    const outgoing = requests.outgoing.find(r => r.receiver === targetEmail);
    const req = incoming || outgoing;
    if (!req) return 'none';
    return req.status; // 'pending', 'accepted', 'rejected'
  };

  const handleAskCoach = (name: string, offeredSkill: string) => {
    const prompt = `Draft a message to ${name} for ${offeredSkill} skill swap`;
    setChatbotInitialPrompt(prompt);
    onTabChange('chatbot');
  };

  const popularSkills = [
    'Web Development',
    'UI/UX Design',
    'React Development',
    'Data Science',
    'Graphic Design',
    'Python',
    'Mobile App Development'
  ];

  const getSkillIcon = (skill: string) => {
    const s = skill?.toLowerCase() || '';
    if (s.includes('code') || s.includes('developer') || s.includes('development') || s.includes('react') || s.includes('mern') || s.includes('stack')) {
      return { icon: <Code className="w-4 h-4" />, bgColor: 'bg-[#e6f5ef]', iconColor: 'text-[var(--brand)]', border: 'border-[#9FE1CB]' };
    }
    if (s.includes('photo') || s.includes('video') || s.includes('camera')) {
      return { icon: <Camera className="w-4 h-4" />, bgColor: 'bg-[#fff8e6]', iconColor: 'text-[#c87400]', border: 'border-[#f2d0a0]' };
    }
    if (s.includes('data') || s.includes('science') || s.includes('chart') || s.includes('analyst') || s.includes('analytics')) {
      return { icon: <BarChart3 className="w-4 h-4" />, bgColor: 'bg-[#e6f1fb]', iconColor: 'text-[#185fa5]', border: 'border-[#aed0ee]' };
    }
    return { icon: <PenTool className="w-4 h-4" />, bgColor: 'bg-[#eeedfe]', iconColor: 'text-[#534ab7]', border: 'border-[#cecaf4]' };
  };

  return (
    <div className="space-y-6">
      <div className="bg-background border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills (e.g. React, Python, UI/UX Design, Photoshop...)"
            className="w-full pl-10 pr-10 py-3 border border-border rounded-lg bg-secondary text-sm outline-none focus:border-[var(--brand)] transition-colors text-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 text-xs text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Type:</span>
            <div className="flex bg-secondary p-0.5 rounded-lg border border-border">
              {(['all', 'offer', 'want'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-3 py-1 text-xs rounded-md font-semibold capitalize transition-all cursor-pointer ${
                    type === t
                      ? 'bg-background text-[var(--brand)] shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'offer' ? 'Offering' : 'Wanting'}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {loading ? (
              <span>Searching...</span>
            ) : (
              <span>Found {results.length} community members</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Popular:</span>
          {popularSkills.map((skill) => (
            <button
              key={skill}
              onClick={() => {
                setQuery(skill);
                setType('all');
              }}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer font-medium"
            >
              {skill}
            </button>
          ))}
        </div>
      </div>

      <div>
        {loading ? (
          <div className="text-center py-12 bg-background border border-border rounded-xl shadow-sm">
            <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-muted-foreground font-medium">Searching SkillSwap database...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12 bg-background border border-border rounded-xl shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No matches found</h3>
            <p className="text-xs text-muted-foreground max-w-[320px] mx-auto leading-normal">
              We couldn't find anyone offering or wanting skills related to "{query}". Try checking your spelling or looking for broader terms.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {results.map((item, index) => {
              const offerIcon = getSkillIcon(item.offers);
              const wantIcon = getSkillIcon(item.wants);
              const state = getRequestState(item.email);
              return (
                <div key={index} className="bg-background border border-border rounded-xl p-5 shadow-sm hover:border-[var(--brand-mid)]/40 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
                          {item.initials}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground leading-tight flex items-center gap-1.5">
                            {item.name}
                          </h4>
                          <span className="text-[10px] text-muted-foreground">{item.email}</span>
                        </div>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 border border-amber-500/20 font-bold flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {item.rating?.toFixed(1) || '5.0'}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {item.bio}
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-12 font-semibold uppercase tracking-wider">Offers:</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${offerIcon.bgColor} ${offerIcon.iconColor} ${offerIcon.border}`}>
                          {offerIcon.icon}
                          {item.offers}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-12 font-semibold uppercase tracking-wider">Wants:</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${wantIcon.bgColor} ${wantIcon.iconColor} ${wantIcon.border}`}>
                          {wantIcon.icon}
                          {item.wants}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border/55">
                    {state === 'none' && (
                      <button
                        onClick={() => handleSendRequest(item.email)}
                        className="flex-1 py-1.5 rounded-md text-xs font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)] transition-colors cursor-pointer"
                      >
                        Send Request
                      </button>
                    )}
                    {state === 'pending' && (
                      <button
                        disabled
                        className="flex-1 py-1.5 rounded-md text-xs font-semibold bg-secondary text-muted-foreground border border-border cursor-not-allowed"
                      >
                        Request Sent
                      </button>
                    )}
                    {state === 'accepted' && (
                      <button
                        onClick={() => setActiveChatUser({ name: item.name, email: item.email, initials: item.initials })}
                        className="flex-1 py-1.5 rounded-md text-xs font-semibold bg-[#185fa5] text-white hover:bg-[#124d88] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>
                    )}
                    {state === 'rejected' && (
                      <span className="flex-1 text-[10px] text-destructive py-1.5 bg-destructive/10 rounded border border-destructive/20 text-center font-semibold">
                        Rejected
                      </span>
                    )}
                    <button
                      onClick={() => handleAskCoach(item.name, item.offers)}
                      className="flex-1 py-1.5 rounded-md text-xs font-semibold border border-border bg-secondary text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[var(--brand)]" />
                      <span>Ask Coach</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatWindowProps {
  currentUser: UserData;
  chatPartner: { name: string; email: string; initials: string };
  onClose: () => void;
  setActiveBookingUser: (u: any) => void;
  onAddActivity: (type: 'success' | 'message' | 'star', text: string) => void;
  setActiveVideoCall: (call: any) => void;
}

function ChatWindow({ currentUser, chatPartner, onClose, setActiveBookingUser, onAddActivity, setActiveVideoCall }: ChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<any>(null);
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  useEffect(() => {
    const socketInstance = io(API_URL);
    setSocket(socketInstance);

    socketInstance.emit('join_room', { sender: currentUser.email, receiver: chatPartner.email });

    socketInstance.on('receive_message', (msg: any) => {
      setMessages((prev) => [...prev, msg]);
    });

    const loadHistory = async () => {
      try {
        const data = await safeFetchJson(
          `/api/chat/history?user1=${encodeURIComponent(currentUser.email)}&user2=${encodeURIComponent(chatPartner.email)}`
        );
        setMessages(data.history || []);
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };

    loadHistory();

    return () => {
      socketInstance.disconnect();
    };
  }, [currentUser.email, chatPartner.email]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error('File size exceeds the 50MB limit.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:5000/api/chat/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAttachedFile(data.file);
        toast.success(`${file.name} uploaded successfully!`);
      } else {
        toast.error(data.error || 'Failed to upload file.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error uploading file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStartVideoCall = () => {
    if (!socket) return;
    const roomHash = [currentUser.email.toLowerCase(), chatPartner.email.toLowerCase()].sort().join('_').replace(/[@.]/g, '');
    const roomName = `skillswap_chat_${roomHash}`;
    
    socket.emit('send_message', {
      sender: currentUser.email,
      receiver: chatPartner.email,
      message: `[VIDEO_CALL_LINK]:${roomName}`
    });
    
    setActiveVideoCall({
      roomName,
      subject: "Quick Skill Swap Video Session",
      partnerName: chatPartner.name
    });
    
    onAddActivity('message', `Started a video call with ${chatPartner.name}`);
    toast.success('Video call started!');
  };

  const handleSend = () => {
    if ((!inputText.trim() && !attachedFile) || !socket) return;
    socket.emit('send_message', {
      sender: currentUser.email,
      receiver: chatPartner.email,
      message: inputText.trim(),
      file: attachedFile
    });
    
    const fileDesc = attachedFile ? ` and shared ${attachedFile.fileName}` : '';
    onAddActivity('message', `Sent a message to ${chatPartner.name}${fileDesc}`);
    toast.success('Message sent!');
    setInputText('');
    setAttachedFile(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="absolute right-6 bottom-6 w-[360px] h-[480px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-[var(--brand-dark)] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold font-head">
            {chatPartner.initials}
          </div>
          <div>
            <div className="text-xs font-bold leading-tight">{chatPartner.name}</div>
            <div className="text-[10px] text-white/60 leading-none truncate max-w-[150px]">{chatPartner.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleStartVideoCall} 
            className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full text-white transition-colors flex items-center justify-center cursor-pointer border border-white/20"
            title="Start video call"
          >
            <Video className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setActiveBookingUser(chatPartner)} className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-white/20">
            <CalendarIcon className="w-3 h-3" /> Book
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors cursor-pointer text-sm font-semibold p-1">
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-[#f5f5f7] space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center p-4">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-semibold text-foreground">No messages yet</p>
            <p className="text-[10px] text-muted-foreground max-w-[200px] mt-0.5">Send a message to start swapping skills!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender.toLowerCase() === currentUser.email.toLowerCase();
            return (
              <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-xl text-xs shadow-sm ${
                  isMe ? 'bg-[var(--brand)] text-white rounded-br-none' : 'bg-background text-foreground border border-border/50 rounded-bl-none'
                }`}>
                  {msg.message && msg.message.startsWith('[VIDEO_CALL_LINK]:') ? (
                    <div className="py-1 px-0.5 space-y-2 min-w-[200px] text-left">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isMe ? 'bg-white/20 text-white' : 'bg-[var(--brand-light)] text-[var(--brand)]'}`}>
                          <Video className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <div className="font-bold text-xs">Video Call Invite</div>
                          <div className="text-[9px] opacity-75">Click to join the secure session</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveVideoCall({
                          roomName: msg.message.substring('[VIDEO_CALL_LINK]:'.length),
                          subject: "Quick Skill Swap Video Session",
                          partnerName: chatPartner.name
                        })}
                        className={`w-full mt-2 py-1.5 px-3 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isMe 
                            ? 'bg-white text-[var(--brand)] hover:bg-white/95' 
                            : 'bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)]'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5" /> Join Video Call
                      </button>
                    </div>
                  ) : (
                    msg.message && <p className="leading-relaxed break-words">{msg.message}</p>
                  )}
                  
                  {msg.fileUrl && (
                    <div className="mt-1">
                      {msg.fileType === 'video' ? (
                        <div className="mt-1 mb-1 rounded-lg overflow-hidden border border-border bg-black/10 max-w-full">
                          <video 
                            src={`${API_URL}${msg.fileUrl}`} 
                            controls 
                            className="max-w-full max-h-[160px] object-contain rounded-md"
                          />
                        </div>
                      ) : msg.fileType === 'image' ? (
                        <div className="mt-1 mb-1 rounded-lg overflow-hidden border border-border bg-black/5 max-w-full">
                          <img 
                            src={`${API_URL}${msg.fileUrl}`} 
                            alt={msg.fileName || "Shared image"} 
                            className="max-w-full max-h-[160px] object-cover cursor-pointer rounded-md hover:opacity-90 transition-opacity"
                            onClick={() => window.open(`${API_URL}${msg.fileUrl}`, '_blank')}
                          />
                        </div>
                      ) : (
                        <a 
                          href={`${API_URL}${msg.fileUrl}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left cursor-pointer transition-colors max-w-full ${
                            isMe 
                              ? 'bg-white/10 border-white/20 hover:bg-white/15 text-white' 
                              : 'bg-secondary border-border hover:bg-muted text-foreground'
                          }`}
                        >
                          <div className={`p-1.5 rounded ${isMe ? 'bg-white/20' : 'bg-[var(--brand-light)] text-[var(--brand)]'}`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate text-[11px] leading-tight">
                              {msg.fileName}
                            </div>
                            {msg.fileSize && (
                              <div className={`text-[9px] ${isMe ? 'text-white/60' : 'text-muted-foreground'}`}>
                                {formatBytes(msg.fileSize)}
                              </div>
                            )}
                          </div>
                          <Download className={`w-3.5 h-3.5 flex-shrink-0 ${isMe ? 'text-white/70' : 'text-muted-foreground'}`} />
                        </a>
                      )}
                    </div>
                  )}

                  <span className={`block text-[9px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {attachedFile && (
        <div className="px-3 py-2 bg-secondary border-t border-border flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded bg-[var(--brand-light)] text-[var(--brand)]">
              {attachedFile.fileType === 'video' ? <Video className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            </div>
            <div className="truncate flex-1">
              <span className="font-semibold text-foreground text-[11px]">{attachedFile.fileName}</span>
              <span className="text-[9px] text-muted-foreground ml-1.5">({formatBytes(attachedFile.fileSize)})</span>
            </div>
          </div>
          <button 
            onClick={() => setAttachedFile(null)} 
            className="text-muted-foreground hover:text-foreground cursor-pointer text-xs p-1 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <div className="p-3 border-t border-border bg-background flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2 rounded-lg border border-border bg-secondary hover:bg-muted text-muted-foreground transition-colors cursor-pointer flex-shrink-0 disabled:opacity-40"
          title="Attach file (document or video)"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--brand)]" />
          ) : (
            <Paperclip className="w-3.5 h-3.5" />
          )}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="video/*,image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        />
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isUploading ? "Uploading file..." : "Type your message..."}
          disabled={isUploading}
          className="flex-1 px-3 py-2 border border-border rounded-lg bg-secondary text-xs outline-none focus:border-[var(--brand)] text-foreground disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={(!inputText.trim() && !attachedFile) || isUploading}
          className="p-2 rounded-lg bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)] disabled:opacity-40 disabled:hover:bg-[var(--brand)] transition-colors cursor-pointer flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function BookingsTab({ user, bookings, loading, fetchBookings, onAddActivity, setActiveChatUser, onUserUpdate, setActiveVideoCall }: any) {
  if (loading) {
    return <div className="text-center py-10 text-sm text-muted-foreground">Loading sessions...</div>;
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await safeFetchJson('/api/bookings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      toast.success(`Session ${status}!`);
      fetchBookings();
      if (status === 'completed') {
        try {
          const data = await safeFetchJson(`/api/profile/me?email=${encodeURIComponent(user.email)}`);
          if (data.success && data.user) {
            onUserUpdate(data.user);
          }
        } catch (err) {
          console.error("Failed to refresh user stats:", err);
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to update session');
    }
  };

  const incomingPending = bookings.incoming.filter((b: any) => b.status === 'pending');
  const outgoingPending = bookings.outgoing.filter((b: any) => b.status === 'pending');
  const confirmed = [...bookings.incoming, ...bookings.outgoing].filter((b: any) => b.status === 'accepted');

  return (
    <div className="space-y-8">
      <section>
        <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-base font-bold mb-3 flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-[var(--brand)]" /> Upcoming Sessions
        </h2>
        {confirmed.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-background border border-border p-4 rounded-lg">No confirmed sessions yet. Book a session with a match to get started!</p>
        ) : (
          <div className="space-y-3">
            {confirmed.map((b: any, i: number) => {
              const partner = b.requester === user.email.toLowerCase() ? b.provider : b.requester;
              return (
                <div key={i} className="bg-background border border-border rounded-lg p-5 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[var(--brand-light)] border border-[var(--brand-mid)]/20 flex flex-col items-center justify-center text-[var(--brand)]">
                      <span className="text-[10px] font-bold uppercase">{format(new Date(b.date), 'MMM')}</span>
                      <span className="text-lg font-bold leading-none">{format(new Date(b.date), 'dd')}</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground mb-1">Session with {partner}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {b.time}</span>
                        <span className="flex items-center gap-1"><Code className="w-3.5 h-3.5" /> {b.topic}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setActiveChatUser({ email: partner, name: partner, initials: partner.substring(0,2).toUpperCase() })} className="px-3.5 py-1.5 bg-[#185fa5] text-white text-xs rounded hover:bg-[#124d88] flex items-center gap-1.5 font-medium transition-colors cursor-pointer">
                      <MessageSquare className="w-3.5 h-3.5" /> Chat
                    </button>
                    <button 
                      onClick={() => setActiveVideoCall({
                        roomName: `skillswap_booking_${b._id}`,
                        subject: b.topic || "Skill Swap Session",
                        partnerName: partner
                      })}
                      className="px-3.5 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5" /> Join Call
                    </button>
                    <button onClick={() => handleUpdateStatus(b._id, 'completed')} className="px-3.5 py-1.5 bg-secondary border border-border text-foreground text-xs rounded hover:bg-muted flex items-center gap-1.5 font-medium transition-colors cursor-pointer">
                      <Check className="w-3.5 h-3.5" /> Mark Completed
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wide">Incoming Requests</h2>
          {incomingPending.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-background border border-border p-4 rounded-lg">No pending incoming requests.</p>
          ) : (
            <div className="space-y-3">
              {incomingPending.map((b: any, i: number) => (
                <div key={i} className="bg-background border border-border rounded-lg p-4 flex flex-col gap-3">
                  <div>
                    <div className="text-sm font-semibold">{b.requester}</div>
                    <div className="text-xs text-muted-foreground mt-1">Requested a session on <strong>{format(new Date(b.date), 'MMM do')}</strong> at <strong>{b.time}</strong></div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 border border-border bg-secondary inline-block px-2 py-0.5 rounded">Topic: {b.topic}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateStatus(b._id, 'accepted')} className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 cursor-pointer text-center">Accept</button>
                    <button onClick={() => handleUpdateStatus(b._id, 'rejected')} className="flex-1 px-3 py-1.5 bg-destructive/10 text-destructive text-xs font-semibold rounded border border-destructive/20 hover:bg-destructive/20 cursor-pointer text-center">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wide">Outgoing Requests</h2>
          {outgoingPending.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-background border border-border p-4 rounded-lg">No pending outgoing requests.</p>
          ) : (
            <div className="space-y-3">
              {outgoingPending.map((b: any, i: number) => (
                <div key={i} className="bg-background border border-border rounded-lg p-4 flex flex-col gap-2">
                  <div className="text-sm font-semibold">To: {b.provider}</div>
                  <div className="text-xs text-muted-foreground">Requested for <strong>{format(new Date(b.date), 'MMM do')}</strong> at <strong>{b.time}</strong></div>
                  <div className="mt-1">
                    <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-1 border border-amber-200 rounded inline-block">Pending</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function BookingModal({ currentUser, bookingPartner, onClose, onSuccess }: any) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('10:00');
  const [topic, setTopic] = useState('Skill Swap Session');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!date) {
      toast.error('Please select a date');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await safeFetchJson('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester: currentUser.email,
          provider: bookingPartner.email,
          date: format(date, 'yyyy-MM-dd'),
          time,
          topic
        })
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to book session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeSlots = [
    "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", 
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
  ];

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 rounded-[10px] p-4 backdrop-blur-sm">
      <div className="bg-background rounded-xl p-0 w-full max-w-[700px] border border-border shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Left Side - Calendar */}
        <div className="p-6 bg-secondary/30 border-r border-border">
          <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-base font-bold mb-4 text-foreground flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[var(--brand)]" /> Select Date
          </h2>
          <div className="bg-background rounded-xl border border-border p-2 shadow-sm inline-block">
            <DayPicker
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={{ before: new Date(new Date().setHours(0,0,0,0)) }}
              className="font-sans text-sm"
              classNames={{
                day_selected: "bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)]",
                day_today: "font-bold text-[var(--brand)]",
                head_cell: "text-muted-foreground font-semibold text-xs uppercase"
              }}
            />
          </div>
        </div>

        {/* Right Side - Details */}
        <div className="p-6 flex-1 flex flex-col bg-background relative">
          <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 transition-colors">
            ✕
          </button>
          
          <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-lg font-bold mb-1 text-foreground">
            Book a Session
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            Schedule a skill swap session with <strong className="text-foreground">{bookingPartner.name}</strong>
          </p>

          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Select Time
              </label>
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map(t => (
                  <button
                    key={t}
                    onClick={() => setTime(t)}
                    className={`py-2 px-1 text-xs font-semibold rounded-md border transition-all ${
                      time === t 
                        ? 'bg-[var(--brand)] text-white border-[var(--brand)]' 
                        : 'bg-secondary text-foreground border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Topic / Goal
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. React hooks basics, Logo design review..."
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-secondary text-xs outline-none focus:border-[var(--brand)] text-foreground transition-colors"
              />
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold border border-border bg-secondary hover:bg-muted text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
