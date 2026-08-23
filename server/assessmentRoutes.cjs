const express = require('express');
const db = require('./db.cjs');
const router = express.Router();

// Get Dashboard Data
router.get('/dashboard', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const lowerEmail = email.toLowerCase();
    
    // Created by user (where user is teacher)
    const createdAssessments = await db.Assessment.find({ creator: lowerEmail }).sort({ createdAt: -1 });
    
    // Completed by user
    const completedAttempts = await db.AssessmentAttempt.find({ learner: lowerEmail, status: { $in: ['completed', 'terminated'] } }).populate('assessmentId').sort({ endTime: -1 });
    
    // Available to user (where user is learner) - all published tests not created by them and not hidden by them
    let assignedAssessments = await db.Assessment.find({ 
      creator: { $ne: lowerEmail }, 
      status: 'published',
      hiddenBy: { $ne: lowerEmail }
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: {
        created: createdAssessments,
        assigned: assignedAssessments,
        completed: completedAttempts
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get Admin Test Reports (Daily stats + all attempts)
router.get('/admin/reports', async (req, res) => {
  try {
    const attempts = await db.AssessmentAttempt.find()
      .populate('assessmentId')
      .sort({ endTime: -1, startTime: -1 });

    const formattedAttempts = attempts.map(att => {
      const dateObj = att.endTime || att.startTime || new Date();
      const dateStr = new Date(dateObj).toISOString().split('T')[0];
      return {
        _id: att._id,
        assessmentName: att.assessmentId?.name || 'Deleted Assessment',
        skill: att.assessmentId?.skill || 'General',
        learner: att.learner,
        score: att.score || 0,
        totalMarks: att.totalMarks || 0,
        percentage: att.percentage || 0,
        passed: att.passed || false,
        status: att.status,
        violationsCount: att.violations ? att.violations.length : 0,
        startTime: att.startTime,
        endTime: att.endTime,
        date: dateStr
      };
    });

    const dailyMap = {};
    formattedAttempts.forEach(att => {
      const d = att.date;
      if (!dailyMap[d]) {
        dailyMap[d] = {
          date: d,
          total: 0,
          completed: 0,
          terminated: 0,
          passed: 0,
          failed: 0,
          sumPercentage: 0
        };
      }
      dailyMap[d].total += 1;
      if (att.status === 'completed') dailyMap[d].completed += 1;
      if (att.status === 'terminated') dailyMap[d].terminated += 1;
      if (att.passed) dailyMap[d].passed += 1;
      else if (att.status === 'completed') dailyMap[d].failed += 1;
      dailyMap[d].sumPercentage += att.percentage;
    });

    const dailyStats = Object.values(dailyMap).map(d => ({
      ...d,
      avgPercentage: d.total > 0 ? (d.sumPercentage / d.total).toFixed(1) : 0,
      passRate: d.completed > 0 ? ((d.passed / d.completed) * 100).toFixed(1) : 0
    })).sort((a, b) => b.date.localeCompare(a.date));

    res.json({
      success: true,
      data: {
        attempts: formattedAttempts,
        dailyStats
      }
    });
  } catch (err) {
    console.error('Admin reports error:', err);
    res.status(500).json({ error: 'Failed to fetch assessment reports' });
  }
});

// Create new Assessment
router.post('/create', async (req, res) => {
  try {
    const creatorEmail = req.body.creator?.toLowerCase();
    if (!creatorEmail) return res.status(400).json({ error: 'Creator email is required' });

    const user = await db.User.findOne({ email: creatorEmail });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const adminSettings = await db.getAdminSettings();
    const count = await db.Assessment.countDocuments({ creator: creatorEmail });
    
    const isPremiumUser = user.isPremium || user.paymentStatus === 'paid' || user.membershipType === 'PREMIUM';

    if (!isPremiumUser) {
      if (adminSettings.assessmentCreationAccess === 'PREMIUM') {
        return res.status(403).json({ error: 'PREMIUM_REQUIRED', message: 'Premium membership is required to create assessments.' });
      }
      if (count >= adminSettings.freeAssessmentLimit) {
        return res.status(403).json({ error: 'PREMIUM_REQUIRED', message: `Free users are limited to ${adminSettings.freeAssessmentLimit} assessment(s). Please upgrade to Premium.` });
      }
    } else {
      if (count >= adminSettings.premiumAssessmentLimit) {
        return res.status(403).json({ error: 'LIMIT_REACHED', message: `You have reached your limit of ${adminSettings.premiumAssessmentLimit} assessment(s).` });
      }
    }

    const assessment = new db.Assessment(req.body);
    await assessment.save();
    res.json({ success: true, data: assessment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});


// Get single assessment
router.get('/:id', async (req, res) => {
  try {
    const assessment = await db.Assessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: assessment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

// Publish Assessment
router.post('/:id/publish', async (req, res) => {
  try {
    const assessment = await db.Assessment.findByIdAndUpdate(req.params.id, { status: 'published' }, { new: true });
    res.json({ success: true, data: assessment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to publish assessment' });
  }
});

// Get Questions for Assessment
router.get('/:id/questions', async (req, res) => {
  try {
    const questions = await db.AssessmentQuestion.find({ assessmentId: req.params.id });
    res.json({ success: true, data: questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Add Question
router.post('/:id/questions', async (req, res) => {
  try {
    const question = new db.AssessmentQuestion({ ...req.body, assessmentId: req.params.id });
    await question.save();
    
    // Update assessment question count
    const count = await db.AssessmentQuestion.countDocuments({ assessmentId: req.params.id });
    await db.Assessment.findByIdAndUpdate(req.params.id, { questionCount: count });
    
    res.json({ success: true, data: question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// Delete Question
router.delete('/questions/:questionId', async (req, res) => {
  try {
    const question = await db.AssessmentQuestion.findByIdAndDelete(req.params.questionId);
    if (question) {
      const count = await db.AssessmentQuestion.countDocuments({ assessmentId: question.assessmentId });
      await db.Assessment.findByIdAndUpdate(question.assessmentId, { questionCount: count });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Delete Assessment
router.delete('/:id', async (req, res) => {
  try {
    // Delete the assessment
    const assessment = await db.Assessment.findByIdAndDelete(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    
    // Also delete all related questions and attempts
    await db.AssessmentQuestion.deleteMany({ assessmentId: req.params.id });
    await db.AssessmentAttempt.deleteMany({ assessmentId: req.params.id });
    
    res.json({ success: true, message: 'Assessment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete assessment' });
  }
});

// Hide Assessment for user
router.post('/:id/hide', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    
    const assessment = await db.Assessment.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { hiddenBy: email.toLowerCase() } },
      { new: true }
    );
    
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    res.json({ success: true, message: 'Assessment hidden successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to hide assessment' });
  }
});

// Start Assessment Attempt
router.post('/:id/start', async (req, res) => {
  const { learner } = req.body;
  try {
    const assessment = await db.Assessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    
    if (assessment.status !== 'published') {
      return res.status(400).json({ error: 'Assessment is not published' });
    }

    if (assessment.partner !== learner.toLowerCase()) {
      return res.status(403).json({ error: 'You are not assigned to this assessment' });
    }

    const adminSettings = await db.getAdminSettings();
    const user = await db.getUserByEmail(learner);

    if (!user.isPremium && adminSettings.assessmentWritingAccess === 'PREMIUM') {
      return res.status(403).json({ error: 'PREMIUM_REQUIRED', message: 'Premium membership is required to attempt assessments.' });
    }

    // Check attempts
    const previousAttemptsCount = await db.AssessmentAttempt.countDocuments({ 
      assessmentId: req.params.id, 
      learner: learner.toLowerCase(),
      status: { $in: ['completed', 'terminated'] }
    });

    if (previousAttemptsCount >= assessment.allowedAttempts) {
      return res.status(403).json({ error: 'Maximum attempts reached' });
    }

    // Premium Check (if required by policy and not first attempt, or always required)
    const isFirstAttempt = previousAttemptsCount === 0;
    const requiresPremium = assessment.premiumPolicy?.requirePremium;
    const firstAttemptFree = assessment.premiumPolicy?.firstAttemptFree;
    
    if (requiresPremium && (!isFirstAttempt || !firstAttemptFree)) {
      const user = await db.getUserByEmail(learner);
      if (!user.isPremium) {
        return res.status(403).json({ 
          error: 'Premium required', 
          message: 'Your free attempt has already been used. Upgrade to Premium to continue.' 
        });
      }
    }

    // Fetch questions to send back (excluding correctAnswers for security)
    let questions = await db.AssessmentQuestion.find({ assessmentId: req.params.id }).lean();
    
    if (assessment.randomize) {
      questions = questions.sort(() => 0.5 - Math.random());
    }

    // Remove correctAnswers and explanation from payload sent to client EXCEPT for Coding where correctAnswers holds testCases
    const safeQuestions = questions.map(q => {
      if (q.type !== 'Coding') {
        delete q.correctAnswers;
      }
      delete q.explanation;
      return q;
    });

    // Create Attempt
    const attempt = new db.AssessmentAttempt({
      assessmentId: req.params.id,
      learner: learner.toLowerCase(),
      status: 'in-progress'
    });
    await attempt.save();

    res.json({ success: true, data: { attempt, questions: safeQuestions } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start assessment' });
  }
});

// Submit Assessment (or Terminate)
router.post('/attempt/:attemptId/submit', async (req, res) => {
  const { answers, violations, terminated } = req.body;
  try {
    const attempt = await db.AssessmentAttempt.findById(req.params.attemptId);
    if (!attempt || attempt.status !== 'in-progress') {
      return res.status(400).json({ error: 'Invalid attempt or already submitted' });
    }

    const assessment = await db.Assessment.findById(attempt.assessmentId);
    
    // Fetch all questions to calculate score
    const questions = await db.AssessmentQuestion.find({ assessmentId: attempt.assessmentId });
    const questionMap = {};
    questions.forEach(q => questionMap[q._id.toString()] = q);

    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    const processedAnswers = [];

    // Calculate score
    questions.forEach(q => {
      totalMarks += q.marks;
      const qId = q._id.toString();
      const submittedAnswer = answers.find(a => a.questionId === qId);
      
      let isCorrect = false;
      if (submittedAnswer && submittedAnswer.selected && submittedAnswer.selected.length > 0) {
        // Compare arrays (assuming sorted or exact match for simplicity in MCQ)
        // For MultipleAnswer, need to check if all correct are selected and no wrong are selected
        const correctAnswers = q.correctAnswers;
        const selected = Array.isArray(submittedAnswer.selected) ? submittedAnswer.selected : [submittedAnswer.selected];
        
        if (q.type === 'Coding') {
          // Frontend runs the tests and sends 'PASSED_ALL_TESTS' if everything matches
          isCorrect = submittedAnswer.selected === 'PASSED_ALL_TESTS';
        } else {
          isCorrect = correctAnswers.length === selected.length && correctAnswers.every(ans => selected.includes(ans));
        }
        
        if (isCorrect) {
          score += q.marks;
          correctCount++;
        } else {
          wrongCount++;
          if (assessment.negativeMarking) {
            score -= (q.marks * 0.25); // Example negative marking rule (25%)
          }
        }
        
        processedAnswers.push({
          questionId: qId,
          submittedAnswer: selected,
          isCorrect
        });
      } else {
        skippedCount++;
        processedAnswers.push({
          questionId: qId,
          submittedAnswer: [],
          isCorrect: false
        });
      }
    });

    // Ensure score is not negative
    score = Math.max(0, score);
    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
    const passed = percentage >= assessment.passingPercentage;

    attempt.endTime = new Date();
    attempt.score = score;
    attempt.totalMarks = totalMarks;
    attempt.percentage = percentage;
    attempt.passed = passed;
    attempt.correctCount = correctCount;
    attempt.wrongCount = wrongCount;
    attempt.skippedCount = skippedCount;
    attempt.answers = processedAnswers;
    attempt.violations = violations || [];
    attempt.status = terminated ? 'terminated' : 'completed';

    await attempt.save();

    res.json({ success: true, data: attempt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit assessment' });
  }
});

// Get Attempt Result
router.get('/attempt/:attemptId', async (req, res) => {
  try {
    const attempt = await db.AssessmentAttempt.findById(req.params.attemptId).populate('assessmentId');
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    
    const questions = await db.AssessmentQuestion.find({ assessmentId: attempt.assessmentId._id });
    
    res.json({ success: true, data: { attempt, questions } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

module.exports = router;
