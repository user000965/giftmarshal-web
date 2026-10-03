import { randomInt } from 'node:crypto';

/** 32 symbols with no I, O, 0 or 1, so codes survive being read aloud. Same alphabet as production. */
export const EVENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const EVENT_CODE_LENGTH = 6;
export const MAX_CODE_ATTEMPTS = 100;

const cryptoPick = (max: number): number => randomInt(max);

export function randomEventCode(pick: (max: number) => number = cryptoPick): string {
  let code = '';
  for (let i = 0; i < EVENT_CODE_LENGTH; i++) {
    code += EVENT_CODE_ALPHABET.charAt(pick(EVENT_CODE_ALPHABET.length));
  }
  return code;
}

export async function generateUniqueEventCode(
  isTaken: (code: string) => Promise<boolean>,
  pick: (max: number) => number = cryptoPick,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomEventCode(pick);
    if (!(await isTaken(code))) return code;
  }
  throw new Error(`Could not generate a unique event code after ${MAX_CODE_ATTEMPTS} attempts`);
}
