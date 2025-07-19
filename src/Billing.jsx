// ✅ Final Billing Module (React Component with Tailwind CSS + Firebase)
import React, { useState, useEffect, useRef } from "react";
import { database } from "./firebase";
import { ref, onValue, push, set } from "firebase/database";
import html2canvas from "html2canvas-pro";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { format } from "date-fns";

export default function BillingModule() {
  // 📦 State
  const [customers, setCustomers] = useState([]);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderDate, setOrderDate] = useState("");
  const [mealType, setMealType] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState(30);

  const [menuItems, setMenuItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");

  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");

  const billRef = useRef(null);

  // 👤 New Customer
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });

  // 📡 Get Customers
  useEffect(() => {
    const unsub = onValue(ref(database, "customers"), snap => {
      const data = snap.val() || {};
      setCustomers(Object.entries(data).map(([id, v]) => ({ id, ...v })));
    });
    return () => unsub();
  }, []);

  // 📡 Load Menu
  useEffect(() => {
    if (!orderDate || !mealType) return;
    setMenuLoading(true);
    setMenuError("");
    const menuRef = ref(database, `menus/${orderDate}/${mealType}`);
    onValue(menuRef, snap => {
      const data = snap.val();
      if (Array.isArray(data)) {
        setMenuItems(data);
      } else {
        setMenuItems([]);
        setMenuError("⚠️ Menu not set for this date & meal.");
      }
      setMenuLoading(false);
    });
  }, [orderDate, mealType]);

  // ➕ Add/Update Quantity
  const updateItemQuantity = (item, quantity) => {
    if (quantity <= 0) {
      removeItem(item.name);
    } else {
      setSelectedItems(prev => {
        const exists = prev.find(i => i.name === item.name);
        if (exists) {
          return prev.map(i => i.name === item.name ? { ...i, quantity } : i);
        }
        return [...prev, { ...item, quantity }];
      });
    }
  };

  // ❌ Remove Item
  const removeItem = name => {
    setSelectedItems(items => items.filter(i => i.name !== name));
  };

  // 🧮 Totals
  const totalItemPrice = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const customItemValid = customItemName && customItemPrice;
  const customItemAmount = customItemValid ? Number(customItemPrice) : 0;
  const grandTotal = totalItemPrice + deliveryCharge + customItemAmount;

  // 💾 Confirm Order
  const handleConfirmOrder = async () => {
    if (!orderDate || !mealType || !selectedCustomer) {
      return alert("Select Date, Meal, and Customer.");
    }
    if (!selectedItems.length && !customItemValid) {
      return alert("Add at least one item or custom item.");
    }
    if ((customItemName && !customItemPrice) || (!customItemName && customItemPrice)) {
      return alert("Custom item needs both name and price.");
    }

    const finalItems = [...selectedItems];
    if (customItemValid) {
      finalItems.push({ name: customItemName, price: Number(customItemPrice), quantity: 1 });
    }

    const orderData = {
      date: orderDate,
      mealType,
      deliveryCharges: deliveryCharge,
      customerName: selectedCustomer.name,
      grandTotal,
      items: finalItems
    };

    // ✅ Save order to Database
    await push(ref(database, `customerOrderHistory/${selectedCustomer.id}/orders`), orderData);

    // 🧾 Save Bill Image
    if (billRef.current) {
      const canvas = await html2canvas(billRef.current);
      const file = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const fileName = `${format(new Date(orderDate), "ddMMyy")}_${mealType}_${selectedCustomer.name.replace(/\s+/g, "_")}.png`;
      link.href = file;
      link.download = fileName;
      link.click();
    }

    // 🔄 Reset
    setSelectedItems([]);
    setCustomItemName("");
    setCustomItemPrice("");
    setMealType("");
    setDeliveryCharge(30);
  };

  // 🧼 Clear
  const handleClear = () => {
    setOrderDate("");
    setSelectedCustomer(null);
    setMealType("");
    setSelectedItems([]);
    setCustomItemName("");
    setCustomItemPrice("");
    setDeliveryCharge(30);
  };

  // ➕ Save Customer
  const handleCreateCustomer = async () => {
    const { name, phone, address } = newCustomer;
    if (!name || !phone) return alert("Name & Phone required.");
    const id = name.toLowerCase().replace(/\s+/g, "_") + "_" + phone;
    await set(ref(database, `customers/${id}`), { name, phone, address });
    alert("✅ Customer added!");
    setShowNewCustomerModal(false);
    setNewCustomer({ name: "", phone: "", address: "" });
  };

  return (
    <div className="w-full max-w-xs mx-auto p-4 space-y-6 bg-[#181c23] text-white rounded-lg">
      {/* ➕ New Customer Modal Button */}
      <div className="text-right">
        <Button onClick={() => setShowNewCustomerModal(true)} className="bg-blue-600 text-white">
          + New Customer
        </Button>
      </div>

      {/* 📅 Date Picker */}
      <div>
        <Label>Date</Label>
        <Input
          type="date"
          value={orderDate}
          onChange={e => setOrderDate(e.target.value)}
          className="bg-[#23272f] text-white"
        />
      </div>

      {/* 👤 Customer */}
      {orderDate && (
        <div className="space-y-2">
          <Label>Customer</Label>
          <Input
            placeholder="Search customer..."
            value={searchCustomer}
            onChange={(e) => setSearchCustomer(e.target.value)}
            className="bg-[#23272f] text-white"
          />
          <select
            value={selectedCustomer?.id || ""}
            onChange={e => {
              setSelectedCustomer(customers.find(c => c.id === e.target.value));
              setSelectedItems([]);
              setMealType("");
            }}
            className="w-full p-2 rounded bg-[#23272f] text-white"
          >
            <option value="">-- Select Customer --</option>
            {customers
              .filter(c =>
                c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
                c.phone?.includes(searchCustomer)
              )
              .map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
          </select>

          {/* 🍽️ Meal Select */}
          {selectedCustomer && (
            <div className="mt-3">
              <Label>Meal</Label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full p-2 rounded bg-[#23272f] text-white"
              >
                <option value="">-- Select Meal --</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* 🍛 Menu Items */}
      {mealType && menuItems.length > 0 && (
        <div className="bg-[#23272f] p-3 rounded space-y-3">
          <Label>Items</Label>
          {menuItems.map(item => {
            const selected = selectedItems.find(i => i.name === item.name);
            return (
              <div key={item.name} className="flex items-center gap-2">
                <span className="flex-1">{item.name} (₹{item.price})</span>
                <Input
                  type="number"
                  className="w-14 bg-[#181c23] text-white"
                  value={selected?.quantity || ""}
                  onChange={e => updateItemQuantity(item, parseInt(e.target.value || 0))}
                />
                <Button onClick={() => removeItem(item.name)} className="bg-red-700">×</Button>
              </div>
            );
          })}
        </div>
      )}

      {/* ➕ Custom Item */}
      {selectedCustomer && (
        <div className="bg-[#23272f] p-3 rounded space-y-2 flex flex-col">
          <Label>Custom Item</Label>
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Item name"
              value={customItemName}
              onChange={e => setCustomItemName(e.target.value)}
              className="bg-[#181c23] text-white"
            />
            <Input
              placeholder="Price"
              type="number"
              value={customItemPrice}
              onChange={e => setCustomItemPrice(e.target.value)}
              className="bg-[#181c23] text-white"
            />
          </div>
        </div>
      )}

      {/* 🚚 Delivery & Total */}
      {selectedCustomer && (
        <div className="bg-[#23272f] p-3 rounded space-y-2">
          <Label>Delivery Charges</Label>
          <div className="space-y-1">
            <label><input type="radio" name="delivery" checked={deliveryCharge === 0} onChange={() => setDeliveryCharge(0)} /> No delivery</label><br />
            <label><input type="radio" name="delivery" checked={deliveryCharge === 30} onChange={() => setDeliveryCharge(30)} /> Within 3km (₹30)</label><br />
            <label><input type="radio" name="delivery" checked={deliveryCharge === 60} onChange={() => setDeliveryCharge(60)} /> Beyond 3km (₹60)</label>
          </div>
          <div className="pt-2">
            <div>Subtotal: ₹{totalItemPrice + customItemAmount}</div>
            <div>Delivery: ₹{deliveryCharge}</div>
            <div className="font-bold">Grand Total: ₹{grandTotal}</div>
          </div>
        </div>
      )}

      {/* 📤 Actions */}
      {selectedCustomer && (
        <div className="space-y-2">
          <Button className="bg-green-700 w-full" onClick={handleConfirmOrder}>Confirm Order</Button>
          <Button className="bg-gray-700 w-full" onClick={handleClear}>Clear</Button>
        </div>
      )}

      {/* 🧾 Bill Preview (Canvas) */}
      {selectedCustomer && selectedItems.length > 0 && (
        <div ref={billRef} className="bg-white text-black p-4 rounded text-xs font-mono">
          <div className="text-center font-bold">Maa Inti Vanta</div>
          <div>Date: {orderDate}</div>
          <div>Customer: {selectedCustomer?.name}</div>
          <div>Meal: {mealType}</div>
          <hr className="my-1" />
          <table className="w-full">
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Amt</th></tr>
            </thead>
            <tbody>
              {selectedItems.map(i => (
                <tr key={i.name}>
                  <td>{i.name}</td>
                  <td align="center">{i.quantity}</td>
                  <td align="right">₹{i.price * i.quantity}</td>
                </tr>
              ))}
              {customItemValid && (
                <tr>
                  <td>{customItemName}</td>
                  <td align="center">1</td>
                  <td align="right">₹{customItemAmount}</td>
                </tr>
              )}
            </tbody>
          </table>
          <hr className="my-1" />
          <div className="flex justify-between"><span>Subtotal</span><span>₹{totalItemPrice + customItemAmount}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span>₹{deliveryCharge}</span></div>
          <div className="flex justify-between font-bold"><span>Total</span><span>₹{grandTotal}</span></div>
        </div>
      )}

      {/* ➕ Add Customer Modal */}
      <Dialog open={showNewCustomerModal} onOpenChange={setShowNewCustomerModal}>
        <DialogContent>
          <h2 className="text-lg font-bold">New Customer</h2>
          <Input placeholder="Name" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
          <Input placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
          <Input placeholder="Address" value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} />
          <Button onClick={handleCreateCustomer}>Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
