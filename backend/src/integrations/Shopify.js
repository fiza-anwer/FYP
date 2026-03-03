/**
 * Shopify integration: fetch orders from store via Admin API.
 * credentials: { shop_domain, access_token } or { shop, x_shopify_token } etc.
 * Shop domain should be e.g. "your-store.myshopify.com" (without https).
 */
const SHOPIFY_API_VERSION = "2024-01";

/** Normalize credentials so we accept various keys used in UI/DB (access_token, x-shopify-token, shop_domain, shop, etc.). */
function normalizeShopifyCredentials(credentials) {
  if (!credentials || typeof credentials !== "object") {
    return { shop_domain: "", access_token: "" };
  }
  const shop_domain = (
    credentials.shop_domain ??
    credentials.shop ??
    credentials.store_url ??
    credentials.store ??
    ""
  )
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const access_token = (
    credentials.access_token ??
    credentials.x_shopify_token ??
    credentials["x-shopify-token"] ??
    credentials.token ??
    ""
  ).trim();
  return { shop_domain, access_token };
}

export class ShopifyIntegration {
  static slug = "shopify";

  /**
   * Fetch orders from Shopify store. Returns array of normalized order objects.
   * @param {Object} credentials - { shop_domain, access_token } or { shop, x_shopify_token } etc.
   * @returns {Promise<Array<{ external_id: string, order_number: string|number, email: string, total: number, financial_status: string, fulfillment_status: string, raw: object }>>}
   */
  static async fetchOrders(credentials) {
    const { shop_domain, access_token } = normalizeShopifyCredentials(credentials);
    if (!shop_domain || !access_token) {
      throw new Error("Shopify credentials missing: need shop_domain (or shop) and access_token (or x-shopify-token)");
    }
    const url = `https://${shop_domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const orders = data.orders || [];
    return orders.map((o) => ({
      external_id: String(o.id),
      order_number: o.order_number || o.name || o.id,
      email: o.email || "",
      total: parseFloat(o.total_price) || 0,
      financial_status: o.financial_status || "",
      fulfillment_status: o.fulfillment_status || "unfulfilled",
      raw: o,
      source: "shopify",
    }));
  }

  /**
   * Fetch products from Shopify store. Returns array of normalized product objects.
   * @param {Object} credentials - { shop_domain, access_token } or similar.
   * @returns {Promise<Array<{ external_id: string, title: string, sku?: string, price?: number, product_type?: string, status?: string, source?: string, raw: object, variants?: Array<{ id: string, sku?: string, title?: string, price?: number, inventory_quantity?: number }> }>>}
   */
  static async fetchProducts(credentials) {
    const { shop_domain, access_token } = normalizeShopifyCredentials(credentials);
    if (!shop_domain || !access_token) {
      throw new Error(
        "Shopify credentials missing: need shop_domain (or shop) and access_token (or x-shopify-token)"
      );
    }
    const url = `https://${shop_domain}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=250`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify products API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const products = data.products || [];
    return products.map((p) => {
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const first = variants[0] || {};
      return {
        external_id: String(p.id),
        title: p.title || "",
        sku: first.sku || "",
        price: first.price ? parseFloat(first.price) || 0 : undefined,
        product_type: p.product_type || "",
        status: p.status || "active",
        source: "shopify",
        raw: p,
        variants: variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          title: v.title,
          option1: v.option1,
          price: v.price ? parseFloat(v.price) || 0 : undefined,
          inventory_quantity: v.inventory_quantity,
        })),
      };
    });
  }

  /**
   * Create a fulfillment for an order with tracking (dispatch to channel).
   * @param {Object} credentials - { shop_domain: string, access_token: string }
   * @param {string} shopifyOrderId - Shopify order id (external_id)
   * @param {string} trackingNumber - Tracking number
   * @param {string} [trackingUrl] - Optional tracking URL
   * @returns {Promise<{ success: boolean, fulfillment_id?: string }>}
   */
  static async fulfillOrder(credentials, shopifyOrderId, trackingNumber, trackingUrl) {
    const { shop_domain, access_token } = normalizeShopifyCredentials(credentials);
    if (!shop_domain || !access_token) {
      throw new Error("Shopify credentials missing: need shop_domain (or shop) and access_token (or x-shopify-token). Check the company integration has the correct Shopify token.");
    }
    if (!shopifyOrderId || !trackingNumber) {
      throw new Error("shopifyOrderId and trackingNumber are required");
    }

    const base = `https://${shop_domain}/admin/api/${SHOPIFY_API_VERSION}`;
    const headers = {
      "X-Shopify-Access-Token": access_token,
      "Content-Type": "application/json",
    };

    // Get fulfillment orders for this order
    const forRes = await fetch(
      `${base}/orders/${shopifyOrderId}/fulfillment_orders.json`,
      { method: "GET", headers }
    );
    if (!forRes.ok) {
      const text = await forRes.text();
      throw new Error(`Shopify fulfillment_orders error ${forRes.status}: ${text.slice(0, 300)}`);
    }
    const forData = await forRes.json();
    const fulfillmentOrders = forData.fulfillment_orders || [];
    const toFulfill = fulfillmentOrders.filter((fo) => fo.status === "open" || fo.status === "scheduled");
    if (toFulfill.length === 0) {
      const statuses = [...new Set(fulfillmentOrders.map((fo) => fo.status).filter(Boolean))];
      if (statuses.length > 0) {
        if (statuses.every((s) => s === "closed" || s === "cancelled")) {
          throw new Error("This order is already fulfilled or cancelled in Shopify. No open fulfillment to update.");
        }
        throw new Error(`Shopify has no open fulfillment for this order (statuses: ${statuses.join(", ")}). It may already be fulfilled.`);
      }
      throw new Error("Shopify returned no fulfillment orders. The order may be a draft, cancelled, or already fulfilled in your store.");
    }

    const fo = toFulfill[0];
    const lineItems = (fo.line_items || [])
      .map((li) => {
        const qty = Math.max(1, parseInt(li.fulfillable_quantity ?? li.quantity ?? 1, 10) || 1);
        return { id: li.id, quantity: qty };
      })
      .filter((li) => li.quantity > 0);
    if (lineItems.length === 0) {
      throw new Error("No fulfillable line items in this fulfillment order");
    }

    const payload = {
      fulfillment: {
        line_items_by_fulfillment_order: [
          { fulfillment_order_id: fo.id, fulfillment_order_line_items: lineItems },
        ],
        tracking_info: {
          number: trackingNumber,
          company: "DHL",
          ...(trackingUrl && { url: trackingUrl }),
        },
        notify_customer: true,
      },
    };

    const createRes = await fetch(`${base}/fulfillments.json`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Shopify create fulfillment error ${createRes.status}: ${text.slice(0, 300)}`);
    }
    const createData = await createRes.json();
    return { success: true, fulfillment_id: createData.fulfillment?.id };
  }

  /**
   * Create a product on Shopify.
   * @param {Object} credentials - { shop_domain, access_token }
   * @param {Object} productData - { title, body_html?, vendor?, product_type?, status?, variants?: [{ price?, sku?, option1? }] }
   * @returns {Promise<{ id: string }>} Shopify product id
   */
  static async createProduct(credentials, productData) {
    const { shop_domain, access_token } = normalizeShopifyCredentials(credentials);
    if (!shop_domain || !access_token) {
      throw new Error("Shopify credentials missing: need shop_domain and access_token");
    }
    const base = `https://${shop_domain}/admin/api/${SHOPIFY_API_VERSION}`;
    const headers = {
      "X-Shopify-Access-Token": access_token,
      "Content-Type": "application/json",
    };
    const variants = Array.isArray(productData.variants) ? productData.variants : [];
    const productPayload = {
      title: productData.title || "Untitled",
      body_html: productData.body_html || productData.description || "",
      product_type: productData.product_type || "",
      status: productData.status === "active" || productData.status === "published" ? "active" : "draft",
      variants: variants.length > 0
        ? variants.map((v) => ({
            price: v.price != null ? String(v.price) : undefined,
            sku: v.sku || undefined,
            option1: v.option1 || v.title || undefined,
          }))
        : [{ price: productData.price != null ? String(productData.price) : "0" }],
    };
    const res = await fetch(`${base}/products.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({ product: productPayload }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify create product error ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    const id = data.product?.id;
    if (!id) throw new Error("Shopify did not return product id");
    return { id: String(id) };
  }

  /**
   * Update a product on Shopify (product-level fields and/or variants).
   * @param {Object} credentials - { shop_domain, access_token }
   * @param {string} shopifyProductId - Shopify product id (external_id)
   * @param {Object} productData - { title?, body_html?, product_type?, status?, variants?: Array<{ id: string, sku?, price?, option1? }> }
   */
  static async updateProduct(credentials, shopifyProductId, productData) {
    const { shop_domain, access_token } = normalizeShopifyCredentials(credentials);
    if (!shop_domain || !access_token) {
      throw new Error("Shopify credentials missing: need shop_domain and access_token");
    }
    if (!shopifyProductId) throw new Error("shopifyProductId is required");
    const base = `https://${shop_domain}/admin/api/${SHOPIFY_API_VERSION}`;
    const headers = {
      "X-Shopify-Access-Token": access_token,
      "Content-Type": "application/json",
    };

    // Update each variant that has a Shopify variant id (so changes show on store)
    const variants = Array.isArray(productData.variants) ? productData.variants : [];
    for (const v of variants) {
      const variantId = v.id != null ? String(v.id) : null;
      if (!variantId) continue;
      const variantPayload = {};
      if (v.price !== undefined && v.price !== null) variantPayload.price = String(v.price);
      if (v.sku !== undefined && v.sku !== null) variantPayload.sku = String(v.sku);
      if (v.option1 !== undefined && v.option1 !== null) variantPayload.option1 = String(v.option1);
      if (Object.keys(variantPayload).length === 0) continue;
      const vRes = await fetch(`${base}/variants/${variantId}.json`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ variant: variantPayload }),
      });
      if (!vRes.ok) {
        const text = await vRes.text();
        throw new Error(`Shopify update variant ${variantId} error ${vRes.status}: ${text.slice(0, 200)}`);
      }
    }

    // Update product-level fields
    const productPayload = {};
    if (productData.title !== undefined) productPayload.title = productData.title;
    if (productData.body_html !== undefined) productPayload.body_html = productData.body_html;
    if (productData.description !== undefined) productPayload.body_html = productData.description;
    if (productData.product_type !== undefined) productPayload.product_type = productData.product_type;
    if (productData.status !== undefined)
      productPayload.status = productData.status === "active" || productData.status === "published" ? "active" : "draft";
    if (Object.keys(productPayload).length === 0) return;
    const res = await fetch(`${base}/products/${shopifyProductId}.json`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ product: productPayload }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify update product error ${res.status}: ${text.slice(0, 300)}`);
    }
  }

  /**
   * Delete a product on Shopify.
   * @param {Object} credentials - { shop_domain, access_token }
   * @param {string} shopifyProductId - Shopify product id (external_id)
   */
  static async deleteProduct(credentials, shopifyProductId) {
    const { shop_domain, access_token } = normalizeShopifyCredentials(credentials);
    if (!shop_domain || !access_token) {
      throw new Error("Shopify credentials missing: need shop_domain and access_token");
    }
    if (!shopifyProductId) throw new Error("shopifyProductId is required");
    const base = `https://${shop_domain}/admin/api/${SHOPIFY_API_VERSION}`;
    const headers = { "X-Shopify-Access-Token": access_token };
    const res = await fetch(`${base}/products/${shopifyProductId}.json`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify delete product error ${res.status}: ${text.slice(0, 300)}`);
    }
  }
}
