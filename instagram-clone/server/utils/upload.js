// ============================================================
// utils/upload.js - پیکربندی Multer برای آپلود فایل
// Multer یک middleware برای Express است که فایل‌های آپلودی را پردازش می‌کند
// این فایل تنظیمات ذخیره‌سازی موقت فایل‌ها را مدیریت می‌کند
// ============================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================================
// ۱. اطمینان از وجود پوشه uploads
// ============================================================
// __dirname مسیر پوشه فعلی (utils) است
// ../ یعنی یک پوشه به عقب (پوشه server)
const uploadDirectory = path.join(__dirname, '..', 'uploads');

// fs.existsSync چک می‌کند آیا پوشه وجود دارد
if (!fs.existsSync(uploadDirectory)) {
  // fs.mkdirSync پوشه را می‌سازد
  // recursive: true یعنی اگر پوشه‌های والد هم وجود نداشتند، آنها را هم بساز
  fs.mkdirSync(uploadDirectory, { recursive: true });
  console.log('📁 پوشه uploads ساخته شد');
}

// ============================================================
// ۲. تعریف Storage (محل و نام ذخیره‌سازی)
// ============================================================
const storage = multer.diskStorage({
  // destination: فایل کجا ذخیره شود
  destination: function (req, file, cb) {
    // cb(null, path) یعنی "همه چیز خوب است، فایل را اینجا ذخیره کن"
    cb(null, uploadDirectory);
  },

  // filename: فایل با چه نامی ذخیره شود
  filename: function (req, file, cb) {
    // ساخت یک نام یکتا برای جلوگیری از تداخل نام فایل‌ها
    // Date.now() زمان فعلی به میلی‌ثانیه
    // Math.random() یک عدد تصادفی بین ۰ و ۱
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);

    // path.extname() پسوند فایل را برمی‌گرداند (مثلاً .jpg)
    const ext = path.extname(file.originalname).toLowerCase();

    // نام نهایی: fieldname-timestamp-random.ext
    // مثال: image-1700123456789-123456789.jpg
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// ============================================================
// ۳. فیلتر فایل (File Filter)
// فقط انواع خاصی از فایل‌ها مجاز هستند
// ============================================================
const fileFilter = (req, file, cb) => {
  // لیست MIME Type های مجاز
  // MIME Type نوع فایل را مشخص می‌کند
  const allowedMimeTypes = [
    '
