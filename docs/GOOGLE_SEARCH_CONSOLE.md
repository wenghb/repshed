# Google Search Console 提交指南 — RepShed

## 步骤

### 1. 添加网站属性
1. 打开 https://search.google.com/search-console
2. 登录 Google 账号
3. 点击左上角 "添加属性" → 选 **"网域"** → 输入 `repshed.com`
4. 或选 **"网址前缀"** → 输入 `https://repshed.com`（更简单）

### 2. 验证所有权（推荐 DNS 方式）
- Google 会给你一个 TXT 记录
- 去 Cloudflare DNS 添加这条 TXT 记录
- 等待验证通过（通常几分钟）

### 3. 提交 Sitemap
验证通过后：
1. 左侧菜单 → "Sitemap"
2. 输入 `sitemap.xml`
3. 点 "提交"

### 4. 请求索引
1. 顶部搜索框输入 `https://repshed.com/`
2. 点 "请求编入索引"
3. 对 `/app`、`/privacy`、`/terms` 各做一次

## 预期时间
- 验证：几分钟到几小时
- 首次索引：1-7 天
- 完整索引：2-4 周
