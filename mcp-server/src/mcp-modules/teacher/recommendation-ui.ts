import { MCPResource } from "../../interfaces";
import { loadTemplate } from "../../templates/loader";

export const TEACHER_RECOMMENDATION_UI_URI = 'italki-mcp://teacher-recommendation-ui.0.0.1.html';

const TEACHER_RECOMMENDATION_UI_RESOURCE: MCPResource = {
    name: 'teacher-recommendation-ui',
    type: 'resource',
    uriOrTemplate: TEACHER_RECOMMENDATION_UI_URI,
    config: {
        title: 'Custom UI for tool teacher-recommendation',
        description: 'Teacher Recommendation UI',
        metadata: {
            tags: ['teacher', 'recommendation', 'custom ui'],
        }
    },
    readCallback: async () => {
        // 加载 teachers 模板
        const templateHtml = loadTemplate('teachers');
        
        return { 
            contents: [{
                uri: TEACHER_RECOMMENDATION_UI_URI,
                mimeType: 'text/html+skybridge',
                text: templateHtml,
                _meta: {
                    /* 
                        Renders the widget within a rounded border and shadow. 
                        Otherwise, the HTML is rendered full-bleed in the conversation
                    */
                    "openai/widgetPrefersBorder": true,
                    
                    /* 
                        Assigns a subdomain for the HTML. 
                        When set, the HTML is rendered within `italki-com.web-sandbox.oaiusercontent.com`
                        It's also used to configure the base url for external links.
                    */
                    "openai/widgetDomain": 'https://italki.com',

                    /*
                        Required to make external network requests from the HTML code. 
                        Also used to validate `openai.openExternal()` requests. 
                    */
                    'openai/widgetCSP': {
                        // Maps to `connect-src` rule in the iframe CSP
                        connect_domains: ['https://italki.com'],
                        // Maps to style-src, style-src-elem, img-src, font-src, media-src etc. in the iframe CSP
                        // Add CDN domains for serving static icons
                        resource_domains: [
                            'https://*.oaistatic.com',
                            'https://nonpliantly-fanatical-tonia.ngrok-free.dev',
                            'https://gpt-mcp-server-2.vercel.app',
                        ],
                    }
                }
            }]
        };
    }
};

export default TEACHER_RECOMMENDATION_UI_RESOURCE;