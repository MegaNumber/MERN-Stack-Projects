// ============================================================
// middleware/auth.js - میدلورهای احراز هویت
// این فایل مثل نگهبان عمل می‌کند
// بررسی می‌کند کاربر قبل از دسترسی به مسیرهای خصوصی لاگین کرده باشد
// ============================================================

const jwt = require('jsonwebtoken');
const User = require('../model/user');

/**
 * میدلور protect (محافظ)
 * این میدلور برای مسیرهایی استفاده می‌شود که حتماً باید کاربر لاگین کرده باشد
 * مثل: ایجاد پست، لایک، کامنت، ویرایش پروفایل
 * 
 * @param {Object} req - درخواست
 * @param {Object} res - پاسخ
 * @param {Function} next - تابع رفتن به مرحله بعد
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // ==========================================================
    // ۱. استخراج توکن از هدر Authorization
    // ==========================================================
    // هدر Authorization معمولاً به این شکل است: "Bearer eyJhbGciOiJIUzI1..."
    // ما باید قسمت بعد از Bearer را برداریم
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // split(' ') رشته را از فاصله جدا می‌کند و آرایه می‌سازد
      // [0] = "Bearer", [1] = توکن
      token = req.headers.authorization.split(' ')[1];
    }

    // ==========================================================
    // ۲. اگر توکن وجود نداشت، دسترسی غیرمجاز
    // ==========================================================
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '⛔ لطفاً وارد حساب کاربری خود شوید',
      });
    }

    // ==========================================================
    // ۳. تایید (Verify) توکن
    // ==========================================================
    // jwt.verify توکن را با کلید مخفی بررسی می‌کند
    // اگر توکن دستکاری شده یا منقضی شده باشد، خطا می‌دهد
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded حالا شامل { id, role, iat, exp } است

    // ==========================================================
    // ۴. یافتن کاربر در دیتابیس
    // ==========================================================
    const user = await User.findById(decoded.id);

    // اگر کاربر وجود نداشت (مثلاً حذف شده باشد)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '⛔ کاربر متعلق به این توکن یافت نشد',
      });
    }

    // ==========================================================
    // ۵. بررسی فعال بودن حساب کاربری
    // ==========================================================
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: '⛔ حساب کاربری شما غیرفعال شده است',
      });
    }

    // ==========================================================
    // ۶. احراز هویت موفق - کاربر را به req اضافه کن
    // ==========================================================
    // req.user حالا در تمام مسیرهای بعدی در دسترس است
    req.user = user;

    // next() یعنی برو به مرحله بعد (کنترلر اصلی)
    next();
  } catch (error) {
    // ==========================================================
    // مدیریت انواع خطاهای JWT
    // ==========================================================

    // JsonWebTokenError: توکن ساختار نامعتبری دارد
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '⛔ توکن نامعتبر است',
      });
    }

    // TokenExpiredError: توکن منقضی شده
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '⛔ توکن منقضی شده، لطفاً دوباره وارد شوید',
      });
    }

    // خطای غیرمنتظره
    console.error('❌ خطای احراز هویت:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور در احراز هویت',
    });
  }
};

/**
 * میدلور optionalAuth (احراز هویت اختیاری)
 * این میدلور برای مسیرهایی است که هم برای کاربران لاگین کرده
 * و هم برای کاربران مهمان قابل دسترسی است
 * مثل: دیدن فید پست‌ها (اگر لاگین باشد اطلاعات بیشتری می‌بینیم)
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // استخراج توکن مثل قبل
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // اگر توکن وجود داشت، کاربر را شناسایی کن
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      // اگر کاربر وجود داشت و فعال بود، به req اضافه کن
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // اگر توکن نامعتبر بود، فقط نادیده بگیر و ادامه بده
    // کاربر بدون احراز هویت ادامه می‌دهد
  }

  // در هر صورت ادامه بده (چه کاربر لاگین باشد چه نه)
  next();
};

/**
 * میدلور adminOnly (فقط مدیران)
 * بررسی می‌کند کاربر role=admin داشته باشد
 */
const adminOnly = (req, res, next) => {
  // req.user باید قبلاً توسط protect تنظیم شده باشد
  if (req.user && req.user.role === 'admin') {
    next(); // ادمین است، اجازه دسترسی بده
  } else {
    res.status(403).json({
      success: false,
      message: '⛔ فقط مدیران به این بخش دسترسی دارند',
    });
  }
};

// خروجی گرفتن از میدلورها
module.exports = { protect, optionalAuth, adminOnly };
