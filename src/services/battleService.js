// services/battleService.js
// Service for managing 1v1 coding battles

import { supabase } from '../utils/supabaseClient';
import codeExecutionService from './codeExecutionService';

class BattleService {
  
  /**
   * Create new battle
   */
  async createBattle(config) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get random questions for battle
      let query = supabase
        .from('questions')
        .select('id')
        .eq('is_active', true)
        .eq('question_type', 'CODING')
        .eq('difficulty', config.difficulty);

      if (config.language && config.language !== 'all') {
        query = query.or(`language.eq.${config.language},language.eq.all`);
      }

      const { data: allQuestions, error: questionsError } = await query;

      if (questionsError) throw questionsError;

      // Shuffle and select random questions
      const shuffled = allQuestions.sort(() => 0.5 - Math.random());
      const questions = shuffled.slice(0, config.totalRounds || 3);

      if (questionsError) throw questionsError;

      const questionIds = questions.map(q => q.id);

      const { data, error } = await supabase
        .from('battles')
        .insert([{
          battle_type: config.battleType || '1V1',
          language: config.language,
          difficulty: config.difficulty,
          player1_id: user.id,
          player2_id: config.opponentId || null,
          player2_name: config.opponentName || 'Bot',
          questions_ids: questionIds,
          total_rounds: questionIds.length,
          status: config.opponentId ? 'WAITING' : 'IN_PROGRESS', // vs Bot starts immediately
          round_time_limit: config.timeLimit || 180,
        }])
        .select()
        .single();

      if (error) throw error;

