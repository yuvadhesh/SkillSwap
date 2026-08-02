import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Users, Search, RefreshCw, CheckCircle2, History } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../config';

interface PaymentRecord {
  _id?: string;
  email: string;
  transactionId: string;
  amount: number;
  status: string;
  createdAt: string;
}

export default function AdminPaymentManagement({ 
  addLog 
}: { 
  addLog: (msg: string) => void 
}) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      addLog('Fetching global payment records...');
      const res = await fetch(`${API_URL}/api/payments/admin/all`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPayments(data.payments || []);
          addLog(`Synchronized ${data.payments.length} payment records.`);
        } else {
          throw new Error('API failed to return payments.');
        }
      } else {
        throw new Error('Failed response code.');
      }
    } catch (e: any) {
      console.error(e);
      addLog(`[ERROR] Failed to fetch payments: ${e.message}`);
      toast.error('Could not load payments database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Filter payments by email
  const filteredPayments = payments.filter(p => 
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.transactionId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPayments = payments.length;
  const totalRevenue = payments.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-950 to-emerald-800 text-white p-5 rounded-xl border border-emerald-900 shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-200/80 mb-2">Total System Revenue</div>
          <div style={{ fontFamily: 'var(--font-head)' }} className="text-3xl font-extrabold flex items-center gap-0.5">
            <DollarSign className="w-6 h-6 inline text-emerald-200" />
            {totalRevenue.toFixed(2)}
          </div>
          <p className="text-[11px] text-emerald-200/70 mt-2 flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5" /> Lifetime sales generated
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-950 to-amber-800 text-white p-5 rounded-xl border border-amber-900 shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-widest text-amber-200/80 mb-2">Total Transaction Count</div>
          <div style={{ fontFamily: 'var(--font-head)' }} className="text-3xl font-extrabold">{totalPayments}</div>
          <p className="text-[11px] text-amber-200/70 mt-2 flex items-center gap-1">
            <History className="w-3.5 h-3.5" /> Successful checkouts completed
          </p>
        </div>

        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white p-5 rounded-xl border border-zinc-700 shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-300 mb-2">Platform Fee (Fixed)</div>
          <div style={{ fontFamily: 'var(--font-head)' }} className="text-3xl font-extrabold">$49.00</div>
          <p className="text-[11px] text-zinc-400 mt-2 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Pay-per-unlock premium license
          </p>
        </div>
      </div>

      {/* Payment Directory Panel */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Controls */}
        <div className="p-4 bg-secondary/35 border-b border-border flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search transactions by email or transaction ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm outline-none focus:border-[var(--brand)] transition-colors text-foreground"
            />
          </div>
          
          <button 
            onClick={fetchPayments} 
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold border border-border bg-secondary hover:bg-muted text-foreground cursor-pointer transition-colors min-h-[44px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--brand)]" />
              Retrieving database transactions...
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No transactions registered matching search criteria.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="bg-secondary/40 text-muted-foreground uppercase font-bold border-b border-border text-[10px] tracking-wider">
                  <th className="p-4">Learner Email</th>
                  <th className="p-4">Transaction ID</th>
                  <th className="p-4 text-center">Amount Paid</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Payment Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayments.map((p) => (
                  <tr key={p._id} className="hover:bg-secondary/15 transition-colors">
                    <td className="p-4 font-semibold text-foreground">{p.email}</td>
                    <td className="p-4 font-mono text-zinc-600 select-all">{p.transactionId}</td>
                    <td className="p-4 text-center font-bold text-emerald-600">${p.amount.toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Success
                      </span>
                    </td>
                    <td className="p-4 text-right text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
