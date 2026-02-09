// services/challengeService.js
// Service for managing coding challenges

import { supabase } from '../utils/supabaseClient';

class ChallengeService {
  
  /**
   * Get challenges for current user
   * Filters based on user's role, department, and year
   */
  async getChallenges(filters = {}) {
    try {
      let query = supabase
        .from('challenges')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.difficulty) {
        query = query.eq('difficulty', filters.difficulty);
      }

      if (filters.mode) {
        query = query.eq('mode', filters.mode);
      }

      if (filters.topic) {
        query = query.eq('topic', filters.topic);
      }

      if (filters.department) {
        query = query.or(`department.is.null,department.eq.${filters.department}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching challenges:', error);
      return { data: null, error };
    }
  }

  /**
   * Get single challenge by ID
   */
  async getChallenge(id) {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching challenge:', error);
      return { data: null, error };
    }
  }

  /**
   * Create new challenge
   * Requires appropriate role (STAFF/COORDINATOR/HOD/ADMIN)
   */
  async createChallenge(challengeData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user's role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      // Determine initial status based on role
      let status = 'ACTIVE';
      if (profile.role === 'STAFF') {
        status = 'PENDING_APPROVAL'; // Staff challenges need approval
      }

      const challenge = {
        ...challengeData,
        status,
        created_by: user.id,
        approved_by: profile.role !== 'STAFF' ? user.id : null,
        approved_at: profile.role !== 'STAFF' ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from('challenges')
        .insert([challenge])
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error creating challenge:', error);
      return { data: null, error };
    }
  }

  /**
   * Update challenge
   */
  async updateChallenge(id, updates) {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error updating challenge:', error);
      return { data: null, error };
    }
  }

  /**
   * Delete challenge
   */
  async deleteChallenge(id) {
    try {
      const { error } = await supabase
        .from('challenges')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Error deleting challenge:', error);
      return { error };
    }
  }

  /**
   * Approve challenge (HOD/ADMIN only)
   */
  async approveChallenge(id) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('challenges')
        .update({
          status: 'ACTIVE',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error approving challenge:', error);
      return { data: null, error };
    }
  }

  /**
   * Reject challenge
   */
  async rejectChallenge(id, reason = null) {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .update({
          status: 'DRAFT',
          // Could add rejection_reason field to store reason
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error rejecting challenge:', error);
      return { data: null, error };
    }
  }

  /**
   * Get pending approvals (for HOD/ADMIN)
   */
  async getPendingApprovals(department = null) {
    try {
      let query = supabase
        .from('challenges')
        .select('*, created_by:profiles!created_by(name, email)')
        .eq('status', 'PENDING_APPROVAL')
        .order('created_at', { ascending: true });

      if (department) {
        query = query.eq('department', department);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      return { data: null, error };
    }
  }

  /**
   * Get user's submitted challenges
   */
  async getMySubmissions(userId) {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*, challenge:challenges(*)')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching user submissions:', error);
      return { data: null, error };
    }
  }

  /**
   * Check if user has attempted challenge
   */
  async hasAttempted(userId, challengeId) {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, status')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      return {
        attempted: data && data.length > 0,
        lastAttempt: data && data[0],
        error: null
      };
    } catch (error) {
      console.error('Error checking attempt:', error);
      return { attempted: false, lastAttempt: null, error };
    }
  }

  /**
   * Get challenge statistics
   */
  async getChallengeStats(challengeId) {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('status, execution_time')
        .eq('challenge_id', challengeId);

      if (error) throw error;

      const totalSubmissions = data.length;
      const passedSubmissions = data.filter(s => s.status === 'PASSED').length;
      const averageTime = data.reduce((sum, s) => sum + (s.execution_time || 0), 0) / totalSubmissions;

      return {
        data: {
          totalSubmissions,
          passedSubmissions,
          successRate: totalSubmissions > 0 ? (passedSubmissions / totalSubmissions) * 100 : 0,
          averageTime,
        },
        error: null
      };
    } catch (error) {
      console.error('Error fetching challenge stats:', error);
      return { data: null, error };
    }
  }
}

// Export singleton instance
export const challengeService = new ChallengeService();

export default challengeService;
