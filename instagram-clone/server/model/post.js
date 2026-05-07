// ============================================================
// model/post.js - مدل پست (Post Model)
// ساختار هر پست اینستاگرام را تعریف می‌کند
// ============================================================

const mongoose = require('mongoose');

// ۱. تعریف Schema پست
const postSchema = new mongoose.Schema({
  // کاربر سازنده پست (ارجاع به مدل User)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'پست باید یک نویسنده داشته باشد'],
    index: true                       // ایندکس برای جستجوی سریع
  },

  // متن کپشن
  caption: {
    type: String,
    default: '',
    maxlength: [2200, 'کپشن نمی‌تواند بیشتر از ۲۲۰۰ کاراکتر باشد']
  },

  // اطلاعات تصویر
  image: {
    url: {
      type: String,
      required: [true, 'آدرس تصویر الزامی است']
    },
    publicId: {
      type: String,
      required: [true, 'شناسه عمومی تصویر الزامی است']
    },
    width: Number,
    height: Number,
    format: String,
    size: Number                      // حجم به بایت
  },

  // آرایه لایک‌ها (شناسه کاربرانی که لایک کرده‌اند)
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // کامنت‌ها
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: [true, 'متن کامنت نمی‌تواند خالی باشد'],
      maxlength: [500, 'کامنت نمی‌تواند بیشتر از ۵۰۰ کاراکتر باشد']
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // هشتگ‌ها
  tags: [String],

  // مکان (اختیاری)
  location: String,

  // وضعیت پست (منتشر شده، پیش‌نویس، آرشیو)
  status: {
    type: String,
    enum: ['published', 'draft', 'archived'],
    default: 'published'
  }

}, {
  timestamps: true // createdAt و updatedAt خودکار
});

// ============================================================
// Middleware: استخراج خودکار هشتگ‌ها از کپشن
// ============================================================
postSchema.pre('save', function(next) {
  if (this.caption) {
    // پیدا کردن تمام کلماتی که با # شروع می‌شوند
    // \u0600-\u06FF شامل کاراکترهای فارسی هم می‌شود
    const hashtags = this.caption.match(/#[\w\u0600-\u06FF]+/g);
    this.tags = hashtags ? [...new Set(hashtags.map(tag => tag.toLowerCase()))] : [];
  }
  next();
});

// ============================================================
// متدهای کمک‌کننده
// ============================================================

// بررسی اینکه یک کاربر پست را لایک کرده یا نه
postSchema.methods.isLikedBy = function(userId) {
  return this.likes.includes(userId);
};

// تعداد کامنت‌ها
postSchema.virtual('commentsCount').get(function() {
  return this.comments.length;
});

// فعال‌سازی virtuals در خروجی JSON
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

// ============================================================
// ایندکس‌ها
// ============================================================
postSchema.index({ user: 1, createdAt: -1 }); // برای گرفتن پست‌های یک کاربر
postSchema.index({ tags: 1 });                 // برای جستجوی هشتگ
postSchema.index({ createdAt: -1 });           // برای مرتب‌سازی

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
