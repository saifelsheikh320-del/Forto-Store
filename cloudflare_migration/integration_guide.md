# دليل الانتقال إلى Cloudflare Hybrid Architecture

لقد تم تجهيز الملفات اللازمة لنقل نظام المنتجات إلى معمارية Hybrid (D1 + KV) عالية الأداء.

## 1. الملفات الجديدة
- `cloudflare_migration/worker.js`: كود الـ Worker الذي يدير العمليات (Write D1 -> Read KV).
- `cloudflare_migration/schema.sql`: تصميم قاعدة البيانات (SQL).
- `js/cloud-products.js`: كود الربط (Adapter) للموقع.

## 2. خطوات التشغيل (Deploy)

### الخطوة 1: إعداد Cloudflare
1. أنشئ D1 Database جديدة باسم `forto-products`.
2. أنشئ KV Namespace جديد باسم `PRODUCTS_KV`.
3. طبق الـ SQL Schema:
   ```bash
   npx wrangler d1 execute forto-products --file=./cloudflare_migration/schema.sql --remote
   ```

### الخطوة 2: رفع الـ Worker
عدل ملف `wrangler.toml` (إذا لم يكن موجوداً أنشئه) لربط الـ D1 والـ KV بالـ Worker، ثم:
```bash
npx wrangler deploy ./cloudflare_migration/worker.js
```
*تأكد من وضع `ADMIN_API_KEY` في إعدادات الـ Worker (Environment Variables).*

### الخطوة 3: ربط الموقع (Integration)
قم بفتح ملف `js/data.js` وقم بالتعديلات التالية "بحذر" لعدم كسر النظام:

#### أ) استدعاء السكربت الجديد
في ملفات `index.html`, `products.html`, `admin/dashboard.html`، أضف السكربت الجديد **قبل** `data.js`:
```html
<script src="js/cloud-products.js"></script>
<script src="js/data.js"></script>
```

#### ب) تحديث `js/cloud-products.js`
افتح الملف وعدّل الرابط:
```javascript
const CF_WORKER_URL = "https://اسم-الوركر-الخاص-بك.workers.dev";
const CF_API_KEY = "المفتاح-السري-الذي-وضعته";
```

#### ج) تعديل `js/data.js` (Overriding Methods)
لا تحذف الكود القديم! فقط قم بتوجيه الدوال الخاصة بالمنتجات لاستخدام الكود الجديد.
ابحث عن كلاس `StoreDB`، وفي دالة `init` أو بعدها أضف:

```javascript
// --- CLOUDFLARE OVERRIDES ---
// وضع هذا الكود في نهاية ملف data.js بعد تعريف db

// 1. Override Save
const originalSave = db.saveProduct.bind(db);
db.saveProduct = async function(product) {
    if (typeof CloudProducts !== 'undefined') {
        await CloudProducts.save(product); // Save to Cloudflare
    }
    originalSave(product); // Save locally as backup & UI update
};

// 2. Override Delete
const originalDelete = db.deleteProduct.bind(db);
db.deleteProduct = async function(id) {
    if (typeof CloudProducts !== 'undefined') {
        await CloudProducts.delete(id);
    }
    originalDelete(id);
};

// 3. Override Archive
const originalArchive = db.archiveProduct.bind(db);
db.archiveProduct = async function(id) {
    // We handle archive as a simple update with archived: true
    let p = this.getProduct(id);
    if(p) {
        p.archived = true;
        if (typeof CloudProducts !== 'undefined') {
            await CloudProducts.save(p);
        }
    }
    originalArchive(id);
}
```

## ملخص الأمان
- **الزوار**: يقرأون `ALL_PRODUCTS` من `KV` مباشرة (سريع جداً، 0 load على الـ Database).
- **الأدمن**: يكتب على `D1` (آمن، ACID transactions)، ثم الـ Worker يحدث الـ `KV` تلقائياً.
- **الطلبات**: لا تزال كما هي في `js/data.js` (localStorage/Supabase) ولم يتم المساس بها.
