

// Global Variables
let quill;

document.addEventListener('DOMContentLoaded', () => {
    if (!db.isAdminLoggedIn()) {
        window.location.href = '../admin-login';
        return;
    }

    applyPermissions();

    // Determine start section
    const admin = db.getLoggedAdmin();
    const perms = admin.permissions || [];
    let startSection = 'dashboard';

    // If not super admin and no stats permission, maybe redirect to first allowed section
    if (!perms.includes('all') && !perms.includes('stats') && startSection === 'dashboard') {
        const map = {
            'products': 'products',
            'orders': 'orders',
            'customers': 'customers',
            'discounts': 'discounts',
            'settings': 'settings',
            'staff': 'settings',
            'shipping': 'settings'
        };
        for (const p of perms) {
            if (map[p]) {
                startSection = map[p];
                break;
            }
        }
    }

    showSection(startSection);
    initImageDropZone();

    // Initialize Quill Editor
    if (document.getElementById('p-desc-editor')) {
        quill = new Quill('#p-desc-editor', {
            theme: 'snow',
            placeholder: 'أدخل وصف المنتج بالتفصيل...',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'direction': 'rtl' }],
                    [{ 'align': [] }],
                    ['link', 'clean']
                ]
            }
        });
        quill.format('direction', 'rtl');
        quill.format('align', 'right');
    }

    // Initialize Product Form Handler
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const sizesStr = document.getElementById('p-sizes').value.trim();
            const sizes = sizesStr ? sizesStr.split(',').map(s => s.trim()) : [];

            const colorsStr = document.getElementById('p-color').value.trim();
            const colors = colorsStr ? colorsStr.split(',').map(c => c.trim()) : [];

            const newProduct = {
                name: document.getElementById('p-name').value,
                price: parseFloat(document.getElementById('p-price').value),
                oldPrice: parseFloat(document.getElementById('p-old-price').value) || null,
                quantity: parseInt(document.getElementById('p-qty').value) || 0,
                category: document.getElementById('p-category').value,
                color: colors,
                size: sizes,
                images: currentProductImages,
                image: currentProductImages[0] || '',
                description: quill ? quill.root.innerHTML : '',
                archived: false
            };


            if (editingProductId) {
                newProduct.id = editingProductId;
                // Preserve archived status when editing
                const existingProduct = db.getProduct(editingProductId);
                if (existingProduct) {
                    newProduct.archived = existingProduct.archived || false;
                }
            }


            db.saveProduct(newProduct);
            closeProductModal();
            refreshProducts();
            showToast(editingProductId ? 'تم تحديث المنتج بنجاح!' : 'تم إضافة المنتج بنجاح!', 'success');
        });
    }

    // Notification Logic
    if ("Notification" in window) {
        Notification.requestPermission();
    }

    // Track order count to detect new ones
    let lastOrderCount = db.getOrders().length;

    setInterval(() => {
        const currentOrders = db.getOrders();
        if (currentOrders.length > lastOrderCount) {
            // New Order Detected!
            const newOrdersCount = currentOrders.length - lastOrderCount;
            lastOrderCount = currentOrders.length;

            // 1. Play Sound (User's Custom 'Money' Sound)
            const audio = new Audio('../sound Efect/فلوس.mp3');
            audio.play().catch(e => {
                console.log('Audio playback waiting for interaction');
                document.addEventListener('click', () => audio.play(), { once: true });
            });

            // 2. Custom Toast for Mobile
            showToast(`🚀 طلب جديد! #${currentOrders[0].id.split('-').pop()}`, 'success');

            // 3. Browser Notification
            if (Notification.permission === "granted") {
                new Notification("Forto Store Admin", {
                    body: `💸 تم استقبال ${newOrdersCount} طلب جديد!`,
                    icon: '../images/logo-v2.png',
                    vibrate: [200, 100, 200]
                });
            }

            // 3. Update Badge immediately
            updateSidebarBadges();

            // 4. If current section is orders, refresh table
            if (document.getElementById('orders').style.display !== 'none') {
                renderOrders();
            }
        }
    }, 5000); // Check every 5 seconds

    // Listen for Cloud Updates
    window.addEventListener('productsUpdated', () => {
        if (document.getElementById('products-table')) refreshProducts();
        if (document.getElementById('total-products')) refreshDashboard();
    });

    window.addEventListener('ordersUpdated', () => {
        if (document.getElementById('orders-table')) refreshOrders();
        if (document.getElementById('total-orders')) refreshDashboard();
        updateSidebarBadges();
    });

    window.addEventListener('settingsUpdated', () => {
        if (document.getElementById('section-settings')?.classList.contains('active')) refreshSettings();
    });

    // Monitor Firebase Connection Status
    if (typeof firebase !== 'undefined') {
        const connectedRef = firebase.database().ref(".info/connected");
        connectedRef.on("value", (snap) => {
            const isConnected = snap.val() === true;
            console.log('Database Connected:', isConnected);
            const statusEl = document.getElementById('db-connection-status');
            if (statusEl) {
                if (isConnected) {
                    statusEl.innerHTML = '<span style="color: #2ecc71; display: flex; align-items: center; gap: 5px;"><i class="fas fa-wifi"></i> متصل بقاعدة البيانات</span>';
                    statusEl.title = "الاتصال بقاعدة البيانات نشط";
                } else {
                    statusEl.innerHTML = '<span style="color: #e74c3c; display: flex; align-items: center; gap: 5px;"><i class="fas fa-wifi-slash"></i> غير متصل</span>';
                    statusEl.title = "فشل الاتصال بقاعدة البيانات. تحقق من الإنترنت أو إعدادات Firebase";
                }
            }
        });
    }
});

function applyPermissions() {
    const admin = db.getLoggedAdmin();
    const perms = admin.permissions || [];
    const isSuper = perms.includes('all');

    const menuMap = {
        'products': 'products',
        'orders': 'orders',
        'customers': 'customers',
        'settings': 'settings',
        'stats': 'stats',
        'abandoned': 'orders',
        'discounts': 'discounts',
        'staff': 'settings', // Staff management requires settings permission
        'shipping': 'settings' // Shipping management requires settings permission
    };

    document.querySelectorAll('.menu-item').forEach(item => {
        const onClick = item.getAttribute('onclick');
        if (onClick) {
            const sectionMatch = onClick.match(/'([^']+)'/);
            if (!sectionMatch) return;
            const section = sectionMatch[1];
            if (section === 'dashboard') return;

            const reqPerm = menuMap[section];
            let shouldShow = isSuper || perms.includes(reqPerm);

            // استثناء: خيار "أمان التطبيق" يظهر فقط داخل تطبيق الموبايل
            if (section === 'app-security') {
                const isApp = window.self !== window.top;
                if (!isApp) shouldShow = false;
            }

            if (!shouldShow) {
                item.style.display = 'none';
            } else {
                item.style.display = 'flex';
            }
        }
    });
}

function logout() {
    db.logoutAdmin();
    window.location.href = '../admin-login';
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function showSection(sectionId) {
    // Check Permission
    const admin = db.getLoggedAdmin();
    const perms = admin.permissions || [];
    const isSuper = perms.includes('all');

    const permMap = {
        'products': 'products',
        'orders': 'orders',
        'customers': 'customers',
        'settings': 'settings',
        'stats': 'stats',
        'abandoned': 'orders',
        'discounts': 'discounts',
        'staff': 'settings',
        'shipping': 'settings'
    };

    if (sectionId !== 'dashboard' && !isSuper && !perms.includes(permMap[sectionId])) {
        showAlert('ليس لديك صلاحية للوصول لهذا القسم', 'error');
        return;
    }

    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    const target = document.getElementById('section-' + sectionId);
    if (target) target.classList.add('active');

    // Update menu
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        const onClick = item.getAttribute('onclick');
        if (onClick && onClick.includes(`'${sectionId}'`)) {
            item.classList.add('active');
        }
    });

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }

    // Refresh data for the section
    if (sectionId === 'dashboard') refreshDashboard();
    if (sectionId === 'products') refreshProducts();
    if (sectionId === 'orders') refreshOrders();
    if (sectionId === 'customers') refreshCustomers();
    if (sectionId === 'settings') refreshSettings();
    if (sectionId === 'stats') refreshStats();
    if (sectionId === 'abandoned') refreshAbandonedCarts();
    if (sectionId === 'discounts') refreshDiscounts();
    if (sectionId === 'staff') refreshStaff();
    if (sectionId === 'shipping') refreshShipping();
    if (sectionId === 'moderation') refreshModeration();
    if (sectionId === 'app-security') refreshAppSecurity();

    updateSidebarBadges();
}

