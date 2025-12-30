# 📧 دليل إعداد خدمة الإيميلات (SMTP.js)

## لماذا SMTP.js بدلاً من EmailJS؟

| الميزة | EmailJS | SMTP.js |
|--------|---------|---------|
| الرسائل المجانية | 200/شهر ❌ | **غير محدود** ✅ |
| سهولة الإعداد | متوسط | سهل جداً |
| التكلفة | مجاني محدود | **مجاني تماماً** |
| الموثوقية | جيد | ممتاز |

---

## 🚀 خطوات الإعداد (5 دقائق)

### الخطوة 1: إنشاء حساب SMTP.js

1. اذهب إلى: [https://smtpjs.com](https://smtpjs.com)
2. اضغط على **"Get Started"**
3. أدخل بياناتك:
   - **Email**: forto0224@gmail.com
   - **Password**: كلمة مرور قوية
4. اضغط **"Create Account"**

---

### الخطوة 2: الحصول على Secure Token

1. بعد تسجيل الدخول، اذهب لـ **"SMTP Settings"**
2. أدخل بيانات Gmail:
   ```
   SMTP Server: smtp.gmail.com
   Username: forto0224@gmail.com
   Password: [كلمة مرور التطبيق من Gmail]
   Port: 587
   ```
3. اضغط **"Generate Secure Token"**
4. **انسخ الـ Token** (مثل: `abc123xyz456...`)

---

### الخطوة 3: إعداد Gmail App Password

1. اذهب إلى: [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. فعّل **"2-Step Verification"** (إذا لم يكن مفعلاً)
3. اذهب إلى **"App passwords"**
4. اختر:
   - App: **Mail**
   - Device: **Other** (اكتب: Forto Store)
5. اضغط **"Generate"**
6. **انسخ كلمة المرور** (16 حرف)

---

### الخطوة 4: تحديث الكود

#### في `checkout.html`:

**استبدل:**
```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
<script>
    emailjs.init({ publicKey: "ouUg5HTMV2zUgiGMo" });
</script>
```

**بـ:**
```html
<script src="https://smtpjs.com/v3/smtp.js"></script>
<script src="js/email-service.js"></script>
```

#### في `login.html`:

**نفس التحديث أعلاه**

---

### الخطوة 5: إضافة Secure Token

#### في `js/email-service.js`:

**استبدل:**
```javascript
return settings.smtpSecureToken || 'YOUR_SMTP_SECURE_TOKEN';
```

**بـ:**
```javascript
return settings.smtpSecureToken || 'الصق_التوكن_هنا';
```

**أو** احفظه في إعدادات الموقع من لوحة الأدمن.

---

## 📝 كيفية الاستخدام

### 1. إرسال إشعار طلب جديد

```javascript
// في checkout.html عند إتمام الطلب
await emailService.sendOrderNotification(order);
```

### 2. إرسال كود استعادة كلمة المرور

```javascript
// في login.html عند طلب استعادة كلمة المرور
await emailService.sendPasswordResetOTP(email, name, otpCode);
```

---

## 🔧 الإعدادات المتقدمة (اختياري)

### حفظ Token في إعدادات الموقع:

1. اذهب لـ **Admin Dashboard**
2. **Settings** → **Email Settings**
3. أضف حقل جديد: `smtpSecureToken`
4. الصق الـ Token
5. احفظ

---

## ✅ الاختبار

### اختبار إرسال الإيميل:

```javascript
// افتح Console في المتصفح
await emailService.sendEmail({
    to: 'forto0224@gmail.com',
    subject: 'اختبار',
    body: '<h1>مرحباً من متجر فورتو!</h1>'
});
```

**النتيجة المتوقعة:**
```
✅ Email sent successfully
```

---

## 🎯 المميزات

### 1. غير محدود
- ✅ لا يوجد حد للرسائل
- ✅ مجاني تماماً
- ✅ بدون اشتراكات

### 2. سهل الاستخدام
```javascript
// بسيط جداً!
await emailService.sendOrderNotification(order);
```

### 3. قوالب جاهزة
- ✅ تصميم احترافي
- ✅ متجاوب مع الموبايل
- ✅ بالعربي

---

## 🔒 الأمان

### نصائح مهمة:

1. ✅ **لا تشارك** الـ Secure Token
2. ✅ **احفظه** في إعدادات الموقع
3. ✅ **استخدم** App Password من Gmail
4. ✅ **فعّل** 2-Step Verification

---

## 🐛 حل المشاكل

### المشكلة: "Invalid Token"
**الحل:**
- تأكد من نسخ الـ Token كاملاً
- جرب إنشاء Token جديد

### المشكلة: "Authentication Failed"
**الحل:**
- تأكد من App Password صحيح
- تأكد من تفعيل 2-Step Verification

### المشكلة: "Email not sent"
**الحل:**
- تحقق من الاتصال بالإنترنت
- تحقق من Console للأخطاء
- جرب إرسال إيميل اختباري

---

## 📊 المقارنة النهائية

### EmailJS:
```
❌ 200 إيميل/شهر فقط
❌ محدود جداً
❌ غير مناسب للمتاجر
```

### SMTP.js:
```
✅ غير محدود
✅ مجاني تماماً
✅ مثالي للمتاجر
✅ سريع وموثوق
```

---

## 🎉 النتيجة

بعد التنفيذ:
- ✅ إيميلات غير محدودة
- ✅ إشعارات فورية للطلبات
- ✅ استعادة كلمة المرور تعمل
- ✅ بدون تكاليف إضافية

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. تحقق من Console للأخطاء
2. راجع الخطوات أعلاه
3. تأكد من صحة الـ Token

---

**✨ جاهز للاستخدام!**
