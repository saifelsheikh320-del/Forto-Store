/**
 * Data Layer Simulation (Local Storage)
 */

const INITIAL_PRODUCTS = [];

class StoreDB {
    constructor() {
        this.init();
        this.syncWithFirebase();
    }

    init() {
        if (!localStorage.getItem('products')) {
            localStorage.setItem('products', JSON.stringify(INITIAL_PRODUCTS));
        }
        if (!localStorage.getItem('orders')) {
            localStorage.setItem('orders', JSON.stringify([]));
        }
        if (!localStorage.getItem('cart')) {
            localStorage.setItem('cart', JSON.stringify([]));
        }
        if (!localStorage.getItem('customers')) {
            localStorage.setItem('customers', JSON.stringify([]));
        }
    }

    // New method to sync data Real-time
    syncWithFirebase() {
        if (typeof firebase === 'undefined') {
            console.warn('Firebase is not loaded yet.');
            return;
        }

        const collections = ['products', 'orders', 'abandoned_carts', 'site_settings', 'coupons', 'staff', 'shipping_rates', 'pending_reviews', 'customers'];

        collections.forEach(collection => {
            database.ref(collection).on('value', (snapshot) => {
                const data = snapshot.val();

                // Handle Empty Data (Null) - e.g. when all products are deleted
                if (!data) {
                    const emptyValue = collection === 'site_settings' ? {} : [];
                    localStorage.setItem(collection, JSON.stringify(emptyValue));

                    if (collection === 'products') window.dispatchEvent(new Event('productsUpdated'));
                    if (collection === 'site_settings') window.dispatchEvent(new Event('settingsUpdated'));
                    if (collection === 'orders') window.dispatchEvent(new Event('ordersUpdated'));
                    return;
                }

                if (data) {
                    // Firebase object to Array if necessary (EXCEPT site_settings)
                    let formattedData = data;
                    if (collection !== 'site_settings' && !Array.isArray(data)) {
                        formattedData = Object.keys(data).map(key => ({
                            ...data[key],
                            firebaseId: key // optional: store the key if needed
                        }));
                    }

                    localStorage.setItem(collection, JSON.stringify(formattedData));

                    // Trigger events for UI updates
                    if (collection === 'products') window.dispatchEvent(new Event('productsUpdated'));
                    if (collection === 'site_settings') window.dispatchEvent(new Event('settingsUpdated'));
                    if (collection === 'orders') window.dispatchEvent(new Event('ordersUpdated'));
                }
            }, (error) => {
                console.error(`Sync error for ${collection}:`, error);
                // Alert only once to avoid spamming
                if (collection === 'products') {
                    if (typeof showAlert !== 'undefined') {
                        showAlert(`تنبيه: فشل الاتصال بقاعدة البيانات لقراءة المنتجات.\nالسبب: ${error.message}\nتأكد من إعدادات القواعد (Rules) في Firebase.`, 'error');
                    } else {
                        alert(`تنبيه: فشل الاتصال بقاعدة البيانات لقراءة المنتجات.\nالسبب: ${error.message}\nتأكد من إعدادات القواعد (Rules) في Firebase.`);
                    }
                }
            });
        });
    }


    async updateCloud(collection) {
        if (typeof firebase !== 'undefined') {
            const data = JSON.parse(localStorage.getItem(collection));
            try {
                await database.ref(collection).set(data);
                console.log(`Successfully synced ${collection} to Firebase.`);
                return true;
            } catch (error) {
                console.error(`Sync error for ${collection}:`, error);
                const msg = `خطأ في المزامنة: ${error.message}\nتأكد من إعدادات قواعد البيانات (Rules) في Firebase Console وتغييرها لـ true.`;
                if (typeof showAlert !== 'undefined') showAlert(msg, 'error');
                else alert(msg);
                throw error;
            }
        }
        return false;
    }

