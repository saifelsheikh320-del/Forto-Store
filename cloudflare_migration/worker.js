export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // SECURITY: Simple API Key for Admin actions
    // In production, use env.ADMIN_API_KEY
    const API_KEY = env.ADMIN_API_KEY;
    const authHeader = request.headers.get('Authorization');
    const isAuthorized = authHeader === `Bearer ${API_KEY}`;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. PUBLIC: GET ALL PRODUCTS (Read from KV)
      if (method === 'GET' && path === '/api/products') {
        const cached = await env.PRODUCTS_KV.get('ALL_PRODUCTS', { type: 'json' });

        if (cached) {
          return new Response(JSON.stringify(cached), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Source': 'KV' }
          });
        }

        // Fallback: If KV is empty, read D1 and Sync
        const products = await syncD1ToKV(env);
        return new Response(JSON.stringify(products), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Source': 'D1-Sync' }
        });
      }

      // 2. ADMIN ONLY ROUTES (Require Auth)
      if (!isAuthorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // WRITE: Create Product
      if (method === 'POST' && path === '/api/products') {
        const p = await request.json();

        // Validate ID or generate one
        const id = p.id ? String(p.id) : String(Date.now());
        const now = Date.now();

        const query = `
          INSERT INTO products (id, name, price, old_price, quantity, category, colors, sizes, images, image, description, archived, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await env.DB.prepare(query).bind(
          id, p.name, p.price, p.oldPrice || null, p.quantity || 0, p.category,
          JSON.stringify(p.color || []), JSON.stringify(p.size || []), JSON.stringify(p.images || []), p.image || '',
          p.description || '', p.archived ? 1 : 0, now, now
        ).run();

        // Sync to KV
        await syncD1ToKV(env);

        return new Response(JSON.stringify({ success: true, id }), { headers: corsHeaders });
      }

      // WRITE: Update Product
      if (method === 'PUT' && path.startsWith('/api/products/')) {
        const id = path.split('/').pop();
        const p = await request.json();
        const now = Date.now();

        const query = `
          UPDATE products SET 
            name=?, price=?, old_price=?, quantity=?, category=?, colors=?, sizes=?, images=?, image=?, description=?, archived=?, updated_at=?
          WHERE id=?
        `;

        await env.DB.prepare(query).bind(
          p.name, p.price, p.oldPrice || null, p.quantity || 0, p.category,
          JSON.stringify(p.color || []), JSON.stringify(p.size || []), JSON.stringify(p.images || []), p.image || '',
          p.description || '', p.archived ? 1 : 0, now, id
        ).run();

        await syncD1ToKV(env);

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // WRITE: Clear All Products
      if (method === 'DELETE' && path === '/api/products/clear') {
        await env.DB.prepare('DELETE FROM products').run();
        await env.PRODUCTS_KV.delete('ALL_PRODUCTS');
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // WRITE: Delete Product
      if (method === 'DELETE' && path.startsWith('/api/products/')) {
        const id = path.split('/').pop();

        await env.DB.prepare('DELETE FROM products WHERE id=?').bind(id).run();

        await syncD1ToKV(env);

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

// --- HELPER: SYNC FUNCTION ---
async function syncD1ToKV(env) {
  // 1. Fetch all from D1
  const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC').all();

  // 2. Format for Frontend
  const formatted = results.map(row => ({
    id: row.id,
    name: row.name,
    price: row.price,
    oldPrice: row.old_price,
    quantity: row.quantity,
    category: row.category,
    color: JSON.parse(row.colors),
    size: JSON.parse(row.sizes),
    images: JSON.parse(row.images),
    image: row.image,
    description: row.description,
    archived: !!row.archived
  }));

  // 3. Put to KV
  await env.PRODUCTS_KV.put('ALL_PRODUCTS', JSON.stringify(formatted));

  return formatted;
}
