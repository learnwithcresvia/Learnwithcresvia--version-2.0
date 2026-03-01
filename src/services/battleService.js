// services/battleService.js
import { supabase } from '../utils/supabaseClient';

// Generate a random 6-char room code like "ABC123"
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

class BattleService {

  // ── Get random questions ────────────────────────────────────────────────────
  async getRandomQuestions(difficulty, language, count) {
    let query = supabase
      .from('questions')
      .select('id')
      .eq('is_active', true)
      .eq('question_type', 'CODING')
      .eq('difficulty', difficulty);

    if (language && language !== 'all') {
      query = query.or(`language.eq.${language},language.eq.all`);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) throw new Error('No questions found for this difficulty/language.');

    const shuffled = data.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(q => q.id);
  }

  // ── Create battle (bot or P vs P) ──────────────────────────────────────────
  async createBattle(config) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const questionIds = await this.getRandomQuestions(
        config.difficulty, config.language, config.totalRounds || 3
      );

      const isBot = !config.isPlayerVsPlayer;
      const roomCode = isBot ? null : generateRoomCode();

      const { data, error } = await supabase
        .from('battles')
        .insert([{
          battle_type:           '1V1',
          language:              config.language,
          difficulty:            config.difficulty,
          player1_id:            user.id,
          player2_id:            isBot ? null : null, // player2 joins via room code
          player2_name:          isBot ? 'Bot' : null,
          questions_ids:         questionIds,
          total_rounds:          questionIds.length,
          status:                isBot ? 'IN_PROGRESS' : 'WAITING',
          round_time_limit:      config.timeLimit || 180,
          room_code:             roomCode,
          current_question_index: 0,
          player1_score:         0,
          player2_score:         0,
        }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('createBattle error:', error);
      return { data: null, error };
    }
  }

  // ── Join by room code ───────────────────────────────────────────────────────
  async joinByRoomCode(roomCode) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Find the waiting room
      const { data: battle, error: findError } = await supabase
        .from('battles')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .eq('status', 'WAITING')
        .single();

      if (findError || !battle) throw new Error('Room not found or already started.');
      if (battle.player1_id === user.id) throw new Error('You created this room — share the code with a friend!');

