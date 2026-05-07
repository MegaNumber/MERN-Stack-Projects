// ============================================================
// controller/account-controller.js - کنترلر حساب کاربری
// تمام عملیات ثبت‌نام، ورود و بازیابی رمز عبور
// هر تابع یک عملیات را انجام می‌دهد و response را می‌فرستد
// ============================================================

const User = require('../model/user');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ============================================================
// 📝 ثبت‌نام کاربر جدید
// POST /api/register
// ============================================================
exports.register = async (req, res) => {
  try {
    // ۱. دریافت اطلاعات از body درخواست
    const { username, email, password, fullName } = req.body;

    // ۲. اعتبارسنجی اولیه - فیلدهای ضروری
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '❌ لطفاً نام کاربری، ایمیل و رمز عبور را وارد کنید',
      });
    }

    // ۳. بررسی تکراری نبودن کاربر
    // $or یعنی دنبال کاربری بگرد که username یا email آن تکراری باشد
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '❌ این نام کاربری یا ایمیل قبلاً ثبت شده است',
      });
    }

    // ۴. ساخت نمونه جدید از مدل User
    const newUser = new User({
      username,
      email: email.toLowerCase(), // ایمیل را با حروف کوچک ذخیره کن
      password,                    // پسورد خودکار توسط middleware هش می‌شود
      fullName: fullName || '',    // اگر fullName نبود، رشته خالی
    });

    // ۵. ذخیره کاربر در دیتابیس
    // save() یک عملیات async است چون با دیتابیس کار دارد
    await newUser.save();

    // ۶. تولید توکن JWT
    const token = newUser.generateAuthToken();

    // ۷. پاسخ موفق به کلاینت
    // 201 Created یعنی یک منبع جدید ساخته شد
    res.status(201).json({
      success: true,
      message: '🎉 ثبت‌نام با موفقیت انجام شد',
      token, // توکن را هم برمی‌گردانیم تا کاربر خودکار وارد شود
      user: newUser.toPublicJSON(),
    });
  } catch (error) {
    console.error('❌ خطا در ثبت‌نام:', error);

    // اگر خطا از نوع Mongoose Validation بود
    if (error.name === 'ValidationError') {
      // Object.values() تمام خطاها را به آرایه تبدیل می‌کند
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join('، '),
      });
    }

    // اگر خطای duplicate key بود (username یا email تکراری)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: '❌ این نام کاربری یا ایمیل قبلاً ثبت شده است',
      });
    }

    res.status(500).json({
      success: false,
      message: '❌ خطای سرور در ثبت‌نام',
    });
  }
};

// ============================================================
// 🔑 ورود کاربر
// POST /api/login
// ============================================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ۱. اعتبارسنجی
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '❌ لطفاً ایمیل و رمز عبور را وارد کنید',
      });
    }

    // ۲. یافتن کاربر با ایمیل
    // .select('+password') چون در Schema گفتیم select: false
    // حالا صراحتاً می‌گوییم پسورد را هم برگردان
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );

    // اگر کاربر یافت نشد
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '❌ ایمیل یا رمز عبور اشتباه است',
      });
    }

    // ۳. بررسی فعال بودن حساب
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: '⛔ حساب کاربری شما غیرفعال شده است',
      });
    }

    // ۴. مقایسه رمز عبور
    // comparePassword متدی است که در model/user.js تعریف کردیم
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '❌ ایمیل یا رمز عبور اشتباه است',
      });
    }

    // ۵. تولید توکن
    const token = user.generateAuthToken();

    // ۶. پاسخ موفق
    res.json({
      success: true,
      message: '✅ ورود موفقیت‌آمیز بود',
      token,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('❌ خطا در ورود:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور در ورود',
    });
  }
};

// ============================================================
// 📧 فراموشی رمز عبور
// POST /api/forgot-password
// ============================================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // ۱. یافتن کاربر
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // نکته امنیتی: حتی اگر کاربر نباشد، پیام یکسان بده
      // تا مهاجم نفهمد ایمیل در سیستم هست یا نه
      return res.json({
        success: true,
        message:
          '📧 اگر این ایمیل در سیستم ثبت شده باشد، لینک بازیابی به آن ارسال می‌شود',
      });
    }

    // ۲. تولید توکن بازیابی
    // crypto.randomBytes(32) ۳۲ بایت داده تصادفی می‌سازد
    const resetToken = crypto.randomBytes(32).toString('hex');

    // توکن را هش می‌کنیم (در دیتابیس نباید توکن خام ذخیره شود)
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // ۳. ذخیره توکن هش شده و زمان انقضا در دیتابیس
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // ۳۰ دقیقه
    await user.save({ validateBeforeSave: false }); // validateBeforeSave: false یعنی اعتبارسنجی نکن

    // ۴. ارسال ایمیل (اختیاری)
    try {
      // ساخت transporter برای ارسال ایمیل
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // لینک بازیابی
      const resetUrl = `${req.protocol}://${req.get('host')}/api/reset-password/${resetToken}`;

      // ارسال ایمیل
      await transporter.sendMail({
        to: user.email,
        subject: '🔑 بازیابی رمز عبور - Instagram Clone',
        html: `
          <div dir="rtl" style="font-family: Tahoma; max-width: 500px; margin: 0 auto;">
            <h2>درخواست بازیابی رمز عبور</h2>
            <p>برای بازیابی رمز عبور خود روی لینک زیر کلیک کنید:</p>
            <a href="${resetUrl}">${resetUrl}</a>
            <p><strong>این لینک تا ۳۰ دقیقه معتبر است.</strong></p>
            <p>اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید.</p>
          </div>
        `,
      });

      console.log('📧 ایمیل بازیابی ارسال شد');
    } catch (emailError) {
      console.error('⚠️ خطا در ارسال ایمیل:', emailError);
      // حتی اگر ایمیل ارسال نشد، ادامه می‌دهیم
    }

    res.json({
      success: true,
      message:
        '📧 اگر این ایمیل در سیستم ثبت شده باشد، لینک بازیابی به آن ارسال می‌شود',
    });
  } catch (error) {
    console.error('❌ خطا در فراموشی رمز:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور',
    });
  }
};

// ============================================================
// 🔄 تنظیم مجدد رمز عبور
// PUT /api/reset-password/:token
// ============================================================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params; // توکن از URL دریافت می‌شود
    const { password } = req.body; // پسورد جدید از body

    // ۱. هش کردن توکن دریافتی
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // ۲. یافتن کاربر با توکن معتبر و منقضی نشده
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }, // $gt یعنی greater than (بزرگتر از الان)
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: '❌ توکن نامعتبر یا منقضی شده است',
      });
    }

    // ۳. تنظیم رمز جدید
    user.password = password;
    user.resetPasswordToken = undefined; // پاک کردن توکن
    user.resetPasswordExpire = undefined; // پاک کردن زمان انقضا
    await user.save(); // پسورد خودکار توسط middleware هش می‌شود

    // ۴. تولید توکن جدید برای ورود خودکار
    const newToken = user.generateAuthToken();

    res.json({
      success: true,
      message: '✅ رمز عبور با موفقیت تغییر کرد',
      token: newToken,
    });
  } catch (error) {
    console.error('❌ خطا در تغییر رمز:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور',
    });
  }
};
