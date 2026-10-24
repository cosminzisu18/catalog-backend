import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// letters (with Romanian diacritics), and single spaces, hyphens or
// apostrophes between parts: "Ana-Maria", "Popescu Ionescu", "O'Neil"
export const PERSON_NAME_REGEX =
  /^[A-Za-zĂÂÎȘȚŞŢăâîșțşţÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zĂÂÎȘȚŞŢăâîșțşţÀ-ÖØ-öø-ÿ]+)*$/;

export function IsPersonName() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
    ),
    IsString(),
    MinLength(2),
    MaxLength(80),
    Matches(PERSON_NAME_REGEX, {
      message: 'Numele poate contine doar litere, spatii, cratima sau apostrof',
    }),
  );
}
