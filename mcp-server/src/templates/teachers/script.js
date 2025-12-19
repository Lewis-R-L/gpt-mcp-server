// ------------------------------
//   数据状态管理
//   toolOutput 包含来自 recommendation.ts 的 structuredContent
// ------------------------------
// 从 window.openai?.toolOutput 初始化数据

let teachers = [...(window.openai?.toolOutput?.teachers ?? [])].slice(0, 4);
let teacherSearchUrl = window.openai?.toolOutput?.teacherSearchUrl || null;

// -------------- 图标路径配置 --------------
// 图标通过 loader.ts 内联为 base64 data URI，存储在 window.ICON_DATA_URI 中
// 如果有 CDN base URL，使用 CDN；否则使用相对路径
// 优先级：ICON_DATA_URI > CDN URL > 相对路径
const getIconsBasePath = () => {
  // 如果设置了 CDN base URL，使用它
  if (window.ICONS_CDN_BASE_URL) {
    return window.ICONS_CDN_BASE_URL + '/public/icons';
  }
  // 否则使用相对路径
  return '/public/icons';
};

// -------------- 工具映射 --------------
// 国家代码到图标文件名的映射（特殊映射）
// 对于不在映射表中的国家，直接使用小写国家代码作为文件名
const countryFlagMap = {
  UK: "gb",  // 英国使用 GB 的国旗
  GB: "gb",
  // 其他所有 ISO 国家代码会自动映射为小写形式，例如：
  // US -> us, CA -> ca, KR -> kr, ES -> es, FR -> fr 等
};

const languageNameMap = {
  korean: "Korean",
  english: "English",
  spanish: "Spanish",
  chinese: "Chinese",
  japanese: "Japanese",
  german: "German",
  swedish: "Swedish",
  french: "French",
  italian: "Italian",
  portuguese: "Portuguese",
  russian: "Russian",
  arabic: "Arabic",
  other: "Other"
};

function centsToUSDString(cents) {
  return (cents / 100).toFixed(0);
}

function buildTeachLanguageLabel(teacher) {
  const lang = teacher.teachLanguages?.[0];
  if (!lang) return { name: "", level: "" };
  const name = languageNameMap[lang.language.toLowerCase()] || lang.language;
  const level = lang.level === "native" || lang.level === "L7" ? "Native" : lang.level;
  return { name, level };
}

function getCountryFlag(countryId) {
  // 尝试从可能的格式中提取（如 "US_123" -> "US"）
  const code = countryId.split('_')[0].toUpperCase();
  
  // 首先检查是否有特殊映射
  let flagFileName = countryFlagMap[code];
  
  // 如果没有特殊映射，直接使用小写国家代码作为文件名
  if (!flagFileName) {
    flagFileName = code.toLowerCase();
  }
  
  // 如果 window.ICON_DATA_URI 存在（预览模式），使用内联的 SVG data URI
  if (window.ICON_DATA_URI && window.ICON_DATA_URI[`flags/${flagFileName}.svg`]) {
    return window.ICON_DATA_URI[`flags/${flagFileName}.svg`];
  }
  
  // 否则使用 CDN URL 或相对路径
  return `${getIconsBasePath()}/flags/${flagFileName}.svg`;
}

function createFlagBadge(countryId) {
  const flagUrl = getCountryFlag(countryId);
  
  if (!flagUrl) {
    // 如果没有找到对应的国旗，返回一个默认的占位符
    const placeholder = document.createElement("div");
    placeholder.style.width = "100%";
    placeholder.style.height = "100%";
    placeholder.style.background = "#ddd";
    placeholder.style.borderRadius = "50%";
    return placeholder;
  }
  
  const img = document.createElement("img");
  img.src = flagUrl;
  img.alt = countryId;
  // 样式由 CSS 中的 .flag-badge img 控制，不需要内联样式
  return img;
}

// 创建星星图标
function createStarIcon() {
  // 如果 window.ICON_DATA_URI 存在（预览模式），使用内联的 SVG
  let starUrl;
  if (window.ICON_DATA_URI && window.ICON_DATA_URI['star.svg']) {
    starUrl = window.ICON_DATA_URI['star.svg'];
  } else {
    // 否则使用 CDN URL 或相对路径
    starUrl = `${getIconsBasePath()}/star.svg`;
  }
  
  const img = document.createElement("img");
  img.src = starUrl;
  img.alt = "star";
  img.style.width = "16px";
  img.style.height = "16px";
  img.style.display = "block";
  return img;
}

