import z, { ZodRawShape } from "zod";
import { MCPTool } from "../../interfaces";
import { render } from "ejs";
import { fetchWithTimeout } from "../../utils/fetch-with-timeout";

let allCountryList: string[] | null = null;

type ItalkiAPIV3AllCountryResponse = Array<{ code: string }>;

async function getAllCountryList(): Promise<string[]> {
    if (allCountryList) {
        return allCountryList;
    }
    const response = await fetchWithTimeout('https://api.italki.com/api/v3/client_conf/all_country');
    const responseData: ItalkiAPIV3AllCountryResponse = await response.json();
    // Convert from [{code: "HK"}, {code: "AD"}, ...] to ["HK", "AD", ...]
    allCountryList = responseData.map(country => country.code);
    return allCountryList;
}

const ALL_COUNTRIES_OUTPUT_SCHEMA: ZodRawShape = {
    countries: z.array(z.string()).describe('The list of all ISO country codes supported on italki platform'),
};

const ALL_COUNTRIES_TEXT_RENDER_EJS_TEMPLATE = `
Here are <%=countries.length%> country codes supported on italki platform.
<% countries.forEach((country, index) => { %>
<%=index + 1%>. <%=country%>
<% }) %>
`;

const ALL_COUNTRIES_TOOL: MCPTool<undefined, ZodRawShape> = {
    name: 'all-countries',
    type: 'tool',
    config: {
        title: 'All country codes supported on italki platform',
        description: 'All ISO country codes that are supported on italki platform.',
        annotations: {
            readOnlyHint: true,
            tags: ['italki', 'country', 'metadata'],
        },
        outputSchema: ALL_COUNTRIES_OUTPUT_SCHEMA,
    },
    toolCallback: async () => {
        const countries = await getAllCountryList();
        return {
            content: [{ type: 'text', text: render(ALL_COUNTRIES_TEXT_RENDER_EJS_TEMPLATE, { countries }) }],
            structuredContent: {
                countries: countries
            }
        };
    }
};

export default ALL_COUNTRIES_TOOL;