      // Join the room
      const { data, error } = await supabase
        .from('battles')
        .update({
          player2_id:  user.id,
          status:      'IN_PROGRESS',
          started_at:  new Date().toISOString(),
        })
        .eq('id', battle.id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('joinByRoomCode error:', error);
      return { data: null, error };
    }
  }

  // ── Subscribe to battle changes (Realtime) ──────────────────────────────────
  subscribeToBattle(battleId, callback) {
    return supabase
      .channel(`battle:${battleId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'battles',
        filter: `id=eq.${battleId}`,
      }, payload => callback(payload.new))
      .subscribe();
  }

  unsubscribeFromBattle(channel) {
    supabase.removeChannel(channel);
  }

  // ── Get battle ──────────────────────────────────────────────────────────────
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
      return { data: null, error };
    }
  }

  // ── Get current question ────────────────────────────────────────────────────
  async getCurrentQuestion(battleId) {
    try {
      const { data: battle } = await this.getBattle(battleId);
      if (!battle) throw new Error('Battle not found');

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
          index:     battle.current_question_index,
          total:     battle.total_rounds,
          timeLimit: battle.round_time_limit,
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  // ── Submit answer ───────────────────────────────────────────────────────────
  async submitBattleAnswer(battleId, questionId, code, timeTaken) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: battle }   = await this.getBattle(battleId);
      const { data: question } = await supabase.from('questions').select('*').eq('id', questionId).single();

      // Run code via Judge0
      const JUDGE0_URL = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';
      const LANG_IDS   = { python: 71, javascript: 63, java: 62, cpp: 54 };
      const language_id = LANG_IDS[question.language] || 71;

      const testCases  = question.test_cases || [];
      let passed = 0;
      const testResults = [];

      if (testCases.length === 0) {
        // No test cases — just run it
        const res  = await fetch(JUDGE0_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ source_code: code, language_id, stdin: '' }),
        });
        const data = await res.json();
        const hasError = !!(data.stderr || data.compile_output);
        testResults.push({ passed: !hasError });
        if (!hasError) passed++;
      } else {
        for (const tc of testCases) {
          const res  = await fetch(JUDGE0_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ source_code: code, language_id, stdin: String(tc.input ?? '') }),
          });
          const data   = await res.json();
          const stdout = (data.stdout || '').trim();
          const ok     = stdout === String(tc.expected_output).trim();
          testResults.push({ passed: ok, expected: tc.expected_output, got: stdout });
          if (ok) passed++;
        }
      }

      const isCorrect  = passed === (testCases.length || 1);
      const timeLimit  = battle.round_time_limit;
      const timePct    = timeTaken / timeLimit;
      let   speedBonus = 0;
      if (isCorrect) {
        speedBonus = timePct < 0.5 ? 50 : timePct < 0.75 ? 25 : 0;
      }
      const pointsEarned = isCorrect ? 100 + speedBonus : 0;

      // Save attempt
      await supabase.from('battle_attempts').insert([{
        battle_id:    battleId,
        user_id:      user.id,
        question_id:  questionId,
        user_code:    code,
        is_correct:   isCorrect,
        test_results: testResults,
        passed_tests: passed,
        total_tests:  testCases.length || 1,
        time_taken:   timeTaken,
        points_earned: pointsEarned,
        speed_bonus:  speedBonus,
      }]);

      // Update score + mark this player as submitted
      const isP1         = user.id === battle.player1_id;
      const scoreField   = isP1 ? 'player1_score'     : 'player2_score';
      const submittedField = isP1 ? 'player1_submitted' : 'player2_submitted';
      const newScore     = (battle[scoreField] || 0) + pointsEarned;

      // Check if opponent already submitted (for P vs P winner logic)
      const opponentSubmitted = isP1 ? battle.player2_submitted : battle.player1_submitted;

      let updatePayload = {
        [scoreField]:    newScore,
        [submittedField]: true,
      };

      // For P vs P: first correct submission wins the round immediately
      if (isCorrect && battle.player2_name !== 'Bot') {
        updatePayload.winner_id = user.id; // round winner (we'll use this in UI)
      }

      await supabase.from('battles').update(updatePayload).eq('id', battleId);

      return {
        data: { isCorrect, testResults, passedTests: passed, totalTests: testCases.length || 1, pointsEarned, speedBonus },
        error: null,
      };
    } catch (error) {
      console.error('submitBattleAnswer error:', error);
      return { data: null, error };
    }
  }

  // ── Next round ──────────────────────────────────────────────────────────────
  async nextRound(battleId) {
    try {
      const { data: battle } = await this.getBattle(battleId);
      const nextIndex = battle.current_question_index + 1;

      if (nextIndex >= battle.total_rounds) {
        return this.completeBattle(battleId);
      }

      await supabase.from('battles').update({
        current_question_index: nextIndex,
        player1_submitted: false,
        player2_submitted: false,
      }).eq('id', battleId);

      return { data: { nextIndex, isComplete: false }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  // ── Complete battle ─────────────────────────────────────────────────────────
  async completeBattle(battleId) {
    try {
      const { data: battle } = await this.getBattle(battleId);
      let winnerId = null;
      if (battle.player1_score > battle.player2_score) winnerId = battle.player1_id;
      else if (battle.player2_score > battle.player1_score) winnerId = battle.player2_id;

      const { data, error } = await supabase.from('battles').update({
        status:    'COMPLETED',
        ended_at:  new Date().toISOString(),
        winner_id: winnerId,
      }).eq('id', battleId).select().single();

      if (error) throw error;
      return { data: { ...data, isComplete: true }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  // ── Bot response simulation ─────────────────────────────────────────────────
  async generateBotResponse(questionId, difficulty) {
    const delay = 3000 + Math.random() * 5000;
    await new Promise(r => setTimeout(r, delay));
    const rates = { EASY: 0.9, MEDIUM: 0.7, HARD: 0.5 };
    const isCorrect = Math.random() < (rates[difficulty] || 0.7);
    return { isCorrect, points: isCorrect ? 100 + Math.floor(Math.random() * 30) : 0 };
  }

  // ── User battle history ─────────────────────────────────────────────────────
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
      return { data: [], error };
    }
  }

  async cancelBattle(battleId) {
    await supabase.from('battles').update({ status: 'CANCELLED' }).eq('id', battleId);
  }
}

export const battleService = new BattleService();
export default battleService;