    // --- REAL ANALYTICS TRACKING ---
    trackVisit() {
        if (typeof firebase === 'undefined') return;

        // 1. Total Visits Counter
        database.ref('analytics/total_visits').transaction((current) => {
            return (current || 0) + 1;
        });

        // 2. Daily Visits
        const today = new Date().toISOString().split('T')[0];
        database.ref(`analytics/daily_visits/${today}`).transaction((current) => {
            return (current || 0) + 1;
        });

        // 3. Live Presence & Traffic Sources
        const urlParams = new URLSearchParams(window.location.search);
        const source = urlParams.get('utm_source') || (document.referrer ? new URL(document.referrer).hostname : 'Direct');

        const presenceRef = database.ref('analytics/presence').push();
        presenceRef.onDisconnect().remove();
        presenceRef.set({
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            url: window.location.href,
            source: source
        });

        // 4. Source Counters
        database.ref(`analytics/traffic_sources/${source.replace(/\./g, '_')}`).transaction((current) => {
            return (current || 0) + 1;
        });
    }

    async getAnalytics() {
        if (typeof firebase === 'undefined') return { total_visits: 0, live_users: 0 };
        const snapshot = await database.ref('analytics').once('value');
        const data = snapshot.val() || {};
        const presence = data.presence ? Object.keys(data.presence).length : 0;
        return {
            total_visits: data.total_visits || 0,
            live_users: presence || 1,
            daily_visits: data.daily_visits || {},
            traffic_sources: data.traffic_sources || {}
        };
    }

    getProducts() {
        try {
            return JSON.parse(localStorage.getItem('products')) || [];
        } catch (e) {
            return [];
        }
    }

    getProduct(id) {
        const products = this.getProducts();
        return products.find(p => p.id == id);
    }

    saveProduct(product, skipSync = false) {
        let products = this.getProducts();
        if (product.id) {
            // Check if it exists for update
            const index = products.findIndex(p => p.id == product.id);
            if (index !== -1) {
                products[index] = product;
            } else {
                // If ID is provided but not found, it's likely a new product from an import
                products.push(product);
            }
        } else {
            // Create New
            product.id = Date.now();
            products.push(product);
        }
        localStorage.setItem('products', JSON.stringify(products));
        if (!skipSync) {
            this.updateCloud('products');
        }
    }

    deleteProduct(id) {
        let products = this.getProducts();
        products = products.filter(p => p.id != id);
        localStorage.setItem('products', JSON.stringify(products));
        this.updateCloud('products');
    }

    archiveProduct(id) {
        let products = this.getProducts();
        const p = products.find(prod => prod.id == id);
        if (p) {
            p.archived = true;
            localStorage.setItem('products', JSON.stringify(products));
            this.updateCloud('products');
        }
    }

    unarchiveProduct(id) {
        let products = this.getProducts();
        const p = products.find(prod => prod.id == id);
        if (p) {
            p.archived = false;
            localStorage.setItem('products', JSON.stringify(products));
            this.updateCloud('products');
        }
    }

    async getOrderAsync(orderId) {
        if (!orderId) return null;
        const cleanId = orderId.toString().trim().replace('#', '');

        // 1. Try local first
        const orders = this.getOrders();
        const local = orders.find(o =>
            o.id === cleanId ||
            o.id === 'ORD-' + cleanId ||
            o.id.split('-').pop() === cleanId
        );
        if (local) return local;

        // 2. Try Firebase if available
        if (typeof database !== 'undefined') {
            try {
                // Search by full ID
                let snapshot = await database.ref('orders').orderByChild('id').equalTo(cleanId).once('value');
                if (!snapshot.exists() && !cleanId.startsWith('ORD-')) {
                    // Try with prefix
                    snapshot = await database.ref('orders').orderByChild('id').equalTo('ORD-' + cleanId).once('value');
                }

                if (snapshot.exists()) {
                    const data = snapshot.val();
                    // Firebase returns an object with keys since we used push()
                    const foundOrder = Object.values(data)[0];

                    // Cache it locally for future fast access
                    const currentOrders = this.getOrders();
                    if (!currentOrders.find(o => o.id === foundOrder.id)) {
                        currentOrders.unshift(foundOrder);
                        localStorage.setItem('orders', JSON.stringify(currentOrders));
                    }
                    return foundOrder;
                }
            } catch (err) {
                console.error('Firebase order lookup error:', err);
            }
        }
        return null;
    }

