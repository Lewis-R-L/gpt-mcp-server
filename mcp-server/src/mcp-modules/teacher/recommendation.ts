import { MCPTool } from "mcp-server/src/interfaces";
import z, { ZodRawShape } from "zod";
import { render } from "ejs";
import { TEACHER_RECOMMENDATION_UI_URI } from "./recommendation-ui";
import { fetchWithTimeout } from "../../utils/fetch-with-timeout";
import {
    LANGUAGE_ENUM,
    LanguageCode,
    LANGUAGE_LEVEL_7,
    LANGUAGE_LEVEL_1,
    LANGUAGE_LEVEL_MAPPING,
    LEVEL_ENUM,
    LanguageLevel,
    COUNTRY_CODE_ENUM,
    CountryCode,
    EXAM_ENUM,
    ExamCode,
} from "../../config/language-types";
    
const TEACHER_RECOMMENDATION_INPUT_SCHEMA: ZodRawShape = {
    language: LANGUAGE_ENUM.describe('The target language the user wants to learn (single value, lowercase English). **Example:** `"learning Spanish"` → `"spanish"` '),
    fromCountryId: z
        .array(COUNTRY_CODE_ENUM)
        .optional()
        .describe("Optional. Teachers' origin country of origin/nationality (array, ISO country codes, e.g. ['JP', 'US', 'KR', 'IE']). Pay special attention when the user mentions **accent learning** and extract the relevant country if specified. **Example:** `\"British accent\"` → `[\"GB\"]`"),
    alsoSpeak: z
        .array(LANGUAGE_ENUM)
        .optional()
        .describe("Optional. Filter teachers by languages they also speak (array of languages)., like ['french', 'mandarin'], if the input language like 'mandarin' not in LANGUAGE_ENUM, you should not filter teachers by mandarin, change it to 'chinese'"),
    is_native: z
        .number()
        .optional()
        .describe("Optional. Filter teachers by whether they are native speakers. 1 indicates native speaker, 0 or undefined indicates any teacher."),
    min_price: z
        .number()
        .optional()
        .describe("Optional. Minimum price filter in **cents (USD)**. Extract **only the numeric value** from the price mentioned by the user, **without any currency symbol or unit**. **Important:** (1) The value must be in cents (USD) as an integer. (2) If the user inputs prices in other currencies (e.g., CNY, EUR, GBP), you must convert them to USD cents using the current exchange rate and round to the nearest integer. (3) If the user already mentions USD/dollar prices, convert dollars to cents (multiply by 100). (4) Recognize various price expressions: \"大于\", \"more than\", \"above\", \"at least\", \"from\", \"starting at\", etc. (5) **If the user mentions a price range** (e.g., \"5 to 10\", \"between 5 and 10\", \"5-10\"), **extract the minimum value** from the range for min_price. (6) If only one value is given, fill the corresponding field and leave the other empty. **Example:** `\"价格大于5元\"` → convert CNY to USD → convert USD to cents → `\"min_price\": \"...\"`, `\"价格5到10元\"` → `\"min_price\": \"...\" (5 converted)`, `\"价格大于5元小于250元\"` → `\"min_price\": \"...\", \"max_price\": \"...\"`, `\"$10 minimum\"` → `\"min_price\": \"1000\"`"),
    max_price: z
        .number()
        .optional()
        .describe("Optional. Maximum price filter in **cents (USD)**. Extract **only the numeric value** from the price mentioned by the user, **without any currency symbol or unit**. **Important:** (1) The value must be in cents (USD) as an integer. (2) If the user inputs prices in other currencies (e.g., CNY, EUR, GBP), you must convert them to USD cents using the current exchange rate and round to the nearest integer. (3) If the user already mentions USD/dollar prices, convert dollars to cents (multiply by 100). (4) Recognize various price expressions: \"不超过\", \"不超过\", \"less than\", \"below\", \"under\", \"up to\", \"maximum\", \"at most\", \"no more than\", etc. (5) **If the user mentions a price range** (e.g., \"5 to 10\", \"between 5 and 10\", \"5-10\"), **extract the maximum value** from the range for max_price.  (6) If only one value is given, fill the corresponding field and leave the other empty. **Example:** `\"价格不超过250元\"` → convert CNY to USD → convert USD to cents → `\"max_price\": \"...\"`, `\"价格5到10元\"` → `\"max_price\": \"...\" (10 converted)`, `\"价格大于5元小于250元\"` → `\"min_price\": \"...\", \"max_price\": \"...\"`, `\"under $20\"` → `\"max_price\": \"2000\"`"),
    exam: z
        .array(EXAM_ENUM)
        .optional()
        .describe("Optional. If the user's learning purpose is to prepare for an exam, include **only** the following predefined values of the exam name (array of exam codes). Chinese exams: `\"HSK\"`. English exams: `\"TOEFL\"`, `\"TOEIC\"`, `\"IELTS\"`, `\"FCE\"`, `\"BEC\"`, `\"PET\"`, `\"CAE\"`, `\"CPE\"`, `\"KET\"`, `\"ILEC\"`, `\"OET\"`. Japanese exams: `\"EJU\"`, `\"JLPT\"`. Spanish exams: `\"CELU\"`, `\"DELE\"`. Korean exams: `\"KLPT\"`, `\"TOPIK\"`. Italian exams: `\"PLIDA\"`, `\"CILS\"`, `\"CELI\"`. German exams: `\"TestDaF\"`, `\"DSH\"`. French exams: `\"DELF\"`, `\"TELC\"`, `\"TEF\"`, `\"TCF\"`. Portuguese exams: `\"CELPE-Bras\"`. Russian exams: `\"TORFL\"`. Arabic exams: `\"ALPT\"`. **Example:** `[\"IELTS\", \"TOEFL\"]`"),
};

