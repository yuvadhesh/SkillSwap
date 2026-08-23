import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Play, CheckCircle, Clock, Star, LayoutDashboard, Settings2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../config.js';
import AssessmentCreation from './AssessmentCreation';
import AssessmentRunner from './AssessmentRunner';
import QuestionManagement from './QuestionManagement';

interface AssessmentTabProps {
  user: any;
  requests: any;
  onUpgradeRequested?: () => void;
}

export default function AssessmentTab({ user, requests, onUpgradeRequested }: AssessmentTabProps) {
  const [activeView, setActiveView] = useState<'dashboard' | 'create' | 'questions' | 'runner'>('dashboard');
  const [dashboardData, setDashboardData] = useState<{ created: any[]; assigned: any[]; completed: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeAssessment, setActiveAssessment] = useState<any>(null);
  const [adminSettings, setAdminSettings] = useState<{ assessmentCreationAccess: string; assessmentWritingAccess: string } | null>(null);

  const isUserPremium = user?.isPremium || user?.paymentStatus === 'paid' || user?.membershipType === 'PREMIUM';

  // Accepted swaps — handle requests as { incoming, outgoing } or array
  const allRequests = Array.isArray(requests)
    ? requests
    : [...(requests?.incoming || []), ...(requests?.outgoing || [])];

  const acceptedSwaps = allRequests.filter(
    (req) =>
      req.status === 'accepted' &&
      (req.sender === user?.email || req.receiver === user?.email)
  );

  useEffect(() => {
    // Fetch admin settings to determine access policies
    fetch(`${API_URL}/api/admin/settings`)
      .then(r => r.json())
      .then(data => { if (data.success && data.settings) setAdminSettings(data.settings); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeView === 'dashboard') {
      fetchDashboardData();
    }
  }, [activeView]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(
        `${API_URL}/api/assessments/dashboard?email=${encodeURIComponent(user.email)}`
      );
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setDashboardData(data.data);
      } else {
        setLoadError(data.error || 'Failed to load dashboard data.');
      }
    } catch (err: any) {
      console.error(err);
      setLoadError('Could not reach the server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAssessment = (assessment: any) => {
    setActiveAssessment(assessment);
    setActiveView('runner');
  };

  const handleManageQuestions = (assessment: any) => {
    setActiveAssessment(assessment);
    setActiveView('questions');
  };

  const handleDeleteAssessment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assessment? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_URL}/api/assessments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDashboardData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete assessment');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete assessment');
    }
  };

  const handleHideAssessment = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/assessments/${id}/hide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email }),
      });
      if (res.ok) {
        toast.success('Assessment removed from your list.');
        fetchDashboardData();
      } else {
        toast.error('Failed to hide assessment.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to hide assessment.');
    }
  };

  // --- Sub-views ---
  if (activeView === 'create') {
    return (
      <AssessmentCreation
        user={user}
        acceptedSwaps={acceptedSwaps}
        onBack={() => setActiveView('dashboard')}
        onCreated={(assessment) => {
          toast.success('Assessment created! Now add questions.');
          setActiveAssessment(assessment);
          setActiveView('questions');
        }}
      />
    );
  }

  if (activeView === 'questions' && activeAssessment) {
    return (
      <QuestionManagement
        assessment={activeAssessment}
        onBack={() => {
          setActiveAssessment(null);
          setActiveView('dashboard');
        }}
      />
    );
  }

  if (activeView === 'runner' && activeAssessment) {
    return (
      <AssessmentRunner
        assessment={activeAssessment}
        user={user}
        onExit={() => {
          setActiveAssessment(null);
          setActiveView('dashboard');
        }}
      />
    );
  }

  // --- Dashboard ---
  return (
    <div style={{ minHeight: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BookOpen style={{ width: 28, height: 28, color: 'var(--color-accent)' }} />
            Online Assessment
          </h1>
          <p style={{ color: '#4b5563', margin: '6px 0 0' }}>Validate skills through secure testing</p>
        </div>
        {adminSettings?.assessmentCreationAccess === 'PREMIUM' && !isUserPremium ? (
          <button
            onClick={() => onUpgradeRequested?.()}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            🔒 Upgrade to Create
          </button>
        ) : (
          <button
            onClick={() => setActiveView('create')}
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            <Plus style={{ width: 18, height: 18 }} />
            Create Assessment
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '4px solid var(--color-accent)',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {/* Error */}
      {!loading && loadError && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '12px', padding: '20px', color: '#fca5a5', textAlign: 'center'
        }}>
          <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Failed to load assessments</p>
          <p style={{ margin: '0 0 12px', fontSize: '14px', opacity: 0.8 }}>{loadError}</p>
          <button onClick={fetchDashboardData} style={{
            background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)',
            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
          }}>Retry</button>
        </div>
      )}

      {/* Content */}
      {!loading && !loadError && dashboardData && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <StatCard
              icon={<LayoutDashboard style={{ width: 22, height: 22, color: '#60a5fa' }} />}
              title="Assigned to You"
              value={dashboardData.assigned.length}
            />
            <StatCard
              icon={<CheckCircle style={{ width: 22, height: 22, color: '#4ade80' }} />}
              title="Completed"
              value={dashboardData.completed.length}
            />
            <StatCard
              icon={<Settings2 style={{ width: 22, height: 22, color: '#c084fc' }} />}
              title="Created by You"
              value={dashboardData.created.length}
            />
            <StatCard
              icon={<Star style={{ width: 22, height: 22, color: '#facc15' }} />}
              title="Average Score"
              value={averageScore(dashboardData.completed)}
              suffix="%"
            />
          </div>

          {/* Two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

            {/* Available to Take */}
            <Panel title="Available to Take" icon={<Clock style={{ width: 18, height: 18, color: '#60a5fa' }} />}>
              {adminSettings?.assessmentWritingAccess === 'PREMIUM' && !isUserPremium ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>
                    🔒 Attempting assessments requires a Premium subscription.
                  </p>
                  <button
                    onClick={() => onUpgradeRequested?.()}
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    Upgrade to Premium
                  </button>
                </div>
              ) : dashboardData.assigned.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0', fontSize: '14px' }}>
                  No assessments assigned to you yet.
                </p>
              ) : (
                dashboardData.assigned.map((a: any) => (
                  <AssessmentCard
                    key={a._id}
                    assessment={a}
                    onAction={() => handleStartAssessment(a)}
                    actionLabel="Start"
                    actionColor="#3b82f6"
                    onHide={() => handleHideAssessment(a._id)}
                  />
                ))
              )}
            </Panel>

            {/* Your Assessments */}
            <Panel title="Your Assessments" icon={<ShieldCheck style={{ width: 18, height: 18, color: '#c084fc' }} />}>
              {dashboardData.created.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0', fontSize: '14px' }}>
                  You haven't created any assessments yet.
                </p>
              ) : (
                dashboardData.created.map((a: any) => (
                  <div key={a._id} style={{
                    background: '#f9fafb', border: '1px solid #e5e7eb',
                    borderRadius: '12px', padding: '16px', marginBottom: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <h3 style={{ color: '#111827', fontWeight: 700, margin: 0, fontSize: '15px' }}>{a.name}</h3>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                        background: a.status === 'published' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                        color: a.status === 'published' ? '#4ade80' : '#facc15',
                      }}>
                        {a.status.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ color: '#4b5563', fontSize: '13px', margin: '0 0 10px' }}>
                      Skill: <span style={{ color: '#c084fc' }}>{a.skill}</span>
                    </p>
                    {a.status === 'draft' ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => handleManageQuestions(a)} style={{
                          background: '#fff', color: '#111827', border: '1px solid #d1d5db',
                          padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                        }}>
                          Manage Questions
                        </button>
                        <button onClick={() => handleDeleteAssessment(a._id)} style={{
                          background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none',
                          padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                        }}>
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => handleDeleteAssessment(a._id)} style={{
                          background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none',
                          padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                        }}>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </Panel>
          </div>

          {/* Previous Results */}
          <Panel title="Previous Results" icon={<Star style={{ width: 18, height: 18, color: '#facc15' }} />}>
            {dashboardData.completed.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0', fontSize: '14px' }}>
                No completed assessments yet.
              </p>
            ) : (
              dashboardData.completed.map((attempt: any) => (
                <div key={attempt._id} style={{
                  background: '#f9fafb', border: '1px solid #e5e7eb',
                  borderRadius: '12px', padding: '16px', marginBottom: '12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{ color: '#111827', fontWeight: 700, margin: '0 0 4px', fontSize: '15px' }}>
                      {attempt.assessmentId?.name || 'Assessment'}
                    </h3>
                    <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
                      {attempt.endTime ? new Date(attempt.endTime).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>
                      {typeof attempt.percentage === 'number' ? attempt.percentage.toFixed(1) : '0.0'}%
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: attempt.passed ? '#4ade80' : '#f87171' }}>
                      {attempt.passed ? 'PASSED' : 'FAILED'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

// ---- Small helpers ----

function StatCard({ icon, title, value, suffix = '' }: { icon: React.ReactNode; title: string; value: number | string; suffix?: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px'
    }}>
      <div style={{ padding: '10px', background: '#f3f4f6', borderRadius: '10px' }}>{icon}</div>
      <div>
        <p style={{ color: '#4b5563', fontSize: '13px', margin: '0 0 2px' }}>{title}</p>
        <p style={{ color: '#111827', fontSize: '22px', fontWeight: 800, margin: 0 }}>{value}{suffix}</p>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      borderRadius: '20px', padding: '24px'
    }}>
      <h2 style={{ color: '#111827', fontWeight: 700, fontSize: '16px', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function AssessmentCard({ assessment, onAction, actionLabel, actionColor, onHide }: {
  assessment: any; onAction: () => void; actionLabel: string; actionColor: string; onHide?: () => void;
}) {
  return (
    <div style={{
      background: '#f9fafb', border: '1px solid #e5e7eb',
      borderRadius: '12px', padding: '16px', marginBottom: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <h3 style={{ color: '#111827', fontWeight: 700, margin: 0, fontSize: '15px' }}>{assessment.name}</h3>
        <span style={{ color: '#4b5563', fontSize: '12px', background: '#e5e7eb', padding: '2px 8px', borderRadius: '6px' }}>
          {assessment.duration} min
        </span>
      </div>
      <p style={{ color: '#4b5563', fontSize: '13px', margin: '0 0 12px' }}>
        Skill: <span style={{ color: '#60a5fa' }}>{assessment.skill}</span>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#4b5563', fontSize: '12px' }}>By: {assessment.creator}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onHide && (
            <button
              onClick={onHide}
              title="Remove from list"
              style={{
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)',
                padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              🗑 Remove
            </button>
          )}
          <button onClick={onAction} style={{
            background: actionColor + '22', color: actionColor, border: `1px solid ${actionColor}44`,
            padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
            fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <Play style={{ width: 14, height: 14 }} /> {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function averageScore(completed: any[]): string {
  if (!completed || completed.length === 0) return '0';
  const sum = completed.reduce((acc, c) => acc + (c.percentage || 0), 0);
  return (sum / completed.length).toFixed(1);
}
