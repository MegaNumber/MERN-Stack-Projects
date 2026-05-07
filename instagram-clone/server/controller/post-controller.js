// ============================================================
// controller/post-controller.js - کنترلر مدیریت پست‌ها
// ایجاد، ویرایش، حذف، لایک و کامنت پست‌ها
// ============================================================

const Post = require('../model/post');
const User = require('../model/user');
const cloudinary = require('cloudinary');
const fs = require('fs').promises;

// ============================================================
// 📝 ایجاد پست جدید (با آپلود تصویر)
// POST /api/posts
// ============================================================
exports.createPost = async (req, res) => {
  try {
    // ۱. بررسی وجود فایل تصویر
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '❌ لطفاً یک تصویر برای پست انتخاب کنید',
      });
    }

    console.log(`📝 ایجاد پست با تصویر: ${req.file.originalname}`);

    // ۲. آپلود تصویر به Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'instagram-clone/posts',
      transformation: [
        { width: 1080, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    });

    // ۳. حذف فایل موقت
    await fs.unlink(req.file.path);

    // ۴. ساخت پست جدید در دیتابیس
    const newPost = new Post({
      user: req.user.id, // از میدلور protect می‌آید
      caption: req.body.caption || '',
      location: req.body.location || '',
      image: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
      },
    });

    // ۵. ذخیره پست
    await newPost.save();

    // ۶. افزایش شمارنده پست‌های کاربر
    // $inc یعنی increase - یکی به postsCount اضافه کن
    await User.findByIdAndUpdate(req.user.id, { $inc: { postsCount: 1 } });

    // ۷. populate برای برگرداندن اطلاعات کامل کاربر همراه پست
    // populate مثل JOIN در SQL است - اطلاعات کاربر را هم ضمیمه می‌کند
    const populatedPost = await Post.findById(newPost._id).populate(
      'user',
      'username fullName profilePicture'
    );

    res.status(201).json({
      success: true,
      message: '🎉 پست با موفقیت منتشر شد',
      post: populatedPost,
    });
  } catch (error) {
    console.error('❌ خطا در ایجاد پست:', error);

    // پاکسازی فایل
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        /* ignore */
      }
    }

    res.status(500).json({
      success: false,
      message: '❌ خطا در ایجاد پست',
    });
  }
};

// ============================================================
// 📋 دریافت فید پست‌ها (با صفحه‌بندی)
// GET /api/posts?page=1&limit=10
// ============================================================
exports.getFeed = async (req, res) => {
  try {
    // ۱. دریافت پارامترهای صفحه‌بندی از query string
    const page = parseInt(req.query.page) || 1; // اگر page نبود، صفحه ۱
    const limit = parseInt(req.query.limit) || 10; // اگر limit نبود، ۱۰ تا
    const skip = (page - 1) * limit; // چند تا رد کنیم

    // ۲. دریافت پست‌ها از دیتابیس
    const posts = await Post.find({ status: 'published' })
      .populate('user', 'username fullName profilePicture') // اطلاعات کاربر
      .populate('comments.user', 'username profilePicture') // اطلاعات کامنت‌گذاران
      .sort({ createdAt: -1 }) // جدیدترین اول
      .skip(skip) // skip کردن برای صفحه‌بندی
      .limit(limit); // محدودیت تعداد

    // ۳. شمارش کل پست‌ها
    const total = await Post.countDocuments({ status: 'published' });

    // ۴. پاسخ با اطلاعات صفحه‌بندی
    res.json({
      success: true,
      count: posts.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit), // آیا صفحه بعدی هست؟
      posts,
    });
  } catch (error) {
    console.error('❌ خطا در دریافت پست‌ها:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در دریافت پست‌ها',
    });
  }
};

// ============================================================
// 🔍 دریافت یک پست خاص
// GET /api/posts/:id
// ============================================================
exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'username fullName profilePicture bio')
      .populate('comments.user', 'username profilePicture');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد',
      });
    }

    res.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error('❌ خطا در دریافت پست:', error);

    // اگر id فرمت نامعتبری داشته باشد
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد',
      });
    }

    res.status(500).json({
      success: false,
      message: '❌ خطای سرور',
    });
  }
};

// ============================================================
// ✏️ ویرایش کپشن پست
// PUT /api/posts/:id
// ============================================================
exports.updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد',
      });
    }

    // فقط مالک پست می‌تواند ویرایش کند
    // toString() برای مقایسه ObjectId ها لازم است
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '⛔ شما مجاز به ویرایش این پست نیستید',
      });
    }

    // به‌روزرسانی فیلدها
    if (req.body.caption !== undefined) {
      post.caption = req.body.caption;
    }
    if (req.body.location !== undefined) {
      post.location = req.body.location;
    }

    await post.save();

    res.json({
      success: true,
      message: '✅ پست با موفقیت ویرایش شد',
      post,
    });
  } catch (error) {
    console.error('❌ خطا در ویرایش پست:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در ویرایش پست',
    });
  }
};

