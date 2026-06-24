export interface RoundData {
  date: string;
  grossScore: number;
  adjustedGrossScore?: number;
  courseRating: number;
  slopeRating: number;
  courseName: string;
  teeName: string;
}

export interface HandicapResult {
  handicapIndex: number;
  roundsCalculated: number;
  totalRounds: number;
  differentials: Array<{
    date: string;
    courseName: string;
    grossScore: number;
    differential: number;
    usedInHandicap: boolean;
  }>;
}

/**
 * Calculates the score differential for a single round.
 * Formula: (113 / Slope) * (Adjusted Gross Score - Course Rating)
 */
export function calculateDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number
): number {
  if (slopeRating <= 0) return 0;
  const rawDiff = (113 / slopeRating) * (adjustedGrossScore - courseRating);
  // Round to one decimal place
  return Math.round(rawDiff * 10) / 10;
}

/**
 * Calculates the WHS Handicap Index from a list of rounds.
 */
export function calculateHandicapIndex(rounds: RoundData[]): HandicapResult {
  if (rounds.length < 3) {
    throw new Error('A minimum of 3 rounds is required to calculate a WHS Handicap Index.');
  }

  // 1. Sort rounds by date descending (most recent first)
  const sortedRounds = [...rounds].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 2. Select the most recent 20 rounds
  const recentRounds = sortedRounds.slice(0, 20);

  // 3. Compute differentials for each recent round
  const roundsWithDiffs = recentRounds.map((r) => {
    const adjScore = r.adjustedGrossScore !== undefined ? r.adjustedGrossScore : r.grossScore;
    const diff = calculateDifferential(adjScore, r.courseRating, r.slopeRating);
    return {
      date: r.date,
      courseName: r.courseName,
      grossScore: r.grossScore,
      differential: diff,
      usedInHandicap: false
    };
  });

  // 4. Determine how many differentials to use based on WHS rules
  const count = roundsWithDiffs.length;
  let numToUse = 8;
  let adjustment = 0;

  if (count === 3) {
    numToUse = 1;
    adjustment = -2.0;
  } else if (count === 4) {
    numToUse = 1;
    adjustment = -1.0;
  } else if (count === 5) {
    numToUse = 1;
    adjustment = 0;
  } else if (count === 6) {
    numToUse = 2;
    adjustment = -1.0;
  } else if (count >= 7 && count <= 8) {
    numToUse = 2;
    adjustment = 0;
  } else if (count >= 9 && count <= 11) {
    numToUse = 3;
    adjustment = 0;
  } else if (count >= 12 && count <= 14) {
    numToUse = 4;
    adjustment = 0;
  } else if (count >= 15 && count <= 16) {
    numToUse = 5;
    adjustment = 0;
  } else if (count >= 17 && count <= 18) {
    numToUse = 6;
    adjustment = 0;
  } else if (count === 19) {
    numToUse = 7;
    adjustment = 0;
  } else {
    numToUse = 8;
    adjustment = 0;
  }

  // 5. Sort the recent rounds by differential ascending to select the lowest
  const sortedByDiff = [...roundsWithDiffs]
    .map((r, index) => ({ ...r, originalIndex: index }))
    .sort((a, b) => a.differential - b.differential);

  // Mark the ones used in the calculation
  for (let i = 0; i < numToUse; i++) {
    const origIndex = sortedByDiff[i].originalIndex;
    roundsWithDiffs[origIndex].usedInHandicap = true;
  }

  // 6. Calculate the average of the selected lowest differentials
  const selectedDiffs = sortedByDiff.slice(0, numToUse);
  const sum = selectedDiffs.reduce((acc, curr) => acc + curr.differential, 0);
  const average = sum / numToUse;

  // Apply WHS adjustment (caps are normally applied for steep increases, but for basic calculation we round average + adjustment)
  let finalIndex = average + adjustment;

  // Round to one decimal place
  finalIndex = Math.round(finalIndex * 10) / 10;

  // Handicap index cannot go below -10.0 (or whatever floor) and normally is positive/negative
  return {
    handicapIndex: finalIndex,
    roundsCalculated: numToUse,
    totalRounds: rounds.length,
    differentials: roundsWithDiffs
  };
}
