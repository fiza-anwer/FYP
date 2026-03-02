import { useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import DataGrid, { type DataGridColumn } from "../components/common/DataGrid";
import { tenantApi, type Product } from "../api/client";
import Label from "../components/form/Label";
import Input from "../components/form/input/InputField";

export default function ProductOperations() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formType, setFormType] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await tenantApi.getProducts();
      setProducts(Array.isArray(res?.products) ? res.products : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormTitle("");
    setFormSku("");
    setFormType("");
    setFormPrice("");
    setFormStatus("active");
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setFormTitle(p.title);
    setFormSku(p.sku ?? "");
    setFormType(p.product_type ?? "");
    setFormPrice(p.price != null ? String(p.price) : "");
    setFormStatus(p.status ?? "active");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    if (!title) {
      setError("Product name is required");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const price =
        formPrice.trim() === "" ? undefined : Number.isNaN(Number(formPrice)) ? undefined : Number(formPrice);
      if (editing) {
        await tenantApi.updateProduct(editing.id, {
          title,
          sku: formSku.trim() || undefined,
          product_type: formType.trim() || undefined,
          price,
          status: formStatus.trim() || undefined,
        });
      } else {
        await tenantApi.createProduct({
          title,
          sku: formSku.trim() || undefined,
          product_type: formType.trim() || undefined,
          price,
          status: formStatus.trim() || undefined,
          source: "local",
        });
      }
      await load();
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!window.confirm(`Delete product "${p.title}"?`)) return;
    setError("");
    try {
      await tenantApi.deleteProduct(p.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

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
      key: "status",
      label: "Status",
      render: (v) => String(v || "active"),
    },
    {
      key: "source",
      label: "Source",
      render: (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1).toLowerCase() : "—"),
    },
    {
      key: "id",
      label: "Actions",
      render: (_, row) => (
        <span className="inline-flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => openEdit(row)}
            className="font-medium text-brand-500 hover:text-brand-600"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row)}
            className="font-medium text-red-500 hover:text-red-600"
          >
            Delete
          </button>
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageMeta
        title="Product operations | UniSell"
        description="Add, edit and delete products in your catalog."
      />
      <PageBreadcrumb pageTitle="Product operations" />

      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-500 hover:bg-brand-600"
          >
            Add product
          </button>
        </div>
        <DataGrid
          columns={columns}
          data={products}
          keyExtractor={(p) => p.id}
          emptyMessage="No products yet. Use Add product to create local products, or let your store integrations sync them."
          loading={loading}
        />
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold dark:text-white">
              {editing ? "Edit product" : "Add product"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Product name</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Blue T-shirt"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="e.g. SHIRT-BLUE-S"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Input
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    placeholder="e.g. T-shirt"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price</Label>
                  <Input
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="e.g. 19.99"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Input
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    placeholder="e.g. active"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

