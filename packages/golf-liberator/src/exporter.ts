import * as fs from 'fs';
import * as path from 'path';
import { GhinScore } from './scraper.js';
import { HandicapResult } from './calculator.js';

export class GolfDataExporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  private ensureDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    const roundsDir = path.join(this.outputDir, 'rounds');
    if (!fs.existsSync(roundsDir)) {
      fs.mkdirSync(roundsDir, { recursive: true });
    }
  }

  /**
   * Exports scores to a CSV file.
   */
  exportToCsv(scores: GhinScore[], filename = 'scores.csv'): string {
    this.ensureDir();
    const filePath = path.join(this.outputDir, filename);
    const headers = [
      'Date Played',
      'Course Name',
      'Tee Name',
      'Gross Score',
      'Adjusted Gross Score',
      'Rating',
      'Slope',
      'Differential',
      'Used for Handicap'
    ];

    const rows = scores.map((s) => [
      s.date_played,
      `"${s.course_name.replace(/"/g, '""')}"`,
      s.tee_name,
      s.gross_score,
      s.adjusted_gross_score,
      s.course_rating,
      s.slope_rating,
      s.score_differential,
      s.used_for_handicap ? 'Yes' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    fs.writeFileSync(filePath, csvContent, 'utf-8');
    return filePath;
  }

  /**
   * Exports each round as a separate Markdown file with YAML frontmatter.
   */
  exportToMarkdown(scores: GhinScore[]): string[] {
    this.ensureDir();
    const exportedFiles: string[] = [];
    const roundsDir = path.join(this.outputDir, 'rounds');

    scores.forEach((s) => {
      // Clean course name for filename
      const cleanCourse = s.course_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const filename = `${s.date_played}_${cleanCourse}.md`;
      const filePath = path.join(roundsDir, filename);

      const content = `---
date: ${s.date_played}
course: "${s.course_name.replace(/"/g, '\\"')}"
tee: "${s.tee_name}"
rating: ${s.course_rating}
slope: ${s.slope_rating}
gross_score: ${s.gross_score}
adjusted_score: ${s.adjusted_gross_score}
differential: ${s.score_differential}
used_for_handicap: ${s.used_for_handicap}
---

# Round at ${s.course_name}
Played on **${s.date_played}** from the **${s.tee_name}** tees.

## Score Details
* **Gross Score:** ${s.gross_score}
* **Adjusted Gross Score:** ${s.adjusted_gross_score}
* **Course Rating:** ${s.course_rating}
* **Slope Rating:** ${s.slope_rating}
* **Calculated Differential:** ${s.score_differential}
* **Included in GHIN Handicap:** ${s.used_for_handicap ? 'Yes' : 'No'}

## Notes
*Add your thoughts on the round here (weather, swing cues, putting stats, greens in regulation, etc.).*
`;

      fs.writeFileSync(filePath, content, 'utf-8');
      exportedFiles.push(filePath);
    });

    return exportedFiles;
  }

  /**
   * Writes a master JSON file containing the full profile and local handicap index details.
   */
  exportSummary(
    golfer: { player_name: string; ghin: string; club_name?: string },
    handicap: HandicapResult,
    filename = 'summary.json'
  ): string {
    this.ensureDir();
    const filePath = path.join(this.outputDir, filename);
    const data = {
      exportedAt: new Date().toISOString(),
      golfer,
      handicap: {
        index: handicap.handicapIndex,
        roundsUsed: handicap.roundsCalculated,
        totalRounds: handicap.totalRounds,
        differentials: handicap.differentials
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }
}
