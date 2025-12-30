# 📧 تفعيل نظام إيميلات جوجل المجاني (15,000 إيميل/شهر)

بما أن الشركات تطلب "إيميل شركة"، سنستخدم هذا الحل العبقري لإرسال الإيميلات من حسابك الشخصي مجاناً.

---

## 1️⃣ إنشاء السيرفر (في دقيقتين)
1. افتح رابط: **[Google Apps Script](https://script.google.com/)**.
2. اضغط على زر **"+ New Project"**.
3. احذف الكود المكتوب وضع مكانه هذا الكود:

```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  try {
    MailApp.sendEmail({
      to: data.to,
      subject: data.subject,
      htmlBody: data.body
    });
    return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## 2️⃣ النشر (Deploy)
1. اضغط على الزر الأزرق الكبير **"Deploy"** ثم اختر **"New Deployment"**.
2. اضغط على علامة الترس (Select type) واختر **"Web App"**.
3. املأ البيانات:
   - **Description:** Forto Email
   - **Execute as:** Me (`forto0224@gmail.com`)
   - **Who has access:** **Anyone** (عشان موقعك يقدر يوصل له).
4. اضغط **Deploy**.
5. سيطلب منك **"Authorize Access"**، اضغط عليها واختار حسابك ووافق (Permissions).
6. سيظهر لك رابط في النهاية اسمه **"Web App URL"**.. **انسخه فوراً**.

---

## 3️⃣ الربط بالموقع
1. افتح ملف `js/email-service.js`.
2. في السطر **11**، ستجد:
   ```javascript
   this.googleAppUrl = 'YOUR_GOOGLE_SCRIPT_URL';
   ```
3. امسح `YOUR_GOOGLE_SCRIPT_URL` وضع الرابط اللي نسخته.

---

## 🎉 مبروك!
أنت الآن تملك نظام إرسال إيميلات:
- ✅ **15,000** رسالة شهرياً.
- ✅ من إيميلك الشخصي **Gmail**.
- ✅ **مجاني** للأبد.
- ✅ بدون الحاجة لإيميل شركة.
