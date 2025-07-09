import React, { useState, useEffect, useRef } from "react";
import { database } from "./firebase";
import { ref, onValue, push } from "firebase/database";
import html2canvas from "html2canvas-pro";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { format } from "date-fns";

// Persistent state hook using localStorage
function usePersistentState(key, initialValue) {
  const [state, setState] = React.useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  React.useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

// Copy-to-clipboard button
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <button
      className="ml-2 px-3 py-1 rounded bg-blue-800 text-gray-100 text-xs"
      onClick={handleCopy}
      type="button"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// Multi-select with pills and quantity, default quantity 0
function MultiSelectWithPills({ label, items, selected, setSelected }) {
  const handleSelect = (e) => {
    const itemName = e.target.value;
    if (!itemName) return;
    if (!selected.some(i => i.name === itemName)) {
      setSelected([...selected, { name: itemName, quantity: 0 }]);
    }
  };
  const handleRemove = (name) => setSelected(selected.filter(i => i.name !== name));
  const handleQuantity = (name, qty) =>
    setSelected(selected.map(i => i.name === name ? { ...i, quantity: qty } : i));
  return (
    <div className="mb-2">
      <Label className="text-gray-200">{label}</Label>
      <select className="w-full mt-1 p-3 rounded bg-[#23272f] text-gray-100 text-base" onChange={handleSelect} value="">
        <option value="">-- Select --</option>
        {items.map(i => (
          <option key={i.name} value={i.name}>{i.name}</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2 mt-2">
        {selected.map(i => (
          <div key={i.name} className="flex items-center bg-[#323844] text-gray-100 rounded-full px-3 py-1">
            <span>{i.name}</span>
            <input
              type="number"
              min={0}
              value={i.quantity}
              onChange={e => handleQuantity(i.name, Number(e.target.value))}
              className="mx-2 w-12 bg-[#23272f] text-gray-100 rounded"
            />
            <button onClick={() => handleRemove(i.name)} className="ml-1 text-red-300 text-lg">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BillingModule() {
  // Persistent dashboards
  const [cookingSession, setCookingSession] = usePersistentState("cookingDashboard", {});
  const [packagingSession, setPackagingSession] = usePersistentState("packagingDashboard", {});

  const initialSelectedItems = {
    breakfast: [], curry: [], daal: [], pickle: [], sambar: [], others: []
  };
  const initialDeliveryCharge = 30;
  const initialOrderDate = format(new Date(), "yyyy-MM-dd");

  const [customers, setCustomers] = useState([]);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [inventory, setInventory] = useState({
    breakfast: [],
    curry: [],
    daal: [],
    pickle: [],
    sambar: [],
    others: []
  });
  const [selectedItems, setSelectedItems] = useState(initialSelectedItems);
  const [orderDate, setOrderDate] = useState(initialOrderDate);
  const [deliveryCharge, setDeliveryCharge] = useState(initialDeliveryCharge);

  // Real-time customer order history for selected date
  const [customerOrders, setCustomerOrders] = useState([]);

  const billRef = useRef(null);

  // Load customers and inventory from Firebase
  useEffect(() => {
    onValue(ref(database, "customers"), snap => {
      const data = snap.val() || {};
      setCustomers(Object.entries(data).map(([id, v]) => ({ id, ...v })));
    });
    onValue(ref(database, "inventory"), snap => {
      const data = snap.val() || {};
      setInventory({
        breakfast: data.breakfast || [],
        curry: (data.lunchDinner && data.lunchDinner.curry) || [],
        daal: (data.lunchDinner && data.lunchDinner.daal) || [],
        pickle: (data.lunchDinner && data.lunchDinner.pickle) || [],
        sambar: (data.lunchDinner && data.lunchDinner.sambar) || [],
        others: (data.lunchDinner && data.lunchDinner.others) || []
      });
    });
  }, []);

  // Fetch real-time order history for selected customer and date
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerOrders([]);
      return;
    }
    const ordersRef = ref(database, `customerOrderHistory/${selectedCustomer.id}/orders`);
    const unsub = onValue(ordersRef, snap => {
      const data = snap.val() || {};
      const orders = Object.values(data);
      setCustomerOrders(
        orderDate
          ? orders.filter(o => o.date === orderDate)
          : orders
      );
    });
    return () => unsub();
  }, [selectedCustomer, orderDate]);

  // Customer creation
  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) return alert("Enter name and phone");
    const newRef = push(ref(database, "customers"), newCustomer);
    setShowCreateCustomer(false);
    setNewCustomer({ name: "", phone: "" });
    setSelectedCustomer({ ...newCustomer, id: newRef.key });
  };

  // Customer change with confirmation
  const handleCustomerChange = (id) => {
    if (selectedCustomer && selectedCustomer.id !== id) {
      if (!window.confirm("Switching customer will clear the current billing. Continue?")) return;
      setSelectedItems(initialSelectedItems);
      setDeliveryCharge(initialDeliveryCharge);
      setOrderDate(initialOrderDate);
    }
    setSelectedCustomer(customers.find(c => c.id === id));
  };

  // Get price for item
  const getItemPrice = (cat, name) => {
    const arr = inventory[cat] || [];
    const item = arr.find(i => i.name === name);
    return item?.price ? Number(item.price) : 0;
  };

  // Only items with quantity > 0
  const allSelected = Object.entries(selectedItems).flatMap(([cat, arr]) =>
    arr.filter(i => i.quantity > 0).map(i => ({ ...i, category: cat, price: getItemPrice(cat, i.name) }))
  );
  const totalItemPrice = allSelected.reduce((sum, row) => sum + row.price * row.quantity, 0);
  const grandTotal = totalItemPrice + Number(deliveryCharge);

  // Confirm order: update session dashboards and DB, then clear selections
  const handleConfirmOrder = async () => {
    if (!selectedCustomer) return alert("Select a customer");
    if (allSelected.length === 0) return alert("Select at least one item with quantity > 0");

    // Store in DB
    const orderData = {
      date: orderDate,
      items: allSelected.map(row => ({
        name: row.name,
        quantity: row.quantity,
        price: row.price
      })),
      deliveryCharges: deliveryCharge,
      grandTotal,
      customerName: selectedCustomer.name
    };
    await push(ref(database, `customerOrderHistory/${selectedCustomer.id}/orders`), orderData);

    // Update cooking session
    const newCooking = { ...cookingSession };
    allSelected.forEach(item => {
      newCooking[item.name] = (newCooking[item.name] || 0) + item.quantity;
    });
    setCookingSession(newCooking);

    // Update packaging session
    const newPackaging = { ...packagingSession };
    if (!newPackaging[selectedCustomer.name]) newPackaging[selectedCustomer.name] = {};
    allSelected.forEach(item => {
      newPackaging[selectedCustomer.name][item.name] =
        (newPackaging[selectedCustomer.name][item.name] || 0) + item.quantity;
    });
    setPackagingSession(newPackaging);

    // Download bill image (not displayed in UI)
    if (billRef.current) {
      const canvas = await html2canvas(billRef.current);
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `bill_${selectedCustomer.name || "customer"}.png`;
      link.click();
    }

    setSelectedItems(initialSelectedItems);
    setDeliveryCharge(initialDeliveryCharge);
  };

  // Clear all selections (for new order)
  const handleClearList = () => {
    setSelectedItems(initialSelectedItems);
    setDeliveryCharge(initialDeliveryCharge);
  };

  // Clear dashboards (for new meal session)
  const handleClearDashboards = () => {
    setCookingSession({});
    setPackagingSession({});
  };

  // Cooking dashboard textarea content
  const cookingText = Object.entries(cookingSession)
    .map(([item, qty]) => `${item}: ${qty}`)
    .join("\n");

  // Packaging dashboard textarea content
  const packagingText = Object.entries(packagingSession)
    .map(([customer, items]) =>
      `${customer}:\n` +
      Object.entries(items).map(([item, qty]) => `  ${item} x${qty}`).join("\n")
    ).join("\n\n");

  // Customer order history textarea content
  const customerHistoryText =
    customerOrders.length === 0
      ? "No orders for this date."
      : customerOrders.map(order =>
          order.items.map(item =>
            `${item.name} - ${item.quantity} - ₹${item.price * item.quantity}`
          ).join("\n") +
          `\nDelivery: ₹${order.deliveryCharges || 0}\nTotal: ₹${order.grandTotal || 0}\n`
        ).join("\n---\n");

  // Filter customers for search
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    c.phone?.includes(searchCustomer)
  );

  return (
    <div className="w-full max-w-xs mx-auto p-4 space-y-4 bg-[#181c23] rounded-lg">
      {/* Create button at the top, small width */}
      <div className="flex justify-end mb-2">
        <Button
          className="px-4 py-2 text-sm bg-green-700 text-gray-100 rounded"
          style={{ minWidth: 80, maxWidth: 100 }}
          onClick={() => setShowCreateCustomer(true)}
        >
          Create
        </Button>
      </div>
      <h2 className="text-xl font-bold mb-4 text-gray-100 text-center">Billing Module</h2>
      <div className="flex flex-col gap-2 bg-[#23272f] rounded-lg p-4">
        <Label className="text-gray-200">Customer</Label>
        <Input
          placeholder="Search customer"
          value={searchCustomer}
          onChange={e => setSearchCustomer(e.target.value)}
          className="w-full mb-2 p-3 rounded bg-[#23272f] text-gray-100 text-base"
        />
        <select
          className="w-full p-3 rounded bg-[#23272f] text-gray-100 text-base"
          value={selectedCustomer?.id || ""}
          onChange={e => handleCustomerChange(e.target.value)}
        >
          <option value="">-- Select Customer --</option>
          {filteredCustomers.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-gray-200">Date</Label>
        <Input
          type="date"
          value={orderDate}
          onChange={e => setOrderDate(e.target.value)}
          className="w-full p-3 rounded bg-[#23272f] text-gray-100 text-base"
        />
      </div>
      {showCreateCustomer && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="bg-[#23272f] rounded-lg p-4 w-full max-w-xs">
            <h3 className="font-bold mb-2 text-gray-100">Create Customer</h3>
            <input placeholder="Name" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} className="w-full mb-2 p-2 border rounded bg-[#181c23] text-gray-100" />
            <input placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="w-full mb-2 p-2 border rounded bg-[#181c23] text-gray-100" />
            <div className="flex gap-2">
              <Button className="w-full py-2 mb-2 bg-green-700 text-gray-100" onClick={handleCreateCustomer}>Create & Select</Button>
              <Button className="w-full py-2 bg-gray-700 text-gray-100" onClick={() => setShowCreateCustomer(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <Card className="bg-[#23272f]">
          <CardContent>
            <MultiSelectWithPills
              label="Breakfast"
              items={inventory.breakfast}
              selected={selectedItems.breakfast}
              setSelected={arr => setSelectedItems(s => ({ ...s, breakfast: arr }))}
            />
            <MultiSelectWithPills
              label="Curry"
              items={inventory.curry}
              selected={selectedItems.curry}
              setSelected={arr => setSelectedItems(s => ({ ...s, curry: arr }))}
            />
            <MultiSelectWithPills
              label="Daal"
              items={inventory.daal}
              selected={selectedItems.daal}
              setSelected={arr => setSelectedItems(s => ({ ...s, daal: arr }))}
            />
            <MultiSelectWithPills
              label="Pickle"
              items={inventory.pickle}
              selected={selectedItems.pickle}
              setSelected={arr => setSelectedItems(s => ({ ...s, pickle: arr }))}
            />
            <MultiSelectWithPills
              label="Sambar"
              items={inventory.sambar}
              selected={selectedItems.sambar}
              setSelected={arr => setSelectedItems(s => ({ ...s, sambar: arr }))}
            />
            <MultiSelectWithPills
              label="Others"
              items={inventory.others}
              selected={selectedItems.others}
              setSelected={arr => setSelectedItems(s => ({ ...s, others: arr }))}
            />

            <div className="flex flex-col gap-2 mt-6 bg-[#181c23] rounded-lg p-4">
              <Label className="text-gray-200">Delivery Charges</Label>
              <div className="flex flex-col gap-2 mt-2">
                {[
                  { label: "No delivery", value: 0 },
                  { label: "Within 3km (+₹30)", value: 30 },
                  { label: "Beyond 3km (+₹60)", value: 60 }
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 text-gray-100">
                    <input
                      type="radio"
                      name="delivery"
                      value={opt.value}
                      checked={deliveryCharge === opt.value}
                      onChange={() => setDeliveryCharge(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div className="text-right space-y-1 text-gray-100 mt-2">
                <div>Total Item Price: <b>₹{totalItemPrice}</b></div>
                <div>Delivery Charges: <b>₹{deliveryCharge}</b></div>
                <div className="text-lg">Grand Total: <b>₹{grandTotal}</b></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCustomer && (
        <div className="mt-4">
          <div
            ref={billRef}
            className="bg-[#181c23] text-gray-100 rounded-lg shadow-lg p-4 max-w-xs mx-auto border font-mono text-xs"
            style={{ minWidth: 280, fontFamily: "monospace", position: "relative", overflow: "hidden" }}
          >
            <div className="flex flex-col items-center mb-2">
              <span className="text-xl font-bold tracking-widest">Maa Inti Vanta</span>
              <span className="text-xs">Ph: 9346604522</span>
            </div>
            <hr className="my-2 border-gray-600" />
            <div className="flex justify-between text-xs mb-2">
              <span>Date: <b>{orderDate}</b></span>
              <span>Bill No: <b>{String(Date.now()).slice(-6)}</b></span>
            </div>
            <div className="mb-2 text-xs">
              Customer: <b>{selectedCustomer?.name}</b>
            </div>
            <table className="w-full text-xs border-t border-b border-gray-600 my-2">
              <thead>
                <tr className="text-left">
                  <th className="py-1 px-2">Item</th>
                  <th className="py-1 px-2 text-center">Qty</th>
                  <th className="py-1 px-2 text-right">Rate</th>
                  <th className="py-1 px-2 text-right">Amt</th>
                </tr>
              </thead>
              <tbody>
                {allSelected.map((row, idx) => (
                  <tr key={row.category + row.name}>
                    <td className="py-1 px-2">{row.name}</td>
                    <td className="py-1 px-2 text-center">{row.quantity}</td>
                    <td className="py-1 px-2 text-right">₹{row.price}</td>
                    <td className="py-1 px-2 text-right">₹{row.price * row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between text-xs mt-2">
              <span>Subtotal</span>
              <span>₹{totalItemPrice}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Delivery</span>
              <span>₹{deliveryCharge}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-gray-600 mt-2 pt-2">
              <span>Grand Total</span>
              <span>₹{grandTotal}</span>
            </div>
            <div className="text-center text-xs mt-4 italic">Thank you for dining with us!</div>
            <div className="absolute bottom-2 right-4 text-[10px] text-gray-400">Powered by Maa Inti Vanta</div>
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <Button
              className="w-full py-4 text-lg font-bold bg-green-700 text-gray-100 rounded-lg"
              onClick={handleConfirmOrder}
            >
              Confirm Order
            </Button>
            <Button
              className="w-full py-4 text-lg font-bold bg-blue-700 text-gray-100 rounded-lg"
              onClick={handleClearList}
            >
              Clear List
            </Button>
          </div>
        </div>
      )}

      {/* Always-visible Cumulative Cooking & Packaging Dashboards */}
      <div className="grid grid-cols-1 gap-4 mt-8">
        <div className="bg-[#23272f] rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Label className="text-gray-100 flex-1">Cooking Dashboard (Session)</Label>
            <CopyButton text={cookingText} />
          </div>
          <Textarea value={cookingText} rows={6} readOnly className="bg-[#181c23] text-gray-100" />
        </div>
        <div className="bg-[#23272f] rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Label className="text-gray-100 flex-1">Packaging Dashboard (Session)</Label>
            <CopyButton text={packagingText} />
          </div>
          <Textarea value={packagingText} rows={6} readOnly className="bg-[#181c23] text-gray-100" />
        </div>
        <Button
          className="w-full py-2 text-base font-bold bg-red-700 text-gray-100 rounded-lg mt-2"
          onClick={handleClearDashboards}
        >
          Clear Dashboards (New Meal Session)
        </Button>
      </div>

      {/* Real-time Customer Order History for selected date */}
      {selectedCustomer && (
        <div className="bg-[#23272f] rounded-lg p-4 mt-8">
          <div className="flex items-center mb-2">
            <Label className="text-gray-100 flex-1">Order History (for selected date)</Label>
            <CopyButton text={customerHistoryText} />
          </div>
          <Textarea
            value={customerHistoryText}
            rows={6}
            readOnly
            className="bg-[#181c23] text-gray-100"
          />
        </div>
      )}
    </div>
  );
}
