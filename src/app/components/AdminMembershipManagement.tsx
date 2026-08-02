import React, { useState, useEffect } from 'react';
import { 
  Users, Shield, Edit, ArrowUpRight, BarChart3, 
  Database, RefreshCw, X, Search, ShieldCheck,
  CheckCircle2, AlertTriangle, Download, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../config';

interface PremiumUser {
  _id: string;
  name: string;
  email: string;
  membershipType: string;
  paymentStatus: string;
  assessmentLimit: number;
  assessmentRemaining: number;
  assessmentAttemptCount: number;
  premiumExpiry?: string;
  isPremium?: boolean;
}

interface AdminLog {
  _id: string;
  adminEmail: string;
  action: string;
  targetUser: string;
  timestamp: string;
  ipAddress: string;
}

export default function AdminMembershipManagement({ currentUser }: { currentUser: any }) {
  const [users, setUsers] = useState<PremiumUser[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingUser, setEditingUser] = useState<PremiumUser | null>(null);
  const [newLimit, setNewLimit] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'x-admin-email': currentUser.email
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/premium/users`, { headers: getHeaders() }),
        fetch(`${API_URL}/api/admin/premium/logs`, { headers: getHeaders() })
      ]);
      
      const usersData = await usersRes.json();
      const logsData = await logsRes.json();

      if (usersData.success) setUsers(usersData.users);
      if (logsData.success) setLogs(logsData.logs);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Failed to load premium membership data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (userEmail: string, action: string, limit?: number) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/premium/update-membership`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userEmail, action, newLimit: limit })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchData();
        setEditingUser(null);
      } else {
        toast.error(data.error || 'Action failed.');
      }
    } catch (err) {
      toast.error('Failed to execute action.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-[var(--brand)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-5 rounded-xl border border-border shadow-sm">
        <div>
          <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-xl font-bold text-foreground">Premium Memberships</h2>
          <p className="text-sm text-muted-foreground mt-1">Strictly control user limits, payment statuses, and membership tiers.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-secondary border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--brand)] outline-none"
          />
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Membership</th>
                <th className="px-6 py-4 font-semibold">Payment</th>
                <th className="px-6 py-4 font-semibold">Assessments Limit / Used</th>
                <th className="px-6 py-4 font-semibold text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((u) => (
                <tr key={u._id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-foreground">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      u.membershipType === 'PREMIUM' || u.isPremium ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {u.membershipType === 'PREMIUM' || u.isPremium ? 'PREMIUM' : 'FREE'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      u.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                      u.paymentStatus === 'pending' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {u.paymentStatus || 'UNPAID'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{u.assessmentLimit || 1} Total</span>
                      <span className="text-xs text-muted-foreground">({u.assessmentAttemptCount || 0} Used)</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {u.membershipType !== 'PREMIUM' && !u.isPremium ? (
                        <button onClick={() => handleAction(u.email, 'UPGRADE')} className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-md transition-colors tooltip-trigger" title="Upgrade to Premium">
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => handleAction(u.email, 'DOWNGRADE')} className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-md transition-colors tooltip-trigger" title="Downgrade to Free">
                          <Database className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button onClick={() => {
                        setEditingUser(u);
                        setNewLimit(u.assessmentLimit || 1);
                      }} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors tooltip-trigger" title="Edit Assessment Limit">
                        <Edit className="w-4 h-4" />
                      </button>

                      <button onClick={() => handleAction(u.email, 'RESET_COUNT')} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors tooltip-trigger" title="Reset Assessment Count">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border bg-secondary/30 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[var(--brand)]" />
          <h3 style={{ fontFamily: 'var(--font-head)' }} className="font-bold text-foreground">Admin Audit Trail</h3>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/50 border-b border-border sticky top-0">
              <tr>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Admin</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Target User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--brand)]">{log.adminEmail}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold tracking-wider">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{log.targetUser}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No audit logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Limit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-md w-full border border-border shadow-2xl overflow-hidden animate-scaleIn">
            <div className="flex justify-between items-center p-5 border-b border-border bg-secondary/50">
              <h3 style={{ fontFamily: 'var(--font-head)' }} className="font-bold text-lg text-foreground">Update Assessment Limit</h3>
              <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-muted rounded-md transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">User</label>
                <input type="text" value={editingUser.email} disabled className="w-full px-4 py-2.5 rounded-lg border border-border bg-secondary text-foreground text-sm opacity-70 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">New Limit</label>
                <input 
                  type="number" 
                  min="0"
                  value={newLimit} 
                  onChange={(e) => setNewLimit(parseInt(e.target.value) || 0)} 
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] transition-colors outline-none" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-border bg-secondary/30">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 rounded-lg font-semibold text-sm border border-border bg-white text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => handleAction(editingUser.email, 'UPDATE_LIMIT', newLimit)} className="px-4 py-2 rounded-lg font-semibold text-sm bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)] transition-colors">Save Limit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
