import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { GhinScraper, GhinScore, GhinGolfer } from './scraper.js';
import { calculateHandicapIndex, RoundData } from './calculator.js';
import { GolfDataExporter } from './exporter.js';

// Load environment variables from .env if present
dotenv.config();

// Standard Mock Data for Offline/Zero-Day Mode
const MOCK_GOLFER: GhinGolfer = {
  ghin: '9999999',
  player_name: 'John Sovereign Doe',
  handicap_index: '8.4',
  club_name: 'Apogee Club',
  association_name: 'Sovereign Golf Association'
};

const MOCK_SCORES: GhinScore[] = [
  { score_id: 1, date_played: '2026-06-20', gross_score: 82, adjusted_gross_score: 82, course_name: 'Apogee West', tee_name: 'Championship', course_rating: 73.1, slope_rating: 138, score_differential: 7.3, used_for_handicap: false },
  { score_id: 2, date_played: '2026-06-14', gross_score: 79, adjusted_gross_score: 79, course_name: 'Apogee Pine', tee_name: 'Tournament', course_rating: 72.8, slope_rating: 135, score_differential: 5.2, used_for_handicap: false },
  { score_id: 3, date_played: '2026-06-08', gross_score: 85, adjusted_gross_score: 84, course_name: 'Grove XXIII', tee_name: 'Jordan', course_rating: 74.2, slope_rating: 140, score_differential: 7.9, used_for_handicap: false },
  { score_id: 4, date_played: '2026-06-02', gross_score: 88, adjusted_gross_score: 88, course_name: 'Pebble Beach', tee_name: 'Blue', course_rating: 74.3, slope_rating: 144, score_differential: 10.7, used_for_handicap: false },
  { score_id: 5, date_played: '2026-05-28', gross_score: 81, adjusted_gross_score: 81, course_name: 'Apogee West', tee_name: 'Championship', course_rating: 73.1, slope_rating: 138, score_differential: 6.5, used_for_handicap: false },
  { score_id: 6, date_played: '2026-05-20', gross_score: 84, adjusted_gross_score: 84, course_name: 'Seminole GC', tee_name: 'Back', course_rating: 73.8, slope_rating: 137, score_differential: 8.4, used_for_handicap: false },
  { score_id: 7, date_played: '2026-05-15', gross_score: 80, adjusted_gross_score: 80, course_name: 'Apogee Pine', tee_name: 'Tournament', course_rating: 72.8, slope_rating: 135, score_differential: 6.0, used_for_handicap: false },
  { score_id: 8, date_played: '2026-05-10', gross_score: 91, adjusted_gross_score: 89, course_name: 'Bethpage Black', tee_name: 'Blue', course_rating: 76.6, slope_rating: 148, score_differential: 9.5, used_for_handicap: false },
  { score_id: 9, date_played: '2026-05-04', gross_score: 83, adjusted_gross_score: 83, course_name: 'Grove XXIII', tee_name: 'Jordan', course_rating: 74.2, slope_rating: 140, score_differential: 7.1, used_for_handicap: false },
  { score_id: 10, date_played: '2026-04-28', gross_score: 86, adjusted_gross_score: 86, course_name: 'Pinehurst No. 2', tee_name: 'Blue', course_rating: 73.5, slope_rating: 136, score_differential: 10.4, used_for_handicap: false },
  { score_id: 11, date_played: '2026-04-22', gross_score: 78, adjusted_gross_score: 78, course_name: 'Apogee Pine', tee_name: 'Tournament', course_rating: 72.8, slope_rating: 135, score_differential: 4.4, used_for_handicap: false },
  { score_id: 12, date_played: '2026-04-15', gross_score: 83, adjusted_gross_score: 83, course_name: 'Apogee West', tee_name: 'Championship', course_rating: 73.1, slope_rating: 138, score_differential: 8.1, used_for_handicap: false },
  { score_id: 13, date_played: '2026-04-09', gross_score: 85, adjusted_gross_score: 85, course_name: 'National Golf Links', tee_name: 'Members', course_rating: 72.6, slope_rating: 132, score_differential: 10.6, used_for_handicap: false },
  { score_id: 14, date_played: '2026-04-02', gross_score: 80, adjusted_gross_score: 80, course_name: 'Seminole GC', tee_name: 'Back', course_rating: 73.8, slope_rating: 137, score_differential: 5.1, used_for_handicap: false },
  { score_id: 15, date_played: '2026-03-27', gross_score: 89, adjusted_gross_score: 88, course_name: 'Apogee West', tee_name: 'Championship', course_rating: 73.1, slope_rating: 138, score_differential: 12.2, used_for_handicap: false },
  { score_id: 16, date_played: '2026-03-21', gross_score: 84, adjusted_gross_score: 84, course_name: 'Pebble Beach', tee_name: 'Blue', course_rating: 74.3, slope_rating: 144, score_differential: 7.6, used_for_handicap: false },
  { score_id: 17, date_played: '2026-03-15', gross_score: 83, adjusted_gross_score: 83, course_name: 'Grove XXIII', tee_name: 'Jordan', course_rating: 74.2, slope_rating: 140, score_differential: 7.1, used_for_handicap: false },
  { score_id: 18, date_played: '2026-03-08', gross_score: 86, adjusted_gross_score: 86, course_name: 'Apogee Pine', tee_name: 'Tournament', course_rating: 72.8, slope_rating: 135, score_differential: 11.0, used_for_handicap: false },
  { score_id: 19, date_played: '2026-03-01', gross_score: 80, adjusted_gross_score: 80, course_name: 'Pebble Beach', tee_name: 'Blue', course_rating: 74.3, slope_rating: 144, score_differential: 4.5, used_for_handicap: false },
  { score_id: 20, date_played: '2026-02-22', gross_score: 82, adjusted_gross_score: 82, course_name: 'Seminole GC', tee_name: 'Back', course_rating: 73.8, slope_rating: 137, score_differential: 6.8, used_for_handicap: false }
];

