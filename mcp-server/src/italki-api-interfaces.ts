type ItalkiAPIV2ResponseSuccess = 1;
type ItalkiAPIV2ResponseError = 0;

type ItalkiAPIV2True = 1;
type ItalkiAPIV2False = 0;

type ItalkiAPIV2Boolean = ItalkiAPIV2True | ItalkiAPIV2False;

interface ItalkiAPIV2Response<T> {
    data: T;
    meta: {
        performance: number;
        sever_time: number;
        ver: string;
    }
    successs: ItalkiAPIV2ResponseSuccess | ItalkiAPIV2ResponseError;
}

interface ItalkiAPIV2LanguageLevel {
    language: string;
    level: number;
}

interface ItalkiAPIV2TeacherRecommendV4 {
    course_info: {
        has_trial: ItalkiAPIV2Boolean;
        min_price: number;
        trial_description: string;
        trial_price: number;
    };
    teacher_info: {
        about_me: string;
        about_teacher: string;
        also_speak: ItalkiAPIV2LanguageLevel[];
        apply_status: number;
        cancel_policy: string;
        cover_name: string;
        first_complete_time: string;
        first_valid_time: string;
        interest: string;
        intro: string;
        introduction: string;
        is_new: ItalkiAPIV2Boolean;
        is_student_full: number;
        overall_rating: string;
        pro_rating: string;
        qiniu_video_pic_url: string;
        qiniu_video_url: string;
        recording_permission: ItalkiAPIV2Boolean;
        session_count: number;
        short_signature: string;
        student_count: number;
        teach_language: ItalkiAPIV2LanguageLevel[];
        techer_child_tag_id_list: number[];
        teacher_material_list: number[];
        teacher_tag: string[];
        teaching_style: string;
        tutor_rating: string;
        video_pic_url: string;
        video_url: string;
    };
    user_info: {
        avatar_file_name: string;
        is_online: ItalkiAPIV2Boolean;
        is_pro: ItalkiAPIV2Boolean;
        is_tutor: ItalkiAPIV2Boolean;
        last_login_time: string;
        living_city_id: string;
        living_city_name: string;
        living_country_id: string;
        nickname: string;
        origin_city_id: string;
        origin_city_name: string;
        origin_country_id: string;
        origin_country_name: string;
        timezone: string;
        user_id: number;
    }
}

type ItalkiAPIV2TeacherRecommendV4Response = ItalkiAPIV2Response<ItalkiAPIV2TeacherRecommendV4[]>;

interface ItalkiAPIV2LanguageInfo {
    code: string;
    text_code: string;
}

interface ItalkiAPIV2AllLanguageList {
    languages: ItalkiAPIV2LanguageInfo[];
}

type ItalkiAPIV2AllLanguageListResponse = ItalkiAPIV2Response<ItalkiAPIV2AllLanguageList>;

interface ItalkiAPIV2OneOnOneLessonEvent {
    course_title: string;
    im_type: string;
    new_session_start_time?: string;
    new_session_end_time?: string;
    origin_session_start_time: string;
    origin_session_end_time: string;
    session_duration: number;
    session_start_time: string;
    session_end_time: string;
    session_id: number;
    session_label: string;
    session_label_code: string;
    session_language: string;
    status: string;
    student_id: number;
    student_avartar_file_name: string;
    student_nickname: string;
    student_origin_country_id: string;
    teacher_id: number;
    teacher_avartar_file_name: string;
    teacher_nickname: string;
    teacher_origin_country_id: string;
}

interface ItalkiAPIV2MyCalendarEvents {
    lessons: ItalkiAPIV2OneOnOneLessonEvent[];
}

type ItalkiAPIV2MyCalendarEventsResponse = ItalkiAPIV2Response<ItalkiAPIV2MyCalendarEvents>;

// Request types for /api/v2/teachers endpoint
interface ItalkiAPIV2TeachersRequest {
    teacher_info?: {
        origin_country_id?: string[];
        course_category?: string[];
        course_tags?: string[];
    };
    teach_language?: {
        language: string;
        max_price?: number;
        min_price?: number;
        is_native?: number;
    };
    speak_language_and?: string[];
    page_size?: number;
    user_timezone?: string;
    page?: number;
}