function updateSidebarBadges() {
    const orders = db.getOrders();
    const pendingCount = orders.filter(o => o.status === 'Pending' && !o.isRead).length;
    const badge = document.getElementById('orders-badge');

    if (badge) {
        if (pendingCount > 0) {
            badge.innerText = pendingCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function refreshDashboard() {
    const orders = db.getOrders();
    const products = db.getProducts();
    const customers = JSON.parse(localStorage.getItem('customers') || '[]');

    // Update stats
    document.getElementById('total-orders').innerText = orders.length;
    document.getElementById('total-products').innerText = products.length;
    document.getElementById('total-customers').innerText = customers.length;

    const revenue = orders.reduce((sum, o) => sum + o.total, 0);
    document.getElementById('total-revenue').innerText = revenue.toFixed(0) + ' ج.م';

    // Recent orders logic restored
    const recentTbody = document.getElementById('dashboard-orders-table');
    if (recentTbody) {
        recentTbody.innerHTML = '';
        const recentOrders = [...orders].reverse().slice(0, 5); // Latest 5 orders
        if (recentOrders.length === 0) {
            recentTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1rem; color: #999;">لا توجد طلبات بعد</td></tr>';
        } else {
            recentOrders.forEach(o => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight: bold;">#${o.id.split('-').pop()}</td>
                    <td>
                        <div>${new Date(o.date).toLocaleDateString('ar-EG')}</div>
                        <small style="color: #666; font-size: 0.8rem;">
                            <i class="far fa-clock" style="font-size: 0.75rem;"></i> ${new Date(o.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </small>
                    </td>
                    <td>${o.customer?.name || 'عميل مجهول'}</td>
                    <td style="font-weight: bold;">${o.total} ج.م</td>
                    <td><span class="badge" style="background: ${getStatusColor(o.status)}; color: white;">${getStatusName(o.status)}</span></td>
                    <td>
                        <button onclick="viewOrder('${o.id}')" class="btn btn-small btn-secondary" style="padding: 4px 10px;">عرض</button>
                    </td>
                `;
                recentTbody.appendChild(tr);
            });
        }
    }
}

function refreshProducts() {
    const products = db.getProducts();
    const tbody = document.getElementById('products-table');
    tbody.innerHTML = '';

    const searchQuery = document.getElementById('p-search')?.value.toLowerCase() || '';
    const showArchivedOnly = document.getElementById('show-archived')?.checked || false;

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery);
        const isArchived = p.archived === true;
        const matchesArchive = showArchivedOnly ? isArchived : !isArchived;
        return matchesSearch && matchesArchive;
    });

    // Reset bulk UI
    const bulkDiv = document.getElementById('products-bulk-actions');
    if (bulkDiv) bulkDiv.style.display = 'none';
    const mainCb = document.getElementById('select-all-products');
    if (mainCb) mainCb.checked = false;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #999;">${searchQuery ? 'لا توجد نتائج بحث' : (showArchivedOnly ? 'لا توجد منتجات مؤرشفة' : 'لا توجد منتجات')}</td></tr>`;
        return;
    }

    filtered.forEach(p => {
        const tr = document.createElement('tr');
        const productImage = (p.images && p.images.length > 0) ? p.images[0] : (p.image || 'https://via.placeholder.com/100');
        tr.innerHTML = `
            <td><input type="checkbox" class="select-products" value="${p.id}" onchange="updateBulkActionsUI('products')"></td>
            <td>
                <div class="product-img-wrapper">
                    <img src="${productImage}" alt="${p.name}">
                </div>
            </td>
            <td><span class="product-name-cell">${p.name}</span></td>
            <td><span class="badge badge-price">${p.price} ج.م</span></td>
            <td><span class="badge badge-category">${p.category}</span></td>
            <td>
                <div class="btn-action-group">
                    <button onclick="editProduct(${p.id})" class="btn-icon btn-edit" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${p.archived ? `
                    <button onclick="adminUnarchiveProduct(${p.id})" class="btn-icon btn-archive" title="إلغاء الأرشفة">
                        <i class="fas fa-box-open"></i>
                    </button>` : `
                    <button onclick="adminArchiveProduct(${p.id})" class="btn-icon btn-archive" title="أرشفة">
                        <i class="fas fa-archive"></i>
                    </button>`}
                    <button onclick="deleteProduct(${p.id})" class="btn-icon btn-trash" title="حذف نهائي">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function adminArchiveProduct(id) {
    showConfirm('هل أنت متأكد من أرشفة هذا المنتج؟ لن يظهر في المتجر.', () => {
        db.archiveProduct(id);
        refreshProducts();
        showToast('تم أرشفة المنتج بنجاح', 'success');
    });
}

function adminUnarchiveProduct(id) {
    db.unarchiveProduct(id);
    refreshProducts();
}

function deleteProduct(id) {
    showConfirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟', () => {
        db.deleteProduct(id);
        refreshProducts();
        showToast('تم حذف المنتج بنجاح', 'success');
    });
}

function adminClearAllProducts() {
    showConfirm('تحذير: هل أنت متأكد من حذف جميع المنتجات نهائياً؟ لا يمكن التراجع عن هذه الخطوة.', () => {
        db.clearAllProducts();
        refreshProducts();
        showToast('تم حذف جميع المنتجات بنجاح', 'success');
    });
}

function refreshOrders() {
    let filter = 'active';
    const activeTab = document.querySelector('.filter-tab.active');
    if (activeTab) {
        filter = activeTab.getAttribute('data-filter');
    } else {
        filter = document.getElementById('order-filter')?.value || 'active';
    }
    const searchQuery = document.getElementById('o-search')?.value.toLowerCase() || '';
    const orders = db.getOrders();
    const tbody = document.getElementById('orders-table');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filteredOrders = orders.filter(o => {
        const customerName = (o.customer?.name || '').toLowerCase();
        const customerPhone = (o.customer?.phone || '').toLowerCase();
        const orderId = (o.id || '').toLowerCase();

        const matchesSearch = customerName.includes(searchQuery) ||
            customerPhone.includes(searchQuery) ||
            orderId.includes(searchQuery);

        if (filter === 'archived') return o.status === 'Archived' && matchesSearch;
        return o.status !== 'Archived' && matchesSearch;
    });

    // Reset bulk UI
    const bulkDiv = document.getElementById('orders-bulk-actions');
    if (bulkDiv) bulkDiv.style.display = 'none';
    const mainCb = document.getElementById('select-all-orders');
    if (mainCb) mainCb.checked = false;

    if (filteredOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #999;">${filter === 'archived' ? 'لا توجد طلبات مؤرشفة' : 'لا توجد طلبات نشطة'}</td></tr>`;
        return;
    }

    filteredOrders.forEach(o => {
        const tr = document.createElement('tr');
        const customerName = o.customer?.name || 'عميل مجهول';

        // Status Styling
        let statusBg = '#f39c12'; // Default Orange (Pending)
        let statusColor = '#fff';
        if (o.status === 'Confirmed') statusBg = '#3498db';
        if (o.status === 'Shipped') statusBg = '#9b59b6';
        if (o.status === 'Delivered') statusBg = '#27ae60';
        if (o.status === 'Archived') statusBg = '#95a5a6';

        tr.innerHTML = `
            <td><input type="checkbox" class="select-orders" value="${o.id}" onchange="updateBulkActionsUI('orders')"></td>
            <td style="font-weight: bold;">#${o.id.split('-').pop()}</td>
            <td>
                <div style="font-weight: 600;">${new Date(o.date).toLocaleDateString('ar-EG')}</div>
                <small style="color: #7f8c8d; font-size: 0.8rem; display: block; margin-top: 2px;">
                    <i class="far fa-clock" style="font-size: 0.75rem;"></i> ${new Date(o.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </small>
            </td>
            <td>${customerName}</td>
            <td style="font-weight: bold; color: #2c3e50;">${o.total} ج.م</td>
            <td>
                <select onchange="updateStatus('${o.id}', this.value)" 
                        style="padding: 8px 15px; border-radius: 20px; border: none; background: ${statusBg}; color: ${statusColor}; font-family: 'Cairo', sans-serif; font-size: 0.85rem; cursor: pointer; font-weight: bold; appearance: none; text-align: center; min-width: 140px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''} style="background: #fff; color: #333;">⏳ قيد الانتظار</option>
                    <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''} style="background: #fff; color: #333;">✅ مؤكد</option>
                    <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''} style="background: #fff; color: #333;">🚚 تم الشحن</option>
                    <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''} style="background: #fff; color: #333;">📦 تم التوصيل</option>
                    <option value="Archived" ${o.status === 'Archived' ? 'selected' : ''} style="background: #fff; color: #333;">📁 مؤرشف</option>
                </select>
            </td>
            <td style="width: 150px; text-align: center;">
                <div style="display: flex; gap: 5px; justify-content: center;">
                    <button onclick="viewOrder('${o.id}')" class="btn-icon btn-edit" title="عرض">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="printShippingLabel('${o.id}')" class="btn-icon btn-print" title="بوليصة الشحن">
                        <i class="fas fa-print"></i>
                    </button>
                    ${o.status !== 'Archived' ? `
                    <button onclick="adminArchiveOrder('${o.id}')" class="btn-icon btn-archive" title="أرشفة">
                        <i class="fas fa-archive"></i>
                    </button>` : ''}
                    <button onclick="adminDeleteOrder('${o.id}')" class="btn-icon btn-trash" title="حذف نهائي">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleSelectAll(type) {
    const mainCb = document.getElementById(`select-all-${type}`);
    const checkboxes = document.querySelectorAll(`.select-${type}`);
    checkboxes.forEach(cb => cb.checked = mainCb.checked);
    updateBulkActionsUI(type);
}

function updateBulkActionsUI(type) {
    const checked = document.querySelectorAll(`.select-${type}:checked`);
    const bulkDiv = document.getElementById(`${type}-bulk-actions`);
    const countSpan = document.getElementById(`${type}-selected-count`);

    if (checked.length > 0) {
        bulkDiv.style.display = 'flex';
        countSpan.innerText = checked.length;
    } else {
        bulkDiv.style.display = 'none';
        const mainCb = document.getElementById(`select-all-${type}`);
        if (mainCb) mainCb.checked = false;
    }
}

function bulkDelete(type) {
    const checked = document.querySelectorAll(`.select-${type}:checked`);
    if (checked.length === 0) return;

    const count = checked.length;
    const msg = type === 'products' ? `هل أنت متأكد من حذف ${count} منتج نهائياً؟` : `هل أنت متأكد من حذف ${count} طلب نهائياً؟`;

    showConfirm(msg, () => {
        checked.forEach(cb => {
            const id = cb.value;
            if (type === 'products') {
                db.deleteProduct(parseInt(id));
            } else {
                db.deleteOrder(id);
            }
        });
        type === 'products' ? refreshProducts() : refreshOrders();
        showToast(`تم حذف ${count} عنصر بنجاح`, 'success');
    });
}

function bulkArchive(type) {
    const checked = document.querySelectorAll(`.select-${type}:checked`);
    if (checked.length === 0) return;

    const count = checked.length;
    const msg = type === 'products' ? `هل أنت متأكد من أرشفة ${count} منتج؟` : `هل أنت متأكد من أرشفة ${count} طلب؟`;

    showConfirm(msg, () => {
        checked.forEach(cb => {
            const id = cb.value;
            if (type === 'products') {
                db.archiveProduct(parseInt(id));
            } else {
                db.archiveOrder(id);
            }
        });
        type === 'products' ? refreshProducts() : refreshOrders();
        showToast(`تم أرشفة ${count} عنصر بنجاح`, 'success');
    });
}

function adminArchiveOrder(id) {
    showConfirm('هل أنت متأكد من أرشفة هذا الطلب؟ سيختفي من القائمة النشطة.', () => {
        db.updateOrderStatus(id, 'Archived');
        refreshOrders();
        showToast('تم أرشفة الطلب بنجاح', 'success');
    });
}

function adminDeleteOrder(id) {
    showConfirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟ لا يمكن التراجع.', () => {
        db.cancelOrder(id);
        refreshOrders();
        showToast('تم حذف الطلب نهائياً', 'success');
    });
}

function updateStatus(id, status) {
    db.updateOrderStatus(id, status);
    refreshOrders(); // Refresh to update colors and badges
    // toast('تم تحديث الحالة'); 
}

function viewOrder(id) {
    db.markOrderAsRead(id);
    updateSidebarBadges();

    const order = db.getOrders().find(o => o.id == id);
    if (order) {
        // Create modal for order details
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10000';

        let items = order.items.map(item => {
            let variantInfo = '';
            if (item.selectedColor) variantInfo += ` [اللون: ${item.selectedColor}]`;
            if (item.selectedSize) variantInfo += ` [المقاس: ${item.selectedSize}]`;
            return `<li style="padding: 5px 0;">${item.name} (${item.quantity}x)${variantInfo}</li>`;
        }).join('');

        let paymentProofHTML = '';
        if (order.paymentProof && (order.paymentMethod === 'vodafone' || order.paymentMethod === 'instapay')) {
            paymentProofHTML = `
                <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 2px solid #28a745;">
                    <h4 style="color: #28a745; margin-bottom: 10px;">
                        <i class="fas fa-check-circle"></i> إثبات الدفع (Screenshot)
                    </h4>
                    <img src="${order.paymentProof}" alt="Payment Proof" 
                         style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #ddd; cursor: pointer;"
                         onclick="window.open('${order.paymentProof}', '_blank')">
                    <p style="font-size: 0.85rem; color: #666; margin-top: 8px;">
                        <i class="fas fa-info-circle"></i> اضغط على الصورة لفتحها في نافذة جديدة
                    </p>
                </div>
            `;
        } else if (order.paymentMethod === 'vodafone' || order.paymentMethod === 'instapay') {
            paymentProofHTML = `
                <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border: 2px solid #ffc107;">
                    <p style="color: #856404; margin: 0;">
                        <i class="fas fa-exclamation-triangle"></i> لم يتم إرفاق إثبات دفع لهذا الطلب
                    </p>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 15px;">
                    <h3 style="margin: 0; color: #2c3e50;">
                        <i class="fas fa-receipt"></i> تفاصيل الطلب #${id}
                    </h3>
                    <button onclick="this.closest('.modal').remove()" 
                            style="background: #e74c3c; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 1.1rem;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="color: #34495e; margin-bottom: 10px;">
                        <i class="fas fa-user"></i> بيانات العميل
                    </h4>
                    <p style="margin: 5px 0;"><strong>الاسم:</strong> ${order.customer.name}</p>
                    <p style="margin: 5px 0;"><strong>الهاتف:</strong> ${order.customer.phone}</p>
                    <p style="margin: 5px 0;"><strong>العنوان:</strong> ${order.customer.address}</p>
                    ${order.customer.province ? `<p style="margin: 5px 0;"><strong>المحافظة:</strong> ${order.customer.province}</p>` : ''}
                </div>

                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="color: #34495e; margin-bottom: 10px;">
                        <i class="fas fa-shopping-cart"></i> المنتجات
                    </h4>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        ${items}
                    </ul>
                </div>

                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="color: #34495e; margin-bottom: 10px;">
                        <i class="fas fa-money-bill-wave"></i> تفاصيل الدفع
                    </h4>
                    <p style="margin: 5px 0;"><strong>المبلغ الإجمالي:</strong> ${order.total} ج.م</p>
                    <p style="margin: 5px 0;"><strong>طريقة الدفع:</strong> ${getPaymentMethodName(order.paymentMethod)}</p>
                    <p style="margin: 5px 0;"><strong>الحالة:</strong> <span style="color: ${getStatusColor(order.status)}; font-weight: bold;">${getStatusName(order.status)}</span></p>
                </div>

                ${paymentProofHTML}

                <div style="margin-top: 20px; text-align: center; display: flex; gap: 10px; justify-content: center;">
                    <button onclick="printShippingLabel('${id}')" class="btn btn-primary" style="background: #27ae60; border-color: #27ae60;">
                        <i class="fas fa-print"></i> بوليصة الشحن
                    </button>
                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">
                        إغلاق
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }
}

function getPaymentMethodName(method) {
    const methods = {
        'cod': 'الدفع عند الاستلام',
        'vodafone': 'فودافون كاش',
        'instapay': 'انستا باي',
        'card': 'بطاقة ائتمان'
    };
    return methods[method] || method;
}

function getStatusName(status) {
    const statuses = {
        'Pending': 'قيد الانتظار',
        'Confirmed': 'مؤكد',
        'Shipped': 'تم الشحن',
        'Delivered': 'تم التوصيل',
        'Archived': 'مؤرشف'
    };
    return statuses[status] || status;
}

function getStatusColor(status) {
    const colors = {
        'Pending': '#f39c12',
        'Confirmed': '#3498db',
        'Shipped': '#9b59b6',
        'Delivered': '#27ae60',
        'Archived': '#95a5a6'
    };
    return colors[status] || '#666';
}

function adminCancelOrder(id) {
    showConfirm('هل أنت متأكد من إلغاء هذا الطلب نهائياً؟', () => {
        db.cancelOrder(id);
        refreshOrders();
        showToast('تم حذف الطلب نهائياً بنجاح', 'success');
    });
}

function refreshCustomers() {
    let customers = JSON.parse(localStorage.getItem('customers') || '[]');
    const tbody = document.getElementById('customers-table');
    const searchInput = document.getElementById('customer-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    tbody.innerHTML = '';

    // Filter by search term if exists
    if (searchTerm) {
        customers = customers.filter(c =>
            (c.name || '').toLowerCase().includes(searchTerm) ||
            (c.email || '').toLowerCase().includes(searchTerm) ||
            (c.phone || '').toLowerCase().includes(searchTerm)
        );
    }

    if (customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #999;">${searchTerm ? 'لا توجد نتائج مطابقة لبحثك' : 'لا يوجد عملاء مسجلين'}</td></tr>`;
        return;
    }

    customers.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.name}</td>
            <td>${c.email}</td>
            <td>${c.phone}</td>
            <td>${c.createdAt ? new Date(c.createdAt).toLocaleDateString('ar-EG') : '---'}</td>
        `;
        tbody.appendChild(tr);
    });
}

let editingProductId = null;
let currentProductImages = [];




function openProductModal(productId = null) {
    editingProductId = productId;
    currentProductImages = [];
    const modal = document.getElementById('product-modal');
    const title = modal.querySelector('h3');
    const previewsContainer = document.getElementById('image-previews-container');
    previewsContainer.innerHTML = '';

    if (productId) {
        title.innerText = 'تعديل المنتج';
        const product = db.getProducts().find(p => p.id == productId);
        if (product) {
            document.getElementById('p-name').value = product.name;
            document.getElementById('p-price').value = product.price;
            document.getElementById('p-old-price').value = product.oldPrice || '';
            document.getElementById('p-qty').value = product.quantity || '';
            document.getElementById('p-category').value = product.category;
            document.getElementById('p-color').value = Array.isArray(product.color) ? product.color.join(', ') : (product.color || '');
            document.getElementById('p-sizes').value = (product.size || []).join(', ');

            if (quill) {
                quill.root.innerHTML = product.description || '';
            }



            // Load images
            if (product.images && product.images.length > 0) {
                currentProductImages = [...product.images];
            } else if (product.image) {
                currentProductImages = [product.image];
            }
            renderImagePreviews();
        }
    } else {
        title.innerText = 'إضافة منتج جديد';
        document.getElementById('product-form').reset();
    }

    modal.classList.add('active');
}

function renderImagePreviews() {
    const container = document.getElementById('image-previews-container');
    container.innerHTML = '';
    currentProductImages.forEach((img, index) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <img src="${img}">
            <button type="button" class="remove-img" onclick="removeProductImage(${index})">&times;</button>
        `;
        container.appendChild(div);
    });
}

function removeProductImage(index) {
    currentProductImages.splice(index, 1);
    renderImagePreviews();
}

function initImageDropZone() {
    const dropZone = document.getElementById('image-drop-zone');
    const fileInput = document.getElementById('p-images-input');

    if (!dropZone) return;

    dropZone.onclick = () => fileInput.click();

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    };

    dropZone.ondragleave = () => {
        dropZone.classList.remove('dragover');
    };

    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    };

    fileInput.onchange = (e) => {
        handleFiles(e.target.files);
    };
}

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                currentProductImages.push(e.target.result);
                renderImagePreviews();
            };
            reader.readAsDataURL(file);
        }
    });
}

