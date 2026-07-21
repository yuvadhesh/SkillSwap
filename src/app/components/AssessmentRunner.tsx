import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, Monitor, AlertTriangle, ShieldCheck, Play, ArrowRight, Save, Clock, Trophy, Download, Lock, CameraOff, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../config.js';
import CodingIDE from './CodingIDE';

// Global declaration for face-api.js loaded via CDN
declare const faceapi: any;

interface AssessmentRunnerProps {
  assessment: any;
  user: any;
  onExit: () => void;
}

export default function AssessmentRunner({ assessment, user, onExit }: AssessmentRunnerProps) {
  const [stage, setStage] = useState<'security-check' | 'running' | 'result'>('security-check');

  // Security Check state — camera and mic separate
  const [camGranted, setCamGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [camEnabled, setCamEnabled] = useState(true);   // admin can disable
  const [micEnabled, setMicEnabled] = useState(true);   // admin can disable
  const [checking, setChecking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);          // 0-100 mic volume
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceWarnings, setFaceWarnings] = useState(0);

  // Separate refs for camera stream and mic stream
  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const floatingVideoRef = useRef<HTMLVideoElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef = useRef<number>(0);
  const faceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceWarningsRef = useRef<number>(0);

  // Keep legacy streamRef alias for submit cleanup
  const streamRef = useRef<MediaStream | null>(null);

  // Attempt data
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);

  // Timer
  const [timeLeft, setTimeLeft] = useState(assessment.duration * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageRef = useRef<string>('security-check');
  const attemptIdRef = useRef<string | null>(null);
  const answersRef = useRef<any[]>([]);
  const violationsRef = useRef<any[]>([]);

  // Result
  const [result, setResult] = useState<any>(null);

  // Keep refs in sync
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    violationsRef.current = violations;
  }, [violations]);
  useEffect(() => {
    faceWarningsRef.current = faceWarnings;
  }, [faceWarnings]);

  // Request camera + mic separately on mount
  useEffect(() => {
    requestCamera();
    requestMic();
    return () => {
      stopCamera();
      stopMic();
    };
  }, []);

  // Attach cam stream to floating video when stage becomes running
  useEffect(() => {
    if (stage === 'running' && camGranted && camStreamRef.current && floatingVideoRef.current) {
      floatingVideoRef.current.srcObject = camStreamRef.current;
    }
  }, [stage, camGranted]);

  const stopCamera = () => {
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current = null;
    streamRef.current = null;
  };

  const stopMic = () => {
    cancelAnimationFrame(micAnimFrameRef.current);
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
  };

  const requestCamera = async () => {
    setChecking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCamGranted(true);
      camStreamRef.current = stream;
      streamRef.current = stream; // alias
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Load AI models if camera is required
      if (assessment.requireCamera) {
        try {
          await faceapi.nets.tinyFaceDetector.loadFromUri('https://vladmandic.github.io/face-api/model');
          setModelsLoaded(true);
        } catch (e) {
          console.error("Failed to load face detection models", e);
          toast.error("Proctoring AI failed to load. Please disable adblockers or try again.");
        }
      }
    } catch {
      setCamGranted(false);
    } finally {
      setChecking(false);
    }
  };

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
      micStreamRef.current = stream;
      // Set up analyser for volume meter
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        micAnimFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setMicGranted(false);
    }
  };

  const handleStart = async () => {
    // Enforce required permissions
    if (assessment.requireCamera && !camGranted) {
      toast.error('Camera access is required for this assessment.');
      return;
    }
    if (assessment.requireMic && !micGranted) {
      toast.error('Microphone access is required for this assessment.');
      return;
    }

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      const res = await fetch(`${API_URL}/api/assessments/${assessment._id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learner: user.email }),
      });
      const data = await res.json();
      if (data.success) {
        setAttemptId(data.data.attempt._id);
        attemptIdRef.current = data.data.attempt._id;
        setQuestions(data.data.questions);
        setTimeLeft(assessment.duration * 60);
        setStage('running');
        stageRef.current = 'running';
        startTimer();
        setupExamListeners();
        if (assessment.requireCamera) startFaceTracking();
      } else {
        toast.error(data.message || data.error || 'Failed to start assessment');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
    } catch {
      toast.error('Could not start assessment. Check server connection.');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  };

  // ---- Exam Mode Listeners ----
  const setupExamListeners = () => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('paste', blockEvent);
    window.addEventListener('blur', onWindowBlur);
  };
  const removeExamListeners = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('contextmenu', blockEvent);
    document.removeEventListener('copy', blockEvent);
    document.removeEventListener('paste', blockEvent);
    window.removeEventListener('blur', onWindowBlur);
  };

  const blockEvent = (e: Event) => e.preventDefault();

  const onVisibilityChange = () => {
    if (document.hidden && stageRef.current === 'running') {
      doViolation('Tab Switched / Browser Minimized');
    }
  };
  const onFullscreenChange = () => {
    if (!document.fullscreenElement && stageRef.current === 'running') {
      doViolation('Exited Fullscreen');
    }
  };
  const onWindowBlur = () => {
    if (stageRef.current === 'running') {
      doViolation('Lost Window Focus');
    }
  };

  const doViolation = (type: string) => {
    const v = { type, time: new Date() };
    violationsRef.current = [...violationsRef.current, v];
    setViolations((prev) => [...prev, v]);
    toast.error(`Security Violation: ${type}. Submitting...`);
    submitAssessment(true);
  };

  // ---- Timer ----
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          submitAssessment(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ---- Face Tracking ----
  const startFaceTracking = () => {
    faceCheckIntervalRef.current = setInterval(async () => {
      if (stageRef.current !== 'running' || !floatingVideoRef.current || !modelsLoaded) return;
      
      const video = floatingVideoRef.current;
      if (video.videoWidth === 0) return; // not ready

      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
      
      if (detections.length !== 1) {
        const warningCount = faceWarningsRef.current + 1;
        setFaceWarnings(warningCount);
        
        if (warningCount >= 3) {
          doViolation(detections.length === 0 ? 'Face not detected (3rd Warning)' : 'Multiple faces detected (3rd Warning)');
        } else {
          toast.error(`Warning ${warningCount}/3: ${detections.length === 0 ? 'Face not detected' : 'Multiple faces detected'}. Please look at the camera.`);
        }
      }
    }, 3500); // Check every 3.5 seconds
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
      removeExamListeners();
    };
  }, []);

  // ---- Answering ----
  const currentQuestion = questions[currentIndex];

  const getSelectedAnswer = (): string | string[] => {
    if (!currentQuestion) return '';
    const ans = answers.find((a) => a.questionId === currentQuestion._id);
    if (!ans) return currentQuestion.type === 'MultipleAnswer' ? [] : '';
    return ans.selected;
  };

  const handleAnswerChange = (value: string | string[]) => {
    setAnswers((prev) => {
      const idx = prev.findIndex((a) => a.questionId === currentQuestion._id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx].selected = value;
        answersRef.current = updated;
        return updated;
      }
      const updated = [...prev, { questionId: currentQuestion._id, selected: value }];
      answersRef.current = updated;
      return updated;
    });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      submitAssessment(false);
    }
  };

  // ---- Submit ----
  const submitAssessment = async (terminated: boolean) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
    removeExamListeners();
    stageRef.current = 'result'; // Prevent further violations triggering

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }

    const currentAttemptId = attemptIdRef.current;
    if (!currentAttemptId) {
      toast.error('Attempt ID missing. Please contact support.');
      onExit();
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/assessments/attempt/${currentAttemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersRef.current,
          violations: violationsRef.current,
          terminated,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        setStage('result');
        if (terminated) {
          toast.error('Assessment terminated due to a policy violation.');
        } else {
          toast.success('Assessment submitted!');
        }
      } else {
        toast.error('Submission failed. Please contact support.');
        onExit();
      }
    } catch {
      toast.error('Network error during submission.');
      onExit();
    }
  };

  const generateCertificate = () => {
    const certWindow = window.open('', '_blank');
    if (!certWindow) {
      toast.error('Please allow popups to download the certificate.');
      return;
    }
    certWindow.document.write(`
      <html>
        <head>
          <title>Certificate - ${assessment.name}</title>
          <style>
            body { font-family: Georgia, serif; text-align: center; padding: 60px 40px; background: #f0f4f0; }
            .cert { border: 12px solid #2d9e6e; padding: 60px; background: #fff; max-width: 820px; margin: 0 auto; box-shadow: 0 8px 40px rgba(0,0,0,0.15); border-radius: 8px; }
            h1 { font-size: 48px; color: #2d9e6e; margin: 0 0 10px; }
            .subtitle { font-size: 18px; color: #666; margin-bottom: 40px; }
            .issued-to { font-size: 16px; color: #888; margin-bottom: 8px; }
            .name { font-size: 42px; font-weight: bold; color: #111; border-bottom: 2px solid #ccc; display: inline-block; padding: 0 24px 12px; margin: 0 0 30px; }
            .description { font-size: 18px; color: #444; margin: 0 0 6px; }
            .assessment-name { font-size: 26px; font-weight: bold; color: #222; margin: 0 0 30px; }
            .details { display: flex; justify-content: center; gap: 60px; color: #555; font-size: 15px; margin-bottom: 40px; }
            .footer { margin-top: 30px; font-style: italic; color: #aaa; font-size: 14px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="cert">
            <h1>Certificate of Completion</h1>
            <p class="subtitle">SkillSwap Learning Platform</p>
            <p class="issued-to">This certifies that</p>
            <div class="name">${user.name}</div>
            <p class="description">has successfully completed the assessment</p>
            <p class="assessment-name">${assessment.name}</p>
            <div class="details">
              <span>Skill: <strong>${assessment.skill}</strong></span>
              <span>Score: <strong>${result.percentage.toFixed(1)}%</strong></span>
              <span>Date: <strong>${new Date(result.endTime).toLocaleDateString()}</strong></span>
            </div>
            <div class="footer">Issued by SkillSwap Platform &mdash; Verified Skill Assessment</div>
          </div>
          <script>setTimeout(() => window.print(), 500);</script>
        </body>
      </html>
    `);
    certWindow.document.close();
  };

  // ============ VIEWS ============

  // --- Security Check ---
  if (stage === 'security-check') {
    return (
      <div className="h-full flex items-center justify-center p-6" style={{ background: 'var(--brand-dark)', minHeight: '100vh' }}>
        <div className="glass-panel p-8 rounded-2xl max-w-3xl w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <ShieldCheck className="w-14 h-14 mx-auto mb-3" style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-3xl font-extrabold text-white mb-1">Proctoring Setup</h2>
            <p className="text-gray-400">Allow camera &amp; microphone access before starting the assessment.</p>
          </div>

          {/* Camera + Mic side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">

            {/* Camera Card */}
            <div className="rounded-2xl border overflow-hidden"
              style={{ borderColor: camGranted ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)', background: 'rgba(0,0,0,0.4)' }}>
              {/* Title bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: camGranted ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', background: camGranted ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)' }}>
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5" style={{ color: camGranted ? '#4ade80' : '#f87171' }} />
                  <span className="text-white font-bold text-sm">
                    Camera
                    <span className="text-[10px] ml-2" style={{ color: assessment.requireCamera ? '#f87171' : '#6b7280' }}>
                      ({assessment.requireCamera ? 'Required' : 'Optional'})
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {assessment.requireCamera && modelsLoaded && (
                    <span className="text-[10px] text-green-400 font-bold bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">AI Ready</span>
                  )}
                  {assessment.requireCamera && !modelsLoaded && camGranted && (
                    <span className="text-[10px] text-yellow-400 font-bold flex items-center gap-1">
                      <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"/> Loading AI...
                    </span>
                  )}
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: camGranted ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: camGranted ? '#4ade80' : '#f87171' }}>
                    {camGranted ? 'LIVE ●' : 'DENIED'}
                  </span>
                </div>
              </div>
              {/* Preview */}
              <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
                {camGranted
                  ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <CameraOff className="w-10 h-10 text-gray-600" />
                      <p className="text-gray-500 text-sm">Camera not available</p>
                      <button onClick={requestCamera}
                        className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: 'var(--color-accent)', color: '#fff' }}>Grant Access</button>
                    </div>
                }
                {camGranted && (
                  <div className="absolute bottom-2 left-2 flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-[10px] font-bold">REC</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mic Card */}
            <div className="rounded-2xl border overflow-hidden flex flex-col"
              style={{ borderColor: micGranted ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)', background: 'rgba(0,0,0,0.4)' }}>
              {/* Title bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: micGranted ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', background: micGranted ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)' }}>
                <div className="flex items-center gap-2">
                  <Mic className="w-5 h-5" style={{ color: micGranted ? '#4ade80' : '#f87171' }} />
                  <span className="text-white font-bold text-sm">Microphone <span className="text-[10px] ml-2" style={{ color: assessment.requireMic ? '#f87171' : '#6b7280' }}>({assessment.requireMic ? 'Required' : 'Optional'})</span></span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: micGranted ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: micGranted ? '#4ade80' : '#f87171' }}>
                  {micGranted ? 'ACTIVE ●' : 'DENIED'}
                </span>
              </div>
              {/* Mic visualiser */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
                {micGranted ? (
                  <>
                    {/* Volume bar */}
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-xs">Input Level</span>
                        <span className="text-xs font-mono" style={{ color: micLevel > 60 ? '#4ade80' : micLevel > 20 ? '#facc15' : '#f87171' }}>{micLevel}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-75"
                          style={{
                            width: `${micLevel}%`,
                            background: micLevel > 60 ? '#4ade80' : micLevel > 20 ? '#facc15' : '#f87171'
                          }} />
                      </div>
                    </div>
                    {/* Animated bars */}
                    <div className="flex items-end gap-1 h-16">
                      {Array.from({ length: 20 }).map((_, i) => {
                        const h = micLevel > 0
                          ? Math.max(4, Math.min(64, (micLevel / 100) * 64 * (0.5 + Math.sin(i * 0.8 + Date.now() * 0.002) * 0.5)))
                          : 4;
                        return (
                          <div key={i} className="w-2 rounded-full transition-all duration-75"
                            style={{ height: `${h}px`, background: 'var(--color-accent)', opacity: 0.7 + (i % 3) * 0.1 }} />
                        );
                      })}
                    </div>
                    <p className="text-gray-400 text-xs">Speak to test your microphone</p>
                  </>
                ) : (
                  <>
                    <MicOff className="w-12 h-12 text-gray-600" />
                    <p className="text-gray-500 text-sm text-center">Microphone not available</p>
                    <button onClick={requestMic}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--color-accent)', color: '#fff' }}>Grant Access</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center gap-2">
              <span style={{ color: camGranted ? '#4ade80' : '#6b7280', fontSize: 18 }}>📷</span>
              <div>
                <p className="text-white text-xs font-bold">Camera</p>
                <p className="text-[10px]" style={{ color: camGranted ? '#4ade80' : (assessment.requireCamera ? '#f87171' : '#6b7280') }}>{camGranted ? 'Ready' : (assessment.requireCamera ? 'Required' : 'Optional')}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center gap-2">
              <span style={{ color: micGranted ? '#4ade80' : '#6b7280', fontSize: 18 }}>🎙️</span>
              <div>
                <p className="text-white text-xs font-bold">Microphone</p>
                <p className="text-[10px]" style={{ color: micGranted ? '#4ade80' : (assessment.requireMic ? '#f87171' : '#6b7280') }}>{micGranted ? 'Ready' : (assessment.requireMic ? 'Required' : 'Optional')}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-white text-xs font-bold">Fullscreen</p>
                <p className="text-[10px] text-yellow-400">On Start</p>
              </div>
            </div>
          </div>

          <div className="p-4 mb-6 rounded-xl flex items-start gap-3 text-left"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-200">
              <strong className="block mb-1">Strict Exam Policy</strong>
              Switching tabs, minimising the browser, or exiting fullscreen will <strong>immediately terminate</strong> your assessment.
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button onClick={onExit} className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={checking || (assessment.requireCamera && !camGranted) || (assessment.requireCamera && camGranted && !modelsLoaded) || (assessment.requireMic && !micGranted)}
              className="px-8 py-3 rounded-xl font-bold text-white flex items-center gap-2 transition-all disabled:opacity-50"
              style={{ background: 'var(--color-accent)' }}
            >
              <Play className="w-5 h-5" /> Start Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Running / Exam ---
  if (stage === 'running') {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const timerColor = timeLeft < 60 ? '#ef4444' : timeLeft < 300 ? '#f59e0b' : '#22c55e';

    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0f1115', userSelect: 'none' }}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            <span className="text-white font-bold">{assessment.name}</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Mic indicator in header */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
              {micGranted && micEnabled
                ? <Mic className="w-4 h-4 text-green-400" />
                : <MicOff className="w-4 h-4 text-red-400" />}
              <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-75"
                  style={{ width: `${micEnabled ? micLevel : 0}%`, background: '#4ade80' }} />
              </div>
            </div>
            {/* Timer */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg border font-mono font-bold"
              style={{ color: timerColor, borderColor: timerColor + '40', background: timerColor + '15' }}>
              <Clock className="w-5 h-5" />
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/10">
          <div
            className="h-full transition-all"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%`, background: 'var(--color-accent)' }}
          />
        </div>

        {/* Floating Camera Widget (bottom-right) */}
        {camGranted && camEnabled && (
          <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 items-end">
            {assessment.requireCamera && faceWarnings > 0 && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 text-xs px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-sm animate-pulse flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Warning {faceWarnings}/3: Face not detected clearly!
              </div>
            )}
            <div className="rounded-xl overflow-hidden shadow-2xl border-2 relative"
              style={{ width: 160, height: 100, borderColor: faceWarnings > 0 ? 'rgba(239,68,68,0.8)' : 'rgba(34,197,94,0.5)' }}>
              <video ref={floatingVideoRef} autoPlay playsInline muted
                className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              <div className="absolute top-1 left-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-[9px] font-bold shadow-black drop-shadow-md">LIVE {assessment.requireCamera ? ' (AI)' : ''}</span>
              </div>
            </div>
          </div>
        )}

        {/* Question */}
        <div className="flex-1 overflow-y-auto p-6 md:p-12 max-w-4xl mx-auto w-full">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-accent)' }}>
            Question {currentIndex + 1} of {questions.length}
          </p>
          <h2 className="text-2xl font-bold text-white leading-relaxed mb-2 whitespace-pre-wrap">
            {currentQuestion?.questionText}
          </h2>
          <div className="flex gap-4 text-sm text-gray-500 mb-8">
            <span>{currentQuestion?.type}</span>
            <span>{currentQuestion?.marks} Mark{currentQuestion?.marks !== 1 ? 's' : ''}</span>
            <span>{currentQuestion?.difficulty}</span>
          </div>

          {/* Answer options */}
          {(currentQuestion?.type === 'MCQ' || currentQuestion?.type === 'TrueFalse') && (
            <div className="space-y-3">
              {currentQuestion.options.map((opt: string, i: number) => {
                const sel = getSelectedAnswer() as string;
                const isSelected = sel === opt;
                return (
                  <button key={i} onClick={() => handleAnswerChange(opt)}
                    className="w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4"
                    style={{
                      background: isSelected ? 'rgba(45,158,110,0.15)' : 'rgba(255,255,255,0.04)',
                      borderColor: isSelected ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                      color: isSelected ? '#fff' : '#ccc',
                    }}>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: isSelected ? 'var(--color-accent)' : '#666' }}>
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-accent)' }} />}
                    </div>
                    <span className="text-lg">{opt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {currentQuestion?.type === 'MultipleAnswer' && (
            <div className="space-y-3">
              {currentQuestion.options.map((opt: string, i: number) => {
                const sel = (getSelectedAnswer() as string[]) || [];
                const isSelected = sel.includes(opt);
                return (
                  <button key={i}
                    onClick={() => {
                      const newVal = isSelected ? sel.filter((a) => a !== opt) : [...sel, opt];
                      handleAnswerChange(newVal);
                    }}
                    className="w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4"
                    style={{
                      background: isSelected ? 'rgba(45,158,110,0.15)' : 'rgba(255,255,255,0.04)',
                      borderColor: isSelected ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                      color: isSelected ? '#fff' : '#ccc',
                    }}>
                    <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: isSelected ? 'var(--color-accent)' : '#666',
                        background: isSelected ? 'var(--color-accent)' : 'transparent',
                      }}>
                      {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <span className="text-lg">{opt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {currentQuestion?.type === 'Coding' && (
            <div style={{ marginTop: '8px' }}>
              <CodingIDE
                question={currentQuestion}
                value={(getSelectedAnswer() as string) || ''}
                onChange={(code) => handleAnswerChange(code)}
              />
            </div>
          )}

          {/* Navigation */}
          <div className="mt-12 flex justify-end">
            <button onClick={handleNext}
              className="px-8 py-3 rounded-xl font-bold text-white flex items-center gap-2 transition-all hover:opacity-90"
              style={{ background: 'var(--color-accent)' }}>
              {currentIndex < questions.length - 1
                ? <><span>Save &amp; Next</span><ArrowRight className="w-5 h-5" /></>
                : <><span>Submit Assessment</span><Save className="w-5 h-5" /></>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Result ---
  if (stage === 'result' && result) {
    const timeTakenMs = new Date(result.endTime).getTime() - new Date(result.startTime).getTime();
    const timeTakenMins = Math.floor(timeTakenMs / 60000);

    return (
      <div className="h-full overflow-y-auto p-6 max-w-4xl mx-auto w-full" style={{ animation: 'fadeIn .4s ease' }}>
        {/* Header */}
        <div className="text-center py-10">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-6"
            style={{ background: result.passed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `3px solid ${result.passed ? '#22c55e' : '#ef4444'}` }}>
            {result.passed
              ? <Trophy className="w-12 h-12 text-green-400" />
              : <AlertTriangle className="w-12 h-12 text-red-400" />}
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2">
            {result.passed ? 'Congratulations!' : 'Assessment Failed'}
          </h1>
          <p className="text-xl text-gray-400">
            You scored <span className={`font-bold ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
              {result.percentage.toFixed(1)}%
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Performance */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4 pb-2 border-b border-white/10">Performance Summary</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex justify-between"><span>Total Score:</span><span className="font-bold text-white">{result.score} / {result.totalMarks}</span></li>
              <li className="flex justify-between"><span>Correct Answers:</span><span className="font-bold text-green-400">{result.correctCount}</span></li>
              <li className="flex justify-between"><span>Wrong Answers:</span><span className="font-bold text-red-400">{result.wrongCount}</span></li>
              <li className="flex justify-between"><span>Skipped:</span><span className="font-bold text-yellow-400">{result.skippedCount}</span></li>
              <li className="flex justify-between"><span>Time Taken:</span><span className="font-bold text-white">{timeTakenMins} min{timeTakenMins !== 1 ? 's' : ''}</span></li>
              <li className="flex justify-between"><span>Status:</span>
                <span className={`font-bold ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
                  {result.passed ? 'PASSED' : 'FAILED'}
                </span>
              </li>
            </ul>
          </div>

          {/* Certificate */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center">
            {result.passed && assessment.certificateEligible ? (
              <>
                <ShieldCheck className="w-16 h-16 text-yellow-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Certificate Earned!</h3>
                <p className="text-sm text-gray-400 mb-6">Download your skill certificate.</p>
                <button onClick={generateCertificate}
                  className="px-6 py-3 rounded-xl font-bold text-black flex items-center gap-2 w-full justify-center hover:opacity-90 transition-opacity"
                  style={{ background: '#eab308' }}>
                  <Download className="w-5 h-5" /> Download Certificate
                </button>
              </>
            ) : (
              <>
                <Lock className="w-16 h-16 text-gray-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-400 mb-2">Certificate Not Available</h3>
                <p className="text-sm text-gray-500">
                  {!assessment.certificateEligible
                    ? 'This assessment does not issue a certificate.'
                    : 'You must pass to earn a certificate.'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Violation report */}
        {result.status === 'terminated' && (
          <div className="p-6 rounded-2xl mb-8"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Terminated — Policy Violations
            </h3>
            <ul className="list-disc list-inside text-red-200/80 text-sm space-y-1">
              {result.violations.map((v: any, i: number) => (
                <li key={i}>{v.type} at {new Date(v.time).toLocaleTimeString()}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-center pb-10">
          <button onClick={onExit}
            className="px-8 py-3 rounded-xl font-bold text-white flex items-center gap-2 transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.1)' }}>
            Return to Dashboard <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// Small helper component
function CheckItem({ label, ok, icon }: { label: string; ok: boolean; icon: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border flex items-center gap-4"
      style={{
        background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        borderColor: ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
      }}>
      <span style={{ color: ok ? '#4ade80' : '#f87171' }}>{icon}</span>
      <div>
        <p className="text-white font-bold text-sm">{label}</p>
        <p className="text-xs" style={{ color: ok ? '#4ade80' : '#f87171' }}>
          {ok ? 'Granted ✓' : 'Required — click Allow in browser'}
        </p>
      </div>
    </div>
  );
}
