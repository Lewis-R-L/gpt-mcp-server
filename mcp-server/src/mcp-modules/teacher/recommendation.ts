import { MCPTool } from "mcp-server/src/interfaces";
import z, { ZodRawShape } from "zod";
import { render } from "ejs";
import { TEACHER_RECOMMENDATION_UI_URI } from "./recommendation-ui";

const RECOMMEND_LANGUAGE_ENUM = z.enum([
    'english', 'japanese', 'spanish', 'chinese', 'french',
    'italian', 'german', 'korean', 'russian', 'arabic', 'portuguese']);

type RecommendLanguage = z.infer<typeof RECOMMEND_LANGUAGE_ENUM>;

const LANGUAGE_LEVEL_7 = 'native';
const LANGUAGE_LEVEL_6 = 'C2';
const LANGUAGE_LEVEL_5 = 'C1';
const LANGUAGE_LEVEL_4 = 'B2';
const LANGUAGE_LEVEL_3 = 'B1';
const LANGUAGE_LEVEL_2 = 'A2';
const LANGUAGE_LEVEL_1 = 'beginner/A1';

const LANGUAGE_LEVEL_MAPPING: Record<number, string> = {
    7: LANGUAGE_LEVEL_7,
    6: LANGUAGE_LEVEL_6,
    5: LANGUAGE_LEVEL_5,
    4: LANGUAGE_LEVEL_4,
    3: LANGUAGE_LEVEL_3,
    2: LANGUAGE_LEVEL_2,
    1: LANGUAGE_LEVEL_1
}

const LEVEL_ENUM = z.enum([LANGUAGE_LEVEL_7, LANGUAGE_LEVEL_6, LANGUAGE_LEVEL_5, LANGUAGE_LEVEL_4, LANGUAGE_LEVEL_3, LANGUAGE_LEVEL_2, LANGUAGE_LEVEL_1]);

type LanguageLevel = z.infer<typeof LEVEL_ENUM>;
    
const TEACHER_RECOMMENDATION_INPUT_SCHEMA: ZodRawShape = {
    language: RECOMMEND_LANGUAGE_ENUM.describe('The language to search for teachers')
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
});

type RecommendedTeacherInfo = z.infer<typeof RECOMMENDED_TEACHER_INFO_SCHEMA>;
    
const TEACHER_RECOMMENDATION_OUTPUT_SCHEMA: ZodRawShape = {
    teachers: z.array(RECOMMENDED_TEACHER_INFO_SCHEMA).describe('The recommended teachers')
};

function convertRecommendedTeacher(teacherRecommendation: ItalkiAPIV2TeacherRecommendV4): RecommendedTeacherInfo {
    return {
        id: teacherRecommendation.user_info.user_id.toString(),
        profileUrl: `https://www.italki.com/teacher/${teacherRecommendation.user_info.user_id}`,
        avatarUrl: `https://imagesavatar-static01.italki.com/${teacherRecommendation.user_info.avatar_file_name}_Avatar.jpg`,
        nickName: teacherRecommendation.user_info.nickname,
        fromCountryId: teacherRecommendation.user_info.origin_country_id,
        videoThumbnailUrl: teacherRecommendation.teacher_info.video_pic_url,
        videoUrl: teacherRecommendation.teacher_info.video_url,
        teachLanguages: teacherRecommendation.teacher_info.teach_language.map(language => ({
            language: language.language as RecommendLanguage,
            level: (LANGUAGE_LEVEL_MAPPING[language.level] || LANGUAGE_LEVEL_1) as LanguageLevel,
        })),
        alsoSpeakLanguages: teacherRecommendation.teacher_info.also_speak.map(language => ({
            language: language.language as RecommendLanguage,
            level: (LANGUAGE_LEVEL_MAPPING[language.level] || LANGUAGE_LEVEL_1) as LanguageLevel,
        })),
        shortIntroduction: teacherRecommendation.teacher_info.short_signature,
        longIntroduction: `${teacherRecommendation.teacher_info.about_me}\n${teacherRecommendation.teacher_info.about_teacher}\n${teacherRecommendation.teacher_info.teaching_style}`,
        studentCount: teacherRecommendation.teacher_info.student_count,
        taughtLessonCount: teacherRecommendation.teacher_info.session_count,
        minUSDPriceInCents: teacherRecommendation.course_info.min_price,
    };
}

async function getRecommendedTeachers(language: string) {
    // Call the italki API to suggest teachers
    // The URL format is https://api.italki.com/api/v2/teacher/recommend_v4?language={language}
    const url = `https://api.italki.com/api/v2/teacher/recommend_v4?language=${language}`;
    console.log('Getting recommended teachers from URL: ' + url);
    const response = await fetch(url);
    const responseData: ItalkiAPIV2TeacherRecommendV4Response = await response.json();
    if (responseData.successs === 0) {
        throw new Error('Failed to get teacher recommendation');
    }
    const recommendedTeachers = responseData.data.map(convertRecommendedTeacher);
    return recommendedTeachers;
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
        const response = await fetch(url);
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
 * 将推荐教师列表中的图片和视频 URL 转换为 base64
 */
async function convertTeachersUrlsToBase64(teachers: RecommendedTeacherInfo[]): Promise<RecommendedTeacherInfo[]> {
    const convertedTeachers = await Promise.all(
        teachers.map(async (teacher) => {
            const [avatarBase64, videoThumbnailBase64] = await Promise.all([
                urlToBase64(teacher.avatarUrl),
                urlToBase64(teacher.videoThumbnailUrl)
            ]);
            return {
                ...teacher,
                avatarUrl: avatarBase64,
                videoThumbnailUrl: videoThumbnailBase64
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
        description: "Get teacher recommendation for a given language on italki platform. Only teachers with teaching language in the enum of language field of the input schema are supported. The returned text will be a text version of the teachers' profile which may be a little bit different from the structured output. Each time you call this tool, it will return the latest suggested teachers, which may be different from the previous call. This tool doesn't support searching with criteria, which will be provided by another tool in the future. So don't try to search with criteria.",
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

        // Get teacher recommendation
        const recommendedTeachers = await getRecommendedTeachers(validatedArgs.data.language);
        
        // Convert image and video URLs to base64 for structuredContent
        const recommendedTeachersWithBase64 = await convertTeachersUrlsToBase64(recommendedTeachers);
        
        // Use original URLs for text rendering (to keep text readable)
        const recommendedTeachersText = getTextForRecommendedTeachers(validatedArgs.data.language, recommendedTeachers);
        
        return {
            content: [{ type: 'text', text: recommendedTeachersText }],
            structuredContent: {
                teachers: recommendedTeachersWithBase64
            }
        };
    }
};

export default TEACHER_RECOMMENDATION_TOOL;