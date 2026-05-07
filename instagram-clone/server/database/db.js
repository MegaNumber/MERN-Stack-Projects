// ============================================================
// database/db.js - مدیریت اتصال به MongoDB
// این فایل مثل یک پل است که برنامه ما را به دیتابیس وصل می‌کند
// ============================================================

const mongoose = require('mongoose');
// mongoose کتابخانه‌ای است که کار با MongoDB را در Node.js آسان می‌کند

// تابع اتصال به دیتابیس
const connectDB = async () => {
  try {
    // خواندن آدرس دیتابیس از .env
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/instagram-clone';
    
    console.log('🔌 در حال اتصال به MongoDB...');
    
    // برقراری ارتباط با MongoDB
    const connection = await mongoose.connect(MONGODB_URI, {
      // این گزینه‌ها برای نسخه‌های جدید mongoose
      // mongoose 7 به بعد اینها را خودکار مدیریت می‌کند
    });

    // نمایش اطلاعات اتصال
    console.log('═══════════════════════════════════════');
    console.log('✅ اتصال به MongoDB با موفقیت برقرار شد');
    console.log(`📊 Host: ${connection.connection.host}`);
    console.log(`📊 Port: ${connection.connection.port}`);
    console.log(`📊 Database: ${connection.connection.name}`);
    console.log('═══════════════════════════════════════');

    // مدیریت رویدادهای اتصال
    mongoose.connection.on('error', (err) => {
      console.error('❌ خطای MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  اتصال MongoDB قطع شد');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 اتصال مجدد به MongoDB برقرار شد');
    });

    return connection;

  } catch (error) {
    console.error('❌ خطا در اتصال به MongoDB:', error.message);
    // خطا را به بالا پرتاب می‌کنیم تا index.js تصمیم بگیرد چه کند
    throw error;
  }
};

module.exports = connectDB;
