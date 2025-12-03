import z, { ZodRawShape } from "zod";
import { MCPTool } from "../../interfaces";
import { render } from "ejs";

let allLanguageList: string[] | null = null;

async function getAllLanguageList(): Promise<string[]> {
    if (allLanguageList) {
        return allLanguageList;
    }
    const response = await fetch('https://api.italki.com/api/v2/config/all_language');
    const responseData: ItalkiAPIV2AllLanguageListResponse = await response.json();
    allLanguageList = responseData.data.languages.map(language => language.text_code);
    return allLanguageList;
}

const ALL_TAUGHT_LANGUAGES_OUTPUT_SCHEMA: ZodRawShape = {
    languages: z.array(z.string()).describe('The list of all languages that can be taught on italki platform'),
};

const ALL_TAUGHT_LANGUAGES_TEXT_RENDER_EJS_TEMPLATE = `
Here are <%=languages.length%> languages that can be taught on italki platform.
<% languages.forEach((language, index) => { %>
<%=index + 1%>. <%=language%>
<% }) %>
`;

const ALL_TAUGHT_LANGUAGES_TOOL: MCPTool<undefined, ZodRawShape> = {
    name: 'all-taught-languages',
    type: 'tool',
    config: {
        title: 'All languages that can be taught on italki platform',
        description: 'All languages that can be taught on italki platform.',
        annotations: {
            readOnlyHint: true,
            tags: ['italki', 'language', 'metadata'],
        },
        outputSchema: ALL_TAUGHT_LANGUAGES_OUTPUT_SCHEMA,
    },
    toolCallback: async () => {
        const languages = await getAllLanguageList();
        return {
            content: [{ type: 'text', text: render(ALL_TAUGHT_LANGUAGES_TEXT_RENDER_EJS_TEMPLATE, { languages }) }],
            structuredContent: {
                languages: languages
            }
        };
    }
};

export default ALL_TAUGHT_LANGUAGES_TOOL;