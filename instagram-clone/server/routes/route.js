// ============================================================
// routes/route.js - تعریف تمام مسیرهای API
// این فایل مثل تابلو راهنماست که می‌گوید هر درخواست به کجا برود
// ============================================================

const express = require('express');
const router = express.Router();
const upload = require('../utils/upload');

// وارد کردن کنترلرها
const accountController = require('../account-controller');
const imageController = require('../image-controller');
const postController = require('../post-controller');
const userController = require('../user-controller');

// وارد کردن میدلور احراز هویت
const { protect, optionalAuth } = require('../middleware/auth');

// ══════════════════════════════════════════════
// مسیرهای عمومی (بدون نیاز به احراز هویت)
// ══════════════════════════════════════════════

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// ══════════════════════════════════════════════
// مسیرهای احراز هویت (Account)
// ══════════════════════════════════════════════

// ثبت‌نام کاربر جدید
router.post('/register', accountController.register);

// ورود کاربر
router.post('/login', accountController.login);

// خروج کاربر
router.post('/logout', protect, accountController.logout);

// بازیابی رمز عبور
router.post('/forgot-password', accountController.forgotPassword);

// تنظیم مجدد رمز عبور
router.put('/reset-password/:token', accountController.resetPassword);

// ══════════════════════════════════════════════
// مسیرهای کاربر (User)
// ══════════════════════════════════════════════

// دریافت پروفایل کاربر (نسخه عمومی)
router.get('/users/:username', optionalAuth, userController.getUserProfile);

// دریافت پروفایل خود کاربر (نسخه خصوصی)
router.get('/me', protect, userController.getMyProfile);

// ویرایش پروفایل
router.put('/me', protect, userController.updateProfile);

// جستجوی کاربران
router.get('/search', protect, userController.searchUsers);

// فالو / آنفالو کاربر
router.put('/users/:id/follow', protect, userController.toggleFollow);

// دریافت فالوورهای یک کاربر
router.get('/users/:id/followers', userController.getFollowers);

// دریافت فالوینگ‌های یک کاربر
router.get('/users/:id/following', userController.getFollowing);

// ══════════════════════════════════════════════
// مسیرهای تصویر (Image)
// ══════════════════════════════════════════════

// آپلود عکس پروفایل
router.put('/me/profile-picture', protect, upload.single('image'), imageController.uploadProfilePicture);

// آپلود تصویر پست
router.post('/upload', protect, upload.single('image'), imageController.uploadImage);

// حذف تصویر
router.delete('/images/:publicId', protect, imageController.deleteImage);

// ══════════════════════════════════════════════
// مسیرهای پست (Post)
// ══════════════════════════════════════════════

// ایجاد پست جدید
router.post('/posts', protect, upload.single('image'), postController.createPost);

// دریافت فید پست‌ها (با pagination)
router.get('/posts', optionalAuth, postController.getFeed);

// دریافت یک پست خاص
router.get('/posts/:id', optionalAuth, postController.getPost);

// ویرایش کپشن پست
router.put('/posts/:id', protect, postController.updatePost);

// حذف پست
router.delete('/posts/:id', protect, postController.deletePost);

// لایک / آنلایک پست
router.put('/posts/:id/like', protect, postController.toggleLike);

// افزودن کامنت
router.post('/posts/:id/comments', protect, postController.addComment);

// حذف کامنت
router.delete('/posts/:id/comments/:commentId', protect, postController.deleteComment);

// دریافت پست‌های یک هشتگ
router.get('/tags/:tag', optionalAuth, postController.getPostsByTag);

module.exports = router;