const TEACHER_RECOMMENDATION_INPUT_TYPE = z.object(TEACHER_RECOMMENDATION_INPUT_SCHEMA);

type TeacherRecommendationInput = z.infer<typeof TEACHER_RECOMMENDATION_INPUT_TYPE>;


const LANGUAGE_CAPABILITY_SCHEMA = z.object({
    language: z.string().describe('The name of the language'),
    level: LEVEL_ENUM.describe('The level of the language equivalent to the European Language Framework')
});

const RECOMMENDED_TEACHER_INFO_SCHEMA = z.object({
    id: z.string().describe('The ID of the teacher'),
    profileUrl: z.string().describe('The profile URL of the teacher on italki platform'),
    avatarUrl: z.string().describe('The avatar URL of the teacher on italki platform'),
    nickName: z.string().describe('The nickname of the teacher'),
    fromCountryId: z.string().describe('The ID of the country where the teacher is from'),
    videoThumbnailUrl: z.string().describe('The video thumbnail URL of the teacher on italki platform'),
    videoUrl: z.string().describe('The video URL of the teacher on italki platform'),
    teachLanguages: z.array(LANGUAGE_CAPABILITY_SCHEMA).describe('The languages that the teacher can teach'),
    alsoSpeakLanguages: z.array(LANGUAGE_CAPABILITY_SCHEMA).describe('The languages that the teacher can also speak'),
    shortIntroduction: z.string().describe('The one-sentence introduction of the teacher'),
    longIntroduction: z.string().describe('The long introduction of the teacher'),
    studentCount: z.number().describe('The student count of the teacher on italki platform'),
    taughtLessonCount: z.number().describe('The taught lesson count of the teacher on italki platform'),
    minUSDPriceInCents: z.number().describe('The minimum USD price of the teacher on italki platform in cents'),
    rating: z.number().optional().describe('The overall rating of the teacher (e.g., 5.0)'),
});

type RecommendedTeacherInfo = z.infer<typeof RECOMMENDED_TEACHER_INFO_SCHEMA>;
    
const TEACHER_RECOMMENDATION_OUTPUT_SCHEMA: ZodRawShape = {
    teachers: z
        .array(RECOMMENDED_TEACHER_INFO_SCHEMA)
        .describe('The recommended teachers (max 4 items).')
};

/**
 * Map exam names to course tag codes
 * Exam -> Course Tag Code mapping based on i18n.ts
 */
