import z from "zod";
import languagesConfig from "./languages";
import countryConfig from "./country";

/**
 * Language Enum - All supported languages from languages.ts
 */
export const LANGUAGE_ENUM = z.enum(
    languagesConfig.languages as [string, ...string[]]
);

export type LanguageCode = z.infer<typeof LANGUAGE_ENUM>;

/**
 * Language Level Constants
 */
export const LANGUAGE_LEVEL_7 = 'native';
export const LANGUAGE_LEVEL_6 = 'C2';
export const LANGUAGE_LEVEL_5 = 'C1';
export const LANGUAGE_LEVEL_4 = 'B2';
export const LANGUAGE_LEVEL_3 = 'B1';
export const LANGUAGE_LEVEL_2 = 'A2';
export const LANGUAGE_LEVEL_1 = 'beginner/A1';

/**
 * Language Level Mapping - Maps numeric level to level string
 */
export const LANGUAGE_LEVEL_MAPPING: Record<number, string> = {
    7: LANGUAGE_LEVEL_7,
    6: LANGUAGE_LEVEL_6,
    5: LANGUAGE_LEVEL_5,
    4: LANGUAGE_LEVEL_4,
    3: LANGUAGE_LEVEL_3,
    2: LANGUAGE_LEVEL_2,
    1: LANGUAGE_LEVEL_1
};

/**
 * Language Level Enum - All supported language levels
 */
export const LEVEL_ENUM = z.enum([
    LANGUAGE_LEVEL_7,
    LANGUAGE_LEVEL_6,
    LANGUAGE_LEVEL_5,
    LANGUAGE_LEVEL_4,
    LANGUAGE_LEVEL_3,
    LANGUAGE_LEVEL_2,
    LANGUAGE_LEVEL_1
]);

export type LanguageLevel = z.infer<typeof LEVEL_ENUM>;

/**
 * Country Code Enum - All supported country codes from country.ts
 */
export const COUNTRY_CODE_ENUM = z.enum(
    countryConfig.countryCode as [string, ...string[]]
);

export type CountryCode = z.infer<typeof COUNTRY_CODE_ENUM>;

/**
 * Exam Enum - All supported exam names for exam preparation purpose
 */
export const EXAM_ENUM = z.enum([
    // Chinese exams
    "HSK",
    // English exams
    "TOEFL", "TOEIC", "IELTS", "FCE", "BEC", "PET", "CAE", "CPE", "KET", "ILEC", "OET",
    // Japanese exams
    "EJU", "JLPT",
    // Spanish exams
    "CELU", "DELE",
    // Korean exams
    "KLPT", "TOPIK",
    // Italian exams
    "PLIDA", "CILS", "CELI",
    // German exams
    "TestDaF", "DSH",
    // French exams
    "DELF", "TELC", "TEF", "TCF",
    // Portuguese exams
    "CELPE-Bras",
    // Russian exams
    "TORFL",
    // Arabic exams
    "ALPT",
]);

export type ExamCode = z.infer<typeof EXAM_ENUM>;
