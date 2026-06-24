import { usePulseStore, type MoodAxes } from '../../store/usePulseStore';

const AXES: Array<{ key: keyof MoodAxes; leftLabel: string; rightLabel: string }> = [
  { key: 'warmCold',       leftLabel: 'Warm',    rightLabel: 'Cold'      },
  { key: 'denseAiry',      leftLabel: 'Dense',   rightLabel: 'Airy'      },
  { key: 'loudRestrained', leftLabel: 'Loud',    rightLabel: 'Restrained' },
  { key: 'playfulPrecise', leftLabel: 'Playful', rightLabel: 'Precise'   },
];

export function MoodAxesSection() {
  const moodAxes = usePulseStore(s => s.moodAxes);
  const setMoodAxis = usePulseStore(s => s.setMoodAxis);

  return (
    <div className="mood-sliders">
      {AXES.map(({ key, leftLabel, rightLabel }) => (
        <div key={key}>
          <div className="mood-labels">
            <span>{leftLabel}</span>
            <span>{rightLabel}</span>
          </div>
          <div className="mood-slider-row">
            <input
              type="range"
              min={0}
              max={100}
              value={moodAxes[key]}
              onChange={e => setMoodAxis(key, Number(e.target.value))}
              className="mood-range"
              aria-label={`${leftLabel} to ${rightLabel}`}
            />
            <span className="mood-value">{moodAxes[key]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
