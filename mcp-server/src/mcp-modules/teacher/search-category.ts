import { MCPTool } from "mcp-server/src/interfaces";
import z, { ZodRawShape } from "zod";
import I18N from "../../i18n";
import { fetchWithTimeout } from "../../utils/fetch-with-timeout";

const CATEGORY_INPUT_SCHEMA: ZodRawShape = {
  language: z.string().describe("The language to get course categories for (e.g. 'english', 'japanese')"),
};

const CATEGORY_INPUT_TYPE = z.object(CATEGORY_INPUT_SCHEMA);

type CourseCategoryInput = z.infer<typeof CATEGORY_INPUT_TYPE>;

const CATEGORY_ITEM_SCHEMA = z.object({
  category: z.string().describe("Category code (e.g. 'CA001')"),
  tags: z.array(z.string()).describe("Tag codes under this category"),
});

type CategoryItem = z.infer<typeof CATEGORY_ITEM_SCHEMA>;

const CODE_WITH_TRANSLATION_SCHEMA = z.object({
  code: z.string().describe("Translation code (e.g. 'CA001' or 'T0084'). IMPORTANT: for any follow-up calls, always use this code."),
  translation: z.string().optional().describe("Human-readable text for this code (for GPT understanding only; do NOT use as tool input)."),
});

type CodeWithTranslation = z.infer<typeof CODE_WITH_TRANSLATION_SCHEMA>;

const CATEGORY_ITEM_WITH_TRANSLATION_SCHEMA = z.object({
  category: CODE_WITH_TRANSLATION_SCHEMA.describe("Category code + optional translation"),
  tags: z.array(CODE_WITH_TRANSLATION_SCHEMA).describe("Tag codes + optional translations"),
});

const CATEGORY_OUTPUT_SCHEMA: ZodRawShape = {
  categories: z.array(CATEGORY_ITEM_WITH_TRANSLATION_SCHEMA).describe(
    "Course categories for the given language. Use category.code and tags[].code for any follow-up calls; translation is only for readability."
  ),
};

type ItalkiAPIV2TeacherSearchCategoryResponse = {
  success: 0 | 1;
  data: Array<{ category: string; tags: string[] }>;
  meta?: Record<string, unknown>;
};

async function getTeacherSearchCategories(language: string): Promise<Array<z.infer<typeof CATEGORY_ITEM_WITH_TRANSLATION_SCHEMA>>> {
  const url = `https://api.italki.com/api/v2/teacher/search/category?language=${encodeURIComponent(language)}`;
  console.log("Getting teacher search categories from URL: " + url);
  const response = await fetchWithTimeout(url);
  const responseData: ItalkiAPIV2TeacherSearchCategoryResponse = await response.json();
  if (responseData.success === 0) {
    throw new Error("Failed to get teacher search categories");
  }

  // 这里直接把翻译码转换成 { code, translation } 结构，避免在 toolCallback 里再加工一遍
  return responseData.data.map((item) => ({
    category: toCodeWithTranslation(item.category),
    tags: item.tags.map(toCodeWithTranslation),
  }));
}

function translateCode(code: string): string | undefined {
  // i18n.ts is a big dictionary: { [code: string]: string }
  // Only treat string values as valid translations.
  const value = (I18N as Record<string, unknown>)[code];
  return typeof value === "string" ? value : undefined;
}

function toCodeWithTranslation(code: string): CodeWithTranslation {
  const translation = translateCode(code);
  return translation ? { code, translation } : { code };
}

const COURSE_CATEGORY_TOOL: MCPTool<ZodRawShape, ZodRawShape> = {
  name: "course-category-by-language",
  type: "tool",
  config: {
    title: "Get teaching course categories by language (italki)",
    description:
      "Get available course categories that italki teachers provides for a given language",
    inputSchema: CATEGORY_INPUT_SCHEMA,
    outputSchema: CATEGORY_OUTPUT_SCHEMA,
    annotations: {
      tags: ["italki", "course", "category", "types", 'exam', 'business', 'music', 'conversation', 'grammar', 'pronunciation', 'vocabulary', 'listening', 'speaking', 'reading', 'writing'],
      readOnlyHint: true,
    },
  },
  toolCallback: async (args: CourseCategoryInput) => {
    const validatedArgs = CATEGORY_INPUT_TYPE.safeParse(args);
    if (!validatedArgs.success) {
      throw new Error("Invalid input: " + validatedArgs.error.message);
    }

    const categoriesWithTranslation = await getTeacherSearchCategories(validatedArgs.data.language);

    return {
      // content: [{ type: "text", text }],
      structuredContent: {
        categories: categoriesWithTranslation,
      },
    };
  },
};

export default COURSE_CATEGORY_TOOL;


