# Admin Dashboard Enhancements - Stage 2

## 1. Product Management Improvements
- [x] Add "Quantity Available" field to products.
- [x] Add "Price Before Discount" (Old Price) field.
- [x] Implement Multi-image upload with Drag & Drop (Base64 storage).
- [x] Update Product Detail page with Thumbnail Gallery.
- [x] Display discounted price logic (Strikethrough old price).

## 2. Abandoned Cart Recovery
- [x] Implement tracking for incomplete orders in `localStorage`.
- [x] Add "Abandoned Carts" section to Admin Dashboard.
- [x] Create settings field for WhatsApp reminder template.
- [x] Implement WhatsApp reminder button with dynamic placeholders ({name}, {total}).

## 3. Discounts & Offers System
- [x] Create "Discounts" page in Admin Dashboard.
- [x] Implement Coupon Codes management (Add/Delete/Expiry).
- [x] Implement Special Offers (Free Shipping threshold, Global Discount %).
- [ ] Implement coupon validation and application in `cart.html`/`checkout.html`.

## 4. Advanced Statistics & Reports
- [x] Add Date Range picker (Start/End) for reports.
- [x] Implement "Comparison Mode" (Compare current period vs previous).
- [x] Update charts (Chart.js) to reflect filtered/comparison data.

## 5. Staff & Permissions
- [x] Create "Staff" management page.
- [x] Add/Delete employee accounts with specific permissions.
- [ ] Implement permission-based access control (hiding menu items based on staff role).

## 6. Data Export
- [x] Implement "Export Customers to Excel" using XLSX library.
