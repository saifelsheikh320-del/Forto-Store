# 🚀 أوامر Git للنشر

## خطوة واحدة - انسخ والصق

```bash
git add .
git commit -m "✨ Add clean URLs support for better SEO and UX"
git push origin main
```

---

## أو خطوة بخطوة

### 1. إضافة جميع الملفات
```bash
git add .
```

### 2. حفظ التغييرات
```bash
git commit -m "✨ Add clean URLs support for better SEO and UX"
```

### 3. رفع للسيرفر
```bash
git push origin main
```

---

## رسائل Commit بديلة

يمكنك استخدام أي من هذه الرسائل:

```bash
git commit -m "✨ إضافة الروابط النظيفة لتحسين SEO"
```

```bash
git commit -m "🔗 Update all links to clean URLs (remove .html)"
```

```bash
git commit -m "♻️ Refactor: Implement clean URLs for better UX"
```

```bash
git commit -m "🎨 Improve URL structure - remove .html extensions"
```

---

## التحقق من الحالة

### قبل الرفع:
```bash
git status
```

### بعد الرفع:
```bash
git log --oneline -1
```

---

## إنشاء نسخة احتياطية (اختياري)

### قبل الرفع:
```bash
git tag -a v1.0-clean-urls -m "Clean URLs implementation"
git push origin v1.0-clean-urls
```

---

## في حالة وجود مشاكل

### إلغاء التغييرات (قبل الرفع):
```bash
git reset --hard HEAD
```

### الرجوع لآخر commit:
```bash
git reset --hard HEAD~1
```

### استعادة ملف معين:
```bash
git checkout HEAD -- filename.html
```

---

## الأوامر الكاملة مع التحقق

```bash
# 1. التحقق من الحالة
git status

# 2. إضافة الملفات
git add .

# 3. التحقق مرة أخرى
git status

# 4. حفظ التغييرات
git commit -m "✨ Add clean URLs support"

# 5. رفع للسيرفر
git push origin main

# 6. التحقق من النجاح
git log --oneline -1
```

---

## بعد الرفع

### انتظر 2-5 دقائق ثم:

1. اذهب لإعدادات المستودع
2. اختر Pages
3. تأكد من التفعيل
4. انسخ رابط الموقع
5. جرب الروابط الجديدة!

---

## اختبار سريع

```bash
# افتح المتصفح وجرب:
https://username.github.io/repository/products
https://username.github.io/repository/cart
https://username.github.io/repository/product?id=123
```

---

**✅ جاهز للنشر!**
