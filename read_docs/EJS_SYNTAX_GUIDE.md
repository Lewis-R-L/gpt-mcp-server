# EJS 模板语法指南

## 📚 什么是 EJS？

**EJS (Embedded JavaScript)** 是一个简单的模板引擎，允许你在 HTML/文本中嵌入 JavaScript 代码。

- **库名**：`ejs` (版本 3.1.10)
- **导入方式**：`import { render } from "ejs"`
- **用途**：将数据动态渲染成文本字符串

---

## 🔧 基本用法

### 函数签名

```typescript
render(template: string, data: object): string
```

**参数：**
- `template`: 包含 EJS 语法的模板字符串
- `data`: 传递给模板的数据对象（键值对）

**返回值：** 渲染后的字符串

### 在你的代码中

```typescript
// all-language.ts 第 43 行
render(ALL_TAUGHT_LANGUAGES_TEXT_RENDER_EJS_TEMPLATE, { languages })
```

**解释：**
- `ALL_TAUGHT_LANGUAGES_TEXT_RENDER_EJS_TEMPLATE` 是模板字符串
- `{ languages }` 是数据对象，包含 `languages` 变量
- 返回渲染后的文本字符串

---

## 📝 EJS 语法规则

### 1. 输出变量值：`<%= ... %>`

**作用**：将表达式的值输出到文本中（会自动转义 HTML）

```ejs
<%= variable %>
<%= object.property %>
<%= array.length %>
<%= expression + 1 %>
```

**示例：**
```ejs
Hello, <%= name %>!
There are <%= languages.length %> languages.
```

**渲染结果：**
```
Hello, John!
There are 50 languages.
```

---

### 2. 执行 JavaScript 代码：`<% ... %>`

**作用**：执行 JavaScript 代码，但不输出内容（用于控制流）

```ejs
<% if (condition) { %>
  <!-- 这里的文本会被输出 -->
<% } %>

<% array.forEach((item) => { %>
  <!-- 循环输出 -->
<% }) %>
```

**示例：**
```ejs
<% languages.forEach((language, index) => { %>
  <%= index + 1 %>. <%= language %>
<% }) %>
```

**渲染结果：**
```
1. English
2. Chinese
3. Spanish
```

---

### 3. 输出原始值（不转义）：`<%- ... %>`

**作用**：输出原始 HTML（不转义特殊字符）

```ejs
<%- htmlContent %>
```

**注意**：在你的项目中很少使用，因为主要生成纯文本

---

### 4. 注释：`<%# ... %>`

**作用**：EJS 注释，不会出现在输出中

```ejs
<%# 这是注释，不会输出 %>
```

---

## 🎯 项目中的实际示例

### 示例 1：简单循环（all-language.ts）

```typescript
const ALL_TAUGHT_LANGUAGES_TEXT_RENDER_EJS_TEMPLATE = `
Here are <%=languages.length%> languages that can be taught on italki platform.
<% languages.forEach((language, index) => { %>
<%=index + 1%>. <%=language%>
<% }) %>
`;

// 使用
render(ALL_TAUGHT_LANGUAGES_TEXT_RENDER_EJS_TEMPLATE, { 
  languages: ['English', 'Chinese', 'Spanish'] 
});
```

**渲染结果：**
```
Here are 3 languages that can be taught on italki platform.

1. English
2. Chinese
3. Spanish
```

**语法解析：**
- `<%=languages.length%>` → 输出数组长度：`3`
- `<% languages.forEach(...) { %>` → 开始循环
- `<%=index + 1%>` → 输出序号：`1`, `2`, `3`
- `<%=language%>` → 输出语言名称
- `<% }) %>` → 结束循环

---

### 示例 2：条件判断（recommendation.ts）

```typescript
<% teacher.teachLanguages.forEach((language, index) => { %>
  <% if (language.level !== 'native') { %>
    <%=index + 1%>. <%=language.language%> with level <%=language.level%>
  <% } else { %>
    <%=index + 1%>. Native speaker of <%=language.language%>
  <% } %>
<% }) %>
```

**语法解析：**
- `<% if (...) { %>` → 条件判断开始
- `<% } else { %>` → else 分支
- `<% } %>` → 条件判断结束

---

### 示例 3：嵌套对象访问（calendar.ts）

```typescript
The student of this event is <%=event.student.nickName%>, whose ID is <%=event.student.id%>.
The profile URL of the student is <%=event.student.profileUrl%>.
```

**语法解析：**
- `<%=event.student.nickName%>` → 访问嵌套对象属性
- 可以链式访问：`object.property.subProperty`

---

### 示例 4：复杂表达式（recommendation.ts）

```typescript
The minimum price of this teacher on italki platform is <%=teacher.minUSDPriceInCents/100%> USD.
```

**语法解析：**
- `<%=teacher.minUSDPriceInCents/100%>` → 执行数学运算
- 支持所有 JavaScript 表达式：`+`, `-`, `*`, `/`, `%`, 函数调用等

---

## 🔍 常见语法模式

