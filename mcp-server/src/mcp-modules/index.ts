import { MCPModule } from '../interfaces';

import { default as SYSTEM_PING_TOOL } from './system/ping';
import { default as ALL_TAUGHT_LANGUAGES_TOOL } from './metadata/all-language';
import { default as TEACHER_RECOMMENDATION_TOOL } from './teacher/recommendation';
import { default as TEACHER_RECOMMENDATION_UI_RESOURCE } from './teacher/recommendation-ui';
import { default as MY_CALENDAR_EVENTS_TOOL } from './my/calendar';

export const MCP_MODULES: Array<MCPModule> = [
    SYSTEM_PING_TOOL,
    ALL_TAUGHT_LANGUAGES_TOOL,
    TEACHER_RECOMMENDATION_TOOL,
    TEACHER_RECOMMENDATION_UI_RESOURCE,
    MY_CALENDAR_EVENTS_TOOL
];