    getOrders() {
        try {
            return JSON.parse(localStorage.getItem('orders')) || [];
        } catch (e) {
            return [];
        }
    }

    async createOrder(order) {
        try {
            let orders = this.getOrders();
            if (!order.id) {
                order.id = 'ORD-' + Date.now();
            }
            order.date = new Date().toISOString();
            order.status = 'Pending';
            order.isRead = false;

            // 1. Save locally first (Always succeeds)
            orders.unshift(order);
            localStorage.setItem('orders', JSON.stringify(orders));

            // 2. Deduct quantities locally
            let products = this.getProducts();
            order.items.forEach(item => {
                const p = products.find(prod => prod.id == item.id);
                if (p && p.quantity) {
                    p.quantity = Math.max(0, p.quantity - item.quantity);
                }
            });
            localStorage.setItem('products', JSON.stringify(products));

            // 3. Clear cart/session
            const sessionId = localStorage.getItem('cart_session_id');
            if (sessionId) this.removeAbandonedCart(sessionId);
            this.clearCart();

            // 4. Cloud Sync - CRITICAL: Must await ORDER save for dashboard reliability.
            // OPTIMIZATION: We do NOT await 'products' sync (Inventory) as it's heavy and non-critical for the order itself.
            if (typeof firebase !== 'undefined') {
                try {
                    // Await Order Push (Fast & Critical)
                    await database.ref('orders').push(order);

                    // Background Inventory Sync (Heavy & Secondary)
                    // We don't await this to avoid blocking the user.
                    this.updateCloud('products').catch(e => console.warn("Background inventory sync:", e));
                } catch (syncErr) {
                    console.error('Cloud Sync failed but local save worked:', syncErr);
                }
            }

            return order;
        } catch (e) {
            console.error('CRITICAL: createOrder failed', e);
            throw e;
        }
    }

    // Abandoned Carts Logic
    saveAbandonedCart(cart, customerInfo = null) {
        if (!cart || cart.length === 0) return;
        let abandoned = this.getAbandonedCarts();
        let sessionId = localStorage.getItem('cart_session_id');
        if (!sessionId) {
            sessionId = 'S-' + Date.now();
            localStorage.setItem('cart_session_id', sessionId);
        }

        const existingIndex = abandoned.findIndex(a => a.sessionId === sessionId);
        const newEntry = {
            sessionId,
            date: new Date().toISOString(),
            cart,
            customer: customerInfo,
            id: existingIndex !== -1 ? abandoned[existingIndex].id : 'ABC-' + Date.now()
        };

        if (existingIndex !== -1) {
            abandoned[existingIndex] = newEntry;
        } else {
            abandoned.unshift(newEntry);
        }
        localStorage.setItem('abandoned_carts', JSON.stringify(abandoned));
        this.updateCloud('abandoned_carts');
    }

    getAbandonedCarts() {
        try {
            return JSON.parse(localStorage.getItem('abandoned_carts')) || [];
        } catch (e) {
            return [];
        }
    }

    removeAbandonedCart(sessionId) {
        let abandoned = this.getAbandonedCarts();
        abandoned = abandoned.filter(a => a.sessionId !== sessionId);
        localStorage.setItem('abandoned_carts', JSON.stringify(abandoned));
        this.updateCloud('abandoned_carts');
    }

