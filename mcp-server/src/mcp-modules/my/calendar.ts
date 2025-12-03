import { MCPTool } from "mcp-server/src/interfaces";
import z, { ZodRawShape } from "zod";
import { render } from "ejs";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol";
import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types";

const MY_CALENDAR_EVENTS_INPUT_SCHEMA: ZodRawShape = {
    startDatetime: z.string().describe('The start datetime of your query on the calendar events in ISO format'),
    endDatetime: z.string().describe('The end datetime of your query on the calendar events in ISO format'),
    showStudentEvents: z.boolean().describe('Whether to show student events in the query'),
    showTeacherEvents: z.boolean().describe('Whether to show teacher events in the query')
};

const MY_CALENDAR_EVENTS_INPUT_TYPE = z.object(MY_CALENDAR_EVENTS_INPUT_SCHEMA);

type MyCalendarEventsInput = z.infer<typeof MY_CALENDAR_EVENTS_INPUT_TYPE>;

const MY_CALENDAR_EVENT_TYPE_ENUM = z.enum([
    'one_on_one_lesson',
    'group_lesson',
    'teacher_invited_lesson'
]);
type MyCalendarEventType = z.infer<typeof MY_CALENDAR_EVENT_TYPE_ENUM>;

const ONE_ON_ONE_LESSON_STATUS_FINISHED = 'finished';

const ONE_ON_ONE_LESSON_STATUS_MAPPING: Record<string, string> = {
    'F': ONE_ON_ONE_LESSON_STATUS_FINISHED
};

const CALENDAR_EVENT_STATUS_ENUM = z.enum([ONE_ON_ONE_LESSON_STATUS_FINISHED]);
type CalendarEventStatus = z.infer<typeof CALENDAR_EVENT_STATUS_ENUM>;

const USER_INFO_SCHEMA = z.object({
    id: z.string().describe('The ID of the user'),
    nickName: z.string().describe('The nickname of the user'),
    profileUrl: z.string().describe('The profile URL of the user on italki platform'),
    avatarUrl: z.string().describe('The avatar URL of the user on italki platform'),
    originCountryId: z.string().describe('The ID of the country where the user is from on italki platform'),
});

type UserInfo = z.infer<typeof USER_INFO_SCHEMA>;

const MY_CALENDAR_EVENT_SCHEMA = z.object({
    id: z.string().describe('The ID of the calendar event'),
    title: z.string().describe('The title of the calendar event'),
    start: z.date().describe('The start time of the calendar event'),
    end: z.date().describe('The end time of the calendar event'),
    duration: z.number().describe('The duration of the calendar event in minutes'),
    type: MY_CALENDAR_EVENT_TYPE_ENUM.describe('The type of the calendar event'),
    status: CALENDAR_EVENT_STATUS_ENUM.describe('The status of the calendar event'),
    student: USER_INFO_SCHEMA.describe('The student information of the calendar event'),
    teacher: USER_INFO_SCHEMA.describe('The teacher information of the calendar event')
});

type MyCalendarEvent = z.infer<typeof MY_CALENDAR_EVENT_SCHEMA>;
    
const MY_CALENDAR_EVENTS_OUTPUT_SCHEMA: ZodRawShape = {
    events: z.array(MY_CALENDAR_EVENT_SCHEMA).describe('The calendar events')
};

function convertMyOneOnOneLessonEvent(event: ItalkiAPIV2OneOnOneLessonEvent): MyCalendarEvent {
    return {
        id: 'OneOnOneLesson_' + event.session_id,
        title: event.course_title,
        start: new Date(event.session_start_time),
        end: new Date(event.session_end_time),
        duration: event.session_duration * 15,
        type: 'one_on_one_lesson',
        status: ONE_ON_ONE_LESSON_STATUS_MAPPING[event.status] as CalendarEventStatus,
        student: {
            id: event.student_id.toString(),
            profileUrl: `https://www.italki.com/user/${event.student_id}`,
            avatarUrl: `https://imagesavatar-static01.italki.com/${event.student_avartar_file_name}_Avatar.jpg`,
            nickName: event.student_nickname,
            originCountryId: event.student_origin_country_id,
        },
        teacher: {
            id: event.teacher_id.toString(),
            profileUrl: `https://www.italki.com/teacher/${event.teacher_id}`,
            avatarUrl: `https://imagesavatar-static01.italki.com/${event.teacher_avartar_file_name}_Avatar.jpg`,
            nickName: event.teacher_nickname,
            originCountryId: event.teacher_origin_country_id,
        }
    };
}

