// ============================================================
// account-controller.js - کنترلر حساب کاربری
// تمام عملیات ثبت‌نام، ورود، خروج و بازیابی رمز اینجاست
// ============================================================

const User = require('./model/user');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ============================================================
// 📝 ثبت‌نام کاربر جدید
// ============================================================
exports.register = async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    // ۱. اعتبارسنجی اولیه
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '❌ لطفاً نام کاربری، ایمیل و رمز عبور را وارد کنید'
      });
    }

    // ۲. بررسی تکراری نبودن کاربر
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '❌ این نام کاربری یا ایمیل قبلاً ثبت شده است'
      });
    }

    // ۳. ساخت کاربر جدید
    const newUser = new User({
      username,
      email: email.toLowerCase(),
      password,
      fullName: fullName || ''
    });

    // ۴. ذخیره در دیتابیس (پسورد خودکار هش می‌شود)
    await newUser.save();

    // ۵. تولید توکن JWT
    const token = newUser.generateAuthToken();

    // ۶. ثبت زمان آخرین ورود
    newUser.lastLogin = new Date();
    await newUser.save({ validateBeforeSave: false });

    // ۷. پاسخ موفق
    res.status(201).json({
      success: true,
      message: '🎉 ثبت‌نام با موفقیت انجام شد',
      token,
      user: newUser.toPublicJSON()
    });

  } catch (error) {
    console.error('❌ خطا در ثبت‌نام:', error);

    // خطاهای Mongoose Validation
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: '❌ خطای سرور در ثبت‌نام'
    });
  }
};

// ============================================================
// 🔑 ورود کاربر
// ============================================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ۱. اعتبارسنجی
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '❌ لطفاً ایمیل و رمز عبور را وارد کنید'
      });
    }

    // ۲. یافتن کاربر (پسورد را هم انتخاب کن)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '❌ ایمیل یا رمز عبور اشتباه است'
      });
    }

    // ۳. بررسی فعال بودن حساب
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: '⛔ حساب کاربری شما غیرفعال شده است'
      });
    }

    // ۴. مقایسه رمز عبور
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '❌ ایمیل یا رمز عبور اشتباه است'
      });
    }

    // ۵. تولید توکن
    const token = user.generateAuthToken();

    // ۶. به‌روزرسانی زمان آخرین ورود
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: '✅ ورود موفقیت‌آمیز بود',
      token,
      user: user.toPublicJSON()
    });

  } catch (error) {
    console.error('❌ خطا در ورود:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور در ورود'
    });
  }
};

// ============================================================
// 🚪 خروج کاربر (اختیاری - می‌توان در کلاینت توکن را حذف کرد)
// ============================================================
exports.logout = async (req, res) => {
  try {
    // در JWT خروج واقعی در سمت سرور نداریم
    // می‌توانیم توکن را Blacklist کنیم
    res.json({
      success: true,
      message: '👋 خروج موفقیت‌آمیز بود'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور'
    });
  }
};

// ============================================================
// 📧 فراموشی رمز عبور - ارسال ایمیل
// ============================================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ کاربری با این ایمیل یافت نشد'
      });
    }

    // ۱. تولید توکن بازیابی
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // ۲. ذخیره توکن هش شده در دیتابیس
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // ۳۰ دقیقه
    await user.save({ validateBeforeSave: false });

    // ۳. ساخت لینک بازیابی
    const resetUrl = `${req.protocol}://${req.get('host')}/api/reset-password/${resetToken}`;

    // ۴. ارسال ایمیل (اختیاری)
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      await transporter.sendMail({
        to: user.email,
        subject: 'بازیابی رمز عبور Instagram Clone',
        html: `
          <h2>درخواست بازیابی رمز عبور</h2>
          <p>برای بازیابی رمز عبور خود روی لینک زیر کلیک کنید:</p>
          <a href="${resetUrl}">${resetUrl}</a>
          <p>این لینک تا ۳۰ دقیقه معتبر است.</p>
        `
      });
    } catch (emailError) {
      console.log('⚠️ خطا در ارسال ایمیل:', emailError);
      // حتی اگر ایمیل ارسال نشد، ادامه می‌دهیم
    }

    res.json({
      success: true,
      message: '📧 لینک بازیابی رمز عبور به ایمیل شما ارسال شد'
    });

  } catch (error) {
    console.error('❌ خطا در فراموشی رمز:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور'
    });
  }
};

// ============================================================
// 🔄 تنظیم مجدد رمز عبور
// ============================================================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // ۱. هش کردن توکن دریافتی
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // ۲. یافتن کاربر با توکن معتبر
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() } // هنوز منقضی نشده باشد
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: '❌ توکن نامعتبر یا منقضی شده است'
      });
    }

    // ۳. تنظیم رمز جدید
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // ۴. تولید توکن جدید
    const newToken = user.generateAuthToken();

    res.json({
      success: true,
      message: '✅ رمز عبور با موفقیت تغییر کرد',
      token: newToken
    });

  } catch (error) {
    console.error('❌ خطا در تغییر رمز:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور'
    });
  }
};
