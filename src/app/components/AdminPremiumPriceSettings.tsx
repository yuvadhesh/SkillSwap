import React, { useState, useEffect } from 'react';
import { DollarSign, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../config';

interface AdminPremiumPriceSettingsProps {
  adminEmail: string;
}

export default function AdminPremiumPriceSettings({ adminEmail }: AdminPremiumPriceSettingsProps) {
  const [price, setPrice] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPrice();
  }, []);

  const fetchPrice = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/premium-price`);
      const data = await res.json();
      if (data.success && data.price) {
        setPrice(data.price.premiumPrice);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch premium price');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (price === '' || price < 0) {
      toast.error('Please enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/premium-price`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          premiumPrice: Number(price),
          adminEmail: adminEmail
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || 'Premium price updated successfully.');
      } else {
        toast.error(data.error || 'Failed to update premium price.');
      }
    } catch (err: any) {
      console.error('Price update error:', err);
      toast.error(err?.message || 'An error occurred while saving the price.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-zinc-400">Loading Premium Price Settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-amber-950/50 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <DollarSign className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Premium Price Settings
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </h2>
          <p className="text-sm text-zinc-400">
            Set the global premium membership price (INR).
          </p>
        </div>
      </div>

      <div className="bg-[#1e1e2d] border border-zinc-800 rounded-xl p-6 shadow-xl max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-zinc-400 mb-2">Premium Price (₹)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-zinc-500 font-bold">₹</span>
              </div>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full pl-8 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono text-lg focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="e.g., 499"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              This price will automatically update the payment page for all users.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || price === '' || price < 0}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-amber-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

