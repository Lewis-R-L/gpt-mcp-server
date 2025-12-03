import fs from 'fs';
import path from 'path';

/**
 * 获取当前文件的目录路径
 * 在 CommonJS 环境中使用 __dirname
 */
function getCurrentDir(): string {
  // CommonJS 环境（打包后和开发环境）
  // @ts-ignore - __dirname 在 CommonJS 中可用，但 TypeScript 可能不识别
  if (typeof __dirname !== 'undefined') {
    // @ts-ignore
    return __dirname;
  }
  
  // 如果 __dirname 不可用，尝试从 process.cwd() 查找
  // 这通常发生在某些特殊环境中
  return process.cwd();
}

/**
 * 获取模板目录的绝对路径
 * 在开发环境中，从当前文件位置查找
 * 在打包后，从 dist/mcp-server 目录查找
 * 在 Vercel 环境中，从项目根目录查找
 */
function getTemplatesDir(): string {
  const currentDir = getCurrentDir();
  
  // Vercel 环境检测：/var/task 是 Vercel serverless function 的工作目录
  const isVercel = currentDir.includes('/var/task') || process.env.VERCEL === '1';
  
  if (isVercel) {
    // Vercel 环境：使用 process.cwd() 作为项目根目录（更可靠）
    const projectRoot = process.cwd();
    
    // 优先查找 dist/mcp-server/templates（如果运行了构建）
    const distTemplatesPath = path.join(projectRoot, 'dist', 'mcp-server', 'templates');
    if (fs.existsSync(distTemplatesPath)) {
      return distTemplatesPath;
    }
    
    // 查找 mcp-server/src/templates（源代码）
    const srcTemplatesPath = path.join(projectRoot, 'mcp-server', 'src', 'templates');
    if (fs.existsSync(srcTemplatesPath)) {
      return srcTemplatesPath;
    }
    
    // 也尝试从 currentDir（可能是 /var/task）查找
    const distTemplatesPath2 = path.join(currentDir, 'dist', 'mcp-server', 'templates');
    if (fs.existsSync(distTemplatesPath2)) {
      return distTemplatesPath2;
    }
    
    const srcTemplatesPath2 = path.join(currentDir, 'mcp-server', 'src', 'templates');
    if (fs.existsSync(srcTemplatesPath2)) {
      return srcTemplatesPath2;
    }
    
    // 尝试从当前目录向上查找项目根目录
    let searchDir = currentDir;
    const maxDepth = 10;
    let depth = 0;
    
    while (searchDir !== path.dirname(searchDir) && depth < maxDepth) {
      // 尝试查找 dist/mcp-server/templates
      const distPath = path.join(searchDir, 'dist', 'mcp-server', 'templates');
      if (fs.existsSync(distPath)) {
        return distPath;
      }
      
      // 尝试查找 mcp-server/src/templates
      const srcPath = path.join(searchDir, 'mcp-server', 'src', 'templates');
      if (fs.existsSync(srcPath)) {
        return srcPath;
      }
      
      searchDir = path.dirname(searchDir);
      depth++;
    }
  }
  
  // 打包后：main.js 在 dist/mcp-server/main.js
  // __dirname 会指向 dist/mcp-server
  // templates 目录应该在 dist/mcp-server/templates
  if (currentDir.includes('dist') && currentDir.includes('mcp-server')) {
    // 首先尝试在当前目录下查找 templates（打包后的情况）
    const templatesPath = path.join(currentDir, 'templates');
    if (fs.existsSync(templatesPath)) {
      return templatesPath;
    }
    // 如果当前目录名是 'templates'，说明代码在 templates 目录下（不太可能，但处理一下）
    if (path.basename(currentDir) === 'templates') {
      return currentDir;
    }
  }
  
  // 开发环境：当前文件在 src/templates/loader.ts
  // 如果当前目录名是 'templates'，说明 loader.ts 在 templates 目录下
  if (path.basename(currentDir) === 'templates') {
    return currentDir;
  }
  
  // 尝试从项目根目录查找
  let searchDir = currentDir;
  const maxDepth = 10;
  let depth = 0;
  
  while (searchDir !== path.dirname(searchDir) && depth < maxDepth) {
    // 尝试查找 src/templates（开发环境）
    const srcTemplatesPath = path.join(searchDir, 'src', 'templates');
    if (fs.existsSync(srcTemplatesPath)) {
      return srcTemplatesPath;
    }
    
    // 尝试查找 templates（打包后，相对于当前目录）
    const templatesPath = path.join(searchDir, 'templates');
    if (fs.existsSync(templatesPath)) {
      return templatesPath;
    }
    
    // 尝试在 dist/mcp-server 下查找（从项目根目录）
    const distTemplatesPath = path.join(searchDir, 'dist', 'mcp-server', 'templates');
    if (fs.existsSync(distTemplatesPath)) {
      return distTemplatesPath;
    }
    
    // 尝试在 mcp-server/src/templates 下查找（从项目根目录）
    const mcpSrcTemplatesPath = path.join(searchDir, 'mcp-server', 'src', 'templates');
    if (fs.existsSync(mcpSrcTemplatesPath)) {
      return mcpSrcTemplatesPath;
    }
    
    searchDir = path.dirname(searchDir);
    depth++;
  }
  
  // 最后尝试：假设 templates 在当前目录
  return path.join(currentDir, 'templates');
}