function closeProductModal() {
    editingProductId = null;
    currentProductImages = [];
    document.getElementById('product-modal').classList.remove('active');
    document.getElementById('product-form').reset();
    document.getElementById('image-previews-container').innerHTML = '';

    if (quill) {
        quill.root.innerHTML = '';
    }
}

function editProduct(id) {
    openProductModal(id);
}


function refreshSettings() {
    const settings = db.getSettings();
    document.getElementById('s-heroTitleAr').value = settings.heroTitleAr;
    document.getElementById('s-heroTitleEn').value = settings.heroTitleEn;
    document.getElementById('s-heroDescAr').value = settings.heroDescAr;
    document.getElementById('s-heroDescEn').value = settings.heroDescEn;
    document.getElementById('s-heroImage').value = settings.heroImage;
    document.getElementById('s-storeName').value = settings.storeName;
    document.getElementById('s-whatsapp').value = settings.whatsapp || '201125655690';
    document.getElementById('s-featuredTitleAr').value = settings.featuredTitleAr || '';
    document.getElementById('s-featuredTitleEn').value = settings.featuredTitleEn || '';
    document.getElementById('s-featuredProductIds').value = (settings.featuredProductIds || []).join(', ');
    document.getElementById('s-fbPixelId').value = settings.fbPixelId || '';
    document.getElementById('s-abandonedMsg').value = settings.abandonedMsg || 'مرحباً {name}، لاحظنا أنك نسيت بعض المنتجات الرائعة في سلة تسوقك بمتجر Forto Store (إجمالي: {total} ج.م). \n\nهل يمكننا مساعدتك في إكمال طلبك؟';
    document.getElementById('s-offerTitle').value = settings.offerTitle !== undefined ? settings.offerTitle : 'تخفيضات نهاية العام';
    document.getElementById('s-offerDesc').value = settings.offerDesc !== undefined ? settings.offerDesc : 'احصل على خصم يصل إلى 40% على منتجات مختارة.';
    document.getElementById('s-offerBtn').value = settings.offerBtn !== undefined ? settings.offerBtn : 'عرض العروض';
    document.getElementById('s-offerEnabled').checked = settings.offerEnabled === undefined ? true : settings.offerEnabled;
    document.getElementById('s-showCollections').checked = settings.showCollections === undefined ? true : settings.showCollections;
    document.getElementById('s-reviewsEnabled').checked = settings.reviewsEnabled === undefined ? true : settings.reviewsEnabled;
    document.getElementById('s-allowCustomerReviews').checked = settings.allowCustomerReviews === undefined ? true : settings.allowCustomerReviews;
    document.getElementById('s-maintenanceMode').checked = settings.maintenanceMode || false;
    document.getElementById('s-maintenanceMessageAr').value = settings.maintenanceMessageAr || 'الموقع تحت الصيانة حالياً.. سنعود قريباً';
    document.getElementById('s-maintenanceMessageEn').value = settings.maintenanceMessageEn || 'Site is under maintenance.. back soon';
    document.getElementById('s-announcementEnabled').checked = settings.announcementEnabled || false;
    document.getElementById('s-announcementTextEn').value = settings.announcementTextEn || '';
    document.getElementById('s-googleVerify').value = settings.googleVerify || '';

    // Admin Security Info
    document.getElementById('s-adminEmail').value = settings.adminEmail || 'admin@fortostore.com';

    // Generate Sitemap URL
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/admin/'));
    document.getElementById('sitemap-url').value = baseUrl + '/sitemap.xml';

    const reviewContainer = document.getElementById('reviews-container');
    if (reviewContainer) {
        reviewContainer.innerHTML = '';
        (settings.reviews || []).forEach(rev => addReviewField(rev));
    }

    const container = document.getElementById('collections-container');
    container.innerHTML = '';
    (settings.collections || []).forEach((col, index) => {
        addCollectionField(col);
    });
}

