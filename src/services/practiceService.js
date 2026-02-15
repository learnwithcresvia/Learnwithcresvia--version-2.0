// services/practiceService.js
// Service for managing practice sessions

import { supabase } from '../utils/supabaseClient';
import codeExecutionService from './codeExecutionService';

class PracticeService {
  
  /**
   * Create new practice session
   */
  async createSession(config) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get questions based on config
      let query = supabase
        .from('questions')
        .select('id')
        .eq('is_active', true);

      // Filter by language
      if (config.language && config.language !== 'all') {
        query = query.or(`language.eq.${config.language},language.eq.all`);
      }

      // Filter by difficulty
      if (config.difficulty) {
        query = query.eq('difficulty', config.difficulty);
      }

      const { data: allQuestions, error: questionsError } = await query;

      if (questionsError) throw questionsError;

      // Shuffle questions randomly
      const shuffled = allQuestions.sort(() => 0.5 - Math.random());
      const questions = shuffled.slice(0, config.questionCount || 10);

      if (questionsError) throw questionsError;

      const questionIds = questions.map(q => q.id);

      const { data, error } = await supabase
        .from('practice_sessions')
        .insert([{
          user_id: user.id,
          language: config.language,
          difficulty: config.difficulty,
          topic: config.topic || null,
          session_type: config.sessionType || 'MIXED',
          questions_ids: questionIds,
          total_questions: questionIds.length,
          status: 'IN_PROGRESS',
        }])
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error creating practice session:', error);
      return { data: null, error };
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    try {
      const { data, error } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching session:', error);
      return { data: null, error };
    }
  }

  /**
   * Get current question in session
   */
  async getCurrentQuestion(sessionId) {
    try {
      const { data: session } = await this.getSession(sessionId);
      
      if (!session) {
        return { data: null, error: new Error('Session not found') };
      }

      const questionId = session.questions_ids[session.current_question_index];

      const { data: question, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (error) throw error;

      return { 
        data: {
          question,
          index: session.current_question_index,
          total: session.total_questions,
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error fetching current question:', error);
      return { data: null, error };
    }
  }

  /**
   * Submit answer to question
   */
  async submitAnswer(sessionId, questionId, answer) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: question } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();

      let isCorrect = false;
      let testResults = null;
      let passedTests = 0;
      let totalTests = 0;

      // Evaluate based on question type
      if (question.question_type === 'MCQ') {
        isCorrect = answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
        totalTests = 1;
        passedTests = isCorrect ? 1 : 0;
      } else if (question.question_type === 'CODING') {
        // Run code against test cases
        const results = await codeExecutionService.runTestCases(
          answer,
          question.language,
          question.test_cases
        );

        testResults = results.results;
        passedTests = results.passedCount;
        totalTests = results.totalCount;
        isCorrect = results.allPassed;
      } else if (question.question_type === 'OUTPUT') {
        isCorrect = answer.trim() === question.correct_answer.trim();
        totalTests = 1;
        passedTests = isCorrect ? 1 : 0;
      }

      // Calculate points
      const basePoints = question.points || 10;
      const pointsEarned = isCorrect ? basePoints : 0;

      // Create attempt record
      const { data: attempt, error: attemptError } = await supabase
        .from('practice_attempts')
        .insert([{
          session_id: sessionId,
          user_id: user.id,
          question_id: questionId,
          question_type: question.question_type,
          user_answer: answer,
          user_code: question.question_type === 'CODING' ? answer : null,
          is_correct: isCorrect,
          test_results: testResults,
          passed_tests: passedTests,
          total_tests: totalTests,
          points_earned: pointsEarned,
          time_taken: 0, // Will be updated from frontend
        }])
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Update session stats
      const { data: session } = await this.getSession(sessionId);
      
      const newCorrectAnswers = session.correct_answers + (isCorrect ? 1 : 0);
      const newScore = session.score + pointsEarned;
      const newAccuracy = (newCorrectAnswers / (session.current_question_index + 1)) * 100;

      await supabase
        .from('practice_sessions')
        .update({
          correct_answers: newCorrectAnswers,
          score: newScore,
          accuracy: newAccuracy,
        })
        .eq('id', sessionId);

      return { 
        data: {
          attempt,
          isCorrect,
          testResults,
          passedTests,
          totalTests,
          pointsEarned,
          explanation: question.explanation,
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error submitting answer:', error);
      return { data: null, error };
    }
  }

  /**
   * Move to next question
   */
  async nextQuestion(sessionId) {
    try {
      const { data: session } = await this.getSession(sessionId);

      const nextIndex = session.current_question_index + 1;

      if (nextIndex >= session.total_questions) {
        // Session complete
        return this.completeSession(sessionId);
      }

      await supabase
        .from('practice_sessions')
        .update({
          current_question_index: nextIndex,
        })
        .eq('id', sessionId);

      return { data: { nextIndex, isComplete: false }, error: null };
    } catch (error) {
      console.error('Error moving to next question:', error);
      return { data: null, error };
    }
  }

  /**
   * Complete session
   */
  async completeSession(sessionId) {
    try {
      const { data: session } = await this.getSession(sessionId);

      // Calculate XP earned
      const baseXP = session.score;
      const streakBonus = 0; // Can add streak logic
      const totalXP = baseXP + streakBonus;

      const { data, error } = await supabase
        .from('practice_sessions')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          xp_earned: totalXP,
          streak_bonus: streakBonus,
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      return { data: { ...data, isComplete: true }, error: null };
    } catch (error) {
      console.error('Error completing session:', error);
      return { data: null, error };
    }
  }

  /**
   * Get user's practice history
   */
  async getUserHistory(limit = 10) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching user history:', error);
      return { data: null, error };
    }
  }

  /**
   * Get session attempts
   */
  async getSessionAttempts(sessionId) {
    try {
      const { data, error } = await supabase
        .from('practice_attempts')
        .select('*, question:questions(title, difficulty)')
        .eq('session_id', sessionId)
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching session attempts:', error);
      return { data: null, error };
    }
  }

  /**
   * Abandon session
   */
  async abandonSession(sessionId) {
    try {
      const { error } = await supabase
        .from('practice_sessions')
        .update({
          status: 'ABANDONED',
        })
        .eq('id', sessionId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Error abandoning session:', error);
      return { error };
    }
  }
}

export const practiceService = new PracticeService();
export default practiceService;
