import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, CheckCircle, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../../config.js';

interface QuestionManagementProps {
  assessment: any;
  onBack: () => void;
}

export default function QuestionManagement({ assessment, onBack }: QuestionManagementProps) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    type: 'MCQ',
    questionText: '',
    options: ['', '', '', ''],
    correctAnswers: [] as string[],
    marks: 1,
    explanation: '',
    difficulty: 'Medium'
  });

  useEffect(() => {
    fetchQuestions();
  }, [assessment._id]);

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/assessments/${assessment._id}/questions`);
      const data = await res.json();
      if (data.success) {
        setQuestions(data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...newQuestion.options];
    newOptions[index] = value;
    setNewQuestion(prev => ({ ...prev, options: newOptions }));
  };

  const toggleCorrectAnswer = (value: string) => {
    setNewQuestion(prev => {
      const isSelected = prev.correctAnswers.includes(value);
      if (prev.type === 'MCQ' || prev.type === 'TrueFalse') {
        // Only one correct answer allowed
        return { ...prev, correctAnswers: isSelected ? [] : [value] };
      } else {
        // Multiple allowed
        return {
          ...prev,
          correctAnswers: isSelected
            ? prev.correctAnswers.filter(a => a !== value)
            : [...prev.correctAnswers, value]
        };
      }
    });
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.questionText) {
      toast.error('Question text is required');
      return;
    }
    
    // Validate options and answers based on type
    if (['MCQ', 'MultipleAnswer'].includes(newQuestion.type)) {
      if (newQuestion.options.some(opt => !opt.trim())) {
        toast.error('All options must be filled');
        return;
      }
    }
    
    if (newQuestion.correctAnswers.length === 0) {
      toast.error('Please select at least one correct answer');
      return;
    }

    try {
      let finalQuestion = { ...newQuestion };
      if (newQuestion.type === 'TrueFalse') {
        finalQuestion.options = ['True', 'False'];
      } else if (newQuestion.type === 'Coding') {
        finalQuestion.options = [];
      }

      const res = await fetch(`${API_URL}/api/assessments/${assessment._id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalQuestion)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Question added');
        setQuestions([...questions, data.data]);
        setShowAddForm(false);
        // Reset form
        setNewQuestion({
          type: 'MCQ',
          questionText: '',
          options: ['', '', '', ''],
          correctAnswers: [],
          marks: 1,
          explanation: '',
          difficulty: 'Medium'
        });
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to add question');
    }
  };

  const handleDelete = async (qId: string) => {
    if (!confirm('Delete this question?')) return;
    try {
      const res = await fetch(`${API_URL}/api/assessments/questions/${qId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setQuestions(questions.filter(q => q._id !== qId));
        toast.success('Question deleted');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete question');
    }
  };

  const handlePublish = async () => {
    if (questions.length === 0) {
      toast.error('Please add at least one question before publishing');
      return;
    }
    
    if (!confirm('Once published, you cannot edit questions. Proceed?')) return;

    setPublishing(true);
    try {
      const res = await fetch(`${API_URL}/api/assessments/${assessment._id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Assessment published successfully!');
        onBack();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 animate-fade-in max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-[32px] font-extrabold text-white tracking-tight">Manage Questions</h1>
            <p className="text-gray-400">{assessment.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddForm(true)}
            disabled={assessment.status === 'published'}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" /> Add Question
          </button>
          {assessment.status === 'draft' && (
            <button
              onClick={handlePublish}
              disabled={publishing || questions.length === 0}
              className="bg-[var(--color-accent)] hover:bg-[#1a6b4a] text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {publishing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pb-20">
        
        {loading ? (
          <div className="text-center py-10"><div className="w-8 h-8 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto"></div></div>
        ) : questions.length === 0 && !showAddForm ? (
          <div className="text-center py-20 bg-black/20 rounded-2xl border border-white/5">
            <p className="text-gray-400 mb-4">No questions added yet.</p>
            <button onClick={() => setShowAddForm(true)} className="text-[var(--color-accent)] font-bold hover:underline">
              Add your first question
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q._id} className="bg-[var(--brand-dark)] border border-white/10 rounded-xl p-6 relative group">
                {assessment.status === 'draft' && (
                  <button 
                    onClick={() => handleDelete(q._id)}
                    className="absolute top-4 right-4 p-2 text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-white/10 px-2 py-1 rounded text-xs font-bold text-white">Q{idx + 1}</span>
                  <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold">{q.type}</span>
                  <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs font-bold">{q.difficulty}</span>
                  <span className="text-gray-400 text-sm">{q.marks} Marks</span>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-4 whitespace-pre-wrap">{q.questionText}</h3>
                
                {q.type !== 'Coding' && (
                  <div className="space-y-2 mb-4">
                    {q.options.map((opt: string, i: number) => (
                      <div key={i} className={`p-3 rounded-lg border ${q.correctAnswers.includes(opt) ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-black/30 border-white/5 text-gray-300'}`}>
                        {opt} {q.correctAnswers.includes(opt) && <CheckCircle className="w-4 h-4 inline ml-2" />}
                      </div>
                    ))}
                  </div>
                )}
                
                {q.explanation && (
                  <div className="mt-4 p-4 bg-yellow-500/10 rounded-lg text-yellow-200/80 text-sm">
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Question Modal / Form */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[var(--brand-dark)] w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6">Add New Question</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Question Type</label>
                    <select
                      value={newQuestion.type}
                      onChange={e => setNewQuestion({ ...newQuestion, type: e.target.value, options: e.target.value === 'MCQ' || e.target.value === 'MultipleAnswer' ? ['', '', '', ''] : e.target.value === 'TrueFalse' ? ['True', 'False'] : [], correctAnswers: [] })}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white outline-none"
                    >
                      <option value="MCQ">Single Choice (MCQ)</option>
                      <option value="MultipleAnswer">Multiple Choice</option>
                      <option value="TrueFalse">True / False</option>
                      <option value="Coding">Coding / Text</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Difficulty</label>
                    <select
                      value={newQuestion.difficulty}
                      onChange={e => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white outline-none"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Marks</label>
                    <input
                      type="number"
                      min="1"
                      value={newQuestion.marks}
                      onChange={e => setNewQuestion({ ...newQuestion, marks: Number(e.target.value) })}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Question Text *</label>
                  <textarea
                    value={newQuestion.questionText}
                    onChange={e => setNewQuestion({ ...newQuestion, questionText: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white outline-none min-h-[100px]"
                    placeholder="Enter the question..."
                  />
                </div>

                {(newQuestion.type === 'MCQ' || newQuestion.type === 'MultipleAnswer') && (
                  <div className="space-y-3">
                    <label className="block text-sm text-gray-400 mb-2">Options & Correct Answer(s) *</label>
                    {newQuestion.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <input
                          type={newQuestion.type === 'MCQ' ? 'radio' : 'checkbox'}
                          name="correctAnswer"
                          checked={newQuestion.correctAnswers.includes(opt) && opt !== ''}
                          onChange={() => {
                            if (opt) toggleCorrectAnswer(opt);
                          }}
                          className="w-5 h-5 accent-[var(--color-accent)]"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={e => handleOptionChange(idx, e.target.value)}
                          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white outline-none"
                          placeholder={`Option ${idx + 1}`}
                        />
                      </div>
                    ))}
                    <button 
                      type="button" 
                      onClick={() => setNewQuestion(prev => ({ ...prev, options: [...prev.options, ''] }))}
                      className="text-sm text-blue-400 hover:underline mt-2"
                    >
                      + Add Option
                    </button>
                  </div>
                )}

                {newQuestion.type === 'TrueFalse' && (
                  <div className="space-y-3">
                    <label className="block text-sm text-gray-400 mb-2">Correct Answer *</label>
                    <div className="flex gap-4">
                      {['True', 'False'].map(opt => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="tfCorrect"
                            checked={newQuestion.correctAnswers.includes(opt)}
                            onChange={() => toggleCorrectAnswer(opt)}
                            className="w-5 h-5 accent-[var(--color-accent)]"
                          />
                          <span className="text-white">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {newQuestion.type === 'Coding' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm text-gray-400">Test Cases (Input & Expected Output)</label>
                      <button 
                        type="button" 
                        onClick={() => setNewQuestion(prev => ({ 
                          ...prev, 
                          correctAnswers: [...prev.correctAnswers, JSON.stringify({ input: '', output: '' })] 
                        }))}
                        className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Test Case
                      </button>
                    </div>
                    <div className="space-y-4">
                      {newQuestion.correctAnswers.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No test cases added. Click 'Add Test Case' to create one.</p>
                      )}
                      {newQuestion.correctAnswers.map((tcString, idx) => {
                        let tc = { input: '', output: '' };
                        try { tc = JSON.parse(tcString); } catch(_e) {}
                        return (
                          <div key={idx} className="bg-black/20 border border-white/5 p-3 rounded-lg flex flex-col gap-2 relative">
                            <button 
                              type="button"
                              onClick={() => {
                                const newAnswers = [...newQuestion.correctAnswers];
                                newAnswers.splice(idx, 1);
                                setNewQuestion(prev => ({ ...prev, correctAnswers: newAnswers }));
                              }}
                              className="absolute top-2 right-2 text-red-400 hover:text-red-300 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="text-xs font-bold text-gray-400 mb-1">Test Case {idx + 1}</div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Input (stdin)</label>
                              <textarea
                                value={tc.input}
                                onChange={e => {
                                  const newAnswers = [...newQuestion.correctAnswers];
                                  newAnswers[idx] = JSON.stringify({ ...tc, input: e.target.value });
                                  setNewQuestion(prev => ({ ...prev, correctAnswers: newAnswers }));
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-white outline-none font-mono text-sm h-16 resize-none"
                                placeholder="Input data..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Expected Output (stdout)</label>
                              <textarea
                                value={tc.output}
                                onChange={e => {
                                  const newAnswers = [...newQuestion.correctAnswers];
                                  newAnswers[idx] = JSON.stringify({ ...tc, output: e.target.value });
                                  setNewQuestion(prev => ({ ...prev, correctAnswers: newAnswers }));
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-white outline-none font-mono text-sm h-16 resize-none"
                                placeholder="Expected output..."
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Explanation (Optional)</label>
                  <textarea
                    value={newQuestion.explanation}
                    onChange={e => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white outline-none h-20"
                    placeholder="Explain why the answer is correct..."
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddQuestion}
                  className="bg-[var(--color-accent)] hover:bg-[#1a6b4a] text-white px-6 py-2 rounded-xl font-bold transition-colors flex items-center gap-2"
                >
                  <Save className="w-5 h-5" /> Save Question
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
