// ============================================================
// controller/image-controller.js - کنترلر مدیریت تصاویر
// آپلود، ذخیره در Cloudinary و حذف تصاویر
// ============================================================

const cloudinary = require('cloudinary');
const User = require('../model/user');
const fs = require('fs').promises; // fs.promises برای async/await

// ============================================================
// 📸 آپلود عکس پروفایل
// PUT /api/me/profile-picture
// ============================================================
exports.uploadProfilePicture = async (req, res) => {
  try {
    // ۱. بررسی وجود فایل
    // req.file توسط multer اضافه شده
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '❌ لطفاً یک تصویر انتخاب کنید',
      });
    }

    console.log(`📸 دریافت عکس پروفایل: ${req.file.originalname}`);

    // ۲. یافتن کاربر
    const user = await User.findById(req.user.id);

    // ۳. اگر قبلاً عکس پروفایل داشته، از Cloudinary حذف کن
    if (user.profilePicture.publicId) {
      console.log(`🗑️ حذف عکس قبلی: ${user.profilePicture.publicId}`);
      await cloudinary.uploader.destroy(user.profilePicture.publicId);
    }

    // ۴. آپلود عکس جدید به Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'instagram-clone/profile-pictures', // پوشه در Cloudinary
      transformation: [
        // crop: 'fill' تصویر را به اندازه دقیق برش بزن
        // gravity: 'face' مرکز برش روی صورت باشد
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        // radius: 'max' گوشه‌ها را گرد کن (دایره کامل)
        { radius: 'max' },
        // quality: 'auto:good' کیفیت خودکار با اولویت خوب
        { quality: 'auto:good' },
      ],
    });

    // ۵. حذف فایل موقت از سرور
    // fs.unlink فایل را پاک می‌کند
    await fs.unlink(req.file.path);
    console.log('🗑️ فایل موقت حذف شد');

    // ۶. به‌روزرسانی اطلاعات کاربر در دیتابیس
    user.profilePicture = {
      url: result.secure_url, // آدرس HTTPS تصویر
      publicId: result.public_id, // شناسه یکتا در Cloudinary
    };
    await user.save();

    // ۷. پاسخ موفق
    res.json({
      success: true,
      message: '✅ عکس پروفایل با موفقیت به‌روزرسانی شد',
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    console.error('❌ خطا در آپلود عکس پروفایل:', error);

    // پاکسازی فایل در صورت خطا
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        /* ignore cleanup error */
      }
    }

    res.status(500).json({
      success: false,
      message: '❌ خطا در آپلود تصویر',
    });
  }
};

// ============================================================
// 🖼️ آپلود تصویر عمومی (برای استفاده در پست)
// POST /api/upload
// ============================================================
exports.uploadImage = async (req, res) => {
  try {
    // ۱. بررسی وجود فایل
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '❌ لطفاً یک تصویر انتخاب کنید',
      });
    }

    console.log(`📸 دریافت تصویر: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);

    // ۲. آپلود به Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'instagram-clone/posts',
      transformation: [
        // width: 1080 - حداکثر عرض ۱۰۸۰ پیکسل
        // crop: 'limit' - اگر کوچکتر است، بزرگ نشود
        { width: 1080, crop: 'limit' },
        { quality: 'auto:good' },
        // fetch_format: 'auto' - خودکار بهترین فرمت را انتخاب کن
        { fetch_format: 'auto' },
      ],
    });

    // ۳. حذف فایل موقت
    await fs.unlink(req.file.path);
    console.log('🗑️ فایل موقت حذف شد');

    // ۴. پاسخ با اطلاعات تصویر
    res.json({
      success: true,
      message: '✅ تصویر با موفقیت آپلود شد',
      image: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
      },
    });
  } catch (error) {
    console.error('❌ خطا در آپلود تصویر:', error);

    // پاکسازی
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        /* ignore */
      }
    }

    res.status(500).json({
      success: false,
      message: '❌ خطا در آپلود تصویر',
    });
  }
};

// ============================================================
// 🗑️ حذف تصویر از Cloudinary
// DELETE /api/images/:publicId
// ============================================================
exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    console.log(`🗑️ درخواست حذف تصویر: ${publicId}`);

    // cloudinary.uploader.destroy تصویر را از Cloudinary حذف می‌کند
    const result = await cloudinary.uploader.destroy(publicId);

    console.log('نتیجه حذف:', result);

    res.json({
      success: true,
      message: '✅ تصویر با موفقیت حذف شد',
      result,
    });
  } catch (error) {
    console.error('❌ خطا در حذف تصویر:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در حذف تصویر',
    });
  }
};