const EXAM_TO_TAG_CODE_MAP: Record<string, string> = {
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
function examToCourseTags(exams: string[]): string[] {
    return exams
        .map(exam => EXAM_TO_TAG_CODE_MAP[exam])
        .filter((tag): tag is string => tag !== undefined);
}

function convertRecommendedTeacher(teacherRecommendation: ItalkiAPIV2TeacherRecommendV4): RecommendedTeacherInfo {
    const overallRating = parseFloat(teacherRecommendation.teacher_info.overall_rating || '0');
    return {
        id: teacherRecommendation.user_info.user_id.toString(),
        profileUrl: `https://www.italki.com/teacher/${teacherRecommendation.user_info.user_id}`,
        avatarUrl: `https://imagesavatar-static01.italki.com/${teacherRecommendation.user_info.avatar_file_name}_Avatar.jpg`,
        nickName: teacherRecommendation.user_info.nickname,
        fromCountryId: teacherRecommendation.user_info.origin_country_id,
        videoThumbnailUrl: teacherRecommendation.teacher_info.video_pic_url,
        videoUrl: teacherRecommendation.teacher_info.video_url,
        teachLanguages: teacherRecommendation.teacher_info.teach_language.map(language => ({
            language: language.language as LanguageCode,
            level: (LANGUAGE_LEVEL_MAPPING[language.level] || LANGUAGE_LEVEL_1) as LanguageLevel,
        })),
        alsoSpeakLanguages: teacherRecommendation.teacher_info.also_speak.map(language => ({
            language: language.language as LanguageCode,
            level: (LANGUAGE_LEVEL_MAPPING[language.level] || LANGUAGE_LEVEL_1) as LanguageLevel,
        })),
        shortIntroduction: teacherRecommendation.teacher_info.short_signature,
        longIntroduction: `${teacherRecommendation.teacher_info.about_me}\n${teacherRecommendation.teacher_info.about_teacher}\n${teacherRecommendation.teacher_info.teaching_style}`,
        studentCount: teacherRecommendation.teacher_info.student_count,
        taughtLessonCount: teacherRecommendation.teacher_info.session_count,
        minUSDPriceInCents: teacherRecommendation.course_info.min_price,
        rating: isNaN(overallRating) ? undefined : overallRating,
    };
}

async function getRecommendedTeachers(language: string) {
    // Call the italki API to suggest teachers
    // The URL format is https://api.italki.com/api/v2/teacher/recommend_v4?language={language}
    const url = `https://api.italki.com/api/v2/teacher/recommend_v4?language=${language}`;
    console.log('Getting recommended teachers from URL: ' + url);
    const response = await fetchWithTimeout(url);
    const responseData: ItalkiAPIV2TeacherRecommendV4Response = await response.json();
    if (responseData.successs === 0) {
        throw new Error('Failed to get teacher recommendation');
    }
    const recommendedTeachers = responseData.data.map(convertRecommendedTeacher);
    return recommendedTeachers;
}

/**
 * Convert teacher data from /api/v2/teachers endpoint to RecommendedTeacherInfo format
 */
function convertTeacherFromSearch(teacherData: ItalkiAPIV2TeachersResponseData): RecommendedTeacherInfo {
    const overallRating = parseFloat(teacherData.teacher_info.overall_rating || '0');
    return {
        id: teacherData.user_info.user_id.toString(),
        profileUrl: `https://www.italki.com/teacher/${teacherData.user_info.user_id}`,
        avatarUrl: `https://imagesavatar-static01.italki.com/${teacherData.user_info.avatar_file_name}_Avatar.jpg`,
        nickName: teacherData.user_info.nickname,
        fromCountryId: teacherData.user_info.origin_country_id,
        videoThumbnailUrl: teacherData.teacher_info.video_pic_url || teacherData.teacher_info.qiniu_video_pic_url,
        videoUrl: teacherData.teacher_info.video_url || teacherData.teacher_info.qiniu_video_url,
        teachLanguages: teacherData.teacher_info.teach_language.map(language => ({
            language: language.language as LanguageCode,
            level: (LANGUAGE_LEVEL_MAPPING[language.level] || LANGUAGE_LEVEL_1) as LanguageLevel,
        })),
        alsoSpeakLanguages: teacherData.teacher_info.also_speak.map(language => ({
            language: language.language as LanguageCode,
            level: (LANGUAGE_LEVEL_MAPPING[language.level] || LANGUAGE_LEVEL_1) as LanguageLevel,
        })),
        shortIntroduction: teacherData.teacher_info.short_signature,
        longIntroduction: `${teacherData.teacher_info.about_me}\n${teacherData.teacher_info.about_teacher}\n${teacherData.teacher_info.teaching_style}`,
        studentCount: teacherData.teacher_info.student_count,
        taughtLessonCount: teacherData.teacher_info.session_count,
        minUSDPriceInCents: teacherData.course_info.min_price,
        rating: isNaN(overallRating) ? undefined : overallRating,
    };
}

/**
 * Search teachers using /api/v2/teachers endpoint with filters
 */
interface GetTeachersParams {
    language: string;
    fromCountryId?: string[];
    courseCategory?: string[];
    courseTags?: string[];
    minPrice?: number;
    maxPrice?: number;
    isNative?: number;
    alsoSpeak?: string[];
    pageSize?: number;
    page?: number;
    userTimezone?: string;
}

async function getTeachers(params: GetTeachersParams): Promise<RecommendedTeacherInfo[]> {
    const url = 'https://api.italki.com/api/v2/teachers';
    console.log('Getting teachers from URL: ' + url);
    
    // Build request body directly from params
    const teacherInfo: any = {};
    if (params.fromCountryId && params.fromCountryId.length > 0) {
        teacherInfo.origin_country_id = params.fromCountryId;
    }
    if (params.courseCategory && params.courseCategory.length > 0) {
        teacherInfo.course_category = params.courseCategory;
    }
    if (params.courseTags && params.courseTags.length > 0) {
        teacherInfo.course_tags = params.courseTags;
    }

    const requestBody: ItalkiAPIV2TeachersRequest = {
        teach_language: {
            language: params.language,
            ...(params.minPrice !== undefined && { min_price: params.minPrice }),
            ...(params.maxPrice !== undefined && { max_price: params.maxPrice }),
            ...(params.isNative !== undefined && { is_native: params.isNative }),
        },
        ...(Object.keys(teacherInfo).length > 0 && { teacher_info: teacherInfo }),
        ...(params.alsoSpeak && params.alsoSpeak.length > 0 && { speak_language_and: params.alsoSpeak }),
        // ...(params.userTimezone && { user_timezone: params.userTimezone }),
        page_size: params.pageSize || 4,
        page: params.page || 1,
    };

    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
        },
        body: JSON.stringify(requestBody),
        timeoutMs: Number(process.env.ITALKI_FETCH_TIMEOUT_MS || 12000),
    });

    const responseData: ItalkiAPIV2TeachersResponse = await response.json();
    if (responseData.successs === 0) {
        throw new Error('Failed to get teacher recommendation');
    }
    
    if (!responseData.data || responseData.data.length === 0) {
        return [];
    }

    // Convert response data to RecommendedTeacherInfo format
    const teachers = responseData.data.map(convertTeacherFromSearch);
    
    // Convert avatar URLs to base64
    const teachersWithBase64Avatars = await convertTeachersUrlsToBase64(teachers);
    
    return teachersWithBase64Avatars;
}