// ============================================================
// 🗑️ حذف پست
// DELETE /api/posts/:id
// ============================================================
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد',
      });
    }

    // فقط مالک می‌تواند حذف کند
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '⛔ شما مجاز به حذف این پست نیستید',
      });
    }

    // ۱. حذف تصویر از Cloudinary
    console.log(`🗑️ حذف تصویر: ${post.image.publicId}`);
    await cloudinary.uploader.destroy(post.image.publicId);

    // ۲. حذف پست از دیتابیس
    await Post.findByIdAndDelete(req.params.id);

    // ۳. کاهش شمارنده پست‌های کاربر
    await User.findByIdAndUpdate(req.user.id, { $inc: { postsCount: -1 } });

    res.json({
      success: true,
      message: '🗑️ پست با موفقیت حذف شد',
    });
  } catch (error) {
    console.error('❌ خطا در حذف پست:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در حذف پست',
    });
  }
};

// ============================================================
// ❤️ لایک / آنلایک پست
// PUT /api/posts/:id/like
// ============================================================
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد',
      });
    }

    const userId = req.user.id;

    // indexOf موقعیت userId در آرایه likes را برمی‌گرداند
    // اگر نباشد، -1 برمی‌گردد
    const likeIndex = post.likes.indexOf(userId);

    if (likeIndex === -1) {
      // کاربر لایک نکرده → لایک کن
      post.likes.push(userId);
    } else {
      // کاربر قبلاً لایک کرده → آنلایک کن
      // splice(index, 1) یعنی از index یک عنصر حذف کن
      post.likes.splice(likeIndex, 1);
    }

    await post.save();

    res.json({
      success: true,
      isLiked: likeIndex === -1, // true اگر تازه لایک شده
      likesCount: post.likes.length,
    });
  } catch (error) {
    console.error('❌ خطا در لایک:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در ثبت لایک',
    });
  }
};

// ============================================================
// 💬 افزودن کامنت
// POST /api/posts/:id/comments
// ============================================================
exports.addComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد',
      });
    }

    const { text } = req.body;

    // بررسی خالی نبودن متن
    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '❌ متن کامنت نمی‌تواند خالی باشد',
      });
    }

    // اضافه کردن کامنت به آرایه comments
    post.comments.push({
      user: req.user.id,
      text: text.trim(),
    });

    await post.save();

    // دریافت پست با اطلاعات کامنت جدید
    const updatedPost = await Post.findById(post._id).populate(
      'comments.user',
      'username profilePicture'
    );

    // آخرین کامنت (همان که الان اضافه شد)
    const newComment = updatedPost.comments[updatedPost.comments.length - 1];

    res.status(201).json({
      success: true,
      message: '💬 کامنت با موفقیت اضافه شد',
      comment: newComment,
    });
  } catch (error) {
    console.error('❌ خطا در افزودن کامنت:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در افزودن کامنت',
    });
  }
};

// ============================================================
// 🗑️ حذف کامنت
// DELETE /api/posts/:id/comments/:commentId
// ============================================================
exports.deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '❌ پست یافت نشد',
      });
    }

    // پیدا کردن کامنت در آرایه
    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: '❌ کامنت یافت نشد',
      });
    }

    // فقط مالک کامنت یا مالک پست می‌تواند کامنت را حذف کند
    if (
      comment.user.toString() !== req.user.id &&
      post.user.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: '⛔ شما مجاز به حذف این کامنت نیستید',
      });
    }

    // حذف کامنت
    comment.deleteOne();
    await post.save();

    res.json({
      success: true,
      message: '🗑️ کامنت حذف شد',
    });
  } catch (error) {
    console.error('❌ خطا در حذف کامنت:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در حذف کامنت',
    });
  }
};

// ============================================================
// #️⃣ دریافت پست‌های یک هشتگ
// GET /api/tags/:tag
// ============================================================
exports.getPostsByTag = async (req, res) => {
  try {
    // اضافه کردن # به ابتدای تگ
    const tag = '#' + req.params.tag.toLowerCase();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const posts = await Post.find({
      tags: tag,
      status: 'published',
    })
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Post.countDocuments({
      tags: tag,
      status: 'published',
    });

    res.json({
      success: true,
      count: posts.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      posts,
    });
  } catch (error) {
    console.error('❌ خطا در جستجوی هشتگ:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطا در جستجو',
    });
  }
};