    updateOrderStatus(orderId, status) {
        let orders = this.getOrders();
        const order = orders.find(o => o.id === orderId);
        if (order) {
            order.status = status;
            localStorage.setItem('orders', JSON.stringify(orders));
            this.updateCloud('orders');
        }
    }

    markOrderAsRead(orderId) {
        let orders = this.getOrders();
        const order = orders.find(o => o.id === orderId);
        if (order && !order.isRead) {
            order.isRead = true;
            localStorage.setItem('orders', JSON.stringify(orders));
            this.updateCloud('orders');
        }
    }

    deleteOrder(orderId) {
        let orders = this.getOrders();
        orders = orders.filter(o => o.id !== orderId);
        localStorage.setItem('orders', JSON.stringify(orders));
        this.updateCloud('orders');
        return true;
    }

    cancelOrder(orderId) {
        return this.deleteOrder(orderId);
    }

    getCart() {
        return JSON.parse(localStorage.getItem('cart'));
    }

    addToCart(product, selectedColor = null, selectedSize = null) {
        let cart = this.getCart();
        const existing = cart.find(item =>
            item.id == product.id &&
            item.selectedColor === selectedColor &&
            item.selectedSize === selectedSize
        );
        if (existing) {
            existing.quantity++;
        } else {
            cart.push({
                ...product,
                quantity: 1,
                selectedColor,
                selectedSize
            });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
    }

    removeFromCart(id) {
        let cart = this.getCart();
        cart = cart.filter(item => item.id != id);
        localStorage.setItem('cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
    }

    updateCartQuantity(id, qty) {
        let cart = this.getCart();
        const item = cart.find(i => i.id == id);
        if (item) {
            item.quantity = qty;
            if (item.quantity <= 0) {
                this.removeFromCart(id);
                return;
            }
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
    }

    clearCart() {
        localStorage.setItem('cart', JSON.stringify([]));
        window.dispatchEvent(new Event('cartUpdated'));
    }

    // Admin Auth
    loginAdmin(email, password) {
        // 1. Check Custom Super Admin Credentials
        const settings = this.getSettings();
        const masterEmail = settings.adminEmail || 'admin@fortostore.com';
        const masterPass = settings.adminPass || 'adminsaifelsheikh320@';

        if (email === masterEmail && password === masterPass) {
            const adminData = {
                name: 'Super Admin',
                email: masterEmail,
                role: 'admin',
                permissions: ['all']
            };
            localStorage.setItem('admin_token', JSON.stringify(adminData));
            return { success: true };
        }

        // 2. Check Staff
        const staff = this.getStaff();
        const member = staff.find(s => s.email === email && s.pass === password);
        if (member) {
            const adminData = {
                name: member.name,
                email: member.email,
                role: 'staff',
                permissions: member.permissions || [],
                pin: member.pin // Track pin for lock screen
            };
            localStorage.setItem('admin_token', JSON.stringify(adminData));
            return { success: true };
        }

        return { success: false, message: 'بيانات الدخول غير صحيحة' };
    }

    isAdminLoggedIn() {
        return !!localStorage.getItem('admin_token');
    }

    getLoggedAdmin() {
        const token = localStorage.getItem('admin_token');
        if (!token) return null;
        try {
            const parsed = JSON.parse(token);
            if (typeof parsed === 'object' && parsed !== null) return parsed;
            // Handle old boolean-like tokens
            return { name: 'Admin', email: 'admin@fortostore.com', role: 'admin', permissions: ['all'] };
        } catch (e) {
            return { name: 'Admin', email: 'admin@fortostore.com', role: 'admin', permissions: ['all'] };
        }
    }

    logoutAdmin() {
        localStorage.removeItem('admin_token');
    }

    // Customer Auth
    registerCustomer(name, email, password, phone) {
        let customers = JSON.parse(localStorage.getItem('customers') || '[]');

        // Check if email exists
        if (customers.find(c => c.email === email)) {
            return { success: false, message: 'البريد الإلكتروني مسجل مسبقاً' };
        }

        const customer = {
            id: Date.now(),
            name,
            email,
            password, // In real app, hash this!
            phone,
            createdAt: new Date().toISOString()
        };

        customers.push(customer);
        localStorage.setItem('customers', JSON.stringify(customers));
        this.updateCloud('customers');
        return { success: true, message: 'تم التسجيل بنجاح' };
    }

    loginCustomer(identifier, password) {
        let customers = JSON.parse(localStorage.getItem('customers') || '[]');
        const customer = customers.find(c => (c.email === identifier || c.phone === identifier) && c.password === password);

        if (customer) {
            localStorage.setItem('customer_token', JSON.stringify({
                id: customer.id,
                name: customer.name,
                email: customer.email
            }));
            return { success: true, customer };
        }
        return { success: false, message: 'بيانات الدخول غير صحيحة' };
    }

    isCustomerLoggedIn() {
        return !!localStorage.getItem('customer_token');
    }

    getCustomer() {
        return JSON.parse(localStorage.getItem('customer_token'));
    }

    logoutCustomer() {
        localStorage.removeItem('customer_token');
    }

    getCustomerOrders(email) {
        const orders = this.getOrders() || [];
        return orders.filter(o => o.customer.email === email);
    }

    deleteCustomer(email) {
        let customers = JSON.parse(localStorage.getItem('customers') || '[]');
        customers = customers.filter(c => c.email !== email);
        localStorage.setItem('customers', JSON.stringify(customers));
        this.updateCloud('customers');
        return true;
    }

    // Site Settings
    getSettings() {
        const defaultSettings = {
            heroTitleAr: "تحدى الجاذبية<br><span style='color: var(--color-blue);'>بأناقتك</span>",
            heroTitleEn: "Defy Gravity<br><span style='color: var(--color-blue);'>Define Style</span>",
            heroDescAr: "اكتشف أحدث تشكيلة من أزياء الشارع الفاخرة المصممة للطابع العصري. راحة بلا حدود.",
            heroDescEn: "Discover the latest collection of premium streetwear tailored for the modern aesthetic. Zero gravity comfort.",
            heroImage: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800",
            storeName: "Forto Store",
            featuredProductIds: [1, 2, 3],
            collections: [
                { id: 1, nameAr: "سنيكرز", nameEn: "Sneakers", image: "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=400", link: "products?category=Sneakers" },
                { id: 2, nameAr: "بووت", nameEn: "Boots", image: "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=400", link: "products?category=Boots" },
                { id: 3, nameAr: "كاجوال", nameEn: "Casual", image: "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=400", link: "products?category=Casual" }
            ],
            featuredTitleAr: "الأكثر رواجاً",
            featuredTitleEn: "Trending Now",
            whatsapp: "201125655690",
            offerTitle: "تخفيضات نهاية العام",
            offerDesc: "احصل على خصم يصل إلى 40% على منتجات مختارة.",
            offerBtn: "عرض العروض",
            offerEnabled: true,
            fbPixelId: "1378052297664386",
            reviewsEnabled: true,
            reviews: [
                { id: 1, name: "أحمد محمد", comment: "أحذية رائعة جداً وخامة منتزة، التوصيل كان سريع جداً.", rating: 5, date: "2026-01-01" },
                { id: 2, name: "سارة محمود", comment: "المقاس مضبوط تماماً والتغليف فخم جداً، تجربة ممتازة.", rating: 5, date: "2026-01-01" },
                { id: 3, name: "إسلام عادل", comment: "أفضل سنيكرز اشتريتها في الفترة الأخيرة، شكراً فورتو.", rating: 4, date: "2026-01-01" }
            ],
            // Security Settings
            adminEmail: 'admin@fortostore.com',
            adminPass: 'adminsaifelsheikh320@',
            appLockEnabled: false,
            adminPin: '0000'
        };
        const saved = JSON.parse(localStorage.getItem('site_settings'));
        if (!saved) return defaultSettings;
        return { ...defaultSettings, ...saved };
    }

    saveSettings(settings) {
        localStorage.setItem('site_settings', JSON.stringify(settings));
        this.updateCloud('site_settings');
        window.dispatchEvent(new Event('settingsUpdated'));
    }

    // Coupons Logic
    getCoupons() {
        return JSON.parse(localStorage.getItem('coupons') || '[]');
    }

    saveCoupon(coupon) {
        let coupons = this.getCoupons();
        const existingIndex = coupons.findIndex(c => c.code.toUpperCase() === coupon.code.toUpperCase());
        if (existingIndex !== -1) {
            coupons[existingIndex] = coupon;
        } else {
            coupons.push(coupon);
        }
        localStorage.setItem('coupons', JSON.stringify(coupons));
        this.updateCloud('coupons');
    }

    deleteCoupon(code) {
        let coupons = this.getCoupons();
        coupons = coupons.filter(c => c.code.toUpperCase() !== code.toUpperCase());
        localStorage.setItem('coupons', JSON.stringify(coupons));
        this.updateCloud('coupons');
    }

    validateCoupon(code) {
        const coupons = this.getCoupons();
        const coupon = coupons.find(c => c.code.toUpperCase() === code.toUpperCase());
        if (!coupon) return { valid: false, message: 'كود خصم غير صحيح' };

        const now = new Date();
        if (coupon.expiry && new Date(coupon.expiry) < now) {
            return { valid: false, message: 'كود الخصم منتهي الصلاحية' };
        }

        return { valid: true, coupon };
    }

    // Special Offers Logic
    getSpecialOffers() {
        const defaultOffers = {
            freeShippingThreshold: null, // null means disabled
            globalDiscountPercentage: 0,
            globalDiscountEnabled: false,
            globalDiscountText: ''
        };
        return JSON.parse(localStorage.getItem('special_offers')) || defaultOffers;
    }

    saveSpecialOffers(offers) {
        localStorage.setItem('special_offers', JSON.stringify(offers));
        this.updateCloud('special_offers');
    }

    // Helper to calculate price with global discount
    getDiscountedPrice(price) {
        const offers = this.getSpecialOffers();
        if (offers && offers.globalDiscountEnabled && offers.globalDiscountPercentage > 0) {
            const discount = (price * offers.globalDiscountPercentage) / 100;
            return {
                original: price,
                final: Math.max(0, price - discount),
                percentage: offers.globalDiscountPercentage,
                text: offers.globalDiscountText || '',
                hasDiscount: true
            };
        }
        return {
            original: price,
            final: price,
            percentage: 0,
            hasDiscount: false
        };
    }

    // Staff Logic
    getStaff() {
        return JSON.parse(localStorage.getItem('staff') || '[]');
    }

    saveStaff(member) {
        let staff = this.getStaff();
        const existingIndex = staff.findIndex(s => s.email === member.email);
        if (existingIndex !== -1) {
            staff[existingIndex] = member;
        } else {
            staff.push({ ...member, id: 'STF-' + Date.now() });
        }
        localStorage.setItem('staff', JSON.stringify(staff));
        this.updateCloud('staff');
    }

    deleteStaff(id) {
        let staff = this.getStaff();
        staff = staff.filter(s => s.id !== id);
        localStorage.setItem('staff', JSON.stringify(staff));
        this.updateCloud('staff');
    }

    // Shipping Logic
    getShippingRates() {
        const defaultRates = [
            { id: 1, city: 'القاهرة', rate: 50 },
            { id: 2, city: 'الجيزة', rate: 50 },
            { id: 3, city: 'الإسكندرية', rate: 60 },
            { id: 4, city: 'المحافظات الأخرى', rate: 80 }
        ];
        return JSON.parse(localStorage.getItem('shipping_rates')) || defaultRates;
    }

    saveShippingRates(rates) {
        localStorage.setItem('shipping_rates', JSON.stringify(rates));
        this.updateCloud('shipping_rates');
    }

    // Database Maintenance
    clearAllProducts() {
        localStorage.setItem('products', JSON.stringify([]));
        this.updateCloud('products');
        window.dispatchEvent(new Event('productsUpdated'));
    }

    resetDatabase() {
        localStorage.clear();
        // Clear Firebase too if reset is called
        if (typeof firebase !== 'undefined') {
            database.ref().set({});
        }
        this.init();
        window.location.reload();
    }

    // User Reviews (Post-Purchase)
    saveUserReview(review) {
        let pending = JSON.parse(localStorage.getItem('pending_reviews') || '[]');
        review.id = Date.now();
        review.status = 'pending';
        review.date = new Date().toISOString().split('T')[0];
        pending.push(review);
        localStorage.setItem('pending_reviews', JSON.stringify(pending));
        this.updateCloud('pending_reviews');
    }

    getPendingReviews() {
        return JSON.parse(localStorage.getItem('pending_reviews') || '[]');
    }

    approveReview(id) {
        let pending = this.getPendingReviews();
        const review = pending.find(r => r.id == id);
        if (review) {
            // Add to approved reviews in settings
            const settings = this.getSettings();
            if (!settings.reviews) settings.reviews = [];
            settings.reviews.unshift({
                id: review.id,
                name: review.name,
                rating: review.rating,
                comment: review.comment,
                date: review.date
            });
            this.saveSettings(settings);

            // Remove from pending
            pending = pending.filter(r => r.id != id);
            localStorage.setItem('pending_reviews', JSON.stringify(pending));
            this.updateCloud('pending_reviews');
            return true;
        }
        return false;
    }

    deletePendingReview(id) {
        let pending = this.getPendingReviews();
        pending = pending.filter(r => r.id != id);
        localStorage.setItem('pending_reviews', JSON.stringify(pending));
        this.updateCloud('pending_reviews');
    }
}

const db = new StoreDB();

// ✅ Cloudflare Hook (Hybrid Mode)
if (typeof CloudProducts !== 'undefined') {

    // 1. Sync on Load
    CloudProducts.fetchAll().then(products => {
        if (products && products.length > 0) {
            console.log("⚡ Products synced from Cloudflare KV");
        }
    });

    // 2. Override Save
    const originalSave = db.saveProduct.bind(db);
    db.saveProduct = async function (product, skipRefresh = false) {
        await CloudProducts.save(product, skipRefresh).catch(e => console.error("Cloud Save Error:", e));
        originalSave(product, true); // Always skip Firebase sync for products when Cloudflare is active
    };

    // 3. Override Delete
    const originalDelete = db.deleteProduct.bind(db);
    db.deleteProduct = async function (id) {
        await CloudProducts.delete(id).catch(e => console.error("Cloud Delete Error:", e));
        originalDelete(id);
    };

    // 4. Override Clear All
    const originalClear = db.clearAllProducts.bind(db);
    db.clearAllProducts = async function () {
        await CloudProducts.clearAll().catch(e => console.error("Cloud Clear Error:", e));
        originalClear();
    };

    // 5. Override Archive
    const originalArchive = db.archiveProduct.bind(db);
    db.archiveProduct = async function (id) {
        let p = this.getProduct(id);
        if (p) {
            p.archived = true;
            await CloudProducts.save(p).catch(e => console.error("Cloud Archive Error:", e));
        }
        originalArchive(id);
    };

    // 6. Override Unarchive (Logic missing in initial plan, added for completeness)
    const originalUnarchive = db.unarchiveProduct.bind(db);
    db.unarchiveProduct = async function (id) {
        let p = this.getProduct(id);
        if (p) {
            p.archived = false;
            await CloudProducts.save(p).catch(e => console.error("Cloud Unarchive Error:", e));
        }
        originalUnarchive(id);
    };
}
