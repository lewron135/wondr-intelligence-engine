// All functions return arrays of the exact same length as the input.
// Positions where insufficient history exists are filled with null.

export function calcSMA(
  closes: number[],
  period: number
): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export function calcRSI(
  closes: number[],
  period = 14
): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) avgGain += delta;
    else avgLoss += Math.abs(delta);
  }
  avgGain /= period;
  avgLoss /= period;

  const firstRS = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + firstRS);

  // Wilder's exponential smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs);
  }

  return result;
}

// Seeded EMA — seeds from SMA of the first `period` values, then applies EMA.
function ema(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period) return result;

  const seed = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = seed;

  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + (result[i - 1] as number) * (1 - k);
  }
  return result;
}

export function calcMACD(closes: number[]): {
  macdLine: (number | null)[];
  macdSignal: (number | null)[];
  macdHist: (number | null)[];
} {
  const n = closes.length;
  const macdLine: (number | null)[] = new Array(n).fill(null);
  const macdSignal: (number | null)[] = new Array(n).fill(null);
  const macdHist: (number | null)[] = new Array(n).fill(null);

  if (n < 26) return { macdLine, macdSignal, macdHist };

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  // Collect MACD values for the signal EMA seed
  const macdValues: number[] = [];
  const macdIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      const val = (ema12[i] as number) - (ema26[i] as number);
      macdLine[i] = val;
      macdValues.push(val);
      macdIndices.push(i);
    }
  }

  if (macdValues.length < 9) return { macdLine, macdSignal, macdHist };

  // 9-period EMA of MACD values → Signal line
  const signalSeed =
    macdValues.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  const k = 2 / (9 + 1);
  let prev = signalSeed;

  for (let j = 8; j < macdValues.length; j++) {
    const sigVal = j === 8 ? signalSeed : macdValues[j] * k + prev * (1 - k);
    prev = sigVal;
    const idx = macdIndices[j];
    macdSignal[idx] = sigVal;
    macdHist[idx] = macdValues[j] - sigVal;
  }

  return { macdLine, macdSignal, macdHist };
}

export function calcBollingerBands(
  closes: number[],
  period = 20
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const middle: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance =
      slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    middle[i] = mean;
    upper[i] = mean + 2 * std;
    lower[i] = mean - 2 * std;
  }

  return { upper, middle, lower };
}
