import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Menu, MenuItem, MenuButton } from "@/components/ui/Menu"; // Assume you have a Menu component
import { database, auth } from "./firebase";
import { ref, onValue, push, set, remove, update } from "firebase/database";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";

export default function CustomerManager() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [user, setUser] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);


  // Fetch customers from Firebase
  useEffect(() => {
    const custRef = ref(database, "customers");
    onValue(custRef, (snapshot) => {
      const data = snapshot.val() || {};
      // Convert object to array with id
      const arr = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      setCustomers(arr);
    });
  }, []);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  if (!user) return <Login />;

  // Filtered customers
  const filtered = customers.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  // Handlers
  const openCreate = () => {
    setEditingCustomer(null);
    setForm({ name: "", phone: "", address: "" });
    setShowDialog(true);
  };

  const openEdit = (cust) => {
    setEditingCustomer(cust);
    setForm({ name: cust.name, phone: cust.phone, address: cust.address });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this customer?")) {
      await remove(ref(database, `customers/${id}`));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      alert("Name and Phone are required");
      return;
    }
    if (editingCustomer) {
      // Edit existing
      await update(ref(database, `customers/${editingCustomer.id}`), form);
    } else {
      // Create new
      const newRef = push(ref(database, "customers"));
      await set(newRef, form);
    }
    setShowDialog(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by name or phone"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64 outline rounded-lg px-2 py-1"
        />
        <Button onClick={openCreate}>New</Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => signOut(auth)}>Logout</Button>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Address</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
                {filtered.map(cust => (
                <tr key={cust.id}>
                    <td className="px-1">{cust.name}</td>
                    <td className="px-1">{cust.phone}</td>
                    <td className="px-1">{cust.address}</td>
                    <td className="relative">
                    {/* Three dots button */}
                    <button
                        className="p-2 rounded"
                        onClick={e => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === cust.id ? null : cust.id);
                        }}
                    >
                        ⋯
                    </button>
                    {/* Only show menu for the matching row */}
                    {openMenuId === cust.id && (
                        <div className="absolute right-0 mt-2 min-w-[120px] rounded shadow-lg bg-black/50 border z-50">
                        <button
                            className="block w-full text-left px-4 py-2"
                            onClick={() => {
                            setOpenMenuId(null);
                            openEdit(cust);
                            }}
                        >
                            Edit
                        </button>
                        <button
                            className="block w-full text-left px-4 py-2"
                            onClick={() => {
                            setOpenMenuId(null);
                            handleDelete(cust.id);
                            }}
                        >
                            Delete
                        </button>
                        </div>
                    )}
                    </td>
                </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <h2 className="text-xl font-bold mb-4">
            {editingCustomer ? "Edit Customer" : "Create New Customer"}
          </h2>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Customer Name"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Phone Number"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Address"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave}>
              {editingCustomer ? "Save Changes" : "Create"}
            </Button>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
