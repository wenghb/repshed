# RepShed 社交媒体推广草稿 (v2 — 修正版)

## ⚠️ Reddit 规则提醒
- r/guitar, r/piano 等乐器板块 **禁止自我推广**
- 在这些板块只能通过 **回答问题** 自然提及
- 自我推广只能发在专门允许的板块

---

## Reddit 帖子（允许自我推广的板块）

---

### 帖子 1 — r/SideProject ✅
**标题：** RepShed — free browser-based music practice tool with A-B looping and speed training

**正文：**

Hey! I built a free music practice tool called RepShed.

**The problem:** When I'm learning a guitar part, I need to loop a specific section and slow it down. Audacity can do it but the workflow is painful — select, export, re-do when the loop point is off.

**The solution:** Drop an audio file in your browser, click-drag on the waveform to set a loop, adjust speed. Done.

**Features:**
- A-B loop with ±0.1s precision
- Speed from 0.1× to 2× (pitch preserved)
- Progressive Speed Trainer — auto-increases tempo
- Keyboard shortcuts
- 100% browser-based — no uploads, no accounts, no tracking

**Tech stack:** Pure HTML/CSS/JS, Web Audio API, Canvas for waveform. Hosted on Cloudflare Pages. Zero dependencies.

**Link:** https://repshed.com
**Source:** MIT licensed

Looking for feedback — what would make it more useful for your practice?

---

### 帖子 2 — r/InternetIsBeautiful ✅
**标题：** RepShed — a free, private music practice tool that loops and slows down songs in your browser

**正文：**

https://repshed.com

Drop an audio file, select a section on the waveform, loop it at any speed with pitch preserved.

- No signup, no uploads — audio never leaves your device
- Works on desktop and mobile
- Zero dependencies, built with Web Audio API

---

### 帖子 3 — r/opensource ✅
**标题：** RepShed — open source music practice tool (A-B loop + speed control, pure JS, MIT)

**正文：**

I open-sourced my music practice tool, RepShed.

**What:** Browser-based audio player with A-B looping, speed control (pitch-preserved), progressive speed trainer, waveform visualization.

**Why open source:** It's a simple tool that should be free. No reason to lock basic practice features behind a paywall.

**Tech:** Pure HTML/CSS/JS. No React, no npm, no build step. Web Audio API for decoding and playback, Canvas for waveform rendering. Hosted on Cloudflare Pages.

**Link:** https://repshed.com
**License:** MIT

Contributions welcome. Roadmap includes pitch shifting, bookmarks, and PWA offline support.

---

## Reddit 评论策略（r/guitar 等严格板块）

**不发帖，只回答问题。** 搜索以下类型的帖子：

搜索词：
- `slow down song` 
- `learn solo by ear`
- `practice tool`
- `A-B loop`
- `how to practice fast parts`

**评论模板：**

> For slowing down songs, I'd suggest using the Web Audio API approach — there are browser tools that let you drop in an audio file and change speed without pitch change. 
>
> The method that works best for me:
> 1. Isolate just the hard 4-8 bars
> 2. Slow to ~50%
> 3. Play until you get 5 clean reps in a row
> 4. Bump speed up 5%
> 5. Repeat
>
> I actually built a free tool for this workflow — repshed.com — but Audacity or VLC can also do speed changes if you prefer desktop apps.

**关键：先给有用的建议，最后才提工具链接，而且给出替代方案（Audacity/VLC），显得客观不推销。**

---

## X/Twitter 推文（不变）

---

### 推文 1（主推）
I built a free music practice tool for anyone learning songs by ear.

→ Loop any section with A-B repeat
→ Slow down without pitch change  
→ Speed Trainer auto-increases tempo
→ 100% browser-based, no uploads

No signup. Just drop a file and practice.

https://repshed.com

### 推文 2（实用技巧角度）
The fastest way to learn a guitar solo:

1. Loop the hard 4 bars
2. Slow to 50% speed
3. Play until 5 clean reps
4. Bump up 5%
5. Repeat

I built a free tool that does exactly this → https://repshed.com

No signup, no uploads, runs in your browser. 🎸

### 推文 3（简洁版）
If you practice music, you need an A-B loop player.

I built one that's free, private, and runs in your browser:

https://repshed.com

Slow down without pitch change. Speed Trainer included. No account needed.

---

## 发布计划

### 第 1 周
- Day 1: r/SideProject 帖子
- Day 1: X 推文 1
- Day 3: r/InternetIsBeautiful 帖子
- Day 5: X 推文 2

### 第 2 周
- Day 1: r/opensource 帖子
- Day 3: X 推文 3
- Day 5: 开始在 r/guitar 回答相关问题（每周 2-3 条评论）

### 长期
- 持续在 r/guitar, r/piano, r/musictheory 回答问题时自然提及
- 这是最安全、最持久的 Reddit 策略
