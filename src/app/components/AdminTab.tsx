import React, { useState, useEffect } from 'react';
import { 
  Users, Shield, Edit, Trash2, ArrowUpRight, BarChart3, 
  Database, RefreshCw, X, Plus, Search, Star, MessageSquare, 
  Award, ArrowLeftRight, Terminal, CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

interface UserData {
  _id?: string;
  name: string;
  email: string;
  initials: string;
  skillOffer: string;
  skillWant: string;
  bio?: string;
  rating?: number;
  exchanges?: number;
  memberSince?: number;
}

interface StatsData {
  totalUsers: number;
  totalExchanges: number;
  averageRating: string;
  offeredSkills: { name: string; count: number }[];
  wantedSkills: { name: string; count: number }[];
}

export default function AdminTab({ currentUser }: { currentUser: any }) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalUsers: 0,
    totalExchanges: 0,
    averageRating: '5.0',
    offeredSkills: [],
    wantedSkills: []
  });
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'users' | 'analytics' | 'settings'>('dashboard');
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSkillOffer, setFilterSkillOffer] = useState('All');
  
  // Modals
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  
  // System Log Console
  const [logs, setLogs] = useState<string[]>(['[System] Admin Session started.', `[System] Authenticated as ${currentUser.email}.`]);

  // Form State for Add User
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    skillOffer: 'Full Stack Development',
    skillWant: 'UI/UX Design',
    bio: '',
    password: 'password123'
  });

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${message}`, ...prev].slice(0, 50));
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      addLog('Fetching latest database records...');
      const usersRes = await fetch('/api/admin/users');
      const usersData = await usersRes.json();
      
      const statsRes = await fetch('/api/admin/stats');
      const statsData = await statsRes.json();

      if (usersData.success && statsData.success) {
        setUsers(usersData.users);
        setStats(statsData.stats);
        addLog(`Database synchronized successfully. Loaded ${usersData.users.length} users.`);
      } else {
        throw new Error('API reported unsuccessful sync.');
      }
    } catch (e: any) {
      console.error(e);
      addLog(`[ERROR] Failed to fetch database state: ${e.message}`);
      toast.error('Could not load admin database content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editingUser._id) return;
    
    try {
      addLog(`Initiating update request for user ID: ${editingUser._id}`);
      const res = await fetch(`/api/admin/users/${editingUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Updated ${editingUser.name}'s profile.`);
        addLog(`[SUCCESS] Modified user profile: ${editingUser.email}`);
        setEditingUser(null);
        fetchAdminData();
      } else {
        throw new Error(data.error || 'Server rejected update.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user.');
      addLog(`[ERROR] Profile update failed: ${err.message}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser || !deletingUser._id) return;
    try {
      addLog(`Sending delete request for user ID: ${deletingUser._id} (${deletingUser.email})`);
      const res = await fetch(`/api/admin/users/${deletingUser._id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted account: ${deletingUser.name}`);
        addLog(`[SUCCESS] Deleted user account: ${deletingUser.email}`);
        setDeletingUser(null);
        fetchAdminData();
      } else {
        throw new Error(data.error || 'Server rejected deletion.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user.');
      addLog(`[ERROR] Deletion failed: ${err.message}`);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      toast.error('Please fill in required fields.');
      return;
    }

    try {
      addLog(`Creating user profile: ${newUserForm.email}`);
      const firstName = newUserForm.name.split(' ')[0] || '';
      const lastName = newUserForm.name.split(' ').slice(1).join(' ') || '';

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email: newUserForm.email,
          skillOffer: newUserForm.skillOffer,
          skillWant: newUserForm.skillWant,
          password: newUserForm.password
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Successfully registered user: ${newUserForm.name}`);
        addLog(`[SUCCESS] Registered member: ${newUserForm.email}`);
        setIsAddUserOpen(false);
        setNewUserForm({
          name: '',
          email: '',
          skillOffer: 'Full Stack Development',
          skillWant: 'UI/UX Design',
          bio: '',
          password: 'password123'
        });
        fetchAdminData();
      } else {
        throw new Error(data.error || 'Server registration error');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add user.');
      addLog(`[ERROR] Registration failed: ${err.message}`);
    }
  };

  const triggerSeed = async () => {
    try {
      addLog('Dispatching database seeding action...');
      const res = await fetch('/api/admin/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Database seeded. Added ${data.seededCount} users.`);
        addLog(`[SUCCESS] DB Seeding complete. Seeded ${data.seededCount} records.`);
        fetchAdminData();
      } else {
        throw new Error('Seed process returned failed status.');
      }
    } catch (e: any) {
      toast.error('Failed to seed default data.');
      addLog(`[ERROR] Seeding aborted: ${e.message}`);
    }
  };

  const triggerWipe = async () => {
    if (!window.confirm('WARNING: This will delete all users (except the System Admin) and all chat sessions. Are you sure you want to proceed?')) {
      return;
    }
    try {
      addLog('Initiating database wipe protocol...');
      const res = await fetch('/api/admin/wipe', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Database has been completely reset.');
        addLog(`[SUCCESS] Database wiped successfully. Removed ${data.deletedUsers} users and ${data.deletedChats} chats.`);
        fetchAdminData();
      } else {
        throw new Error('Wipe operation failed.');
      }
    } catch (e: any) {
      toast.error('Database reset failed.');
      addLog(`[ERROR] Wipe halted: ${e.message}`);
    }
  };

  // Process users list
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.skillOffer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.skillWant.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesOffer = filterSkillOffer === 'All' || u.skillOffer === filterSkillOffer;
    return matchesSearch && matchesOffer;
  });

  const uniqueOfferSkills = Array.from(new Set(users.map(u => u.skillOffer)));

  // Recharts Skill Data Alignment
  const chartData = stats.offeredSkills.slice(0, 6).map(item => {
    const wantedObj = stats.wantedSkills.find(w => w.name === item.name);
    return {
      skill: item.name.length > 18 ? item.name.slice(0, 15) + '...' : item.name,
      Offered: item.count,
      Wanted: wantedObj ? wantedObj.count : 0
    };
  });

  const SkillPill = ({ label, type }: { label: string, type: 'offer' | 'want' }) => {
    const isOffer = type === 'offer';
    return (
      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
        isOffer 
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
          : 'bg-amber-50 text-amber-800 border-amber-200'
      }`}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-[38px] h-[38px] bg-emerald-50 text-[var(--brand)] rounded-lg flex items-center justify-center border border-emerald-100 shadow-inner">
            <ShieldCheck className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-base font-bold flex items-center gap-1.5">
              System Admin Console
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Monitor, moderate and seed platform assets. Database Connected.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchAdminData} 
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border bg-secondary hover:bg-muted text-foreground cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync DB
          </button>
          <button 
            onClick={() => setIsAddUserOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--brand)] hover:bg-[var(--brand-mid)] text-white cursor-pointer transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Member
          </button>
        </div>
      </div>

      {/* Admin Panel Sub Navigation */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveSubTab('dashboard')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'dashboard'
              ? 'border-[var(--brand)] text-[var(--brand)]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview Dashboard
        </button>
        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'users'
              ? 'border-[var(--brand)] text-[var(--brand)]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Member Directory ({users.length})
        </button>
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'analytics'
              ? 'border-[var(--brand)] text-[var(--brand)]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Skill Analytics
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'settings'
              ? 'border-[var(--brand)] text-[var(--brand)]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          System Tools
        </button>
      </div>

      {/* SUB TAB 1: OVERVIEW DASHBOARD */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Dashboard Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0d3d2a] to-[#1a6b4a] text-white p-5 rounded-xl border border-emerald-950/20 shadow-md">
              <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-200/80 mb-2">Total Platform Users</div>
              <div style={{ fontFamily: 'var(--font-head)' }} className="text-3xl font-extrabold">{stats.totalUsers}</div>
              <p className="text-[11px] text-emerald-100/70 mt-2 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Registered Accounts
              </p>
            </div>
            
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 to-indigo-800 text-white p-5 rounded-xl border border-indigo-950/20 shadow-md">
              <div className="text-[10px] uppercase font-bold tracking-widest text-indigo-200/80 mb-2">Active Swaps / Exchanges</div>
              <div style={{ fontFamily: 'var(--font-head)' }} className="text-3xl font-extrabold">{stats.totalExchanges}</div>
              <p className="text-[11px] text-indigo-100/70 mt-2 flex items-center gap-1">
                <ArrowLeftRight className="w-3.5 h-3.5" /> Platform swaps conducted
              </p>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-amber-950 to-amber-800 text-white p-5 rounded-xl border border-amber-950/20 shadow-md">
              <div className="text-[10px] uppercase font-bold tracking-widest text-amber-200/80 mb-2">System Average Rating</div>
              <div style={{ fontFamily: 'var(--font-head)' }} className="text-3xl font-extrabold flex items-center gap-1">
                {stats.averageRating} <Star className="w-5 h-5 fill-current text-[var(--color-accent)] inline" />
              </div>
              <p className="text-[11px] text-amber-100/70 mt-2 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> High average satisfaction
              </p>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-700 text-white p-5 rounded-xl border border-slate-900/20 shadow-md">
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-300 mb-2">Top Offered Skill</div>
              <div style={{ fontFamily: 'var(--font-head)' }} className="text-base font-extrabold truncate leading-8">
                {stats.offeredSkills[0]?.name || 'N/A'}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" /> {stats.offeredSkills[0]?.count || 0} users teaching
              </p>
            </div>
          </div>

          {/* Quick Analytics & Console Preview Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Quick Chart */}
            <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
              <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold mb-4 flex items-center gap-1.5 text-foreground">
                <BarChart3 className="w-4 h-4 text-[var(--brand)]" /> Skill Exchange Demand (Top 6)
              </h3>
              <div className="h-[200px] w-full text-xs">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No skills data to chart. Try seeding database.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f5" />
                      <XAxis dataKey="skill" stroke="#888" tickLine={false} axisLine={false} />
                      <YAxis stroke="#888" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #ddd' }} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="Offered" fill="#2d9e6e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Wanted" fill="#f0a500" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Console Log Logwidget */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-zinc-100 font-mono text-xs flex flex-col h-[260px] shadow-lg">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3.5 flex-shrink-0 text-zinc-400">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold text-[10px] uppercase tracking-wider">Developer Log Console</span>
                </div>
                <button 
                  onClick={() => setLogs([`[System] Logs cleared at ${new Date().toLocaleTimeString()}.`])}
                  className="text-[9px] bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded cursor-pointer transition-colors"
                >
                  Clear Logs
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin">
                {logs.map((log, idx) => {
                  let logColor = 'text-zinc-300';
                  if (log.includes('[ERROR]')) logColor = 'text-rose-400 font-semibold';
                  if (log.includes('[SUCCESS]')) logColor = 'text-emerald-400 font-semibold';
                  if (log.includes('[System]')) logColor = 'text-indigo-400';
                  
                  return (
                    <div key={idx} className={`leading-relaxed text-[11px] select-all ${logColor}`}>
                      {log}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: MEMBER DIRECTORY */}
      {activeSubTab === 'users' && (
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden animate-fadeIn">
          {/* Directory Filtering Controls */}
          <div className="p-4 bg-secondary/35 border-b border-border flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, email, or specific skills..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm outline-none focus:border-[var(--brand)] transition-colors text-foreground"
              />
            </div>
            
            <div className="w-full sm:w-[200px]">
              <select
                value={filterSkillOffer}
                onChange={e => setFilterSkillOffer(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm outline-none focus:border-[var(--brand)] transition-colors text-foreground"
              >
                <option value="All">All Offered Skills</option>
                {uniqueOfferSkills.map((sk, i) => (
                  <option key={i} value={sk}>{sk}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--brand)]" />
                Retrieving database users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No database records match your filter criteria.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-secondary/40 text-muted-foreground uppercase font-bold border-b border-border text-[10px] tracking-wider">
                    <th className="p-4">Member Info</th>
                    <th className="p-4">Offered Skill</th>
                    <th className="p-4">Wanted Skill</th>
                    <th className="p-4 text-center">Rating</th>
                    <th className="p-4 text-center">Swaps</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((u) => {
                    const isSystemAdmin = u.email === 'admin@skillswap.com';
                    return (
                      <tr key={u._id} className="hover:bg-secondary/15 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full ${isSystemAdmin ? 'bg-indigo-600' : 'bg-[var(--brand)]'} flex items-center justify-center text-white font-bold`}>
                              {u.initials}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                {u.name}
                                {isSystemAdmin && (
                                  <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <SkillPill label={u.skillOffer} type="offer" />
                        </td>
                        <td className="p-4">
                          <SkillPill label={u.skillWant} type="want" />
                        </td>
                        <td className="p-4 text-center font-semibold text-foreground">
                          <div className="flex items-center justify-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {u.rating?.toFixed(1) || '5.0'}
                          </div>
                        </td>
                        <td className="p-4 text-center font-semibold text-foreground">{u.exchanges || 0}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setEditingUser(u)}
                              className="p-1.5 rounded hover:bg-secondary border border-transparent hover:border-border text-foreground transition-all cursor-pointer"
                              title="Edit Profile"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingUser(u)}
                              disabled={isSystemAdmin}
                              className={`p-1.5 rounded hover:bg-red-50 border border-transparent hover:border-red-100 text-red-600 transition-all ${isSystemAdmin ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
                              title={isSystemAdmin ? "Cannot delete Admin" : "Delete Account"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SUB TAB 3: SKILL ANALYTICS */}
      {activeSubTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          {/* Offer analytics */}
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
            <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold mb-4 text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Top Offered Skills (Database Aggregate)
            </h3>
            <div className="space-y-3">
              {stats.offeredSkills.slice(0, 8).map((skill, index) => {
                const total = stats.totalUsers || 1;
                const pct = ((skill.count / total) * 100).toFixed(0);
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{skill.name}</span>
                      <span className="text-muted-foreground">{skill.count} teachers ({pct}%)</span>
                    </div>
                    <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Want analytics */}
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
            <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold mb-4 text-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Top Wanted Skills (Learning Demand)
            </h3>
            <div className="space-y-3">
              {stats.wantedSkills.slice(0, 8).map((skill, index) => {
                const total = stats.totalUsers || 1;
                const pct = ((skill.count / total) * 100).toFixed(0);
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{skill.name}</span>
                      <span className="text-muted-foreground">{skill.count} learners ({pct}%)</span>
                    </div>
                    <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 4: SYSTEM TOOLS */}
      {activeSubTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          {/* Seeding Card */}
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold mb-2 text-foreground flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600" /> Populate Database
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Automatically seed user profiles, custom skills, and ratings directly from `db.json` file. Existing profiles with the same email will be skipped.
              </p>
            </div>
            <div>
              <button 
                onClick={triggerSeed}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold cursor-pointer transition-colors shadow-sm"
              >
                Seed Mock Users
              </button>
            </div>
          </div>

          {/* Reset Database Card */}
          <div className="bg-white border border-destructive/30 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold mb-2 text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Danger Zone: Factory Reset
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Clears all custom member profiles, activity logs, and chat sessions. The system admin account (`admin@skillswap.com`) is protected and will not be removed.
              </p>
            </div>
            <div>
              <button 
                onClick={triggerWipe}
                className="w-full py-2 border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 rounded-md text-xs font-semibold cursor-pointer transition-colors"
              >
                Wipe Platform Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT USER DIALOG */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl max-w-[460px] w-full border border-border shadow-2xl p-6 overflow-hidden animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold text-foreground">
                Edit Member Profile
              </h3>
              <button onClick={() => setEditingUser(null)} className="p-1 rounded hover:bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingUser.name}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editingUser.email}
                    onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Skill Offered</label>
                  <select
                    value={editingUser.skillOffer}
                    onChange={e => setEditingUser({ ...editingUser, skillOffer: e.target.value })}
                    className="w-full px-2 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                  >
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
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Skill Wanted</label>
                  <select
                    value={editingUser.skillWant}
                    onChange={e => setEditingUser({ ...editingUser, skillWant: e.target.value })}
                    className="w-full px-2 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                  >
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Exchanges Count</label>
                  <input
                    type="number"
                    min="0"
                    value={editingUser.exchanges}
                    onChange={e => setEditingUser({ ...editingUser, exchanges: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Rating Value</label>
                  <input
                    type="number"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={editingUser.rating}
                    onChange={e => setEditingUser({ ...editingUser, rating: parseFloat(e.target.value) || 5.0 })}
                    className="w-full px-3 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Profile Bio</label>
                <textarea
                  value={editingUser.bio || ''}
                  onChange={e => setEditingUser({ ...editingUser, bio: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)] resize-none"
                  placeholder="Tell us about this user..."
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-border bg-secondary hover:bg-muted text-foreground font-semibold rounded-md cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-mid)] text-white font-semibold rounded-md cursor-pointer transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD USER DIALOG */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl max-w-[460px] w-full border border-border shadow-2xl p-6 overflow-hidden animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold text-foreground">
                Add New Platform Member
              </h3>
              <button onClick={() => setIsAddUserOpen(false)} className="p-1 rounded hover:bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newUserForm.name}
                    onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@doe.com"
                    value={newUserForm.email}
                    onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Skill Offered</label>
                  <select
                    value={newUserForm.skillOffer}
                    onChange={e => setNewUserForm({ ...newUserForm, skillOffer: e.target.value })}
                    className="w-full px-2 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                  >
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
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Skill Wanted</label>
                  <select
                    value={newUserForm.skillWant}
                    onChange={e => setNewUserForm({ ...newUserForm, skillWant: e.target.value })}
                    className="w-full px-2 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                  >
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

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={newUserForm.password}
                  onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded bg-secondary text-foreground outline-none focus:border-[var(--brand)]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 border border-border bg-secondary hover:bg-muted text-foreground font-semibold rounded-md cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-mid)] text-white font-semibold rounded-md cursor-pointer transition-colors shadow-sm"
                >
                  Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl max-w-[340px] w-full border border-border shadow-2xl p-6 text-center animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 style={{ fontFamily: 'var(--font-head)' }} className="text-sm font-bold text-foreground mb-2">
              Delete Member Account?
            </h3>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              This will permanently delete the account of <strong>{deletingUser.name}</strong> ({deletingUser.email}) and all associated records. This action cannot be undone.
            </p>
            <div className="flex gap-2.5 text-xs">
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-2.5 border border-border rounded-md bg-secondary text-foreground font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 py-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer shadow-sm"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
