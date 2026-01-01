/**
 * Cloudflare Products Adapter
 * Isolated Data Logic for Products
 */

const CF_WORKER_URL = "https://forto-store-worker.saifelsheikh320.workers.dev"; // ⚠️ REPLACE THIS
const CF_API_KEY = "forto_secret_2026";

class CloudProducts {
    static async fetchAll() {
        try {
            const res = await fetch(`${CF_WORKER_URL}/api/products`);
            if (!res.ok) throw new Error("Failed to fetch products");
            const products = await res.json();

            // Sync to LocalStorage for compatibility with existing UI
            localStorage.setItem('products', JSON.stringify(products));
            window.dispatchEvent(new Event('productsUpdated'));

            return products;
        } catch (e) {
            console.error("Cloudflare Fetch Error:", e);
            // Fallback to local if offline
            return JSON.parse(localStorage.getItem('products') || '[]');
        }
    }

    static async save(product, skipRefresh = false) {
        try {
            const method = product.id && this.exists(product.id) ? 'PUT' : 'POST';
            const url = product.id && this.exists(product.id)
                ? `${CF_WORKER_URL}/api/products/${product.id}`
                : `${CF_WORKER_URL}/api/products`;

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CF_API_KEY}`
                },
                body: JSON.stringify(product)
            });

            if (!res.ok) throw new Error("Save Failed");

            // Refresh local data after write unless skipped
            if (!skipRefresh) {
                await this.fetchAll();
            }
            return true;
        } catch (e) {
            console.error("Cloudflare Save Error:", e);
            alert("حدث خطأ أثناء حفظ المنتج في السحابة.");
            throw e;
        }
    }

    static async clearAll() {
        try {
            const res = await fetch(`${CF_WORKER_URL}/api/products/clear`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${CF_API_KEY}`
                }
            });

            if (!res.ok) throw new Error("Clear Failed");

            localStorage.setItem('products', JSON.stringify([]));
            window.dispatchEvent(new Event('productsUpdated'));
            return true;
        } catch (e) {
            console.error("Cloudflare Clear Error:", e);
            throw e;
        }
    }

    static async delete(id) {
        try {
            const res = await fetch(`${CF_WORKER_URL}/api/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${CF_API_KEY}`
                }
            });

            if (!res.ok) throw new Error("Delete Failed");

            await this.fetchAll();
            return true;
        } catch (e) {
            console.error("Cloudflare Delete Error:", e);
            alert("حدث خطأ أثناء حذف المنتج.");
            throw e;
        }
    }

    static exists(id) {
        const local = JSON.parse(localStorage.getItem('products') || '[]');
        return local.some(p => p.id == id);
    }
}

// Auto-run on load to populate cache
document.addEventListener('DOMContentLoaded', () => {
    CloudProducts.fetchAll();
});
