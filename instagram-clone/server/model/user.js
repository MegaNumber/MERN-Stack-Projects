// ============================================================
// model/user.js - مدل کاربر (User Model)
// این فایل مشخص می‌کند هر کاربر چه اطلاعاتی دارد
// مثل یک فرم ثبت‌نام که فیلدهایش را اینجا تعریف می‌کنیم
// ============================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');   // برای رمزنگاری پسورد
const validator = require('validator'); // برای اعتبارسنجی ایمیل

// ۱. تعریف Schema (طرحواره) کاربر
const userSchema = new mongoose.Schema({
  // نام کاربری - یکتا و الزامی
  username: {
    type: String,
    required: [true, 'نام کاربری الزامی است'],
    unique: true,
    trim: true,                        // حذف فاصله‌های اضافی اول و آخر
    minlength: [3, 'نام کاربری باید حداقل ۳ کاراکتر باشد'],
    maxlength: [30, 'نام کاربری نمی‌تواند بیشتر از ۳۰ کاراکتر باشد'],
    // فقط حروف انگلیسی، اعداد، زیرخط و نقطه مجاز است
    match: [/^[a-zA-Z0-9._]+$/, 'نام کاربری فقط می‌تواند شامل حروف، اعداد، نقطه و زیرخط باشد']
  },

  // ایمیل - یکتا و الزامی
  email: {
    type: String,
    required: [true, 'ایمیل الزامی است'],
    unique: true,
    lowercase: true,                   // ذخیره به صورت حروف کوچک
    validate: [validator.isEmail, 'لطفاً یک ایمیل معتبر وارد کنید']
  },

  // رمز عبور - حداقل ۶ کاراکتر
  password: {
    type: String,
    required: [true, 'رمز عبور الزامی است'],
    minlength: [6, 'رمز عبور باید حداقل ۶ کاراکتر باشد'],
    select: false                      // هنگام دریافت اطلاعات کاربر، پسورد برگردانده نشود
  },

  // نام کامل (اختیاری)
  fullName: {
    type: String,
    default: '',
    maxlength: [50, 'نام کامل نمی‌تواند بیشتر از ۵۰ کاراکتر باشد']
  },

  // بیوگرافی (اختیاری)
  bio: {
    type: String,
    default: '',
    maxlength: [150, 'بیوگرافی نمی‌تواند بیشتر از ۱۵۰ کاراکتر باشد']
  },

  // عکس پروفایل (از Cloudinary)
  profilePicture: {
    url: {
      type: String,
      default: 'https://res.cloudinary.com/dxpglsfmf/image/upload/default-avatar.png'
    },
    publicId: {
      type: String,
      default: ''
    }
  },

  // وب‌سایت (اختیاری)
  website: {
    type: String,
    default: ''
  },

  // تعداد پست‌های کاربر
  postsCount: {
    type: Number,
    default: 0
  },

  // فالوورها (آرایه‌ای از شناسه کاربران)
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // فالوینگ‌ها (کسانی که دنبال می‌کنیم)
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // وضعیت حساب کاربری
  isActive: {
    type: Boolean,
    default: true
  },

  // نقش کاربر (برای مدیریت دسترسی‌ها)
  role: {
    type: String,
    enum: ['user', 'admin'],           // فقط این دو مقدار مجاز است
    default: 'user'
  },

  // تاریخ آخرین ورود
  lastLogin: {
    type: Date,
    default: null
  },

  // توکن بازیابی رمز عبور
  resetPasswordToken: String,
  resetPasswordExpire: Date,

}, {
  // timestamps: خودکار createdAt و updatedAt را اضافه می‌کند
  timestamps: true
});

// ============================================================
// Middleware های Mongoose
// ============================================================

// قبل از ذخیره (save) کاربر، پسورد را رمزنگاری کن
userSchema.pre('save', async function(next) {
  // اگر پسورد تغییر نکرده باشد، به مرحله بعد برو
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // تولید salt (نمک) با پیچیدگی ۱۲
    const salt = await bcrypt.genSalt(12);
    // هش کردن پسورد با salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// متدهای نمونه (Instance Methods)
// ============================================================

// مقایسه پسورد وارد شده با پسورد ذخیره شده
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// تولید توکن JWT برای کاربر
userSchema.methods.generateAuthToken = function() {
  const jwt = require('jsonwebtoken');
  
  return jwt.sign(
    { id: this._id, role: this.role },  // Payload
    process.env.JWT_SECRET,              // کلید مخفی
    { expiresIn: process.env.JWT_EXPIRE || '30d' } // زمان انقضا
  );
};

// برگرداندن اطلاعات عمومی کاربر (بدون اطلاعات حساس)
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    fullName: this.fullName,
    bio: this.bio,
    profilePicture: this.profilePicture,
    website: this.website,
    postsCount: this.postsCount,
    followersCount: this.followers.length,
    followingCount: this.following.length,
    createdAt: this.createdAt
  };
};

// ============================================================
// ایندکس‌ها برای جستجوی سریع‌تر
// ============================================================
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });

// ============================================================
// ساخت و خروجی مدل
// ============================================================
const User = mongoose.model('User', userSchema);

module.exports = User;
