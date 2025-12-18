/**
 * Map exam names to course tag codes
 * Exam -> Course Tag Code mapping based on i18n.ts
 */
export const EXAM_TO_TAG_CODE_MAP: Record<string, string> = {
    // Chinese exams
    "HSK": "T0060",
    // English exams
    "IELTS": "T0050",
    "TOEFL": "T0051",
    "TOEIC": "T0052",
    "FCE": "T0053",
    "BEC": "T0054",
    "PET": "T0055",
    "CAE": "T0056",
    "CPE": "T0057",
    "KET": "T0058",
    "ILEC": "T0059",
    "OET": "T0094",
    // Japanese exams
    "EJU": "T0071",
    "JLPT": "T0070",
    // Spanish exams
    "CELU": "T0067",
    "DELE": "T0066",
    // Korean exams
    "KLPT": "T0072",
    "TOPIK": "T0073",
    // Italian exams
    "PLIDA": "T0095",
    "CILS": "T0068",
    "CELI": "T0069",
    // German exams
    "TestDaF": "T0077",
    "DSH": "T0076",
    // French exams
    "DELF": "T0064",
    "TELC": "T0052", // Note: TELC might use T0052 or T0099, using T0052 as primary
    "TEF": "T0081",
    "TCF": "T0080",
    // Portuguese exams
    "CELPE-Bras": "T0078",
    // Russian exams
    "TORFL": "T0074",
    // Arabic exams
    "ALPT": "T0075",
};

/**
 * Convert exam names to course tags for CA003 (Test Preparation) category
 * Returns array of tag codes that correspond to the exam names
 */
export function examToCourseTags(exams: string[]): string[] {
    return exams
        .map(exam => EXAM_TO_TAG_CODE_MAP[exam])
        .filter((tag): tag is string => tag !== undefined);
}