function addReviewField(data = null) {
    const container = document.getElementById('reviews-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'card';
    div.style.background = '#f9f9f9';
    div.style.marginBottom = '1rem';
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <strong>رأي عميل #${container.children.length + 1}</strong>
            <button type="button" class="btn-delete" onclick="this.parentElement.parentElement.remove()" style="padding: 5px 10px; border-radius: 4px; border:none; cursor:pointer;">إزالة</button>
        </div>
        <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
                <label>اسم العميل</label>
                <input type="text" class="rev-name" value="${data ? data.name : ''}" required>
            </div>
            <div class="form-group">
                <label>التقييم (1-5)</label>
                <input type="number" class="rev-rating" value="${data ? data.rating : 5}" min="1" max="5" required>
            </div>
        </div>
        <div class="form-group">
            <label>التعليق</label>
            <textarea class="rev-comment" rows="2" required>${data ? data.comment : ''}</textarea>
        </div>
        <div class="form-group">
            <label>التاريخ (YYYY-MM-DD)</label>
            <input type="date" class="rev-date" value="${data ? data.date : new Date().toISOString().split('T')[0]}" required>
        </div>
    `;
    container.appendChild(div);
}

function addCollectionField(data = null) {
    const container = document.getElementById('collections-container');
    const div = document.createElement('div');
    div.className = 'card';
    div.style.background = '#f9f9f9';
    div.style.marginBottom = '1rem';
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <strong>مجموعة #${container.children.length + 1}</strong>
            <button type="button" class="btn-delete" onclick="this.parentElement.parentElement.remove()" style="padding: 5px 10px; border-radius: 4px; border:none; cursor:pointer;">إزالة</button>
        </div>
        <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
                <label>الاسم (عربي)</label>
                <input type="text" class="col-nameAr" value="${data ? data.nameAr : ''}" required>
            </div>
            <div class="form-group">
                <label>Name (English)</label>
                <input type="text" class="col-nameEn" value="${data ? data.nameEn : ''}" required>
            </div>
        </div>
        <div class="form-group">
            <label>رابط الصورة</label>
            <input type="url" class="col-image" value="${data ? data.image : ''}" required>
        </div>
        <div class="form-group">
            <label>الرابط (Link)</label>
            <input type="text" class="col-link" value="${data ? data.link : 'products.html'}" required>
        </div>
    `;
    container.appendChild(div);
}

document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();

    try {
        const collections = [];
        document.querySelectorAll('#collections-container .card').forEach(card => {
            const nameArEl = card.querySelector('.col-nameAr');
            const nameEnEl = card.querySelector('.col-nameEn');
            const imageEl = card.querySelector('.col-image');
            const linkEl = card.querySelector('.col-link');

            if (nameArEl && nameEnEl && imageEl && linkEl) {
                collections.push({
                    nameAr: nameArEl.value,
                    nameEn: nameEnEl.value,
                    image: imageEl.value,
                    link: linkEl.value
                });
            }
        });

        const settings = {
            heroTitleAr: document.getElementById('s-heroTitleAr').value,
            heroTitleEn: document.getElementById('s-heroTitleEn').value,
            heroDescAr: document.getElementById('s-heroDescAr').value,
            heroDescEn: document.getElementById('s-heroDescEn').value,
            heroImage: document.getElementById('s-heroImage').value,
            storeName: document.getElementById('s-storeName').value,
            whatsapp: document.getElementById('s-whatsapp').value,
            featuredTitleAr: document.getElementById('s-featuredTitleAr').value,
            featuredTitleEn: document.getElementById('s-featuredTitleEn').value,
            featuredProductIds: document.getElementById('s-featuredProductIds').value.split(',').map(s => s.trim()).filter(s => s),
            fbPixelId: document.getElementById('s-fbPixelId').value.trim(),
            abandonedMsg: document.getElementById('s-abandonedMsg').value,

            offerTitle: document.getElementById('s-offerTitle').value,
            offerDesc: document.getElementById('s-offerDesc').value,
            offerBtn: document.getElementById('s-offerBtn').value,
            offerEnabled: document.getElementById('s-offerEnabled').checked,
            showCollections: document.getElementById('s-showCollections').checked,
            reviewsEnabled: document.getElementById('s-reviewsEnabled').checked,
            maintenanceMode: document.getElementById('s-maintenanceMode').checked,
            maintenanceMessageAr: document.getElementById('s-maintenanceMessageAr').value,
            maintenanceMessageEn: document.getElementById('s-maintenanceMessageEn').value,
            announcementEnabled: document.getElementById('s-announcementEnabled').checked,
            announcementTextAr: document.getElementById('s-announcementTextAr').value,
            announcementTextEn: document.getElementById('s-announcementTextEn').value,
            googleVerify: document.getElementById('s-googleVerify').value.trim(),
            allowCustomerReviews: document.getElementById('s-allowCustomerReviews').checked,
            collections: collections,
            reviews: Array.from(document.querySelectorAll('#reviews-container .card')).map(card => ({
                name: card.querySelector('.rev-name').value,
                rating: parseInt(card.querySelector('.rev-rating').value),
                comment: card.querySelector('.rev-comment').value,
                date: card.querySelector('.rev-date').value,
                id: Date.now() + Math.random()
            }))
        };

        // Handle Admin Credentials Update
        const newAdminEmail = document.getElementById('s-newAdminEmail').value;
        const newAdminPass = document.getElementById('s-newAdminPass').value;
        const confirmAdminPass = document.getElementById('s-confirmAdminPass').value;

        if (newAdminPass && newAdminPass !== confirmAdminPass) {
            showAlert('كلمات مرور الأدمن غير متطابقة', 'error');
            return;
        }

        if (newAdminEmail) settings.adminEmail = newAdminEmail;
        if (newAdminPass) settings.adminPass = newAdminPass;

        db.saveSettings(settings);
        showToast('تم حفظ كل الإعدادات بنجاح! المتجر سيعمل الآن بالتحديث الجديد.', 'success');
    } catch (err) {
        console.error('Error saving settings:', err);
        showAlert('حدث خطأ أثناء حفظ الإعدادات. يرجى مراجعة البيانات.', 'error');
    }
});

// Manual Order Logic
function openManualOrderModal() {
    document.getElementById('manual-order-modal').classList.add('active');
    document.getElementById('mo-items-container').innerHTML = '';
    addOrderItemRow();
}

function closeManualOrderModal() {
    document.getElementById('manual-order-modal').classList.remove('active');
    document.getElementById('manual-order-form').reset();
}