      // If vs Bot, auto-start
      if (!config.opponentId) {
        await this.startBattle(data.id);
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error creating battle:', error);
      return { data: null, error };
    }
  }

  /**
   * Join existing battle
   */
  async joinBattle(battleId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('battles')
        .update({
          player2_id: user.id,
          status: 'IN_PROGRESS',
          started_at: new Date().toISOString(),
        })
        .eq('id', battleId)
        .eq('status', 'WAITING')
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error joining battle:', error);
      return { data: null, error };
    }
  }

  /**
   * Start battle
   */
  async startBattle(battleId) {
    try {
      const { data, error } = await supabase
        .from('battles')
        .update({
          status: 'IN_PROGRESS',
          started_at: new Date().toISOString(),
        })
        .eq('id', battleId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error starting battle:', error);
      return { data: null, error };
    }
  }

  /**
   * Get battle by ID
   */
  async getBattle(battleId) {
    try {
      const { data, error } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching battle:', error);
      return { data: null, error };
    }
  }

  /**
   * Get current question in battle
   */
  async getCurrentQuestion(battleId) {
    try {
      const { data: battle } = await this.getBattle(battleId);
      
      if (!battle) {
        return { data: null, error: new Error('Battle not found') };
      }

      const questionId = battle.questions_ids[battle.current_question_index];

      const { data: question, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (error) throw error;

      return { 
        data: {
          question,
          index: battle.current_question_index,
          total: battle.total_rounds,
          timeLimit: battle.round_time_limit,
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error fetching current question:', error);
      return { data: null, error };
    }
  }

  /**
   * Submit battle answer
   */
  async submitBattleAnswer(battleId, questionId, code, timeTaken) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: question } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();

      // Run code against test cases
      const results = await codeExecutionService.runTestCases(
        code,
        question.language,
        question.test_cases
      );

      const isCorrect = results.allPassed;
      const passedTests = results.passedCount;
      const totalTests = results.totalCount;

      // Calculate points with speed bonus
      let pointsEarned = 0;
      let speedBonus = 0;

      if (isCorrect) {
        pointsEarned = 100;
        
        // Speed bonus (up to 50 points)
        const { data: battle } = await this.getBattle(battleId);
        const timeLimit = battle.round_time_limit;
        const timePercentage = timeTaken / timeLimit;
        
        if (timePercentage < 0.5) {
          speedBonus = 50;
        } else if (timePercentage < 0.75) {
          speedBonus = 25;
        }
        
        pointsEarned += speedBonus;
      }

      // Create attempt record
      const { data: attempt, error: attemptError } = await supabase
        .from('battle_attempts')
        .insert([{
          battle_id: battleId,
          user_id: user.id,
          question_id: questionId,
          user_code: code,
          is_correct: isCorrect,
          test_results: results.results,
          passed_tests: passedTests,
          total_tests: totalTests,
          time_taken: timeTaken,
          points_earned: pointsEarned,
          speed_bonus: speedBonus,
        }])
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Update battle score
      const { data: battle } = await this.getBattle(battleId);
      
      const scoreField = user.id === battle.player1_id ? 'player1_score' : 'player2_score';
      const newScore = battle[scoreField] + pointsEarned;

      await supabase
        .from('battles')
        .update({
          [scoreField]: newScore,
        })
        .eq('id', battleId);

      return { 
        data: {
          attempt,
          isCorrect,
          testResults: results.results,
          passedTests,
          totalTests,
          pointsEarned,
          speedBonus,
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Error submitting battle answer:', error);
      return { data: null, error };
    }
  }

  /**
   * Move to next round
   */
  async nextRound(battleId) {
    try {
      const { data: battle } = await this.getBattle(battleId);

      const nextIndex = battle.current_question_index + 1;

      if (nextIndex >= battle.total_rounds) {
        // Battle complete
        return this.completeBattle(battleId);
      }

      await supabase
        .from('battles')
        .update({
          current_question_index: nextIndex,
        })
        .eq('id', battleId);

      return { data: { nextIndex, isComplete: false }, error: null };
    } catch (error) {
      console.error('Error moving to next round:', error);
      return { data: null, error };
    }
  }

  /**
   * Complete battle
   */
  async completeBattle(battleId) {
    try {
      const { data: battle } = await this.getBattle(battleId);

      // Determine winner
      let winnerId = null;
      if (battle.player1_score > battle.player2_score) {
        winnerId = battle.player1_id;
      } else if (battle.player2_score > battle.player1_score) {
        winnerId = battle.player2_id;
      }
      // If tied, no winner

      const { data, error } = await supabase
        .from('battles')
        .update({
          status: 'COMPLETED',
          ended_at: new Date().toISOString(),
          winner_id: winnerId,
        })
        .eq('id', battleId)
        .select()
        .single();

      if (error) throw error;

      return { data: { ...data, isComplete: true }, error: null };
    } catch (error) {
      console.error('Error completing battle:', error);
      return { data: null, error };
    }
  }

  /**
   * Get user's battle history
   */
  async getUserBattles(limit = 10) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('battles')
        .select('*')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching user battles:', error);
      return { data: null, error };
    }
  }

  /**
   * Get battle attempts
   */
  async getBattleAttempts(battleId) {
    try {
      const { data, error } = await supabase
        .from('battle_attempts')
        .select('*, question:questions(title, difficulty)')
        .eq('battle_id', battleId)
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching battle attempts:', error);
      return { data: null, error };
    }
  }

  /**
   * Generate bot response (for vs Bot battles)
   */
  async generateBotResponse(questionId, difficulty) {
    // Simulate bot solving with delay and accuracy based on difficulty
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));

    let successRate;
    switch (difficulty) {
      case 'EASY':
        successRate = 0.9;
        break;
      case 'MEDIUM':
        successRate = 0.7;
        break;
      case 'HARD':
        successRate = 0.5;
        break;
      default:
        successRate = 0.7;
    }

    const isCorrect = Math.random() < successRate;
    const points = isCorrect ? (100 + Math.floor(Math.random() * 30)) : 0;

    return {
      isCorrect,
      points,
      timeTaken: 3000 + Math.floor(Math.random() * 5000),
    };
  }

  /**
   * Cancel battle
   */
  async cancelBattle(battleId) {
    try {
      const { error } = await supabase
        .from('battles')
        .update({
          status: 'CANCELLED',
        })
        .eq('id', battleId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Error cancelling battle:', error);
      return { error };
    }
  }
}

export const battleService = new BattleService();
export default battleService;
