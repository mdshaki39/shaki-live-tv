# SHAKI_Live.TV — লাইভ ফুটবল ড্যাশবোর্ড

একটা প্রফেশনাল 24/7 live ড্যাশবোর্ড: BD সময়ে ফিকশ্চার, কাউন্টডাউন, লাইভ স্কোরবোর্ড, পয়েন্ট টেবিল, গ্রুপ বিভাজন, ম্যাচ হিস্ট্রি। World Cup ছাড়াও **১২টা লিগ** সাপোর্ট করে (নিচে দেখো), তাই World Cup শেষ হওয়ার পরেও যেকোনো ক্লাবের খেলা ট্র্যাক করা যাবে।

**এই সার্ভার নিজে কোনো TV চ্যানেল হোস্ট/স্ট্রিম করে না।** শুধু ফ্রি স্পোর্টস ডেটা API থেকে স্কোর/সময়সূচি দেখায়, আর "লাইভ দেখুন" বাটন অফিসিয়াল/লিগ্যাল সোর্সে নিয়ে যায়। এভাবে কপিরাইট সমস্যা ছাড়াই হোস্ট করা যায়।

---

## ১. API Key — ইতিমধ্যে করা আছে ✅

তোমার football-data.org অ্যাকাউন্টের key `.env` ফাইলে আগে থেকেই বসানো আছে (লোকাল টেস্টের জন্য)। **এই ফাইলটা GitHub এ যাবে না** (`.gitignore` এ আছে) — এটা ইচ্ছাকৃত, কারণ key কখনো পাবলিক রিপোতে রাখা উচিত না।

Railway তে ডিপ্লয় করার সময় (নিচে ধাপ ৩) তোমাকে এই একই key Railway এর **Variables** ট্যাবে আবার বসাতে হবে — কারণ Railway আমার থেকে আলাদা, GitHub থেকে `.env` পড়ে না (নিরাপত্তার জন্যই)।

> তোমার football-data.org স্ক্রিনশট অনুযায়ী Free প্ল্যানে এই ১২টা competition অ্যাক্সেস আছে — সবগুলো এই ড্যাশবোর্ডে যোগ করে দিয়েছি: World Cup, Champions League, Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira Liga, Championship, Brasileirão, Euro। উপরের নেভিগেশন বার থেকে লিগ বদলানো যাবে।

## ২. লোকাল এ টেস্ট (ঐচ্ছিক)

```bash
npm install
npm start
# http://localhost:3000 এ ওপেন করো
```

## ৩. GitHub এ আপলোড

```bash
git init
git add .
git commit -m "SHAKI_Live.TV dashboard"
git branch -M main
git remote add origin https://github.com/<তোমার-ইউজারনেম>/<repo-name>.git
git push -u origin main
```

## ৪. Railway তে ডিপ্লয়

1. https://railway.app → GitHub দিয়ে লগইন
2. **New Project → Deploy from GitHub repo** → এই রিপো সিলেক্ট করো
3. **Variables** ট্যাবে যোগ করো: `FOOTBALL_DATA_API_KEY` = তোমার football-data.org key (Account Settings পেজ থেকে কপি করো)
4. Deploy হয়ে গেলে Railway একটা URL দেবে (যেমন `xxx.up.railway.app`) — সবসময় লাইভ থাকবে

## ৫. তোমার নিজের ডোমেইন (erikas.store) যুক্ত করা

তোমার Namecheap স্ক্রিনশটে দেখলাম `erikas.store` ইতিমধ্যে `www.erikas.store` তে redirect করা আছে — এটা ভালো, এই সেটআপের জন্য ঠিক যা দরকার। এখন:

**Railway এর দিকে:**
1. Railway প্রজেক্টে তোমার সার্ভিসে যাও → **Settings → Networking → Custom Domain**
2. টাইপ করো: `www.erikas.store`
3. Railway তোমাকে একটা **CNAME** আর একটা **TXT** রেকর্ড দেবে (দুটোই লাগবে — শুধু CNAME দিলে কাজ করবে না)

