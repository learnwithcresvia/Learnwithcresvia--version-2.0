// services/submissionService.js
// Updated to use unified code execution service

import { supabase } from '../utils/supabaseClient';
import codeExecutionService from './codeExecutionService';

class SubmissionService {
  
  /**
   * Submit code solution for a challenge
   */
  async submitSolution(challengeId, code, language = 'python', battleSessionId = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get challenge details
      const { data: challenge, error: challengeError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (challengeError) throw challengeError;

      console.log('🔵 Submitting solution for:', challenge.title);

      // Create submission record
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert([{
          user_id: user.id,
          challenge_id: challengeId,
          code,
          language,
          status: 'PENDING',
          battle_session_id: battleSessionId,
        }])
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Run code against test cases using unified service
      const testCases = challenge.test_cases;
      const testResults = await codeExecutionService.runTestCases(code, language, testCases);

      // Calculate score and XP
      const score = Math.round((testResults.passedCount / testResults.totalCount) * 100);
      const allPassed = testResults.allPassed;
      
      let xpEarned = 0;
      if (allPassed) {
        xpEarned = challenge.xp_reward || 0;
        
        // Add time bonus for battle mode
        if (battleSessionId) {
          // Could add time-based bonus here
        }
      }

      // Update submission with results
      const { data: updatedSubmission, error: updateError } = await supabase
        .from('submissions')
        .update({
          status: allPassed ? 'PASSED' : 'FAILED',
          test_results: testResults.results,
          total_tests: testResults.totalCount,
          passed_tests: testResults.passedCount,
          score,
          xp_earned: xpEarned,
        })
        .eq('id', submission.id)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log(`${allPassed ? '✅' : '❌'} Submission result: ${testResults.passedCount}/${testResults.totalCount} tests passed`);

      return {
        data: {
          ...updatedSubmission,
          testResults,
        },
        error: null
      };

    } catch (error) {
      console.error('Error submitting solution:', error);
      return { data: null, error };
    }
  }

  /**
   * Get submission by ID
   */
  async getSubmission(id) {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*, challenge:challenges(*), user:profiles(name, email)')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching submission:', error);
      return { data: null, error };
    }
  }

  /**
   * Get user's submissions for a challenge
   */
  async getUserChallengeSubmissions(userId, challengeId) {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching user submissions:', error);
      return { data: null, error };
    }
  }

  /**
   * Get all submissions for a challenge (staff view)
   */
  async getChallengeSubmissions(challengeId, filters = {}) {
    try {
      let query = supabase
        .from('submissions')
        .select('*, user:profiles(name, email, department, year)')
        .eq('challenge_id', challengeId)
        .order('submitted_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching challenge submissions:', error);
      return { data: null, error };
    }
  }

  /**
   * Run code without submission (practice/test)
   */
  async runCode(code, language, stdin = '') {
    try {
      const result = await codeExecutionService.executeCode(code, language, stdin);
      return { data: result, error: null };
    } catch (error) {
      console.error('Error running code:', error);
      return { data: null, error };
    }
  }

  /**
   * Test code against specific test case
   */
  async testCode(code, language, testCase) {
    try {
      const result = await codeExecutionService.testCode(code, language, testCase);
      return { data: result, error: null };
    } catch (error) {
      console.error('Error testing code:', error);
      return { data: null, error };
    }
  }
}

// Export singleton instance
export const submissionService = new SubmissionService();

export default submissionService;
