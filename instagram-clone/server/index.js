// ============================================================
// index.js - نقطه ورود اصلی سرور Instagram Clone
// این فایل مثل فرمانده کل است که همه بخش‌ها را هماهنگ می‌کند
// ============================================================

// ۱. بارگذاری متغیرهای محیطی از فایل .env
// این کار باید اولین دستور باشد تا همه جای برنامه به این متغیرها دسترسی داشته باشیم
require('dotenv').config();

// ۲. وارد کردن (Import) کتابخانه‌های اصلی
const express = require('express');        // فریم‌ورک ساخت سرور
const cors = require('cors');              // مدیریت درخواست‌های Cross-Origin
const mongoose = require('mongoose');      // ارتباط با MongoDB
const cloudinary = require('cloudinary');  // ارتباط با Cloudinary

// ۳. وارد کردن فایل‌های داخلی پروژه
const connectDB = require('./database/db'); // تابع اتصال به دیتابیس
const routes = require('./routes/route');   // تمام مسیرهای API

// ۴. ساخت اپلیکیشن Express
// app شیء اصلی ماست که تمام تنظیمات روی آن اعمال می‌شود
const app = express();

// ۵. تنظیمات Cloudinary
// اطلاعات حساب کلودینری را از .env می‌خوانیم
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log('☁️  Cloudinary پیکربندی شد');

// ۶. میدلورها (Middleware) - لایه‌های امنیتی و پردازشی
// اینها مثل نگهبان‌هایی هستند که قبل از رسیدن درخواست به مسیر اصلی، آن را بررسی می‌کنند

// CORS: اجازه دسترسی از هر دامنه‌ای را می‌دهد
app.use(cors());

// Body Parser: تبدیل JSON ورودی به شیء JavaScript
app.use(express.json({ limit: '10mb' }));

// URL Encoded: پردازش داده‌های فرم
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ۷. تعریف مسیرهای API
// تمام مسیرهایی که با /api شروع می‌شوند به فایل routes هدایت می‌شوند
app.use('/api', routes);

// ۸. مسیر تست سلامت سرور (Health Check)
// با این مسیر می‌توانیم مطمئن شویم سرور زنده است
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: '🚀 سرور Instagram Clone فعال است',
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ۹. مدیریت مسیرهای ناموجود (404 Handler)
// اگر کاربر آدرسی را وارد کند که وجود ندارد
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '❌ مسیر مورد نظر یافت نشد',
    path: req.originalUrl
  });
});

// ۱۰. مدیریت خطاهای سراسری (Global Error Handler)
// هر خطایی که در برنامه رخ دهد و مدیریت نشده باشد، اینجا گیر می‌افتد
app.use((error, req, res, next) => {
  console.error('❌ خطای سراسری:', error);

  // اگر خطای Multer (حجم فایل زیاد) باشد
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: '📁 حجم فایل نباید بیشتر از ۱۰ مگابایت باشد'
    });
  }

  // خطای عمومی
  res.status(error.status || 500).json({
    success: false,
    message: error.message || '❌ خطای داخلی سرور',
    // در محیط development، جزئیات خطا را هم نشان بده
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ۱۱. تعریف پورت و راه‌اندازی سرور
const PORT = process.env.PORT || 5000;

// ۱۲. اتصال به دیتابیس و سپس شروع به گوش دادن
connectDB()
  .then(() => {
    // اگر اتصال به دیتابیس موفق بود، سرور را راه‌اندازی کن
    app.listen(PORT, () => {
      console.log('═══════════════════════════════════════');
      console.log(`🚀 سرور روی پورت ${PORT} راه‌اندازی شد`);
      console.log(`🔗 آدرس: http://localhost:${PORT}`);
      console.log(`❤️  تست سلامت: http://localhost:${PORT}/health`);
      console.log(`📋 API ها: http://localhost:${PORT}/api`);
      console.log('═══════════════════════════════════════');
    });
  })
  .catch((error) => {
    // اگر اتصال به دیتابیس ناموفق بود، برنامه را متوقف کن
    console.error('❌ خطا در راه‌اندازی سرور:', error.message);
    process.exit(1); // خروج با کد خطا
  });

// ۱۳. مدیریت graceful shutdown (خاموش شدن تمیز)
// وقتی برنامه بسته می‌شود، ارتباطات را تمیز قطع کن
process.on('SIGINT', async () => {
  console.log('\n🛑 در حال بستن اتصالات...');
  await mongoose.connection.close();
  console.log('👋 خداحافظ!');
  process.exit(0);
});