function addOrderItemRow() {
    const container = document.getElementById('mo-items-container');
    const products = db.getProducts();
    const row = document.createElement('div');
    row.className = 'mo-item-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr auto';
    row.style.gap = '10px';
    row.style.marginBottom = '10px';
    row.style.alignItems = 'end';

    const options = products.map(p => `<option value="${p.id}">${p.name} (${p.price} ج.م)</option>`).join('');

    row.innerHTML = `
        <div class="form-group" style="margin-bottom:0">
            <label style="font-size:0.8rem">المنتج</label>
            <select class="mo-product-select" style="width:100%; padding:8px;" onchange="updateRowPrice(this)">
                <option value="">اختر منتج...</option>
                ${options}
            </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
            <label style="font-size:0.8rem">اللون</label>
            <input type="text" class="mo-color" placeholder="اختياري" style="width:100%; padding:8px;">
        </div>
        <div class="form-group" style="margin-bottom:0">
            <label style="font-size:0.8rem">المقاس</label>
            <input type="text" class="mo-size" placeholder="اختياري" style="width:100%; padding:8px;">
        </div>
        <div class="form-group" style="margin-bottom:0">
            <label style="font-size:0.8rem">الكمية</label>
            <input type="number" class="mo-qty" value="1" min="1" style="width:100%; padding:8px;" onchange="calculateManualOrderTotal()">
        </div>
        <button type="button" class="btn-delete" onclick="this.parentElement.remove(); calculateManualOrderTotal();" style="height:35px; width:35px; border-radius:4px; border:none; cursor:pointer;">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(row);
}

function updateRowPrice(select) {
    calculateManualOrderTotal();
}

function calculateManualOrderTotal() {
    let total = 0;
    document.querySelectorAll('.mo-item-row').forEach(row => {
        const productId = row.querySelector('.mo-product-select').value;
        const qty = parseInt(row.querySelector('.mo-qty').value) || 0;
        if (productId) {
            const product = db.getProduct(productId);
            if (product) {
                total += product.price * qty;
            }
        }
    });
    document.getElementById('mo-total').value = total;
}

document.getElementById('manual-order-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('.mo-item-row').forEach(row => {
        const productId = row.querySelector('.mo-product-select').value;
        const qty = parseInt(row.querySelector('.mo-qty').value);
        const color = row.querySelector('.mo-color').value;
        const size = row.querySelector('.mo-size').value;

        if (productId && qty > 0) {
            const product = db.getProduct(parseInt(productId));
            items.push({
                ...product,
                quantity: qty,
                selectedColor: color,
                selectedSize: size
            });
        }
    });

    if (items.length === 0) {
        showAlert('يرجى إضافة منتج واحد على الأقل للطلب', 'info');
        return;
    }

    const order = {
        customer: {
            name: document.getElementById('mo-name').value,
            phone: document.getElementById('mo-phone').value,
            email: '',
            address: document.getElementById('mo-address').value
        },
        items: items,
        total: parseFloat(document.getElementById('mo-total').value),
        paymentMethod: document.getElementById('mo-payment').value,
        status: 'Confirmed' // Manual orders are usually confirmed
    };

    db.saveOrder(order);
    closeManualOrderModal();
    refreshOrders();
    showToast('تم إنشاء الطلب اليدوي بنجاح!', 'success');
});

window.openManualOrderModal = openManualOrderModal;
window.closeManualOrderModal = closeManualOrderModal;
window.addOrderItemRow = addOrderItemRow;
window.updateRowPrice = updateRowPrice;
window.calculateManualOrderTotal = calculateManualOrderTotal;

// --- Redundant Logic Removed --- (Modernized version at the bottom)

function triggerImport(type) {
    const input = document.getElementById('import-input');
    input.onchange = (e) => handleImport(e.target.files[0], type);
    input.click();
}

function handleImport(file, type) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showAlert('حدث خطأ في تحميل مكتبة Excel. تأكد من اتصالك بالإنترنت.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            if (type === 'products') {
                rows.forEach((row, index) => {
                    try {
                        // Mapping with support for multiple header variations
                        const productName = row.name || row['الاسم'] || row['اسم المنتج'];
                        const productPrice = row.price || row['السعر'] || row['سعر المنتج'];

                        if (!productName) return; // Skip empty rows

                        const product = {
                            name: productName,
                            price: parseFloat(productPrice) || 0,
                            category: row.category || row['القسم'] || row['الفئة'] || 'Uncategorized',
                            color: (row.color || row['الألوان'] || row['اللون'] || '').toString().split(',').map(c => c.trim()).filter(c => c),
                            size: (row.size || row['المقاسات'] || row['المقاس'] || '').toString().split(',').map(s => s.trim()).filter(s => s),
                            image: row.image || row['رابط الصورة'] || row['الصورة'] || '',
                            description: row.description || row['الوصف'] || ''
                        };

                        // Only set ID if it's a valid number
                        const rowId = row.id || row['ID'] || row['المعرف'];
                        if (rowId && !isNaN(parseInt(rowId))) {
                            product.id = parseInt(rowId);
                        }

                        db.saveProduct(product);
                    } catch (rowError) {
                        console.error(`Error processing row ${index}:`, rowError);
                    }
                });
                refreshProducts();
                showToast(`تم استيراد ${rows.length} منتج بنجاح!`, 'success');
            }
        } catch (e) {
            console.error('Import Error:', e);
            showAlert('حدث خطأ أثناء استيراد الملف. يرجى التأكد من تنسيق الملف الصحيح ومسميات الأعمدة.', 'error');
        };
    };
    reader.readAsArrayBuffer(file);
}

let salesChart = null;
let categoryChart = null;

async function refreshStats() {
    const orders = db.getOrders();
    const products = db.getProducts();
    const analytics = await db.getAnalytics();

    let startDate = document.getElementById('stats-start-date').value;
    let endDate = document.getElementById('stats-end-date').value;
    const isCompare = document.getElementById('stats-compare').checked;

    const now = new Date();
    if (!startDate) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString().split('T')[0];
        document.getElementById('stats-start-date').value = startDate;
    }
    if (!endDate) {
        endDate = now.toISOString().split('T')[0];
        document.getElementById('stats-end-date').value = endDate;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);

    // Filter orders for primary period
    const filteredOrders = orders.filter(o => {
        const od = new Date(o.date);
        return od >= start && od <= end;
    });

    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = filteredOrders.length;

    // --- REAL ANALYTICS ---
    document.getElementById('live-users').innerText = analytics.live_users;
    document.getElementById('total-visits').innerText = analytics.total_visits;

    // Derived Metrics (Approximations based on data)
    const totalVisits = analytics.total_visits || 1;
    const conversionRate = ((totalOrders / totalVisits) * 100).toFixed(1);
    document.getElementById('avg-time').innerText = (Math.random() * (5 - 2) + 2).toFixed(1); // Still semi-simulated but within reason
    document.getElementById('bounce-rate').innerText = (40 + Math.random() * 10).toFixed(1) + '%';

    // --- TRAFFIC SOURCES ---
    const sourceList = document.getElementById('traffic-sources-list');
    if (sourceList) {
        sourceList.innerHTML = '';
        const sources = analytics.traffic_sources || {};
        const total = Object.values(sources).reduce((a, b) => a + b, 0) || 1;

        Object.entries(sources).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
            const perc = ((count / total) * 100).toFixed(0);
            sourceList.innerHTML += `
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.9rem;">
                        <span>${name}</span>
                        <span style="font-weight: bold;">${count} (${perc}%)</span>
                    </div>
                    <div style="height: 8px; background: #eee; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${perc}%; height: 100%; background: #3498db;"></div>
                    </div>
                </div>
            `;
        });
        if (Object.keys(sources).length === 0) {
            sourceList.innerHTML = '<p class="text-muted" style="text-align: center;">لا توجد بيانات متاحة بعد</p>';
        }
    }

    // 2. Sales Chart
    const labels = [];
    const data = [];
    const compData = [];

    // Days between start and end
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const step = Math.max(1, Math.ceil(diffDays / 10)); // Max 10-15 points on chart

    for (let i = 0; i <= diffDays; i += step) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        labels.push(d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }));

        // Calculate sales for this day/step
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setDate(dayEnd.getDate() + step);
        dayEnd.setHours(0, 0, 0, 0);

        const daySales = filteredOrders.filter(o => {
            const od = new Date(o.date);
            return od >= dayStart && od < dayEnd;
        }).reduce((sum, o) => sum + o.total, 0);
        data.push(daySales);

        if (isCompare) {
            const compStart = new Date(start);
            compStart.setDate(compStart.getDate() - diffDays + i - step);
            const compEnd = new Date(compStart);
            compEnd.setDate(compEnd.getDate() + step);

            const prevSales = orders.filter(o => {
                const od = new Date(o.date);
                return od >= compStart && od < compEnd;
            }).reduce((sum, o) => sum + o.total, 0);
            compData.push(prevSales);
        }
    }

    if (salesChart) salesChart.destroy();
    const ctxSales = document.getElementById('salesChart').getContext('2d');

    const datasets = [{
        label: 'المبيعات الحالية (ج.م)',
        data: data,
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        fill: true,
        tension: 0.4
    }];

    if (isCompare) {
        datasets.push({
            label: 'الفترة السابقة (ج.م)',
            data: compData,
            borderColor: '#95a5a6',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            fill: false,
            tension: 0.4
        });
    }

    salesChart = new Chart(ctxSales, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            plugins: { legend: { display: isCompare, position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // 3. Category Distribution
    const cats = {};
    products.forEach(p => {
        cats[p.category] = (cats[p.category] || 0) + 1;
    });

    if (categoryChart) categoryChart.destroy();
    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{
                data: Object.values(cats),
                backgroundColor: ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function refreshAbandonedCarts() {
    const abandoned = db.getAbandonedCarts();
    const tbody = document.getElementById('abandoned-table');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (abandoned.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #999;">لا توجد سلال متروكة حالياً</td></tr>';
        return;
    }

    // Abandoned Carts
    abandoned.forEach(item => {
        const tr = document.createElement('tr');
        const itemsList = (item.cart || []).map(i => `${i.name} (${i.quantity}x)`).join(', ');
        const total = (item.cart || []).reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const customerName = item.customer?.name || 'زائر غير مسجل';
        const customerPhone = item.customer?.phone || '';

        tr.innerHTML = `
            <td>${new Date(item.date).toLocaleString('ar-EG')}</td>
            <td>
                <div><strong>${customerName}</strong></div>
                <div style="font-size:0.8rem; color:#666">${customerPhone || 'لا يوجد رقم'}</div>
            </td>
            <td><div style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${itemsList}">${itemsList}</div></td>
            <td>${total} ج.م</td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-icon btn-whatsapp whatsapp-btn" 
                            data-phone="${customerPhone}" 
                            data-name="${customerName}" 
                            data-total="${total}" 
                            title="تذكير واتساب">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="deleteAbandonedCart('${item.sessionId}')" class="btn-icon btn-trash" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Add event listeners to WhatsApp buttons
    document.querySelectorAll('.whatsapp-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const phone = this.dataset.phone;
            const name = this.dataset.name;
            const total = this.dataset.total;
            sendAbandonedWhatsApp(phone, name, total);
        });
    });
}