// ------------------------------
//   创建教师卡片
// ------------------------------
function createTeacherCard(teacher) {
  const card = document.createElement("article");
  card.className = "teacher-card";

  const cardInner = document.createElement("div");
  cardInner.className = "teacher-card-inner";

  // ---- 用户卡片容器 ----
  const userCard = document.createElement("div");
  userCard.className = "user-card";

  // ---- 头像区域 ----
  const avatarSection = document.createElement("div");
  avatarSection.className = "avatar-section";

  const avatarWrapper = document.createElement("div");
  avatarWrapper.className = "avatar-wrapper";

  const avatar = document.createElement("img");
  avatar.className = "avatar";
  avatar.src = teacher.avatarUrl; // 已经是 base64 格式
  avatar.alt = teacher.nickName;
  avatarWrapper.appendChild(avatar);

  const flagBadge = document.createElement("div");
  flagBadge.className = "flag-badge";
  const flagImage = createFlagBadge(teacher.fromCountryId);
  flagBadge.appendChild(flagImage);
  avatarWrapper.appendChild(flagBadge);

  avatarSection.appendChild(avatarWrapper);
  userCard.appendChild(avatarSection);

  // ---- 内容区域 ----
  const teacherContent = document.createElement("div");
  teacherContent.className = "teacher-content";

  // ---- 名字和评分行 ----
  const nameRatingRow = document.createElement("div");
  nameRatingRow.className = "name-rating-row";

  // 左侧：名字和评分
  const nameSection = document.createElement("div");
  nameSection.className = "name-section";

  const name = document.createElement("div");
  name.className = "teacher-name";
  name.textContent = teacher.nickName;
  nameSection.appendChild(name);

  const ratingSection = document.createElement("div");
  ratingSection.className = "rating-section";

  const ratingContainer = document.createElement("div");
  ratingContainer.className = "rating-container";

  // 星星图标
  const starIcon = createStarIcon();
  starIcon.className = "star-icon";
  ratingContainer.appendChild(starIcon);

  // 评分值
  const ratingValue = document.createElement("span");
  ratingValue.className = "rating-value";
  ratingValue.textContent = (teacher.rating || 5.0).toFixed(1);
  ratingContainer.appendChild(ratingValue);

  ratingSection.appendChild(ratingContainer);

  // 课程数
  const lessonCount = document.createElement("span");
  lessonCount.className = "lesson-count";
  const lessonCountValue = teacher.taughtLessonCount ?? 0;
  lessonCount.textContent = `${lessonCountValue} lessons`;
  ratingSection.appendChild(lessonCount);

  nameSection.appendChild(ratingSection);
  nameRatingRow.appendChild(nameSection);

  // 右侧：语言标签
  const languageLabel = document.createElement("div");
  languageLabel.className = "language-label";
  const langInfo = buildTeachLanguageLabel(teacher);
  if (langInfo.name) {
    // 根据是否为 Native 添加不同的类
    const levelClass = langInfo.level === "Native" ? "native" : "non-native";
    languageLabel.innerHTML = `<span>${langInfo.name} </span><span class="separator">· </span><span class="${levelClass}">${langInfo.level}</span>`;
  }
  nameRatingRow.appendChild(languageLabel);

  teacherContent.appendChild(nameRatingRow);

  // ---- 简介 ----
  // 优先使用 shortIntroduction，如果没有则使用 longIntroduction，都没有则显示空白
  const introText = teacher.shortIntroduction || teacher.longIntroduction || "";
  const intro = document.createElement("p");
  intro.className = "short-intro";
  intro.textContent = introText ? `"${introText}"` : "";
  teacherContent.appendChild(intro);

  // ---- 价格和按钮行 ----
  const priceButtonRow = document.createElement("div");
  priceButtonRow.className = "price-button-row";

  const priceContainer = document.createElement("div");
  priceContainer.className = "price-container";

  const priceValue = document.createElement("span");
  priceValue.className = "price-value";
  const priceInCents = teacher.minUSDPriceInCents ?? 0;
  // 在模板字符串中，$ 符号可以直接使用，不需要转义
  priceValue.textContent = `$ ` + `${centsToUSDString(priceInCents)}`;
  priceContainer.appendChild(priceValue);

  const priceUnit = document.createElement("span");
  priceUnit.className = "price-unit";
  priceUnit.textContent = "/ hour";
  priceContainer.appendChild(priceUnit);

  priceButtonRow.appendChild(priceContainer);

  const lessonBtn = document.createElement("button");
  lessonBtn.className = "lesson-btn";
  lessonBtn.textContent = "Go for the lesson";
  lessonBtn.onclick = () => window.open(teacher.profileUrl, "_blank");
  priceButtonRow.appendChild(lessonBtn);

  teacherContent.appendChild(priceButtonRow);

  userCard.appendChild(teacherContent);
  cardInner.appendChild(userCard);
  card.appendChild(cardInner);

  return card;
}

// ------------------------------
//   渲染函数：清空列表并重新渲染所有教师卡片
// ------------------------------
function render() {
  const listEl = document.getElementById("teacher-list");
  if (!listEl) {
    console.warn("teacher-list element not found");
    return;
  }
  
  listEl.innerHTML = "";
  
  teachers.forEach((teacher) => {
    const card = createTeacherCard(teacher);
    listEl.appendChild(card);
  });
}

// ------------------------------
//   从响应中更新数据
// ------------------------------
function updateFromResponse(response) {
  if (response?.structuredContent?.teachers) {
    teachers = response.structuredContent.teachers.slice(0, 4);
    teacherSearchUrl = response.structuredContent.teacherSearchUrl || null;
    render();
  }
}

// ------------------------------
//   处理全局数据更新事件
// ------------------------------
function handleSetGlobals(event) {
  const globals = event.detail?.globals;
  if (!globals?.toolOutput?.teachers) return;
  
  teachers = globals.toolOutput.teachers.slice(0, 3);
  teacherSearchUrl = globals.toolOutput.teacherSearchUrl || null;
  render();
}

// 监听 openai:set_globals 事件以响应数据更新
window.addEventListener("openai:set_globals", handleSetGlobals, {
  passive: true,
});

// ------------------------------
//   初始化渲染和事件绑定
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  render();
  
  // 绑定 "Open in italki" 点击事件
  const openItalkiBtn = document.getElementById("open-italki-btn");
  if (openItalkiBtn) {
    openItalkiBtn.addEventListener("click", () => {
      const url = teacherSearchUrl || "https://www.italki.com";
      window.open(url, "_blank");
    });
  }
});
  