### 模式 1：简单变量输出

```ejs
<%= variable %>
```

### 模式 2：数组循环

```ejs
<% array.forEach((item, index) => { %>
  <%= index + 1 %>. <%= item %>
<% }) %>
```

### 模式 3：条件输出

```ejs
<% if (condition) { %>
  条件为真时输出
<% } else { %>
  条件为假时输出
<% } %>
```

### 模式 4：嵌套循环

```ejs
<% outerArray.forEach((outerItem) => { %>
  Outer: <%= outerItem.name %>
  <% outerItem.innerArray.forEach((innerItem) => { %>
    - Inner: <%= innerItem.name %>
  <% }) %>
<% }) %>
```

### 模式 5：字符串插值（在 EJS 中）

```ejs
<%= `Hello, ${name}!` %>
```

---

## ⚠️ 注意事项

### 1. 标签必须正确闭合

```ejs
❌ 错误：
<% if (condition) { %>
  内容
<% }  // 缺少闭合括号

✅ 正确：
<% if (condition) { %>
  内容
<% } %>
```

### 2. 输出 vs 执行

```ejs
<%# 执行代码，不输出 %>
<% console.log('debug'); %>

<%# 输出值 %>
<%= variable %>

<%# 错误：会输出 "undefined" %>
<% variable %>
```

### 3. 字符串中的引号

```ejs
<%# 如果数据包含引号，EJS 会自动转义 %>
<%= teacher.nickName %>  // 如果 nickName 是 "John's"，会正确输出

<%# 在模板字符串中使用反引号 %>
<%= `Teacher: ${teacher.nickName}` %>
```

### 4. 变量作用域

```ejs
<%# 所有传入 render() 的数据对象中的变量都可以访问 %>
render(template, { 
  languages: [...],  // ✅ 可以访问
  count: 10         // ✅ 可以访问
});

<%# 模板中 %>
<%= languages.length %>  // ✅ 可以访问
<%= count %>            // ✅ 可以访问
<%= undefinedVar %>     // ❌ 会报错或输出 undefined
```

---

## 🧪 测试示例

### 测试代码

```typescript
import { render } from "ejs";

// 简单示例
const template1 = `Hello, <%= name %>!`;
console.log(render(template1, { name: 'World' }));
// 输出: Hello, World!

// 循环示例
const template2 = `
Items:
<% items.forEach((item, i) => { %>
  <%= i + 1 %>. <%= item %>
<% }) %>
`;
console.log(render(template2, { items: ['Apple', 'Banana'] }));
// 输出:
// Items:
//   1. Apple
//   2. Banana

// 条件示例
const template3 = `
<% if (isActive) { %>
  Status: Active
<% } else { %>
  Status: Inactive
<% } %>
`;
console.log(render(template3, { isActive: true }));
// 输出: Status: Active
```

---

## 📖 完整示例对比

### all-language.ts 的完整流程

```typescript
// 1. 定义模板
const ALL_TAUGHT_LANGUAGES_TEXT_RENDER_EJS_TEMPLATE = `
Here are <%=languages.length%> languages that can be taught on italki platform.
<% languages.forEach((language, index) => { %>
<%=index + 1%>. <%=language%>
<% }) %>
`;

// 2. 准备数据
const languages = ['English', 'Chinese', 'Spanish', 'French'];

// 3. 渲染
const result = render(ALL_TAUGHT_LANGUAGES_TEXT_RENDER_EJS_TEMPLATE, { languages });

// 4. 输出结果
console.log(result);
/*
Here are 4 languages that can be taught on italki platform.

1. English
2. Chinese
3. Spanish
4. French
*/
```

---

## 🎓 学习建议

1. **从简单开始**：先理解 `<%= %>` 输出变量
2. **理解循环**：掌握 `<% forEach %>` 模式
3. **条件判断**：学会使用 `<% if %>`
4. **组合使用**：嵌套循环 + 条件判断
5. **参考项目代码**：
   - `all-language.ts` - 最简单的循环示例
   - `recommendation.ts` - 复杂的嵌套循环和条件判断
   - `calendar.ts` - 对象属性访问和条件判断

---

## 🔗 相关资源

- **EJS 官方文档**：https://ejs.co/
- **项目中的使用**：
  - `mcp-server/src/mcp-modules/metadata/all-language.ts`
  - `mcp-server/src/mcp-modules/teacher/recommendation.ts`
  - `mcp-server/src/mcp-modules/my/calendar.ts`

---

## 💡 快速参考表

| 语法 | 作用 | 示例 |
|------|------|------|
| `<%= %>` | 输出值（转义） | `<%= name %>` |
| `<%- %>` | 输出原始值（不转义） | `<%- html %>` |
| `<% %>` | 执行代码（不输出） | `<% if (...) { %>` |
| `<%# %>` | 注释 | `<%# 注释 %>` |

**记住：**
- `=` 表示输出
- `-` 表示原始输出（不转义）
- 没有符号表示执行代码
- `#` 表示注释