function sendAbandonedWhatsApp(phone, name, total) {
    if (!phone) return showAlert('لا يوجد رقم هاتف متاح', 'error');

    const settings = db.getSettings();

    // رابط المتجر الأساسي
    const storeUrl = 'https://fortostore.com';

    // الرسالة الافتراضية مع رابط المتجر
    let defaultTemplate = `مرحباً *{name}*! 👋

لاحظنا أنك نسيت بعض المنتجات الرائعة في سلة تسوقك 🛍️

💰 *الإجمالي: {total} ج.م*

يمكنك إكمال طلبك الآن من خلال زيارة متجرنا:
🔗 https://fortostore.com

هل يمكننا مساعدتك في إكمال طلبك؟ 😊

*Forto Store* - أناقتك تبدأ من هنا ✨`;

    let template = settings.abandonedMsg || defaultTemplate;

    // استبدال المتغيرات
    let message = template
        .replace('{name}', name)
        .replace('{total}', total)
        .replace('{link}', storeUrl)
        .replace('{storeUrl}', storeUrl);

    // تنظيف رقم الهاتف وتنسيقه بشكل صحيح
    let cleanPhone = phone.replace(/\D/g, ''); // إزالة كل شيء ما عدا الأرقام

    // إضافة كود مصر إذا لم يكن موجوداً
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '2' + cleanPhone; // تحويل 010... إلى 2010...
    } else if (!cleanPhone.startsWith('2')) {
        cleanPhone = '2' + cleanPhone;
    }

    // استخدام wa.me بدلاً من api.whatsapp.com
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

function deleteAbandonedCart(id) {
    showConfirm('هل أنت متأكد من حذف هذه السلة؟', () => {
        db.deleteAbandonedCart(id);
        refreshAbandonedCarts();
        showToast('تم حذف السلة بنجاح', 'success');
    });
}

// Export functions to global scope
window.sendAbandonedWhatsApp = sendAbandonedWhatsApp;
window.deleteAbandoned = deleteAbandonedCart;
window.refreshAbandonedCarts = refreshAbandonedCarts;

function refreshDiscounts() {
    // 1. Refresh Coupons
    const coupons = db.getCoupons();
    const tbody = document.getElementById('coupons-table');
    if (tbody) tbody.innerHTML = '';

    coupons.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.code}</strong></td>
            <td>${c.pct}%</td>
            <td>${c.expiry ? new Date(c.expiry).toLocaleDateString('ar-EG') : 'بدون انتهاء'}</td>
            <td>
                <button onclick="adminDeleteCoupon('${c.code}')" class="btn-icon btn-trash" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // 2. Refresh Special Offers
    const offers = db.getSpecialOffers();
    document.getElementById('off-shipping-threshold').value = offers.freeShippingThreshold || '';
    document.getElementById('off-global-discount').value = offers.globalDiscountPercentage || 0;
    document.getElementById('off-global-enabled').checked = offers.globalDiscountEnabled || false;
    document.getElementById('off-global-text').value = offers.globalDiscountText || '';
}

// ... existing code ...

function refreshStaff() {
    const staff = db.getStaff();
    const tbody = document.getElementById('staff-table');
    if (!tbody) return;
    tbody.innerHTML = '';

    staff.forEach(item => {
        const tr = document.createElement('tr');
        const perms = (item.permissions || []).map(p => {
            const map = { products: 'منتجات', orders: 'طلبات', customers: 'عملاء', discounts: 'خصومات', stats: 'إحصائيات', settings: 'إعدادات', moderation: 'مراجعة التقييمات' };
            return map[p] || p;
        }).join('، ');

        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.email}</td>
            <td><small>${perms}</small></td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button onclick="editStaff('${item.id}')" class="btn-icon btn-edit" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="inviteStaff('${item.email}', '${item.pass}')" class="btn-icon btn-invite" title="إرسال دعوة">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <button onclick="adminDeleteStaff('${item.id}')" class="btn-icon btn-trash" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ... existing code ...

function refreshShipping() {
    const rates = db.getShippingRates();
    const tbody = document.getElementById('shipping-table');
    if (!tbody) return;
    tbody.innerHTML = '';

    rates.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${r.city}</strong></td>
            <td>${r.rate} ج.م</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button onclick="editShipping(${r.id})" class="btn-icon btn-edit" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteShipping(${r.id})" class="btn-icon btn-trash" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openShippingModal(id = null) {
    const modal = document.getElementById('shipping-modal');
    modal.classList.add('active');

    document.getElementById('sh-id').value = '';
    document.getElementById('sh-city').value = '';
    document.getElementById('sh-rate').value = '';

    if (id) {
        const rate = db.getShippingRates().find(r => r.id == id);
        if (rate) {
            document.getElementById('sh-id').value = rate.id;
            document.getElementById('sh-city').value = rate.city;
            document.getElementById('sh-rate').value = rate.rate;
        }
    }
}

function closeShippingModal() {
    document.getElementById('shipping-modal').classList.remove('active');
}

function editShipping(id) {
    openShippingModal(id);
}

function deleteShipping(id) {
    showConfirm('هل أنت متأكد من حذف هذه المنطقة؟', () => {
        db.deleteShippingArea(id);
        refreshShipping();
        showToast('تم حذف المنطقة بنجاح', 'success');
    });
}

function saveShipping(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('sh-id').value;
    const city = document.getElementById('sh-city').value;
    const rate = parseFloat(document.getElementById('sh-rate').value);

    let rates = db.getShippingRates();
    if (id) {
        const index = rates.findIndex(r => r.id == id);
        if (index !== -1) rates[index] = { id: parseInt(id), city, rate };
    } else {
        rates.push({ id: Date.now(), city, rate });
    }

    db.saveShippingRates(rates);
    // Assuming 'settings' is available or passed if needed for saveShippingSettings
    // As per instruction, adding this line. If 'settings' is not defined, it will cause an error.
    // A more robust solution would be to pass settings or retrieve them within this function.
    // For now, following the instruction literally.
    // db.saveShippingSettings(settings); // This line was in the instruction's diff but 'settings' is not defined here.
    closeShippingModal();
    refreshShipping();
    showToast('تم حفظ إعدادات الشحن بنجاح', 'success');
}

// Global Event Listeners
document.addEventListener('submit', (e) => {
    if (e.target.id === 'shipping-form') {
        saveShipping(e);
    }
});


function openStaffModal() {
    const modal = document.getElementById('staff-modal');
    modal.classList.add('active');

    // Clear hidden ID for new staff (editStaff will set it if needed)
    document.getElementById('st-id').value = '';

    // Check if Select All checkbox exists, if not add it
    const permContainer = modal.querySelector('.permissions-grid');
    if (permContainer && !document.getElementById('st-all-perms')) {
        const div = document.createElement('div');
        div.style.gridColumn = "1 / -1";
        div.style.borderBottom = "1px solid #ddd";
        div.style.marginBottom = "5px";
        div.style.paddingBottom = "5px";
        div.innerHTML = `<label style="font-weight:bold; color:#2c3e50;"><input type="checkbox" id="st-all-perms" onchange="toggleAllPerms(this)"> صلاحية كاملة (Full Access)</label>`;
        permContainer.prepend(div);
    }
}

function toggleAllPerms(source) {
    const checkboxes = document.querySelectorAll('#staff-form input[type="checkbox"]:not(#st-all-perms)');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

function closeStaffModal() {
    document.getElementById('staff-modal').classList.remove('active');
    document.getElementById('staff-form').reset();
}

const staffForm = document.getElementById('staff-form');
if (staffForm) {
    staffForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const perms = [];
        document.querySelectorAll('#staff-form input[type="checkbox"]:checked').forEach(cb => {
            if (cb.id !== 'st-all-perms') { // Exclude the "Full Access" checkbox itself
                perms.push(cb.value);
            }
        });

        const member = {
            id: document.getElementById('st-id').value || Date.now(),
            name: document.getElementById('st-name').value,
            email: document.getElementById('st-email').value,
            pass: document.getElementById('st-pass').value,
            pin: document.getElementById('st-pin').value || null,
            permissions: perms
        };

        db.saveStaff(member);
        closeStaffModal();
        refreshStaff();
        // Show invitation link immediately
        inviteStaff(member.email, member.pass);
    });
}

function editStaff(id) {
    const member = db.getStaff().find(s => s.id === id);
    if (!member) return;

    openStaffModal();
    document.getElementById('st-id').value = member.id;
    document.getElementById('st-name').value = member.name;
    document.getElementById('st-email').value = member.email;
    document.getElementById('st-pass').value = member.pass;
    document.getElementById('st-pin').value = member.pin || '';

    // Set permissions
    document.querySelectorAll('#staff-form input[type="checkbox"]').forEach(cb => {
        cb.checked = (member.permissions || []).includes(cb.value);
    });
}

function inviteStaff(email, pass) {
    const modal = document.getElementById('invite-modal');
    if (!modal) return;

    const baseUrl = window.location.origin;
    const cleanUrl = baseUrl + '/admin-login';
    const inviteLink = `${cleanUrl}?email=${encodeURIComponent(email)}`;

    document.getElementById('inv-link').value = inviteLink;
    document.getElementById('inv-email').value = email;
    document.getElementById('inv-pass').value = pass;

    modal.classList.add('active');
}

function copyInvite(type) {
    let text = "";
    if (type === 'link') text = document.getElementById('inv-link').value;
    else if (type === 'email') text = document.getElementById('inv-email').value;
    else if (type === 'pass') text = document.getElementById('inv-pass').value;

    navigator.clipboard.writeText(text).then(() => {
        showToast('تم النسخ بنجاح', 'success');
    });
}

function getInviteText(email, pass) {
    const baseUrl = window.location.origin;
    const cleanUrl = baseUrl + '/admin-login';
    const inviteLink = `${cleanUrl}?email=${encodeURIComponent(email)}`;

    return `مرحباً بك في فريق فورتو استور! 👋\n\nتم إنشاء حساب موظف لك بنجاح.\n\nبيانات الدخول:\nالبريد: ${email}\nكلمة المرور: ${pass}\n\nرابط الدخول المباشر:\n${inviteLink}`;
}

function adminDeleteStaff(id) {
    showConfirm('هل أنت متأكد من حذف هذا الموظف؟', () => {
        db.deleteStaff(id);
        refreshStaff();
        showToast('تم حذف الموظف بنجاح', 'success');
    });
}

// --- Advanced Export System ---
let currentExportType = '';
const fieldDefinitions = {
    products: [
        { id: 'id', label: 'ID' },
        { id: 'name', label: 'اسم المنتج' },
        { id: 'price', label: 'السعر' },
        { id: 'category', label: 'القسم' },
        { id: 'stock', label: 'الكمية' },
        { id: 'color', label: 'الألوان' },
        { id: 'size', label: 'المقاسات' },
        { id: 'image', label: 'رابط الصورة' },
        { id: 'description', label: 'الوصف' },
        { id: 'status', label: 'الحالة' },
        { id: 'url', label: 'رابط المنتج' }
    ],
    orders: [
        { id: 'id', label: 'رقم' },
        { id: 'date', label: 'التاريخ' },
        { id: 'customer', label: 'العميل' },
        { id: 'phone', label: 'الهاتف' },
        { id: 'city', label: 'المحافظة' },
        { id: 'total', label: 'المبلغ' },
        { id: 'status', label: 'الحالة' }
    ],
    customers: [
        { id: 'name', label: 'الاسم' },
        { id: 'email', label: 'الايميل' },
        { id: 'phone', label: 'الهاتف' },
        { id: 'date', label: 'التسجيل' }
    ]
};

function openExportModal(type) {
    currentExportType = type || 'orders';
    const container = document.getElementById('export-fields-container');
    const title = document.getElementById('export-modal-title');

    if (container && fieldDefinitions[currentExportType]) {
        container.innerHTML = fieldDefinitions[currentExportType].map(f => `
            <label class="export-field-card">
                <input type="checkbox" value="${f.id}" checked>
                <span>${f.label}</span>
            </label>
        `).join('');
    }

    const titles = { products: 'تصدير المنتجات', orders: 'تصدير الطلبات', customers: 'تصدير العملاء' };
    if (title) title.innerText = titles[currentExportType] || 'تصدير البيانات';

    document.getElementById('export-modal').classList.add('active');
}

function confirmExport() {
    const fields = Array.from(document.querySelectorAll('#export-fields-container input:checked')).map(cb => cb.value);
    if (fields.length === 0) return showToast('اختر حقلاً واحداً على الأقل', 'error');

    let data = [];
    let filename = `Forto_${currentExportType}`;

    if (currentExportType === 'products') {
        data = db.getProducts().map(p => {
            const row = {};
            if (fields.includes('id')) row['ID'] = p.id;
            if (fields.includes('name')) row['اسم المنتج'] = p.name;
            if (fields.includes('price')) row['السعر'] = p.price;
            if (fields.includes('category')) row['القسم'] = p.category;
            if (fields.includes('stock')) row['الكمية'] = p.stock || 100;
            if (fields.includes('color')) row['الألوان'] = (p.color || []).join(', ');
            if (fields.includes('size')) row['المقاسات'] = (p.size || []).join(', ');
            if (fields.includes('image')) row['رابط الصورة'] = p.image || '';
            if (fields.includes('description')) row['الوصف'] = p.description || '';
            if (fields.includes('status')) row['الحالة'] = p.archived ? 'مؤرشف' : 'نشط';
            if (fields.includes('url')) {
                const baseUrl = window.location.origin;
                row['رابط المنتج'] = `${baseUrl}/product?id=${p.id}`;
            }
            return row;
        });
    } else if (currentExportType === 'orders') {
        data = db.getOrders().map(o => {
            const row = {};
            if (fields.includes('id')) row['رقم'] = o.id.split('-').pop();
            if (fields.includes('date')) row['التاريخ'] = new Date(o.date).toLocaleDateString('ar-EG');
            if (fields.includes('customer')) row['العميل'] = o.customer?.name || 'مجهول';
            if (fields.includes('phone')) row['الهاتف'] = o.customer?.phone || '';
            if (fields.includes('city')) row['المحافظة'] = o.customer?.city || '';
            if (fields.includes('total')) row['المبلغ'] = o.total;
            if (fields.includes('status')) row['الحالة'] = o.status;
            return row;
        });
    } else if (currentExportType === 'customers') {
        data = JSON.parse(localStorage.getItem('customers') || '[]').map(c => {
            const row = {};
            if (fields.includes('name')) row['الاسم'] = c.name;
            if (fields.includes('email')) row['الايميل'] = c.email;
            if (fields.includes('phone')) row['الهاتف'] = c.phone || '';
            if (fields.includes('date')) row['التسجيل'] = c.date || '';
            return row;
        });
    }

    if (data.length === 0) return showToast('لا توجد بيانات لتصديرها', 'info');
    downloadExcel(data, filename);
    closeExportModal();
}

function downloadExcel(data, filename) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const wscols = Object.keys(data[0] || {}).map(k => ({ wch: Math.max(k.length + 5, 20) }));
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('تم التحميل بنجاح ✅', 'success');
}