async function main() {
  console.log('\n=============================================');
  console.log('      SOVEREIGN GOLF DATA LIBERATOR v1.0     ');
  console.log('=============================================\n');

  const ghinUser = process.env.GHIN_EMAIL || process.env.GHIN_NUMBER || '';
  const ghinPass = process.env.GHIN_PASSWORD || '';
  const targetGhin = process.env.GHIN_TARGET_NUMBER || ghinUser;

  const isMockMode = !ghinUser || !ghinPass || process.argv.includes('--mock');

  let golfer: GhinGolfer;
  let scores: GhinScore[];

  const outputDir = path.resolve('./export');

  if (isMockMode) {
    console.log('⚠️  No active GHIN credentials found in .env, or --mock flag set.');
    console.log('👉 Running in OFFLINE / MOCK MODE demonstrating Apogee & Grove XXIII rounds.\n');
    golfer = MOCK_GOLFER;
    scores = MOCK_SCORES;
  } else {
    console.log(`🔐 Authenticating with api.ghin.com as golfer: ${ghinUser}...`);
    try {
      const scraper = new GhinScraper(ghinUser, ghinPass);
      await scraper.login();
      console.log('✅ Authentication Successful.');
      console.log(`📡 Fetching profile and scoring history for GHIN: ${targetGhin}...`);
      golfer = await scraper.getGolferDetails(targetGhin);
      scores = await scraper.getScores(targetGhin);
      console.log(`✅ Retrieved details for ${golfer.player_name} and loaded ${scores.length} scores.`);
    } catch (error: any) {
      console.error(`❌ Connection failed: ${error.message}`);
      console.log('👉 Falling back to Mock Demo Data to showcase functionality.\n');
      golfer = MOCK_GOLFER;
      scores = MOCK_SCORES;
    }
  }

  // Calculate local WHS handicap
  console.log('🧮 Calculating local World Handicap System (WHS) index...');
  const roundsInput: RoundData[] = scores.map((s) => ({
    date: s.date_played,
    grossScore: s.gross_score,
    adjustedGrossScore: s.adjusted_gross_score,
    courseRating: s.course_rating,
    slopeRating: s.slope_rating,
    courseName: s.course_name,
    teeName: s.tee_name
  }));

  const localHandicap = calculateHandicapIndex(roundsInput);

  // Apply the "used in handicap" flag back to the scores for correct export tags
  scores.forEach((s) => {
    const calcMatch = localHandicap.differentials.find(
      (d) => d.date === s.date_played && d.courseName === s.course_name && d.grossScore === s.gross_score
    );
    if (calcMatch) {
      s.used_for_handicap = calcMatch.usedInHandicap;
    }
  });

  // Export files
  console.log(`💾 Exporting data to local directory: ${outputDir}...`);
  const exporter = new GolfDataExporter(outputDir);
  const csvPath = exporter.exportToCsv(scores);
  const mdFiles = exporter.exportToMarkdown(scores);
  const summaryPath = exporter.exportSummary(golfer, localHandicap);

  console.log('\n=============================================');
  console.log('             SOVEREIGN LEDGER REPORT         ');
  console.log('=============================================');
  console.log(` Golfer Name : ${golfer.player_name}`);
  console.log(` GHIN Number : ${golfer.ghin}`);
  console.log(` Club Home   : ${golfer.club_name || 'Independent'}`);
  console.log(` Association : ${golfer.association_name || 'Sovereign Network'}`);
  console.log('---------------------------------------------');
  console.log(` Official GHIN Index : ${golfer.handicap_index}`);
  console.log(` Sovereign SHI Index : ${localHandicap.handicapIndex} (calculated locally)`);
  console.log('---------------------------------------------');
  console.log(' RECENT SCORE CARD SUMMARY (Max 20 Rounds):');
  console.log('---------------------------------------------');
  console.log('  USE  | DATE       | COURSE (TEE)             | SCORE | SLOPE | DIFF');
  console.log('---------------------------------------------');

  localHandicap.differentials.forEach((d) => {
    const useIndicator = d.usedInHandicap ? ' [x] ' : ' [ ] ';
    const courseTrunc = d.courseName.length > 24 ? d.courseName.substring(0, 21) + '...' : d.courseName;
    console.log(
      `${useIndicator} | ${d.date} | ${courseTrunc.padEnd(24)} | ${String(d.grossScore).padStart(5)} | ${String(scores.find(s=>s.course_name===d.courseName)?.slope_rating || 113).padStart(5)} | ${d.differential.toFixed(1).padStart(5)}`
    );
  });

  console.log('---------------------------------------------');
  console.log(` WHS Formula: Avg of lowest ${localHandicap.roundsCalculated} diffs of the last ${localHandicap.totalRounds > 20 ? 20 : localHandicap.totalRounds} rounds.`);
  console.log('---------------------------------------------');
  console.log(' EXPORTED FILE SUMMARY:');
  console.log(` 1. CSV Ledger     : ${csvPath}`);
  console.log(` 2. Summary JSON   : ${summaryPath}`);
  console.log(` 3. Markdown Files : ${mdFiles.length} individual rounds written to /rounds/`);
  console.log('=============================================\n');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
});
