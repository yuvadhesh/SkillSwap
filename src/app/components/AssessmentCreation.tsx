import React, { useState } from 'react';
import { ArrowLeft, Save, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../config.js';

interface AssessmentCreationProps {
  user: any;
  acceptedSwaps: any[];
  onBack: () => void;
  onCreated: (assessment: any) => void;
}

export default function AssessmentCreation({ user, acceptedSwaps, onBack, onCreated }: AssessmentCreationProps) {
  const [formData, setFormData] = useState({
    partner: '',
    skill: '',
    name: '',
    instructions: '',
    duration: 30,
    passingPercentage: 60,
    negativeMarking: false,
    questionCount: 10,
    randomize: true,
    allowedAttempts: 1,
    certificateEligible: true,
    requireCamera: false,
    requireMic: false,
    premiumPolicy: {
      requirePremium: false,
      firstAttemptFree: true
    }
  });

  const [loading, setLoading] = useState(false);
  const [showPremiumPrompt, setShowPremiumPrompt] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partner || !formData.skill || !formData.name) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/assessments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          creator: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        onCreated(data.data);
      } else {
        if (data.error === 'PREMIUM_REQUIRED') {
          setShowPremiumPrompt(true);
        } else {
          toast.error(data.error || 'Failed to create assessment');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      if (name.startsWith('premiumPolicy.')) {
        const field = name.split('.')[1];
        setFormData(prev => ({
          ...prev,
          premiumPolicy: {
            ...prev.premiumPolicy,
            [field]: checked
          }
        }));
      } else {
        setFormData(prev => ({ ...prev, [name]: checked }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
    }
  };

  // Get list of unique partners from accepted swaps
  const partners = Array.from(new Set(acceptedSwaps.map(req => req.sender === user.email ? req.receiver : req.sender)));

  return (
    <div className="h-full flex flex-col p-6 animate-fade-in max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <div>
          <h1 className="text-[32px] font-extrabold text-gray-900 tracking-tight">Create Assessment</h1>
          <p className="text-gray-500">Configure settings for your skill swap partner</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm p-8 rounded-2xl flex-1 overflow-y-auto custom-scrollbar">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Assign To Partner *</label>
              <select
                name="partner"
                value={formData.partner}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[var(--color-accent)] transition-colors appearance-none"
                required
              >
                <option value="">Select a partner</option>
                {partners.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Skill Being Tested *</label>
              <input
                type="text"
                name="skill"
                value={formData.skill}
                onChange={handleChange}
                placeholder="e.g. React.js, Python"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Assessment Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Advanced Python Concepts"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Instructions (Optional)</label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleChange}
              placeholder="Rules and guidelines for the learner..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[var(--color-accent)] transition-colors min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Duration (Minutes) *</label>
              <input
                type="number"
                name="duration"
                min="5"
                value={formData.duration}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Passing % *</label>
              <input
                type="number"
                name="passingPercentage"
                min="1"
                max="100"
                value={formData.passingPercentage}
                onChange={handleChange}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Allowed Attempts *</label>
              <input
                type="number"
                name="allowedAttempts"
                min="1"
                value={formData.allowedAttempts}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                name="randomize"
                checked={formData.randomize}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-400 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span className="text-gray-900 font-medium">Randomize Questions</span>
            </label>

            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                name="negativeMarking"
                checked={formData.negativeMarking}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-400 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span className="text-gray-900 font-medium">Enable Negative Marking (25%)</span>
            </label>
            
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                name="certificateEligible"
                checked={formData.certificateEligible}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-400 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span className="text-gray-900 font-medium">Issue Certificate on Pass</span>
            </label>

            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors md:col-span-1">
              <input
                type="checkbox"
                name="requireCamera"
                checked={formData.requireCamera}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-400 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span className="text-gray-900 font-medium">Require Camera Proctoring</span>
            </label>

            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors md:col-span-1">
              <input
                type="checkbox"
                name="requireMic"
                checked={formData.requireMic}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-400 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span className="text-gray-900 font-medium">Require Microphone Proctoring</span>
            </label>
          </div>


          <div className="pt-6 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-[var(--color-accent)] hover:bg-[#1a6b4a] text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
              Save & Continue
            </button>
          </div>

        </form>
      </div>

      {showPremiumPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#1a1a24] border border-yellow-500/30 shadow-2xl shadow-yellow-900/20 rounded-2xl p-8 max-w-md w-full relative">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-center text-white mb-2">Access Restricted</h2>
            <p className="text-gray-300 text-center mb-8">
              Your first assessment was free! Your account currently has a usage limit applied by the administrator. Please contact an admin to enable unlimited access.
            </p>
            
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => setShowPremiumPrompt(false)}
                className="px-6 py-2.5 rounded-xl text-gray-300 hover:bg-white/10 font-medium transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setShowPremiumPrompt(false);
                  onBack();
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold shadow-lg shadow-amber-900/50 transition-all"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
