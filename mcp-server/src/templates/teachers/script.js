// ------------------------------
//   数据状态管理
//   toolOutput 包含来自 recommendation.ts 的 structuredContent
// ------------------------------
// 从 window.openai?.toolOutput 初始化数据
let teachers = [...(window.openai?.toolOutput?.teachers ?? [])];

// -------------- 工具映射 --------------
const countryFlagMap = { KR: "🇰🇷" };
const languageNameMap = {
  korean: "韩语",
  english: "英语",
  spanish: "西班牙语",
  chinese: "中文",
  japanese: "日语",
  german: "德语",
  swedish: "瑞典语",
  other: "其他"
};

function centsToUSDString(cents) {
  return (cents / 100).toFixed(2);
}

function buildTeachLanguageLabel(teacher) {
  const lang = teacher.teachLanguages?.[0];
  if (!lang) return "";
  const name = languageNameMap[lang.language] || lang.language;
  return `${name} ${lang.level === "native" ? "母语" : lang.level}`;
}

// ------------------------------
//   创建教师卡片（直接使用 Base64 图片，已在 server 层转换）
// ------------------------------
function createTeacherCard(teacher) {
  // avatarUrl 和 videoThumbnailUrl 已经在 server 层转换为 base64
  // 直接使用即可，无需再次转换

  const card = document.createElement("article");
  card.className = "teacher-card";

  // 顶部视频缩略图
  const videoWrapper = document.createElement("div");
  videoWrapper.className = "video-wrapper";

  const img = document.createElement("img");
  img.src = teacher.videoThumbnailUrl;     // 已经是 base64 格式
  img.alt = "video thumbnail";
  videoWrapper.appendChild(img);

  const play = document.createElement("button");
  play.className = "play-btn";
  play.onclick = () => window.open(teacher.videoUrl, "_blank");
  videoWrapper.appendChild(play);

  // 右上角 discount
  const discount = document.createElement("div");
  discount.className = "discount-badge";
  discount.textContent = "立减 16%";
  videoWrapper.appendChild(discount);

  // 右下角 tag
  const tag = document.createElement("div");
  tag.className = "tag";
  tag.textContent = "职业教师";
  videoWrapper.appendChild(tag);

  card.appendChild(videoWrapper);

  // ---- 内容 ----
  const content = document.createElement("div");
  content.className = "teacher-content";

  const header = document.createElement("div");
  header.className = "teacher-header";

  const avatar = document.createElement("img");
  avatar.className = "avatar";
  avatar.src = teacher.avatarUrl;   // 已经是 base64 格式
  header.appendChild(avatar);

  const nameMeta = document.createElement("div");

  const name = document.createElement("div");
  name.className = "name-row";
  name.innerHTML = `
      <div class="teacher-name">${teacher.nickName}</div>
      <span class="badge-plus">Plus</span>
  `;
  nameMeta.appendChild(name);

  const meta = document.createElement("div");
  meta.className = "meta-row";

  meta.innerHTML = `
      <span>${teacher.taughtLessonCount} 个课时</span>
      <span class="meta-dot">${teacher.studentCount} 位学生</span>
      <span class="meta-dot">${buildTeachLanguageLabel(teacher)}</span>
      <span class="meta-dot">${countryFlagMap[teacher.fromCountryId]}</span>
  `;
  nameMeta.appendChild(meta);

  header.appendChild(nameMeta);
  content.appendChild(header);

  // 简介
  const intro = document.createElement("p");
  intro.className = "short-intro";
  intro.textContent = teacher.shortIntroduction;
  content.appendChild(intro);

  // 底部
  const footer = document.createElement("div");
  footer.className = "card-footer";

  footer.innerHTML = `
      <div class="price">USD ${centsToUSDString(teacher.minUSDPriceInCents)} <span>/小时</span></div>
  `;

  const moreBtn = document.createElement("button");
  moreBtn.className = "more-btn";
  moreBtn.textContent = "查看更多";
  moreBtn.onclick = () => window.open(teacher.profileUrl, "_blank");
  footer.appendChild(moreBtn);

  content.appendChild(footer);
  card.appendChild(content);

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
    teachers = response.structuredContent.teachers;
    render();
  }
}

// ------------------------------
//   处理全局数据更新事件
// ------------------------------
function handleSetGlobals(event) {
  const globals = event.detail?.globals;
  if (!globals?.toolOutput?.teachers) return;
  
  teachers = globals.toolOutput.teachers;
  render();
}

// 监听 openai:set_globals 事件以响应数据更新
window.addEventListener("openai:set_globals", handleSetGlobals, {
  passive: true,
});

// ------------------------------
//   初始化渲染
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  render();
});
  