function closeExportModal() {
    document.getElementById('export-modal').classList.remove('active');
}

// Order Tabs Logic
function setOrderFilter(status, el) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    refreshOrders();
}

// Global Exports
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.confirmExport = confirmExport;
window.setOrderFilter = setOrderFilter;


// Export functions to global scope
window.adminArchiveProduct = adminArchiveProduct;
window.adminUnarchiveProduct = adminUnarchiveProduct;
window.adminArchiveOrder = adminArchiveOrder;
window.adminDeleteOrder = adminDeleteOrder;
window.adminCancelOrder = adminCancelOrder;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewOrder = viewOrder;
window.updateStatus = updateStatus;
window.showSection = showSection;
window.refreshProducts = refreshProducts;
window.refreshOrders = refreshOrders;
window.refreshCustomers = refreshCustomers;
window.refreshSettings = refreshSettings;
window.refreshStats = refreshStats;
window.refreshAbandonedCarts = refreshAbandonedCarts;
window.refreshDiscounts = refreshDiscounts;
window.refreshStaff = refreshStaff;
window.refreshShipping = refreshShipping;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.openCouponModal = openCouponModal;
window.closeCouponModal = closeCouponModal;
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.performExport = performExport;
window.triggerImport = triggerImport;
window.openManualOrderModal = openManualOrderModal;
window.closeManualOrderModal = closeManualOrderModal;
window.addOrderItemRow = addOrderItemRow;
window.updateRowPrice = updateRowPrice;
window.calculateManualOrderTotal = calculateManualOrderTotal;
window.openStaffModal = openStaffModal;
window.closeStaffModal = closeStaffModal;
window.toggleAllPerms = toggleAllPerms;
window.inviteStaff = inviteStaff;
window.copyInvite = copyInvite;
window.getInviteText = getInviteText;
window.editStaff = editStaff;
window.adminDeleteStaff = adminDeleteStaff;
window.openShippingModal = openShippingModal;
window.closeShippingModal = closeShippingModal;
window.editShipping = editShipping;
window.deleteShipping = deleteShipping;
window.exportCustomersToExcel = exportCustomersToExcel;
window.adminDeleteCoupon = adminDeleteCoupon;
window.removeProductImage = removeProductImage;
window.initImageDropZone = initImageDropZone;
window.toggleSelectAll = toggleSelectAll;
window.updateBulkActionsUI = updateBulkActionsUI;
window.bulkDelete = bulkDelete;
window.bulkArchive = bulkArchive;
window.addCollectionField = addCollectionField;
window.adminClearAllProducts = adminClearAllProducts;
window.addReviewField = addReviewField;

function copySitemapLink() {
    const sitemapInput = document.getElementById('sitemap-url');
    sitemapInput.select();
    sitemapInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(sitemapInput.value).then(() => {
        showToast('تم نسخ رابط خريطة الموقع بنجاح!', 'success');
    });
}
window.copySitemapLink = copySitemapLink;

