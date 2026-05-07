// ============================================================
// post-controller.js - کنترلر مدیریت پست‌ها
// ایجاد، ویرایش، حذف، لایک و کامنت پست‌ها
// ============================================================

const Post = require('./model/post');
const User = require('./model/user');
const cloudinary = require('cloudinary');
const fs = require('fs').promises;

// ============================================================
// 📝 ایجاد پست جدید
// ============================================================
exports.createPost = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '❌ لطفاً یک تصویر برای پست انتخاب کنید'
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

    // ساخت پست جدید
    const newPost = new Post({
      user: req.user.id,
      caption: req.body.caption || '',
      location: req.body.location || '',
      image: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes
      }
    });

    await newPost.save();

    // افزایش شمارنده پست‌های کاربر
    await User.findByIdAndUpdate(req.user.id, { $inc: { postsCount: 1 } });

    // populate کاربر برای برگرداندن اطلاعات کامل
    const populatedPost = await Post.findById(newPost._id)
      .populate('user', 'username profilePicture');

    res.status(201).json({
      success: true,
      message: '🎉 پست با موفقیت منتشر شد',
      post: populatedPost
    });

  } catch (error) {
    console.error('❌ خطا در ایجاد پست:', error);
    
    if (req.file) {
      try { await fs.unlink(req.file.path); } catch (e) { /* ignore */ }
    }

    res.status(500).json({
      success: false,
      message: '❌ خطا در ایجاد پست'
    });
  }
};

// ============================================================
// 📋 دریافت فید پست‌ها
// ============================================================
exports.getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // دریافت پست‌ها با اطلاعات کاربر و مرتب‌سازی نزولی
    const posts = await Post.find({ status: 'published' })
      .populate('user', 'username fullName profilePicture')
      .populate('comments.user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ status: 'published' });

    res.json({
      success: true,
      count: posts.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
      posts
    });

  } catch (error) {
    console.error('❌ خطا در دریافت پست‌ها:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در دریافت پست‌ها'
    });
  }
};

// ============================================================
// 🔍 دریافت یک پست خاص
// ============================================================
exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'username fullName profilePicture bio')
      .populate('comments.user', 'username profilePicture');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد'
      });
    }

    res.json({
      success: true,
      post
    });

  } catch (error) {
    console.error('❌ خطا در دریافت پست:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در دریافت پست'
    });
  }
};

// ============================================================
// ✏️ ویرایش کپشن پست
// ============================================================
exports.updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد'
      });
    }

    // فقط مالک می‌تواند ویرایش کند
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '⛔ شما مجاز به ویرایش این پست نیستید'
      });
    }

    post.caption = req.body.caption || post.caption;
    post.location = req.body.location || post.location;
    await post.save();

    res.json({
      success: true,
      message: '✅ پست با موفقیت ویرایش شد',
      post
    });

  } catch (error) {
    console.error('❌ خطا در ویرایش پست:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در ویرایش پست'
    });
  }
};

// ============================================================
// 🗑️ حذف پست
// ============================================================
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد'
      });
    }

    // فقط مالک می‌تواند حذف کند
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '⛔ شما مجاز به حذف این پست نیستید'
      });
    }

    // حذف تصویر از Cloudinary
    await cloudinary.uploader.destroy(post.image.publicId);

    // حذف پست از دیتابیس
    await Post.findByIdAndDelete(req.params.id);

    // کاهش شمارنده پست‌های کاربر
    await User.findByIdAndUpdate(req.user.id, { $inc: { postsCount: -1 } });

    res.json({
      success: true,
      message: '🗑️ پست با موفقیت حذف شد'
    });

  } catch (error) {
    console.error('❌ خطا در حذف پست:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در حذف پست'
    });
  }
};

// ============================================================
// ❤️ لایک / آنلایک پست
// ============================================================
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد'
      });
    }

    const userId = req.user.id;
    const likeIndex = post.likes.indexOf(userId);

    if (likeIndex === -1) {
      // لایک
      post.likes.push(userId);
    } else {
      // آنلایک
      post.likes.splice(likeIndex, 1);
    }

    await post.save();

    res.json({
      success: true,
      isLiked: likeIndex === -1,
      likesCount: post.likes.length
    });

  } catch (error) {
    console.error('❌ خطا در لایک:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در ثبت لایک'
    });
  }
};

// ============================================================
// 💬 افزودن کامنت
// ============================================================
exports.addComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد'
      });
    }

    const { text } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '❌ متن کامنت نمی‌تواند خالی باشد'
      });
    }

    post.comments.push({
      user: req.user.id,
      text: text.trim()
    });

    await post.save();

    // برگرداندن کامنت اضافه شده با اطلاعات کاربر
    const updatedPost = await Post.findById(post._id)
      .populate('comments.user', 'username profilePicture');

    const newComment = updatedPost.comments[updatedPost.comments.length - 1];

    res.status(201).json({
      success: true,
      message: '💬 کامنت اضافه شد',
      comment: newComment
    });

  } catch (error) {
    console.error('❌ خطا در افزودن کامنت:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در افزودن کامنت'
    });
  }
};

// ============================================================
// 🗑️ حذف کامنت
// ============================================================
exports.deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد'
      });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: '❌ کامنت یافت نشد'
      });
    }

    // فقط مالک کامنت یا مالک پست می‌تواند حذف کند
    if (comment.user.toString() !== req.user.id && post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '⛔ شما مجاز به حذف این کامنت نیستید'
      });
    }

    comment.deleteOne();
    await post.save();

    res.json({
      success: true,
      message: '🗑️ کامنت حذف شد'
    });

  } catch (error) {
    console.error('❌ خطا در حذف کامنت:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در حذف کامنت'
    });
  }
};

// ============================================================
// #️⃣ دریافت پست‌های یک هشتگ
// ============================================================
exports.getPostsByTag = async (req, res) => {
  try {
    const tag = '#' + req.params.tag.toLowerCase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const posts = await Post.find({ 
      tags: tag, 
      status: 'published' 
    })
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Post.countDocuments({ tags: tag, status: 'published' });

    res.json({
      success: true,
      count: posts.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      posts
    });

  } catch (error) {
    console.error('❌ خطا در جستجوی هشتگ:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در جستجو'
    });
  }
};