const TEACHER_RECOMMENDATION_TEXT_RENDER_EJS_TEMPLATE = `
Here are <%=recommendedTeachers.length%> teachers recommended for learning language <%=language%>.

<% recommendedTeachers.forEach((teacher, index) => { %>
The teacher number <%=index + 1%> is "<%=teacher.nickName%>", whose ID is <%=teacher.id%>.
The profile URL of this teacher is <%=teacher.profileUrl%>.
The avatar URL of this teacher is <%=teacher.avatarUrl%>.
The video URL of this teacher is <%=teacher.videoUrl%> with the thumbnail URL <%=teacher.videoThumbnailUrl%>.
There are <%=teacher.teachLanguages.length%> language(s) taught by this teacher, which are:
<% teacher.teachLanguages.forEach((language, index) => { %>
<% if (language.level !== '${LANGUAGE_LEVEL_7}') { %>
<%=index + 1%>. <%=language.language%> with level <%=language.level%> equivalent to the European Language Framework
<% } else { %>
<%=index + 1%>. Native speaker of <%=language.language%>
<% } %>
<% }) %>
There are <%=teacher.alsoSpeakLanguages.length%> language(s) that this teacher can also speak, which are:
<% teacher.alsoSpeakLanguages.forEach((language, index) => { %>
<% if (language.level !== '${LANGUAGE_LEVEL_7}') { %>
<%=index + 1%>. <%=language.language%> with level <%=language.level%> equivalent to the European Language Framework
<% } else { %>
<%=index + 1%>. Native speaker of <%=language.language%>
<% } %>
<% }) %>
If using one sentence to describe this teacher, it should be "<%=teacher.shortIntroduction%>".
This teacher has <%=teacher.studentCount%> taught lessons on italki platform and has taught <%=teacher.taughtLessonCount%> lessons.
The minimum price of this teacher on italki platform is <%=teacher.minUSDPriceInCents/100%> USD.
If you want to know more, here is more information about this teacher:
"<%=teacher.longIntroduction%>"
<% }) %>
`;