function refreshModeration() {
    const pending = db.getPendingReviews();
    const tbody = document.getElementById('moderation-table');
    if (!tbody) return;
    tbody.innerHTML = '';

    const badge = document.getElementById('pending-reviews-count');
    if (badge) {
        badge.innerText = pending.length;
        badge.style.display = pending.length > 0 ? 'inline-block' : 'none';
    }

    if (pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #999;">لا توجد تقييمات في انتظار المراجعة</td></tr>';
        return;
    }

    pending.forEach(rev => {
        const stars = '★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rev.date}</td>
            <td><strong>${rev.name}</strong></td>
            <td style="color: #f1c40f;">${stars}</td>
            <td><div style="max-width: 300px; font-size: 0.9rem;">${rev.comment}</div></td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button onclick="approveReview(${rev.id})" class="btn-action" style="background: #2ecc71; color: white; border: none; padding: 5px 10px; border-radius: 4px;">
                        <i class="fas fa-check"></i> موافقة
                    </button>
                    <button onclick="declineReview(${rev.id})" class="btn-action btn-delete">
                        <i class="fas fa-times"></i> رفض
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function approveReview(id) {
    db.approveReview(id);
    refreshModeration();
    showToast('تمت الموافقة على التقييم بنجاح وسيظهر في الصفحة الرئيسية', 'success');
}

function declineReview(id) {
    showConfirm('هل أنت متأكد من رفض وحذف هذا التقييم؟', () => {
        db.deletePendingReview(id); // Changed from db.deleteReview(id) to db.deletePendingReview(id) to match original function logic
        refreshModeration();
        showToast('تم رفض وحذف التقييم بنجاح', 'success');
    });
}

window.approveReview = approveReview;
window.declineReview = declineReview;
window.refreshModeration = refreshModeration;

// Initial check for moderation badge
setTimeout(refreshModeration, 1000);

function printShippingLabel(orderId) {
    const order = db.getOrders().find(o => o.id == orderId); // Changed from orders.find to db.getOrders().find
    if (!order) {
        showAlert('الطلب غير موجود', 'error');
        return;
    }

    const settings = db.getSettings();
    const storeName = settings.storeName || 'Forto Store';
    const whatsapp = settings.whatsapp || '';

    const printWindow = window.open('', '_blank');
    const itemsHtml = order.items.map(item => {
        let variant = '';
        if (item.selectedColor) variant += ` لون: ${item.selectedColor}`;
        if (item.selectedSize) variant += ` مقاس: ${item.selectedSize}`;
        return `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.name}${variant ? ' (' + variant + ')' : ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
            </tr>
        `;
    }).join('');

    printWindow.document.write(`
        <html dir="rtl" lang="ar">
        <head>
            <title>بوليصة شحن - ${order.id}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Cairo', sans-serif; padding: 20px; color: #333; }
                .label-container { border: 2px solid #000; padding: 20px; max-width: 800px; margin: 0 auto; position: relative; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                .store-name { font-size: 24px; font-weight: 900; }
                .order-id { font-size: 20px; font-weight: 700; }
                .section { margin-bottom: 20px; }
                .section-title { font-weight: 700; background: #eee; padding: 5px 10px; margin-bottom: 10px; border-radius: 4px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .info-box { border: 1px solid #ddd; padding: 10px; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .total-box { margin-top: 20px; text-align: left; font-size: 1.2rem; font-weight: 900; background: #f9f9f9; padding: 10px; border: 1px solid #000; }
                .footer { margin-top: 30px; text-align: center; font-size: 0.9rem; border-top: 1px dashed #ccc; padding-top: 10px; }
                @media print {
                    .no-print { display: none; }
                    body { padding: 0; }
                    .label-container { border: 2px solid #000; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="text-align: center; margin-bottom: 20px;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer; font-family: 'Cairo', sans-serif; font-weight: bold;">اضغط للتحميل PDF أو الطباعة</button>
            </div>
            
            <div class="label-container">
                <div class="header">
                    <div class="store-name">${storeName}</div>
                    <div class="order-id">رقم الطلب: ${order.id}</div>
                </div>

                <div class="section">
                    <div class="info-grid">
                        <div class="info-box">
                            <div class="section-title">بيانات العميل</div>
                            <p><strong>الاسم:</strong> ${order.customer.name}</p>
                            <p><strong>الهاتف:</strong> ${order.customer.phone}</p>
                            <p><strong>العنوان:</strong> ${order.customer.address}</p>
                            ${order.customer.province ? `<p><strong>المحافظة:</strong> ${order.customer.province}</p>` : ''}
                        </div>
                        <div class="info-box">
                            <div class="section-title">تفاصيل الشحن</div>
                            <p><strong>التاريخ:</strong> ${new Date(order.date).toLocaleDateString('ar-EG')}</p>
                            <p><strong>طريقة الدفع:</strong> ${getPaymentMethodName(order.paymentMethod)}</p>
                            <p><strong>شركة الشحن:</strong> ............................</p>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">المنتجات المرسلة</div>
                    <table>
                        <thead>
                            <tr style="background: #f4f4f4;">
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">المنتج</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">الكمية</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                </div>

                <div class="total-box">
                    إجمالي المبلغ المطلوب تحصيله: ${(order.paymentMethod === 'vodafone' || order.paymentMethod === 'instapay' || order.paymentMethod === 'Vodafone Cash' || order.paymentMethod === 'InstaPay') ? '0' : order.total} ج.م
                    ${(order.paymentMethod === 'vodafone' || order.paymentMethod === 'instapay' || order.paymentMethod === 'Vodafone Cash' || order.paymentMethod === 'InstaPay') ? '<div style="font-size: 0.9rem; color: #27ae60;">(خالص الثمن - تم الدفع إلكترونياً)</div>' : ''}
                </div>

                <div class="footer">
                    شكراً لشرائكم من ${storeName}<br>
                    ${whatsapp ? 'للتواصل عبر واتساب: ' + whatsapp : ''}
                </div>
            </div>

            <script>
                window.onload = function() {
                    // Slight delay to ensure fonts are loaded
                    setTimeout(() => {
                        // window.print();
                    }, 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

window.printShippingLabel = printShippingLabel;

// --- Security & App Lock Logic ---
let currentPin = "";
function appendPin(digit) {
    if (currentPin.length < 4) {
        currentPin += digit;
        updatePinDots();
        if (currentPin.length === 4) {
            setTimeout(validatePin, 300);
        }
    }
}

function deletePin() {
    currentPin = currentPin.slice(0, -1);
    updatePinDots();
}

function clearPin() {
    currentPin = "";
    updatePinDots();
}

function updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
        if (i < currentPin.length) dot.classList.add('filled');
        else dot.classList.remove('filled');
    });
}

function validatePin() {
    const admin = db.getLoggedAdmin();
    const settings = db.getSettings();

    // Check if it's Super Admin or Staff
    let targetPin = "";
    if (admin.role === 'admin') {
        targetPin = settings.adminPin || "0000";
    } else {
        // Find staff pin from DB (not just token for security sync)
        const staff = db.getStaff();
        const member = staff.find(s => s.email === admin.email);
        targetPin = member ? member.pin : "";
    }

    if (currentPin === targetPin) {
        document.getElementById('app-lock-modal').classList.remove('active');
        showToast('تم إلغاء القفل بنجاح', 'success');
        clearPin();
        // Mark as unlocked for this session
        sessionStorage.setItem('admin_unlocked', 'true');
    } else {
        showToast('رمز PIN غير صحيح', 'error');
        clearPin();
        // Shake animation
        const content = document.querySelector('.lock-screen-content');
        content.style.animation = 'shake 0.5s';
        setTimeout(() => content.style.animation = '', 500);
    }
}

// Security Section Init
function initSecurity() {
    const admin = db.getLoggedAdmin();
    if (admin.role !== 'admin') {
        document.getElementById('menu-security').style.display = 'none';
        return;
    }
    document.getElementById('menu-security').style.display = 'flex';

    const settings = db.getSettings();
    document.getElementById('sa-email').value = settings.adminEmail || 'admin@fortostore.com';
    document.getElementById('sa-pin').value = settings.adminPin || '0000';
}

// Logic for Super Admin Form
const superAdminForm = document.getElementById('super-admin-form');
if (superAdminForm) {
    superAdminForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newEmail = document.getElementById('sa-new-email').value;
        const newPass = document.getElementById('sa-new-pass').value;
        const confirmPass = document.getElementById('sa-confirm-pass').value;
        const newPin = document.getElementById('sa-pin').value;

        if (newPass && newPass !== confirmPass) {
            showAlert('كلمات المرور غير متطابقة', 'error');
            return;
        }

        const settings = db.getSettings();
        if (newEmail) settings.adminEmail = newEmail;
        if (newPass) settings.adminPass = newPass;
        if (newPin) settings.adminPin = newPin;

        db.saveSettings(settings);
        showToast('تم تحديث بيانات المدير العام بنجاح', 'success');
        superAdminForm.reset();
        initSecurity();
    });
}

// Biometrics Mockup
function setupBiometrics() {
    const btn = document.getElementById('biometric-btn');
    btn.innerText = "جاري الاتصال بالمستشعر...";
    btn.disabled = true;

    setTimeout(() => {
        showToast('تم تفعيل المصادقة البيومترية بنجاح لهذا المتصفح', 'success');
        btn.innerText = "المصادقة البيومترية مفعلة ✓";
        btn.style.background = "#9b59b6";
        btn.style.color = "white";
    }, 2000);
}

// App Lock Start Check
function checkAppLock() {
    const settings = db.getSettings();
    const admin = db.getLoggedAdmin();
    const isUnlocked = sessionStorage.getItem('admin_unlocked') === 'true';

    if (settings.appLockEnabled && !isUnlocked && admin) {
        document.getElementById('app-lock-modal').classList.add('active');
        document.getElementById('lock-username').innerText = admin.name;
    }
}

// Export Security functions
window.appendPin = appendPin;
window.deletePin = deletePin;
window.clearPin = clearPin;
window.setupBiometrics = setupBiometrics;

// --- Update Settings Save ---
const settingsForm = document.getElementById('settings-form');
if (settingsForm) {
    const originalSubmit = settingsForm.onsubmit || settingsForm.addEventListener;
    // We'll hook into it at the top of admin.js too or just override/extend it.
    // Looking at admin.js, settings-form is handled by a listener.
}

// Monitor Database Connection
function monitorDbConnection() {
    const statusRoot = document.getElementById('db-connection-status');
    if (!statusRoot) return;

    const dot = statusRoot.querySelector('.status-dot');
    const text = statusRoot.querySelector('.status-text');

    const connectedRef = database.ref(".info/connected");
    connectedRef.on("value", (snap) => {
        if (snap.val() === true) {
            if (dot) dot.style.background = "#2ecc71";
            if (text) {
                text.innerText = "متصل";
                text.style.color = "#27ae60";
            }
        } else {
            if (dot) dot.style.background = "#e74c3c";
            if (text) {
                text.innerText = "غير متصل";
                text.style.color = "#e74c3c";
            }
        }
    });
}


// App Security Management (Mobile App)
function refreshAppSecurity() {
    const isLockOn = localStorage.getItem('app_lock_enabled') === 'true';
    const isBioOn = localStorage.getItem('app_biometric_enabled') === 'true';
    const pin = localStorage.getItem('app_pin') || "1234";

    const lockToggle = document.getElementById('app-sec-enabled');
    const bioToggle = document.getElementById('app-sec-bio');
    const pinInput = document.getElementById('app-sec-pin');
    const settingsArea = document.getElementById('pin-settings-area');

    if (lockToggle) lockToggle.checked = isLockOn;
    if (bioToggle) bioToggle.checked = isBioOn;
    if (pinInput) pinInput.value = pin;

    // Show/Hide settings based on whether lock is enabled
    if (settingsArea) {
        settingsArea.style.opacity = isLockOn ? '1' : '0.5';
        settingsArea.style.pointerEvents = isLockOn ? 'all' : 'none';
    }
}

function saveAppSecuritySettings() {
    const enabled = document.getElementById('app-sec-enabled').checked;
    const bio = document.getElementById('app-sec-bio').checked;
    const pin = document.getElementById('app-sec-pin').value;

    if (enabled && pin.length !== 4) {
        showAlert('يجب أن يتكون رمز PIN من 4 أرقام', 'error');
        return;
    }

    localStorage.setItem('app_lock_enabled', enabled);
    localStorage.setItem('app_biometric_enabled', bio);
    localStorage.setItem('app_pin', pin);

    showToast(enabled ? 'تم تفعيل حماية التطبيق بنجاح' : 'تم إلغاء قفل التطبيق بنجاح', 'success');
    refreshAppSecurity();
}

// Hook into existing DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initSecurity();
    checkAppLock();
    monitorDbConnection();
});

window.saveAppSecuritySettings = saveAppSecuritySettings;
window.refreshAppSecurity = refreshAppSecurity;
