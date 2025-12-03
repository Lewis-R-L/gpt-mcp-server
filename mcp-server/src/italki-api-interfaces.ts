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