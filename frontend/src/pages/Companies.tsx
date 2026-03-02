import { useState, useEffect } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import DataGrid, { type DataGridColumn } from "../components/common/DataGrid";
import { tenantApi, type Company } from "../api/client";
import Label from "../components/form/Label";
import Input from "../components/form/input/InputField";

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress1, setFormAddress1] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formCountryCode, setFormCountryCode] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError("");
    try {
      const res = await tenantApi.getCompanies();
      setCompanies(Array.isArray(res?.companies) ? res.companies : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormAddress1("");
    setFormCity("");
    setFormPostalCode("");
    setFormCountryCode("");
    setModalOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setFormName(c.name);
    const a = c.address;
    setFormAddress1(a?.address1 ?? "");
    setFormCity(a?.city ?? "");
    setFormPostalCode(a?.postal_code ?? "");
    setFormCountryCode(a?.country_code ?? "");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      setError("Company name is required");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const body = {
        name,
        address1: formAddress1.trim() || undefined,
        city: formCity.trim() || undefined,
        postal_code: formPostalCode.trim() || undefined,
        country_code: formCountryCode.trim().substring(0, 2).toUpperCase() || undefined,
      };
      if (editing) {
        await tenantApi.updateCompany(editing.id, body);
      } else {
        await tenantApi.createCompany(body);
      }
      closeModal();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Company) => {
    if (!confirm(`Delete company "${c.name}"?`)) return;
    setError("");
    try {
      await tenantApi.deleteCompany(c.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const columns: DataGridColumn<Company>[] = [
    {
      key: "name",
      label: "Company",
      render: (v) => <span className="font-medium text-gray-900 dark:text-white">{String(v ?? "—")}</span>,
    },
    {
      key: "address",
      label: "Address",
      render: (_, row) => {
        const a = row.address;
        if (!a || (!a.city && !a.country_code && !a.address1)) return <span className="text-gray-400">—</span>;
        const parts = [a.address1, a.city, a.postal_code, a.country_code].filter(Boolean);
        return <span className="text-sm text-gray-600 dark:text-gray-400">{parts.join(", ") || "—"}</span>;
      },
    },
    {
      key: "id",
      label: "Actions",
      align: "right",
      render: (_, row) => (
        <span className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => openEdit(row)}
            className="text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row)}
            className="text-sm font-medium text-red-500 hover:text-red-600 dark:text-red-400"
          >
            Delete
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Companies | UniSell" description="Manage companies." />
      <PageBreadcrumb pageTitle="Companies" />
      <div className="space-y-6">
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
            Add company
          </button>
        </div>
        <DataGrid
          columns={columns}
          data={companies}
          keyExtractor={(c) => c.id}
          emptyMessage="No companies yet. Click Add company to create one."
          loading={loading}
        />
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeModal}>
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold dark:text-white">{editing ? "Edit company" : "Add company"}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Company name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Acme Inc"
                  className="mt-1"
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Address (used as shipper/origin for DHL when creating consignments for this company’s orders)</p>
              <div>
                <Label>Address (street)</Label>
                <Input value={formAddress1} onChange={(e) => setFormAddress1(e.target.value)} placeholder="e.g. 123 High Street" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Input value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="e.g. London" className="mt-1" />
                </div>
                <div>
                  <Label>Postal code</Label>
                  <Input value={formPostalCode} onChange={(e) => setFormPostalCode(e.target.value)} placeholder="e.g. SW1A 1AA" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Country code</Label>
                <Input value={formCountryCode} onChange={(e) => setFormCountryCode(e.target.value)} placeholder="e.g. GB" className="mt-1" maxLength={2} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50">
                  {saving ? "Saving..." : editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
