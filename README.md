# مشاريع المهندس جمال اوسيدي - Next.js + Firebase

## التشغيل المحلي

```bash
npm.cmd install
npm.cmd run dev
```

## إعداد Firebase

1. فعّل Email/Password من Firebase Authentication.
2. أنشئ ملف `.env.local` وانسخ القيم من `.env.example`.
3. أضف هذه القيم في Vercel (Project Settings > Environment Variables).

## بنية Firestore المستخدمة

### collection: `access_list`
- doc id: `emailToKey(email)`
- fields:
  - `email: string`
  - `role: "superadmin" | "admin" | "viewer"`
  - `status: "online" | "offline"`
  - `lastSeenText: string`
  - `createdAt, updatedAt`

### collection: `users`
- doc id: `uid`
- fields:
  - `uid, email, role, status, lastSeenText, createdAt, updatedAt`

### collection: `stations`
- doc id: `station-meteo`
- fields (current MVP):
  - `connected: boolean`
  - `lastSeen: Timestamp | string`
  - `rssi: number`
  - `signalQuality: number`
  - `temperature: number`

## الصلاحيات

- `jamalousidi2007@gmail.com` = `superadmin` دائمًا.
- أي مستخدم آخر يجب أن يكون موجودًا في `access_list` حتى يتمكن من تسجيل الدخول.

## حماية الصفحات

- `/home` و `/station-meteo` محمية عبر `middleware.ts` + التحقق من Firebase على الواجهة.

## ملاحظات الصورة الشخصية

- ضع صورتك في: `public/images/profile.jpg`
- الكود يحتوي fallback تلقائي إذا لم تكن الصورة موجودة.