interface ItalkiAPIV2TeachersResponseData {
    is_favor: number;
    user_info: {
        user_id: number;
        nickname: string;
        avatar_file_name: string;
        is_tutor: number;
        is_pro: number;
        origin_country_id: string;
        is_online: number;
        living_country_id: string;
        origin_city_id: string;
        origin_city_name: string;
        living_city_id: string;
        living_city_name: string;
        timezone: string;
        last_login_time: string;
    };
    teacher_info: {
        video_url: string;
        video_pic_url: string;
        intro: string;
        short_signature: string;
        teach_language: ItalkiAPIV2LanguageLevel[];
        also_speak: ItalkiAPIV2LanguageLevel[];
        first_valid_time: string;
        session_count: number;
        pro_rating: string;
        tutor_rating: string;
        overall_rating: string;
        qiniu_video_url: string;
        cover_name: string;
        instant_lesson_status: number;
        qiniu_video_pic_url: string;
        teacher_material_list: number[];
        is_new: number;
        free_trial: number;
        has_trial: number;
        instant_now: number;
        introduction: string;
        about_me: string;
        about_teacher: string;
        teaching_style: string;
        is_student_full: number;
        student_count: number;
        teacher_tag: string[];
        teacher_child_tag_id_list: number[];
        cancel_policy: string;
        interest: string;
        apply_status: number;
        first_complete_time: string;
        exp_info?: Array<{
            industry: string;
            country: string;
            company: string;
            job: string;
            file_ext: string;
            file_path: string;
            start_year: number;
            end_year: number;
            status: number;
            create_time: string;
            exp_id: number;
        }>;
        edu_info?: Array<{
            institution: string;
            major: string;
            level: number;
            description: string;
            start_year: number;
            end_year: number;
            status: number;
            create_time: string;
            update_time: string;
            edu_id: string;
        }>;
        cert_info?: Array<{
            create_time: string;
            file_ext: string;
            file_path: string;
            institution: string;
            end_year: number;
            status: number;
            certificate: string;
            language: string;
            type: string;
            type_text_code: string;
            cert_id: string;
            description?: string;
        }>;
        specialty_cert?: Array<{
            institution: string;
            type: string;
            type_text_code: string;
            certificate: string;
            description: string;
            end_year: number;
            status: number;
            file_path: string;
            create_time: string;
            update_time: string;
            approve_time: string;
        }>;
        sorted_cert_info?: Array<{
            certificate: string;
            institution: string;
            end_year: number;
            status: number;
            description: string;
            type: string;
        }>;
        teaching_experience?: Array<{
            id: number;
            user_id: number;
            start_year: number;
            end_year: number;
            institution: string;
            institution_type: string;
            position: string;
            country: string;
            city: string;
            description: string;
            create_at: string;
            create_by: number;
            update_at: string;
            update_by: number;
            status: number;
        }>;
        offline_reason: string;
        personal_tag: string[];
        teacher_child_tag: string[];
        tools_statistics?: Array<{
            name: string;
            created_count: number;
        }>;
        recording_permission: number;
        beginner_friendly_tags: string[];
        available_time: string;
    };
    course_info: {
        trial_length: number;
        has_trial: number;
        trial_price: number;
        min_price: number;
        trial_session_count: number;
        trial_description: string;
    };
    exam_result_shown: {
        exam_shown_id: number;
        exam_type: number;
        level: string;
        score: number;
        show_badge: number;
        show_score: number;
        url_id: string;
        user_id: number;
    };
    pro_course_detail?: Array<{
        id: number;
        teacher_id: number;
        language: string;
        title: string;
        description: string;
        level_lower_limit: number;
        level_up_limit: number;
        course_category: string;
        course_tags: string[];
        session_price: number;
        student_count: number;
        session_count: number;
        create_time: string;
        has_package: number;
        price_list: Array<{
            package_price: number;
            session_price: number;
            course_id: number;
            package_length: number;
            session_length: number;
            course_price_id: number;
        }>;
    }>;
}

type ItalkiAPIV2TeachersResponse = ItalkiAPIV2Response<ItalkiAPIV2TeachersResponseData[]>;