function getTextForRecommendedTeachers(language: string, recommendedTeachers: RecommendedTeacherInfo[]) {
    return render(TEACHER_RECOMMENDATION_TEXT_RENDER_EJS_TEMPLATE, { language, recommendedTeachers });
}

/**
 * 将图片或视频 URL 转换为 base64 data URL
 */
async function urlToBase64(url: string): Promise<string> {
    try {
        const response = await fetchWithTimeout(url, { timeoutMs: Number(process.env.ITALKI_ASSET_FETCH_TIMEOUT_MS ?? 10000) });
        if (!response.ok) {
            console.warn(`Failed to fetch ${url}: ${response.statusText}`);
            return url; // 如果获取失败，返回原始 URL
        }
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error(`Error converting ${url} to base64:`, error);
        return url; // 如果出错，返回原始 URL
    }
}

/**
 * 将推荐教师列表中的头像 URL 转换为 base64
 * 注意：只转换头像图片（avatarUrl），不转换视频缩略图（videoThumbnailUrl）和视频（videoUrl）
 */
async function convertTeachersUrlsToBase64(teachers: RecommendedTeacherInfo[]): Promise<RecommendedTeacherInfo[]> {
    const convertedTeachers = await Promise.all(
        teachers.map(async (teacher) => {
            // 只转换头像 URL，不转换视频缩略图和视频 URL
            const avatarBase64 = await urlToBase64(teacher.avatarUrl);
            return {
                ...teacher,
                avatarUrl: avatarBase64
                // videoThumbnailUrl 和 videoUrl 保持不变，不转换为 base64
            };
        })
    );
    return convertedTeachers;
}

const TEACHER_RECOMMENDATION_TOOL: MCPTool<ZodRawShape, ZodRawShape> = {
    name: 'teacher-recommendation',
    type: 'tool',
    config: {
        title: 'Get teacher recommendation on italki platform',
        description: "Get teacher recommendation for a given language on italki platform (max 4 teachers). Optional filters are accepted (fromCountryId, alsoSpeak, availableTime). Note: current upstream API integration only supports filtering by language; optional filters are currently not applied server-side and are reserved for future expansion.",
        inputSchema: TEACHER_RECOMMENDATION_INPUT_SCHEMA,
        outputSchema: TEACHER_RECOMMENDATION_OUTPUT_SCHEMA,
        annotations: {
            tags: ['italki', 'teacher', 'recommendation'],
            readOnlyHint: true,
        },
        _meta: {
            "openai/outputTemplate": TEACHER_RECOMMENDATION_UI_URI,
            "openai/toolInvocation/invoking": "Displaying the recommended teacher list",
            "openai/toolInvocation/invoked": "The recommended teacher list has been displayed"
        }
    },
    toolCallback: async (args: TeacherRecommendationInput) => {
        // Verify the input
        const validatedArgs = TEACHER_RECOMMENDATION_INPUT_TYPE.safeParse(args);
        if (!validatedArgs.success) {
            throw new Error('Invalid input: ' + validatedArgs.error.message);
        }

        let recommendedTeachers: RecommendedTeacherInfo[];

        // Convert exam to course_tags if specified
        let courseTags: string[] | undefined;
        let courseCategory: string[] | undefined;
        if (validatedArgs.data.exam && validatedArgs.data.exam.length > 0) {
            const examTags = examToCourseTags(validatedArgs.data.exam);
            if (examTags.length > 0) {
                courseTags = examTags;
                courseCategory = ["CA003"]; // Test Preparation category
            }
        }

        // Build parameters directly from input
        const teachersParams: GetTeachersParams = {
            language: validatedArgs.data.language,
            fromCountryId: validatedArgs.data.fromCountryId,
            alsoSpeak: validatedArgs.data.alsoSpeak,
            isNative: validatedArgs.data.is_native,
            minPrice: validatedArgs.data.min_price,
            maxPrice: validatedArgs.data.max_price,
            courseCategory,
            courseTags,
            pageSize: 4,
        };

        recommendedTeachers = (await getTeachers(teachersParams)).slice(0, 4);
        
        // Use original URLs for text rendering (to keep text readable)
        const recommendedTeachersText = getTextForRecommendedTeachers(validatedArgs.data.language, recommendedTeachers);
        
        return {
            content: [{ type: 'text', text: recommendedTeachersText }],
            structuredContent: {
                teachers: recommendedTeachers
            }
        };
    }
};

export default TEACHER_RECOMMENDATION_TOOL;