/**
 * 加载模板文件
 * @param templateName 模板名称（例如 'teachers'）
 * @returns 合并后的 HTML 字符串
 */
export function loadTemplate(templateName: string): string {
  const templatesDir = getTemplatesDir();
  const templateDir = path.join(templatesDir, templateName);
  
  // 调试信息：在开发环境或 Vercel 环境中输出路径信息
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL === '1') {
    console.log(`[Template Loader] Current dir: ${getCurrentDir()}`);
    console.log(`[Template Loader] Templates dir: ${templatesDir}`);
    console.log(`[Template Loader] Template dir: ${templateDir}`);
    console.log(`[Template Loader] Template exists: ${fs.existsSync(templateDir)}`);
  }
  
  if (!fs.existsSync(templateDir)) {
    // 提供更详细的错误信息，包括尝试过的路径
    const errorMsg = `Template directory not found: ${templateDir}\n` +
      `Current directory: ${getCurrentDir()}\n` +
      `Templates directory: ${templatesDir}\n` +
      `Template name: ${templateName}\n` +
      `Vercel environment: ${process.env.VERCEL || 'false'}\n` +
      `Working directory: ${process.cwd()}`;
    throw new Error(errorMsg);
  }
  
  // 读取 HTML 文件
  const htmlPath = path.join(templateDir, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML file not found: ${htmlPath}`);
  }
  let html = fs.readFileSync(htmlPath, 'utf-8');
  
  // 读取 CSS 文件（如果存在）
  const cssPath = path.join(templateDir, 'style.css');
  let css = '';
  if (fs.existsSync(cssPath)) {
    css = fs.readFileSync(cssPath, 'utf-8');
  }
  
  // 读取 JS 文件（如果存在）
  const jsPath = path.join(templateDir, 'script.js');
  let js = '';
  if (fs.existsSync(jsPath)) {
    js = fs.readFileSync(jsPath, 'utf-8');
  }
  
  // 合并 HTML、CSS 和 JS
  let result = html;
  
  // 如果 HTML 中没有 <style> 标签，在 <head> 或开头插入 CSS
  if (css && !html.includes('<style>')) {
    if (html.includes('</head>')) {
      result = result.replace('</head>', `  <style>\n${css}\n  </style>\n</head>`);
    } else if (html.includes('<body>')) {
      result = result.replace('<body>', `<style>\n${css}\n</style>\n<body>`);
    } else {
      result = `<style>\n${css}\n</style>\n${result}`;
    }
  } else if (css && html.includes('<style>')) {
    // 如果已有 style 标签，在第一个 style 标签内追加
    result = result.replace(/<style>([\s\S]*?)<\/style>/, (match, existingCss) => {
      return `<style>${existingCss}\n${css}\n</style>`;
    });
  }
  
  // 如果 HTML 中没有 <script> 标签，在 </body> 或末尾插入 JS
  if (js && !html.includes('<script')) {
    if (html.includes('</body>')) {
      result = result.replace('</body>', `  <script type="module">\n${js}\n  </script>\n</body>`);
    } else {
      result = `${result}\n<script type="module">\n${js}\n</script>`;
    }
  } else if (js && html.includes('<script')) {
    // 如果已有 script 标签，在最后一个 script 标签后追加
    const lastScriptIndex = result.lastIndexOf('</script>');
    if (lastScriptIndex !== -1) {
      result = result.slice(0, lastScriptIndex + 9) + `\n  <script type="module">\n${js}\n  </script>` + result.slice(lastScriptIndex + 9);
    } else {
      result = `${result}\n<script type="module">\n${js}\n</script>`;
    }
  }
  
  return result;
}

