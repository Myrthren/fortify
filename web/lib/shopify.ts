// Shopify Admin REST API helpers
// Requires a Custom App access token with read_orders, read_products, read_customers, read_inventory

// Keep this configurable so the API version can be advanced without a code deploy.
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-10";

function shopifyUrl(shop: string, path: string) {
  if (path.startsWith("https://")) return path;
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

async function shopifyFetchAll<T>(shop: string, token: string, path: string, key: string): Promise<T[]> {
  const values: T[] = [];
  let nextPath: string | null = path;
  while (nextPath) {
    const res = await fetch(shopifyUrl(shop, nextPath), {
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Shopify ${nextPath}: ${await res.text()}`);
    const body = await res.json() as Record<string, T[]>;
    values.push(...(body[key] ?? []));
    const link = res.headers.get("link");
    const next = link?.match(/<([^>]+)>;\s*rel="next"/i)?.[1];
    nextPath = next ?? null;
  }
  return values;
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

  const [ordersRes, customerCountRes, productCountRes, shopInfoRes] = await Promise.all([
    shopifyFetchAll<ShopifyOrder>(
      shop, token,
      `/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250&fields=id,total_price,created_at,line_items`,
      "orders"
    ),
    shopifyFetch<{ count: number }>(shop, token, "/customers/count.json"),
    shopifyFetch<{ count: number }>(shop, token, "/products/count.json"),
    shopifyFetch<{ shop: { currency: string } }>(shop, token, "/shop.json"),
  ]);

  const orders: ShopifyOrder[] = ordersRes;
  const customerCount = customerCountRes.count;
  const productCount = productCountRes.count;
  const currency = shopInfoRes.shop.currency;

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

/** Get total revenue (paid orders) between two dates */
export async function getRevenueForPeriod(
  shop: string,
  token: string,
  since: Date,
  until?: Date
): Promise<{ revenue: number; orderCount: number; currency: string }> {
  type Order = { total_price: string; currency: string };
  const params = new URLSearchParams({
    status: "any",
    financial_status: "paid",
    created_at_min: since.toISOString(),
    limit: "250",
    fields: "total_price,currency",
  });
  if (until) params.set("created_at_max", until.toISOString());

  const orders = await shopifyFetchAll<Order>(shop, token, `/orders.json?${params.toString()}`, "orders");
  const revenue = orders.reduce((s, o) => s + Number(o.total_price), 0);
  return { revenue, orderCount: orders.length, currency: orders[0]?.currency ?? "USD" };
}

/** Verify credentials by hitting the shop endpoint */
export async function verifyShopifyCredentials(shop: string, token: string): Promise<string> {
  const data = await shopifyFetch<{ shop: { name: string } }>(shop, token, "/shop.json");
  return data.shop.name;
}

// ── Low stock ──────────────────────────────────────────────────────────────────

export type LowStockProduct = {
  title: string;
  variant: string | null; // variant title if not "Default Title"
  quantity: number;
  productId: number;
};

export async function getOutOfStockProducts(
  shop: string,
  token: string
): Promise<LowStockProduct[]> {
  type ShopifyVariant = {
    title: string;
    inventory_quantity: number;
    inventory_management: string | null;
  };
  type ShopifyProduct = {
    id: number;
    title: string;
    variants: ShopifyVariant[];
  };

  const products = await shopifyFetchAll<ShopifyProduct>(shop, token,
    `/products.json?limit=250&fields=id,title,variants`, "products");

  const out: LowStockProduct[] = [];
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      if (
        variant.inventory_management === "shopify" &&
        variant.inventory_quantity <= 0
      ) {
        out.push({
          title: product.title,
          variant: variant.title !== "Default Title" ? variant.title : null,
          quantity: 0,
          productId: product.id,
        });
      }
    }
  }
  return out;
}

export async function getLowStockProducts(
  shop: string,
  token: string,
  threshold = 5
): Promise<LowStockProduct[]> {
  type ShopifyVariant = {
    title: string;
    inventory_quantity: number;
    inventory_management: string | null;
  };
  type ShopifyProduct = {
    id: number;
    title: string;
    variants: ShopifyVariant[];
  };

  const products = await shopifyFetchAll<ShopifyProduct>(shop, token,
    `/products.json?limit=250&fields=id,title,variants`, "products");

  const low: LowStockProduct[] = [];
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      // Only alert on tracked inventory that's low but not fully out of stock (0 = separate alert)
      if (
        variant.inventory_management === "shopify" &&
        variant.inventory_quantity > 0 &&
        variant.inventory_quantity <= threshold
      ) {
        low.push({
          title: product.title,
          variant: variant.title !== "Default Title" ? variant.title : null,
          quantity: variant.inventory_quantity,
          productId: product.id,
        });
      }
    }
  }
  return low;
}
