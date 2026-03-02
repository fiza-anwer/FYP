import { useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import DataGrid, { type DataGridColumn } from "../components/common/DataGrid";
import { tenantApi, type Product } from "../api/client";

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    setLoading(true);
    tenantApi
      .getProducts()
      .then((res) => {
        if (cancelled) return;
        setProducts(Array.isArray(res?.products) ? res.products : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load products");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const columns: DataGridColumn<Product>[] = [
    { key: "title", label: "Product", render: (v) => String(v || "—") },
    { key: "sku", label: "SKU", render: (v) => String(v || "—") },
    { key: "product_type", label: "Type", render: (v) => String(v || "—") },
    {
      key: "price",
      label: "Price",
      align: "right",
      render: (v) => (typeof v === "number" ? v.toFixed(2) : v ?? "—"),
    },
    {
      key: "variant_count",
      label: "Variants",
      align: "right",
      render: (v) => (typeof v === "number" ? v : v ?? 0),
    },
    {
      key: "status",
      label: "Status",
      render: (v) => String(v || "active"),
    },
    {
      key: "source",
      label: "Source",
      render: (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1).toLowerCase() : "—"),
    },
  ];

  return (
    <div>
      <PageMeta title="Products | UniSell" description="All products from your connected stores and local catalog." />
      <PageBreadcrumb pageTitle="Products" />

      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <DataGrid
          columns={columns}
          data={products}
          keyExtractor={(p) => p.id}
          emptyMessage="No products yet. Products will appear here after your store integrations sync them or you create local products."
          loading={loading}
        />
      </div>
    </div>
  );
}