async function getMyCalendarEvents(oauthToken: string, startDate: Date, endDate: Date, showStudentEvents: boolean, showTeacherEvents: boolean) {
    // Call the italki API to get my calendar events
    // The URL format is https://api.italki.com/api/v2/fixme/user/my_calendar?start_time={startDate}&end_time={endDate}&as_student={showStudentEvents}&asTeacher={showTeacherEvents}
    const url = `https://api.italki.com/api/v2/fixme/user/my_calendar?start_time=${startDate.toISOString()}&end_time=${endDate.toISOString()}&as_student=${showStudentEvents?'1':'0'}&asTeacher=${showTeacherEvents?'1':'0'}`;
    console.log('Getting my calendar events from URL: ' + url);
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${oauthToken}`
        }
    });
    const responseData: ItalkiAPIV2MyCalendarEventsResponse = await response.json();
    if (responseData.successs === 0) {
        throw new Error('Failed to get my calendar events');
    }
    return responseData.data.lessons.map(convertMyOneOnOneLessonEvent);
}

const MY_CALENDAR_EVENTS_TEXT_RENDER_EJS_TEMPLATE = `
Here are <%=events.length%> calendar events.

<% events.forEach((event, index) => { %>
The event number <%=index + 1%> is "<%=event.title%>", whose ID is <%=event.id%>.
<% if (event.type === 'one_on_one_lesson') { %>
It's a one-on-one lesson.
<% } else if (event.type === 'group_lesson') { %>
It's a group lesson.
<% } else if (event.type === 'teacher_invited_lesson') { %>
It's a teacher invited lesson.
<% } %>
The start time of this event is <%=event.start%>.
The end time of this event is <%=event.end%>.
The duration of this event is <%=event.duration%> minutes.
<% if (event.status === 'finished') { %>
The status of this event is finished.
<% } %>
The student of this event is <%=event.student.nickName%>, whose ID is <%=event.student.id%>.
The profile URL of the student is <%=event.student.profileUrl%>.
The avatar URL of the student is <%=event.student.avatarUrl%>.
The origin country of the student is <%=event.student.originCountryId%>.
The teacher of this event is <%=event.teacher.nickName%>, whose ID is <%=event.teacher.id%>.
The profile URL of the teacher is <%=event.teacher.profileUrl%>.
The avatar URL of the teacher is <%=event.teacher.avatarUrl%>.
The origin country of the teacher is <%=event.teacher.originCountryId%>.
<% }) %>
`;

function getTextForMyCalendarEvents(events: MyCalendarEvent[]) {
    return render(MY_CALENDAR_EVENTS_TEXT_RENDER_EJS_TEMPLATE, { events });
}

const MY_CALENDAR_EVENTS_TOOL: MCPTool<ZodRawShape, ZodRawShape> = {
    name: 'my-calendar-events',
    type: 'tool',
    config: {
        title: 'Get my calendar events on italki platform',
        description: "Get my calendar events on italki platform. The returned text will be a text version of the calendar events which may be a little bit different from the structured output.",
        inputSchema: MY_CALENDAR_EVENTS_INPUT_SCHEMA,
        outputSchema: MY_CALENDAR_EVENTS_OUTPUT_SCHEMA,
        annotations: {
            tags: ['italki', 'calendar', 'events'],
            readOnlyHint: true,
        }
    },
    needAuthInfo: true,
    toolCallback: async (args: MyCalendarEventsInput, extra: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> => {
        // Verify the input
        const validatedArgs = MY_CALENDAR_EVENTS_INPUT_TYPE.safeParse(args);
        if (!validatedArgs.success) {
            throw new Error('Invalid input: ' + validatedArgs.error.message);
        }

        // Get my calendar events
        const events = await getMyCalendarEvents(extra.authInfo?.token, new Date(validatedArgs.data.startDatetime), new Date(validatedArgs.data.endDatetime), validatedArgs.data.showStudentEvents, validatedArgs.data.showTeacherEvents);
        return {
            content: [{ type: 'text', text: getTextForMyCalendarEvents(events) }],
            structuredContent: { events: events }
        };
    }
};

export default MY_CALENDAR_EVENTS_TOOL;