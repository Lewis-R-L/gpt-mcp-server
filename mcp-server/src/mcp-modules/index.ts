import { MCPModule } from '../interfaces';

// import { default as SYSTEM_PING_TOOL } from './system/ping';
import { default as ALL_TAUGHT_LANGUAGES_TOOL } from './metadata/all-language';
import { default as ALL_COUNTRIES_TOOL } from './metadata/all-countries';
import { default as TEACHER_RECOMMENDATION_TOOL } from './teacher/recommendation';
import { default as TEACHER_RECOMMENDATION_UI_RESOURCE } from './teacher/recommendation-ui';
// import { default as TEACHER_SEARCH_CATEGORY_TOOL } from './teacher/search-category';
// import { default as MY_CALENDAR_EVENTS_TOOL } from './my/calendar';

export const MCP_MODULES: Array<MCPModule> = [
    // SYSTEM_PING_TOOL,
    ALL_TAUGHT_LANGUAGES_TOOL,
    ALL_COUNTRIES_TOOL,
    TEACHER_RECOMMENDATION_TOOL,
    TEACHER_RECOMMENDATION_UI_RESOURCE,
    // TEACHER_SEARCH_CATEGORY_TOOL,
    // MY_CALENDAR_EVENTS_TOOL
];