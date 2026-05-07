// ============================================================
// controller/user-controller.js - کنترلر مدیریت کاربران
// دریافت پروفایل، جستجو، فالو/آنفالو
// ============================================================

const User = require('../model/user');

// ============================================================
// 👤 دریافت پروفایل خودم (نسخه کامل)
// GET /api/me
// ============================================================
exports.getMyProfile = async (req, res) => {
  try {
    // req.user توسط میدلور protect تنظیم شده
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ کاربر یافت نشد',
      });
    }

    res.json({
      success: true,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('❌ خطا در دریافت پروفایل:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور',
    });
  }
};

// ============================================================
// 🔍 دریافت پروفایل عمومی یک کاربر
// GET /api/users/:username
// ============================================================
exports.getUserProfile = async (req, res) => {
  try {
    // findOne یک کاربر با username مشخص را پیدا می‌کند
    const user = await User.findOne({ username: req.params.username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ کاربر یافت نشد',
      });
    }

    res.json({
      success: true,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('❌ خطا در دریافت پروفایل:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور',
    });
  }
};

// ============================================================
// ✏️ ویرایش پروفایل خودم
// PUT /api/me
// ============================================================
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, bio, website, username } = req.body;

    const user = await User.findById(req.user.id);

    // اگر نام کاربری تغییر کرده، یکتا بودنش را بررسی کن
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '❌ این نام کاربری قبلاً استفاده شده است',
        });
      }
    }

    // به‌روزرسانی فیلدها (اگر مقدار جدید ارسال شده باشد)
    if (fullName !== undefined) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (website !== undefined) user.website = website;
    if (username !== undefined) user.username = username;

    await user.save();

    res.json({
      success: true,
      message: '✅ پروفایل با موفقیت به‌روزرسانی شد',
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('❌ خطا در ویرایش پروفایل:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join('، '),
      });
    }

    res.status(500).json({
      success: false,
      message: '❌ خطای سرور',
    });
  }
};

// ============================================================
// 🔎 جستجوی کاربران
// GET /api/search?query=something
// ============================================================
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    // حداقل ۲ کاراکتر برای جستجو
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: '❌ حداقل ۲ کاراکتر برای جستجو وارد کنید',
      });
    }

    // جستجو در username و fullName
    // $regex یعنی الگوی عبارت منظم
    // $options: 'i' یعنی case-insensitive (حساس به حروف بزرگ/کوچک نباشد)
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { fullName: { $regex: query, $options: 'i' } },
      ],
    })
      .select('username fullName profilePicture') // فقط این فیلدها
      .limit(20); // حداکثر ۲۰ نتیجه

    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('❌ خطا در جستجو:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور',
    });
  }
};

// ============================================================
// 👥 فالو / آنفالو کاربر
// PUT /api/users/:id/follow
// ============================================================
exports.toggleFollow = async (req, res) => {
  try {
    // نمی‌توان خود را فالو کرد
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '❌ نمی‌توانید خودتان را فالو کنید',
      });
    }

    // یافتن هر دو کاربر
    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);

    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: '❌ کاربر مورد نظر یافت نشد',
      });
    }

    // بررسی وضعیت فالو
    // includes() چک می‌کند آیا یک مقدار در آرایه هست یا نه
    const isFollowing = currentUser.following.includes(req.params.id);

    if (isFollowing) {
      // ========== آنفالو ==========
      // filter() آرایه را فیلتر می‌کند و فقط عناصری که شرط دارند نگه می‌دارد
      currentUser.following = currentUser.following.filter(
        (id) => id.toString() !== req.params.id
      );
      userToFollow.followers = userToFollow.followers.filter(
        (id) => id.toString() !== req.user.id
      );
    } else {
      // ========== فالو ==========
      // push() یک عنصر به انتهای آرایه اضافه می‌کند
      currentUser.following.push(req.params.id);
      userToFollow.followers.push(req.user.id);
    }

    // ذخیره هر دو کاربر
    await currentUser.save();
    await userToFollow.save();

    res.json({
      success: true,
      isFollowing: !isFollowing, // وضعیت جدید
      followersCount: userToFollow.followers.length,
      followingCount: currentUser.following.length,
    });
  } catch (error) {
    console.error('❌ خطا در فالو:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور',
    });
  }
};

// ============================================================
// 📋 دریافت فالوورهای یک کاربر
// GET /api/users/:id/followers
// ============================================================
exports.getFollowers = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      'followers',
      'username fullName profilePicture'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ کاربر یافت نشد',
      });
    }

    res.json({
      success: true,
      count: user.followers.length,
      followers: user.followers,
    });
  } catch (error) {
    console.error('❌ خطا:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور',
    });
  }
};

// ============================================================
// 📋 دریافت فالوینگ‌های یک کاربر
// GET /api/users/:id/following
// ============================================================
exports.getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      'following',
      'username fullName profilePicture'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ کاربر یافت نشد',
      });
    }

    res.json({
      success: true,
      count: user.following.length,
      following: user.following,
    });
  } catch (error) {
    console.error('❌ خطا:', error);
    res.status(500).json({
      success: false,
      message: '❌ خطای سرور',
    });
  }
};
