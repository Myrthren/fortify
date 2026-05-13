// Shopify Admin REST API helpers
// Requires a Custom App access token with read_orders, read_products, read_customers

const API_VERSION = "2024-01";

function shopifyUrl(shop: string, path: string) {
  const host = shop.includes(".") ? shop : `${shop}.myshopify.com`;
  return `https://${host}/admin/api/${API_VERSION}${path}`;
}

async function shopifyFetch<T>(shop: string, token: string, path: string): Promise<T> {
  const res = await fetch(shopifyUrl(shop, path), {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Shopify ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Revenue ────────────────────────────────────────────────────────────────────

export type ShopifyOrder = {
  id: number;
  total_price: string;
  created_at: string;
  financial_status: string;
  line_items: { title: string; quantity: number; price: string }[];
};

export type ShopifyData = {
  shop: string;
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  topProducts: { title: string; revenue: number; units: number }[];
  customerCount: number;
  productCount: number;
  currency: string;
};

export async function getShopifyData(shop: string, token: string, days = 30): Promise<ShopifyData> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [ordersRes, customerCountRes, productCountRes, shopInfoRes] = await Promise.allSettled([
    shopifyFetch<{ orders: ShopifyOrder[] }>(
      shop, token,
      `/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250&fields=id,total_price,created_at,line_items`
    ),
    shopifyFetch<{ count: number }>(shop, token, "/customers/count.json"),
    shopifyFetch<{ count: number }>(shop, token, "/products/count.json"),
    shopifyFetch<{ shop: { currency: string } }>(shop, token, "/shop.json"),
  ]);

  const orders: ShopifyOrder[] =
    ordersRes.status === "fulfilled" ? ordersRes.value.orders : [];
  const customerCount =
    customerCountRes.status === "fulfilled" ? customerCountRes.value.count : 0;
  const productCount =
    productCountRes.status === "fulfilled" ? productCountRes.value.count : 0;
  const currency =
    shopInfoRes.status === "fulfilled" ? shopInfoRes.value.shop.currency : "USD";

  // Revenue
  const revenue = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
  const orderCount = orders.length;
  const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

  // Top products
  const productMap = new Map<string, { revenue: number; units: number }>();
  for (const order of orders) {
    for (const item of order.line_items ?? []) {
      const existing = productMap.get(item.title) ?? { revenue: 0, units: 0 };
      productMap.set(item.title, {
        revenue: existing.revenue + Number(item.price) * item.quantity,
        units: existing.units + item.quantity,
      });
    }
  }
  const topProducts = [...productMap.entries()]
    .map(([title, data]) => ({ title, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  return { shop, revenue, orderCount, avgOrderValue, topProducts, customerCount, productCount, currency };
}

/** Verify credentials by hitting the shop endpoint */
export async function verifyShopifyCredentials(shop: string, token: string): Promise<string> {
  const data = await shopifyFetch<{ shop: { name: string } }>(shop, token, "/shop.json");
  return data.shop.name;
}