**Namecheap এর দিকে (Advanced DNS ট্যাব):**
1. Domain List → erikas.store → **Advanced DNS**
2. Railway থেকে পাওয়া CNAME রেকর্ড যোগ করো: Host = `www`, Value = Railway এর দেওয়া ঠিকানা (যেমন `xxxx.up.railway.app`)
3. Railway থেকে পাওয়া TXT রেকর্ড ও একইভাবে যোগ করো
4. তোমার বিদ্যমান `erikas.store → http://www.erikas.store/` redirect টা রেখে দাও (already configured)

DNS propagate হতে কিছুক্ষণ (কখনো কয়েক ঘন্টা) লাগতে পারে। Railway ড্যাশবোর্ডে ডোমেইনের পাশে সবুজ চেকমার্ক আসলে বুঝবে রেডি। এরপর `https://www.erikas.store` থেকেই সবসময় সাইট অ্যাক্সেস করা যাবে।

## ৬. "লাইভ দেখুন" বাটন — সত্যিটা জেনে নাও

`config/channels.json` ফাইলে এটা কন্ট্রোল করা আছে, তোমাকে কিছু করতে হবে না — কিন্তু একটা জিনিস পরিষ্কার বলে রাখি:

- **World Cup ২০২৬**: বাংলাদেশে **T Sports** এ সম্পূর্ণ ফ্রি, কোনো সাবস্ক্রিপশন ছাড়াই দেখা যায় (free-to-air) — তাই World Cup ম্যাচে বাটন সরাসরি T Sports এ নিয়ে যাবে।
- **ক্লাব ফুটবল (Premier League, La Liga ইত্যাদি)**: কোন চ্যানেল কোন ম্যাচ দেখাবে এটা সপ্তাহে সপ্তাহে, দেশে দেশে বদলায় — বাংলাদেশে এর জন্য নির্দিষ্ট কোনো সবসময়-ফ্রি চ্যানেল নেই বললেই চলে। তাই এই ম্যাচগুলোতে বাটন একটা লিগ্যাল "কোথায় দেখা যাবে" ফাইন্ডার সাইটে (livesoccertv.com) নিয়ে যাবে, যেটা ভুল তথ্য না দিয়ে সঠিক অফিসিয়াল অপশন দেখাবে।

চাইলে নিজে এডিট করতে পারো — `config/channels.json` এর ভেতরেই উদাহরণ দেওয়া আছে কীভাবে নতুন rule যোগ করবে।

## ফিচার তালিকা

- ✅ ১২টা ফ্রি লিগ — World Cup + ১১টা ক্লাব কম্পিটিশন, উপরের bar থেকে সুইচ করা যায়
- ✅ BD সময়ে (UTC+6) সব ম্যাচ সময়
- ✅ পরবর্তী ম্যাচের live countdown
- ✅ লাইভ স্কোরবোর্ড + ticker
- ✅ আজকের সব ম্যাচ, ফিল্টারযোগ্য ফিকশ্চার, গ্রুপ পয়েন্ট টেবিল, গ্রুপ বিভাজন, ফলাফল হিস্ট্রি
- ✅ প্রতি ৬০ সেকেন্ডে অটো-রিফ্রেশ
- ✅ API down থাকলেও fallback দেখিয়ে সাইট কখনো ক্র্যাশ করে না
- ✅ SHAKI_Live.TV ব্র্যান্ডিং হোমপেজের সবচেয়ে উপরে, স্পষ্টভাবে দৃশ্যমান

## ডেটা সোর্স ও সীমাবদ্ধতা

- স্কোর/ফিকশ্চার/স্ট্যান্ডিংস: [football-data.org](https://www.football-data.org) ফ্রি API
- ফ্রি টিয়ারে লাইন-আপ/প্লেয়ার স্ট্যাটস নেই — শুধু স্কোর, সময়সূচি, স্ট্যান্ডিংস, রেট লিমিট ১০ রিকোয়েস্ট/মিনিট (এই সার্ভার নিজে ক্যাশ করে এটা সামলায়)
