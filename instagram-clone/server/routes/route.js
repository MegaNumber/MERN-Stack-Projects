// ============================================================
// routes/route.js - تعریف تمام مسیرهای API
// این فایل مثل یک تابلوی راهنماست که هر URL را به کنترلر مربوطه وصل می‌کند
// ============================================================

// وارد کردن Express و ساخت Router
const express = require('express');
const router = express.Router();
// Router مثل یک مینی-اپ Express است که فقط مسیرها را مدیریت می‌کند

// وارد کردن ابزار آپلود
const upload = require('../utils/upload');

// وارد کردن میدلورهای احراز هویت
const { protect, optionalAuth } = require('../middleware/auth');

// وارد کردن کنترلرها
const accountController = require('../controller/account-controller');
const imageController = require('../controller/image-controller');
const postController = require('../controller/post-controller');
const userController = require('../controller/user-controller');

// ══════════════════════════════════════════════════════════
// مسیر تست
// ══════════════════════════════════════════════════════════

// GET /api/health - تست سلامت سرور
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '🚀 سرور Instagram Clone فعال است',
  });
});

// ══════════════════════════════════════════════════════════
// مسیرهای احراز هویت (Account)
// ══════════════════════════════════════════════════════════

// POST /api/register - ثبت‌نام کاربر جدید
router.post('/register', accountController.register);

// POST /api/login - ورود کاربر
router.post('/login', accountController.login);

// POST /api/forgot-password - فراموشی رمز عبور
router.post('/forgot-password', accountController.forgotPassword);

// PUT /api/reset-password/:token - تنظیم مجدد رمز عبور
router.put('/reset-password/:token', accountController.resetPassword);

// ══════════════════════════════════════════════════════════
// مسیرهای پروفایل کاربر (باید لاگین کرده باشد)
// ══════════════════════════════════════════════════════════

// GET /api/me - دریافت پروفایل خودم (private)
router.get('/me', protect, userController.getMyProfile);

// PUT /api/me - ویرایش پروفایل خودم
router.put('/me', protect, userController.updateProfile);

// PUT /api/me/profile-picture - آپلود عکس پروفایل
router.put(
  '/me/profile-picture',
  protect,                  // اول چک کن لاگین هست
  upload.single('image'),   // بعد فایل را دریافت کن (فیلد image)
  imageController.uploadProfilePicture // بعد کنترلر را اجرا کن
);

// ══════════════════════════════════════════════════════════
// مسیرهای کاربران عمومی
// ══════════════════════════════════════════════════════════

// GET /api/users/:username - دریافت پروفایل عمومی یک کاربر
router.get('/users/:username', optionalAuth, userController.getUserProfile);

// GET /api/search?query=something - جستجوی کاربران
router.get('/search', protect, userController.searchUsers);

// PUT /api/users/:id/follow - فالو / آنفالو کاربر
router.put('/users/:id/follow', protect, userController.toggleFollow);

// GET /api/users/:id/followers - دریافت فالوورهای کاربر
router.get('/users/:id/followers', userController.getFollowers);

// GET /api/users/:id/following - دریافت فالوینگ‌های کاربر
router.get('/users/:id/following', userController.getFollowing);

// ══════════════════════════════════════════════════════════
// مسیرهای آپلود تصویر
// ══════════════════════════════════════════════════════════

// POST /api/upload - آپلود تصویر (برای پست)
router.post(
  '/upload',
  protect,                // حتماً لاگین باشد
  upload.single('image'), // فایل با field name 'image' دریافت شود
  imageController.uploadImage
);

// DELETE /api/images/:publicId - حذف تصویر از Cloudinary
router.delete('/images/:publicId', protect, imageController.deleteImage);

// ══════════════════════════════════════════════════════════
// مسیرهای پست‌ها
// ══════════════════════════════════════════════════════════

// POST /api/posts - ایجاد پست جدید (با آپلود تصویر)
router.post(
  '/posts',
  protect,                // حتماً لاگین باشد
  upload.single('image'), // دریافت فایل تصویر
  postController.createPost
);

// GET /api/posts?page=1&limit=10 - دریافت فید پست‌ها
router.get('/posts', optionalAuth, postController.getFeed);

// GET /api/posts/:id - دریافت یک پست خاص
router.get('/posts/:id', optionalAuth, postController.getPost);

// PUT /api/posts/:id - ویرایش کپشن پست
router.put('/posts/:id', protect, postController.updatePost);

// DELETE /api/posts/:id - حذف پست
router.delete('/posts/:id', protect, postController.deletePost);

// PUT /api/posts/:id/like - لایک / آنلایک پست
router.put('/posts/:id/like', protect, postController.toggleLike);

// POST /api/posts/:id/comments - افزودن کامنت
router.post('/posts/:id/comments', protect, postController.addComment);

// DELETE /api/posts/:id/comments/:commentId - حذف کامنت
router.delete(
  '/posts/:id/comments/:commentId',
  protect,
  postController.deleteComment
);

// GET /api/tags/:tag - دریافت پست‌های یک هشتگ
router.get('/tags/:tag', optionalAuth, postController.getPostsByTag);

// ══════════════════════════════════════════════════════════
// خروجی router برای استفاده در index.js
// ══════════════════════════════════════════════════════════
module.exports = router;
