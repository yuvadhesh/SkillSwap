import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { API_URL } from '../../config';
import { Shield, Settings, Lock, ShieldAlert } from 'lucide-react';

interface AdminSettings {
  assessmentCreationAccess: 'FREE' | 'PREMIUM';
  assessmentWritingAccess: 'FREE' | 'PREMIUM';
  freeAssessmentLimit: number;
  premiumAssessmentLimit: number;
  maxTabSwitches: number;
  maxFullscreenExits: number;
  maxCopyAttempts: number;
  maxAiDetectionWarnings: number;
  autoSubmit: boolean;
  terminateAssessment: boolean;
}

export default function AdminPremiumAccessSettings({ adminEmail, onAddLog }: { adminEmail: string, onAddLog: (log: string) => void }) {
  const [settings, setSettings] = useState<AdminSettings>({
    assessmentCreationAccess: 'FREE',
    assessmentWritingAccess: 'FREE',
    freeAssessmentLimit: 1,
    premiumAssessmentLimit: 9999,
    maxTabSwitches: 3,
    maxFullscreenExits: 2,
    maxCopyAttempts: 3,
    maxAiDetectionWarnings: 1,
    autoSubmit: true,
    terminateAssessment: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      let res;
      try {
        res = await fetch('/api/admin/settings');
      } catch (err) {
        res = await fetch(`${API_URL}/api/admin/settings`);
      }
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings({
          assessmentCreationAccess: data.settings.assessmentCreationAccess || 'FREE',
          assessmentWritingAccess: data.settings.assessmentWritingAccess || 'FREE',
          freeAssessmentLimit: data.settings.freeAssessmentLimit ?? 1,
          premiumAssessmentLimit: data.settings.premiumAssessmentLimit ?? 9999,
          maxTabSwitches: data.settings.maxTabSwitches ?? 3,
          maxFullscreenExits: data.settings.maxFullscreenExits ?? 2,
          maxCopyAttempts: data.settings.maxCopyAttempts ?? 3,
          maxAiDetectionWarnings: data.settings.maxAiDetectionWarnings ?? 1,
          autoSubmit: data.settings.autoSubmit ?? true,
          terminateAssessment: data.settings.terminateAssessment ?? true
        });
      }
    } catch (e) {
      console.error('Failed to fetch admin settings', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    onAddLog('Updating Assessment Access & Security Settings...');
    const payload = {
      ...settings,
      adminEmail: adminEmail || 'admin@skillswap.com'
    };

    try {
      let res;
      try {
        res = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        res = await fetch(`${API_URL}/api/admin/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Assessment Access & Security Settings updated successfully!');
        onAddLog('Assessment Access & Security Settings successfully updated.');
      } else {
        toast.error(data.error || 'Failed to update settings');
        onAddLog(`Failed to update settings: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error('Update settings error:', e);
      toast.error('Network error. Failed to update settings.');
      onAddLog(`Network error while updating settings.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading access settings...</div>;
  }

  return (
    <div className="bg-background border border-border rounded-lg shadow-sm space-y-6">
      <div className="p-6 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-[var(--brand)] flex items-center justify-center text-white">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-head)' }} className="text-lg font-bold text-foreground">Assessment Access &amp; Security Control</h2>
            <p className="text-sm text-muted-foreground">Manage membership access and proctoring security parameters globally.</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Section 1: Premium & Access Toggles */}
        <div className="space-y-4">
          <h3 style={{ fontFamily: 'var(--font-head)' }} className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2 border-b border-border pb-2">
            <Settings className="w-4 h-4 text-[var(--brand)]" /> Access &amp; Membership Rules
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Assessment Creation / Assignment Access</label>
              <select 
                value={settings.assessmentCreationAccess}
                onChange={(e) => setSettings({ ...settings, assessmentCreationAccess: e.target.value as 'FREE' | 'PREMIUM' })}
                className="w-full px-3 py-2 border border-border rounded-md bg-secondary text-foreground text-sm focus:border-[var(--brand)] focus:outline-none"
              >
                <option value="FREE">Free (All Users)</option>
                <option value="PREMIUM">Premium Only</option>
              </select>
              <p className="text-xs text-muted-foreground">If set to Premium Only, free users cannot create assessments.</p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Assessment Writing / Attempt Access</label>
              <select 
                value={settings.assessmentWritingAccess}
                onChange={(e) => setSettings({ ...settings, assessmentWritingAccess: e.target.value as 'FREE' | 'PREMIUM' })}
                className="w-full px-3 py-2 border border-border rounded-md bg-secondary text-foreground text-sm focus:border-[var(--brand)] focus:outline-none"
              >
                <option value="FREE">Free (All Users)</option>
                <option value="PREMIUM">Premium Only</option>
              </select>
              <p className="text-xs text-muted-foreground">If set to Premium Only, free users cannot attempt assessments.</p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Free User Creation Limit</label>
              <input 
                type="number"
                min="0"
                value={settings.freeAssessmentLimit}
                onChange={(e) => setSettings({ ...settings, freeAssessmentLimit: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-md bg-secondary text-foreground text-sm focus:border-[var(--brand)] focus:outline-none"
              />
              <p className="text-xs text-muted-foreground">Max assessments a Free user can create.</p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Premium User Creation Limit</label>
              <input 
                type="number"
                min="1"
                value={settings.premiumAssessmentLimit}
                onChange={(e) => setSettings({ ...settings, premiumAssessmentLimit: parseInt(e.target.value) || 9999 })}
                className="w-full px-3 py-2 border border-border rounded-md bg-secondary text-foreground text-sm focus:border-[var(--brand)] focus:outline-none"
              />
              <p className="text-xs text-muted-foreground">Max assessments a Premium user can create.</p>
            </div>
          </div>
        </div>

        {/* Section 2: Secure Assessment Mode Security Rules */}
        <div className="space-y-4 pt-4">
          <h3 style={{ fontFamily: 'var(--font-head)' }} className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2 border-b border-border pb-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" /> Secure Assessment Mode Security Thresholds
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Max Allowed Tab Switches</label>
              <input 
                type="number"
                min="1"
                value={settings.maxTabSwitches}
                onChange={(e) => setSettings({ ...settings, maxTabSwitches: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-border rounded-md bg-secondary text-foreground text-sm focus:border-[var(--brand)] focus:outline-none"
              />
              <p className="text-xs text-muted-foreground">Number of tab switch / blur warnings allowed before action.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Max Allowed Fullscreen Exits</label>
              <input 
                type="number"
                min="1"
                value={settings.maxFullscreenExits}
                onChange={(e) => setSettings({ ...settings, maxFullscreenExits: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-border rounded-md bg-secondary text-foreground text-sm focus:border-[var(--brand)] focus:outline-none"
              />
              <p className="text-xs text-muted-foreground">Number of fullscreen exits allowed before enforcement.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Max Allowed Copy / Shortcut Attempts</label>
              <input 
                type="number"
                min="1"
                value={settings.maxCopyAttempts}
                onChange={(e) => setSettings({ ...settings, maxCopyAttempts: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-border rounded-md bg-secondary text-foreground text-sm focus:border-[var(--brand)] focus:outline-none"
              />
              <p className="text-xs text-muted-foreground">Max context menu or copy/devtool shortcuts allowed.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Max AI Assistant Warnings</label>
              <input 
                type="number"
                min="1"
                value={settings.maxAiDetectionWarnings}
                onChange={(e) => setSettings({ ...settings, maxAiDetectionWarnings: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-border rounded-md bg-secondary text-foreground text-sm focus:border-[var(--brand)] focus:outline-none"
              />
              <p className="text-xs text-muted-foreground">Max AI extension/overlay detection warnings before action.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-secondary/20">
              <div>
                <label className="text-sm font-bold text-foreground block">Auto Submit on Excess Violations</label>
                <p className="text-xs text-muted-foreground">Automatically submit candidate test when limit is reached.</p>
              </div>
              <input 
                type="checkbox"
                checked={settings.autoSubmit}
                onChange={(e) => setSettings({ ...settings, autoSubmit: e.target.checked })}
                className="w-5 h-5 text-[var(--brand)] rounded border-border focus:ring-[var(--brand)] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-secondary/20">
              <div>
                <label className="text-sm font-bold text-foreground block">Terminate Assessment on Excess Violations</label>
                <p className="text-xs text-muted-foreground">Mark assessment as terminated due to policy violation.</p>
              </div>
              <input 
                type="checkbox"
                checked={settings.terminateAssessment}
                onChange={(e) => setSettings({ ...settings, terminateAssessment: e.target.checked })}
                className="w-5 h-5 text-[var(--brand)] rounded border-border focus:ring-[var(--brand)] cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-border bg-secondary/10 flex justify-end">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-mid)] text-white font-semibold text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? 'Saving Settings...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
