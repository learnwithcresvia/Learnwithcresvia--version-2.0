// services/questionService.js
// Service for fetching and managing questions

import { supabase } from '../utils/supabaseClient';

class QuestionService {
  
  /**
   * Get questions with filters
   */
  async getQuestions(filters = {}) {
    try {
      let query = supabase
        .from('questions')
        .select('*')
        .eq('is_active', true);

      if (filters.language && filters.language !== 'all') {
        query = query.or(`language.eq.${filters.language},language.eq.all`);
      }

      if (filters.difficulty) {
        query = query.eq('difficulty', filters.difficulty);
      }

      if (filters.topic) {
        query = query.eq('topic', filters.topic);
      }

      if (filters.questionType) {
        query = query.eq('question_type', filters.questionType);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching questions:', error);
      return { data: null, error };
    }
  }

  /**
   * Get random questions for practice/battle
   */
  async getRandomQuestions(count = 5, filters = {}) {
    try {
      const { data: allQuestions } = await this.getQuestions(filters);
      
      if (!allQuestions || allQuestions.length === 0) {
        return { data: [], error: new Error('No questions found') };
      }

      // Shuffle and take random questions
      const shuffled = allQuestions.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(count, allQuestions.length));

      return { data: selected, error: null };
    } catch (error) {
      console.error('Error getting random questions:', error);
      return { data: null, error };
    }
  }

  /**
   * Get single question by ID
   */
  async getQuestion(id) {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching question:', error);
      return { data: null, error };
    }
  }

  /**
   * Get available topics
   */
  async getTopics(language = null) {
    try {
      let query = supabase
        .from('questions')
        .select('topic')
        .eq('is_active', true)
        .not('topic', 'is', null);

      if (language && language !== 'all') {
        query = query.or(`language.eq.${language},language.eq.all`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get unique topics
      const topics = [...new Set(data.map(q => q.topic))].filter(Boolean);

      return { data: topics, error: null };
    } catch (error) {
      console.error('Error fetching topics:', error);
      return { data: null, error };
    }
  }

  /**
   * Get question statistics
   */
  async getQuestionStats(questionId) {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('usage_count, success_rate')
        .eq('id', questionId)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching question stats:', error);
      return { data: null, error };
    }
  }

  /**
   * Admin: Create question
   */
  async createQuestion(questionData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('questions')
        .insert([{
          ...questionData,
          created_by: user.id,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error creating question:', error);
      return { data: null, error };
    }
  }

  /**
   * Admin: Update question
   */
  async updateQuestion(id, updates) {
    try {
      const { data, error } = await supabase
        .from('questions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error updating question:', error);
      return { data: null, error };
    }
  }

  /**
   * Admin: Delete question
   */
  async deleteQuestion(id) {
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Error deleting question:', error);
      return { error };
    }
  }

  /**
   * Get daily challenge
   */
  async getDailyChallenge() {
    try {
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*, question:questions(*)')
        .eq('challenge_date', new Date().toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching daily challenge:', error);
      return { data: null, error };
    }
  }

  /**
   * Submit daily challenge attempt
   */
  async submitDailyAttempt(dailyChallengeId, code, isCorrect, testResults, timeTaken) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const pointsEarned = isCorrect ? 50 : 10; // Bonus for daily

      const { data, error } = await supabase
        .from('daily_challenge_attempts')
        .insert([{
          daily_challenge_id: dailyChallengeId,
          user_id: user.id,
          user_code: code,
          is_correct: isCorrect,
          test_results: testResults,
          time_taken: timeTaken,
          points_earned: pointsEarned,
        }])
        .select()
        .single();

      if (error) throw error;

      // Update daily challenge stats
      await supabase.rpc('increment', {
        table_name: 'daily_challenges',
        row_id: dailyChallengeId,
        column_name: isCorrect ? 'success_count' : 'attempts_count',
      });

      return { data, error: null };
    } catch (error) {
      console.error('Error submitting daily attempt:', error);
      return { data: null, error };
    }
  }
}

export const questionService = new QuestionService();
export default questionService;
