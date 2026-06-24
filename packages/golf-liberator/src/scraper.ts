import axios from 'axios';

export interface GhinGolfer {
  ghin: string;
  player_name: string;
  handicap_index: string;
  club_name?: string;
  association_name?: string;
}

export interface GhinScore {
  score_id: number;
  date_played: string;
  gross_score: number;
  adjusted_gross_score: number;
  course_name: string;
  tee_name: string;
  course_rating: number;
  slope_rating: number;
  score_differential: number;
  used_for_handicap: boolean;
}

export class GhinScraper {
  private emailOrGhin: string;
  private password: string;
  private token: string | null = null;

  constructor(emailOrGhin: string, password: string) {
    this.emailOrGhin = emailOrGhin;
    this.password = password;
  }

  /**
   * Authenticates with the GHIN API to obtain a Bearer Token.
   */
  async login(): Promise<string> {
    if (!this.emailOrGhin || !this.password) {
      throw new Error('GHIN credentials (username/password) are required.');
    }

    const loginUrl = 'https://api.ghin.com/api/v1/golfer_login.json';
    const payload = {
      user: {
        email_or_ghin: this.emailOrGhin,
        password: this.password,
        remember_me: 'true'
      },
      token: '123' // Required arbitrary token string for validation
    };

    try {
      const response = await axios.post(loginUrl, payload, {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const token = response.data?.golfer_user?.golfer_user_token;
      if (!token) {
        throw new Error('Authentication response did not contain a golfer token.');
      }

      this.token = token;
      return token;
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;
      throw new Error(`GHIN login failed (${status || 'Network Error'}): ${JSON.stringify(data) || error.message}`);
    }
  }

  /**
   * Fetches golfer demographic info.
   */
  async getGolferDetails(ghinId: string): Promise<GhinGolfer> {
    if (!this.token) {
      await this.login();
    }

    const url = `https://api.ghin.com/api/v1/golfers/search.json?per_page=10&page=1&golfer_id=${ghinId}&sorting_criteria=id&order=ASC&status=Active`;

    try {
      const response = await axios.get(url, {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${this.token}`
        }
      });

      const golfer = response.data?.golfers?.[0];
      if (!golfer) {
        throw new Error(`Golfer with GHIN ${ghinId} not found.`);
      }

      return {
        ghin: golfer.ghin,
        player_name: golfer.player_name,
        handicap_index: golfer.handicap_index,
        club_name: golfer.club_name,
        association_name: golfer.association_name
      };
    } catch (error: any) {
      throw new Error(`Failed to retrieve golfer details: ${error.message}`);
    }
  }

  /**
   * Fetches scores for the specified GHIN number.
   */
  async getScores(ghinId: string, fromDate = '2020-01-01', toDate?: string): Promise<GhinScore[]> {
    if (!this.token) {
      await this.login();
    }

    const endStr = toDate || new Date().toISOString().split('T')[0];
    const url = `https://api.ghin.com/api/v1/scores/search.json?per_page=100&page=1&golfer_id=${ghinId}&from_date_played=${fromDate}&to_date_played=${endStr}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${this.token}`
        }
      });

      const scoresRaw = response.data?.Scores || response.data?.scores || [];
      return scoresRaw.map((s: any) => ({
        score_id: s.score_id || s.id,
        date_played: s.date_played || s.played_at,
        gross_score: s.gross_score || s.score,
        adjusted_gross_score: s.adjusted_gross_score || s.score_adjusted || s.gross_score,
        course_name: s.course_name || s.course_title,
        tee_name: s.tee_name || s.tee_title,
        course_rating: parseFloat(s.course_rating || s.rating),
        slope_rating: parseInt(s.slope_rating || s.slope),
        score_differential: parseFloat(s.score_differential || s.differential),
        used_for_handicap: !!s.used_for_handicap
      }));
    } catch (error: any) {
      throw new Error(`Failed to retrieve golfer scores: ${error.message}`);
    }
  }
}
