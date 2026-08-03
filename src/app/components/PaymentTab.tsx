import React, { useState, useEffect } from 'react';
import { CreditCard, ShieldCheck, CheckCircle2, AlertCircle, History, Landmark, DollarSign, Calendar, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../config';

interface UserData {
  name: string;
  email: string;
  isPremium?: boolean;
  paymentStatus?: string;
  paymentCount?: number;
  transactionId?: string;
  paymentDate?: string;
}

interface PaymentRecord {
  transactionId: string;
  amount: number;
  status: string;
  createdAt: string;
}

export default function PaymentTab({ 
  user, 
  onUserUpdate,
  onTabChange 
}: { 
  user: UserData; 
  onUserUpdate: (updatedUser: any) => void;
  onTabChange: (tab: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [premiumPrice, setPremiumPrice] = useState<number>(50);

  // Form State
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/payments/history?email=${encodeURIComponent(user.email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setHistory(data.payments || []);
        }
      }
    } catch (e) {
      console.error('Failed to fetch payment history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchPremiumPrice = async () => {
    try {
      const res = await fetch(`${API_URL}/api/payments/premium-price`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.price) {
          setPremiumPrice(data.price.premiumPrice);
        }
      }
    } catch (e) {
      console.error('Failed to fetch premium price:', e);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchPremiumPrice();
  }, [user.email]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((user.paymentCount || 0) >= 2) {
      toast.error('Maximum payment limit reached.');
      return;
    }

    setLoading(true);

    try {
      const res = await loadRazorpayScript();
      if (!res) {
        toast.error('Razorpay SDK failed to load. Are you online?');
        setLoading(false);
        return;
      }

      // Create Order
      const createOrderRes = await fetch(`http://localhost:8080/api/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: premiumPrice,
          currency: 'INR',
          userId: user.email
        })
      });

      const orderData = await createOrderRes.json();
      if (!createOrderRes.ok) {
        toast.error(orderData.error || 'Failed to create order');
        setLoading(false);
        return;
      }

      const options = {
        key: 'rzp_live_TLBGftRr6F3ORB', // Read from environment in real scenario
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: 'SkillSwap Premium',
        description: 'Premium Tier Upgrade',
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch(`http://localhost:8080/api/payment/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
                userId: user.email,
                amount: premiumPrice
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.status === 'SUCCESS') {
              import('canvas-confetti').then((confetti) => {
                confetti.default({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
              });
              toast.success('Payment processed successfully! Premium active.');
              
              // Refresh user context if needed, but per prompt redirect immediately
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 2000);
            } else {
              toast.error('Payment verification failed.');
            }
          } catch (err) {
            toast.error('Payment verification error.');
          }
        },
        prefill: {
          name: cardName || user.name,
          email: user.email,
        },
        theme: {
          color: '#f59e0b',
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();

    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Could not connect to payment gateway.');
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    }
    return v;
  };

  const isPremiumActive = user.isPremium || user.paymentStatus === 'paid' || (user as any).membershipType === 'PREMIUM';
  const isMaxedOut = (user.paymentCount || 0) >= 2;

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 text-white p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner ${
            isPremiumActive 
              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400' 
              : 'bg-amber-950/50 border-amber-500/30 text-amber-400'
          }`}>
            {isPremiumActive ? <ShieldCheck className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Premium Subscription status: 
              <span className={`text-sm px-2.5 py-0.5 rounded-full font-bold border ${
                isPremiumActive 
                  ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400' 
                  : 'bg-amber-950/60 border-amber-500/30 text-amber-400'
              }`}>
                {isPremiumActive ? 'Active' : 'Unpaid'}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {isPremiumActive 
                ? 'Your premium access is unlocked! Enjoy unlimited assessments and features.' 
                : 'Unlock assessments, certified features, and premium chatbot services.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-300">
          <span>Successful Payments:</span>
          <span className="text-amber-400 font-bold">{user.paymentCount || 0} / 2</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Payment Checkout Panel */}
        <div className="lg:col-span-7 bg-[#1e1e2d] border border-zinc-800 p-6 rounded-2xl shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
              <h3 className="font-bold text-white flex items-center gap-2 text-base">
                <CreditCard className="w-5 h-5 text-amber-500" />
                Premium Access Checkout
              </h3>
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-emerald-500" /> 256-bit Encrypted Connection
              </span>
            </div>

            <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-4 mb-6 text-zinc-300">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-white text-sm">SkillSwap Premium Tier Upgrade</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">Lifetime platform assessment features</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-emerald-400">₹{premiumPrice.toFixed(2)}</div>
                  <div className="text-[10px] text-zinc-500">One-time payment</div>
                </div>
              </div>
            </div>

            {isMaxedOut ? (
              <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4 text-center text-red-300 space-y-2 mb-6">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
                <h4 className="font-bold text-sm">Maximum payment limit reached.</h4>
                <p className="text-xs text-red-400/80">
                  You have successfully completed 2 online payments.
                </p>
              </div>
            ) : (
              <form onSubmit={handlePay} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Cardholder Name</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={cardName}
                    onChange={e => setCardName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-zinc-800 rounded-lg bg-zinc-950 text-white text-sm outline-none focus:border-amber-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Card Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                      value={cardNumber}
                      onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                      className="w-full pl-4 pr-10 py-2.5 border border-zinc-800 rounded-lg bg-zinc-950 text-white text-sm outline-none focus:border-amber-500 transition-colors font-mono"
                      required
                    />
                    <div className="absolute right-3 top-3 text-zinc-600">
                      <CreditCard className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Expiry Date</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      maxLength={5}
                      value={expiry}
                      onChange={e => setExpiry(formatExpiry(e.target.value))}
                      className="w-full px-4 py-2.5 border border-zinc-800 rounded-lg bg-zinc-950 text-white text-sm outline-none focus:border-amber-500 transition-colors font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">CVV / CVC</label>
                    <input
                      type="password"
                      placeholder="•••"
                      maxLength={3}
                      value={cvv}
                      onChange={e => setCvv(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-4 py-2.5 border border-zinc-800 rounded-lg bg-zinc-950 text-white text-sm outline-none focus:border-amber-500 transition-colors font-mono"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing Checkout...
                    </>
                  ) : (
                    <>
                      Pay ₹{premiumPrice.toFixed(2)} Securely
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Payment History Panel */}
        <div className="lg:col-span-5 bg-[#1a1a24] border border-zinc-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <History className="w-4 h-4 text-amber-500" />
                Transaction History
              </h3>
            </div>

            {historyLoading ? (
              <div className="text-center py-12 text-xs text-zinc-500">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Retrieving history logs...
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-xs text-zinc-500">
                No past transactions registered.
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {history.map((record, index) => (
                  <div key={index} className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-xl flex items-center justify-between text-xs hover:bg-zinc-900 transition-colors">
                    <div>
                      <div className="font-semibold text-white">{record.transactionId}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {new Date(record.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400">₹{record.amount.toFixed(2)}</div>
                      <div className="text-[9px] text-zinc-500 flex items-center gap-0.5 justify-end">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Successful
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
