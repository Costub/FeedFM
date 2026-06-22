import "server-only";

import { AppError, AUDIO_GENERATION_ERROR } from "@/lib/errors";
import { MAX_TTS_SCRIPT_LENGTH } from "@/lib/security/validation";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const smallNumbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const tens = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

function numberToWords(value: number): string {
  if (value < 20) {
    return smallNumbers[value];
  }

  if (value < 100) {
    const ten = Math.floor(value / 10);
    const rest = value % 10;
    return rest ? `${tens[ten]} ${smallNumbers[rest]}` : tens[ten];
  }

  if (value < 1000) {
    const hundred = Math.floor(value / 100);
    const rest = value % 100;
    return rest
      ? `${smallNumbers[hundred]} hundred ${numberToWords(rest)}`
      : `${smallNumbers[hundred]} hundred`;
  }

  if (value < 10000) {
    const thousand = Math.floor(value / 1000);
    const rest = value % 1000;
    return rest
      ? `${smallNumbers[thousand]} thousand ${numberToWords(rest)}`
      : `${smallNumbers[thousand]} thousand`;
  }

  return value.toLocaleString("en-US");
}

function normalizeDate(month: string, day: string, year: string) {
  const monthIndex = Number(month) - 1;
  const dayNumber = Number(day);
  const yearNumber = Number(year);

  if (monthIndex < 0 || monthIndex > 11 || dayNumber < 1 || dayNumber > 31) {
    return `${month}/${day}/${year}`;
  }

  const fullYear = year.length === 2 ? 2000 + yearNumber : yearNumber;
  return `${months[monthIndex]} ${numberToWords(dayNumber)}, ${numberToWords(fullYear)}`;
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/(^|\n)\s{0,3}#{1,6}\s+/g, "$1")
    .replace(/(^|\n)\s{0,3}>\s?/g, "$1")
    .replace(/(^|\n)\s*[-*+]\s+/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

export function prepareScriptForTts(script: string): string {
  let prepared = stripMarkdown(script)
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/\b(source|post)\s*(card|link)\s*\d*\s*:/gi, " ")
    .replace(/\br\/([A-Za-z0-9_]+)/g, "r slash $1")
    .replace(/@([A-Za-z0-9_]{1,15})/g, "$1")
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g, (_match, month, day, year) =>
      normalizeDate(month, day, year),
    )
    .replace(/\b(\d{1,4})%/g, (_match, value) => `${numberToWords(Number(value))} percent`)
    .replace(/\$([0-9]{1,4})\b/g, (_match, value) => `${numberToWords(Number(value))} dollars`)
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/%/g, " percent ")
    .replace(/\$/g, " dollars ")
    .replace(/[\u2012-\u2015]/g, ", ")
    .replace(/[;:]+/g, ". ")
    .replace(/\.\.\.+/g, ". ")
    .replace(/\s*\|\s*/g, ". ")
    .replace(/\p{Extended_Pictographic}/gu, " ");

  prepared = prepared
    .replace(/\b([0-9]{1,4})\b/g, (_match, value) => numberToWords(Number(value)));

  prepared = prepared
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([.!?])\s+(?=(Now|Next|Meanwhile|Finally|To wrap|Bottom line)\b)/g, "$1\n\n")
    .trim();

  if (prepared.length > MAX_TTS_SCRIPT_LENGTH) {
    prepared = prepared.slice(0, MAX_TTS_SCRIPT_LENGTH).replace(/\s+\S*$/, "").trim();
  }

  if (prepared.length < 80) {
    throw new AppError({
      code: "INVALID_INPUT",
      provider: "elevenlabs",
      status: 400,
      userMessage: AUDIO_GENERATION_ERROR,
      internalMessage: "tts script empty or too short after preparation",
      retryable: false,
    });
  }

  return prepared;
}
