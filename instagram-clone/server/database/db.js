// ============================================================
// database/db.js - مدیریت اتصال به MongoDB
// این فایل وظیفه برقراری ارتباط با پایگاه داده را دارد
// وقتی Connection صدا زده می‌شود، به MongoDB وصل می‌شویم
// ============================================================

// وارد کردن کتابخانه mongoose برای کار با MongoDB
const mongoose = require('mongoose');

/**
 * تابع اتصال به MongoDB
 * این تابع async است یعنی عملیات اتصال را در پس‌زمینه انجام می‌دهد
 * و ما می‌توانیم با await/then منتظر نتیجه بمانیم
 * 
 * @returns {Promise} - یک Promise که نتیجه اتصال را برمی‌گرداند
 */
const connectDB = async () => {
  try {
    // خواندن آدرس دیتابیس از فایل .env
    // اگر در .env تعریف نشده باشد، از آدرس لوکال پیش‌فرض استفاده می‌کنیم
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/instagram-clone';

    // نمایش پیام در حال اتصال
    console.log('🔌 در حال اتصال به MongoDB...');
    console.log(`📍 آدرس: ${MONGODB_URI}`);

    // برقراری ارتباط با MongoDB
    // mongoose.connect آدرس را می‌گیرد و به دیتابیس وصل می‌شود
    const connection = await mongoose.connect(MONGODB_URI);

    // نمایش اطلاعات اتصال موفق
    console.log('✅ اتصال به MongoDB با موفقیت برقرار شد');
    console.log(`   Host: ${connection.connection.host}`);
    console.log(`   Port: ${connection.connection.port}`);
    console.log(`   Database: ${connection.connection.name}`);

    // ============================================================
    // مدیریت رویدادهای (Events) اتصال
    // mongoose.connection.on برای گوش دادن به اتفاقات مختلف استفاده می‌شود
    // ============================================================

    // رویداد error: هر وقت خطایی در اتصال رخ دهد
    mongoose.connection.on('error', (err) => {
      console.error('❌ خطای MongoDB:', err.message);
    });

    // رویداد disconnected: وقتی اتصال قطع شود
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  اتصال MongoDB قطع شد');
    });

    // رویداد reconnected: وقتی اتصال مجدد برقرار شود
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 اتصال مجدد به MongoDB برقرار شد');
    });

    // برگرداندن شیء connection برای استفاده‌های بعدی
    return connection;
  } catch (error) {
    // اگر خطایی رخ داد، پیام خطا را نمایش بده
    console.error('❌ خطا در اتصال به MongoDB:', error.message);
    
    // خطا را به بالا پرتاب می‌کنیم تا index.js تصمیم بگیرد چه کند
    // (معمولاً برنامه را متوقف می‌کند)
    throw error;
  }
};

// خروجی گرفتن از تابع برای استفاده در فایل‌های دیگر
// حالا در index.js می‌توانیم بنویسیم: const connectDB = require('./database/db');
module.exports = connectDB;
