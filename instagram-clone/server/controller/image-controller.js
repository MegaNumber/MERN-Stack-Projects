// ============================================================
// image-controller.js - کنترلر مدیریت تصاویر
// آپلود تصاویر پروفایل و پست به Cloudinary
// ============================================================

const cloudinary = require('cloudinary');
const User = require('./model/user');
const fs = require('fs').promises;

// ============================================================
// 📸 آپلود عکس پروفایل
// ============================================================
exports.uploadProfilePicture = async (req, res) => {
  try {
    // ۱. بررسی وجود فایل
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '❌ لطفاً یک تصویر انتخاب کنید'
      });
    }

    // ۲. یافتن کاربر
    const user = await User.findById(req.user.id);
    
    // ۳. اگر قبلاً عکس پروفایل داشته، از Cloudinary حذف کن
    if (user.profilePicture.publicId) {
      await cloudinary.uploader.destroy(user.profilePicture.publicId);
    }

    // ۴. آپلود به Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'instagram-clone/profile-pictures',
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { radius: 'max' },
        { quality: 'auto:good' }
      ]
    });

    // ۵. حذف فایل موقت
    await fs.unlink(req.file.path);

    // ۶. به‌روزرسانی کاربر
    user.profilePicture = {
      url: result.secure_url,
      publicId: result.public_id
    };
    await user.save();

    res.json({
      success: true,
      message: '✅ عکس پروفایل با موفقیت آپلود شد',
      profilePicture: user.profilePicture
    });

  } catch (error) {
    console.error('❌ خطا در آپلود عکس پروفایل:', error);
    
    // پاکسازی فایل در صورت خطا
    if (req.file) {
      try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }
    }

    res.status(500).json({
      success: false,
      message: '❌ خطا در آپلود تصویر'
    });
  }
};

// ============================================================
// 🖼️ آپلود تصویر عمومی (برای پست)
// ============================================================
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '❌ لطفاً یک تصویر انتخاب کنید'
      });
    }

    // آپلود به Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'instagram-clone/posts',
      transformation: [
        { width: 1080, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    // حذف فایل موقت
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      message: '✅ تصویر با موفقیت آپلود شد',
      image: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes
      }
    });

  } catch (error) {
    console.error('❌ خطا در آپلود تصویر:', error);
    
    if (req.file) {
      try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }
    }

    res.status(500).json({
      success: false,
      message: '❌ خطا در آپلود تصویر'
    });
  }
};

// ============================================================
// 🗑️ حذف تصویر
// ============================================================
exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    await cloudinary.uploader.destroy(publicId);

    res.json({
      success: true,
      message: '✅ تصویر با موفقیت حذف شد'
    });

  } catch (error) {
    console.error('❌ خطا در حذف تصویر:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در حذف تصویر'
    });
  }
};
